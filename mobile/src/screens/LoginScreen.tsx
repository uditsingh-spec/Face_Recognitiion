import React, { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, ActivityIndicator, Alert, SafeAreaView, KeyboardAvoidingView, ScrollView, Platform, StyleSheet } from 'react-native';
import { moderateScale } from 'react-native-size-matters';
import api from '../services/api';
import { useAuthStore } from '../store/useAuthStore';

export default function LoginScreen() {
  const [employeeId, setEmployeeId] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const login = useAuthStore((state) => state.login);

  const handleLogin = async () => {
    if (!employeeId || !password) {
      Alert.alert('Error', 'Please enter both Employee ID and password.');
      return;
    }

    setLoading(true);
    try {
      const response = await api.post('/auth/login', { employeeId, password });
      const { token, user } = response.data;
      await login(token, user);
    } catch (error: any) {
      Alert.alert(
        'Login Failed',
        error.response?.data?.message || 'Unable to connect to the server. Please check your network.'
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.keyboardView}
      >
        <ScrollView
          contentContainerStyle={{ flexGrow: 1, justifyContent: 'center' }}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.card}>
            <View style={styles.header}>
              <Text allowFontScaling={false} style={styles.title}>MedBlue</Text>
              <Text allowFontScaling={false} style={styles.subtitle}>Sign in to access your data entry dashboard</Text>
            </View>

            <View style={styles.form}>
              <View>
                <Text allowFontScaling={false} style={styles.label}>Employee ID</Text>
                <TextInput allowFontScaling={false}
                  style={styles.input}
                  placeholder="Enter your ID"
                  placeholderTextColor="#94a3b8"
                  value={employeeId}
                  onChangeText={setEmployeeId}
                  autoCapitalize="none"
                />
              </View>

              <View>
                <Text allowFontScaling={false} style={[styles.label, { marginTop: 16 }]}>Password</Text>
                <TextInput allowFontScaling={false}
                  style={styles.input}
                  placeholder="Enter password"
                  placeholderTextColor="#94a3b8"
                  value={password}
                  onChangeText={setPassword}
                  secureTextEntry
                />
              </View>

              <TouchableOpacity
                style={styles.button}
                onPress={handleLogin}
                disabled={loading}
              >
                {loading ? (
                  <ActivityIndicator color="#ffffff" />
                ) : (
                  <Text allowFontScaling={false} style={styles.buttonText}>Sign In</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f8fafc' },
  keyboardView: { flex: 1, justifyContent: 'center', paddingHorizontal: moderateScale(32) },
  card: { backgroundColor: '#ffffff', padding: moderateScale(32), borderRadius: moderateScale(24), shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.05, shadowRadius: 2, elevation: 2, borderColor: '#f1f5f9', borderWidth: 1 },
  header: { alignItems: 'center', marginBottom: moderateScale(32) },
  title: { fontSize: moderateScale(30), fontWeight: '800', color: '#4f46e5' },
  subtitle: { color: '#64748b', marginTop: moderateScale(8), textAlign: 'center' },
  form: { gap: moderateScale(16) },
  label: { fontSize: moderateScale(14), fontWeight: '500', color: '#334155', marginBottom: moderateScale(4) },
  input: { width: '100%', backgroundColor: '#f8fafc', borderColor: '#e2e8f0', borderWidth: 1, borderRadius: moderateScale(12), paddingHorizontal: moderateScale(16), paddingVertical: moderateScale(12), color: '#0f172a' },
  button: { width: '100%', backgroundColor: '#4f46e5', borderRadius: moderateScale(12), paddingVertical: moderateScale(16), marginTop: moderateScale(32), flexDirection: 'row', justifyContent: 'center', alignItems: 'center' },
  buttonText: { color: '#ffffff', fontWeight: 'bold', fontSize: moderateScale(18) }
});
