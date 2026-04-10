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
import Input from '../components/Input';
import Button from '../components/Button';

export default function LoginScreen({ onNavigate }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  // Tạo deviceId cố định cho thiết bị này (dùng để quản lý phiên 1 thiết bị)
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
        // Alert.alert('Thành công', 'Đăng nhập thành công!'); 
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
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.flex}
      >
        <ScrollView contentContainerStyle={styles.scrollContent}>
          <View style={styles.card}>
            {/* Header / Logo */}
            <View style={styles.brandBar}>
              <View style={styles.logoCircle}>
                <Text style={styles.logoText}>Z</Text>
              </View>
              <Text style={styles.brandName}>ZaloEdu</Text>
            </View>

            {/* Title */}
            <View style={styles.titleSection}>
              <Text style={styles.title}>Đăng nhập</Text>
              <Text style={styles.subtitle}>
                Chào mừng bạn quay lại hệ thống ZaloEdu
              </Text>
            </View>

            {/* Form */}
            <View style={styles.form}>
              <Input
                label="Email"
                placeholder="email@example.com"
                value={email}
                onChangeText={setEmail}
                keyboardType="email-address"
              />
              <Input
                label="Mật khẩu"
                placeholder="••••••••"
                value={password}
                onChangeText={setPassword}
                secureTextEntry
                rightElement={<ForgotLink />}
              />
              <Button 
                title={loading ? "Đang xử lý..." : "Đăng nhập"} 
                onPress={handleLogin} 
                variant="primary" 
              />
            </View>

            {/* Register Link */}
            <View style={styles.footer}>
              <Text style={styles.footerText}>Chưa có tài khoản? </Text>
              <TouchableOpacity onPress={handleRegister}>
                <Text style={styles.footerLink}>Đăng ký ngay</Text>
              </TouchableOpacity>
            </View>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#f0f2f5',
  },
  flex: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  card: {
    backgroundColor: '#ffffff',
    borderRadius: 20,
    padding: 40,
    width: '100%',
    maxWidth: 440,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.1,
    shadowRadius: 24,
    elevation: 8,
  },
  brandBar: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 32,
    justifyContent: 'center',
  },
  logoCircle: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#135bec',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  logoText: {
    color: '#fff',
    fontWeight: '800',
    fontSize: 20,
  },
  brandName: {
    fontSize: 24,
    fontWeight: '800',
    color: '#111318',
  },
  titleSection: {
    marginBottom: 32,
    alignItems: 'center',
  },
  title: {
    fontSize: 32,
    fontWeight: '900',
    color: '#111318',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 15,
    color: '#6b7280',
  },
  form: {
    marginBottom: 16,
  },
  forgotText: {
    fontSize: 13,
    color: '#135bec',
    fontWeight: '600',
  },
  footer: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 16,
  },
  footerText: {
    fontSize: 15,
    color: '#6b7280',
  },
  footerLink: {
    fontSize: 15,
    color: '#135bec',
    fontWeight: '700',
  },
});
