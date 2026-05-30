import React, { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, Modal, StyleSheet, KeyboardAvoidingView, Platform, Alert } from 'react-native';
import { Colors } from '../../constants/Theme';

interface PinModalProps {
  isVisible: boolean;
  isSettingPin?: boolean;
  onClose: () => void;
  onSubmit: (pin: string) => void;
}

export const PinModal: React.FC<PinModalProps> = ({
  isVisible,
  isSettingPin = false,
  onClose,
  onSubmit,
}) => {
  const [pin, setPin] = useState('');

  const handleSubmit = () => {
    if (pin.length < 4) {
      Alert.alert("Lỗi", "Mã PIN phải có ít nhất 4 ký tự");
      return;
    }
    onSubmit(pin);
    setPin('');
  };

  const handleClose = () => {
    setPin('');
    onClose();
  };

  return (
    <Modal visible={isVisible} transparent animationType="fade">
      <KeyboardAvoidingView 
        style={styles.overlay} 
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <View style={styles.modalContent}>
          <Text style={styles.title}>
            {isSettingPin ? "Tạo mã PIN để khóa" : "Nhập mã PIN để mở khóa"}
          </Text>
          <Text style={styles.subtitle}>
            {isSettingPin 
              ? "Trò chuyện này sẽ bị ẩn khỏi danh sách. Bạn cần nhập mã PIN để mở lại."
              : "Vui lòng nhập mã PIN đã cài đặt để mở khóa trò chuyện."}
          </Text>
          
          <TextInput
            style={styles.input}
            value={pin}
            onChangeText={setPin}
            keyboardType="number-pad"
            secureTextEntry
            maxLength={6}
            placeholder="Nhập mã PIN (4-6 số)"
            autoFocus
          />
          
          <View style={styles.buttonContainer}>
            <TouchableOpacity style={styles.buttonCancel} onPress={handleClose}>
              <Text style={styles.buttonCancelText}>Hủy</Text>
            </TouchableOpacity>
            <TouchableOpacity 
              style={[styles.buttonSubmit, pin.length < 4 && { opacity: 0.5 }]} 
              onPress={handleSubmit}
              disabled={pin.length < 4}
            >
              <Text style={styles.buttonSubmitText}>Xác nhận</Text>
            </TouchableOpacity>
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContent: {
    backgroundColor: '#fff',
    width: '85%',
    borderRadius: 16,
    padding: 24,
    alignItems: 'center',
  },
  title: {
    fontFamily: 'PlusJakartaSans_700Bold',
    fontSize: 18,
    color: Colors.onBackground,
    marginBottom: 8,
  },
  subtitle: {
    fontFamily: 'PlusJakartaSans_400Regular',
    fontSize: 14,
    color: Colors.onSurfaceVariant,
    textAlign: 'center',
    marginBottom: 20,
  },
  input: {
    width: '100%',
    height: 48,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    borderRadius: 8,
    paddingHorizontal: 16,
    fontSize: 16,
    fontFamily: 'PlusJakartaSans_500Medium',
    letterSpacing: 8,
    textAlign: 'center',
    marginBottom: 24,
  },
  buttonContainer: {
    flexDirection: 'row',
    width: '100%',
    gap: 12,
  },
  buttonCancel: {
    flex: 1,
    height: 44,
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#f3f4f6',
  },
  buttonCancelText: {
    fontFamily: 'PlusJakartaSans_600SemiBold',
    fontSize: 15,
    color: Colors.onBackground,
  },
  buttonSubmit: {
    flex: 1,
    height: 44,
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: Colors.primary,
  },
  buttonSubmitText: {
    fontFamily: 'PlusJakartaSans_600SemiBold',
    fontSize: 15,
    color: '#fff',
  }
});
