import AsyncStorage from '@react-native-async-storage/async-storage';
import { LinearGradient } from 'expo-linear-gradient';
import React from 'react';
import {
    ScrollView,
    StatusBar,
    StyleSheet,
    Text,
    TouchableOpacity,
    View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Typography } from '../constants/Theme';

const EXPIRE_IN_MS = 24 * 60 * 60 * 1000;

const FEELING_GROUPS = [
  {
    title: 'Feelings',
    items: [
      { icon: '☀️', label: 'Hopeful' },
      { icon: '🔥', label: 'Fighting' },
      { icon: '😀', label: 'Happy' },
      { icon: '🍀', label: 'Lucky' },
      { icon: '❤️', label: 'In Love' },
      { icon: '😮', label: 'Surprised' },
      { icon: '😞', label: 'Sad' },
      { icon: '😒', label: 'Low mood' },
      { icon: '😠', label: 'Angry' },
      { icon: '😴', label: 'Sleepy' },
      { icon: '🔋', label: 'Low battery' },
      { icon: '⏳', label: 'Lag...lag' },
    ],
  },
  {
    title: 'Study & Work',
    items: [
      { icon: '💻', label: 'Hardworking' },
      { icon: '📖', label: 'Reading' },
      { icon: '🚫', label: 'Do not disturb!' },
      { icon: '🤔', label: 'Thinking' },
      { icon: '😵', label: 'Stuck' },
      { icon: '📅', label: 'Day off' },
      { icon: '😫', label: 'Exhausted' },
    ],
  },
  {
    title: 'Activities',
    items: [
      { icon: '🏃', label: 'Runnnn!' },
      { icon: '🤒', label: 'Sick' },
      { icon: '🙏', label: 'Pray' },
      { icon: '🍽️', label: 'Eating' },
      { icon: '☕', label: 'Coffee time' },
      { icon: '🎮', label: 'Gaming' },
      { icon: '🎵', label: 'Listening to music' },
      { icon: '🎬', label: 'Watching movie' },
    ],
  },
];

export default function StatusPickerScreen({ onNavigate }) {
  const applyFeeling = async (label) => {
    const storage = AsyncStorage.default || AsyncStorage;
    const raw = await storage.getItem('user');
    const current = raw ? JSON.parse(raw) : {};

    const nextUser = {
      ...current,
      currentFeeling: label,
      feelingMessage: label,
      feelingExpiresAt: Date.now() + EXPIRE_IN_MS,
      currentStatus: label,
      statusMessage: label,
      statusExpiresAt: Date.now() + EXPIRE_IN_MS,
    };

    await storage.setItem('user', JSON.stringify(nextUser));
    onNavigate('home-me');
  };

  const clearFeeling = async () => {
    const storage = AsyncStorage.default || AsyncStorage;
    const raw = await storage.getItem('user');
    const current = raw ? JSON.parse(raw) : {};

    const nextUser = {
      ...current,
      currentFeeling: '',
      feelingMessage: '',
      feelingExpiresAt: null,
      currentStatus: '',
      statusMessage: '',
      statusExpiresAt: null,
    };

    await storage.setItem('user', JSON.stringify(nextUser));
    onNavigate('home-me');
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar barStyle="light-content" />
      <LinearGradient colors={['#496e9a', '#9f7480']} style={styles.gradient}>
        <View style={styles.header}>
          <TouchableOpacity style={styles.closeButton} onPress={() => onNavigate('home-me')}>
            <Text style={styles.closeIcon}>✕</Text>
          </TouchableOpacity>
          <View>
            <Text style={styles.headerTitle}>Add feeling</Text>
            <Text style={styles.headerSubtitle}>Visible for 24 hours</Text>
          </View>
        </View>

        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>
          {FEELING_GROUPS.map((group) => (
            <View key={group.title} style={styles.sectionWrap}>
              <Text style={styles.sectionTitle}>{group.title}</Text>
              <View style={styles.gridCard}>
                {group.items.map((item) => (
                  <TouchableOpacity
                    key={`${group.title}-${item.label}`}
                    style={styles.statusItem}
                    onPress={() => applyFeeling(item.label)}
                    activeOpacity={0.85}
                  >
                    <Text style={styles.statusIcon}>{item.icon}</Text>
                    <Text style={styles.statusLabel}>{item.label}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>
          ))}

          <TouchableOpacity style={styles.clearButton} onPress={clearFeeling}>
            <Text style={styles.clearButtonText}>Clear current feeling</Text>
          </TouchableOpacity>
        </ScrollView>
      </LinearGradient>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#496e9a',
  },
  gradient: {
    flex: 1,
  },
  header: {
    paddingTop: 10,
    paddingHorizontal: 16,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  closeButton: {
    width: 34,
    height: 34,
    alignItems: 'center',
    justifyContent: 'center',
  },
  closeIcon: {
    fontSize: 28,
    color: '#fff',
  },
  headerTitle: {
    ...Typography.heading,
    fontSize: 34,
    color: '#fff',
  },
  headerSubtitle: {
    ...Typography.body,
    color: 'rgba(255,255,255,0.88)',
    fontSize: 20,
  },
  scrollContent: {
    paddingHorizontal: 16,
    paddingBottom: 28,
  },
  sectionWrap: {
    marginTop: 16,
  },
  sectionTitle: {
    ...Typography.heading,
    color: '#fff',
    fontSize: 23,
    marginBottom: 10,
  },
  gridCard: {
    borderRadius: 16,
    paddingVertical: 10,
    paddingHorizontal: 8,
    backgroundColor: 'rgba(40, 54, 85, 0.28)',
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  statusItem: {
    width: '25%',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    paddingHorizontal: 4,
  },
  statusIcon: {
    fontSize: 36,
    color: '#fff',
    marginBottom: 6,
  },
  statusLabel: {
    ...Typography.body,
    color: '#fff',
    fontSize: 14,
    textAlign: 'center',
  },
  clearButton: {
    marginTop: 16,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.45)',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 11,
  },
  clearButtonText: {
    ...Typography.label,
    color: '#fff',
    fontSize: 14,
  },
});
