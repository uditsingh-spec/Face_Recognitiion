import React, { useState, useRef } from 'react';
import { View, Text, StyleSheet, ActivityIndicator, Modal, ScrollView, Image } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import NetInfo from '@react-native-community/netinfo';
import { moderateScale } from 'react-native-size-matters';
import { ScanFace, ArrowLeft } from 'lucide-react-native';
import { TouchableOpacity } from 'react-native';
import FaceCaptureModal from '../components/FaceCaptureModal';
import { FaceScanResult } from '../services/faceService';
import { findMatchLocally } from '../services/faceIndexService';
import api from '../services/api';

export default function FaceScanScreen() {
  const navigation = useNavigation<any>();
  const [showCapture, setShowCapture] = useState(true);
  const [searching, setSearching] = useState(false);
  const [matchedBabies, setMatchedBabies] = useState<any[] | null>(null);

  // Prevents onClose (navigation.goBack) from firing when handleCaptured
  // has already taken over navigation (e.g. after "Use This Photo").
  const handlingCaptureRef = useRef(false);

  const handleCaptured = async (imageUri: string, scan: FaceScanResult | null) => {
    handlingCaptureRef.current = true; // block onClose from navigating
    setShowCapture(false);

    if (!scan) {
      // Face profile generation failed — go directly to AddBaby with the photo
      console.log('[FaceScanScreen] scan null, navigating to AddBaby with photo');
      navigation.replace('AddBaby', {
        prefilledImageUri: imageUri,
        prefilledFaceScan: null,
      });
      return;
    }

    // Face profile generated — search for a match
    setSearching(true);
    try {
      const netState = await NetInfo.fetch();

      if (netState.isConnected) {
        try {
          const { data } = await api.post('/babies/match-face', { embedding: scan.embedding });
          let matches = data?.matches;
          if (!matches && data?.matched && data?.babyId) {
            // Old server fallback
            matches = [{ babyId: data.babyId, motherName: 'Unknown', displayId: 'Unknown', distance: data.distance }];
          }

          if (matches && matches.length > 0) {
            console.log('[FaceScanScreen] online match found:', matches.length);
            if (matches.length === 1) {
              navigation.replace('BabyDetails', { babyId: matches[0].babyId });
            } else {
              setMatchedBabies(matches);
            }
            return;
          }
        } catch (e) {
          console.log('[FaceScanScreen] online match failed, falling back to local cache:', e);
        }
      }

      // Offline or no online match — search local cache
      const localMatches = await findMatchLocally(scan.embedding);
      if (localMatches && localMatches.length > 0) {
        console.log('[FaceScanScreen] local match found:', localMatches.length);
        if (localMatches.length === 1) {
          navigation.replace('BabyDetails', { babyId: localMatches[0].entry.babyId });
        } else {
          // Map localMatches to the same format as online matches
          const formattedMatches = localMatches.map(m => ({
            babyId: m.entry.babyId,
            motherName: m.entry.motherName,
            displayId: m.entry.displayId,
            distance: m.distance,
            motherImage: m.entry.motherImage
          }));
          setMatchedBabies(formattedMatches);
        }
        return;
      }

      // No match found anywhere — go to AddBaby prefilled with the face photo + embedding
      console.log('[FaceScanScreen] no match found, navigating to AddBaby');
      navigation.replace('AddBaby', {
        prefilledImageUri: imageUri,
        prefilledFaceScan: scan,
      });
    } finally {
      setSearching(false);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity
          onPress={() => navigation.goBack()}
          style={styles.backBtn}
        >
          <ArrowLeft size={20} color="#475569" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Scan to Find Baby</Text>
        <View style={{ width: moderateScale(36) }} />
      </View>

      <View style={styles.body}>
        {searching ? (
          <>
            <ActivityIndicator size="large" color="#2563eb" />
            <Text style={styles.statusText}>Searching for a match…</Text>
          </>
        ) : (
          <>
            <ScanFace size={48} color="#94a3b8" />
            <Text style={styles.statusText}>Preparing camera…</Text>
          </>
        )}
      </View>

      <FaceCaptureModal
        visible={showCapture && !matchedBabies}
        onClose={() => {
          // Only go back if handleCaptured has NOT taken over navigation
          if (!handlingCaptureRef.current) {
            navigation.goBack();
          }
        }}
        onCaptured={handleCaptured}
      />

      <Modal visible={!!matchedBabies} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Multiple Matches Found</Text>
            <Text style={styles.modalText}>Please select the correct profile:</Text>
            
            <ScrollView style={{ maxHeight: moderateScale(300), width: '100%' }}>
              {matchedBabies?.map((match, index) => (
                <TouchableOpacity
                  key={match.babyId || index.toString()}
                  style={styles.matchItem}
                  onPress={() => {
                    setMatchedBabies(null);
                    navigation.replace('BabyDetails', { babyId: match.babyId });
                  }}
                >
                  {match.motherImage ? (
                    <Image source={{ uri: match.motherImage }} style={styles.matchImgPlaceholder} />
                  ) : (
                    <View style={styles.matchImgPlaceholder}>
                      <Text style={styles.matchImgInitial}>{match.motherName?.charAt(0) || '?'}</Text>
                    </View>
                  )}
                  <View style={{ flex: 1 }}>
                    <Text style={styles.matchName}>{match.motherName}</Text>
                    <Text style={styles.matchId}>ID: {match.displayId}</Text>
                  </View>
                </TouchableOpacity>
              ))}
            </ScrollView>

            <TouchableOpacity style={[styles.modalBtn, styles.modalBtnSecondary]} onPress={() => {
              setMatchedBabies(null);
              navigation.goBack();
            }}>
              <Text style={styles.modalBtnSecondaryText}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f8fafc' },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    padding: moderateScale(16), backgroundColor: '#fff',
    borderBottomWidth: 1, borderBottomColor: '#f1f5f9',
  },
  backBtn: {
    width: moderateScale(36), height: moderateScale(36),
    borderRadius: moderateScale(10), backgroundColor: '#f8fafc',
    justifyContent: 'center', alignItems: 'center',
  },
  headerTitle: { fontSize: moderateScale(16), fontWeight: '700', color: '#1e293b' },
  body: {
    flex: 1, justifyContent: 'center', alignItems: 'center',
    gap: moderateScale(14), padding: moderateScale(24),
  },
  statusText: { fontSize: moderateScale(14), color: '#64748b' },
  
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', padding: moderateScale(24) },
  modalContent: { backgroundColor: '#ffffff', borderRadius: moderateScale(16), padding: moderateScale(24), shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.1, shadowRadius: 12, elevation: 8, alignItems: 'center' },
  modalTitle: { fontSize: moderateScale(20), fontWeight: 'bold', color: '#1e293b', marginBottom: moderateScale(8), textAlign: 'center' },
  modalText: { fontSize: moderateScale(14), color: '#64748b', textAlign: 'center', marginBottom: moderateScale(20) },
  
  matchItem: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#f8fafc', padding: moderateScale(12), borderRadius: moderateScale(12), marginBottom: moderateScale(12), borderWidth: 1, borderColor: '#e2e8f0', width: '100%' },
  matchImgPlaceholder: { width: moderateScale(40), height: moderateScale(40), borderRadius: moderateScale(20), backgroundColor: '#e2e8f0', justifyContent: 'center', alignItems: 'center', marginRight: moderateScale(12) },
  matchImgInitial: { fontSize: moderateScale(18), fontWeight: 'bold', color: '#64748b' },
  matchName: { fontSize: moderateScale(16), fontWeight: 'bold', color: '#1e293b' },
  matchId: { fontSize: moderateScale(13), color: '#64748b', marginTop: moderateScale(2) },
  
  modalBtn: { width: '100%', paddingVertical: moderateScale(12), borderRadius: moderateScale(10), alignItems: 'center', justifyContent: 'center', marginTop: moderateScale(12) },
  modalBtnSecondary: { backgroundColor: '#ffffff', borderWidth: 1, borderColor: '#e2e8f0' },
  modalBtnSecondaryText: { color: '#475569', fontWeight: 'bold', fontSize: moderateScale(14) },
});
