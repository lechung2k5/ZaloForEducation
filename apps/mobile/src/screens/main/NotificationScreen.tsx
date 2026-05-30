import React, { useEffect, useCallback, useState } from "react";
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  RefreshControl,
  SafeAreaView
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { useTheme } from '../../context/ThemeContext';
import { useChatStore } from '../../store/chatStore';
import { getSecurityAlerts, markAllSecurityAlertsRead } from '../../utils/securityAlerts';

interface NotificationScreenProps {
  onNavigate: (screen: string, params?: any) => void;
}

interface NotificationItem {
  id: string;
  title: string;
  message: string;
  at: string | number;
  read: boolean;
  category: 'message' | 'security';
  metadata?: {
    conversationId?: string;
    messageId?: string;
  };
}

export default function NotificationScreen({ onNavigate }: NotificationScreenProps) {
  const { colors, t, isDark } = useTheme();
  const styles = React.useMemo(() => getStyles(colors, isDark), [colors, isDark]);
  const { notifications, markNotificationsRead } = useChatStore();
  const [securityAlerts, setSecurityAlerts] = useState<any[]>([]);
  const [refreshing, setRefreshing] = useState(false);

  const loadData = useCallback(async () => {
    const alerts = await getSecurityAlerts();
    setSecurityAlerts(alerts);
  }, []);

  useEffect(() => {
    loadData();
    markNotificationsRead(); // Mark message notifications read when viewing screen
    markAllSecurityAlertsRead(); // Mark security alerts read
  }, [loadData, markNotificationsRead]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await loadData();
    setRefreshing(false);
  }, [loadData]);

  // Merge message notifications and security alerts, sorted by time
  const allNotifications: NotificationItem[] = [
    ...(notifications || []).map(n => ({ ...n, category: 'message' as const })),
    ...(securityAlerts || []).map(a => ({ ...a, category: 'security' as const }))
  ].sort((a, b) => new Date(b.at).getTime() - new Date(a.at).getTime());

  const handlePress = (item: NotificationItem) => {
    if (item.category === 'message' && item.metadata?.conversationId) {
      // Use Deep-link logic: Navigate to chat and scroll to messageId
      onNavigate('Chat', { 
        conversationId: item.metadata.conversationId,
        targetMessageId: item.metadata.messageId 
      });
    }
    // Security alerts might just show detail or do nothing for now
  };

  const renderItem = ({ item }: { item: NotificationItem }) => (
    <TouchableOpacity 
      style={[styles.card, !item.read && styles.unreadCard]} 
      onPress={() => handlePress(item)}
    >
      <View style={styles.cardHeader}>
        <Text style={styles.cardType}>
          {item.category === 'security' ? t('notifications.security') : t('notifications.message')}
        </Text>
        {!item.read && <View style={styles.unreadDot} />}
      </View>
      <Text style={styles.cardTitle}>{item.title}</Text>
      <Text style={styles.cardMessage} numberOfLines={2}>{item.message}</Text>
      <Text style={styles.cardTime}>{new Date(item.at).toLocaleString('vi-VN')}</Text>
    </TouchableOpacity>
  );

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>{t('notifications.title')}</Text>
      </View>
      
      <FlatList
        data={allNotifications}
        renderItem={renderItem}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.list}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={[colors.primary]} />
        }
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Text style={styles.emptyIcon}>notifications_off</Text>
            <Text style={styles.emptyText}>{t('notifications.empty')}</Text>
          </View>
        }
      />
    </SafeAreaView>
  );
}

const getStyles = (colors: any, isDark: boolean) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  header: {
    padding: 16,
    backgroundColor: colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: colors.outlineVariant,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: colors.onSurface,
  },
  list: {
    padding: 16,
  },
  card: {
    backgroundColor: colors.surface,
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: colors.outlineVariant,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
  },
  unreadCard: {
    backgroundColor: colors.primaryContainer,
    borderColor: colors.outlineVariant,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  cardType: {
    fontSize: 10,
    fontWeight: '700',
    color: colors.primary,
    letterSpacing: 0.5,
  },
  unreadDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.primary,
  },
  cardTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: colors.onSurface,
    marginBottom: 2,
  },
  cardMessage: {
    fontSize: 14,
    color: colors.onSurfaceVariant,
    lineHeight: 20,
  },
  cardTime: {
    fontSize: 11,
    color: colors.outline,
    marginTop: 8,
  },
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 100,
  },
  emptyIcon: {
    fontFamily: 'Material Symbols Outlined',
    fontSize: 48,
    color: colors.outlineVariant,
    marginBottom: 12,
  },
  emptyText: {
    fontSize: 16,
    color: colors.outline,
  },
});
