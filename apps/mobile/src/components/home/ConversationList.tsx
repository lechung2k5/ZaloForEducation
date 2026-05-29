import React from 'react';
import { View, Text, ScrollView, TouchableOpacity, Image, ActivityIndicator } from 'react-native';
import { getStyles } from '../../screens/main/style/HomeScreen.styles';
import { Colors } from '../../constants/Theme';
import { Conversation } from '../../store/types';
import { useSecurityAlerts } from '../../hooks/useSecurityAlerts';
import { BOT_EMAIL } from '../../constants/bot';
import { useTheme } from '../../context/ThemeContext';

import { useAuth } from '../../context/AuthContext';

interface ConversationListProps {
  conversations: Conversation[];
  loading: boolean;
  currentUserEmail: string;
  userProfiles: Record<string, any>;
  tags: Array<{ id: string; name: string; color?: string }>;
  onSelectChat: (chat: Conversation) => void;
  onLongPressChat: (chat: Conversation, e: any) => void;
  getDisplayName: (email: string) => string;
  getDisplayAvatar: (email?: string) => any;
  getConversationPreview: (conv: Conversation) => string;
}

export const ConversationList: React.FC<ConversationListProps> = ({
  conversations,
  loading,
  currentUserEmail,
  userProfiles,
  tags,
  onSelectChat,
  onLongPressChat,
  getDisplayName,
  getDisplayAvatar,
  getConversationPreview,
}) => {
  const { colors, isDark, t } = useTheme();
  const styles = React.useMemo(() => getStyles(colors, isDark), [colors, isDark]);
  const { alerts, unreadCount: systemUnreadCount } = useSecurityAlerts();
  const { user } = useAuth();

  const showOnlineStatus = user?.showOnlineStatus !== false;

  const baseConversations = conversations
    .filter((chat) => {
      if (chat.hidden) return false;
      // Hide bot conversation from inbox list
      const hasBot = Array.isArray(chat.members) && chat.members.some((m: string) => {
        const normalized = String(m || "").toLowerCase();
        const lowerBotEmail = BOT_EMAIL.toLowerCase();
        return normalized === lowerBotEmail || normalized.includes(lowerBotEmail) || normalized.includes('bot@unichat.system');
      });
      if (hasBot) return false;
      return true;
    })
    .sort((left, right) => {
      const leftPinned = !!left.pinned;
      const rightPinned = !!right.pinned;
      if (leftPinned !== rightPinned) return leftPinned ? -1 : 1;

      const leftTime = left.updatedAt ? new Date(left.updatedAt).getTime() : 0;
      const rightTime = right.updatedAt ? new Date(right.updatedAt).getTime() : 0;
      return rightTime - leftTime;
    });

  if (loading && conversations.length === 0) {
    return (
      <View style={styles.centeredView}>
        <ActivityIndicator color={Colors.primary} />
        <Text style={styles.aiSubtitle}>{t('home.loading_conversations')}</Text>
      </View>
    );
  }

  const finalConversations = [...baseConversations];

  if (alerts.length > 0) {
    const systemConv = {
      id: "CONV#SYSTEM",
      name: t('home.security_alerts'),
      type: "system",
      avatar: { uri: "https://ui-avatars.com/api/?name=!&background=ba1a1a&color=fff&rounded=true&bold=true&font-size=0.6" },
      lastMessageContent: alerts[0].title,
      updatedAt: alerts[0].at,
      unreadCount: systemUnreadCount,
    };
    finalConversations.unshift(systemConv as any);
  }

  return (
    <ScrollView key="conversations-list-scroll" style={styles.scrollContainer}>
      <View style={styles.chatList}>
        {finalConversations.map((chat) => {
          const partnerEmail =
            chat.type === "direct"
              ? chat.partner ||
                (Array.isArray(chat.members)
                  ? chat.members.find((member: string) => member !== currentUserEmail)
                  : undefined)
              : undefined;
          
          const chatName =
            (chat as any).type === "system"
              ? chat.name
              : chat.type === "direct"
              ? (chat.alias || getDisplayName(partnerEmail || ''))
              : (chat.alias || chat.name || chat.id.slice(0, 6));
          
          const chatAvatar =
            (chat as any).type === "system"
              ? (chat as any).avatar
              : chat.type === "direct"
              ? getDisplayAvatar(partnerEmail)
              : chat.avatar ? { uri: chat.avatar } : getDisplayAvatar();
          
          const isMuted = !!chat.isMuted;
          const isUnread = !isMuted && (chat.unreadCount || 0) > 0;
          const hasMention = !isMuted && (!!chat.hasUnreadMention || (chat.mentionCount || 0) > 0);
          const preview = (chat as any).type === "system" ? (chat as any).lastMessageContent : getConversationPreview(chat);
          const displayPreview = hasMention && typeof preview === 'string' && !preview.startsWith('@ Bạn')
            ? `@ Bạn · ${preview}`
            : preview;
          const partnerProfile = partnerEmail ? userProfiles[partnerEmail] : null;
          const isOnline = showOnlineStatus && partnerProfile?.status === 'online';

          return (
            <TouchableOpacity
              key={chat.id}
              style={[
                styles.chatItem, 
                hasMention && styles.chatItemMentioned,
                chat.pinned && { backgroundColor: 'rgba(0, 82, 170, 0.04)', borderLeftWidth: 3, borderLeftColor: Colors.primary }
              ]}
              onPress={() => onSelectChat(chat)}
              onLongPress={(e) => onLongPressChat(chat, e)}
            >
              <View style={styles.avatarContainer}>
                <Image source={chatAvatar} style={styles.avatar} />
                {isOnline && <View style={styles.onlineBadge} />}
              </View>
              <View style={styles.chatInfo}>
                <View style={styles.chatHeader}>
                  <Text
                    style={[styles.chatName, isUnread && { fontWeight: '700', color: '#000' }]}
                    numberOfLines={1}
                  >
                    {chatName}
                  </Text>
                  <Text style={[styles.chatTime, isUnread && { color: Colors.primary, fontWeight: '600' }]}>
                    {chat.updatedAt
                      ? new Date(chat.updatedAt).toLocaleTimeString("vi-VN", {
                          hour: "2-digit",
                          minute: "2-digit",
                        })
                      : "--:--"}
                  </Text>
                </View>
                
                <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
                  <View style={{ flex: 1 }}>
                    <Text
                      style={[
                        styles.lastMsg,
                        isUnread && { color: '#000', fontWeight: '700', fontSize: 14 },
                        hasMention && styles.lastMsgMentioned,
                      ]}
                      numberOfLines={1}
                    >
                      {displayPreview}
                    </Text>
                  </View>

                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, flexShrink: 0 }}>
                    {hasMention && (
                      <View style={[styles.mentionPill, { marginTop: 0 }]}>
                        <Text style={styles.mentionPillText}>{`@ ${t('home.mention_you')}`}</Text>
                      </View>
                    )}
                    {isUnread && (
                      <View style={[styles.unreadBadgeStatic, { marginTop: 0 }]}>
                        <Text style={styles.unreadBadgeText}>
                          {chat.unreadCount > 99 ? '99+' : chat.unreadCount}
                        </Text>
                      </View>
                    )}
                    {chat.pinned && (
                      <Text style={{ fontFamily: 'Material Symbols Outlined', fontSize: 16, color: Colors.primary }}>
                        push_pin
                      </Text>
                    )}
                    {isMuted && (
                      <Text style={{ fontFamily: 'Material Symbols Outlined', fontSize: 16, color: Colors.outline }}>
                        notifications_off
                      </Text>
                    )}
                    {(chat as any).tagId && (
                      <View style={{ 
                        width: 10, 
                        height: 10, 
                        borderRadius: 2, 
                        backgroundColor: tags.find(t => t.id === (chat as any).tagId)?.color || '#ffb020' 
                      }} />
                    )}
                  </View>
                </View>
              </View>
            </TouchableOpacity>
          );
        })}
      </View>
    </ScrollView>
  );
};
