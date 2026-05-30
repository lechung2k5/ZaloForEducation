import AsyncStorage from '@react-native-async-storage/async-storage';
import React, { useEffect, useState } from 'react';
import { 
  View, 
  Text, 
  StyleSheet, 
  ScrollView, 
  TouchableOpacity, 
  Image, 
  Modal,
  TextInput,
  Alert,
  Dimensions,
  ActivityIndicator
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import * as Clipboard from 'expo-clipboard';
import QRCode from 'react-native-qrcode-svg';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { Colors } from '../../constants/Theme';
import { useChatStore } from '../../store/chatStore';
import { useAuth } from '../../context/AuthContext';
import { useTheme } from '../../context/ThemeContext';
import { chatUpload } from '../../utils/api';
import { normalizeAttachment } from '../../store/chatHelpers';
import { chatPatch, chatPost, chatGet } from '../../utils/api';
import { pushSecurityAlert } from '../../utils/securityAlerts';
import { ASSETS } from '../../utils/assets';
import {
  CHAT_WALLPAPERS,
  DEFAULT_CHAT_WALLPAPER_ID,
  getConversationWallpaperId,
  setConversationWallpaperId,
  type ChatWallpaperId,
} from '../../utils/chatWallpapers';
import {
  createCustomWindowMuteSchedule,
  createMuteUntilHours,
  createMuteUntilMorning,
  getMuteLabel,
  isValidTimeString,
} from '../../utils/chatUtils';
import { useContacts } from '../../hooks/queries/useContacts';
import { friendEmailOf } from '../../utils/contactUtils';

const { width } = Dimensions.get('window');
const ASSET_PREVIEW_LIMIT = 5;

const formatBytes = (value?: number) => {
  const bytes = Number(value || 0);
  if (!bytes) return 'Không rõ dung lượng';
  const units = ['B', 'KB', 'MB', 'GB'];
  let size = bytes;
  let unitIndex = 0;
  while (size >= 1024 && unitIndex < units.length - 1) {
    size /= 1024;
    unitIndex += 1;
  }
  return `${size.toFixed(unitIndex === 0 ? 0 : 1)} ${units[unitIndex]}`;
};

const getHostName = (url: string) => {
  try {
    return new URL(url).hostname.replace(/^www\./, '');
  } catch {
    return url.replace(/^https?:\/\//, '').split('/')[0] || 'Liên kết';
  }
};

const avatarSource = (avatar?: string | null) => {
  return avatar ? { uri: avatar } : ASSETS.DEFAULT_AVATAR;
};

const WALLPAPERS = [
  { key: 'default', label: 'Mặc định', color: '#ffffff' },
  { key: 'sky', label: 'Xanh trời', color: '#eef6ff' },
  { key: 'mint', label: 'Xanh mint', color: '#f0fdf4' },
  { key: 'slate', label: 'Xám dịu', color: '#f8fafc' },
] as const;

const CHAT_PINNED_CONVERSATIONS_KEY = 'chat_pinned_conversations_v1';
const CHAT_HIDDEN_CONVERSATIONS_KEY = 'chat_hidden_conversations_v1';
const CHAT_ALIAS_CONVERSATIONS_KEY = 'chat_alias_conversations_v1';
const CHAT_AUTO_DELETE_KEY = 'chat_auto_delete_v1';
const CHAT_MUTE_SCHEDULE_KEY = 'chat_notification_mute_schedule_v1';
const AUTO_DELETE_OPTIONS = [
  { label: 'Không tự xóa', days: 0 },
  { label: '1 ngày', days: 1 },
  { label: '7 ngày', days: 7 },
  { label: '30 ngày', days: 30 }
] as const;

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingBottom: 12,
    backgroundColor: Colors.primary,
  },
  backBtn: {
    padding: 8,
  },
  headerIcon: {
    fontFamily: 'Material Symbols Outlined',
    fontSize: 22,
    color: '#fff',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#fff',
  },
  profileBox: {
    alignItems: 'center',
    paddingTop: 30,
    paddingBottom: 20,
  },
  largeAvatar: {
    width: 100,
    height: 100,
    borderRadius: 50,
    marginBottom: 16,
  },
  avatarEditBadge: {
    position: 'absolute',
    right: 0,
    bottom: 16,
    backgroundColor: '#f1f5f9',
    width: 32,
    height: 32,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#fff',
    elevation: 2,
  },
  avatarEditIcon: {
    fontFamily: 'Material Symbols Outlined',
    fontSize: 18,
    color: '#475569',
  },
  profileName: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#1f2631',
    marginBottom: 24,
  },
  quickActions: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    width: '100%',
    paddingHorizontal: 20,
  },
  actionItem: {
    alignItems: 'center',
    width: Dimensions.get('window').width / 4 - 20,
  },
  actionCircle: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#f1f5f9',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 8,
  },
  actionIcon: {
    fontFamily: 'Material Symbols Outlined',
    fontSize: 24,
    color: '#475569',
  },
  actionLabel: {
    fontSize: 12,
    color: '#475569',
    textAlign: 'center',
    fontWeight: '500',
  },
  divider: {
    height: 8,
    backgroundColor: '#f1f5f9',
  },
  sectionHeader: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#fff',
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: 'bold',
    color: Colors.primary,
  },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 14,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#f1f5f9',
  },
  menuLeft: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  menuIcon: {
    fontFamily: 'Material Symbols Outlined',
    fontSize: 22,
    marginRight: 16,
    color: '#475569',
  },
  menuText: {
    fontSize: 16,
    color: '#1f2631',
    fontWeight: '500',
  },
  chevron: {
    fontFamily: 'Material Symbols Outlined',
    fontSize: 20,
    color: '#cbd5e1',
  },
  subText: {
    fontSize: 14,
    color: '#94a3b8',
  },
  mediaRow: {
    backgroundColor: '#fff',
    paddingBottom: 14,
  },
  mediaHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  mediaPreview: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    gap: 8,
  },
  previewImg: {
    width: (Dimensions.get('window').width - 72) / 5,
    height: (Dimensions.get('window').width - 72) / 5,
    borderRadius: 8,
    backgroundColor: '#f1f5f9',
  },
  previewMore: {
    width: (Dimensions.get('window').width - 72) / 5,
    height: (Dimensions.get('window').width - 72) / 5,
    borderRadius: 8,
    backgroundColor: '#f1f5f9',
    justifyContent: 'center',
    alignItems: 'center',
  },
  assetSummaryRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 16,
    marginBottom: 12,
  },
  assetSummaryPill: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
    backgroundColor: '#f1f5f9',
  },
  assetSummaryIcon: {
    fontFamily: 'Material Symbols Outlined',
    fontSize: 15,
    color: '#475569',
    marginRight: 4,
  },
  assetSummaryText: {
    fontSize: 12,
    color: '#475569',
    fontWeight: '600',
  },
  assetThumb: {
    width: (Dimensions.get('window').width - 72) / 5,
    height: (Dimensions.get('window').width - 72) / 5,
    borderRadius: 10,
    overflow: 'hidden',
    backgroundColor: '#f1f5f9',
  },
  assetThumbImage: {
    width: '100%',
    height: '100%',
  },
  assetThumbOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(15, 23, 42, 0.28)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  assetThumbIcon: {
    fontFamily: 'Material Symbols Outlined',
    fontSize: 25,
    color: '#fff',
  },
  assetMiniCard: {
    width: (Dimensions.get('window').width - 72) / 5,
    height: (Dimensions.get('window').width - 72) / 5,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#e5edf6',
    backgroundColor: '#fff',
    padding: 6,
    justifyContent: 'center',
    alignItems: 'center',
    overflow: 'hidden',
  },
  assetMiniIconBox: {
    width: 30,
    height: 30,
    borderRadius: 8,
    backgroundColor: '#eef2f7',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 5,
  },
  assetMiniIcon: {
    fontFamily: 'Material Symbols Outlined',
    fontSize: 18,
    color: '#475569',
  },
  assetMiniTitle: {
    width: '100%',
    fontSize: 10,
    fontWeight: '800',
    color: '#475569',
    textAlign: 'center',
  },
  wallpaperGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    paddingVertical: 8,
  },
  wallpaperOption: {
    width: (Dimensions.get('window').width - 88) / 2,
    aspectRatio: 9 / 16,
    borderRadius: 14,
    overflow: 'hidden',
    borderWidth: 2,
    borderColor: 'transparent',
    backgroundColor: '#eef2f7',
  },
  wallpaperOptionSelected: {
    borderColor: Colors.primary,
  },
  wallpaperImage: {
    width: '100%',
    height: '100%',
  },
  wallpaperShade: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'flex-end',
    padding: 10,
    backgroundColor: 'rgba(15, 23, 42, 0.18)',
  },
  wallpaperLabel: {
    fontSize: 12,
    fontWeight: '800',
    color: '#fff',
  },
  wallpaperCheck: {
    position: 'absolute',
    top: 8,
    right: 8,
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: Colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  wallpaperCheckIcon: {
    fontFamily: 'Material Symbols Outlined',
    fontSize: 16,
    color: '#fff',
  },
  emptyMedia: {
    flex: 1,
    height: 60,
    justifyContent: 'center',
    alignItems: 'center',
  },
  emptyText: {
    color: '#94a3b8',
    fontSize: 13,
  },
  addMemberBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#f1f5f9',
  },
  addMemberIcon: {
    fontFamily: 'Material Symbols Outlined',
    fontSize: 24,
    color: Colors.primary,
    marginRight: 12,
  },
  addMemberText: {
    fontSize: 16,
    color: Colors.primary,
    fontWeight: 'bold',
  },
  memberItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    paddingHorizontal: 16,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#f8fafc',
  },
  memberAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    marginRight: 12,
  },
  memberInfo: {
    flex: 1,
  },
  memberName: {
    fontSize: 15,
    fontWeight: '600',
    color: '#1e293b',
  },
  memberRole: {
    fontSize: 12,
    color: '#64748b',
    marginTop: 2,
  },
  memberActions: {
    flexDirection: 'row',
    gap: 16,
  },
  actionIconSm: {
    fontFamily: 'Material Symbols Outlined',
    fontSize: 20,
  },
  modalBackdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(15, 23, 42, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  aliasModalCard: {
    width: '100%',
    maxWidth: 360,
    backgroundColor: '#fff',
    borderRadius: 24,
    padding: 20,
  },
  aliasModalTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#1f2631',
  },
  aliasModalSubtitle: {
    fontSize: 13,
    color: '#64748b',
    marginTop: 6,
    marginBottom: 14,
  },
  aliasInput: {
    borderWidth: 1,
    borderColor: '#dbe3ee',
    backgroundColor: '#f8fafc',
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 15,
    color: '#1f2631',
  },
  aliasActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 10,
    marginTop: 16,
  },
  aliasCancelBtn: {
    paddingHorizontal: 16,
    paddingVertical: 11,
    borderRadius: 12,
    backgroundColor: '#eef2f7',
  },
  aliasCancelText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#334155',
  },
  aliasSaveBtn: {
    paddingHorizontal: 16,
    paddingVertical: 11,
    borderRadius: 12,
    backgroundColor: Colors.primary,
  },
  aliasSaveText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#fff',
  },
});

const ChatDetailsScreen = ({ route, navigation }: any) => {
  const { conversationId } = route.params;
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const { 
    conversations, 
    messages, 
    userProfiles, 
    clearHistory,
    isConversationMuted,
    setConversationMuted,
    muteConversationFor,
    clearConversationMuted,
    removeMember,
    updateMemberRole,
    updateGroupInfo,
    dissolveGroup,
    addMembers,
    setPinConversation,
    setHiddenConversation
  } = useChatStore();

  const chat = conversations.find(c => c.id === conversationId);
  const [showWallpaperModal, setShowWallpaperModal] = useState(false);
  const [selectedWallpaperId, setSelectedWallpaperId] = useState<ChatWallpaperId>(DEFAULT_CHAT_WALLPAPER_ID);
  const [, setWallpaperKey] = useState<string>('default');
  const [showAliasModal, setShowAliasModal] = useState(false);
  const [aliasDraft, setAliasDraft] = useState('');
  const [savingAlias, setSavingAlias] = useState(false);
  const [autoDeleteDays, setAutoDeleteDays] = useState<number>(0);
  const [showAutoDeleteModal, setShowAutoDeleteModal] = useState(false);
  const [commonGroups, setCommonGroups] = useState<any[]>([]);
  const [loadingGroups, setLoadingGroups] = useState(false);
  const [mediaPreviewItems, setMediaPreviewItems] = useState<any[]>([]);
  const [assetCounts, setAssetCounts] = useState({ media: 0, file: 0, link: 0 });
  const [loadingMediaPreview, setLoadingMediaPreview] = useState(false);
  const [showMuteMenuModal, setShowMuteMenuModal] = useState(false);
  const [showCustomMuteModal, setShowCustomMuteModal] = useState(false);
  const [customMuteStartTime, setCustomMuteStartTime] = useState('22:00');
  const [customMuteEndTime, setCustomMuteEndTime] = useState('07:00');
  const [showAddMemberModal, setShowAddMemberModal] = useState(false);
  const [addMemberSearch, setAddMemberSearch] = useState('');
  const [selectedEmails, setSelectedEmails] = useState<string[]>([]);
  const [addingMembers, setAddingMembers] = useState(false);
  const [showShareModal, setShowShareModal] = useState(false);
  const { data: contactsData } = useContacts();

  const [promptConfig, setPromptConfig] = useState({
    visible: false,
    title: '',
    message: '',
    value: '',
    placeholder: '',
    keyboardType: 'default' as 'default' | 'email-address',
    onSubmit: (val: string) => {}
  });

  useEffect(() => {
    let active = true;

    const loadAlias = async () => {
      try {
        const raw = await AsyncStorage.getItem(CHAT_ALIAS_CONVERSATIONS_KEY);
        const map = raw ? JSON.parse(raw) : {};
        const saved = map?.[conversationId];
        if (active && saved) {
          setAliasDraft(saved);
          useChatStore.getState().setConversations((prev: any[]) => prev.map((item) => (
            item.id === conversationId ? { ...item, alias: saved } : item
          )));
        }
      } catch {
        // Best effort only.
      }
    };

    const loadAutoDelete = async () => {
      try {
        const raw = await AsyncStorage.getItem(CHAT_AUTO_DELETE_KEY);
        const map = raw ? JSON.parse(raw) : {};
        const saved = map?.[conversationId] || 0;
        if (active) {
          setAutoDeleteDays(saved);
        }
      } catch {
        // Best effort only.
      }
    };

    loadAlias();
    loadAutoDelete();

    return () => {
      active = false;
    };
  }, [conversationId]);

  useEffect(() => {
    let active = true;
    getConversationWallpaperId(conversationId).then((id) => {
      if (active) setSelectedWallpaperId(id);
    });
    return () => {
      active = false;
    };
  }, [conversationId]);

  const partnerEmail = chat?.type === 'direct'
    ? (Array.isArray(chat?.members) ? chat.members.find((m: string) => m !== user?.email) : undefined)
    : undefined;

  const normalizedPartnerEmail = partnerEmail ? String(partnerEmail).trim().toLowerCase() : '';
  const profile = normalizedPartnerEmail ? (userProfiles[normalizedPartnerEmail] || userProfiles[partnerEmail as string]) : null;
  // Load common groups when partnerEmail is available
  useEffect(() => {
    const loadCommonGroups = async () => {
      if (!partnerEmail) return;
      try {
        const res = await chatGet(`/groups/common?email=${encodeURIComponent(partnerEmail)}`);
        if (res?.ok && Array.isArray(res.data)) {
          setCommonGroups(res.data);
        }
      } catch (error) {
        console.error('Failed to load common groups', error);
      }
    };

    const loadMediaPreview = async () => {
      try {
        setLoadingMediaPreview(true);
        const [mediaRes, fileRes, linkRes] = await Promise.all([
          chatGet(`/conversations/${encodeURIComponent(conversationId)}/assets`, { type: 'media', limit: 6 }),
          chatGet(`/conversations/${encodeURIComponent(conversationId)}/assets`, { type: 'file', limit: 4 }),
          chatGet(`/conversations/${encodeURIComponent(conversationId)}/assets`, { type: 'link', limit: 4 }),
        ]);

        const mediaItems = mediaRes.ok && mediaRes.data?.items
          ? (mediaRes.data.items as any[]).flatMap((m) => {
              const arr = (m.media || m.files) ? [...(m.media || []), ...(m.files || [])] : [m];
              return arr
                .map((a) => ({ ...normalizeAttachment(a), createdAt: m.createdAt, previewType: 'media' }))
                .filter((a) => String(a.mimeType || '').startsWith('image/') || String(a.mimeType || '').startsWith('video/'));
            })
          : [];

        const fileItems = fileRes.ok && fileRes.data?.items
          ? (fileRes.data.items as any[]).flatMap((m) => (Array.isArray(m.files) && m.files.length > 0 ? m.files : [m])
              .map((a: any) => ({ ...normalizeAttachment(a), createdAt: m.createdAt, previewType: 'file' }))
              .filter((a: any) => {
                const name = String(a.name || '').toLowerCase();
                const mime = String(a.mimeType || '').toLowerCase();
                return name !== 'contact.json' && name !== 'location.json' && !mime.startsWith('image/') && !mime.startsWith('video/');
              }))
          : [];

        const linkItems = linkRes.ok && linkRes.data?.items
          ? (linkRes.data.items as any[]).flatMap((m) => {
              const matches = m.url ? [m.url] : (String(m.content || '').match(/https?:\/\/[^\s<>"']+/g) || []);
              return matches.map((url) => ({
                url: String(url).replace(/[),.;!?]+$/, ''),
                createdAt: m.createdAt,
                previewType: 'link',
              }));
            })
          : [];

        setAssetCounts({ media: mediaItems.length, file: fileItems.length, link: linkItems.length });
        setMediaPreviewItems([...mediaItems, ...fileItems, ...linkItems].slice(0, ASSET_PREVIEW_LIMIT));
      } catch (err) {
        console.error('Failed to load media preview', err);
      } finally {
        setLoadingMediaPreview(false);
      }
    };

    loadCommonGroups();
    loadMediaPreview();
  }, [conversationId, partnerEmail]);

  const { t } = useTheme();

  if (!chat) return null;

  const chatName = chat.alias || profile?.nickname || profile?.fullName || profile?.fullname || partnerEmail || chat.name || t('chat_details.conversation');
  const chatAvatar = profile?.avatarUrl || profile?.urlAvatar || chat.avatar || '';
  const isMuted = isConversationMuted(conversationId);
  const isPinned = !!chat?.pinned;
  const isHidden = !!chat?.hidden;

  const isGroup = chat?.type === 'group';
  const isBot = String(partnerEmail || '').toLowerCase() === 'bot@unichat.system';

  const allAttachments = messages.flatMap((m: any) => {
    const arr = [...(m.media || []), ...(m.files || [])];
    return arr.map(a => ({ ...a, createdAt: m.createdAt }));
  }).map(f => normalizeAttachment(f)).reverse();

  const mediaFiles = allAttachments.filter(f => 
    f.mimeType?.startsWith('image/') || f.mimeType?.startsWith('video/')
  ).slice(0, 5);

  const handleClearChat = () => {
    const isGroupOwner = chat.type === 'group' && (chat.owner === user?.email || chat.admin === user?.email);
    
    if (isGroupOwner) {
      Alert.alert(
        t('chat_details.delete_history'),
        t('chat_details.delete_history_range'),
        [
          { text: t('common.cancel'), style: "cancel" },
          {
            text: t('chat_details.delete_my_side'),
            onPress: async () => {
              try {
                await clearHistory(conversationId, false);
                Alert.alert(t('common.success'), t('chat_details.delete_my_side_success'), [
                  { text: "OK", onPress: () => navigation.goBack() }
                ]);
              } catch (err) {
                Alert.alert(t('common.error'), t('chat_details.delete_error'));
              }
            }
          },
          {
            text: t('chat_details.delete_all_side'),
            style: "destructive",
            onPress: async () => {
              try {
                await clearHistory(conversationId, true);
                Alert.alert(t('common.success'), t('chat_details.delete_all_side_success'), [
                  { text: "OK", onPress: () => navigation.goBack() }
                ]);
              } catch (err) {
                Alert.alert(t('common.error'), t('chat_details.delete_error'));
              }
            }
          },
        ]
      );
    } else {
      Alert.alert(
        t('chat_details.delete_history'),
        t('chat_details.delete_confirm_msg'),
        [
          { text: t('common.cancel'), style: "cancel" },
          {
            text: t('common.delete'),
            style: "destructive",
            onPress: async () => {
              try {
                await clearHistory(conversationId, false);
                Alert.alert(t('common.success'), t('chat_details.delete_success'), [
                  { text: "OK", onPress: () => navigation.goBack() }
                ]);
              } catch (err) {
                Alert.alert(t('common.error'), t('chat_details.delete_error'));
              }
            }
          }
        ]
      );
    }
  };


  const handleLeaveGroup = () => {
    const isOwner = chat.owner === user?.email || chat.admin === user?.email;
    const otherMembers = (chat.members || []).filter((m: string) => m !== user?.email);

    if (isOwner && otherMembers.length > 0) {
      // Owner must transfer before leaving
      const options = otherMembers.map((m: string) => {
        const p = userProfiles[m.trim().toLowerCase()];
        return { text: p?.nickname || p?.fullName || m, onPress: () => confirmTransferAndLeave(m) };
      });
      Alert.alert(
        t('chat_details.transfer_owner'),
        t('chat_details.transfer_owner_msg'),
        [
          { text: t('common.cancel'), style: "cancel" },
          ...options,
        ]
      );
      return;
    }

    if (isOwner && otherMembers.length === 0) {
      // Last member, dissolve instead
      handleDissolveGroup();
      return;
    }

    Alert.alert(
      t('chat_details.leave_group'),
      t('chat_details.leave_group_msg'),
      [
        { text: t('common.cancel'), style: "cancel" },
        {
          text: t('chat_details.leave_group'),
          style: "destructive",
          onPress: async () => {
            try {
              await removeMember(conversationId, user?.email || "");
              navigation.navigate('Main');
            } catch (err: any) { Alert.alert(t('common.error'), err.response?.data?.message || t('chat_details.leave_error')); }
          }
        }
      ]
    );
  };

  const confirmTransferAndLeave = async (newOwnerEmail: string) => {
    try {
      await updateMemberRole(conversationId, newOwnerEmail, 'owner');
      await removeMember(conversationId, user?.email || '');
      navigation.navigate('Main');
    } catch (err: any) {
      Alert.alert(t('common.error'), err.response?.data?.message || t('chat_details.transfer_error'));
    }
  };

  const handleDissolveGroup = () => {
    Alert.alert(
      t('chat_details.disband_group'),
      t('chat_details.disband_group_msg'),
      [
        { text: t('common.cancel'), style: "cancel" },
        { 
          text: t('chat_details.disband_group'), 
          style: "destructive",
          onPress: async () => {
            try {
              await dissolveGroup(conversationId);
              navigation.navigate('Main');
            } catch (err: any) { Alert.alert(t('common.error'), err.response?.data?.message || t('chat_details.disband_error')); }
          }
        }
      ]
    );
  };

  const handleKickMember = (email: string) => {
    Alert.alert(
      t('chat_details.kick_member'),
      t('chat_details.kick_member_msg', { email }),
      [
        { text: t('common.cancel'), style: "cancel" },
        { 
          text: t('common.delete'), 
          style: "destructive",
          onPress: async () => {
            try {
              await removeMember(conversationId, email);
            } catch (err: any) { Alert.alert(t('common.error'), err.response?.data?.message || t('chat_details.kick_error')); }
          }
        }
      ]
    );
  };

  const handleChangeRole = (email: string, role: 'owner' | 'deputy' | 'member') => {
    const label = role === 'owner' ? t('group.role_owner') : role === 'deputy' ? t('group.role_deputy') : t('group.role_member');
    Alert.alert(
      t('chat_details.change_role'),
      t('chat_details.change_role_msg', { email, label }),
      [
        { text: t('common.cancel'), style: "cancel" },
        { 
          text: t('common.confirm'), 
          onPress: async () => {
            try {
              await updateMemberRole(conversationId, email, role);
            } catch (err: any) { Alert.alert(t('common.error'), err.response?.data?.message || t('chat_details.change_role_error')); }
          }
        }
      ]
    );
  };

  const handleUpdateGroupName = () => {
    setPromptConfig({
      visible: true,
      title: t('chat_details.change_group_name'),
      message: t('chat_details.enter_new_group_name'),
      placeholder: t('chat_details.group_name_placeholder'),
      value: chat?.name || '',
      keyboardType: "default",
      onSubmit: async (newName: string) => {
        if (!newName || !newName.trim()) {
          Alert.alert(t('common.error'), t('chat_details.group_name_empty'));
          return;
        }
        try {
          await updateGroupInfo(conversationId, { name: newName.trim() });
        } catch (err: any) { 
          Alert.alert(t('common.error'), t('chat_details.cannot_change_name')); 
        }
      }
    });
  };

  const handleUpdateGroupAvatar = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.7,
    });

    if (!result.canceled) {
      try {
        const uploadRes = await chatUpload({
          uri: result.assets[0].uri,
          name: 'group_avatar.jpg',
          type: 'image/jpeg'
        });
        if (uploadRes.ok) {
          const avatarUrl = uploadRes.data?.fileUrl || uploadRes.data?.dataUrl || '';
          await updateGroupInfo(conversationId, { avatar: avatarUrl });
        } else {
          Alert.alert(t('common.error'), t('chat_details.err_upload_image'));
        }
      } catch (err) {
        Alert.alert(t('common.error'), t('chat_details.err_update_avatar'));
      }
    }
  };

  const handleOpenProfile = () => {
    if (!partnerEmail) return;
    navigation.navigate('Profile', { userId: partnerEmail });
  };

  const handleSearchMessages = () => {
    navigation.navigate('InChatSearch', { conversationId, chatName });
  };

  const handleOpenPersonalSettings = () => {
    navigation.navigate('ProfileMore');
  };

  const persistConversationFlag = async (key: string, convId: string, value: boolean) => {
    try {
      const raw = await AsyncStorage.getItem(key);
      const map = raw ? JSON.parse(raw) : {};
      if (value) map[convId] = true;
      else delete map[convId];
      await AsyncStorage.setItem(key, JSON.stringify(map));
    } catch {
      // Best effort persistence only.
    }
  };

  const persistMuteSchedule = async (convId: string, schedule: any | null) => {
    const raw = await AsyncStorage.getItem(CHAT_MUTE_SCHEDULE_KEY);
    const map = raw ? JSON.parse(raw) : {};
    if (schedule) {
      map[convId] = schedule;
    } else {
      delete map[convId];
    }
    await AsyncStorage.setItem(CHAT_MUTE_SCHEDULE_KEY, JSON.stringify(map));
  };

  const handleTogglePin = async () => {
    const nextPinned = !isPinned;
    try {
      // Sync with backend via store action
      await setPinConversation(conversationId, nextPinned);
      // Also persist locally for offline support
      await persistConversationFlag(CHAT_PINNED_CONVERSATIONS_KEY, conversationId, nextPinned);
      Alert.alert(t('common.updated'), nextPinned ? t('chat_details.chat_pinned') : t('chat_details.chat_unpinned'));
    } catch {
      Alert.alert(t('chat_details.cannot_update'), t('common.try_again_later'));
    }
  };

  const handleSaveAlias = async () => {
    if (!partnerEmail) return;
    const nextAlias = aliasDraft.trim();
    setSavingAlias(true);
    try {
      if (nextAlias) {
        const res = await chatPatch('/friends/nickname', { friendEmail: partnerEmail, nickname: nextAlias });
        if (!res?.ok) throw new Error('NICKNAME_FAILED');
        const raw = await AsyncStorage.getItem(CHAT_ALIAS_CONVERSATIONS_KEY);
        const map = raw ? JSON.parse(raw) : {};
        map[conversationId] = nextAlias;
        await AsyncStorage.setItem(CHAT_ALIAS_CONVERSATIONS_KEY, JSON.stringify(map));
        useChatStore.getState().setConversations((prev: any[]) => prev.map((item) => (
          item.id === conversationId ? { ...item, alias: nextAlias } : item
        )));
        Alert.alert('Đã lưu', 'Tên gợi nhớ đã được cập nhật.');
      } else {
        await chatPatch('/friends/nickname', { friendEmail: partnerEmail, nickname: '' });
        const raw = await AsyncStorage.getItem(CHAT_ALIAS_CONVERSATIONS_KEY);
        const map = raw ? JSON.parse(raw) : {};
        delete map[conversationId];
        await AsyncStorage.setItem(CHAT_ALIAS_CONVERSATIONS_KEY, JSON.stringify(map));
        useChatStore.getState().setConversations((prev: any[]) => prev.map((item) => (
          item.id === conversationId ? { ...item, alias: '' } : item
        )));
        Alert.alert('Đã xóa', 'Đã xóa tên gợi nhớ.');
      }
      setShowAliasModal(false);
    } catch {
      Alert.alert('Không thể lưu', 'Vui lòng thử lại sau.');
    } finally {
      setSavingAlias(false);
    }
  };

  const handleToggleHidden = async () => {
    const nextHidden = !isHidden;
    if (nextHidden) {
      Alert.alert(
        'Ẩn trò chuyện',
        'Ẩn cuộc trò chuyện này khỏi danh sách?',
        [
          { text: 'Hủy', style: 'cancel' },
          {
            text: 'Ẩn',
            style: 'destructive',
            onPress: async () => {
              try {
                // Sync with backend via store action
                await setHiddenConversation(conversationId, true);
                // Also persist locally for offline support
                await persistConversationFlag(CHAT_HIDDEN_CONVERSATIONS_KEY, conversationId, true);
                Alert.alert('Đã ẩn', 'Cuộc trò chuyện sẽ không hiển thị trong danh sách chính.');
                navigation.goBack();
              } catch {
                Alert.alert('Không thể ẩn', 'Vui lòng thử lại sau.');
              }
            },
          },
        ]
      );
      return;
    }

    try {
      // Sync with backend via store action
      await setHiddenConversation(conversationId, false);
      // Also persist locally for offline support
      await persistConversationFlag(CHAT_HIDDEN_CONVERSATIONS_KEY, conversationId, false);
      Alert.alert('Đã hiện lại', 'Cuộc trò chuyện đã quay lại danh sách.');
    } catch {
      Alert.alert('Không thể cập nhật', 'Vui lòng thử lại sau.');
    }
  };

  const handleChangeWallpaper = () => {
    setShowWallpaperModal(true);
    return;

    Alert.alert(
      'Đổi hình nền',
      'Chọn hình nền cho cuộc trò chuyện này.',
      [
        { text: 'Hủy', style: 'cancel' },
        ...WALLPAPERS.map((item) => ({
          text: item.label,
          onPress: async () => {
            setWallpaperKey(item.key);
            try {
              await AsyncStorage.setItem(`chat-wallpaper:${conversationId}`, item.key);
            } catch {
              // Local preference is best-effort only.
            }
          },
        })),
      ]
    );
  };

  const handleSaveWallpaper = async () => {
    try {
      await setConversationWallpaperId(conversationId, selectedWallpaperId);
      setShowWallpaperModal(false);
    } catch {
      Alert.alert(t('common.error'), t('chat_details.try_again'));
    }
  };

  const handleSelectMuteSchedule = async (type: '1h' | '4h' | '12h' | 'morning' | 'forever') => {
    const schedule =
      type === '1h'
        ? createMuteUntilHours(1)
        : type === '4h'
          ? createMuteUntilHours(4)
          : type === '12h'
            ? createMuteUntilHours(12)
            : type === 'morning'
              ? createMuteUntilMorning(8)
              : null;

    try {
      if (schedule) await persistMuteSchedule(conversationId, schedule);
      else await persistMuteSchedule(conversationId, null);
      await muteConversationFor(
        conversationId,
        type === '1h' ? '1h' : type === '4h' ? '4h' : type === '12h' ? '12h' : type === 'morning' ? 'until-8am' : 'until-open',
      );
      setShowMuteMenuModal(false);
      Alert.alert(t('chat_details.mute_title'), schedule ? getMuteLabel(schedule) : t('chat_details.mute_success_msg'));
    } catch {
      Alert.alert(t('chat_details.cannot_update'), t('chat_details.try_again'));
    }
  };

  const handleApplyCustomMuteSchedule = async () => {
    if (!isValidTimeString(customMuteStartTime) || !isValidTimeString(customMuteEndTime)) {
      Alert.alert(t('common.error'), t('chat_details.invalid_time'));
      return;
    }

    const schedule = createCustomWindowMuteSchedule(customMuteStartTime, customMuteEndTime);
    try {
      await persistMuteSchedule(conversationId, schedule);
      await setConversationMuted(conversationId, true);
      setShowCustomMuteModal(false);
      setShowMuteMenuModal(false);
      Alert.alert(t('chat_details.mute_title'), getMuteLabel(schedule));
    } catch {
      Alert.alert(t('chat_details.cannot_update'), t('chat_details.try_again'));
    }
  };

  const handleToggleMute = () => {
    if (isMuted) {
      Alert.alert(
        t('chat_details.unmute_confirm_title'),
        t('chat_details.unmute_confirm_msg'),
        [
          { text: t('common.cancel'), style: "cancel" },
          {
            text: t('common.confirm'),
            onPress: async () => {
              try {
                await persistMuteSchedule(conversationId, null);
                await clearConversationMuted(conversationId);
                Alert.alert(t('common.success'), t('chat_details.unmute_success_msg'));
              } catch {
                Alert.alert(t('chat_details.cannot_update'), t('chat_details.try_again'));
              }
            },
          },
        ]
      );
      return;
    }

    setShowMuteMenuModal(true);
  };



  const handleBlockUser = async () => {
    if (!partnerEmail) return;
    Alert.alert(
      t('chat_details.block_user'),
      t('chat_details.block_confirm', { name: chatName }),
      [
        { text: t('common.cancel'), style: 'cancel' },
        {
          text: t('chat_details.block'),
          style: 'destructive',
          onPress: async () => {
            try {
              const res = await chatPost('/friends/block', { targetEmail: partnerEmail });
              if (!res?.ok) throw new Error('BLOCK_FAILED');
              Alert.alert(t('common.success'), t('chat_details.block_success'));
              navigation.navigate('Main', { screen: 'Contacts' });
            } catch {
              Alert.alert(t('chat_details.cannot_block'), t('chat_details.try_again'));
            }
          },
        },
      ]
    );
  };

  const handleConversationStorage = () => {
    const totalBytes = allAttachments.reduce((sum: number, item: any) => sum + Number(item?.size || 0), 0);
    const totalMB = (totalBytes / 1024 / 1024).toFixed(2);
    Alert.alert(
      t('chat_details.chat_storage'),
      t('chat_details.storage_msg', { count: allAttachments.length, mb: totalMB }),
      [
        { text: t('common.close'), style: 'cancel' },
        { text: t('chat_details.open_gallery'), onPress: () => navigation.navigate('ChatGallery', { conversationId }) },
      ]
    );
  };

  const handleAutoDelete = () => {
    Alert.alert(
      t('chat_details.auto_delete'),
      t('chat_details.auto_delete_msg'),
      [
        { text: t('common.cancel'), style: 'cancel' },
        ...AUTO_DELETE_OPTIONS.map((opt) => ({
          text: opt.label,
          onPress: async () => {
            try {
              const raw = await AsyncStorage.getItem(CHAT_AUTO_DELETE_KEY);
              const map = raw ? JSON.parse(raw) : {};
              if (opt.days === 0) {
                delete map[conversationId];
              } else {
                map[conversationId] = opt.days;
              }
              await AsyncStorage.setItem(CHAT_AUTO_DELETE_KEY, JSON.stringify(map));
              setAutoDeleteDays(opt.days);
              Alert.alert(t('common.saved'), t('chat_details.auto_delete_saved', { time: opt.days === 0 ? t('chat_details.auto_delete_never') : t('chat_details.n_days', { count: opt.days }) }));
            } catch {
              Alert.alert(t('common.error'), t('chat_details.try_again'));
            }
          }
        }))
      ]
    );
  };



  const handleViewCommonGroups = async () => {
    if (!partnerEmail) return;
    try {
      setLoadingGroups(true);
      const res = await chatGet(`/groups/common?email=${encodeURIComponent(partnerEmail)}`);
      if (res?.ok && Array.isArray(res.data)) {
        setCommonGroups(res.data);
        if (res.data.length === 0) {
          Alert.alert(t('chat_details.common_groups_title'), t('chat_details.common_groups_empty'));
        } else {
          const groupNames = res.data.map((g: any) => g.name).join(', ');
          Alert.alert(t('chat_details.common_groups_title'), t('chat_details.common_groups_list', { count: res.data.length, groups: groupNames }));
        }
      } else {
        Alert.alert(t('chat_details.common_groups_title'), t('chat_details.common_groups_error'));
      }
    } catch (error) {
      console.error('Failed to fetch common groups', error);
      Alert.alert(t('chat_details.common_groups_title'), t('chat_details.common_groups_error'));
    } finally {
      setLoadingGroups(false);

    }
  };

  const renderSectionHeader = (title: string) => (
    <View style={styles.sectionHeader}>
      <Text style={styles.sectionTitle}>{title}</Text>
    </View>
  );

  const renderMenuItem = (icon: string, title: string, rightElement?: React.ReactNode, onPress?: () => void, color = '#1f2631') => (
    <TouchableOpacity style={styles.menuItem} onPress={onPress} disabled={!onPress}>
      <View style={styles.menuLeft}>
        <Text style={[styles.menuIcon, { color }]}>{icon}</Text>
        <Text style={styles.menuText}>{title}</Text>
      </View>
      {rightElement ? rightElement : <Text style={styles.chevron}>chevron_right</Text>}
    </TouchableOpacity>
  );

  const renderAssetPreviewItem = (item: any, index: number) => {
    if (item.previewType === 'media') {
      const isVideo = String(item.mimeType || '').startsWith('video/');
      return (
        <View key={`asset-${index}`} style={styles.assetThumb}>
          <Image source={{ uri: item.dataUrl || item.url }} style={styles.assetThumbImage} resizeMode="cover" />
          {isVideo && (
            <View style={styles.assetThumbOverlay}>
              <Text style={styles.assetThumbIcon}>play_circle</Text>
            </View>
          )}
        </View>
      );
    }

    if (item.previewType === 'link') {
      return (
        <View key={`asset-${index}`} style={styles.assetMiniCard}>
          <View style={[styles.assetMiniIconBox, { backgroundColor: '#e0f2fe' }]}>
            <Text style={[styles.assetMiniIcon, { color: '#0369a1' }]}>link</Text>
          </View>
          <Text style={styles.assetMiniTitle} numberOfLines={1}>LINK</Text>
        </View>
      );
    }

    const ext = String(item.name || '').split('.').pop()?.toUpperCase() || 'FILE';
    return (
      <View key={`asset-${index}`} style={styles.assetMiniCard}>
        <View style={styles.assetMiniIconBox}>
          <Text style={styles.assetMiniIcon}>description</Text>
        </View>
        <Text style={styles.assetMiniTitle} numberOfLines={1}>{ext.slice(0, 6)}</Text>
      </View>
    );
  };
  const joinLink = `https://zaloforeducation.vercel.app/join/${conversationId}`;

  const handleCopyJoinLink = async () => {
    await Clipboard.setStringAsync(joinLink);
    Alert.alert(t('common.success') || 'Thành công', t('chat.copied') || 'Đã sao chép liên kết tham gia.');
  };

  return (
    <View style={styles.container}>
      {/* Header Bar */}
      <View style={[styles.header, { paddingTop: insets.top }]}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Text style={styles.headerIcon}>arrow_back_ios</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>{t('chat_details.title')}</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 40 }}>
        {/* Profile Section */}
        <View style={styles.profileBox}>
          <TouchableOpacity 
            activeOpacity={0.8}
            onPress={chat.type === 'group' ? handleUpdateGroupAvatar : (partnerEmail ? handleOpenProfile : undefined)}
          >
            <Image source={avatarSource(chatAvatar)} style={styles.largeAvatar} />
            {chat.type === 'group' && (
              <View style={styles.avatarEditBadge}>
                <Text style={styles.avatarEditIcon}>camera_alt</Text>
              </View>
            )}
          </TouchableOpacity>
          <TouchableOpacity onPress={chat.type === 'group' ? undefined : handleOpenProfile} disabled={chat.type === 'group' || !partnerEmail} activeOpacity={partnerEmail ? 0.85 : 1}>
            <Text style={styles.profileName}>{chatName}</Text>
          </TouchableOpacity>
          
          <View style={styles.quickActions}>
              <TouchableOpacity style={styles.actionItem} onPress={handleSearchMessages}>
              <View style={styles.actionCircle}><Text style={styles.actionIcon}>search</Text></View>
              <Text style={styles.actionLabel}>{t('chat_details.search_msg_short')}</Text>
            </TouchableOpacity>
            {!isBot && !isGroup && (
              <TouchableOpacity style={styles.actionItem} onPress={handleOpenProfile} disabled={!partnerEmail} activeOpacity={partnerEmail ? 0.85 : 1}>
                <View style={styles.actionCircle}><Text style={styles.actionIcon}>person</Text></View>
                <Text style={styles.actionLabel}>{t('chat_details.personal_page_short')}</Text>
              </TouchableOpacity>
            )}
            {isGroup && (
              <TouchableOpacity style={styles.actionItem} onPress={() => setShowShareModal(true)}>
                <View style={styles.actionCircle}><Text style={styles.actionIcon}>qr_code</Text></View>
                <Text style={styles.actionLabel}>{t('chat_details.share_group') || 'Chia sẻ nhóm'}</Text>
              </TouchableOpacity>
            )}
              <TouchableOpacity style={styles.actionItem} onPress={handleChangeWallpaper}>
              <View style={styles.actionCircle}><Text style={styles.actionIcon}>palette</Text></View>
              <Text style={styles.actionLabel}>{t('chat_details.change_wallpaper_short')}</Text>
            </TouchableOpacity>
              <TouchableOpacity style={styles.actionItem} onPress={handleToggleMute}>
              <View style={styles.actionCircle}><Text style={styles.actionIcon}>notifications_none</Text></View>
                <Text style={styles.actionLabel}>{isMuted ? t('chat_details.unmute_short') : t('chat_details.mute_short')}</Text>
            </TouchableOpacity>
          </View>
        </View>

        <View style={styles.divider} />

        {/* Settings List */}
        {!isBot && !isGroup && (
          <>
            {renderMenuItem("edit", t('chat_details.change_alias'), <Text style={styles.subText}>{chat.alias ? t('chat_details.set') : t('chat_details.not_set')}</Text>, () => setShowAliasModal(true))}
          </>
        )}

        <View style={styles.divider} />

        {/* Media Section */}
        <TouchableOpacity 
          style={styles.mediaRow} 
          onPress={() => navigation.navigate('ChatGallery', { conversationId })}
        >
          <View style={styles.mediaHeader}>
            <View style={styles.menuLeft}>
              <Text style={styles.menuIcon}>grid_view</Text>
              <Text style={styles.menuText}>{t('chat_details.media_files_links')}</Text>
            </View>
            <Text style={styles.chevron}>chevron_right</Text>
          </View>
          <View style={styles.assetSummaryRow}>
            <View style={styles.assetSummaryPill}>
              <Text style={styles.assetSummaryIcon}>image</Text>
              <Text style={styles.assetSummaryText}>{t('chat_details.n_photos', { count: assetCounts.media })}</Text>
            </View>
            <View style={styles.assetSummaryPill}>
              <Text style={styles.assetSummaryIcon}>description</Text>
              <Text style={styles.assetSummaryText}>{t('chat_details.n_files', { count: assetCounts.file })}</Text>
            </View>
            <View style={styles.assetSummaryPill}>
              <Text style={styles.assetSummaryIcon}>link</Text>
              <Text style={styles.assetSummaryText}>{t('chat_details.n_links', { count: assetCounts.link })}</Text>
            </View>
          </View>
          <View style={styles.mediaPreview}>
            {loadingMediaPreview ? (
              <ActivityIndicator size="small" color={Colors.primary} style={{ marginLeft: 16 }} />
            ) : mediaPreviewItems.length > 0 ? (
              mediaPreviewItems.map(renderAssetPreviewItem)
            ) : (
              <View style={styles.emptyMedia}><Text style={styles.emptyText}>{t('chat_details.no_media')}</Text></View>
            )}
            <View style={styles.previewMore}>
              <Text style={styles.headerIcon}>arrow_forward</Text>
            </View>
          </View>
        </TouchableOpacity>

        <View style={styles.divider} />

        {!isBot && !isGroup && (
          <>
            <View style={styles.divider} />

            {renderMenuItem("groups", `${t('chat_details.common_groups_title')} (${commonGroups.length})`, undefined, handleViewCommonGroups)}
          </>
        )}

        <View style={styles.divider} />

        {renderMenuItem(
          "push_pin",
          isPinned ? t('chat_details.unpin_chat') : t('chat_details.pin_chat'),
          <Text style={styles.subText}>{isPinned ? t('chat_details.pinned') : t('chat_details.unpinned')}</Text>,
          handleTogglePin
        )}
        {renderMenuItem(
          "visibility_off",
          isHidden ? t('chat_details.unhide_chat') : t('chat_details.hide_chat'),
          <Text style={styles.subText}>{isHidden ? t('chat_details.hidden') : t('chat_details.visible')}</Text>,
          handleToggleHidden
        )}
        {renderMenuItem("notifications_none", isMuted ? t('chat_details.unmute_notifications') : t('chat_details.mute_notifications'), 
          <Text style={styles.subText}>{isMuted ? t('chat_details.muted') : t('chat_details.unmuted')}</Text>,
          handleToggleMute
        )}

        {renderMenuItem(
          "history", 
          t('chat_details.auto_delete'), 
          <Text style={styles.subText}>{autoDeleteDays === 0 ? t('chat_details.no_auto_delete') : t('chat_details.n_days', { count: autoDeleteDays })}</Text>,
          handleAutoDelete
        )}

        <View style={styles.divider} />


        {!isBot && !isGroup && renderMenuItem("block", t('chat_details.block_user'), undefined, handleBlockUser, '#ef4444')}
        {renderMenuItem("storage", t('chat_details.chat_storage'), undefined, handleConversationStorage)}
        {renderMenuItem("delete_outline", t('chat_details.delete_history'), undefined, handleClearChat, '#ef4444')}

        {chat.type === 'group' && (
          <>
            <View style={styles.divider} />
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>{t('chat_details.group_management')}</Text>
            </View>
            {renderMenuItem("edit", t('chat_details.change_group_name'), undefined, handleUpdateGroupName)}
            {(chat.owner === user?.email || chat.admin === user?.email) && (
              renderMenuItem("delete_forever", t('chat_details.disband_group'), undefined, handleDissolveGroup, '#ef4444')
            )}
            {renderMenuItem("logout", t('chat_details.leave_group'), undefined, handleLeaveGroup, '#ef4444')}

            <View style={styles.divider} />
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>{t('chat_details.members_count', { count: chat.members?.length || 0 })}</Text>
            </View>
            <TouchableOpacity style={styles.addMemberBtn} onPress={() => {
               setSelectedEmails([]);
               setAddMemberSearch('');
               setShowAddMemberModal(true);
            }}>
               <Text style={styles.addMemberIcon}>add</Text>
               <Text style={styles.addMemberText}>{t('chat_details.add_member')}</Text>
            </TouchableOpacity>

            {chat.members?.map((m: string) => {
               const p = userProfiles[m.trim().toLowerCase()];
               const isMe = m.trim().toLowerCase() === (user?.email || '').trim().toLowerCase();
               const isOwner = chat.owner === m || chat.admin === m;
               const isDeputy = (chat.deputies || []).includes(m);
               const myRole = (chat.owner === user?.email || chat.admin === user?.email) ? 'owner' : (chat.deputies || []).includes(user?.email || "") ? 'deputy' : 'member';
               const displayName = isMe
                 ? (user?.fullName || user?.nickname || p?.nickname || p?.fullName || m)
                 : (p?.nickname || p?.fullName || m);
               const displayAvatar = isMe
                 ? (user?.avatarUrl || p?.avatarUrl || p?.urlAvatar || p?.avatar || undefined)
                 : (p?.avatarUrl || p?.urlAvatar || p?.avatar || undefined);

               return (
                 <TouchableOpacity
                   key={m}
                   style={styles.memberItem}
                   activeOpacity={0.7}
                   onPress={() => navigation.navigate('Profile', { userId: m })}
                 >
                    <Image source={avatarSource(displayAvatar)} style={styles.memberAvatar} />
                    <View style={styles.memberInfo}>
                       <Text style={styles.memberName}>{displayName} {isMe && `(${t('chat_details.you')})`}</Text>
                       <Text style={styles.memberRole}>
                          {isOwner ? t('group.role_owner') : isDeputy ? t('group.role_deputy') : t('group.role_member')}
                       </Text>
                    </View>
                    {!isMe && (
                       <View style={styles.memberActions}>
                          {myRole === 'owner' && (
                             <>
                                {!isOwner && (
                                   <TouchableOpacity onPress={(e) => { e.stopPropagation?.(); handleChangeRole(m, isDeputy ? 'member' : 'deputy'); }}>
                                      <Text style={[styles.actionIconSm, { color: Colors.primary }]}>{isDeputy ? "shield_outlined" : "shield"}</Text>
                                   </TouchableOpacity>
                                )}
                                {!isOwner && (
                                   <TouchableOpacity onPress={(e) => { e.stopPropagation?.(); handleChangeRole(m, 'owner'); }}>
                                      <Text style={[styles.actionIconSm, { color: '#f59e0b' }]}>star</Text>
                                   </TouchableOpacity>
                                )}
                             </>
                          )}
                          {(myRole === 'owner' || (myRole === 'deputy' && !isOwner && !isDeputy)) && (
                             <TouchableOpacity onPress={(e) => { e.stopPropagation?.(); handleKickMember(m); }}>
                                <Text style={[styles.actionIconSm, { color: '#ef4444' }]}>person_remove</Text>
                             </TouchableOpacity>
                          )}
                       </View>
                    )}
                 </TouchableOpacity>
               );
            })}
          </>
        )}
      </ScrollView>

      {/* Add Member Modal */}
      <Modal
        visible={showAddMemberModal}
        transparent
        animationType="fade"
        onRequestClose={() => setShowAddMemberModal(false)}
      >
        <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.45)', justifyContent: 'center', paddingHorizontal: 20 }}>
          <View style={{ backgroundColor: '#fff', borderRadius: 16, overflow: 'hidden', maxHeight: '80%' }}>
            {/* Header */}
            <View style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 20, paddingVertical: 16, borderBottomWidth: 1, borderBottomColor: '#f1f5f9' }}>
              <Text style={{ fontFamily: 'Material Symbols Outlined', fontSize: 22, color: '#1e293b', marginRight: 8 }}>person_add</Text>
              <Text style={{ flex: 1, fontSize: 17, fontWeight: '700', color: '#1e293b' }}>{t('chat_details.add_member')}</Text>
              <TouchableOpacity onPress={() => setShowAddMemberModal(false)} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
                <Text style={{ fontFamily: 'Material Symbols Outlined', fontSize: 22, color: '#94a3b8' }}>close</Text>
              </TouchableOpacity>
            </View>
            {/* Search */}
            <View style={{ margin: 14, flexDirection: 'row', alignItems: 'center', backgroundColor: '#f1f5f9', borderRadius: 10, paddingHorizontal: 12 }}>
              <Text style={{ fontFamily: 'Material Symbols Outlined', fontSize: 18, color: '#94a3b8', marginRight: 8 }}>search</Text>
              <TextInput
                placeholder={t('chat_details.add_member_search')}
                placeholderTextColor="#94a3b8"
                value={addMemberSearch}
                onChangeText={setAddMemberSearch}
                autoCapitalize="none"
                style={{ flex: 1, fontSize: 14, paddingVertical: 10, color: '#1e293b' }}
              />
              {addMemberSearch.length > 0 && (
                <TouchableOpacity onPress={() => setAddMemberSearch('')}>
                  <Text style={{ fontFamily: 'Material Symbols Outlined', fontSize: 18, color: '#94a3b8' }}>close</Text>
                </TouchableOpacity>
              )}
            </View>
            {/* List */}
            <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled" style={{ flexGrow: 0 }}>
              {(() => {
                const currentMembers = new Set((chat.members || []).map((m: string) => m.trim().toLowerCase()));
                const q = addMemberSearch.toLowerCase().trim();
                const isEmailQuery = q.includes('@') && q.length > 4;
                const emailAlreadyMember = isEmailQuery && currentMembers.has(q);
                const friends = (contactsData?.friendships || [])
                  .filter((f: any) => f.status === 'accepted')
                  .map((f: any) => {
                    const email = friendEmailOf(f, user?.email || '');
                    const profile = userProfiles[email.toLowerCase()] || {};
                    return { email, name: f.nickname || profile?.fullName || profile?.nickname || email, avatar: profile?.avatarUrl || profile?.urlAvatar };
                  })
                  .filter((f: any) => !currentMembers.has(f.email.toLowerCase()))
                  .filter((f: any) => { if (!q) return true; return f.name.toLowerCase().includes(q) || f.email.toLowerCase().includes(q); });
                const emailAlreadyFriend = friends.some((f: any) => f.email.toLowerCase() === q);
                const showDirectAdd = isEmailQuery && !emailAlreadyMember && !emailAlreadyFriend;
                return (
                  <>
                    {showDirectAdd && (
                      <>
                        <View style={{ paddingHorizontal: 16, paddingTop: 8, paddingBottom: 4 }}>
                          <Text style={{ fontSize: 11, fontWeight: '700', color: '#94a3b8', letterSpacing: 0.8 }}>{t('chat_details.add_member_via_gmail')}</Text>
                        </View>
                        <TouchableOpacity activeOpacity={0.7}
                          style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 10 }}
                          onPress={() => setSelectedEmails(prev => prev.includes(q) ? prev.filter(e => e !== q) : [...prev, q])}>
                          <View style={{ width: 44, height: 44, borderRadius: 22, backgroundColor: '#f0fdf4', alignItems: 'center', justifyContent: 'center', marginRight: 12 }}>
                            <Text style={{ fontFamily: 'Material Symbols Outlined', fontSize: 22, color: '#22c55e' }}>person_add</Text>
                          </View>
                          <View style={{ flex: 1 }}>
                            <Text style={{ fontSize: 15, fontWeight: '600', color: '#1e293b' }}>{q}</Text>
                            <Text style={{ fontSize: 12, color: '#64748b', marginTop: 1 }}>{t('chat_details.add_member_via_gmail_sub')}</Text>
                          </View>
                          <View style={{ width: 22, height: 22, borderRadius: 11, borderWidth: 2, borderColor: selectedEmails.includes(q) ? Colors.primary : '#cbd5e1', backgroundColor: selectedEmails.includes(q) ? Colors.primary : '#fff', alignItems: 'center', justifyContent: 'center' }}>
                            {selectedEmails.includes(q) && <Text style={{ fontFamily: 'Material Symbols Outlined', fontSize: 13, color: '#fff' }}>check</Text>}
                          </View>
                        </TouchableOpacity>
                      </>
                    )}
                    {friends.length > 0 && (
                      <View style={{ paddingHorizontal: 16, paddingTop: showDirectAdd ? 8 : 4, paddingBottom: 4 }}>
                        <Text style={{ fontSize: 11, fontWeight: '700', color: '#94a3b8', letterSpacing: 0.8 }}>{t('chat_details.add_member_friends_section')}</Text>
                      </View>
                    )}
                    {friends.map((f: any) => {
                      const isSelected = selectedEmails.includes(f.email);
                      return (
                        <TouchableOpacity key={f.email} activeOpacity={0.7}
                          style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 10 }}
                          onPress={() => setSelectedEmails(prev => prev.includes(f.email) ? prev.filter(e => e !== f.email) : [...prev, f.email])}>
                          {f.avatar ? (
                            <Image source={{ uri: f.avatar }} style={{ width: 44, height: 44, borderRadius: 22, marginRight: 12 }} />
                          ) : (
                            <View style={{ width: 44, height: 44, borderRadius: 22, backgroundColor: Colors.primary, alignItems: 'center', justifyContent: 'center', marginRight: 12 }}>
                              <Text style={{ color: '#fff', fontSize: 18, fontWeight: '700' }}>{f.name.charAt(0).toUpperCase()}</Text>
                            </View>
                          )}
                          <View style={{ flex: 1 }}>
                            <Text style={{ fontSize: 15, fontWeight: '600', color: '#1e293b' }}>{f.name}</Text>
                            <Text style={{ fontSize: 12, color: '#64748b', marginTop: 1 }}>{f.email}</Text>
                          </View>
                          <View style={{ width: 22, height: 22, borderRadius: 11, borderWidth: 2, borderColor: isSelected ? Colors.primary : '#cbd5e1', backgroundColor: isSelected ? Colors.primary : '#fff', alignItems: 'center', justifyContent: 'center' }}>
                            {isSelected && <Text style={{ fontFamily: 'Material Symbols Outlined', fontSize: 13, color: '#fff' }}>check</Text>}
                          </View>
                        </TouchableOpacity>
                      );
                    })}
                    {friends.length === 0 && !showDirectAdd && (
                      <View style={{ alignItems: 'center', paddingVertical: 36 }}>
                        <Text style={{ fontFamily: 'Material Symbols Outlined', fontSize: 44, color: '#e2e8f0' }}>group_add</Text>
                        <Text style={{ marginTop: 10, color: '#94a3b8', fontSize: 14, textAlign: 'center', paddingHorizontal: 24 }}>
                          {q ? t('chat_details.add_member_no_results') : t('chat_details.add_member_no_friends')}
                        </Text>
                      </View>
                    )}
                  </>
                );
              })()}
            </ScrollView>
            {/* Footer */}
            <View style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 14, borderTopWidth: 1, borderTopColor: '#f1f5f9' }}>
              <Text style={{ flex: 1, fontSize: 14, color: '#64748b' }}>{t('chat_details.add_member_selected', { count: selectedEmails.length })}</Text>
              <TouchableOpacity
                onPress={() => { setShowAddMemberModal(false); setSelectedEmails([]); }}
                style={{ paddingHorizontal: 18, paddingVertical: 9, borderRadius: 8, backgroundColor: '#f1f5f9', marginRight: 10 }}>
                <Text style={{ fontSize: 15, fontWeight: '600', color: '#475569' }}>{t('common.cancel')}</Text>
              </TouchableOpacity>
              <TouchableOpacity
                disabled={selectedEmails.length === 0 || addingMembers}
                onPress={async () => {
                  if (selectedEmails.length === 0) return;
                  setAddingMembers(true);
                  try {
                    await addMembers(conversationId, selectedEmails);
                    setShowAddMemberModal(false);
                    setSelectedEmails([]);
                  } catch (err: any) {
                    Alert.alert(t('common.error'), err?.message || t('chat_details.add_member_error'));
                  } finally {
                    setAddingMembers(false);
                  }
                }}
                style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 18, paddingVertical: 9, borderRadius: 8, backgroundColor: selectedEmails.length > 0 ? Colors.primary : '#e2e8f0' }}>
                {addingMembers ? (
                  <ActivityIndicator size="small" color="#fff" />
                ) : (
                  <>
                    <Text style={{ fontFamily: 'Material Symbols Outlined', fontSize: 16, color: selectedEmails.length > 0 ? '#fff' : '#94a3b8', marginRight: 4 }}>person_add</Text>
                    <Text style={{ fontSize: 15, fontWeight: '700', color: selectedEmails.length > 0 ? '#fff' : '#94a3b8' }}>{t('common.confirm')}</Text>
                  </>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      <Modal
        visible={showAliasModal}
        transparent
        animationType="fade"
        onRequestClose={() => setShowAliasModal(false)}
      >
        <View style={styles.modalBackdrop}>
          <View style={styles.aliasModalCard}>
            <Text style={styles.aliasModalTitle}>{t('chat_details.alias_title')}</Text>
            <Text style={styles.aliasModalSubtitle}>{t('chat_details.alias_subtitle')}</Text>
            <TextInput
              value={aliasDraft}
              onChangeText={setAliasDraft}
              placeholder={t('chat_details.alias_placeholder')}
              style={styles.aliasInput}
              autoFocus
            />
            <View style={styles.aliasActions}>
              <TouchableOpacity style={styles.aliasCancelBtn} onPress={() => setShowAliasModal(false)}>
                <Text style={styles.aliasCancelText}>{t('common.cancel')}</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.aliasSaveBtn, savingAlias && { opacity: 0.6 }]}
                onPress={handleSaveAlias}
                disabled={savingAlias}
              >
                <Text style={styles.aliasSaveText}>{savingAlias ? t('common.saving') : t('common.save')}</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      <Modal
        visible={showWallpaperModal}
        transparent
        animationType="fade"
        onRequestClose={() => setShowWallpaperModal(false)}
      >
        <View style={styles.modalBackdrop}>
          <View style={[styles.aliasModalCard, { maxWidth: 420, maxHeight: '86%' }]}>
            <Text style={styles.aliasModalTitle}>{t('chat_details.wallpaper_title')}</Text>
            <Text style={styles.aliasModalSubtitle}>{t('chat_details.wallpaper_subtitle')}</Text>
            <ScrollView showsVerticalScrollIndicator={false}>
              <View style={styles.wallpaperGrid}>
                {CHAT_WALLPAPERS.map((item) => {
                  const selected = selectedWallpaperId === item.id;
                  return (
                    <TouchableOpacity
                      key={item.id}
                      activeOpacity={0.85}
                      style={[styles.wallpaperOption, selected && styles.wallpaperOptionSelected]}
                      onPress={() => setSelectedWallpaperId(item.id)}
                    >
                      <Image source={item.lightSource} style={styles.wallpaperImage} resizeMode="cover" />
                      <View style={styles.wallpaperShade}>
                        <Text style={styles.wallpaperLabel}>{item.label}</Text>
                      </View>
                      {selected && (
                        <View style={styles.wallpaperCheck}>
                          <Text style={styles.wallpaperCheckIcon}>check</Text>
                        </View>
                      )}
                    </TouchableOpacity>
                  );
                })}
              </View>
            </ScrollView>
            <View style={styles.aliasActions}>
              <TouchableOpacity style={styles.aliasCancelBtn} onPress={() => setShowWallpaperModal(false)}>
                <Text style={styles.aliasCancelText}>{t('common.cancel')}</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.aliasSaveBtn} onPress={handleSaveWallpaper}>
                <Text style={styles.aliasSaveText}>{t('common.save')}</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      <Modal
        visible={showMuteMenuModal}
        transparent
        animationType="fade"
        onRequestClose={() => setShowMuteMenuModal(false)}
      >
        <View style={styles.modalBackdrop}>
          <View style={styles.aliasModalCard}>
            <Text style={styles.aliasModalTitle}>{t('chat.chat_notifications')}</Text>
            <Text style={styles.aliasModalSubtitle}>{t('chat.mute_time_desc')}</Text>
            {[
              { label: t('chat.mute_1h'), action: () => handleSelectMuteSchedule('1h') },
              { label: t('chat.mute_4h'), action: () => handleSelectMuteSchedule('4h') },
              { label: t('chat_details.mute_12h'), action: () => handleSelectMuteSchedule('12h') },
              { label: t('chat.mute_8am'), action: () => handleSelectMuteSchedule('morning') },
              { label: t('chat.mute_custom'), action: () => setShowCustomMuteModal(true) },
              { label: t('chat_details.mute_forever'), action: () => handleSelectMuteSchedule('forever') },
            ].map((item) => (
              <TouchableOpacity
                key={item.label}
                style={{ paddingVertical: 13, borderBottomWidth: 1, borderBottomColor: '#eef2f7' }}
                onPress={item.action}
              >
                <Text style={styles.menuText}>{item.label}</Text>
              </TouchableOpacity>
            ))}
            <TouchableOpacity style={[styles.aliasCancelBtn, { marginTop: 14, alignItems: 'center' }]} onPress={() => setShowMuteMenuModal(false)}>
              <Text style={styles.aliasCancelText}>{t('common.cancel')}</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      <Modal
        visible={showCustomMuteModal}
        transparent
        animationType="fade"
        onRequestClose={() => setShowCustomMuteModal(false)}
      >
        <View style={styles.modalBackdrop}>
          <View style={styles.aliasModalCard}>
            <Text style={styles.aliasModalTitle}>{t('chat.custom_mute_title')}</Text>
            <Text style={styles.aliasModalSubtitle}>{t('chat.custom_mute_desc')}</Text>
            <View style={{ flexDirection: 'row', gap: 12 }}>
              <View style={{ flex: 1 }}>
                <Text style={[styles.subText, { marginBottom: 6 }]}>{t('chat_details.from')}</Text>
                <TextInput
                  value={customMuteStartTime}
                  onChangeText={setCustomMuteStartTime}
                  placeholder="22:00"
                  style={styles.aliasInput}
                  autoCapitalize="none"
                  autoCorrect={false}
                  keyboardType="numbers-and-punctuation"
                  maxLength={5}
                />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={[styles.subText, { marginBottom: 6 }]}>{t('chat_details.to')}</Text>
                <TextInput
                  value={customMuteEndTime}
                  onChangeText={setCustomMuteEndTime}
                  placeholder="07:00"
                  style={styles.aliasInput}
                  autoCapitalize="none"
                  autoCorrect={false}
                  keyboardType="numbers-and-punctuation"
                  maxLength={5}
                />
              </View>
            </View>
            <View style={styles.aliasActions}>
              <TouchableOpacity style={styles.aliasCancelBtn} onPress={() => setShowCustomMuteModal(false)}>
                <Text style={styles.aliasCancelText}>{t('common.cancel')}</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.aliasSaveBtn} onPress={handleApplyCustomMuteSchedule}>
                <Text style={styles.aliasSaveText}>{t('common.save')}</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Prompt Modal */}
      <Modal
        visible={promptConfig.visible}
        transparent
        animationType="fade"
        onRequestClose={() => setPromptConfig(prev => ({ ...prev, visible: false }))}
      >
        <View style={styles.modalBackdrop}>
          <View style={styles.aliasModalCard}>
            <Text style={styles.aliasModalTitle}>{promptConfig.title}</Text>
            {!!promptConfig.message && <Text style={styles.aliasModalSubtitle}>{promptConfig.message}</Text>}
            <TextInput
              value={promptConfig.value}
              onChangeText={(text) => setPromptConfig(prev => ({ ...prev, value: text }))}
              placeholder={promptConfig.placeholder}
              style={styles.aliasInput}
              autoFocus
              keyboardType={promptConfig.keyboardType}
              autoCapitalize="none"
            />
            <View style={styles.aliasActions}>
              <TouchableOpacity style={styles.aliasCancelBtn} onPress={() => setPromptConfig(prev => ({ ...prev, visible: false }))}>
                <Text style={styles.aliasCancelText}>{t('common.cancel')}</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.aliasSaveBtn}
                onPress={() => {
                  promptConfig.onSubmit(promptConfig.value);
                  setPromptConfig(prev => ({ ...prev, visible: false }));
                }}
              >
                <Text style={styles.aliasSaveText}>{t('common.confirm')}</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Share Group Modal */}
      <Modal visible={showShareModal} transparent animationType="fade" onRequestClose={() => setShowShareModal(false)}>
        <View style={styles.modalBackdrop}>
          <View style={styles.aliasModalCard}>
            <View style={{flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16}}>
              <Text style={styles.aliasModalTitle}>{t('chat_details.share_group') || 'Chia sẻ nhóm'}</Text>
              <TouchableOpacity onPress={() => setShowShareModal(false)} style={{padding: 4}}>
                <Text style={{fontFamily: 'Material Symbols Outlined', fontSize: 24, color: '#757575'}}>close</Text>
              </TouchableOpacity>
            </View>
            <View style={{alignItems: 'center', marginBottom: 20}}>
              <View style={{backgroundColor: '#fff', padding: 16, borderRadius: 16, borderWidth: 1, borderColor: '#eee', marginBottom: 16}}>
                <QRCode value={joinLink} size={180} />
              </View>
              <Text style={{fontSize: 13, color: '#666', textAlign: 'center', marginBottom: 16}}>
                {t('chat_details.share_group_desc') || 'Quét mã QR bằng camera hoặc chia sẻ đường link bên dưới để mời mọi người tham gia nhóm.'}
              </Text>
              <View style={{flexDirection: 'row', alignItems: 'center', backgroundColor: '#f3f4f6', padding: 8, borderRadius: 12, width: '100%'}}>
                <TextInput 
                  value={joinLink} 
                  editable={false} 
                  style={{flex: 1, color: '#111827', fontSize: 13, marginRight: 8}} 
                />
                <TouchableOpacity onPress={handleCopyJoinLink} style={{backgroundColor: '#dbeafe', paddingHorizontal: 12, paddingVertical: 8, borderRadius: 8}}>
                  <Text style={{color: '#2563eb', fontWeight: 'bold', fontSize: 12}}>Copy</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
};



export default ChatDetailsScreen;
