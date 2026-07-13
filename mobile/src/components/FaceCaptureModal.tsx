import React, { useState, useEffect, useRef } from 'react';
import {
  Modal, View, Text, TouchableOpacity, StyleSheet,
  ActivityIndicator, Image,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { Platform, StatusBar } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { moderateScale } from 'react-native-size-matters';
import { Camera, ImageIcon, X, CheckCircle2 } from 'lucide-react-native';
import { getFaceEmbedding, isFaceServiceReady, initFaceService, FaceScanResult } from '../services/faceService';

interface FaceCaptureModalProps {
  visible: boolean;
  onClose: () => void;
  onCaptured: (imageUri: string, scan: FaceScanResult | null) => void;
}

export default function FaceCaptureModal({ visible, onClose, onCaptured }: FaceCaptureModalProps) {
  console.log('[FaceCaptureModal] rendered, visible =', visible);
  const [processing, setProcessing] = useState(false);
  const [previewUri, setPreviewUri] = useState<string | null>(null);
  const [scanResult, setScanResult] = useState<FaceScanResult | null>(null);
  const [scanFailed, setScanFailed] = useState(false);
  const scanTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Prevents stale async callbacks from updating state after modal is reset
  const insets = useSafeAreaInsets();
  const headerPaddingTop = Platform.OS === 'android' ? StatusBar.currentHeight || insets.top : insets.top;
  const cancelledRef = useRef(false);

  const runScan = async (uri: string) => {
    console.log('[runScan] START', uri);
    cancelledRef.current = false;
    setProcessing(true);
    setScanFailed(false);

    // Hard UI timeout — unblocks the UI if recognition net hangs > 40s
    scanTimeoutRef.current = setTimeout(() => {
      if (cancelledRef.current) return;
      console.warn('[runScan] Hard timeout fired — unblocking UI');
      setProcessing(false);
      setScanFailed(true);
    }, 40000);

    try {
      if (!isFaceServiceReady()) {
        console.log('[runScan] Models not ready, initializing');
        await initFaceService();
      }
      if (cancelledRef.current) return;
      console.log('[runScan] Calling getFaceEmbedding');
      const result = await getFaceEmbedding(uri);
      if (cancelledRef.current) return;
      console.log('[runScan] getFaceEmbedding returned:', result ? `embedding[${result.embedding.length}]` : 'null');
      // With the recognition-net direct approach, result should always be non-null.
      // If it is null, we still let the user proceed (photo saves without face profile).
      if (!result) {
        setScanFailed(true);
      }
      setScanResult(result);
    } catch (e) {
      if (cancelledRef.current) return;
      console.error('[runScan] Error:', e);
      setScanFailed(true);
    } finally {
      if (scanTimeoutRef.current) {
        clearTimeout(scanTimeoutRef.current);
        scanTimeoutRef.current = null;
      }
      if (!cancelledRef.current) {
        setProcessing(false);
      }
      console.log('[runScan] DONE');
    }
  };

  const captureFromCamera = async () => {
    console.log('[FaceCaptureModal] captureFromCamera invoked');
    const { status } = await ImagePicker.requestCameraPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permission needed', 'Camera permission is required.');
      return;
    }
    const result = await ImagePicker.launchCameraAsync({
      mediaTypes: ['images'],
      quality: 0.7,
    });
    if (!result.canceled) {
      const uri = result.assets[0].uri;
      setPreviewUri(uri);
      runScan(uri);
    }
  };

  const captureFromGallery = async () => {
    console.log('[FaceCaptureModal] captureFromGallery invoked');
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      quality: 0.7,
    });
    if (!result.canceled) {
      const uri = result.assets[0].uri;
      setPreviewUri(uri);
      runScan(uri);
    }
  };

  const confirmAndClose = () => {
    if (!previewUri) return;
    onCaptured(previewUri, scanResult);
    reset();
    onClose();
  };

  const reset = () => {
    cancelledRef.current = true; // abort any in-flight scan
    if (scanTimeoutRef.current) {
      clearTimeout(scanTimeoutRef.current);
      scanTimeoutRef.current = null;
    }
    setPreviewUri(null);
    setScanResult(null);
    setScanFailed(false);
    setProcessing(false);
  };

  const handleClose = () => {
    reset();
    onClose();
  };

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={handleClose}>
      <SafeAreaView style={styles.container} edges={['bottom', 'left', 'right']}>
        <View style={[styles.header, { paddingTop: Math.max(moderateScale(16), headerPaddingTop) }]}>
          <Text style={styles.title}>Face Capture (Offline)</Text>
          <TouchableOpacity onPress={handleClose} style={styles.closeBtn}>
            <X size={20} color="#475569" />
          </TouchableOpacity>
        </View>

        <View style={styles.body}>
          {!previewUri ? (
            <View style={styles.pickerArea}>
              <Text style={styles.hint}>
                Capture the mother's face. Recognition runs fully on-device — works with
                no internet connection.
              </Text>
              <TouchableOpacity style={styles.actionBtn} onPress={captureFromCamera}>
                <Camera size={20} color="#fff" />
                <Text style={styles.actionBtnText}>Open Camera</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.actionBtn, styles.secondaryBtn]} onPress={captureFromGallery}>
                <ImageIcon size={20} color="#2563eb" />
                <Text style={[styles.actionBtnText, styles.secondaryBtnText]}>Choose from Gallery</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <View style={styles.previewArea}>
              <Image source={{ uri: previewUri }} style={styles.previewImage} />

              {processing && (
                <View style={styles.statusRow}>
                  <ActivityIndicator color="#2563eb" />
                  <Text style={styles.statusText}>Generating face profile… Please wait.</Text>
                </View>
              )}

              {!processing && scanResult && (
                <View style={[styles.statusRow, styles.successRow]}>
                  <CheckCircle2 size={18} color="#16a34a" />
                  <Text style={[styles.statusText, styles.successText]}>
                    Face profile captured — ready for identification
                  </Text>
                </View>
              )}

              {!processing && scanFailed && (
                <View style={[styles.statusRow, styles.warnRow]}>
                  <Text style={styles.warnText}>
                    Could not generate face profile — photo will be saved without face recognition.
                  </Text>
                </View>
              )}

              <View style={styles.previewActions}>
                <TouchableOpacity style={styles.retakeBtn} onPress={reset}>
                  <Text style={styles.retakeBtnText}>Retake</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.confirmBtn, processing && styles.disabledBtn]}
                  onPress={confirmAndClose}
                  disabled={processing}
                >
                  <Text style={styles.confirmBtnText}>Use This Photo</Text>
                </TouchableOpacity>
              </View>
            </View>
          )}
        </View>
      </SafeAreaView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f8fafc' },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: moderateScale(16), borderBottomWidth: 1, borderBottomColor: '#f1f5f9', backgroundColor: '#fff' },
  title: { fontSize: moderateScale(17), fontWeight: '700', color: '#1e293b' },
  closeBtn: { width: moderateScale(36), height: moderateScale(36), borderRadius: moderateScale(10), backgroundColor: '#f8fafc', justifyContent: 'center', alignItems: 'center' },
  body: { flex: 1, padding: moderateScale(20) },
  pickerArea: { flex: 1, justifyContent: 'center', gap: moderateScale(14) },
  hint: { fontSize: moderateScale(13), color: '#64748b', textAlign: 'center', marginBottom: moderateScale(10), lineHeight: moderateScale(19) },
  actionBtn: { flexDirection: 'row', gap: moderateScale(8), backgroundColor: '#2563eb', padding: moderateScale(15), borderRadius: moderateScale(12), alignItems: 'center', justifyContent: 'center' },
  secondaryBtn: { backgroundColor: '#eff6ff', borderWidth: 1.5, borderColor: '#bfdbfe' },
  actionBtnText: { color: '#fff', fontWeight: '700', fontSize: moderateScale(15) },
  secondaryBtnText: { color: '#2563eb' },
  previewArea: { flex: 1, alignItems: 'center' },
  previewImage: { width: '100%', height: moderateScale(320), borderRadius: moderateScale(16), resizeMode: 'cover' },
  statusRow: { flexDirection: 'row', alignItems: 'center', gap: moderateScale(8), marginTop: moderateScale(14), flexShrink: 1 },
  statusText: { fontSize: moderateScale(13), color: '#64748b', flexShrink: 1 },
  successRow: {},
  successText: { color: '#16a34a', fontWeight: '600' },
  warnRow: {},
  warnText: { fontSize: moderateScale(13), color: '#d97706', flexShrink: 1, textAlign: 'center' },
  previewActions: { flexDirection: 'row', gap: moderateScale(10), marginTop: moderateScale(24), width: '100%' },
  retakeBtn: { flex: 1, padding: moderateScale(14), borderRadius: moderateScale(12), borderWidth: 1.5, borderColor: '#e2e8f0', alignItems: 'center' },
  retakeBtnText: { color: '#475569', fontWeight: '700' },
  confirmBtn: { flex: 1, padding: moderateScale(14), borderRadius: moderateScale(12), backgroundColor: '#2563eb', alignItems: 'center' },
  disabledBtn: { opacity: 0.6 },
  confirmBtnText: { color: '#fff', fontWeight: '700' },
});
