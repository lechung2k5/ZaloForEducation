import React, { useState, useRef } from 'react';
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
import { LinearGradient } from 'expo-linear-gradient';
import { BlurView } from 'expo-blur';
import Input from '../components/Input';
import Button from '../components/Button';
import { Colors, Typography, Shadows } from '../constants/Theme';

export default function LoginScreen({ onNavigate }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const deviceId = useRef(`${Platform.OS}-${Math.random().toString(36).slice(2)}`).current;

  const handleLogin = async () => {
    if (!email || !password) {
      Alert.alert('Lỗi', 'Vui lòng nhập đầy đủ email và mật khẩu!');
      return;
    }

    setLoading(true);
    const apiUrl = process.env.EXPO_PUBLIC_API_URL || 'http://localhost:3000';
    try {
      const response = await fetch(`${apiUrl}/auth/login`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ email, password, deviceId }),
      });

      const data = await response.json();
      
      if (response.ok) {
        if (onNavigate) onNavigate('home');
      } else {
        Alert.alert('Đăng nhập thất bại', data.message || 'Sai tài khoản hoặc mật khẩu');
      }
    } catch (error) {
      Alert.alert('Lỗi', 'Lỗi kết nối server: ' + error.message);
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
      {/* Background Decorative Blobs */}
      <View style={[styles.blob, styles.blobTopRight]} />
      <View style={[styles.blob, styles.blobBottomLeft]} />

      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.flex}
      >
        <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
          
          <View style={styles.headerContainer}>
            <LinearGradient
              colors={['#0058bc', '#00418f']}
              style={styles.logoBox}
            >
              <Text style={styles.logoIcon}>edu</Text>
            </LinearGradient>
            <Text style={styles.brandTitle}>ZaloEdu</Text>
            <Text style={styles.brandSubtitle}>Khai phóng tiềm năng tri thức</Text>
          </View>

          {/* Glass Card for Login */}
          <View style={styles.cardContainer}>
            <BlurView intensity={80} tint="light" style={styles.glassCard}>
              <Text style={styles.cardTitle}>Đăng nhập</Text>

              <View style={styles.form}>
                <Input
                  label="Email hoặc Tên đăng nhập"
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

              {/* Social Login Divider */}
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
                <Text style={styles.footerText}>Bạn mới sử dụng ZaloEdu? </Text>
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
  safeArea: {
    flex: 1,
    backgroundColor: Colors.surface,
  },
  flex: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    justifyContent: 'center',
    padding: 24,
  },
  blob: {
    position: 'absolute',
    borderRadius: 200,
    opacity: 0.5,
  },
  blobTopRight: {
    top: -100,
    right: -100,
    width: 300,
    height: 300,
    backgroundColor: 'rgba(0, 65, 143, 0.08)',
  },
  blobBottomLeft: {
    bottom: -100,
    left: -100,
    width: 250,
    height: 250,
    backgroundColor: 'rgba(75, 94, 134, 0.1)',
  },
  headerContainer: {
    alignItems: 'center',
    marginBottom: 40,
  },
  logoBox: {
    width: 64,
    height: 64,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
    ...Shadows.glow,
  },
  logoIcon: {
    color: '#ffffff',
    ...Typography.heading,
    fontSize: 20,
  },
  brandTitle: {
    ...Typography.heading,
    fontSize: 32,
    color: Colors.primary,
    marginBottom: 4,
  },
  brandSubtitle: {
    ...Typography.body,
    fontSize: 14,
    color: Colors.onSurfaceVariant,
  },
  cardContainer: {
    borderRadius: 32,
    overflow: 'hidden',
    ...Shadows.medium,
  },
  glassCard: {
    padding: 32,
    backgroundColor: 'rgba(255, 255, 255, 0.8)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.6)',
    borderRadius: 32,
  },
  cardTitle: {
    ...Typography.heading,
    fontSize: 24,
    color: Colors.onSurface,
    marginBottom: 24,
  },
  form: {
    marginBottom: 16,
  },
  forgotText: {
    ...Typography.label,
    fontSize: 13,
    color: Colors.primary,
  },
  dividerContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: 24,
  },
  dividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: Colors.outlineVariant,
    opacity: 0.5,
  },
  dividerText: {
    ...Typography.body,
    fontSize: 13,
    color: Colors.onSurfaceVariant,
    marginHorizontal: 16,
  },
  footer: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 24,
  },
  footerText: {
    ...Typography.body,
    fontSize: 14,
    color: Colors.onSurfaceVariant,
  },
  footerLink: {
    ...Typography.label,
    fontSize: 14,
    color: Colors.primary,
  },
});
