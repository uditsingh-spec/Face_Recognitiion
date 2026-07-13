import React, { useEffect, useState, useCallback } from 'react';
import { View, Text, TouchableOpacity, ScrollView, ActivityIndicator, RefreshControl, StyleSheet, Image, Modal, TouchableWithoutFeedback } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRoute, useNavigation, RouteProp, useFocusEffect } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RootStackParamList } from '../navigation/AppNavigator';
import { ArrowLeft, Plus, Pencil } from 'lucide-react-native';
import { moderateScale } from 'react-native-size-matters';
import api from '../services/api';
import { getDB } from '../services/db';
import { useAuthStore } from '../store/useAuthStore';

type DetailsRouteProp = RouteProp<RootStackParamList, 'BabyDetails'>;
type NavigationProp = NativeStackNavigationProp<RootStackParamList>;

interface BabyDetails {
  _id: string;
  displayId: string;
  motherName: string;
  motherAge?: number;
  motherImage?: string;
  gender: string;
  weight: number;
  gestationalAge: string;
  dob: string;
  skinForehead?: number;
  skinSternum?: number;
  termStatus?: string;
}

interface Sample {
  _id: string;
  sampleNumber: number;
  weight: number;
  createdDate: string;
  createdTime: string;
}

const formatDateDDMMYYYY = (dateStr: string | undefined) => {
  if (!dateStr) return '';
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return '';
  const day = String(d.getDate()).padStart(2, '0');
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const year = d.getFullYear();
  return `${day}-${month}-${year}`;
};

export default function BabyDetailsScreen() {
  const route = useRoute<DetailsRouteProp>();
  const navigation = useNavigation<NavigationProp>();
  const { babyId } = route.params;

  const [baby, setBaby] = useState<BabyDetails | null>(null);
  const [samples, setSamples] = useState<Sample[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  
  const user = useAuthStore(state => state.user);

  const fetchDetails = async () => {
    try {
      if (babyId.startsWith('local-')) {
        const db = getDB();
        const baseId = babyId.replace(/-[AB]$/, '');
        const row = await db.getFirstAsync<any>("SELECT * FROM sync_queue WHERE temp_id = ?", baseId);
        if (row) {
          const payload = JSON.parse(row.payload_json);
          const isTwin = payload.isTwin === 'true' || payload.isTwin === true;
          const isTwinA = babyId.endsWith('-A');
          
          let babyObj: any = {
             ...payload,
             _id: babyId,
             displayId: `Pending-${baseId.substring(0,4)}` + (isTwin ? (isTwinA ? '-A' : '-B') : ''),
             motherName: payload.motherName || 'Unknown',
             motherAge: payload.motherAge || 0,
             gestationalAge: payload.gestationalAge || '',
             dob: payload.dob || '',
             isTwin: isTwin,
             motherImage: row.image_uri,
             isPending: true,
          };
          
          if (isTwin) {
             babyObj.gender = isTwinA ? payload.genderA : payload.genderB;
             babyObj.weight = isTwinA ? payload.weightA : payload.weightB;
             babyObj.skinForehead = isTwinA ? payload.skinForeheadA : payload.skinForeheadB;
             babyObj.skinSternum = isTwinA ? payload.skinSternumA : payload.skinSternumB;
             babyObj.twinLabel = isTwinA ? 'A' : 'B';
          } else {
             babyObj.gender = payload.gender || 'Unknown';
             babyObj.weight = payload.weight || 0;
          }
          
          setBaby(babyObj);
        }
        
        const samplesRows = await db.getAllAsync<any>("SELECT * FROM sync_queue WHERE method = 'post' AND url LIKE ?", `%/babies/${babyId}/samples%`);
        setSamples(samplesRows.map((s, index) => {
          const payload = JSON.parse(s.payload_json);
          const created = s.created_at ? new Date(s.created_at + 'Z') : new Date();
          return {
            ...payload,
            _id: s.temp_id || `sample-${Date.now()}-${index}`,
            isPending: true,
            sampleNumber: 'Pending',
            createdDate: `${created.getDate().toString().padStart(2, '0')}-${(created.getMonth()+1).toString().padStart(2, '0')}-${created.getFullYear()}`,
            createdTime: `${created.getHours().toString().padStart(2, '0')}:${created.getMinutes().toString().padStart(2, '0')}`
          };
        }));
      } else {
        const [babyRes, samplesRes] = await Promise.all([
          api.get(`/babies/${babyId}`),
          api.get(`/babies/${babyId}/samples`)
        ]);
        setBaby(babyRes.data);
        setSamples(samplesRes.data);

        const db = getDB();
        await db.runAsync('INSERT OR REPLACE INTO cache (key, data) VALUES (?, ?)', `baby_${babyId}`, JSON.stringify(babyRes.data || {}));
        await db.runAsync('INSERT OR REPLACE INTO cache (key, data) VALUES (?, ?)', `samples_${babyId}`, JSON.stringify(samplesRes.data || []));
      }
    } catch (error: any) {
      if (!error.response && !babyId.startsWith('local-')) {
        try {
          const db = getDB();
          const cachedBaby = await db.getFirstAsync<{data: string}>('SELECT data FROM cache WHERE key = ?', `baby_${babyId}`);
          let localBaby = cachedBaby ? JSON.parse(cachedBaby.data) : null;

          if (!localBaby) {
            const cachedList = await db.getFirstAsync<{data: string}>('SELECT data FROM cache WHERE key = ?', 'babies_list');
            if (cachedList) {
              const list = JSON.parse(cachedList.data);
              localBaby = list.find((b: any) => b._id === babyId);
            }
          }
          if (localBaby) setBaby(localBaby);
          
          const cachedSamples = await db.getFirstAsync<{data: string}>('SELECT data FROM cache WHERE key = ?', `samples_${babyId}`);
          let localSamples = cachedSamples ? JSON.parse(cachedSamples.data) : [];
          
          const pending = await db.getAllAsync<any>("SELECT * FROM sync_queue WHERE method = 'post' AND url = ?", `/babies/${babyId}/samples`);
          const pendingSamples = pending.map((p, index) => {
             const payload = JSON.parse(p.payload_json);
             const created = p.created_at ? new Date(p.created_at + 'Z') : new Date();
             return { 
               ...payload, 
               _id: p.temp_id || `sample-${Date.now()}-${index}`, 
               isPending: true,
               sampleNumber: 'Pending',
               createdDate: `${created.getDate().toString().padStart(2, '0')}-${(created.getMonth()+1).toString().padStart(2, '0')}-${created.getFullYear()}`,
               createdTime: `${created.getHours().toString().padStart(2, '0')}:${created.getMinutes().toString().padStart(2, '0')}`
             };
          });
          
          setSamples([...pendingSamples, ...localSamples]);
        } catch (e) {
          console.error('Failed to load from cache', e);
        }
      } else {
        console.error('Failed to fetch details', error);
      }
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useFocusEffect(
    useCallback(() => {
      fetchDetails();
    }, [babyId])
  );

  useEffect(() => {
    const { DeviceEventEmitter } = require('react-native');
    const sub1 = DeviceEventEmitter.addListener('syncCompleted', (idMap?: Record<string, string>) => {
      if (idMap && idMap[babyId]) {
        navigation.setParams({ babyId: idMap[babyId] });
      } else {
        fetchDetails();
      }
    });
    const sub2 = DeviceEventEmitter.addListener('localDataUpdated', () => {
      fetchDetails();
    });
    return () => {
      sub1.remove();
      sub2.remove();
    };
  }, [babyId]);

  const onRefresh = () => {
    setRefreshing(true);
    fetchDetails();
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.centered}>
        <ActivityIndicator size="large" color="#4f46e5" />
      </SafeAreaView>
    );
  }

  if (!baby) {
    return (
      <SafeAreaView style={styles.centered}>
        <Text allowFontScaling={false}>Baby not found</Text>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={{ padding: 8 }}>
          <ArrowLeft size={24} color="#334155" />
        </TouchableOpacity>
        <Text allowFontScaling={false} style={styles.headerTitle}>Baby Details</Text>
        <View style={{ width: 32 }} />
      </View>

      <ScrollView 
        style={{ flex: 1 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
      >
        {/* Baby Info Card */}
        <View style={styles.infoCard}>
          <View style={{ flexDirection: 'row', alignItems: 'flex-start' }}>
            {baby.motherImage ? (
              <TouchableOpacity onPress={() => setSelectedImage(baby.motherImage || null)} style={{ marginRight: 14, marginTop: 2 }}>
                <Image source={{ uri: baby.motherImage }} style={{ width: 64, height: 64, borderRadius: 32, backgroundColor: '#e2e8f0' }} />
              </TouchableOpacity>
            ) : (
              <View style={{ width: 64, height: 64, borderRadius: 32, marginRight: 14, marginTop: 2, backgroundColor: '#e2e8f0', justifyContent: 'center', alignItems: 'center', flexShrink: 0 }}>
                <Text allowFontScaling={false} style={{ fontSize: 24, color: '#64748b', fontWeight: 'bold' }}>{baby.motherName.charAt(0).toUpperCase()}</Text>
              </View>
            )}
            <View style={{ flex: 1, minWidth: 0 }}>
              <View style={{ flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between' }}>
                <Text allowFontScaling={false} style={[styles.infoTitle, { flexShrink: 1, flexWrap: 'wrap', marginRight: 8 }]}>{baby.motherName}</Text>
                <TouchableOpacity 
                  style={{ padding: 4, flexShrink: 0 }} 
                  onPress={() => navigation.navigate('AddBaby', { babyId: baby._id })}
                >
                  <Pencil size={20} color="#64748b" />
                </TouchableOpacity>
              </View>
              <Text allowFontScaling={false} style={styles.infoSubtitle} numberOfLines={2} ellipsizeMode="tail">{baby.displayId?.replace(/(-[MF])(\d+W)/, '$1-$2')?.replace(/-([^-]+)$/, '-​$1')}</Text>
            </View>
          </View>
          
          <View style={styles.infoGrid}>
            <View style={styles.infoItem}>
              <Text allowFontScaling={false} style={styles.infoLabel}>Gender</Text>
              <Text allowFontScaling={false} style={styles.infoValue}>{baby.gender}</Text>
            </View>
            <View style={styles.infoItem}>
              <Text allowFontScaling={false} style={styles.infoLabel}>Birth Weight</Text>
              <Text allowFontScaling={false} style={styles.infoValue}>{baby.weight}g</Text>
            </View>
            <View style={styles.infoItem}>
              <Text allowFontScaling={false} style={styles.infoLabel}>Gestational Age</Text>
              <Text allowFontScaling={false} style={styles.infoValue}>
                {baby.gestationalAge} {baby.termStatus ? `(${baby.termStatus})` : ''}
              </Text>
            </View>
            <View style={styles.infoItem}>
              <Text allowFontScaling={false} style={styles.infoLabel}>DOB</Text>
              <Text allowFontScaling={false} style={styles.infoValue}>
                {formatDateDDMMYYYY(baby.dob)}
              </Text>
            </View>
            <View style={styles.infoItem}>
              <Text allowFontScaling={false} style={styles.infoLabel}>Mother Age</Text>
              <Text allowFontScaling={false} style={styles.infoValue}>{baby.motherAge ? `${baby.motherAge} years` : 'N/A'}</Text>
            </View>
          </View>
          
          <View style={{ flexDirection: 'row', gap: 12, marginTop: 4 }}>
            <View style={{ flex: 1, backgroundColor: '#f8fafc', padding: 12, borderRadius: 12, borderWidth: 1, borderColor: '#f1f5f9' }}>
              <Text allowFontScaling={false} style={styles.infoLabel}>Skin (Forehead)</Text>
              <Text allowFontScaling={false} style={styles.infoValue}>{baby.skinForehead ?? 'N/A'}</Text>
            </View>
            <View style={{ flex: 1, backgroundColor: '#f8fafc', padding: 12, borderRadius: 12, borderWidth: 1, borderColor: '#f1f5f9' }}>
              <Text allowFontScaling={false} style={styles.infoLabel}>Skin (Sternum)</Text>
              <Text allowFontScaling={false} style={styles.infoValue}>{baby.skinSternum ?? 'N/A'}</Text>
            </View>
          </View>
        </View>

        {/* Samples List */}
        <View style={{ paddingHorizontal: 16, paddingBottom: 96 }}>
          <Text allowFontScaling={false} style={styles.sectionTitle}>Daily Samples</Text>
          {samples.length === 0 ? (
            <View style={styles.emptyCard}>
              <Text allowFontScaling={false} style={{ color: '#64748b' }}>No samples recorded yet.</Text>
            </View>
          ) : (
            samples.map((sample) => (
              <TouchableOpacity
                key={sample._id}
                style={styles.sampleCard}
                onPress={() => navigation.navigate('SampleForm', { babyId: baby._id, sampleId: sample._id })}
              >
                <View style={{ flex: 1, paddingRight: 8 }}>
                  <Text allowFontScaling={false} style={styles.sampleTitle}>Sample #{sample.sampleNumber}</Text>
                  <Text allowFontScaling={false} style={styles.sampleSubtitle}>{sample.createdDate} at {sample.createdTime}</Text>
                  {sample.remarks ? (
                    <Text allowFontScaling={false} style={{ fontSize: 13, color: '#475569', marginTop: 4, fontStyle: 'italic' }} numberOfLines={2}>
                      "{sample.remarks}"
                    </Text>
                  ) : null}
                </View>
                <View style={{ alignItems: 'flex-end' }}>
                  <Text allowFontScaling={false} style={styles.sampleWeight}>Weight: {sample.weight}g</Text>
                  <Text allowFontScaling={false} style={styles.sampleEdit}>Tap to edit</Text>
                </View>
              </TouchableOpacity>
            ))
          )}
        </View>
      </ScrollView>

      {/* Full Screen Image Modal */}
      <Modal visible={!!selectedImage} transparent={true} animationType="fade" onRequestClose={() => setSelectedImage(null)}>
        <TouchableOpacity style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.9)', justifyContent: 'center', alignItems: 'center' }} onPress={() => setSelectedImage(null)} activeOpacity={1}>
          <TouchableWithoutFeedback>
            <Image source={{ uri: selectedImage || '' }} style={{ width: 300, height: 300 }} resizeMode="contain" />
          </TouchableWithoutFeedback>
        </TouchableOpacity>
      </Modal>

      {/* Add Sample FAB */}
      <TouchableOpacity 
        style={styles.fab}
        onPress={() => navigation.navigate('SampleForm', { babyId: baby._id })}
      >
        <Plus size={28} color="#ffffff" />
      </TouchableOpacity>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f8fafc' },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#f8fafc' },
  header: { paddingHorizontal: moderateScale(16), paddingVertical: moderateScale(14), backgroundColor: '#ffffff', borderBottomWidth: 1, borderBottomColor: '#e2e8f0', flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  headerTitle: { fontSize: moderateScale(18, 0.3), fontWeight: 'bold', color: '#1e293b' },
  infoCard: { margin: moderateScale(14), backgroundColor: '#ffffff', padding: moderateScale(16), borderRadius: moderateScale(16), borderWidth: 1, borderColor: '#e2e8f0', shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.05, shadowRadius: 2, elevation: 1 },
  infoTitle: { fontSize: moderateScale(20, 0.3), fontWeight: '800', color: '#1e293b', flexWrap: 'wrap' },
  infoSubtitle: { fontSize: moderateScale(12, 0.3), fontWeight: '500', color: '#64748b', marginBottom: moderateScale(12), marginTop: 2 },
  infoGrid: { flexDirection: 'row', flexWrap: 'wrap', marginTop: moderateScale(8), gap: 0 },
  infoItem: { width: '50%', paddingRight: 8, marginBottom: moderateScale(14) },
  infoLabel: { fontSize: moderateScale(10, 0.3), color: '#64748b', textTransform: 'uppercase', letterSpacing: 0.5 },
  infoValue: { fontSize: moderateScale(14, 0.3), fontWeight: '600', color: '#1e293b', marginTop: moderateScale(2), flexWrap: 'wrap' },
  sectionTitle: { fontSize: moderateScale(16, 0.3), fontWeight: 'bold', color: '#1e293b', marginBottom: moderateScale(12), marginLeft: moderateScale(4) },
  emptyCard: { alignItems: 'center', paddingVertical: moderateScale(32), backgroundColor: '#f1f5f9', borderRadius: moderateScale(12) },
  sampleCard: { backgroundColor: '#ffffff', padding: moderateScale(14), marginBottom: moderateScale(10), borderRadius: moderateScale(12), borderWidth: 1, borderColor: '#e2e8f0', shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.05, shadowRadius: 2, elevation: 1, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  sampleTitle: { fontSize: moderateScale(14, 0.3), fontWeight: 'bold', color: '#1e293b' },
  sampleSubtitle: { fontSize: moderateScale(12, 0.3), color: '#64748b', marginTop: moderateScale(4) },
  sampleWeight: { fontSize: moderateScale(13, 0.3), fontWeight: '600', color: '#4f46e5' },
  sampleEdit: { fontSize: moderateScale(11, 0.3), color: '#94a3b8', marginTop: moderateScale(4) },
  fab: { position: 'absolute', bottom: moderateScale(32), right: moderateScale(24), backgroundColor: '#4f46e5', width: moderateScale(56), height: moderateScale(56), borderRadius: moderateScale(28), justifyContent: 'center', alignItems: 'center', shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 4, elevation: 6 }
});
