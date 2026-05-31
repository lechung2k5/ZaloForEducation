import { BlurView } from 'expo-blur';
import React, { useEffect, useState } from 'react';
import {
  Image,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Button from '../../components/Button';
import Input from '../../components/Input';
import { Shadows, Typography } from '../../constants/Theme';
import { useTheme } from '../../context/ThemeContext';
import Alert from '../../utils/Alert';

import { useAuth } from '../../context/AuthContext';
import { apiRequest } from '../../utils/api';
import { getDeviceInfo } from '../../utils/device';
import { getDeviceId } from '../../utils/deviceId';

interface LoginProps {
  onNavigate?: (screen: string, params?: any, stack?: string) => void;
}

export default function LoginScreen({ onNavigate }: LoginProps) {
  const { colors, t, isDark } = useTheme();
  const styles = React.useMemo(() => getStyles(colors, isDark), [colors, isDark]);
  const { login } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [deviceId, setDeviceId] = useState('');

  useEffect(() => {
    async function initDeviceId() {
      try {
        const id = await getDeviceId();
        setDeviceId(id);
      } catch (err) {
        console.error('[DEBUG] Failed to init Device ID:', err);
      }
    }
    initDeviceId();
  }, []);

  const handleLogin = async () => {
    if (!email || !password) {
      Alert.alert(t('common.error'), t('auth.login_error_empty'));
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

      if (data.accessToken) {
        await login(data.user, data.accessToken, deviceId);
        return;
      }

      const isOtpRequired =
        data.requireOtp === true ||
        data.type === 'REQUIRE_OTP' ||
        (data.message && data.message.includes('Xác thực bảo mật'));

      if (isOtpRequired) {
        if (onNavigate) {
          onNavigate('LoginOtp', {
            email,
            deviceId,
            deviceName,
            deviceType
          }, 'messages');
        }
        return;
      }

      Alert.alert(t('auth.login_failed'), data.message || t('auth.login_wrong_creds'));
    } catch (error: any) {
      if (error.message !== 'SESSION_INVALIDATED') {
        Alert.alert(t('common.error'), t('auth.login_network_error') + ': ' + error.message);
      }
    } finally {
      setLoading(false);
    }
  };

  const ForgotLink = () => (
    <TouchableOpacity onPress={() => onNavigate && onNavigate('Forgot')}>
      <Text style={styles.forgotText}>{t('auth.forgot_pass')}</Text>
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
                source={require('../../../assets/logo_blue.png')}
                style={styles.logoImage}
                resizeMode="cover"
              />
            </View>
            <Text style={styles.brandTitle}>UniChat</Text>
            <Text style={styles.brandSubtitle}>{t('auth.brand_subtitle')}</Text>
          </View>

          <View style={styles.cardContainer}>
            <BlurView intensity={80} tint={isDark ? "dark" : "light"} style={styles.glassCard}>
              <Text style={styles.cardTitle}>{t('auth.login')}</Text>

              <View style={styles.form}>
                <Input
                  label={t('auth.email')}
                  placeholder="user@example.com"
                  value={email}
                  onChangeText={setEmail}
                  keyboardType="email-address"
                  icon="person"
                />
                <Input
                  label={t('auth.password')}
                  placeholder="••••••••"
                  value={password}
                  onChangeText={setPassword}
                  secureTextEntry
                  icon="lock"
                  rightElement={<ForgotLink />}
                />

                <Button
                  title={loading ? t('common.processing') : t('auth.login')}
                  onPress={handleLogin}
                  variant="primary"
                  disabled={loading}
                  icon={!loading ? "arrow_forward" : undefined}
                />
              </View>

              <View style={styles.footer}>
                <Text style={styles.footerText}>{t('auth.new_user')} </Text>
                <TouchableOpacity onPress={() => onNavigate && onNavigate('Register')}>
                  <Text style={styles.footerLink}>{t('auth.register_now')}</Text>
                </TouchableOpacity>
              </View>
            </BlurView>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const getStyles = (colors: any, isDark: boolean) => StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: colors.surface },
  flex: { flex: 1 },
  scrollContent: { flexGrow: 1, justifyContent: 'center', padding: 24 },
  blob: { position: 'absolute', borderRadius: 200, opacity: 0.5 },
  blobTopRight: { top: -100, right: -100, width: 300, height: 300, backgroundColor: isDark ? 'rgba(195, 212, 255, 0.08)' : 'rgba(0, 65, 143, 0.08)' },
  blobBottomLeft: { bottom: -100, left: -100, width: 250, height: 250, backgroundColor: isDark ? 'rgba(190, 210, 255, 0.1)' : 'rgba(75, 94, 134, 0.1)' },
  headerContainer: { alignItems: 'center', marginBottom: 40 },
  logoBox: { width: 64, height: 64, borderRadius: 20, backgroundColor: isDark ? '#1d3055' : '#eef4ff', alignItems: 'center', justifyContent: 'center', marginBottom: 16, overflow: 'hidden', ...Shadows.medium },
  logoImage: { width: '100%', height: '100%' },
  brandTitle: { ...Typography.heading, fontSize: 32, color: colors.primary, marginBottom: 4 },
  brandSubtitle: { ...Typography.body, fontSize: 14, color: colors.onSurfaceVariant },
  cardContainer: { borderRadius: 32, overflow: 'hidden', ...Shadows.medium },
  glassCard: { padding: 32, backgroundColor: isDark ? 'rgba(30, 30, 30, 0.8)' : 'rgba(255, 255, 255, 0.8)', borderWidth: 1, borderColor: isDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(255, 255, 255, 0.6)', borderRadius: 32 },
  cardTitle: { ...Typography.heading, fontSize: 24, color: colors.onSurface, marginBottom: 24 },
  form: { marginBottom: 16 },
  forgotText: { ...Typography.label, fontSize: 13, color: colors.primary },
  footer: { flexDirection: 'row', justifyContent: 'center', alignItems: 'center', marginTop: 24 },
  footerText: { ...Typography.body, fontSize: 14, color: colors.onSurfaceVariant },
  footerLink: { ...Typography.label, fontSize: 14, color: colors.primary },
});
