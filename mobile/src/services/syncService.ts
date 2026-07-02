import { getDB } from './db';
import api from './api';
import { DeviceEventEmitter } from 'react-native';

let isSyncing = false;

export const queueRequest = async (url: string, method: string, payload: any, imageUri?: string, tempId?: string) => {
  const db = getDB();
  await db.runAsync(
    'INSERT INTO sync_queue (url, method, payload_json, image_uri, temp_id) VALUES (?, ?, ?, ?, ?)',
    url, method, JSON.stringify(payload), imageUri || null, tempId || null
  );
  DeviceEventEmitter.emit('localDataUpdated');
};

export const syncPendingRequests = async () => {
  if (isSyncing) return;
  isSyncing = true;

  let syncAttempted = false;
  let successfullySynced = false;

  try {
    const db = getDB();
    const rows = await db.getAllAsync<any>('SELECT * FROM sync_queue ORDER BY id ASC');

    if (rows.length === 0) {
      isSyncing = false;
      return;
    }

    syncAttempted = true;
    DeviceEventEmitter.emit('syncStarted');
    console.log(`Starting sync of ${rows.length} pending requests`);
    const idMap: Record<string, string> = {};

    for (const row of rows) {
      let finalUrl = row.url;
      // Map temporary IDs in URL to actual MongoDB IDs
      for (const [tempId, realId] of Object.entries(idMap)) {
        if (finalUrl.includes(tempId)) {
          finalUrl = finalUrl.replace(tempId, realId);
        }
      }

      const payload = JSON.parse(row.payload_json);
      let requestData: any = payload;
      const isBabyRoute = finalUrl === '/babies' || (finalUrl.startsWith('/babies/') && !finalUrl.includes('/samples'));

      if (isBabyRoute) {
        requestData = new FormData();
        for (const key in payload) {
          if (payload[key] !== undefined && payload[key] !== null) {
            requestData.append(key, payload[key].toString());
          }
        }

        if (row.image_uri && !row.image_uri.startsWith('http')) {
          const filename = row.image_uri.split('/').pop() || 'photo.jpg';
          const match = /\.(\w+)$/.exec(filename);
          const type = match ? `image/${match[1]}` : `image/jpeg`;
          requestData.append('motherImage', {
            uri: row.image_uri,
            name: filename,
            type,
          } as any);
        }
      }

      try {
        const response = await (api as any)[row.method.toLowerCase()](finalUrl, requestData);
        
        // If this was a baby creation, map the temp ID to the new real ID
        if (row.temp_id && response.data) {
          if (Array.isArray(response.data) && response.data.length >= 2) {
            idMap[`${row.temp_id}-A`] = response.data[0]._id;
            idMap[`${row.temp_id}-B`] = response.data[1]._id;
            await db.runAsync(`UPDATE sync_queue SET url = REPLACE(url, ?, ?) WHERE url LIKE ?`, `${row.temp_id}-A`, response.data[0]._id, `%${row.temp_id}-A%`);
            await db.runAsync(`UPDATE sync_queue SET url = REPLACE(url, ?, ?) WHERE url LIKE ?`, `${row.temp_id}-B`, response.data[1]._id, `%${row.temp_id}-B%`);
            await db.runAsync(`UPDATE sync_queue SET payload_json = REPLACE(payload_json, ?, ?) WHERE payload_json LIKE ?`, `${row.temp_id}-A`, response.data[0]._id, `%${row.temp_id}-A%`);
            await db.runAsync(`UPDATE sync_queue SET payload_json = REPLACE(payload_json, ?, ?) WHERE payload_json LIKE ?`, `${row.temp_id}-B`, response.data[1]._id, `%${row.temp_id}-B%`);
          } else if (response.data._id) {
            idMap[row.temp_id] = response.data._id;
            await db.runAsync(`UPDATE sync_queue SET url = REPLACE(url, ?, ?) WHERE url LIKE ?`, row.temp_id, response.data._id, `%${row.temp_id}%`);
            await db.runAsync(`UPDATE sync_queue SET payload_json = REPLACE(payload_json, ?, ?) WHERE payload_json LIKE ?`, row.temp_id, response.data._id, `%${row.temp_id}%`);
          }
        }
        
        // Cache synced data so it doesn't disappear when offline again
        if (row.method.toLowerCase() === 'post' && response.data) {
           if (finalUrl.includes('/samples')) {
              const match = finalUrl.match(/\/babies\/([^\/]+)\/samples/);
              if (match) {
                 const bId = match[1];
                 try {
                    const cachedSamples = await db.getFirstAsync<{data: string}>('SELECT data FROM cache WHERE key = ?', `samples_${bId}`);
                    if (cachedSamples) {
                       const sList = JSON.parse(cachedSamples.data);
                       sList.push(response.data);
                       await db.runAsync('UPDATE cache SET data = ? WHERE key = ?', JSON.stringify(sList), `samples_${bId}`);
                    } else {
                       await db.runAsync('INSERT INTO cache (key, data) VALUES (?, ?)', `samples_${bId}`, JSON.stringify([response.data]));
                    }
                 } catch(e) {}
              }
           } else if (finalUrl === '/babies') {
              try {
                 const cachedList = await db.getFirstAsync<{data: string}>("SELECT data FROM cache WHERE key = 'babies_list'");
                 if (cachedList) {
                    const list = JSON.parse(cachedList.data);
                    if (Array.isArray(response.data)) {
                       list.unshift(...response.data);
                    } else {
                       list.unshift(response.data);
                    }
                    await db.runAsync("UPDATE cache SET data = ? WHERE key = 'babies_list'", JSON.stringify(list));
                 }
              } catch(e) {}
           }
        }

        // Successfully synced, remove from queue
        await db.runAsync('DELETE FROM sync_queue WHERE id = ?', row.id);
        console.log(`Successfully synced request ${row.id}`);
        successfullySynced = true;
      } catch (err: any) {
        console.log(`Failed to sync request ${row.id}`, err.message, err.response?.data || 'No response data');
        const status = err.response?.status;
        if (status === 409 && err.response?.data?.code === 'DUPLICATE_BABY') {
          // Pause sync and notify UI to show Duplicate Baby modal
          DeviceEventEmitter.emit('syncDuplicateFound', {
            queueId: row.id,
            payload: payload,
            existingBabies: err.response.data.existingBabies
          });
          break; // Stop syncing until user resolves
        }
        
        if (status && status >= 400 && status < 500 && status !== 408 && status !== 429) {
          // Unrecoverable client error (like 400 Bad Request, 401 Unauthorized), remove from queue
          await db.runAsync('DELETE FROM sync_queue WHERE id = ?', row.id);
          continue;
        }
        // Stop syncing to maintain chronological order for network errors
        break;
      }
    }
  } catch (error) {
    console.log('Error during sync engine execution', error);
  } finally {
    isSyncing = false;
    if (successfullySynced) {
      DeviceEventEmitter.emit('syncCompleted');
    } else if (syncAttempted) {
      DeviceEventEmitter.emit('syncFailed');
    }
  }
};
