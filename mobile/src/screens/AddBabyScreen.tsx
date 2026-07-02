import React, { useState, useRef } from 'react';
import { View, Text, TextInput, TouchableOpacity, ActivityIndicator, Alert, StyleSheet, Switch, Image, Platform, KeyboardAvoidingView, Modal } from 'react-native';
import { moderateScale } from 'react-native-size-matters';
import { KeyboardAwareScrollView } from 'react-native-keyboard-aware-scroll-view';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import { RootStackParamList } from '../navigation/AppNavigator';
import { ArrowLeft, ImagePlus, X, Camera } from 'lucide-react-native';
import * as ImagePicker from 'expo-image-picker';
import DateTimePicker from '@react-native-community/datetimepicker';
import { useForm, Controller } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import api from '../services/api';
import ImageModal from '../components/ImageModal';
import { v4 } from 'uuid';
import { queueRequest } from '../services/syncService';

const parseWeight = (val: any) => {
  if (val === '' || val == null) return undefined;
  let num = Number(val);
  if (isNaN(num)) return undefined;
  if (num <= 15 && num > 0) return num * 1000;
  return num;
};

const newBabySchema = z.object({
  motherName: z.string().min(2, 'Mother Name must be at least 2 characters'),
  motherAge: z.preprocess((val) => Number(val), z.number().min(18, 'Min age 18').max(60, 'Max age 60')),
  dob: z.string().min(1, 'DOB is required'),
  termStatus: z.enum(['Term', 'Preterm']),
  isTwin: z.boolean(),

  weight: z.preprocess(parseWeight, z.number().min(500).max(5000).optional()),
  gender: z.enum(['Male', 'Female']).optional(),
  skinForehead: z.preprocess((val) => val === '' || val == null ? undefined : Number(val), z.number().min(1, 'Min 1').optional()),
  skinSternum: z.preprocess((val) => val === '' || val == null ? undefined : Number(val), z.number().min(1, 'Min 1').optional()),
  gestationalAgeWeeks: z.preprocess((val) => val === '' || val == null ? undefined : Number(val), z.number().min(25, 'Min 25').max(42).optional()),
  gestationalAgeDays: z.preprocess((val) => val === '' || val == null ? undefined : Number(val), z.number().min(0).max(6).optional()),

  // Twin A fields
  weightA: z.preprocess(parseWeight, z.number().min(500).max(5000).optional()),
  genderA: z.enum(['Male', 'Female']).optional(),
  skinForeheadA: z.preprocess((val) => val === '' || val == null ? undefined : Number(val), z.number().min(1, 'Min 1').optional()),
  skinSternumA: z.preprocess((val) => val === '' || val == null ? undefined : Number(val), z.number().min(1, 'Min 1').optional()),

  // Twin B fields
  weightB: z.preprocess(parseWeight, z.number().min(500).max(5000).optional()),
  genderB: z.enum(['Male', 'Female']).optional(),
  skinForeheadB: z.preprocess((val) => val === '' || val == null ? undefined : Number(val), z.number().min(1, 'Min 1').optional()),
  skinSternumB: z.preprocess((val) => val === '' || val == null ? undefined : Number(val), z.number().min(1, 'Min 1').optional()),
}).superRefine((data, ctx) => {
  if (!data.isTwin) {
    if (!data.gender) ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'Required', path: ['gender'] });
    if (!data.gestationalAgeWeeks) ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'Required', path: ['gestationalAgeWeeks'] });
    if (!data.weight) ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'Required', path: ['weight'] });
  } else {
    if (!data.genderA) ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'Required', path: ['genderA'] });
    if (!data.genderB) ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'Required', path: ['genderB'] });
    if (!data.gestationalAgeWeeks) ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'Required', path: ['gestationalAgeWeeks'] });
    if (!data.weightA) ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'Required', path: ['weightA'] });
    if (!data.weightB) ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'Required', path: ['weightB'] });
  }
});

type NewBabyFormValues = z.infer<typeof newBabySchema>;

type AddBabyRouteProp = RouteProp<RootStackParamList, 'AddBaby'>;

export default function AddBabyScreen() {
  const navigation = useNavigation();
  const route = useRoute<AddBabyRouteProp>();
  const babyId = route.params?.babyId;

  const [loading, setLoading] = useState(false);
  const [conflictBaby, setConflictBaby] = useState<any>(null);
  const [fetching, setFetching] = useState(!!babyId);
  const [imageUri, setImageUri] = useState<string | null>(null);
  const [showDatePicker, setShowDatePicker] = useState(false);
  const inputRefs = useRef<Record<string, TextInput | null>>({});

  const focusNext = (nextField?: string) => {
    if (nextField && inputRefs.current[nextField]) {
      inputRefs.current[nextField]?.focus();
    }
  };

  const { control, handleSubmit, watch, formState: { errors }, reset } = useForm<any>({
    resolver: zodResolver(newBabySchema) as any,
    defaultValues: {
      isTwin: false,
      termStatus: 'Term',
      dob: ''
    }
  });

  React.useEffect(() => {
    if (!babyId) return;
    const fetchBaby = async () => {
      try {
        const response = await api.get(`/babies/${babyId}`);
        const data = response.data;

        let weeks: number | undefined = undefined;
        let days: number | undefined = undefined;
        if (data.gestationalAge) {
          const wMatch = data.gestationalAge.match(/(\d+)W/);
          if (wMatch) weeks = parseInt(wMatch[1]);
          const dMatch = data.gestationalAge.match(/(\d+)D/);
          if (dMatch) days = parseInt(dMatch[1]);
        }

        if (data.motherImage) {
          setImageUri(data.motherImage);
        }

        reset({
          motherName: data.motherName,
          motherAge: data.motherAge,
          dob: data.dob.split('T')[0],
          termStatus: data.termStatus,
          isTwin: false, // Force false because the backend edits twins as individual single babies

          weight: data.weight,
          gender: data.gender,
          skinForehead: data.skinForehead,
          skinSternum: data.skinSternum,

          weightA: undefined,
          genderA: undefined,
          skinForeheadA: undefined,
          skinSternumA: undefined,

          weightB: undefined,
          genderB: undefined,
          skinForeheadB: undefined,
          skinSternumB: undefined,

          gestationalAgeWeeks: weeks,
          gestationalAgeDays: days,
        });
      } catch (err) {
        Alert.alert('Error', 'Failed to load baby data');
      } finally {
        setFetching(false);
      }
    };
    fetchBaby();
  }, [babyId, reset]);

  const isTwin = watch('isTwin');

  const pickImage = async () => {
    let result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: true,
      quality: 0.5,
    });
    if (!result.canceled) {
      setImageUri(result.assets[0].uri);
    }
  };

  const takePhoto = async () => {
    const { status } = await ImagePicker.requestCameraPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permission needed', 'Camera permission is required to take photos.');
      return;
    }
    let result = await ImagePicker.launchCameraAsync({
      mediaTypes: ['images'],
      allowsEditing: true,
      quality: 0.5,
    });
    if (!result.canceled) {
      setImageUri(result.assets[0].uri);
    }
  };

  const onSubmit = async (data: any, forceSave: boolean = false) => {
    setLoading(true);
    try {
      const formData = new FormData();
      const jsonPayload: any = {};

      const append = (key: string, val: string | number) => {
        formData.append(key, val.toString());
        jsonPayload[key] = val.toString();
      };

      append('motherName', data.motherName);
      append('motherAge', data.motherAge);
      append('isTwin', data.isTwin);
      append('dob', data.dob);
      append('termStatus', data.termStatus);

      if (data.gestationalAgeWeeks) {
        let ga = `${data.gestationalAgeWeeks}W`;
        if (data.gestationalAgeDays) ga += `+${data.gestationalAgeDays}D`;
        append('gestationalAge', ga);
      }

      const normalizeWeight = (w: number | undefined) => w !== undefined ? (w < 15 ? Math.round(w * 1000) : w) : 0;

      if (!data.isTwin) {
        const w = normalizeWeight(data.weight);
        if (w > 0) append('weight', w);
        if (data.gender) append('gender', data.gender);
        if (data.skinForehead) append('skinForehead', data.skinForehead);
        if (data.skinSternum) append('skinSternum', data.skinSternum);
      } else {
        const wa = normalizeWeight(data.weightA);
        if (wa > 0) append('weightA', wa);
        if (data.genderA) append('genderA', data.genderA);
        if (data.skinForeheadA) append('skinForeheadA', data.skinForeheadA);
        if (data.skinSternumA) append('skinSternumA', data.skinSternumA);

        const wb = normalizeWeight(data.weightB);
        if (wb > 0) append('weightB', wb);
        if (data.genderB) append('genderB', data.genderB);
        if (data.skinForeheadB) append('skinForeheadB', data.skinForeheadB);
        if (data.skinSternumB) append('skinSternumB', data.skinSternumB);
      }

      const imageToUpload = imageUri && !imageUri.startsWith('http') ? imageUri : undefined;

      if (imageToUpload) {
        const filename = imageToUpload.split('/').pop() || 'photo.jpg';
        const match = /\.(\w+)$/.exec(filename);
        const type = match ? `image/${match[1]}` : `image/jpeg`;
        formData.append('motherImage', {
          uri: imageToUpload,
          name: filename,
          type,
        } as any);
      }

      if (forceSave) {
        formData.append('forceSave', 'true');
        jsonPayload.forceSave = true;
      }

      try {
        if (babyId) {
          await api.put(`/babies/${babyId}`, formData);
          Alert.alert('Success', 'Baby updated successfully!', [{ text: 'OK', onPress: () => navigation.goBack() }]);
        } else {
          const res = await api.post('/babies', formData);
          console.log('BABY ADDED SUCCESSFULLY - SERVER RESPONSE:', res.status, res.data);
          Alert.alert('Success', 'Baby added successfully!', [{ text: 'OK', onPress: () => navigation.goBack() }]);
        }
      } catch (apiError: any) {
        if (!apiError.response) {
          // Network Error
          const tempId = babyId ? undefined : `local-${v4()}`;
          const url = babyId ? `/babies/${babyId}` : '/babies';
          const method = babyId ? 'put' : 'post';
          
          await queueRequest(url, method, jsonPayload, imageToUpload, tempId);
          Alert.alert('Saved Offline', 'Your data was saved locally and will sync when internet is restored.', [{ text: 'OK', onPress: () => navigation.goBack() }]);
        } else if (apiError.response.status === 409 && apiError.response.data?.code === 'DUPLICATE_BABY') {
          console.log('DUPLICATE CAUGHT:', apiError.response.data);
          setConflictBaby(apiError.response.data.existingBaby);
        } else {
          console.log('API ERROR CAUGHT:', apiError.response?.status, apiError.response?.data);
          throw apiError;
        }
      }
    } catch (error: any) {
      Alert.alert('Error', error.response?.data?.message || 'Failed to process request');
    } finally {
      setLoading(false);
    }
  };

  const handleAddAnyway = () => {
    setConflictBaby(null);
    handleSubmit((data) => onSubmit(data, true))();
  };

  const renderInput = (name: any, placeholder: string, keyboardType: any = 'default', label: string, isRequired: boolean = true, nextField?: string) => (
    <View style={styles.fieldContainer}>
      <Text allowFontScaling={false} style={styles.label}>{label} {isRequired ? '*' : ''}</Text>
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
            keyboardType={keyboardType}
            returnKeyType={nextField ? 'next' : 'done'}
            onSubmitEditing={() => focusNext(nextField)}
            blurOnSubmit={!nextField}
          />
        )}
      />
      {errors[name]?.message ? <Text allowFontScaling={false} style={styles.errorText}>{errors[name]?.message as string}</Text> : null}
    </View>
  );

  const renderRadioGroup = (name: any, options: string[], label: string) => (
    <View style={styles.fieldContainer}>
      <Text allowFontScaling={false} style={styles.label}>{label} *</Text>
      <Controller
        control={control}
        name={name}
        render={({ field: { onChange, value } }) => (
          <View style={{ flexDirection: 'row', gap: 24, marginTop: 4 }}>
            {options.map((opt) => (
              <TouchableOpacity
                key={opt}
                style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}
                onPress={() => onChange(opt)}
              >
                <View style={{ height: 20, width: 20, borderRadius: 10, borderWidth: 2, borderColor: value === opt ? '#4f46e5' : '#cbd5e1', alignItems: 'center', justifyContent: 'center' }}>
                  {value === opt && <View style={{ height: 10, width: 10, borderRadius: 5, backgroundColor: '#4f46e5' }} />}
                </View>
                <Text allowFontScaling={false} style={{ fontSize: 16, color: '#334155' }}>{opt}</Text>
              </TouchableOpacity>
            ))}
          </View>
        )}
      />
      {errors[name]?.message ? <Text allowFontScaling={false} style={styles.errorText}>{errors[name]?.message as string}</Text> : null}
    </View>
  );

  const formatDateDisplay = (dateStr: string) => {
    if (!dateStr) return 'DD-MM-YYYY';
    const parts = dateStr.split('-');
    if (parts.length === 3) return `${parts[2]}-${parts[1]}-${parts[0]}`;
    return dateStr;
  };

  const renderDatePicker = () => (
    <View style={styles.fieldContainer}>
      <Text allowFontScaling={false} style={styles.label}>Date of Birth *</Text>
      <Controller
        control={control}
        name="dob"
        render={({ field: { onChange, value } }) => (
          <>
            <TouchableOpacity
              style={[styles.input, errors.dob ? styles.inputError : undefined, { justifyContent: 'center', height: 48 }]}
              onPress={() => setShowDatePicker(true)}
            >
              <Text allowFontScaling={false} style={{ color: value ? '#0f172a' : '#94a3b8' }}>
                {formatDateDisplay(value as string)}
              </Text>
            </TouchableOpacity>
            {showDatePicker && (
              <DateTimePicker
                value={value ? new Date(value as string) : new Date()}
                mode="date"
                display="default"
                maximumDate={new Date()}
                onChange={(event, selectedDate) => {
                  setShowDatePicker(false);
                  if (selectedDate) {
                    onChange(selectedDate.toISOString().split('T')[0]);
                  }
                }}
              />
            )}
          </>
        )}
      />
      {errors.dob?.message ? <Text allowFontScaling={false} style={styles.errorText}>{errors.dob?.message as string}</Text> : null}
    </View>
  );

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={{ padding: 8, marginRight: 8 }}>
          <ArrowLeft size={24} color="#334155" />
        </TouchableOpacity>
        <Text allowFontScaling={false} style={styles.headerTitle}>{babyId ? 'Edit Baby' : 'Add New Baby'}</Text>
      </View>
      {fetching ? (
        <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
          <ActivityIndicator size="large" color="#4f46e5" />
        </View>
      ) : (
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
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
                <Text allowFontScaling={false} style={styles.cardTitle}>Mother's Information</Text>
                {renderInput('motherName', 'Full Name', 'default', 'Mother\'s Name', true, 'motherAge')}
                {renderInput('motherAge', 'e.g. 28', 'numeric', 'Mother\'s Age', true, 'gestationalAgeWeeks')}

                <View style={styles.fieldContainer}>
                  <Text allowFontScaling={false} style={styles.label}>Mother's Photo (Optional)</Text>
                  {imageUri ? (
                    <View style={styles.imagePreviewContainer}>
                      <Image source={{ uri: imageUri }} style={styles.imagePreview} />
                      <TouchableOpacity style={styles.removeImageBtn} onPress={() => setImageUri(null)}>
                        <X size={20} color="#fff" />
                      </TouchableOpacity>
                    </View>
                  ) : (
                    <View style={{ flexDirection: 'row', gap: 12 }}>
                      <TouchableOpacity style={[styles.imagePickerBtn, { flex: 1 }]} onPress={pickImage}>
                        <ImagePlus size={24} color="#4f46e5" />
                        <Text allowFontScaling={false} style={styles.imagePickerText}>Upload Photo</Text>
                      </TouchableOpacity>
                      <TouchableOpacity style={[styles.imagePickerBtn, { flex: 1 }]} onPress={takePhoto}>
                        <Camera size={24} color="#4f46e5" />
                        <Text allowFontScaling={false} style={styles.imagePickerText}>Take Photo</Text>
                      </TouchableOpacity>
                    </View>
                  )}
                </View>
              </View>

              <View style={styles.card}>
                <Text allowFontScaling={false} style={styles.cardTitle}>Baby Configuration</Text>

                {!babyId && (
                  <View style={[styles.fieldContainer, styles.rowBetween]}>
                    <Text allowFontScaling={false} style={[styles.label, { marginBottom: 0 }]}>Are they twins?</Text>
                    <Controller
                      control={control}
                      name="isTwin"
                      render={({ field: { onChange, value } }) => (
                        <Switch value={value} onValueChange={onChange} trackColor={{ false: '#cbd5e1', true: '#818cf8' }} thumbColor={value ? '#4f46e5' : '#f8fafc'} />
                      )}
                    />
                  </View>
                )}

                <View style={styles.fieldContainer}>
                  <Text allowFontScaling={false} style={[styles.label, { fontSize: 16 }]}>Gestational Age : *</Text>
                  <View style={{ flexDirection: 'row', gap: 16 }}>
                    <View style={{ flex: 1 }}>{renderInput('gestationalAgeWeeks', 'e.g. 36', 'numeric', 'weeks', false, 'gestationalAgeDays')}</View>
                    <View style={{ flex: 1 }}>{renderInput('gestationalAgeDays', '0-6', 'numeric', 'days', false, isTwin ? 'weightA' : 'weight')}</View>
                  </View>
                </View>

                {renderDatePicker()}
                {renderRadioGroup('termStatus', ['Term', 'Preterm'], 'Term Status')}
              </View>

              {!isTwin ? (
                <View style={styles.card}>
                  <Text allowFontScaling={false} style={styles.cardTitle}>Single Baby</Text>
                  {renderInput('weight', 'e.g. 2.5 or 2500', 'numeric', 'Weight', true, 'skinForehead')}
                  {renderRadioGroup('gender', ['Male', 'Female'], 'Gender')}
                  <View style={{ flexDirection: 'row', gap: 16 }}>
                    <View style={{ flex: 1 }}>{renderInput('skinForehead', 'e.g. 1', 'numeric', 'Skin Forehead', false, 'skinSternum')}</View>
                    <View style={{ flex: 1 }}>{renderInput('skinSternum', 'e.g. 1', 'numeric', 'Skin Sternum', false, undefined)}</View>
                  </View>
                </View>
              ) : (
                <>
                  <View style={[styles.card, { backgroundColor: '#faf5ff', borderColor: '#e9d5ff' }]}>
                    <Text allowFontScaling={false} style={[styles.cardTitle, { color: '#6b21a8' }]}>Twin 1</Text>
                    {renderInput('weightA', 'e.g. 2.5 or 2500', 'numeric', 'Weight', true, 'skinForeheadA')}
                    {renderRadioGroup('genderA', ['Male', 'Female'], 'Gender')}
                    <View style={{ flexDirection: 'row', gap: 16 }}>
                      <View style={{ flex: 1 }}>{renderInput('skinForeheadA', 'e.g. 1', 'numeric', 'Skin Forehead', false, 'skinSternumA')}</View>
                      <View style={{ flex: 1 }}>{renderInput('skinSternumA', 'e.g. 1', 'numeric', 'Skin Sternum', false, 'weightB')}</View>
                    </View>
                  </View>

                  <View style={[styles.card, { backgroundColor: '#faf5ff', borderColor: '#e9d5ff' }]}>
                    <Text allowFontScaling={false} style={[styles.cardTitle, { color: '#6b21a8' }]}>Twin 2</Text>
                    {renderInput('weightB', 'e.g. 2.5 or 2500', 'numeric', 'Weight', true, 'skinForeheadB')}
                    {renderRadioGroup('genderB', ['Male', 'Female'], 'Gender')}
                    <View style={{ flexDirection: 'row', gap: 16 }}>
                      <View style={{ flex: 1 }}>{renderInput('skinForeheadB', 'e.g. 1', 'numeric', 'Skin Forehead', false, 'skinSternumB')}</View>
                      <View style={{ flex: 1 }}>{renderInput('skinSternumB', 'e.g. 1', 'numeric', 'Skin Sternum', false, undefined)}</View>
                    </View>
                  </View>
                </>
              )}

              <TouchableOpacity style={styles.button} onPress={handleSubmit((data) => onSubmit(data, false))} disabled={loading}>
                {loading ? <ActivityIndicator color="#ffffff" /> : <Text allowFontScaling={false} style={styles.buttonText}>{babyId ? 'Update Baby' : 'Save & Register Baby'}</Text>}
              </TouchableOpacity>
            </View>
          </KeyboardAwareScrollView>
        </KeyboardAvoidingView>
      )}

      {/* Duplicate Baby Modal */}
      <Modal visible={!!conflictBaby} transparent={true} animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text allowFontScaling={false} style={styles.modalTitle}>Similar Baby Found</Text>
            <Text allowFontScaling={false} style={styles.modalText}>
              A baby with the same Mother Name, Gender, Weight, and Gestational Age was previously added.
            </Text>

            {conflictBaby && (
              <View style={styles.conflictInfo}>
                {conflictBaby.motherImage ? (
                  <Image source={{ uri: conflictBaby.motherImage }} style={styles.conflictImg} />
                ) : (
                  <View style={styles.conflictImgPlaceholder}>
                    <Text allowFontScaling={false} style={styles.conflictImgInitial}>
                      {conflictBaby.motherName.charAt(0).toUpperCase()}
                    </Text>
                  </View>
                )}
                <View style={{ flex: 1 }}>
                  <Text allowFontScaling={false} style={styles.conflictName}>{conflictBaby.motherName}</Text>
                  <Text allowFontScaling={false} style={styles.conflictId}>{conflictBaby.displayId}</Text>
                </View>
              </View>
            )}

            <View style={styles.modalButtons}>
              <TouchableOpacity
                style={[styles.modalBtn, styles.modalBtnSecondary]}
                onPress={() => {
                  setConflictBaby(null);
                  if (conflictBaby) navigation.navigate('BabyDetails', { babyId: conflictBaby._id });
                }}
              >
                <Text allowFontScaling={false} style={styles.modalBtnSecondaryText}>Open Stored Details</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.modalBtn, styles.modalBtnPrimary]} onPress={handleAddAnyway}>
                <Text allowFontScaling={false} style={styles.modalBtnPrimaryText}>Add This Baby</Text>
              </TouchableOpacity>
            </View>
            
            <TouchableOpacity style={{ marginTop: 16 }} onPress={() => setConflictBaby(null)}>
              <Text allowFontScaling={false} style={{ color: '#64748b', textAlign: 'center', fontWeight: '500' }}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f1f5f9' },
  header: { paddingHorizontal: moderateScale(16), paddingVertical: moderateScale(16), backgroundColor: '#ffffff', borderBottomWidth: 1, borderBottomColor: '#e2e8f0', flexDirection: 'row', alignItems: 'center' },
  headerTitle: { fontSize: moderateScale(20), fontWeight: 'bold', color: '#1e293b' },
  card: { backgroundColor: '#ffffff', padding: moderateScale(20), borderRadius: moderateScale(16), marginBottom: moderateScale(16), borderWidth: 1, borderColor: '#e2e8f0', shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.05, shadowRadius: 2, elevation: 1 },
  cardTitle: { fontSize: moderateScale(16), fontWeight: '700', color: '#334155', marginBottom: moderateScale(16), borderBottomWidth: 1, borderBottomColor: '#f1f5f9', paddingBottom: moderateScale(8) },
  fieldContainer: { marginBottom: moderateScale(16) },
  rowBetween: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  label: { fontSize: moderateScale(14), fontWeight: '500', color: '#475569', marginBottom: moderateScale(8) },
  input: { backgroundColor: '#f8fafc', borderColor: '#cbd5e1', borderWidth: 1, borderRadius: moderateScale(10), paddingHorizontal: moderateScale(16), paddingVertical: moderateScale(12), color: '#0f172a' },
  inputError: { borderColor: '#ef4444', backgroundColor: '#fef2f2' },
  errorText: { color: '#ef4444', fontSize: 12, marginTop: 4, marginLeft: 4 },
  imagePickerBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', backgroundColor: '#eef2ff', paddingVertical: moderateScale(16), borderRadius: moderateScale(12), borderWidth: 1, borderColor: '#c7d2fe', borderStyle: 'dashed' },
  imagePickerText: { color: '#4f46e5', fontWeight: '600', marginLeft: moderateScale(8) },
  imagePreviewContainer: { position: 'relative', width: moderateScale(120), height: moderateScale(120), borderRadius: moderateScale(12), overflow: 'hidden' },
  imagePreview: { width: '100%', height: '100%' },
  removeImageBtn: { position: 'absolute', top: moderateScale(8), right: moderateScale(8), backgroundColor: 'rgba(0,0,0,0.5)', borderRadius: moderateScale(12), padding: moderateScale(4) },
  button: { width: '100%', backgroundColor: '#4f46e5', borderRadius: moderateScale(12), paddingVertical: moderateScale(16), marginTop: moderateScale(8), flexDirection: 'row', justifyContent: 'center', alignItems: 'center' },
  buttonText: { color: '#ffffff', fontWeight: 'bold', fontSize: moderateScale(16) },

  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', padding: 24 },
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
