import React, { useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  SafeAreaView,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Alert,
} from 'react-native';
import Input from '../components/Input';
import Button from '../components/Button';

export default function RegisterScreen({ onNavigate }) {
  const [step, setStep] = useState(1);
  const [email, setEmail] = useState('');
  const [otp, setOtp] = useState('');
  const [fullName, setFullName] = useState('');
  const [gender, setGender] = useState(true); // true = Nam, false = Nữ
  const [dataOfBirth, setDataOfBirth] = useState('');
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [emailError, setEmailError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleRequestOtp = async () => {
    if (!email.endsWith('@gmail.com')) {
      Alert.alert('Lỗi', 'Chỉ chấp nhận tài khoản Gmail (@gmail.com)');
      return;
    }

    setLoading(true);
    const apiUrl = process.env.EXPO_PUBLIC_API_URL || 'http://localhost:3000';
    try {
      const response = await fetch(`${apiUrl}/auth/register/request-otp`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      });

      const data = await response.json();
      if (response.ok) {
        setStep(2);
        Alert.alert('Thông báo', data.message);
      } else {
        Alert.alert('Lỗi', data.message);
      }
    } catch (error) {
      Alert.alert('Lỗi', 'Không thể kết nối server');
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyOtp = () => {
    if (otp.length === 6) {
      setStep(3);
    } else {
      Alert.alert('Lỗi', 'Mã OTP phải có 6 chữ số');
    }
  };

  const handleRegister = async () => {
    if (password !== confirmPassword) {
      Alert.alert('Lỗi', 'Mật khẩu xác nhận không khớp!');
      return;
    }

    setLoading(true);
    const apiUrl = process.env.EXPO_PUBLIC_API_URL || 'http://localhost:3000';
    try {
      const response = await fetch(`${apiUrl}/auth/register/confirm`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          email, 
          otp, 
          fullName, 
          gender, 
          dataOfBirth, 
          phone, 
          password 
        }),
      });

      const data = await response.json();
      if (response.ok) {
        Alert.alert('Thành công', 'Đăng ký tài khoản thành công!');
        onNavigate && onNavigate('login');
      } else {
        Alert.alert('Lỗi', data.message);
      }
    } catch (error) {
      Alert.alert('Lỗi', 'Lỗi kết nối server');
    } finally {
      setLoading(false);
    }
  };

  const StepIndicator = () => (
    <View style={styles.stepContainer}>
      {[1, 2, 3].map((s) => (
        <React.Fragment key={s}>
          <View style={[styles.stepCircle, step >= s ? styles.stepCircleActive : styles.stepCircleInactive]}>
            <Text style={[styles.stepText, step >= s ? styles.stepTextActive : styles.stepTextInactive]}>{s}</Text>
          </View>
          {s < 3 && <View style={[styles.stepLine, step > s ? styles.stepLineActive : styles.stepLineInactive]} />}
        </React.Fragment>
      ))}
    </View>
  );

  return (
    <SafeAreaView style={styles.safeArea}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.flex}
      >
        <ScrollView contentContainerStyle={styles.scrollContent}>
          <View style={styles.card}>
            <View style={styles.brandBar}>
              <View style={styles.logoCircle}>
                <Text style={styles.logoText}>Z</Text>
              </View>
              <Text style={styles.brandName}>ZaloEdu</Text>
            </View>

            <View style={styles.titleSection}>
              <Text style={styles.title}>Tạo tài khoản</Text>
              <Text style={styles.subtitle}>Gia nhập cộng đồng học tập thông minh</Text>
            </View>

            <StepIndicator />

            {step === 1 && (
              <View style={styles.form}>
                <Input
                  label="Email Gmail"
                  placeholder="example@gmail.com"
                  value={email}
                  onChangeText={(val) => {
                    setEmail(val);
                    if (val && !val.endsWith('@gmail.com')) {
                      setEmailError('Chỉ chấp nhận tài khoản Gmail (@gmail.com)');
                    } else {
                      setEmailError('');
                    }
                  }}
                  keyboardType="email-address"
                />
                {emailError ? <Text style={styles.errorText}>{emailError}</Text> : null}
                <Button title={loading ? "Đang gửi..." : "Nhận mã OTP"} onPress={handleRequestOtp} />
              </View>
            )}

            {step === 2 && (
              <View style={styles.form}>
                <Text style={styles.otpLabel}>Nhập mã OTP 6 chữ số gửi đến {email}</Text>
                <Input
                  label="Mã OTP"
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
                    <Button title="Tiếp tục" onPress={handleVerifyOtp} />
                  </View>
                </View>
              </View>
            )}

            {step === 3 && (
              <View style={styles.form}>
                <Input label="Họ và tên" placeholder="Nguyễn Văn A" value={fullName} onChangeText={setFullName} />
                <View style={styles.row}>
                  <View style={{ flex: 1, marginRight: 8 }}>
                    <Input label="Số điện thoại" placeholder="090..." value={phone} onChangeText={setPhone} keyboardType="phone-pad" />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Input label="Ngày sinh" placeholder="DD/MM/YYYY" value={dataOfBirth} onChangeText={setDataOfBirth} />
                  </View>
                </View>

                <Text style={styles.genderLabel}>Giới tính</Text>
                <View style={styles.genderContainer}>
                  <TouchableOpacity 
                    style={[styles.genderBox, gender && styles.genderBoxActive]} 
                    onPress={() => setGender(true)}
                  >
                    <Text style={[styles.genderBoxText, gender && styles.genderBoxTextActive]}>Nam</Text>
                  </TouchableOpacity>
                  <TouchableOpacity 
                    style={[styles.genderBox, !gender && styles.genderBoxActiveFemale]} 
                    onPress={() => setGender(false)}
                  >
                    <Text style={[styles.genderBoxText, !gender && styles.genderBoxTextActiveFemale]}>Nữ</Text>
                  </TouchableOpacity>
                </View>

                <Input label="Mật khẩu" placeholder="••••••••" value={password} onChangeText={setPassword} secureTextEntry />
                <Input label="Xác nhận mật khẩu" placeholder="••••••••" value={confirmPassword} onChangeText={setConfirmPassword} secureTextEntry />
                
                <Button title={loading ? "Đang xử lý..." : "Hoàn tất đăng ký"} onPress={handleRegister} />
              </View>
            )}

            <View style={styles.footer}>
              <Text style={styles.footerText}>Đã có tài khoản? </Text>
              <TouchableOpacity onPress={() => onNavigate && onNavigate('login')}>
                <Text style={styles.footerLink}>Đăng nhập</Text>
              </TouchableOpacity>
            </View>
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
    backgroundColor: '#ffffff',
    borderRadius: 30,
    padding: 24,
    width: '100%',
    maxWidth: 450,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.1,
    shadowRadius: 20,
    elevation: 8,
  },
  brandBar: { flexDirection: 'row', alignItems: 'center', marginBottom: 20 },
  logoCircle: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#135bec',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 8,
  },
  logoText: { color: '#fff', fontWeight: '900', fontSize: 16 },
  brandName: { fontSize: 22, fontWeight: '900', color: '#135bec', letterSpacing: -1 },
  titleSection: { marginBottom: 20 },
  title: { fontSize: 24, fontWeight: '800', color: '#111318', marginBottom: 4 },
  subtitle: { fontSize: 14, color: '#64748b' },
  stepContainer: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', marginBottom: 30 },
  stepCircle: { width: 32, height: 32, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
  stepCircleActive: { backgroundColor: '#135bec' },
  stepCircleInactive: { backgroundColor: '#f1f5f9' },
  stepText: { fontWeight: 'bold', fontSize: 14 },
  stepTextActive: { color: '#fff' },
  stepTextInactive: { color: '#94a3b8' },
  stepLine: { flex: 0.1, h: 2, height: 2, mx: 8 },
  stepLineActive: { backgroundColor: '#135bec' },
  stepLineInactive: { backgroundColor: '#f1f5f9' },
  form: { width: '100%' },
  row: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  backBtn: { flex: 1, height: 48, justifyContent: 'center', alignItems: 'center', borderRadius: 12, borderWidth: 1, borderColor: '#e2e8f0' },
  backBtnText: { fontWeight: '700', color: '#64748b' },
  otpLabel: { textAlign: 'center', fontSize: 13, color: '#64748b', marginBottom: 16 },
  genderLabel: { fontSize: 14, fontWeight: '600', color: '#111318', marginBottom: 8 },
  genderContainer: { flexDirection: 'row', gap: 10, marginBottom: 20, backgroundColor: '#f1f5f9', padding: 4, borderRadius: 12 },
  genderBox: { flex: 1, paddingVertical: 10, alignItems: 'center', borderRadius: 10 },
  genderBoxActive: { backgroundColor: '#fff', shadowColor: '#000', shadowOffset: { width:0, height:2 }, shadowOpacity:0.05, elevation:2 },
  genderBoxActiveFemale: { backgroundColor: '#fff', shadowColor: '#000', shadowOffset: { width:0, height:2 }, shadowOpacity:0.05, elevation:2 },
  genderBoxText: { fontWeight: '700', color: '#64748b', fontSize: 14 },
  genderBoxTextActive: { color: '#135bec' },
  genderBoxTextActiveFemale: { color: '#ec4899' },
  footer: { flexDirection: 'row', justifyContent: 'center', marginTop: 10 },
  footerText: { fontSize: 14, color: '#64748b' },
  footerLink: { fontSize: 14, color: '#135bec', fontWeight: '800' },
  errorText: { color: '#ef4444', fontSize: 12, marginTop: -15, marginBottom: 15, marginLeft: 4, fontWeight: '600' },
});
