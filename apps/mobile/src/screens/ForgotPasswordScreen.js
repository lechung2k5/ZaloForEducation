import React, { useState } from 'react';
import {
  View, Text, TouchableOpacity, SafeAreaView,
  KeyboardAvoidingView, Platform, ScrollView,
  StyleSheet, Alert,
} from 'react-native';
import Input from '../components/Input';
import Button from '../components/Button';

const API_URL = process.env.EXPO_PUBLIC_API_URL || 'http://localhost:3000';

export default function ForgotPasswordScreen({ onNavigate }) {
  const [step, setStep] = useState(1); // 1: email, 2: otp, 3: new password
  const [email, setEmail] = useState('');
  const [otp, setOtp] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);

  // Bước 1: Gửi OTP về Gmail
  const handleSendOtp = async () => {
    if (!email) { Alert.alert('Lỗi', 'Vui lòng nhập email!'); return; }
    setLoading(true);
    try {
      const res = await fetch(`${API_URL}/auth/forgot-password/request-otp`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      });
      const data = await res.json();
      if (res.ok) {
        setStep(2);
        Alert.alert('Thành công', data.message);
      } else {
        Alert.alert('Lỗi', data.message);
      }
    } catch {
      Alert.alert('Lỗi', 'Không thể kết nối server');
    } finally {
      setLoading(false);
    }
  };

  // Bước 2: Xác thực OTP
  const handleVerifyOtp = async () => {
    if (otp.length !== 6) { Alert.alert('Lỗi', 'Mã OTP phải có 6 chữ số'); return; }
    setLoading(true);
    try {
      const res = await fetch(`${API_URL}/auth/forgot-password/verify-otp`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, otp }),
      });
      const data = await res.json();
      if (res.ok) {
        setStep(3);
      } else {
        Alert.alert('Lỗi', data.message);
      }
    } catch {
      Alert.alert('Lỗi', 'Không thể kết nối server');
    } finally {
      setLoading(false);
    }
  };

  // Bước 3: Đặt mật khẩu mới
  const handleResetPassword = async () => {
    if (!newPassword || newPassword.length < 6) {
      Alert.alert('Lỗi', 'Mật khẩu phải có ít nhất 6 ký tự'); return;
    }
    if (newPassword !== confirmPassword) {
      Alert.alert('Lỗi', 'Mật khẩu xác nhận không khớp!'); return;
    }
    setLoading(true);
    try {
      const res = await fetch(`${API_URL}/auth/forgot-password/reset`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, otp, newPassword }),
      });
      const data = await res.json();
      if (res.ok) {
        setStep(4);
      } else {
        Alert.alert('Lỗi', data.message);
      }
    } catch {
      Alert.alert('Lỗi', 'Không thể kết nối server');
    } finally {
      setLoading(false);
    }
  };

  const StepIndicator = () => (
    <View style={styles.stepContainer}>
      {[1, 2, 3].map((s) => (
        <React.Fragment key={s}>
          <View style={[styles.stepCircle, step >= s ? styles.stepActive : styles.stepInactive]}>
            <Text style={[styles.stepText, step >= s ? styles.stepTextActive : styles.stepTextInactive]}>{s}</Text>
          </View>
          {s < 3 && <View style={[styles.stepLine, step > s ? styles.stepLineActive : styles.stepLineInactive]} />}
        </React.Fragment>
      ))}
    </View>
  );

  return (
    <SafeAreaView style={styles.safeArea}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={styles.flex}>
        <ScrollView contentContainerStyle={styles.scrollContent}>
          <View style={styles.card}>
            {/* Brand */}
            <View style={styles.brandBar}>
              <View style={styles.logoCircle}><Text style={styles.logoText}>Z</Text></View>
              <Text style={styles.brandName}>ZaloEdu</Text>
            </View>

            {step === 4 ? (
              <View style={{ alignItems: 'center', paddingVertical: 20 }}>
                <Text style={{ fontSize: 48, marginBottom: 16 }}>✅</Text>
                <Text style={styles.title}>Thành công!</Text>
                <Text style={[styles.subtitle, { textAlign: 'center' }]}>Mật khẩu của bạn đã được đặt lại. Vui lòng đăng nhập bằng mật khẩu mới.</Text>
                <View style={{ width: '100%', marginTop: 20 }}>
                  <Button title="Đăng nhập ngay" onPress={() => onNavigate && onNavigate('login')} />
                </View>
              </View>
            ) : (
              <>
                <Text style={styles.title}>Quên mật khẩu</Text>
                <Text style={styles.subtitle}>
                  {step === 1 && 'Nhập Gmail để nhận mã xác thực'}
                  {step === 2 && `Nhập mã OTP đã gửi tới ${email}`}
                  {step === 3 && 'Tạo mật khẩu mới cho tài khoản'}
                </Text>

                <StepIndicator />

                {/* Bước 1: Email */}
                {step === 1 && (
                  <View style={styles.form}>
                    <Input
                      label="Email Gmail"
                      placeholder="example@gmail.com"
                      value={email}
                      onChangeText={setEmail}
                      keyboardType="email-address"
                    />
                    <Button title={loading ? 'Đang gửi...' : 'Gửi mã OTP'} onPress={handleSendOtp} />
                  </View>
                )}

                {/* Bước 2: OTP */}
                {step === 2 && (
                  <View style={styles.form}>
                    <Input
                      label="Mã OTP (6 chữ số)"
                      placeholder="000000"
                      value={otp}
                      onChangeText={setOtp}
                      keyboardType="number-pad"
                    />
                    <View style={styles.row}>
                      <TouchableOpacity style={styles.backBtn} onPress={() => setStep(1)}>
                        <Text style={styles.backBtnText}>Quay lại</Text>
                      </TouchableOpacity>
                      <View style={{ flex: 2 }}>
                        <Button title={loading ? 'Đang xác thực...' : 'Xác thực OTP'} onPress={handleVerifyOtp} />
                      </View>
                    </View>
                    <TouchableOpacity onPress={handleSendOtp} style={styles.resendBtn}>
                      <Text style={styles.resendText}>Gửi lại mã</Text>
                    </TouchableOpacity>
                  </View>
                )}

                {/* Bước 3: Mật khẩu mới */}
                {step === 3 && (
                  <View style={styles.form}>
                    <Input
                      label="Mật khẩu mới"
                      placeholder="••••••••"
                      value={newPassword}
                      onChangeText={setNewPassword}
                      secureTextEntry
                    />
                    <Input
                      label="Xác nhận mật khẩu"
                      placeholder="••••••••"
                      value={confirmPassword}
                      onChangeText={setConfirmPassword}
                      secureTextEntry
                    />
                    <Button title={loading ? 'Đang cập nhật...' : 'Đặt lại mật khẩu'} onPress={handleResetPassword} />
                  </View>
                )}

                <TouchableOpacity onPress={() => onNavigate && onNavigate('login')} style={styles.footer}>
                  <Text style={styles.footerLink}>← Quay lại đăng nhập</Text>
                </TouchableOpacity>
              </>
            )}
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: '#f8fafc' },
  flex: { flex: 1 },
  scrollContent: { flexGrow: 1, justifyContent: 'center', alignItems: 'center', padding: 16 },
  card: {
    backgroundColor: '#fff', borderRadius: 30, padding: 24,
    width: '100%', maxWidth: 450,
    shadowColor: '#000', shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.1, shadowRadius: 20, elevation: 8,
  },
  brandBar: { flexDirection: 'row', alignItems: 'center', marginBottom: 20 },
  logoCircle: {
    width: 32, height: 32, borderRadius: 16,
    backgroundColor: '#135bec', alignItems: 'center', justifyContent: 'center', marginRight: 8,
  },
  logoText: { color: '#fff', fontWeight: '900', fontSize: 16 },
  brandName: { fontSize: 22, fontWeight: '900', color: '#135bec', letterSpacing: -1 },
  title: { fontSize: 24, fontWeight: '800', color: '#111318', marginBottom: 6 },
  subtitle: { fontSize: 13, color: '#64748b', marginBottom: 24 },
  stepContainer: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', marginBottom: 28 },
  stepCircle: { width: 32, height: 32, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
  stepActive: { backgroundColor: '#135bec' },
  stepInactive: { backgroundColor: '#f1f5f9' },
  stepText: { fontWeight: 'bold', fontSize: 14 },
  stepTextActive: { color: '#fff' },
  stepTextInactive: { color: '#94a3b8' },
  stepLine: { flex: 0.2, height: 2, marginHorizontal: 4 },
  stepLineActive: { backgroundColor: '#135bec' },
  stepLineInactive: { backgroundColor: '#f1f5f9' },
  form: { width: '100%' },
  row: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  backBtn: {
    flex: 1, height: 48, justifyContent: 'center', alignItems: 'center',
    borderRadius: 12, borderWidth: 1, borderColor: '#e2e8f0',
  },
  backBtnText: { fontWeight: '700', color: '#64748b' },
  resendBtn: { alignItems: 'center', marginTop: 12 },
  resendText: { color: '#135bec', fontWeight: '600', fontSize: 13 },
  footer: { alignItems: 'center', marginTop: 20 },
  footerLink: { fontSize: 14, color: '#135bec', fontWeight: '600' },
});
