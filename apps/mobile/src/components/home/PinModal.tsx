import React, { useState } from 'react';
import { useTheme } from '../../context/ThemeContext';
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
  const { t } = useTheme();
  const [pin, setPin] = useState('');

  const handleSubmit = () => {
    if (pin.length < 4) {
      Alert.alert(t('common.error'), t('home.pin_min_length'));
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
            {isSettingPin ? t('home.create_pin') : t('home.enter_pin')}
          </Text>
          <Text style={styles.subtitle}>
            {isSettingPin 
              ? t('home.create_pin_desc')
              : t('home.enter_pin_desc')}
          </Text>
          
          <TextInput
            style={styles.input}
            value={pin}
            onChangeText={setPin}
            keyboardType="number-pad"
            secureTextEntry
            maxLength={6}
            placeholder={t('home.pin_placeholder')}
            autoFocus
          />
          
          <View style={styles.buttonContainer}>
            <TouchableOpacity style={styles.buttonCancel} onPress={handleClose}>
              <Text style={styles.buttonCancelText}>{t('common.cancel')}</Text>
            </TouchableOpacity>
            <TouchableOpacity 
              style={[styles.buttonSubmit, pin.length < 4 && { opacity: 0.5 }]} 
              onPress={handleSubmit}
              disabled={pin.length < 4}
            >
              <Text style={styles.buttonSubmitText}>{t('common.confirm')}</Text>
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
