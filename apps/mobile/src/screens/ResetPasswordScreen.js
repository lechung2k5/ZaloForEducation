import React, { useState, useEffect } from 'react';
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

export default function ResetPasswordScreen({ onNavigate }) {
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [token, setToken] = useState('');
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    // Lấy token từ URL (Dùng cho bản Web)
    if (Platform.OS === 'web') {
      const urlParams = new URLSearchParams(window.location.search);
      const tokenParam = urlParams.get('token');
      if (tokenParam) {
        setToken(tokenParam);
      } else {
        Alert.alert('Lỗi', 'Liên kết không hợp lệ: Thiếu mã xác thực (Token)');
      }
    }
  }, []);

  const handleReset = async () => {
    if (!token) {
      Alert.alert('Lỗi', 'Không tìm thấy Token. Vui lòng nhấn lại vào link trong Gmail.');
      return;
    }
    if (newPassword !== confirmPassword) {
      Alert.alert('Lỗi', 'Mật khẩu xác nhận không khớp!');
      return;
    }

    setLoading(true);
    const apiUrl = process.env.EXPO_PUBLIC_API_URL || 'http://localhost:3000';
    try {
      const response = await fetch(`${apiUrl}/auth/reset-password`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ token, newPassword }),
      });

      const data = await response.json();
      if (response.ok) {
        setSuccess(true);
      } else {
        Alert.alert('Lỗi', data.message);
      }
    } catch (error) {
      Alert.alert('Lỗi', 'Lỗi kết nối server: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  if (success) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.scrollContent}>
          <View style={styles.card}>
            <View style={styles.successIcon}>
              <Text style={styles.successEmoji}>✅</Text>
            </View>
            <Text style={styles.title}>Thành công!</Text>
            <Text style={styles.subtitle}>Mật khẩu của bạn đã được thay đổi.</Text>
            <Button title="Đăng nhập ngay" onPress={() => onNavigate('login')} variant="primary" />
          </View>
        </View>
      </SafeAreaView>
    );
  }

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
              <Text style={styles.title}>Mật khẩu mới</Text>
              <Text style={styles.subtitle}>Nhập mật khẩu mới cho tài khoản của bạn</Text>
            </View>

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
              <Button 
                title={loading ? "Đang cập nhật..." : "Đổi mật khẩu"} 
                onPress={handleReset} 
                variant="primary" 
              />
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
    padding: 32,
    width: '100%',
    maxWidth: 400,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.1,
    shadowRadius: 24,
    elevation: 8,
    alignItems: 'center',
  },
  brandBar: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 24,
  },
  logoCircle: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#135bec',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 8,
  },
  logoText: {
    color: '#fff',
    fontWeight: '800',
    fontSize: 16,
  },
  brandName: {
    fontSize: 18,
    fontWeight: '700',
    color: '#111318',
  },
  titleSection: {
    marginBottom: 24,
    width: '100%',
  },
  title: {
    fontSize: 24,
    fontWeight: '800',
    color: '#111318',
    marginBottom: 6,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 14,
    color: '#6b7280',
    textAlign: 'center',
  },
  form: {
    width: '100%',
  },
  successIcon: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: '#ecfdf5',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  successEmoji: {
    fontSize: 32,
  },
});
