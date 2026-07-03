import React, { useState, useEffect, useRef } from 'react';
import { View, Text, TextInput, TouchableOpacity, ActivityIndicator, Alert, StyleSheet, Platform } from 'react-native';
import { moderateScale } from 'react-native-size-matters';
import { KeyboardAwareScrollView } from 'react-native-keyboard-aware-scroll-view';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import { ArrowLeft } from 'lucide-react-native';
import { useForm, Controller } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import api from '../services/api';
import { queueRequest } from '../services/syncService';
import { v4 } from 'uuid';
import { RootStackParamList } from '../navigation/AppNavigator';

const parseWeight = (val: any) => {
  if (val === '' || val == null) return undefined;
  let num = Number(val);
  if (isNaN(num)) return undefined;
  if (num <= 15 && num > 0) return num * 1000;
  return num;
};

// Same Zod schema as web app
const sampleSchema = z.object({
  weight: z.preprocess(parseWeight, z.number().min(500).max(5000).optional()),
  shift: z.enum(['M', 'E']).optional(),
  mbj20_f: z.preprocess((val) => val === '' || val == null ? undefined : Number(val), z.number().optional()),
  mbj20_s: z.preprocess((val) => val === '' || val == null ? undefined : Number(val), z.number().optional()),
  jm103_s: z.preprocess((val) => val === '' || val == null ? undefined : Number(val), z.number().optional()),
  tsb: z.preprocess((val) => val === '' || val == null ? undefined : Number(val), z.number().optional()),
  remarks: z.string().optional(),

  // D4
  f1_d4_f: z.preprocess((val) => val === '' || val == null ? undefined : Number(val), z.number().optional()),
  f2_d4_f: z.preprocess((val) => val === '' || val == null ? undefined : Number(val), z.number().optional()),
  f3_d4_f: z.preprocess((val) => val === '' || val == null ? undefined : Number(val), z.number().optional()),
  f4_d4_f: z.preprocess((val) => val === '' || val == null ? undefined : Number(val), z.number().optional()),
  f5_d4_f: z.preprocess((val) => val === '' || val == null ? undefined : Number(val), z.number().optional()),
  f6_d4_f: z.preprocess((val) => val === '' || val == null ? undefined : Number(val), z.number().optional()),
  f7_d4_f: z.preprocess((val) => val === '' || val == null ? undefined : Number(val), z.number().optional()),
  f8_d4_f: z.preprocess((val) => val === '' || val == null ? undefined : Number(val), z.number().optional()),
  f9_d4_f: z.preprocess((val) => val === '' || val == null ? undefined : Number(val), z.number().optional()),
  f10_d4_f: z.preprocess((val) => val === '' || val == null ? undefined : Number(val), z.number().optional()),
  f1_d4_s: z.preprocess((val) => val === '' || val == null ? undefined : Number(val), z.number().optional()),
  f2_d4_s: z.preprocess((val) => val === '' || val == null ? undefined : Number(val), z.number().optional()),
  f3_d4_s: z.preprocess((val) => val === '' || val == null ? undefined : Number(val), z.number().optional()),
  f4_d4_s: z.preprocess((val) => val === '' || val == null ? undefined : Number(val), z.number().optional()),
  f5_d4_s: z.preprocess((val) => val === '' || val == null ? undefined : Number(val), z.number().optional()),
  f6_d4_s: z.preprocess((val) => val === '' || val == null ? undefined : Number(val), z.number().optional()),
  f7_d4_s: z.preprocess((val) => val === '' || val == null ? undefined : Number(val), z.number().optional()),
  f8_d4_s: z.preprocess((val) => val === '' || val == null ? undefined : Number(val), z.number().optional()),
  f9_d4_s: z.preprocess((val) => val === '' || val == null ? undefined : Number(val), z.number().optional()),
  f10_d4_s: z.preprocess((val) => val === '' || val == null ? undefined : Number(val), z.number().optional()),

  // D6
  f1_d6_f: z.preprocess((val) => val === '' || val == null ? undefined : Number(val), z.number().optional()),
  f2_d6_f: z.preprocess((val) => val === '' || val == null ? undefined : Number(val), z.number().optional()),
  f3_d6_f: z.preprocess((val) => val === '' || val == null ? undefined : Number(val), z.number().optional()),
  f4_d6_f: z.preprocess((val) => val === '' || val == null ? undefined : Number(val), z.number().optional()),
  f5_d6_f: z.preprocess((val) => val === '' || val == null ? undefined : Number(val), z.number().optional()),
  f6_d6_f: z.preprocess((val) => val === '' || val == null ? undefined : Number(val), z.number().optional()),
  f7_d6_f: z.preprocess((val) => val === '' || val == null ? undefined : Number(val), z.number().optional()),
  f8_d6_f: z.preprocess((val) => val === '' || val == null ? undefined : Number(val), z.number().optional()),
  f9_d6_f: z.preprocess((val) => val === '' || val == null ? undefined : Number(val), z.number().optional()),
  f10_d6_f: z.preprocess((val) => val === '' || val == null ? undefined : Number(val), z.number().optional()),
  f1_d6_s: z.preprocess((val) => val === '' || val == null ? undefined : Number(val), z.number().optional()),
  f2_d6_s: z.preprocess((val) => val === '' || val == null ? undefined : Number(val), z.number().optional()),
  f3_d6_s: z.preprocess((val) => val === '' || val == null ? undefined : Number(val), z.number().optional()),
  f4_d6_s: z.preprocess((val) => val === '' || val == null ? undefined : Number(val), z.number().optional()),
  f5_d6_s: z.preprocess((val) => val === '' || val == null ? undefined : Number(val), z.number().optional()),
  f6_d6_s: z.preprocess((val) => val === '' || val == null ? undefined : Number(val), z.number().optional()),
  f7_d6_s: z.preprocess((val) => val === '' || val == null ? undefined : Number(val), z.number().optional()),
  f8_d6_s: z.preprocess((val) => val === '' || val == null ? undefined : Number(val), z.number().optional()),
  f9_d6_s: z.preprocess((val) => val === '' || val == null ? undefined : Number(val), z.number().optional()),
  f10_d6_s: z.preprocess((val) => val === '' || val == null ? undefined : Number(val), z.number().optional()),
}).superRefine((data, ctx) => {
  const m1_full = data.mbj20_f != null || data.mbj20_s != null;
  const m2_full = data.jm103_s != null;
  const m3_full = data.tsb != null;

  const d4_f_values = [data.f1_d4_f, data.f2_d4_f, data.f3_d4_f, data.f4_d4_f, data.f5_d4_f, data.f6_d4_f, data.f7_d4_f, data.f8_d4_f, data.f9_d4_f, data.f10_d4_f];
  const d4_f_partial = d4_f_values.some(v => v != null);
  const d4_f_full = d4_f_values.every(v => v != null);
  if (d4_f_partial && !d4_f_full) ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'Machine 4 (D4) Forehead requires all 10 fields.', path: ['f1_d4_f'] });

  const d4_s_values = [data.f1_d4_s, data.f2_d4_s, data.f3_d4_s, data.f4_d4_s, data.f5_d4_s, data.f6_d4_s, data.f7_d4_s, data.f8_d4_s, data.f9_d4_s, data.f10_d4_s];
  const d4_s_partial = d4_s_values.some(v => v != null);
  const d4_s_full = d4_s_values.every(v => v != null);
  if (d4_s_partial && !d4_s_full) ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'Machine 4 (D4) Sternum requires all 10 fields.', path: ['f1_d4_s'] });

  const d6_f_values = [data.f1_d6_f, data.f2_d6_f, data.f3_d6_f, data.f4_d6_f, data.f5_d6_f, data.f6_d6_f, data.f7_d6_f, data.f8_d6_f, data.f9_d6_f, data.f10_d6_f];
  const d6_f_partial = d6_f_values.some(v => v != null);
  const d6_f_full = d6_f_values.every(v => v != null);
  if (d6_f_partial && !d6_f_full) ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'Machine 5 (D6) Forehead requires all 10 fields.', path: ['f1_d6_f'] });

  const d6_s_values = [data.f1_d6_s, data.f2_d6_s, data.f3_d6_s, data.f4_d6_s, data.f5_d6_s, data.f6_d6_s, data.f7_d6_s, data.f8_d6_s, data.f9_d6_s, data.f10_d6_s];
  const d6_s_partial = d6_s_values.some(v => v != null);
  const d6_s_full = d6_s_values.every(v => v != null);
  if (d6_s_partial && !d6_s_full) ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'Machine 5 (D6) Sternum requires all 10 fields.', path: ['f1_d6_s'] });

  if (!m1_full && !m2_full && !m3_full) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'At least one of MBJ20, JM103, or TSB must be provided.', path: ['mbj20_f'] });
  }
});

type SampleFormValues = z.infer<typeof sampleSchema>;
type FormRouteProp = RouteProp<RootStackParamList, 'SampleForm'>;

const ReadingGrid = ({ device, title, control, errors, inputRefs, focusNext }: { device: 'd4' | 'd6', title: string, control: any, errors: any, inputRefs: React.MutableRefObject<Record<string, TextInput | null>>, focusNext: (field?: string) => void }) => {
  const fields = Array.from({ length: 10 }, (_, i) => i + 1);
  const f_error = errors?.[`f1_${device}_f`]?.message;
  const s_error = errors?.[`f1_${device}_s`]?.message;

  return (
    <View style={styles.gridCard}>
      <Text allowFontScaling={false} style={styles.gridTitle}>{title}</Text>

      <View style={[styles.gridSection, f_error ? styles.gridSectionError : undefined]}>
        <Text allowFontScaling={false} style={styles.gridSectionTitle}>Forehead</Text>
        <View style={styles.gridRow}>
          {fields.map(n => {
            const name = `f${n}_${device}_f`;
            const nextName = n < 10 ? `f${n + 1}_${device}_f` : `f1_${device}_s`;
            return (
              <View key={`f_${n}`} style={styles.gridCell}>
                <Text allowFontScaling={false} style={styles.gridLabel}>F{n}</Text>
                <Controller
                  control={control}
                  name={name}
                  render={({ field: { onChange, onBlur, value } }) => (
                    <TextInput allowFontScaling={false}
                      ref={(el) => { inputRefs.current[name] = el; }}
                      style={[styles.gridInput, f_error && (value === '' || value == null) ? styles.gridInputError : undefined]}
                      keyboardType="numeric"
                      onBlur={onBlur}
                      onChangeText={onChange}
                      value={value?.toString() || ''}
                      returnKeyType="next"
                      onSubmitEditing={() => focusNext(nextName)}
                      blurOnSubmit={false}
                    />
                  )}
                />
              </View>
            );
          })}
        </View>
        {f_error ? <Text allowFontScaling={false} style={styles.errorText}>{f_error as string}</Text> : null}
      </View>

      <View style={[styles.gridSection, s_error ? styles.gridSectionError : undefined]}>
        <Text allowFontScaling={false} style={styles.gridSectionTitle}>Sternum</Text>
        <View style={styles.gridRow}>
          {fields.map(n => {
            const name = `f${n}_${device}_s`;
            let nextName: string | undefined = n < 10 ? `f${n + 1}_${device}_s` : undefined;
            if (n === 10 && device === 'd4') nextName = 'f1_d6_f';
            else if (n === 10 && device === 'd6') nextName = 'remarks';

            return (
              <View key={`s_${n}`} style={styles.gridCell}>
                <Text allowFontScaling={false} style={styles.gridLabel}>S{n}</Text>
                <Controller
                  control={control}
                  name={name}
                  render={({ field: { onChange, onBlur, value } }) => (
                    <TextInput allowFontScaling={false}
                      ref={(el) => { inputRefs.current[name] = el; }}
                      style={[styles.gridInput, s_error && (value === '' || value == null) ? styles.gridInputError : undefined]}
                      keyboardType="numeric"
                      onBlur={onBlur}
                      onChangeText={onChange}
                      value={value?.toString() || ''}
                      returnKeyType={nextName ? 'next' : 'done'}
                      onSubmitEditing={() => focusNext(nextName)}
                      blurOnSubmit={!nextName}
                    />
                  )}
                />
              </View>
            );
          })}
        </View>
        {s_error ? <Text allowFontScaling={false} style={styles.errorText}>{s_error as string}</Text> : null}
      </View>
    </View>
  );
};

export default function SampleFormScreen() {
  const navigation = useNavigation();
  const route = useRoute<FormRouteProp>();
  const { babyId, sampleId } = route.params;
  const [loading, setLoading] = useState(false);
  const [fetching, setFetching] = useState(false);
  const inputRefs = useRef<Record<string, TextInput | null>>({});

  const { control, handleSubmit, reset, formState: { errors } } = useForm<any>({
    resolver: zodResolver(sampleSchema) as any
  });

  const focusNext = (nextField?: string) => {
    if (nextField && inputRefs.current[nextField]) {
      inputRefs.current[nextField]?.focus();
    }
  };

  useEffect(() => {
    if (sampleId) {
      setFetching(true);
      api.get(`/babies/${babyId}/samples`)
        .then((res) => {
          const sample = res.data.find((s: any) => s._id === sampleId);
          if (sample) {
            reset({
              weight: sample.weight,
              shift: sample.shift,
              mbj20_f: sample.mbj20_f,
              mbj20_s: sample.mbj20_s,
              jm103_s: sample.jm103_s,
              tsb: sample.tsb,
              f1_d4_f: sample.f1_d4_f, f2_d4_f: sample.f2_d4_f, f3_d4_f: sample.f3_d4_f, f4_d4_f: sample.f4_d4_f, f5_d4_f: sample.f5_d4_f,
              f6_d4_f: sample.f6_d4_f, f7_d4_f: sample.f7_d4_f, f8_d4_f: sample.f8_d4_f, f9_d4_f: sample.f9_d4_f, f10_d4_f: sample.f10_d4_f,
              f1_d4_s: sample.f1_d4_s, f2_d4_s: sample.f2_d4_s, f3_d4_s: sample.f3_d4_s, f4_d4_s: sample.f4_d4_s, f5_d4_s: sample.f5_d4_s,
              f6_d4_s: sample.f6_d4_s, f7_d4_s: sample.f7_d4_s, f8_d4_s: sample.f8_d4_s, f9_d4_s: sample.f9_d4_s, f10_d4_s: sample.f10_d4_s,
              f1_d6_f: sample.f1_d6_f, f2_d6_f: sample.f2_d6_f, f3_d6_f: sample.f3_d6_f, f4_d6_f: sample.f4_d6_f, f5_d6_f: sample.f5_d6_f,
              f6_d6_f: sample.f6_d6_f, f7_d6_f: sample.f7_d6_f, f8_d6_f: sample.f8_d6_f, f9_d6_f: sample.f9_d6_f, f10_d6_f: sample.f10_d6_f,
              f1_d6_s: sample.f1_d6_s, f2_d6_s: sample.f2_d6_s, f3_d6_s: sample.f3_d6_s, f4_d6_s: sample.f4_d6_s, f5_d6_s: sample.f5_d6_s,
              f6_d6_s: sample.f6_d6_s, f7_d6_s: sample.f7_d6_s, f8_d6_s: sample.f8_d6_s, f9_d6_s: sample.f9_d6_s, f10_d6_s: sample.f10_d6_s,
              remarks: sample.remarks,
            });
          }
        })
        .catch(async (error) => {
          if (!error.response || sampleId?.startsWith('sample-')) {
            try {
              const { getDB } = require('../services/db');
              const db = getDB();
              let sample: any = null;

              const cached = await db.getFirstAsync<{data: string}>('SELECT data FROM cache WHERE key = ?', `samples_${babyId}`);
              if (cached) {
                const samples = JSON.parse(cached.data);
                sample = samples.find((s: any) => s._id === sampleId);
              }

              if (!sample) {
                const pending = await db.getAllAsync<any>("SELECT * FROM sync_queue WHERE url LIKE ?", `%/babies/${babyId}/samples%`);
                const mappedPending = pending.map(p => ({ ...JSON.parse(p.payload_json), _id: p.temp_id }));
                sample = mappedPending.find(s => s._id === sampleId);
              }

              if (sample) {
                reset({ ...sample });
                return;
              }
            } catch (e) {
              console.log('Error loading offline sample for edit', e);
            }
          }
          Alert.alert('Error', 'Failed to load sample data for editing.');
        })
        .finally(() => {
          setFetching(false);
        });
    }
  }, [sampleId, babyId, reset]);

  const onSubmit = async (data: any) => {
    setLoading(true);
    try {
      if (!data.shift) {
        const hour = new Date().getHours();
        data.shift = hour >= 15 ? 'E' : 'M';
      }

      try {
        if (sampleId) {
          await api.put(`/samples/${sampleId}`, data);
          Alert.alert('Success', 'Sample updated successfully!', [{ text: 'OK', onPress: () => navigation.goBack() }]);
        } else {
          await api.post(`/babies/${babyId}/samples`, data);
          Alert.alert('Success', 'Sample saved successfully!', [{ text: 'OK', onPress: () => navigation.goBack() }]);
        }
      } catch (apiError: any) {
        if (!apiError.response) {
          // Network Error
          const { getDB } = require('../services/db');
          const db = getDB();

          if (sampleId?.startsWith('sample-')) {
            // Updating an offline pending sample
            const row = await db.getFirstAsync<any>('SELECT * FROM sync_queue WHERE temp_id = ?', sampleId);
            if (row) {
               await db.runAsync('UPDATE sync_queue SET payload_json = ? WHERE id = ?', JSON.stringify(data), row.id);
            }
          } else if (sampleId) {
            // Updating an online sample offline
            await queueRequest(`/samples/${sampleId}`, 'put', data);
            
            // Update local cache so it's instantly visible
            try {
              const cached = await db.getFirstAsync<{data: string}>('SELECT data FROM cache WHERE key = ?', `samples_${babyId}`);
              if (cached) {
                 const samples = JSON.parse(cached.data);
                 const updatedSamples = samples.map((s: any) => s._id === sampleId ? { ...s, ...data, isPending: true } : s);
                 await db.runAsync('INSERT OR REPLACE INTO cache (key, data) VALUES (?, ?)', `samples_${babyId}`, JSON.stringify(updatedSamples));
              }
            } catch (e) {
              console.log('Error updating cache for offline put', e);
            }
          } else {
            // Creating a new sample offline
            await queueRequest(`/babies/${babyId}/samples`, 'post', data, undefined, `sample-${v4()}`);
          }
          
          Alert.alert('Saved Offline', 'Your data was saved locally and will sync when internet is restored.', [{ text: 'OK', onPress: () => navigation.goBack() }]);
        } else {
          throw apiError;
        }
      }
    } catch (error: any) {
      Alert.alert('Error', error.response?.data?.message || 'Failed to save sample');
    } finally {
      setLoading(false);
    }
  };

  const renderInput = (name: any, placeholder: string, label: string, nextField?: string) => (
    <View style={styles.fieldContainer}>
      <Text allowFontScaling={false} style={styles.label}>{label}</Text>
      <Controller
        control={control}
        name={name}
        render={({ field: { onChange, onBlur, value } }) => (
          <TextInput allowFontScaling={false}
            ref={(el) => { inputRefs.current[name] = el; }}
            style={[styles.input, errors[name] ? styles.inputError : undefined]}
            onBlur={onBlur}
            onChangeText={onChange}
            value={value?.toString() || ''}
            placeholder={placeholder}
            placeholderTextColor="#94a3b8"
            keyboardType={name === 'remarks' ? 'default' : 'numeric'}
            returnKeyType={nextField ? 'next' : 'done'}
            onSubmitEditing={() => focusNext(nextField)}
            blurOnSubmit={!nextField}
          />
        )}
      />
      {errors[name]?.message ? <Text allowFontScaling={false} style={styles.errorText}>{errors[name]?.message as string}</Text> : null}
    </View>
  );

  if (fetching) {
    return (
      <SafeAreaView style={styles.centered}>
        <ActivityIndicator size="large" color="#4f46e5" />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={{ padding: 8, marginRight: 8 }}>
          <ArrowLeft size={24} color="#334155" />
        </TouchableOpacity>
        <Text allowFontScaling={false} style={styles.headerTitle}>{sampleId ? 'Edit Sample' : 'Add Sample'}</Text>
      </View>

      <KeyboardAwareScrollView
        style={{ flex: 1, backgroundColor: '#f1f5f9' }}
        contentContainerStyle={{ padding: 24, paddingBottom: 150 }}
        keyboardShouldPersistTaps="handled"
        enableOnAndroid={true}
        extraScrollHeight={120}
        extraHeight={120}
        enableResetScrollToCoords={false}
        showsVerticalScrollIndicator={false}
      >
        <View style={{ gap: 16 }}>

          <View style={styles.card}>
            <Text allowFontScaling={false} style={styles.cardTitle}>General</Text>
            {renderInput('weight', 'e.g. 2.5 or 2500', 'Weight', 'mbj20_f')}
          </View>

          <View style={[styles.card, { backgroundColor: '#eff6ff', borderColor: '#dbeafe' }]}>
            <Text allowFontScaling={false} style={[styles.cardTitle, { color: '#1e3a8a' }]}>Machine 1: MBJ20</Text>
            <View style={{ flexDirection: 'row', gap: 16 }}>
              <View style={{ flex: 1 }}>{renderInput('mbj20_f', '', 'Forehead', 'mbj20_s')}</View>
              <View style={{ flex: 1 }}>{renderInput('mbj20_s', '', 'Sternum', 'jm103_s')}</View>
            </View>
            {errors.mbj20_f?.message ? <Text allowFontScaling={false} style={styles.errorText}>{errors.mbj20_f.message as string}</Text> : null}
          </View>

          <View style={[styles.card, { backgroundColor: '#ecfdf5', borderColor: '#d1fae5' }]}>
            <Text allowFontScaling={false} style={[styles.cardTitle, { color: '#064e3b' }]}>Machine 2: JM103</Text>
            {renderInput('jm103_s', '', 'Sternum', 'tsb')}
          </View>

          <View style={[styles.card, { backgroundColor: '#faf5ff', borderColor: '#f3e8ff' }]}>
            <Text allowFontScaling={false} style={[styles.cardTitle, { color: '#581c87' }]}>Machine 3: TSB</Text>
            {renderInput('tsb', '', 'TSB Reading', 'f1_d4_f')}
          </View>

          <ReadingGrid device="d4" title="Machine 4: D4" control={control} errors={errors} inputRefs={inputRefs} focusNext={focusNext} />
          <ReadingGrid device="d6" title="Machine 5: D6" control={control} errors={errors} inputRefs={inputRefs} focusNext={focusNext} />

          <View style={styles.card}>
            {renderInput('remarks', 'Optional notes', 'Remarks')}
          </View>

          <TouchableOpacity style={styles.button} onPress={handleSubmit(onSubmit)} disabled={loading}>
            {loading ? <ActivityIndicator color="#ffffff" /> : <Text allowFontScaling={false} style={styles.buttonText}>{sampleId ? 'Update Sample' : 'Save Sample'}</Text>}
          </TouchableOpacity>
        </View>
      </KeyboardAwareScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f8fafc' },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#f8fafc' },
  header: { paddingHorizontal: moderateScale(16), paddingVertical: moderateScale(16), backgroundColor: '#ffffff', borderBottomWidth: 1, borderBottomColor: '#e2e8f0', flexDirection: 'row', alignItems: 'center' },
  headerTitle: { fontSize: moderateScale(20), fontWeight: 'bold', color: '#1e293b' },
  card: { backgroundColor: '#ffffff', padding: moderateScale(16), borderRadius: moderateScale(16), borderWidth: 1, borderColor: '#e2e8f0' },
  cardTitle: { fontSize: moderateScale(16), fontWeight: 'bold', color: '#1e293b', marginBottom: moderateScale(16) },
  fieldContainer: { marginBottom: moderateScale(12) },
  label: { fontSize: moderateScale(13), fontWeight: '600', color: '#334155', marginBottom: moderateScale(6) },
  input: { backgroundColor: '#ffffff', borderColor: '#cbd5e1', borderWidth: 1, borderRadius: moderateScale(10), paddingHorizontal: moderateScale(14), paddingVertical: moderateScale(10), color: '#0f172a' },
  inputError: { borderColor: '#ef4444', backgroundColor: '#fef2f2' },
  errorText: { color: '#ef4444', fontSize: moderateScale(12), marginTop: moderateScale(4) },
  button: { width: '100%', backgroundColor: '#4f46e5', borderRadius: moderateScale(12), paddingVertical: moderateScale(16), marginTop: moderateScale(8), flexDirection: 'row', justifyContent: 'center', alignItems: 'center' },
  buttonText: { color: '#ffffff', fontWeight: 'bold', fontSize: moderateScale(18) },
  gridCard: { backgroundColor: '#f8fafc', padding: moderateScale(16), borderRadius: moderateScale(16), borderWidth: 1, borderColor: '#e2e8f0', marginBottom: moderateScale(16) },
  gridTitle: { fontSize: moderateScale(16), fontWeight: 'bold', color: '#1e293b', marginBottom: moderateScale(16) },
  gridSection: { backgroundColor: '#ffffff', padding: moderateScale(12), borderRadius: moderateScale(12), borderWidth: 1, borderColor: '#f1f5f9', marginBottom: moderateScale(12) },
  gridSectionError: { borderColor: '#ef4444' },
  gridSectionTitle: { fontSize: moderateScale(14), fontWeight: '600', color: '#475569', marginBottom: moderateScale(12), borderBottomWidth: 1, borderBottomColor: '#f1f5f9', paddingBottom: moderateScale(6) },
  gridRow: { flexDirection: 'row', flexWrap: 'wrap', gap: moderateScale(8) },
  gridCell: { flexBasis: '18%', flexShrink: 1, minWidth: 0, marginBottom: moderateScale(8) },
  gridLabel: { fontSize: moderateScale(11), color: '#64748b', textAlign: 'center', marginBottom: moderateScale(4) },
  gridInput: { backgroundColor: '#f8fafc', borderColor: '#e2e8f0', borderWidth: 1, borderRadius: moderateScale(8), paddingHorizontal: moderateScale(4), paddingVertical: moderateScale(8), color: '#0f172a', textAlign: 'center', fontSize: moderateScale(12) },
  gridInputError: { borderColor: '#ef4444', backgroundColor: '#fef2f2' }
});
