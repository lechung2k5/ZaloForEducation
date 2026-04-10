import React from 'react';
import { TouchableOpacity, Text, StyleSheet } from 'react-native';

export default function Button({ onPress, title, variant = 'primary' }) {
  const isPrimary = variant === 'primary';

  return (
    <TouchableOpacity
      style={[styles.base, isPrimary ? styles.primary : styles.secondary]}
      onPress={onPress}
      activeOpacity={0.85}
    >
      <Text style={[styles.text, isPrimary ? styles.textPrimary : styles.textSecondary]}>
        {title}
      </Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  base: {
    width: '100%',
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
    marginBottom: 12,
  },
  primary: {
    backgroundColor: '#135bec',
    shadowColor: '#135bec',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 6,
  },
  secondary: {
    backgroundColor: '#ffffff',
    borderWidth: 1.5,
    borderColor: '#135bec',
  },
  text: {
    fontWeight: '700',
    fontSize: 15,
  },
  textPrimary: {
    color: '#ffffff',
  },
  textSecondary: {
    color: '#135bec',
  },
});
