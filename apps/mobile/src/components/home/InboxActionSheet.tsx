import React from 'react';
import { useTheme } from '../../context/ThemeContext';
import { View, Text, TouchableOpacity, Pressable, StyleSheet } from 'react-native';
import { Colors } from '../../constants/Theme';
import { useChatStore } from '../../store/chatStore';

interface InboxActionSheetProps {
  isVisible: boolean;
  conversation: any;
  onClose: () => void;
  onPin: (convId: string, currentPinStatus: boolean) => void;
  onClassify: (convId: string) => void;
  onHideToggle: (convId: string, currentHiddenStatus: boolean) => void;
  onManageTags: () => void;
}

export const InboxActionSheet: React.FC<InboxActionSheetProps> = ({
  isVisible,
  conversation,
  onClose,
  onPin,
  onClassify,
  onHideToggle,
  onManageTags,
}) => {
  const { t } = useTheme();
  if (!isVisible || !conversation) return null;

  const isPinned = !!conversation.pinned;
  const { hiddenConversations } = useChatStore();
  const isHidden = !!hiddenConversations[conversation.id];

  return (
    <Pressable style={styles.overlay} onPress={onClose}>
      <Pressable style={styles.actionSheet} onPress={(e) => e.stopPropagation()}>
        <View style={styles.header}>
          <Text style={styles.headerText} numberOfLines={1}>{conversation.alias || conversation.name || t('home.chat_options')}</Text>
        </View>

        <View style={styles.actionList}>
          <TouchableOpacity style={styles.actionListItem} onPress={() => onPin(conversation.id, isPinned)}>
            <Text style={[styles.actionListIcon, { color: Colors.primary }]}>push_pin</Text>
            <Text style={[styles.actionListText, { color: Colors.primary }]}>
              {isPinned ? t('home.unpin') : t('home.pin_chat')}
            </Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.actionListItem} onPress={() => onClassify(conversation.id)}>
            <Text style={styles.actionListIcon}>sell</Text>
            <Text style={styles.actionListText}>{t('home.classify')}</Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.actionListItem} onPress={() => onHideToggle(conversation.id, isHidden)}>
            <Text style={[styles.actionListIcon, { color: '#ef4444' }]}>lock</Text>
            <Text style={[styles.actionListText, { color: '#ef4444' }]}>
              {isHidden ? t('home.unlock_chat') : t('home.lock_chat')}
            </Text>
          </TouchableOpacity>

          <View style={styles.divider} />

          <TouchableOpacity style={styles.actionListItem} onPress={onManageTags}>
            <Text style={styles.actionListIcon}>sell</Text>
            <Text style={styles.actionListText}>{t('home.manage_tags')}</Text>
          </TouchableOpacity>
        </View>
      </Pressable>
    </Pressable>
  );
};

const styles = StyleSheet.create({
  overlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.4)',
    justifyContent: 'flex-end',
    zIndex: 100,
  },
  actionSheet: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingBottom: 32,
    paddingTop: 16,
    paddingHorizontal: 16,
  },
  header: {
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
    marginBottom: 8,
    alignItems: 'center',
  },
  headerText: {
    fontFamily: 'PlusJakartaSans_600SemiBold',
    fontSize: 16,
    color: Colors.onBackground,
  },
  actionList: {
    marginTop: 8,
  },
  actionListItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
    paddingHorizontal: 8,
  },
  actionListIcon: {
    fontFamily: 'Material Symbols Outlined',
    fontSize: 24,
    color: Colors.onSurfaceVariant,
    marginRight: 16,
  },
  actionListText: {
    fontFamily: 'PlusJakartaSans_500Medium',
    fontSize: 15,
    color: Colors.onBackground,
  },
  divider: {
    height: 1,
    backgroundColor: '#f0f0f0',
    marginVertical: 8,
  }
});
