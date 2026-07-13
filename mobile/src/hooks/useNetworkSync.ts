import { useEffect } from 'react';
import NetInfo from '@react-native-community/netinfo';
import { syncPendingRequests } from '../services/syncService';
import { refreshFaceIndexFromServer } from '../services/faceIndexService';

// How often to re-pull the shared face directory while the phone stays
// connected. This is what lets Phone B (offline tomorrow) already have
// today's baby from Phone A cached locally — as long as Phone B had even
// a few minutes of internet at some point after Phone A's upload synced.
const FACE_INDEX_REFRESH_INTERVAL_MS = 5 * 60 * 1000; // 5 minutes

export const useNetworkSync = (enabled: boolean) => {
  useEffect(() => {
    if (!enabled) return;

    const onConnected = () => {
      syncPendingRequests();          // push this phone's queued data up
      refreshFaceIndexFromServer();   // pull everyone else's latest data down
    };

    // Fires the instant connectivity is regained — catches even brief
    // internet windows (e.g. walking past a WiFi-covered hallway).
    const unsubscribe = NetInfo.addEventListener((state) => {
      if (state.isConnected && state.isInternetReachable !== false) {
        onConnected();
      }
    });

    // Run once immediately on mount if already connected.
    NetInfo.fetch().then((state) => {
      if (state.isConnected) {
        onConnected();
      }
    });

    // Keep re-pulling periodically while the app stays open and connected,
    // so a phone that's been online for a while (not just at the moment
    // it reconnected) still picks up records added by other phones in
    // the meantime.
    const intervalId = setInterval(async () => {
      const state = await NetInfo.fetch();
      if (state.isConnected && state.isInternetReachable !== false) {
        refreshFaceIndexFromServer();
      }
    }, FACE_INDEX_REFRESH_INTERVAL_MS);

    return () => {
      unsubscribe();
      clearInterval(intervalId);
    };
  }, [enabled]);
};
