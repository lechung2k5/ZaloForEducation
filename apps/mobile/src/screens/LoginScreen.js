import React, { useState, useRef, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Image
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Alert from '../utils/Alert';
import { LinearGradient } from 'expo-linear-gradient';
import { BlurView } from 'expo-blur';
import Input from '../components/Input';
import Button from '../components/Button';
import { Colors, Typography, Shadows } from '../constants/Theme';

import { getDeviceId } from '../utils/deviceId';
import { getDeviceInfo } from '../utils/device';
import { apiRequest } from '../utils/api';
import SocketService from '../utils/socket';
import Storage from '../utils/storage';
import { useAuth } from '../context/AuthContext';

export default function LoginScreen({ onNavigate }) {
  const { login } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [deviceId, setDeviceId] = useState('');

  useEffect(() => {
    async function initDeviceId() {
      try {
        const id = await getDeviceId();
        console.log('[DEBUG] Device ID initialized:', id);
        setDeviceId(id);
      } catch (err) {
        console.error('[DEBUG] Failed to init Device ID:', err);
      }
    }
    initDeviceId();
  }, []);

  const handleLogin = async () => {
    if (!email || !password) {
      Alert.alert('Lỗi', 'Vui lòng nhập đầy đủ email và mật khẩu!');
      return;
    }

    setLoading(true);

    try {
      const { deviceName, deviceType } = getDeviceInfo();

      const data = await apiRequest('/auth/login', {
        method: 'POST',
        body: JSON.stringify({
          email,
          password,
          deviceId,
          deviceName,
          deviceType,
          platform: 'mobile',
        }),
      });

      console.log('🔥 [LOGIN] API Response Raw:', JSON.stringify(data, null, 2));

      // 1. Kiểm tra nếu có Token (Đăng nhập thành công ngay)
      if (data.accessToken) {
        console.log('✅ [LOGIN] Access granted');
        await login(data.user, data.accessToken, deviceId);
        if (onNavigate) onNavigate('home');
        return;
      }

      // 2. Kiểm tra nếu yêu cầu OTP (Bảo mật)
      const isOtpRequired = 
        data.requireOtp === true || 
        data.type === 'REQUIRE_OTP' || 
        (data.message && data.message.includes('Xác thực bảo mật'));

      if (isOtpRequired) {
        console.log('🛡️ [LOGIN] Security verification needed. Navigating to OTP Screen.');
        if (onNavigate) {
          onNavigate('login-otp', 'messages', {
            email,
            deviceId,
            deviceName,
            deviceType
          });
        }
        return;
      }

      // 3. Nếu không phải cả 2 -> Coi như lỗi đăng nhập thông thường
      console.warn('❌ [LOGIN] Login failed:', data.message);
      Alert.alert('Đăng nhập thất bại', data.message || 'Sai tài khoản hoặc mật khẩu');
    } catch (error) {
      if (error.message !== 'SESSION_INVALIDATED') {
        console.error('[DEBUG] Connection error:', error);
        Alert.alert('Lỗi', 'Lỗi kết nối server: ' + error.message);
      }
    } finally {
      setLoading(false);
    }
  };

  const handleForgotPassword = () => {
    if (onNavigate) onNavigate('forgot');
  };

  const handleRegister = () => {
    if (onNavigate) onNavigate('register');
  };

  const ForgotLink = () => (
    <TouchableOpacity onPress={handleForgotPassword}>
      <Text style={styles.forgotText}>Quên mật khẩu?</Text>
    </TouchableOpacity>
  );

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={[styles.blob, styles.blobTopRight]} />
      <View style={[styles.blob, styles.blobBottomLeft]} />

      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.flex}
      >
        <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
          <View style={styles.headerContainer}>
            <View style={styles.logoBox}>
              <Image 
                source={require('../../assets/logo_blue.png')} 
                style={styles.logoImage}
                resizeMode="cover"
              />
            </View>
            <Text style={styles.brandTitle}>Zalo Education</Text>
            <Text style={styles.brandSubtitle}>Khai phóng tiềm năng tri thức</Text>
          </View>

          <View style={styles.cardContainer}>
            <BlurView intensity={80} tint="light" style={styles.glassCard}>
              <Text style={styles.cardTitle}>Đăng nhập</Text>

              <View style={styles.form}>
                <Input
                  label="Email "
                  placeholder="user@example.com"
                  value={email}
                  onChangeText={setEmail}
                  keyboardType="email-address"
                  icon="person"
                />
                <Input
                  label="Mật khẩu"
                  placeholder="••••••••"
                  value={password}
                  onChangeText={setPassword}
                  secureTextEntry
                  icon="lock"
                  rightElement={<ForgotLink />}
                />

                <Button
                  title={loading ? "Đang xử lý..." : "Đăng nhập"}
                  onPress={handleLogin}
                  variant="primary"
                  disabled={loading}
                  icon={!loading ? "arrow_forward" : null}
                />
              </View>

              <View style={styles.dividerContainer}>
                <View style={styles.dividerLine} />
                <Text style={styles.dividerText}>Hoặc đăng nhập với</Text>
                <View style={styles.dividerLine} />
              </View>

              <Button
                title="Tiếp tục với Google"
                variant="secondary"
                onPress={() => Alert.alert("Sắp ra mắt")}
              />

              <View style={styles.footer}>
                <Text style={styles.footerText}>Bạn mới sử dụng Zalo Education? </Text>
                <TouchableOpacity onPress={handleRegister}>
                  <Text style={styles.footerLink}>Đăng ký ngay</Text>
                </TouchableOpacity>
              </View>
            </BlurView>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: Colors.surface },
  flex: { flex: 1 },
  scrollContent: { flexGrow: 1, justifyContent: 'center', padding: 24 },
  blob: { position: 'absolute', borderRadius: 200, opacity: 0.5 },
  blobTopRight: { top: -100, right: -100, width: 300, height: 300, backgroundColor: 'rgba(0, 65, 143, 0.08)' },
  blobBottomLeft: { bottom: -100, left: -100, width: 250, height: 250, backgroundColor: 'rgba(75, 94, 134, 0.1)' },
  headerContainer: { alignItems: 'center', marginBottom: 40 },
  logoBox: { width: 64, height: 64, borderRadius: 20, backgroundColor: '#eef4ff', alignItems: 'center', justifyContent: 'center', marginBottom: 16, borderWide: 1, borderColor: '#00418f10', overflow: 'hidden', ...Shadows.medium },
  logoImage: { width: '100%', height: '100%' },
  brandTitle: { ...Typography.heading, fontSize: 32, color: Colors.primary, marginBottom: 4 },
  brandSubtitle: { ...Typography.body, fontSize: 14, color: Colors.onSurfaceVariant },
  cardContainer: { borderRadius: 32, overflow: 'hidden', ...Shadows.medium },
  glassCard: { padding: 32, backgroundColor: 'rgba(255, 255, 255, 0.8)', borderWidth: 1, borderColor: 'rgba(255, 255, 255, 0.6)', borderRadius: 32 },
  cardTitle: { ...Typography.heading, fontSize: 24, color: Colors.onSurface, marginBottom: 24 },
  form: { marginBottom: 16 },
  forgotText: { ...Typography.label, fontSize: 13, color: Colors.primary },
  dividerContainer: { flexDirection: 'row', alignItems: 'center', marginVertical: 24 },
  dividerLine: { flex: 1, height: 1, backgroundColor: Colors.outlineVariant, opacity: 0.5 },
  dividerText: { ...Typography.body, fontSize: 13, color: Colors.onSurfaceVariant, marginHorizontal: 16 },
  footer: { flexDirection: 'row', justifyContent: 'center', alignItems: 'center', marginTop: 24 },
  footerText: { ...Typography.body, fontSize: 14, color: Colors.onSurfaceVariant },
  footerLink: { ...Typography.label, fontSize: 14, color: Colors.primary },
});
