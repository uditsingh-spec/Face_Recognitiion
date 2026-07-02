import React, { useEffect, useState } from 'react';
import { View, Text, ActivityIndicator, DeviceEventEmitter, StyleSheet, Modal, TouchableOpacity, Image, ScrollView } from 'react-native';
import { navigationRef } from '../navigation/AppNavigator';
import { getDB } from '../services/db';
import { syncPendingRequests } from '../services/syncService';

export const GlobalSyncBanner: React.FC = () => {
  const [syncStatus, setSyncStatus] = useState<'syncing' | 'synced' | 'failed' | null>(null);
  const [conflictData, setConflictData] = useState<{ queueId: number; payload: any; existingBabies: any[] } | null>(null);

  useEffect(() => {
    const subStart = DeviceEventEmitter.addListener('syncStarted', () => setSyncStatus('syncing'));
    const subComplete = DeviceEventEmitter.addListener('syncCompleted', () => {
      setSyncStatus('synced');
      setTimeout(() => setSyncStatus(null), 3000);
    });
    const subFailed = DeviceEventEmitter.addListener('syncFailed', () => {
      setSyncStatus('failed');
      setTimeout(() => setSyncStatus(null), 3000);
    });
    const subConflict = DeviceEventEmitter.addListener('syncDuplicateFound', (data) => {
      setSyncStatus(null);
      setConflictData(data);
    });

    return () => {
      subStart.remove();
      subComplete.remove();
      subFailed.remove();
      subConflict.remove();
    };
  }, []);

  const handleDiscard = async () => {
    if (!conflictData) return;
    const db = getDB();
    await db.runAsync('DELETE FROM sync_queue WHERE id = ?', conflictData.queueId);
    
    if (navigationRef.isReady()) {
      // Navigate to the first baby in the array if discarded
      navigationRef.navigate('BabyDetails', { babyId: conflictData.existingBabies[0]._id });
    }
    setConflictData(null);
    syncPendingRequests(); // Resume sync
  };

  const handleAddAnyway = async () => {
    if (!conflictData) return;
    const db = getDB();
    const newPayload = { ...conflictData.payload, forceSave: true };
    await db.runAsync('UPDATE sync_queue SET payload_json = ? WHERE id = ?', JSON.stringify(newPayload), conflictData.queueId);
    setConflictData(null);
    syncPendingRequests(); // Resume sync
  };

  if (!syncStatus && !conflictData) return null;

  return (
    <>
      {syncStatus && (
        <View style={[styles.syncBanner, syncStatus === 'failed' && { backgroundColor: '#ef4444' }]}>
          {syncStatus === 'syncing' ? (
            <ActivityIndicator size="small" color="#fff" style={{ marginRight: 8 }} />
          ) : null}
          <Text allowFontScaling={false} style={styles.syncText}>
            {syncStatus === 'syncing' ? 'Syncing...' : syncStatus === 'failed' ? 'Sync failed' : 'Synced successfully'}
          </Text>
        </View>
      )}

      {/* Duplicate Baby Global Modal */}
      <Modal visible={!!conflictData} transparent={true} animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text allowFontScaling={false} style={styles.modalTitle}>Similar Baby Found During Sync</Text>
            <Text allowFontScaling={false} style={styles.modalText}>
              An offline record matches an existing baby on the server. Do you want to add it anyway?
            </Text>

            {conflictData?.existingBabies && (
              <ScrollView style={{ width: '100%', marginVertical: 12, maxHeight: 300 }}>
                {conflictData.existingBabies.map((baby, idx) => (
                  <View key={idx} style={[styles.conflictInfo, { marginBottom: 8 }]}>
                    {baby.motherImage ? (
                      <Image source={{ uri: baby.motherImage }} style={styles.conflictImg} />
                    ) : (
                      <View style={styles.conflictImgPlaceholder}>
                        <Text allowFontScaling={false} style={styles.conflictImgInitial}>
                          {baby.motherName.charAt(0).toUpperCase()}
                        </Text>
                      </View>
                    )}
                    <View style={{ flex: 1 }}>
                      <Text allowFontScaling={false} style={styles.conflictName}>{baby.motherName}</Text>
                      <Text allowFontScaling={false} style={styles.conflictId}>{baby.displayId}</Text>
                    </View>
                  </View>
                ))}
              </ScrollView>
            )}

            <View style={styles.modalButtons}>
              <TouchableOpacity style={[styles.modalBtn, styles.modalBtnSecondary]} onPress={handleDiscard}>
                <Text allowFontScaling={false} style={styles.modalBtnSecondaryText}>Discard & View</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.modalBtn, styles.modalBtnPrimary]} onPress={handleAddAnyway}>
                <Text allowFontScaling={false} style={styles.modalBtnPrimaryText}>Add Anyway</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </>
  );
};

const styles = StyleSheet.create({
  syncBanner: {
    position: 'absolute',
    top: 50,
    alignSelf: 'center',
    backgroundColor: 'rgba(79, 70, 229, 0.95)',
    borderRadius: 20,
    paddingVertical: 8,
    paddingHorizontal: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 9999,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    elevation: 5,
  },
  syncText: {
    color: '#fff',
    fontWeight: '600',
    fontSize: 14,
  },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', padding: 24, zIndex: 9999 },
  modalContent: { backgroundColor: '#ffffff', borderRadius: 16, padding: 24, shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.1, shadowRadius: 12, elevation: 8 },
  modalTitle: { fontSize: 20, fontWeight: 'bold', color: '#1e293b', marginBottom: 8, textAlign: 'center' },
  modalText: { fontSize: 14, color: '#64748b', textAlign: 'center', marginBottom: 24, lineHeight: 20 },
  conflictInfo: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#f8fafc', padding: 16, borderRadius: 12, marginBottom: 24, borderWidth: 1, borderColor: '#e2e8f0' },
  conflictImg: { width: 56, height: 56, borderRadius: 28, marginRight: 16 },
  conflictImgPlaceholder: { width: 56, height: 56, borderRadius: 28, marginRight: 16, backgroundColor: '#e2e8f0', justifyContent: 'center', alignItems: 'center' },
  conflictImgInitial: { fontSize: 24, fontWeight: 'bold', color: '#64748b' },
  conflictName: { fontSize: 16, fontWeight: 'bold', color: '#1e293b' },
  conflictId: { fontSize: 14, color: '#64748b', marginTop: 2 },
  modalButtons: { flexDirection: 'row', gap: 12 },
  modalBtn: { flex: 1, paddingVertical: 12, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  modalBtnSecondary: { backgroundColor: '#ffffff', borderWidth: 1, borderColor: '#e2e8f0' },
  modalBtnSecondaryText: { color: '#475569', fontWeight: 'bold', fontSize: 13 },
  modalBtnPrimary: { backgroundColor: '#4f46e5' },
  modalBtnPrimaryText: { color: '#ffffff', fontWeight: 'bold', fontSize: 14 }
});
