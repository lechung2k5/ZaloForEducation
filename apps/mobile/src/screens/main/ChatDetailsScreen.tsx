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
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { Colors } from '../../constants/Theme';
import { useChatStore } from '../../store/chatStore';
import { useAuth } from '../../context/AuthContext';
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

  if (!chat) return null;

  const chatName = chat.alias || profile?.nickname || profile?.fullName || profile?.fullname || partnerEmail || chat.name || "Hội thoại";
  const chatAvatar = profile?.avatarUrl || profile?.urlAvatar || chat.avatar || '';
  const isMuted = isConversationMuted(conversationId);
  const isPinned = !!chat?.pinned;
  const isHidden = !!chat?.hidden;

  const isBot = partnerEmail === 'bot@UniChat.system';

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
        "Xóa lịch sử trò chuyện",
        "Chọn phạm vi xóa tin nhắn:",
        [
          { text: "Hủy", style: "cancel" },
          {
            text: "Xóa phía tôi",
            onPress: async () => {
              try {
                await clearHistory(conversationId, false);
                Alert.alert("Thành công", "Đã xóa lịch sử trò chuyện phía bạn.", [
                  { text: "OK", onPress: () => navigation.goBack() }
                ]);
              } catch (err) {
                Alert.alert("Lỗi", "Không thể xóa lịch sử");
              }
            }
          },
          {
            text: "Xóa của tất cả thành viên",
            style: "destructive",
            onPress: async () => {
              try {
                await clearHistory(conversationId, true);
                Alert.alert("Thành công", "Đã xóa toàn bộ lịch sử trò chuyện.", [
                  { text: "OK", onPress: () => navigation.goBack() }
                ]);
              } catch (err) {
                Alert.alert("Lỗi", "Không thể xóa lịch sử");
              }
            }
          },
        ]
      );
    } else {
      Alert.alert(
        "Xóa lịch sử trò chuyện",
        "Bạn có chắc chắn muốn xóa toàn bộ tin nhắn? Hành động này không thể hoàn tác.",
        [
          { text: "Hủy", style: "cancel" },
          {
            text: "Xóa",
            style: "destructive",
            onPress: async () => {
              try {
                await clearHistory(conversationId, false);
                Alert.alert("Thành công", "Đã xóa lịch sử trò chuyện.", [
                  { text: "OK", onPress: () => navigation.goBack() }
                ]);
              } catch (err) {
                Alert.alert("Lỗi", "Không thể xóa lịch sử");
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
        "Chuyển quyền Trưởng nhóm",
        "Bạn là Trưởng nhóm. Hãy chọn người nhận quyền Trưởng nhóm trước khi rời:",
        [
          { text: "Hủy", style: "cancel" },
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
      "Rời nhóm",
      "Bạn sẽ không còn nhận được tin nhắn từ nhóm này.",
      [
        { text: "Hủy", style: "cancel" },
        {
          text: "Rời nhóm",
          style: "destructive",
          onPress: async () => {
            try {
              await removeMember(conversationId, user?.email || "");
              navigation.navigate('Main');
            } catch (err: any) { Alert.alert("Lỗi", err.response?.data?.message || "Không thể rời nhóm"); }
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
      Alert.alert('Lỗi', err.response?.data?.message || 'Không thể chuyển quyền và rời nhóm');
    }
  };

  const handleDissolveGroup = () => {
    Alert.alert(
      "Giải tán nhóm",
      "Tất cả thành viên sẽ bị xóa và lịch sử chat sẽ bị xóa.",
      [
        { text: "Hủy", style: "cancel" },
        { 
          text: "Giải tán", 
          style: "destructive",
          onPress: async () => {
            try {
              await dissolveGroup(conversationId);
              navigation.navigate('Main');
            } catch (err: any) { Alert.alert("Lỗi", err.response?.data?.message || "Không thể giải tán nhóm"); }
          }
        }
      ]
    );
  };

  const handleKickMember = (email: string) => {
    Alert.alert(
      "Xóa thành viên",
      `Xóa ${email} khỏi nhóm?`,
      [
        { text: "Hủy", style: "cancel" },
        { 
          text: "Xóa", 
          style: "destructive",
          onPress: async () => {
            try {
              await removeMember(conversationId, email);
            } catch (err: any) { Alert.alert("Lỗi", err.response?.data?.message || "Không thể xóa thành viên"); }
          }
        }
      ]
    );
  };

  const handleChangeRole = (email: string, role: 'owner' | 'deputy' | 'member') => {
    const label = role === 'owner' ? 'Trưởng nhóm' : role === 'deputy' ? 'Phó nhóm' : 'Thành viên';
    Alert.alert(
      "Thay đổi vai trò",
      `Đặt ${email} làm ${label}?`,
      [
        { text: "Hủy", style: "cancel" },
        { 
          text: "Xác nhận", 
          onPress: async () => {
            try {
              await updateMemberRole(conversationId, email, role);
            } catch (err: any) { Alert.alert("Lỗi", err.response?.data?.message || "Không thể đổi vai trò"); }
          }
        }
      ]
    );
  };

  const handleUpdateGroupName = () => {
    setPromptConfig({
      visible: true,
      title: "Đổi tên nhóm",
      message: "Nhập tên nhóm mới",
      placeholder: "Tên nhóm...",
      value: chat?.name || '',
      keyboardType: "default",
      onSubmit: async (newName: string) => {
        if (!newName || !newName.trim()) {
          Alert.alert("Lỗi", "Tên nhóm không được để trống");
          return;
        }
        try {
          await updateGroupInfo(conversationId, { name: newName.trim() });
        } catch (err: any) { 
          Alert.alert("Lỗi", "Không thể đổi tên"); 
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
          Alert.alert("Lỗi", "Không thể tải ảnh lên");
        }
      } catch (err) {
        Alert.alert("Lỗi", "Không thể cập nhật ảnh đại diện");
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
      Alert.alert('Đã cập nhật', nextPinned ? 'Cuộc trò chuyện đã được ghim.' : 'Đã bỏ ghim cuộc trò chuyện.');
    } catch {
      Alert.alert('Không thể cập nhật', 'Vui lòng thử lại sau.');
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
      Alert.alert('KhÃ´ng thá»ƒ lÆ°u', 'Vui lÃ²ng thá»­ láº¡i sau.');
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
      Alert.alert('Thông báo', schedule ? getMuteLabel(schedule) : 'Đã tắt thông báo cho đến khi bạn bật lại.');
    } catch {
      Alert.alert('Không thể cập nhật', 'Vui lòng thử lại sau.');
    }
  };

  const handleApplyCustomMuteSchedule = async () => {
    if (!isValidTimeString(customMuteStartTime) || !isValidTimeString(customMuteEndTime)) {
      Alert.alert('Lỗi', 'Giờ không hợp lệ. Vui lòng nhập theo định dạng HH:mm.');
      return;
    }

    const schedule = createCustomWindowMuteSchedule(customMuteStartTime, customMuteEndTime);
    try {
      await persistMuteSchedule(conversationId, schedule);
      await setConversationMuted(conversationId, true);
      setShowCustomMuteModal(false);
      setShowMuteMenuModal(false);
      Alert.alert('Thông báo', getMuteLabel(schedule));
    } catch {
      Alert.alert('Không thể cập nhật', 'Vui lòng thử lại sau.');
    }
  };

  const handleToggleMute = () => {
    if (isMuted) {
      Alert.alert(
        "Bật thông báo",
        "Bật lại thông báo cho cuộc trò chuyện này?",
        [
          { text: "Hủy", style: "cancel" },
          {
            text: "Bật",
            onPress: async () => {
              try {
                await persistMuteSchedule(conversationId, null);
                await clearConversationMuted(conversationId);
                Alert.alert("Đã bật thông báo", "Cuộc trò chuyện này sẽ nhận thông báo trở lại.");
              } catch {
                Alert.alert("Không thể cập nhật", "Vui lòng thử lại sau.");
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
      'Chặn người dùng',
      `Chặn ${chatName} khỏi danh bạ?`,
      [
        { text: 'Hủy', style: 'cancel' },
        {
          text: 'Chặn',
          style: 'destructive',
          onPress: async () => {
            try {
              const res = await chatPost('/friends/block', { targetEmail: partnerEmail });
              if (!res?.ok) throw new Error('BLOCK_FAILED');
              Alert.alert('Đã chặn', 'Bạn có thể quản lý danh sách chặn trong Danh bạ.');
              navigation.navigate('Main', { screen: 'Contacts' });
            } catch {
              Alert.alert('Không thể chặn', 'Vui lòng thử lại sau.');
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
      'Dung lượng trò chuyện',
      `Số tin nhắn đính kèm: ${allAttachments.length}\nDung lượng ước tính: ${totalMB} MB`,
      [
        { text: 'Đóng', style: 'cancel' },
        { text: 'Mở kho lưu trữ', onPress: () => navigation.navigate('ChatGallery', { conversationId }) },
      ]
    );
  };

  const handleAutoDelete = () => {
    Alert.alert(
      'Tin nhắn tự xóa',
      'Chọn thời hạn tự xóa tin nhắn cũ',
      [
        { text: 'Hủy', style: 'cancel' },
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
              Alert.alert('Đã lưu', `Tin nhắn sẽ tự xóa sau ${opt.days === 0 ? 'không bao giờ (đã tắt)' : `${opt.days} ngày`}.`);
            } catch {
              Alert.alert('Không thể lưu', 'Vui lòng thử lại sau.');
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
          Alert.alert('Nhóm chung', 'Bạn không có nhóm chung nào với người này.');
        } else {
          const groupNames = res.data.map((g: any) => g.name).join(', ');
          Alert.alert('Nhóm chung', `Bạn có ${res.data.length} nhóm chung:\n\n${groupNames}`);
        }
      } else {
        Alert.alert('Nhóm chung', 'Không thể tải danh sách nhóm chung.');
      }
    } catch (error) {
      console.error('Failed to fetch common groups', error);
      Alert.alert('Nhóm chung', 'Không thể tải danh sách nhóm chung.');
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

  return (
    <View style={styles.container}>
      {/* Header Bar */}
      <View style={[styles.header, { paddingTop: insets.top }]}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Text style={styles.headerIcon}>arrow_back_ios</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Tuỳ chọn</Text>
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
              <Text style={styles.actionLabel}>Tìm{"\n"}tin nhắn</Text>
            </TouchableOpacity>
            {!isBot && (
              <TouchableOpacity style={styles.actionItem} onPress={handleOpenProfile} disabled={!partnerEmail} activeOpacity={partnerEmail ? 0.85 : 1}>
                <View style={styles.actionCircle}><Text style={styles.actionIcon}>person</Text></View>
                <Text style={styles.actionLabel}>Trang{"\n"}cá nhân</Text>
              </TouchableOpacity>
            )}
              <TouchableOpacity style={styles.actionItem} onPress={handleChangeWallpaper}>
              <View style={styles.actionCircle}><Text style={styles.actionIcon}>palette</Text></View>
              <Text style={styles.actionLabel}>Đổi{"\n"}hình nền</Text>
            </TouchableOpacity>
              <TouchableOpacity style={styles.actionItem} onPress={handleToggleMute}>
              <View style={styles.actionCircle}><Text style={styles.actionIcon}>notifications_none</Text></View>
                <Text style={styles.actionLabel}>{isMuted ? 'Bật\nthông báo' : 'Tắt\nthông báo'}</Text>
            </TouchableOpacity>
          </View>
        </View>

        <View style={styles.divider} />

        {/* Settings List */}
        {!isBot && (
          <>
            {renderMenuItem("edit", "Đổi tên gợi nhớ", <Text style={styles.subText}>{chat.alias ? 'Đã đặt' : 'Chưa đặt'}</Text>, () => setShowAliasModal(true))}
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
              <Text style={styles.menuText}>Ảnh, file, link</Text>
            </View>
            <Text style={styles.chevron}>chevron_right</Text>
          </View>
          <View style={styles.assetSummaryRow}>
            <View style={styles.assetSummaryPill}>
              <Text style={styles.assetSummaryIcon}>image</Text>
              <Text style={styles.assetSummaryText}>{assetCounts.media} ảnh/video</Text>
            </View>
            <View style={styles.assetSummaryPill}>
              <Text style={styles.assetSummaryIcon}>description</Text>
              <Text style={styles.assetSummaryText}>{assetCounts.file} file</Text>
            </View>
            <View style={styles.assetSummaryPill}>
              <Text style={styles.assetSummaryIcon}>link</Text>
              <Text style={styles.assetSummaryText}>{assetCounts.link} link</Text>
            </View>
          </View>
          <View style={styles.mediaPreview}>
            {loadingMediaPreview ? (
              <ActivityIndicator size="small" color={Colors.primary} style={{ marginLeft: 16 }} />
            ) : mediaPreviewItems.length > 0 ? (
              mediaPreviewItems.map(renderAssetPreviewItem)
            ) : (
              <View style={styles.emptyMedia}><Text style={styles.emptyText}>Chưa có ảnh, file hoặc link</Text></View>
            )}
            <View style={styles.previewMore}>
              <Text style={styles.headerIcon}>arrow_forward</Text>
            </View>
          </View>
        </TouchableOpacity>

        <View style={styles.divider} />

        {!isBot && (
          <>
            <View style={styles.divider} />

            {renderMenuItem("groups", `Xem nhóm chung (${commonGroups.length})`, undefined, handleViewCommonGroups)}
          </>
        )}

        <View style={styles.divider} />

        {renderMenuItem(
          "push_pin",
          isPinned ? "Bỏ ghim trò chuyện" : "Ghim trò chuyện",
          <Text style={styles.subText}>{isPinned ? 'Đã ghim' : 'Chưa ghim'}</Text>,
          handleTogglePin
        )}
        {renderMenuItem(
          "visibility_off",
          isHidden ? "Hiện trò chuyện" : "Ẩn trò chuyện",
          <Text style={styles.subText}>{isHidden ? 'Đang ẩn' : 'Đang hiện'}</Text>,
          handleToggleHidden
        )}
        {renderMenuItem("notifications_none", isMuted ? "Bật thông báo" : "Tắt thông báo", 
          <Text style={styles.subText}>{isMuted ? 'Đang tắt' : 'Đang bật'}</Text>,
          handleToggleMute
        )}

        {renderMenuItem(
          "history", 
          "Tin nhắn tự xóa", 
          <Text style={styles.subText}>{autoDeleteDays === 0 ? 'Không tự xóa' : `${autoDeleteDays} ngày`}</Text>,
          handleAutoDelete
        )}

        <View style={styles.divider} />


        {!isBot && renderMenuItem("block", "Chặn người dùng", undefined, handleBlockUser, '#ef4444')}
        {renderMenuItem("storage", "Dung lượng trò chuyện", undefined, handleConversationStorage)}
        {renderMenuItem("delete_outline", "Xóa lịch sử trò chuyện", undefined, handleClearChat, '#ef4444')}

        {chat.type === 'group' && (
          <>
            <View style={styles.divider} />
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>Quản lý nhóm</Text>
            </View>
            {renderMenuItem("edit", "Đổi tên nhóm", undefined, handleUpdateGroupName)}
            {(chat.owner === user?.email || chat.admin === user?.email) && (
              renderMenuItem("delete_forever", "Giải tán nhóm", undefined, handleDissolveGroup, '#ef4444')
            )}
            {renderMenuItem("logout", "Rời nhóm", undefined, handleLeaveGroup, '#ef4444')}

            <View style={styles.divider} />
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>Thành viên ({chat.members?.length || 0})</Text>
            </View>
            <TouchableOpacity style={styles.addMemberBtn} onPress={() => {
               setPromptConfig({
                 visible: true,
                 title: "Thêm thành viên",
                 message: "Nhập email",
                 placeholder: "Email người dùng",
                 value: "",
                 keyboardType: 'email-address',
                 onSubmit: async (email: string) => {
                    if (email && email.trim()) await addMembers(conversationId, [email.trim()]);
                 }
               });
            }}>
               <Text style={styles.addMemberIcon}>add</Text>
               <Text style={styles.addMemberText}>Thêm thành viên</Text>
            </TouchableOpacity>

            {chat.members?.map((m: string) => {
               const p = userProfiles[m.trim().toLowerCase()];
               const isMe = m === user?.email;
               const isOwner = chat.owner === m || chat.admin === m;
               const isDeputy = (chat.deputies || []).includes(m);
               const myRole = (chat.owner === user?.email || chat.admin === user?.email) ? 'owner' : (chat.deputies || []).includes(user?.email || "") ? 'deputy' : 'member';

               return (
                 <View key={m} style={styles.memberItem}>
                    <Image source={avatarSource(p?.avatarUrl || p?.urlAvatar || p?.avatar)} style={styles.memberAvatar} />
                    <View style={styles.memberInfo}>
                       <Text style={styles.memberName}>{p?.nickname || p?.fullName || m} {isMe && "(Bạn)"}</Text>
                       <Text style={styles.memberRole}>
                          {isOwner ? "Trưởng nhóm" : isDeputy ? "Phó nhóm" : "Thành viên"}
                       </Text>
                    </View>
                    {!isMe && (
                       <View style={styles.memberActions}>
                          {myRole === 'owner' && (
                             <>
                                {!isOwner && (
                                   <TouchableOpacity onPress={() => handleChangeRole(m, isDeputy ? 'member' : 'deputy')}>
                                      <Text style={[styles.actionIconSm, { color: Colors.primary }]}>{isDeputy ? "shield_outlined" : "shield"}</Text>
                                   </TouchableOpacity>
                                )}
                                {!isOwner && (
                                   <TouchableOpacity onPress={() => handleChangeRole(m, 'owner')}>
                                      <Text style={[styles.actionIconSm, { color: '#f59e0b' }]}>star</Text>
                                   </TouchableOpacity>
                                )}
                             </>
                          )}
                          {(myRole === 'owner' || (myRole === 'deputy' && !isOwner && !isDeputy)) && (
                             <TouchableOpacity onPress={() => handleKickMember(m)}>
                                <Text style={[styles.actionIconSm, { color: '#ef4444' }]}>person_remove</Text>
                             </TouchableOpacity>
                          )}
                       </View>
                    )}
                 </View>
               );
            })}
          </>
        )}
      </ScrollView>

      <Modal
        visible={showAliasModal}
        transparent
        animationType="fade"
        onRequestClose={() => setShowAliasModal(false)}
      >
        <View style={styles.modalBackdrop}>
          <View style={styles.aliasModalCard}>
            <Text style={styles.aliasModalTitle}>Đổi tên gợi nhớ</Text>
            <Text style={styles.aliasModalSubtitle}>Tên này chỉ hiển thị trên thiết bị của bạn.</Text>
            <TextInput
              value={aliasDraft}
              onChangeText={setAliasDraft}
              placeholder="Nhập tên gợi nhớ"
              style={styles.aliasInput}
              autoFocus
            />
            <View style={styles.aliasActions}>
              <TouchableOpacity style={styles.aliasCancelBtn} onPress={() => setShowAliasModal(false)}>
                <Text style={styles.aliasCancelText}>Hủy</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.aliasSaveBtn, savingAlias && { opacity: 0.6 }]}
                onPress={handleSaveAlias}
                disabled={savingAlias}
              >
                <Text style={styles.aliasSaveText}>{savingAlias ? 'Đang lưu' : 'Lưu'}</Text>
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
            <Text style={styles.aliasModalTitle}>{'H\u00ecnh n\u1ec1n cu\u1ed9c tr\u00f2 chuy\u1ec7n'}</Text>
            <Text style={styles.aliasModalSubtitle}>{'Ch\u1ecdn h\u00ecnh n\u1ec1n gi\u00e1o d\u1ee5c gi\u1ed1ng phi\u00ean b\u1ea3n web'}</Text>
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
                <Text style={styles.aliasCancelText}>{'H\u1ee7y'}</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.aliasSaveBtn} onPress={handleSaveWallpaper}>
                <Text style={styles.aliasSaveText}>{'L\u01b0u'}</Text>
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
            <Text style={styles.aliasModalTitle}>Thông báo cuộc trò chuyện</Text>
            <Text style={styles.aliasModalSubtitle}>Chọn thời gian tắt thông báo</Text>
            {[
              { label: 'Tắt 1 giờ', action: () => handleSelectMuteSchedule('1h') },
              { label: 'Tắt 4 giờ', action: () => handleSelectMuteSchedule('4h') },
              { label: 'Tắt 12 giờ', action: () => handleSelectMuteSchedule('12h') },
              { label: 'Đến 8:00 sáng', action: () => handleSelectMuteSchedule('morning') },
              { label: 'Khung giờ tùy chỉnh', action: () => setShowCustomMuteModal(true) },
              { label: 'Cho đến khi bật lại', action: () => handleSelectMuteSchedule('forever') },
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
              <Text style={styles.aliasCancelText}>Hủy</Text>
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
            <Text style={styles.aliasModalTitle}>Khung giờ tắt thông báo</Text>
            <Text style={styles.aliasModalSubtitle}>Nhập giờ theo định dạng 24h HH:mm</Text>
            <View style={{ flexDirection: 'row', gap: 12 }}>
              <View style={{ flex: 1 }}>
                <Text style={[styles.subText, { marginBottom: 6 }]}>Từ</Text>
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
                <Text style={[styles.subText, { marginBottom: 6 }]}>Đến</Text>
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
                <Text style={styles.aliasCancelText}>Hủy</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.aliasSaveBtn} onPress={handleApplyCustomMuteSchedule}>
                <Text style={styles.aliasSaveText}>Lưu</Text>
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
                <Text style={styles.aliasCancelText}>Hủy</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.aliasSaveBtn}
                onPress={() => {
                  promptConfig.onSubmit(promptConfig.value);
                  setPromptConfig(prev => ({ ...prev, visible: false }));
                }}
              >
                <Text style={styles.aliasSaveText}>Xác nhận</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
};



export default ChatDetailsScreen;
