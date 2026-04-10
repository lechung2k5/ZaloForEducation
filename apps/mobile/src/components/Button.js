import React from 'react';
import { TouchableOpacity, Text, StyleSheet, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Colors, Typography } from '../constants/Theme';

export default function Button({ onPress, title, variant = 'primary', disabled, icon }) {
  const isPrimary = variant === 'primary';

  if (isPrimary) {
    return (
      <TouchableOpacity
        onPress={onPress}
        activeOpacity={0.85}
        disabled={disabled}
        style={[styles.base, disabled && styles.disabled]}
      >
        <LinearGradient
          colors={['#0058bc', '#00418f']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.gradient}
        >
          <View style={styles.innerGlow} />
          {icon && <Text style={styles.iconPrimary}>{icon}</Text>}
          <Text style={[styles.text, styles.textPrimary]}>{title}</Text>
        </LinearGradient>
      </TouchableOpacity>
    );
  }

  return (
    <TouchableOpacity
      style={[styles.base, styles.secondary, disabled && styles.disabled]}
      onPress={onPress}
      activeOpacity={0.85}
      disabled={disabled}
    >
      {icon && <Text style={styles.iconSecondary}>{icon}</Text>}
      <Text style={[styles.text, styles.textSecondary]}>{title}</Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  base: {
    width: '100%',
    marginBottom: 16,
    borderRadius: 16,
    overflow: 'hidden',
  },
  gradient: {
    paddingVertical: 18,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    position: 'relative',
  },
  innerGlow: {
    ...StyleSheet.absoluteFillObject,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255, 255, 255, 0.2)',
    borderRadius: 16,
  },
  disabled: {
    opacity: 0.5,
  },
  secondary: {
    backgroundColor: Colors.surfaceContainerHighest,
    paddingVertical: 18,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
  },
  text: {
    ...Typography.heading,
    fontSize: 16,
  },
  textPrimary: {
    color: '#ffffff',
  },
  textSecondary: {
    color: Colors.primary,
  },
  iconPrimary: {
    color: '#ffffff',
    fontSize: 20,
    marginRight: 8,
  },
  iconSecondary: {
    color: Colors.primary,
    fontSize: 20,
    marginRight: 8,
  }
});
