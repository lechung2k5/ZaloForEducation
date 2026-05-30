import React, { useState, useRef } from 'react';
import { View, Text, StyleSheet, Image, Pressable, TouchableOpacity, Linking, ActivityIndicator, Animated, PanResponder, Dimensions, Platform } from 'react-native';
import { Video, ResizeMode, Audio } from 'expo-av';
import Alert from '../../utils/Alert';
import { LinearGradient } from 'expo-linear-gradient';
import { useTheme } from '../../context/ThemeContext';
import { Typography } from '../../constants/Theme';
import { useAuth } from '../../context/AuthContext';
import MediaViewerModal from './MediaViewerModal';
import { downloadAndOpenFile } from '../../utils/fileHelper';
import FluentEmoji from '../common/FluentEmoji';
import { FLUENT_EMOJI_MAP } from '../../constants/Emojis';
import { useNavigation } from '@react-navigation/native';
import PollMessage from './PollMessage';
import ReminderMessage from './ReminderMessage';
import CodeSnippet from './CodeSnippet';
import * as Haptics from 'expo-haptics';
import { chatGet, chatPost } from '../../utils/api';
import { useChatStore } from '../../store/chatStore';

// Safe wrapper to prevent crashes when native module is missing (e.g., during fast refresh on Android)
const safeHaptic = (style: Haptics.ImpactFeedbackStyle) => {
  try {
    if (Platform.OS !== 'web') {
      Haptics.impactAsync(style).catch(() => {
        // ignore promise rejections
      });
    }
  } catch (err) {
    // ignore synchronous errors
  }
};

const DEFAULT_AVATAR = { uri: "https://ui-avatars.com/api/?name=UniChat&background=0052AA&color=fff&bold=true" };

const getDisplayAvatar = (userId?: string, userProfile?: any) => {
  if (userId && userId.toLowerCase() === 'bot@unichat.system') {
    return { uri: "https://api.dicebear.com/9.x/bottts-neutral/png?seed=UniBotPremium&backgroundColor=0284c7,0ea5e9&radius=50" };
  }
  if (userProfile?.avatarUrl) {
    return { uri: userProfile.avatarUrl };
  }
  return DEFAULT_AVATAR;
};



interface Attachment {
  url: string;
  fileUrl?: string;
  dataUrl: string;
  name: string;
  fileName?: string;
  mimeType: string;
  fileType?: string;
  size: number;
  isSticker?: boolean;
}

const normalizeAttachment = (attachment: any): Attachment => {
  if (!attachment || typeof attachment !== 'object') return {
    url: '',
    dataUrl: '',
    name: 'Unknown File',
    mimeType: 'application/octet-stream',
    size: 0
  };
  return {
    ...attachment,
    url: attachment.url || attachment.fileUrl || attachment.dataUrl || '',
    dataUrl: attachment.dataUrl || attachment.fileUrl || attachment.url || '',
    name: attachment.name || attachment.fileName || 'Unknown File',
    mimeType: attachment.mimeType || attachment.fileType || 'application/octet-stream',
    size: attachment.size || 0
  };
};

const formatFileSize = (bytes: number) => {
  if (!bytes || bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
};

const getFileIcon = (mimeType: string, fileName: string) => {
  const mime = String(mimeType || "").toLowerCase();
  const name = String(fileName || "").toLowerCase();

  if (mime.startsWith("image/") || /\.(jpg|jpeg|png|gif|webp)$/i.test(name)) return "image";
  if (mime.startsWith("video/") || /\.(mp4|mov|avi|wmv)$/i.test(name)) return "movie";
  if (mime.startsWith("audio/") || /\.(mp3|wav|ogg|m4a)$/i.test(name)) return "audio_file";
  if (mime.includes("pdf") || /\.pdf$/i.test(name)) return "picture_as_pdf";
  if (/\.(zip|rar|7z|tar|gz)$/i.test(name)) return "folder_zip";
  if (/\.(doc|docx)$/i.test(name)) return "description";
  if (/\.(xls|xlsx|csv)$/i.test(name)) return "table_chart";
  return "draft";
};

const isVideoAttachment = (item: any) => {
  const mime = String(item?.mimeType || item?.fileType || '').toLowerCase();
  const name = String(item?.name || item?.fileName || item?.url || item?.dataUrl || '').toLowerCase();
  return mime.startsWith('video/') || /\.(mp4|mov|avi|wmv|webm|mkv)(\?.*)?$/.test(name);
};

const isStickerMedia = (item: any) => {
  const mime = String(item?.mimeType || item?.fileType || '').toLowerCase();
  return mime.includes('sticker') || item?.isSticker === true;
};

const AudioPlayer = ({ url, isMe, title }: { url: string; isMe: boolean; title?: string }) => {
  const { colors, t, isDark } = useTheme();
  const styles = React.useMemo(() => getStyles(colors, isDark), [colors, isDark]);
  const displayTitle = title || t('msg_bubble.voice_msg');
  const [sound, setSound] = useState<Audio.Sound | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [position, setPosition] = useState(0);
  const [duration, setDuration] = useState(0);
  const [isLoading, setIsLoading] = useState(false);
  const [trackWidth, setTrackWidth] = useState(0);

  const onPlaybackStatusUpdate = (status: any) => {
    if (status.isLoaded) {
      setPosition(status.positionMillis);
      setDuration(status.durationMillis || 0);
      setIsPlaying(status.isPlaying);
      if (status.didJustFinish) {
        setIsPlaying(false);
        setPosition(0);
      }
    } else if (status.error) {
      console.error(`Playback Error: ${status.error}`);
    }
  };

  const playPause = async () => {
    try {
      if (sound) {
        if (isPlaying) {
          await sound.pauseAsync();
        } else {
          await sound.playAsync();
        }
      } else {
        setIsLoading(true);
        const { sound: newSound } = await Audio.Sound.createAsync(
          { uri: url },
          { shouldPlay: true },
          onPlaybackStatusUpdate
        );
        setSound(newSound);
        setIsLoading(false);
      }
    } catch (e) {
      console.warn('Audio play error', e);
      setIsLoading(false);
    }
  };

  const handleSeek = async (e: any) => {
    if (!sound || duration <= 0 || trackWidth <= 0) return;
    const { locationX } = e.nativeEvent;
    const percentage = locationX / trackWidth;
    const seekPosition = percentage * duration;
    try {
      await sound.setPositionAsync(seekPosition);
      setPosition(seekPosition);
    } catch (err) {
      console.warn("Seek error", err);
    }
  };

  React.useEffect(() => {
    return () => {
      if (sound) {
        sound.unloadAsync();
      }
    };
  }, [sound]);

  const formatTime = (ms: number) => {
    if (!ms || ms <= 0) return '0:00';
    const totalSecs = Math.floor(ms / 1000);
    const mins = Math.floor(totalSecs / 60);
    const secs = totalSecs % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  return (
    <View style={[styles.audioPlayer, isMe && styles.audioPlayerMe]}>
      <TouchableOpacity onPress={playPause} style={styles.audioPlayBtn} disabled={isLoading}>
        {isLoading ? (
          <ActivityIndicator color="#fff" size="small" />
        ) : (
          <Text style={[styles.audioPlayIcon, isMe && styles.audioPlayIconMe]}>
            {isPlaying ? 'pause' : 'play_arrow'}
          </Text>
        )}
      </TouchableOpacity>
      <View style={styles.audioProgress}>
        <View style={styles.audioHeader}>
          <Text style={[styles.audioLabel, isMe && styles.audioLabelMe]}>{displayTitle}</Text>
          <Text style={[styles.audioTime, isMe && styles.audioTimeMe]}>
            {duration > 0 ? formatTime(duration) : '--:--'}
          </Text>
        </View>
        <Pressable
          style={styles.audioTrack}
          onLayout={(e) => setTrackWidth(e.nativeEvent.layout.width)}
          onPress={handleSeek}
        >
          <View
            style={[
              styles.audioFill,
              { width: duration > 0 ? `${(position / duration) * 100}%` : '0%' },
              isMe && styles.audioFillMe
            ]}
          />
          <View style={[styles.audioKnob, { left: duration > 0 ? `${(position / duration) * 100}%` : '0%' }, isMe && styles.audioKnobMe]} />
        </Pressable>
        <Text style={[styles.audioPos, isMe && styles.audioPosMe]}>
          {formatTime(position)}
        </Text>
      </View>
    </View>
  );
};


const HighlightText = ({ text, keyword, style }: { text: string; keyword?: string; style: any }) => {
  const { isDark } = useTheme();
  if (!text) return <Text style={style}>{text}</Text>;

  // 1. Process links
  const urlRegex = /(https?:\/\/[^\s]+)/g;
  const parts = [];
  let lastIndex = 0;
  let match;

  while ((match = urlRegex.exec(text)) !== null) {
    if (match.index > lastIndex) {
      parts.push({ type: 'text', content: text.substring(lastIndex, match.index) });
    }
    parts.push({ type: 'link', content: match[1] });
    lastIndex = urlRegex.lastIndex;
  }
  if (lastIndex < text.length) {
    parts.push({ type: 'text', content: text.substring(lastIndex) });
  }

  // Helper to render text with highlight
  const renderTextWithHighlight = (input: string, keyPrefix: string) => {
    if (!keyword?.trim()) return <Text key={keyPrefix} style={style}>{input}</Text>;
    const escaped = keyword.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const segments = String(input).split(new RegExp(`(${escaped})`, 'gi'));
    return (
      <Text key={keyPrefix} style={style}>
        {segments.map((part, i) =>
          part.toLowerCase() === keyword.toLowerCase() ? (
            <Text key={`${keyPrefix}-${i}`} style={{ backgroundColor: isDark ? 'rgba(255,235,59,0.3)' : '#fff59d', fontWeight: 'bold' }}>
              {part}
            </Text>
          ) : (
            part
          ),
        )}
      </Text>
    );
  };

  return (
    <Text style={style}>
      {parts.map((part, index) => {
        if (part.type === 'link') {
          return (
            <Text
              key={`link-${index}`}
              style={[style, { color: isDark ? '#60a5fa' : '#2563eb', textDecorationLine: 'underline' }]}
              onPress={() => {
                Linking.openURL(part.content).catch(() => {
                  console.warn('Cannot open URL:', part.content);
                });
              }}
            >
              {part.content}
            </Text>
          );
        } else {
          return renderTextWithHighlight(part.content, `text-${index}`);
        }
      })}
    </Text>
  );
};


const MentionText = ({ text, mentions, keyword, style }: { text: string; mentions?: any[]; keyword?: string; style: any }) => {
  const { colors, isDark } = useTheme();
  const styles = React.useMemo(() => getStyles(colors, isDark), [colors, isDark]);

  const validMentions = Array.isArray(mentions)
    ? mentions
        .map((mention) => ({ ...mention, start: Number(mention.start), end: Number(mention.end) }))
        .filter((mention) => Number.isFinite(mention.start) && Number.isFinite(mention.end) && mention.start >= 0 && mention.end > mention.start && mention.end <= text.length)
        .sort((a, b) => a.start - b.start)
    : [];

  if (!validMentions.length) {
    return <HighlightText text={text} keyword={keyword} style={style} />;
  }

  const parts: Array<{ text: string; mention?: boolean }> = [];
  let cursor = 0;
  validMentions.forEach((mention) => {
    if (mention.start < cursor) return;
    if (mention.start > cursor) parts.push({ text: text.slice(cursor, mention.start) });
    parts.push({ text: text.slice(mention.start, mention.end), mention: true });
    cursor = mention.end;
  });
  if (cursor < text.length) parts.push({ text: text.slice(cursor) });

  return (
    <Text style={style}>
      {parts.map((part, index) => part.mention ? (
        <Text key={index} style={styles.mentionText}>{part.text}</Text>
      ) : (
        <HighlightText key={index} text={part.text} keyword={keyword} style={style} />
      ))}
    </Text>
  );
};

const GroupInviteBubble = ({ groupId }: { groupId: string }) => {
  const { colors, t, isDark } = useTheme();
  const styles = React.useMemo(() => getStyles(colors, isDark), [colors, isDark]);
  const [preview, setPreview] = React.useState<any>(null);
  const [loading, setLoading] = React.useState(true);
  const [joining, setJoining] = React.useState(false);
  const navigation = useNavigation<any>();

  React.useEffect(() => {
    const fetchPreview = async () => {
      try {
        const res = await chatGet(`/conversations/${encodeURIComponent(groupId)}/preview`);
        setPreview(res?.data);
      } catch (err) {
        console.warn("Failed to fetch invite preview", err);
      } finally {
        setLoading(false);
      }
    };
    fetchPreview();
  }, [groupId]);

  const handleJoin = async () => {
    setJoining(true);
    try {
      const res = await chatPost(`/conversations/${encodeURIComponent(groupId)}/join`, {});

      if (!res.ok) {
        Alert.alert(t('chat.status_error'), res.message || t('chat.status_error'));
        return;
      }

      await useChatStore.getState().fetchConversations();

      if (res.message === "─É├ú l├á th├ánh vi├¬n") {
        Alert.alert(t("common.notice"), t("msg_bubble.already_member"), [
          { text: t("msg_bubble.enter_group"), onPress: () => navigation.navigate("Chat", { conversationId: groupId }) }
        ]);
      } else {
        Alert.alert(t("common.notice"), t("msg_bubble.join_success"), [
          { text: "OK", onPress: () => navigation.navigate("Chat", { conversationId: groupId }) }
        ]);
      }
    } catch (err: any) {
      console.log("Join error:", err);
      Alert.alert(t('chat.status_error'), err.response?.data?.message || t('chat.status_error'));
    } finally {
      setJoining(false);
    }
  };

  if (loading) {
    return (
      <View style={styles.inviteBubble}>
        <ActivityIndicator size="small" color={colors.primary} />
        <Text style={styles.inviteLoadingText}>{t('msg_bubble.loading_group')}</Text>
      </View>
    );
  }

  if (!preview) return null;

  return (
    <View style={styles.inviteBubble}>
      <View style={styles.inviteRow}>
        <Image source={{ uri: preview.avatarUrl || 'https://via.placeholder.com/150' }} style={styles.inviteAvatar} />
        <View style={styles.inviteInfo}>
          <Text style={styles.inviteName} numberOfLines={1}>{preview.name}</Text>
          <Text style={styles.inviteMembers}>{preview.memberCount} th├ánh vi├¬n</Text>
        </View>
      </View>
      <TouchableOpacity style={styles.inviteBtn} onPress={handleJoin} disabled={joining}>
        {joining ? (
          <ActivityIndicator size="small" color="#fff" />
        ) : (
          <Text style={styles.inviteBtnText}>{t('msg_bubble.join_now')}</Text>
        )}
      </TouchableOpacity>
    </View>
  );
};

export default function MessageBubble({
  message,
  isMe,
  userProfile,
  onLongPress,
  onPress,
  onReaction,
  onReply,
  onSystemMessagePress,
  isHighlighted,
  highlightKeyword,
  userProfiles,
  onReplyPress,
  showAvatar,
  groupPosition,
  isSeen,
  onNavigate,
  isSelectionMode,
  isSelected,
  onVotePoll,
  onClosePoll
}: {
  message: any;
  isMe: boolean;
  userProfile?: any;
  onLongPress: (message: any) => void;
  onReaction: (message: any, emoji: string) => void;
  onReply: (message: any) => void;
  onSystemMessagePress?: (targetId: string) => void;
  isHighlighted?: boolean;
  highlightKeyword?: string;
  userProfiles?: Record<string, any>;
  onReplyPress?: (messageId: string) => void;
  showAvatar?: boolean;
  groupPosition?: 'first' | 'middle' | 'last' | 'single';
  isSeen?: boolean;
  onNavigate?: (screen: string, params?: any) => void;
  onPress?: (message: any) => void;
  onVotePoll?: (messageId: string, optionIndex: number) => Promise<void>;
  onClosePoll?: (messageId: string) => Promise<void>;
  isSelectionMode?: boolean;
  isSelected?: boolean;
}) {
  const { colors, t, isDark } = useTheme();
  const styles = React.useMemo(() => getStyles(colors, isDark), [colors, isDark]);
  const navigate = useNavigation<any>();
  const { user }: any = useAuth();

  const isMediaOnly = (() => {
    if (message.audioUrl || message.contactCard || message.location) return true;
    if (!message.content) return true;
    const placeholders = [t('msg_bubble.image'), `[${t('msg_bubble.voice_msg')}]`, '[Ghi âm]', t('msg_bubble.file'), '[Sticker]', '[Ảnh/Video]', '[Danh thiếp]', '[Vị trí]'];
    if (placeholders.some(p => message.content.startsWith(p))) {
      return (message.media && message.media.length > 0) || (message.files && message.files.length > 0) || !!message.audioUrl || !!message.contactCard || !!message.location;
    }
    return false;
  })();

  const isSticker = (() => {
    if (message.media && message.media.length === 1) {
      return isStickerMedia(message.media[0]);
    }
    return false;
  })();

  const shouldHideBubble = isMediaOnly || isSticker || !!message.contactCard || !!message.location || !!message.audioUrl || message.type === 'poll' || message.type === 'reminder';

  // HIGHLIGHT ANIMATION
  const highlightAnim = useRef(new Animated.Value(0)).current;
  React.useEffect(() => {
    if (isHighlighted) {
      Animated.sequence([
        Animated.timing(highlightAnim, { toValue: 1, duration: 400, useNativeDriver: false }),
        Animated.timing(highlightAnim, { toValue: 0, duration: 400, useNativeDriver: false }),
        Animated.timing(highlightAnim, { toValue: 1, duration: 400, useNativeDriver: false }),
        Animated.timing(highlightAnim, { toValue: 0, duration: 400, useNativeDriver: false }),
        Animated.timing(highlightAnim, { toValue: 1, duration: 400, useNativeDriver: false }),
      ]).start();
    } else {
      highlightAnim.setValue(0);
    }
  }, [isHighlighted]);

  const highlightBg = highlightAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ['transparent', 'rgba(255, 213, 79, 0.8)'] // Stronger Amber/Yellow
  });

  // SWIPE TO REPLY LOGIC
  const translateX = useRef(new Animated.Value(0)).current;
  const swipeThreshold = 60;

  const panResponder = useRef(
    PanResponder.create({
      onMoveShouldSetPanResponder: (_, gestureState) => {
        return Math.abs(gestureState.dx) > 10 && Math.abs(gestureState.dy) < 10;
      },
      onPanResponderMove: (_, gestureState) => {
        if (gestureState.dx > 0) { // Swipe right to reply
          translateX.setValue(gestureState.dx);
        }
      },
      onPanResponderRelease: (_, gestureState) => {
        if (gestureState.dx > swipeThreshold) {
          onReply({
            ...message,
            senderName: (() => {
              const replySender = String(message.senderId || "").trim().toLowerCase();
              if (replySender === String(user?.email || "").trim().toLowerCase()) return t('common.you');
              const p = userProfiles?.[replySender];
              return p?.nickname || p?.fullName || p?.fullname || replySender;
            })()
          });
        }
        Animated.spring(translateX, {
          toValue: 0,
          useNativeDriver: true,
          bounciness: 12,
        }).start();
      },
    })
  ).current;

  const replyIconOpacity = translateX.interpolate({
    inputRange: [0, swipeThreshold],
    outputRange: [0, 1],
    extrapolate: 'clamp',
  });

  const replyIconScale = translateX.interpolate({
    inputRange: [0, swipeThreshold],
    outputRange: [0.5, 1.2],
    extrapolate: 'clamp',
  });

  const isRecalled = !!message.recalled;
  const isPinned = !!message.pinned;

  const handleImagePress = (item: any) => {
    console.log('[MessageBubble] Image/Video pressed:', item.name);
    if (isRecalled) return;
    if (onNavigate) {
      onNavigate('MediaDetail', {
        url: item.url || item.dataUrl,
        name: item.name,
        mimeType: item.mimeType || item.fileType
      });
    }
  };

  const handleFilePress = (file: any) => {
    console.log('[MessageBubble] File pressed:', file.name);
    if (isRecalled) return;
    downloadAndOpenFile(file.url || file.dataUrl, file.name, file.mimeType);
  };

  const reactionSummary: [string, any][] = [];
  if (message.reactions) {
    Object.entries(message.reactions).forEach(([emoji, users]) => {
      if (users && (users as any).length > 0) {
        reactionSummary.push([emoji, users]);
      }
    });
  }

  // System Message
  if (message.type === 'system') {
    const targetId = message.metadata?.targetMessageId;

    let displayContent = message.content;
    try {
      const parsed = JSON.parse(message.content);
      if (parsed.action) {
        const getDisplayName = (email: string) => {
          if (!email) return t('common.user');
          const myEmail = user?.email?.toLowerCase();
          const targetEmail = email.trim().toLowerCase();
          if (targetEmail === myEmail) return t('common.you');
          const p = userProfiles?.[targetEmail];
          return p?.nickname || p?.fullName || p?.fullname || email.split('@')[0];
        };

        const actorLabel = getDisplayName(parsed.actor);
        const targetLabel = parsed.target ? getDisplayName(parsed.target) : '';

        switch (parsed.action) {
          case 'member_added':
            displayContent = t('chat.sys_member_added', { actor: actorLabel, target: targetLabel });
            break;
          case 'member_removed':
          case 'member_kicked':
            displayContent = t('chat.sys_member_removed', { actor: actorLabel, target: targetLabel });
            break;
          case 'member_left':
            displayContent = t('chat.sys_member_left', { actor: actorLabel });
            break;
          case 'promoted_to_deputy':
            displayContent = t('chat.sys_promoted_deputy', { actor: actorLabel, target: targetLabel });
            break;
          case 'demoted_from_deputy':
          case 'demoted_to_member':
            displayContent = t('chat.sys_demoted_member', { actor: actorLabel, target: targetLabel });
            break;
          case 'ownership_transferred':
          case 'transferred_owner':
            displayContent = t('chat.sys_transfer_owner', { actor: actorLabel, target: targetLabel });
            break;
          case 'pin_message':
            displayContent = t('chat.sys_pin_message', { actor: actorLabel });
            break;
          case 'unpin_message':
            displayContent = t('chat.sys_unpin_message', { actor: actorLabel });
            break;
          case 'role_updated':
            const roleName = parsed.role === 'owner' ? t('chat.role_owner') : parsed.role === 'deputy' ? t('chat.role_deputy') : t('chat.role_member');
            displayContent = t('chat.sys_role_updated', { actor: actorLabel, target: targetLabel, roleName });
            break;
          case 'info_updated':
            displayContent = t('chat.sys_info_updated', { actor: actorLabel });
            break;
          case 'group_name_updated':
            displayContent = t('chat.sys_name_updated', { actor: actorLabel });
            break;
          case 'group_avatar_updated':
            displayContent = t('chat.sys_avatar_updated', { actor: actorLabel });
            break;
          case 'group_created':
            displayContent = t('chat.sys_group_created', { actor: actorLabel });
            break;
          default:
            displayContent = t('chat.sys_default', { actor: actorLabel });
            break;
        }
      }
    } catch (e) {
      // Fallback to raw content
    }

    return (
      <View style={styles.systemContainer}>
        <TouchableOpacity
          activeOpacity={targetId ? 0.7 : 1}
          onPress={() => targetId && onSystemMessagePress && onSystemMessagePress(targetId)}
          style={[styles.systemBadge, targetId && { borderBottomWidth: 1, borderBottomColor: 'rgba(0,0,0,0.1)' }]}
        >
          <Text style={styles.systemText}>{displayContent}</Text>
        </TouchableOpacity>
        <Text style={styles.systemTime}>
          {new Date(message.createdAt || Date.now()).toLocaleTimeString('vi-VN', {
            hour: '2-digit', minute: '2-digit'
          })}
        </Text>
      </View>
    );
  }

  const lastPressRef = useRef<number>(0);
  const handleBubblePress = () => {
    const now = Date.now();
    if (now - lastPressRef.current < 300) {
      // Double tap
      if (!isRecalled) {
        safeHaptic(Haptics.ImpactFeedbackStyle.Medium);
        onReaction(message, 'Γ¥ñ∩╕Å');
      }
    } else {
      // Single tap
      if (isSelectionMode && onPress) onPress(message);
    }
    lastPressRef.current = now;
  };

  const handleBubbleLongPress = () => {
    if (!isRecalled) {
      safeHaptic(Haptics.ImpactFeedbackStyle.Heavy);
      onLongPress(message);
    }
  };

  const RenderBubbleContent = () => (
    <>
      {message.replyTo && (
        <TouchableOpacity
          activeOpacity={0.8}
          onPress={() => onReplyPress && onReplyPress(message.replyTo.id)}
          style={[styles.replyBox, isMe && styles.replyBoxMe]}
        >
          <View style={styles.replyContentRow}>
            <View style={styles.replyTextColumn}>
              <Text style={[styles.replyHeader, isMe && styles.replyHeaderTextMe]} numberOfLines={1}>
                {(() => {
                  const replySender = String(message.replyTo.senderId || "").trim().toLowerCase();
                  if (replySender === String(user?.email || "").trim().toLowerCase()) return t('common.you');
                  const p = userProfiles?.[replySender];
                  return p?.nickname || p?.fullName || p?.fullname || replySender || t('common.user');
                })()}
              </Text>
              <Text style={[styles.replyContent, isMe && styles.replyContentTextMe]} numberOfLines={1}>
                {message.replyTo.content || (message.replyTo.media?.length ? t('msg_bubble.image') : message.replyTo.files?.length ? t('msg_bubble.file') : t('msg_bubble.message'))}
              </Text>
            </View>
            {(message.replyTo.media && message.replyTo.media.length > 0) && (
              <Image
                source={{ uri: message.replyTo.media[0].url || message.replyTo.media[0].dataUrl }}
                style={styles.replyImagePreview}
              />
            )}
          </View>
        </TouchableOpacity>
      )}

      {isRecalled ? (
        <Text style={[styles.messageText, styles.recalledText, isMe && styles.messageTextMe]}>
          {t('chat.message_recalled')}
        </Text>
      ) : (
        <>
          {message.content && !isMediaOnly ? (
            <MentionText
              text={message.content}
              mentions={message.mentions || message.payload?.mentions}
              keyword={highlightKeyword}
              style={[styles.messageText, isMe ? styles.messageTextMe : styles.messageTextOther]}
            />
          ) : null}

          {message.media && message.media.length > 0 && (
            <View style={styles.mediaContainer}>
              {(() => {
                const videos = message.media.filter(isVideoAttachment);
                const images = message.media.filter((m: any) => !isVideoAttachment(m));

                return (
                  <>
                    {videos.length > 0 && (
                      <View style={[styles.videoGrid, images.length > 0 && { marginBottom: 8 }]}>
                        {videos.map((item: any, idx: number) => (
                          <TouchableOpacity
                            key={`vid-${idx}`}
                            style={[styles.videoBox, videos.length === 1 && styles.singleVideoBox]}
                            onPress={() => handleImagePress(item)}
                          >
                            <Image
                              source={(item.url || item.dataUrl) ? { uri: item.url || item.dataUrl } : DEFAULT_AVATAR}
                              style={styles.mediaImage}
                              resizeMode="cover"
                            />
                            <View style={styles.videoOverlay}>
                              <View style={styles.playButtonCircle}>
                                <Text style={styles.playIcon}>play_arrow</Text>
                              </View>
                              <View style={styles.videoBadge}>
                                <Text style={styles.videoBadgeText}>VIDEO</Text>
                              </View>
                            </View>
                          </TouchableOpacity>
                        ))}
                      </View>
                    )}

                    {images.length > 0 && (
                      <View style={[
                        styles.imageGrid,
                        images.length === 1 && styles.singleMediaGrid,
                        (images.length === 2 || images.length === 4) && styles.twoColumnGrid
                      ]}>
                        {images.map((item: any, idx: number) => {
                          const isSticker = isStickerMedia(item);
                          return (
                            <TouchableOpacity
                              key={`img-${idx}`}
                              style={[
                                styles.imageBox,
                                images.length === 1 && styles.singleImageBox
                              ]}
                              onPress={() => handleImagePress(item)}
                            >
                              <Image
                                source={(item.url || item.dataUrl) ? { uri: item.url || item.dataUrl } : DEFAULT_AVATAR}
                                style={[
                                  styles.mediaImage,
                                  isSticker && styles.stickerImage,
                                  images.length === 1 && styles.singleMediaImage
                                ]}
                                resizeMode={isSticker ? "contain" : "cover"}
                              />
                            </TouchableOpacity>
                          );
                        })}
                      </View>
                    )}
                  </>
                );
              })()}
            </View>
          )}

          {/* 1. Special Cards (Location/Contact) */}
          {message.location && (
            <View style={styles.fileList}>
              <TouchableOpacity
                style={[styles.specialCard, isMe && styles.specialCardMe]}
                onPress={() => {
                  const url = Platform.select({
                    ios: `maps:0,0?q=${message.location.latitude},${message.location.longitude}`,
                    android: `geo:0,0?q=${message.location.latitude},${message.location.longitude}`
                  });
                  if (url) Linking.openURL(url);
                }}
              >
                <View style={[styles.specialIconBox, { backgroundColor: '#fff1f2' }]}>
                  <Text style={[styles.specialIcon, { color: '#f43f5e' }]}>location_on</Text>
                </View>
                <View style={styles.fileInfo}>
                  <Text style={[styles.fileName, isMe && styles.fileNameMe]}>{t('msg_bubble.current_location')}</Text>
                  <Text style={[styles.fileSize, isMe && styles.fileSizeMe]}>{message.location.label || 'Nhấn để xem bản đồ'}</Text>
                </View>
              </TouchableOpacity>
            </View>
          )}

          {message.contactCard && (
            <View style={styles.fileList}>
              <TouchableOpacity
                style={[styles.specialCard, isMe && styles.specialCardMe]}
                onPress={() => {
                  if (onNavigate) onNavigate('Profile', { userId: message.contactCard.email });
                }}
              >
                <View style={[styles.specialIconBox, { backgroundColor: '#f5f3ff' }]}>
                  <Image source={{ uri: message.contactCard.avatarUrl || 'https://via.placeholder.com/150' }} style={styles.specialAvatar} />
                </View>
                <View style={styles.fileInfo}>
                  <Text style={[styles.fileName, isMe && styles.fileNameMe]}>{message.contactCard.fullName || "Danh thiếp"}</Text>
                  <Text style={[styles.fileSize, isMe && styles.fileSizeMe]}>{t('msg_bubble.tap_to_view_profile')}</Text>
                </View>
              </TouchableOpacity>
            </View>
          )}

          {/* 2. Audio Player (Voice Message) */}
          {message.audioUrl ? (
            <View style={styles.fileList}>
              <AudioPlayer url={message.audioUrl} isMe={isMe} />
            </View>
          ) : null}

          {/* 3. Standard Files */}
          {message.files && message.files.length > 0 && (
            <View style={styles.fileList}>
              {message.files.map((file: any, idx: number) => {
                const f = normalizeAttachment(file);
                return (
                  <TouchableOpacity
                    key={idx}
                    style={[styles.fileCard, isMe && styles.fileCardMe]}
                    onPress={() => handleFilePress(f)}
                  >
                    <View style={styles.fileIconBox}>
                      <Text style={styles.fileIcon}>{getFileIcon(f.mimeType, f.name)}</Text>
                    </View>
                    <View style={styles.fileInfo}>
                      <Text style={[styles.fileName, isMe && styles.fileNameMe]} numberOfLines={1}>{f.name}</Text>
                      <Text style={[styles.fileSize, isMe && styles.fileSizeMe]}>{formatFileSize(f.size)}</Text>
                    </View>
                    <View style={styles.downloadIconBox}>
                      <Text style={[styles.downloadIcon, isMe && styles.downloadIconMe]}>download</Text>
                    </View>
                  </TouchableOpacity>
                );
              })}
            </View>
          )}

          {/* 4. Polls */}
          {!message.recalled && (message.poll || message.payload?.poll) && (
            <PollMessage
              messageId={message.id}
              topic={(message.poll || message.payload?.poll).topic || ''}
              options={(message.poll || message.payload?.poll).options || []}
              votes={(message.poll || message.payload?.poll).votes || {}}
              senderEmail={message.senderId}
              onVote={onVotePoll}
              onClosePoll={() => onClosePoll ? onClosePoll(message.id) : Promise.resolve()}
              isClosed={(message.poll || message.payload?.poll).isClosed}
              userProfiles={userProfiles}
            />
          )}

          {/* 5. Reminders */}
          {!message.recalled && (message.reminder || message.payload?.reminder) && (
            <ReminderMessage
              messageId={message.id}
              content={(message.reminder || message.payload?.reminder).content || (message.reminder || message.payload?.reminder).title}
              time={(message.reminder || message.payload?.reminder).time}
              date={(message.reminder || message.payload?.reminder).date}
              repeatType={(message.reminder || message.payload?.reminder).repeatType}
            />
          )}
        </>
      )}
    </>
  );

  return (
    <View style={[
      styles.container,
      isMe ? styles.containerMe : styles.containerOther,
      (message.poll || message.payload?.poll) && { alignSelf: 'center', width: '100%', paddingHorizontal: 10 },
      groupPosition === 'middle' || groupPosition === 'last' ? { marginBottom: 2 } : { marginBottom: 8 }
    ]}>
      {/* Swipe Reply Icon Indicator */}
      <Animated.View style={[
        styles.replySwipeIndicator,
        {
          opacity: replyIconOpacity,
          transform: [{ scale: replyIconScale }, { translateX: -20 }]
        }
      ]}>
        <Text style={styles.replySwipeIcon}>reply</Text>
      </Animated.View>

      <Animated.View
        {...panResponder.panHandlers}
        style={[
          { flexDirection: 'row', flex: 1, alignItems: 'flex-end', justifyContent: (message.poll || message.payload?.poll) ? 'center' : (isMe ? 'flex-end' : 'flex-start') },
          { transform: [{ translateX }] }
        ]}
      >
        {!isMe && !(message.poll || message.payload?.poll) && (
          <View style={styles.avatarSpace}>
            {showAvatar ? (
              <Image
                source={userProfile?.avatarUrl ? { uri: userProfile.avatarUrl } : DEFAULT_AVATAR}
                style={styles.avatar}
              />
            ) : null}
          </View>
        )}

        <View style={[
          styles.bubbleWrapper,
          isMe ? styles.bubbleWrapperMe : styles.bubbleWrapperOther,
          (message.poll || message.payload?.poll) && { maxWidth: '85%', alignSelf: 'center' }
        ]}>
          {isHighlighted && (
            <Animated.View
              style={[
                StyleSheet.absoluteFill,
                { backgroundColor: highlightBg, borderRadius: 20, zIndex: -1, borderWidth: 2, borderColor: '#ffb300' }
              ]}
            />
          )}
          {isSelectionMode && (
            <View style={[styles.selectionBadge, isSelected && styles.selectionBadgeActive]}>
              <Text style={styles.selectionBadgeText}>{isSelected ? 'check_circle' : 'radio_button_unchecked'}</Text>
            </View>
          )}
          {/* Name and Pin Header - Only show if pinned */}
          {isPinned && (
            <View style={styles.headerRow}>
              <View style={styles.pinBadge}>
                <Text style={styles.pinIcon}>push_pin</Text>
                <Text style={styles.pinText}>{t('msg_bubble.pinned')}</Text>
              </View>
            </View>
          )}

          <Pressable
            onLongPress={handleBubbleLongPress}
            onPress={handleBubblePress}
            delayLongPress={300}
          >
            {shouldHideBubble ? (
              <View style={[
                styles.noBubble,
                isHighlighted && styles.bubbleHighlighted,
                isSelected && styles.bubbleSelected
              ]}>
                <RenderBubbleContent />
              </View>
            ) : isMe ? (
              <LinearGradient
                colors={isHighlighted ? (isDark ? ['#fbc02d', '#f57f17'] : ['#fff176', '#ffd54f']) : (isMe ? (isDark ? ['#1a3a5c', '#12263d'] : ['#e3f2fd', '#bbdefb']) : (isDark ? ['#1f2438', '#1f2438'] : ['#ffffff', '#ffffff']))}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={[
                  styles.bubble,
                  isMe ? styles.bubbleMe : styles.bubbleOther,
                  groupPosition === 'first' && (isMe ? styles.firstMe : styles.firstOther),
                  groupPosition === 'middle' && (isMe ? styles.middleMe : styles.middleOther),
                  groupPosition === 'last' && (isMe ? styles.lastMe : styles.lastOther),
                  isHighlighted && styles.bubbleHighlighted,
                  isSelected && styles.bubbleSelected
                ]}
              >
                <RenderBubbleContent />
              </LinearGradient>
            ) : (
              <View
                style={[
                  styles.bubble,
                  styles.bubbleOther,
                  groupPosition === 'first' && styles.firstOther,
                  groupPosition === 'middle' && styles.middleOther,
                  groupPosition === 'last' && styles.lastOther,
                  isHighlighted && styles.bubbleHighlighted,
                  isSelected && styles.bubbleSelected
                ]}
              >
                <RenderBubbleContent />
              </View>
            )}
          </Pressable>


          {message.reactions && reactionSummary.length > 0 && (
            <View style={[styles.reactionSummary, isMe ? styles.reactionSummaryMe : styles.reactionSummaryOther]}>
              {reactionSummary.map(([emoji, users], idx) => (
                <TouchableOpacity key={idx} style={styles.reactionBadge} onPress={() => onReaction(message, emoji)}>
                  <FluentEmoji emoji={emoji} style={styles.reactionEmojiIcon} />
                  <Text style={styles.reactionCount}>{users.length}</Text>
                </TouchableOpacity>
              ))}
            </View>
          )}

          {(groupPosition === 'last' || groupPosition === 'single' || (isMe && message.status)) && (
            <View style={[styles.footerRow, isMe && styles.footerRowMe]}>
              {(groupPosition === 'last' || groupPosition === 'single') && (
                <View style={styles.footerMetaPill}>
                  <Text style={styles.timeText}>
                    {new Date(message.createdAt || Date.now()).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })}
                  </Text>
                </View>
              )}

              {isMe && (
                <View style={styles.statusWrapper}>
                  {message.status === 'sending' ? (
                    <View style={[styles.statusPill, { backgroundColor: '#eff6ff' }]}>
                      <View style={styles.statusCircle} />
                      <Text style={styles.statusText}>{t('chat.status_sending')}</Text>
                    </View>
                  ) : message.status === 'error' ? (
                    <View style={[styles.statusPill, { backgroundColor: '#fef2f2' }]}>
                      <View style={[styles.statusCircle, { borderColor: '#ef4444' }]}>
                        <Text style={[styles.statusCheck, { color: '#ef4444' }]}>!</Text>
                      </View>
                      <Text style={[styles.statusText, { color: '#dc2626' }]}>{t('chat.status_error')}</Text>
                    </View>
                  ) : isSeen ? (
                    <View style={[styles.statusPill, { backgroundColor: '#e0f2fe' }]}>
                      <Image source={userProfile?.avatarUrl ? { uri: userProfile.avatarUrl } : DEFAULT_AVATAR} style={styles.seenAvatar} />
                      <Text style={[styles.statusText, { color: '#0369a1', fontWeight: '800' }]}>{t('chat.status_read')}</Text>
                    </View>
                  ) : (
                    <View style={[styles.statusPill, { backgroundColor: '#f8fafc' }]}>
                      <View style={[styles.statusCircle, styles.statusSent]}>
                        <Text style={styles.statusCheck}>✓</Text>
                      </View>
                      <Text style={styles.statusText}>{t('chat.status_sent')}</Text>
                    </View>
                  )}
                </View>
              )}
            </View>
          )}
        </View>
      </Animated.View>
    </View>
  );
}

const getStyles = (colors: any, isDark: boolean) => StyleSheet.create({
  noBubble: {
    backgroundColor: 'transparent',
    overflow: 'hidden',
  },
  container: {
    flexDirection: 'row',
    marginBottom: 4,
    alignItems: 'flex-end',
    paddingHorizontal: 8,
  },
  containerMe: {
    justifyContent: 'flex-end',
  },
  containerOther: {
    justifyContent: 'flex-start',
  },
  avatar: {
    width: 28,
    height: 28,
    borderRadius: 14,
    marginRight: 6,
    marginBottom: 2,
  },
  bubbleWrapper: {
    flexShrink: 1,
  },
  bubbleWrapperMe: {
    alignItems: 'flex-end',
    maxWidth: '75%',
  },
  bubbleWrapperOther: {
    alignItems: 'flex-start',
    maxWidth: '75%',
  },
  selectionBadge: {
    position: 'absolute',
    top: -8,
    right: -6,
    zIndex: 20,
    backgroundColor: '#fff',
    borderRadius: 12,
  },
  selectionBadgeActive: {
    backgroundColor: '#eff6ff',
  },
  selectionBadgeText: {
    fontFamily: 'Material Symbols Outlined',
    fontSize: 20,
    color: colors.primary,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 2,
    gap: 4,
  },
  bubble: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 24,
    alignSelf: 'flex-start',
    maxWidth: '100%',
    minHeight: 44,
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: isDark ? 0.3 : 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  bubbleHighlighted: {
    backgroundColor: isDark ? 'rgba(253,216,53,0.18)' : '#fffde7',
    borderColor: '#fdd835',
    borderWidth: 2,
    elevation: 4,
    shadowOpacity: 0.2,
  },
  bubbleSelected: {
    borderColor: colors.primary,
    borderWidth: 2,
  },
  bubbleMe: {
    backgroundColor: isDark ? '#1a3a5c' : '#e3f2fd',
    alignSelf: 'flex-end',
    borderBottomRightRadius: 6,
    borderWidth: 1,
    borderColor: isDark ? '#2563eb' : '#bbdefb',
  },
  bubbleOther: {
    backgroundColor: isDark ? '#1f2438' : '#ffffff',
    borderWidth: 1,
    borderColor: isDark ? '#3a3f52' : 'rgba(0,0,0,0.06)',
    alignSelf: 'flex-start',
    borderBottomLeftRadius: 6,
  },
  firstMe: { borderTopRightRadius: 24, borderBottomRightRadius: 6 },
  middleMe: { borderTopRightRadius: 6, borderBottomRightRadius: 6 },
  lastMe: { borderTopRightRadius: 6, borderBottomRightRadius: 24 },
  firstOther: { borderTopLeftRadius: 24, borderBottomLeftRadius: 6 },
  middleOther: { borderTopLeftRadius: 6, borderBottomLeftRadius: 6 },
  lastOther: { borderTopLeftRadius: 6, borderBottomLeftRadius: 24 },
  messageText: {
    fontSize: 16,
    lineHeight: 22,
    color: isDark ? '#e8eef7' : '#1f2937',
    fontWeight: '500',
  },
  messageTextMe: {
    color: isDark ? '#dbeafe' : '#1f2937',
  },
  messageTextOther: {
    color: isDark ? '#e8eef7' : '#1f2937',
  },
  mentionText: {
    color: isDark ? '#60a5fa' : colors.primary,
    fontWeight: '900',
  },
  recalledText: {
    fontStyle: 'italic',
    opacity: 0.6,
  },
  replyBox: {
    backgroundColor: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0, 0, 0, 0.04)',
    borderLeftWidth: 3,
    borderLeftColor: colors.primary,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 12,
    marginBottom: 8,
    minWidth: 160,
  },
  replyContentRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  replyTextColumn: {
    flex: 1,
  },
  replyImagePreview: {
    width: 36,
    height: 36,
    borderRadius: 4,
    backgroundColor: isDark ? '#2a2f42' : '#eee',
  },
  replyBoxMe: {
    backgroundColor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)',
    borderLeftColor: colors.primary,
  },
  replyHeader: {
    fontSize: 13,
    fontWeight: '700',
    color: isDark ? '#e8eef7' : '#000',
    marginBottom: 2,
  },
  replyHeaderTextMe: {
    color: isDark ? '#93c5fd' : colors.primary,
    opacity: 0.9,
  },
  replyContent: {
    fontSize: 13,
    color: isDark ? '#9ca3b5' : '#666',
  },
  replyContentTextMe: {
    color: isDark ? '#bfdbfe' : '#333',
    opacity: 0.8,
  },
  mediaContainer: {
    marginTop: 4,
    gap: 4,
  },
  imageGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 4,
  },
  singleMediaGrid: {
    flexDirection: 'column',
    flexWrap: 'nowrap',
  },
  twoColumnGrid: {
    width: 270,
  },
  imageBox: {
    width: 84,
    height: 84,
    borderRadius: 8,
    overflow: 'hidden',
  },
  singleImageBox: {
    width: 220,
    height: 220,
    borderRadius: 16,
  },
  mediaImage: {
    width: '100%',
    height: '100%',
    backgroundColor: 'rgba(0,0,0,0.05)',
  },
  singleMediaImage: {
    borderRadius: 16,
  },
  stickerImage: {
    backgroundColor: 'transparent',
  },
  videoGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 4,
  },
  videoBox: {
    width: '100%',
    aspectRatio: 16 / 9,
    backgroundColor: '#000',
    borderRadius: 12,
    overflow: 'hidden',
  },
  singleVideoBox: {
    maxWidth: 300,
  },
  playButtonCircle: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: 'rgba(255,255,255,0.3)',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.5)',
  },
  playIcon: {
    fontFamily: 'Material Symbols Outlined',
    fontSize: 32,
    color: '#fff',
    marginLeft: 4,
  },
  videoBadge: {
    position: 'absolute',
    bottom: 8,
    right: 8,
    backgroundColor: 'rgba(0,0,0,0.6)',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  videoBadgeText: {
    color: '#fff',
    fontSize: 10,
    fontWeight: 'bold',
  },
  videoOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.2)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  videoIcon: {
    fontFamily: 'Material Symbols Outlined',
    fontSize: 48,
    color: '#fff',
    opacity: 0.9,
  },
  fileList: {
    gap: 6,
    marginTop: 4,
  },
  fileCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.04)',
    padding: 8,
    borderRadius: 12,
    width: 220,
  },
  fileCardMe: {
    backgroundColor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.05)',
  },
  fileIconBox: {
    width: 32,
    height: 32,
    backgroundColor: isDark ? '#2a2f42' : '#fff',
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 8,
  },
  fileIcon: {
    fontFamily: 'Material Symbols Outlined',
    fontSize: 18,
    color: colors.primary,
  },
  fileInfo: {
    flex: 1,
  },
  fileName: {
    fontSize: 13,
    fontWeight: '700',
    color: isDark ? '#e8eef7' : '#1f2631',
  },
  fileNameMe: {
    color: isDark ? '#dbeafe' : '#1f2631',
  },
  fileSize: {
    fontSize: 10,
    color: isDark ? '#9ca3b5' : '#6b7280',
  },
  fileSizeMe: {
    color: isDark ? '#93c5fd' : '#555',
  },
  downloadIconBox: {
    padding: 6,
    marginLeft: 4,
    borderRadius: 20,
    backgroundColor: isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.03)',
  },
  downloadIcon: {
    fontFamily: 'Material Symbols Outlined',
    fontSize: 18,
    color: isDark ? '#9ca3b5' : '#64748b',
  },
  downloadIconMe: {
    color: isDark ? '#93c5fd' : '#5a6781',
  },
  specialCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: isDark ? '#1f2438' : '#fff',
    padding: 12,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: isDark ? '#3a3f52' : '#eee',
    minWidth: 200,
    marginTop: 4,
  },
  specialCardMe: {
    backgroundColor: isDark ? '#1a3a5c' : 'rgba(255,255,255,0.7)',
  },
  specialIconBox: {
    width: 44,
    height: 44,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  specialIcon: {
    fontFamily: 'Material Symbols Outlined',
    fontSize: 24,
  },
  specialAvatar: {
    width: 44,
    height: 44,
    borderRadius: 12,
  },
  reactionSummary: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginTop: 2,
    marginBottom: 4,
    zIndex: 10,
    gap: 4,
  },
  reactionSummaryMe: {
    alignSelf: 'flex-end',
    marginRight: 4,
  },
  reactionSummaryOther: {
    alignSelf: 'flex-start',
    marginLeft: 4,
  },
  reactionBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: isDark ? '#2a2f42' : '#fff',
    borderWidth: 1,
    borderColor: isDark ? '#464d5f' : 'rgba(0,0,0,0.05)',
    borderRadius: 20,
    paddingHorizontal: 10,
    height: 28,
    gap: 4,
    elevation: 3,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: isDark ? 0.4 : 0.1,
    shadowRadius: 3,
  },
  reactionEmojiIcon: {
    width: 18,
    height: 18,
  },
  reactionCount: {
    fontSize: 9,
    fontWeight: '800',
    color: isDark ? '#9ca3b5' : '#64748b',
  },
  footerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 4,
    gap: 6,
  },
  footerRowMe: {
    justifyContent: 'flex-end',
    alignSelf: 'flex-end',
  },
  timeText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#9ba3b2',
  },
  statusWrapper: {
    marginLeft: 0,
  },
  footerMetaPill: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 999,
    backgroundColor: 'rgba(255,255,255,0.72)',
  },
  statusPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 999,
  },
  statusCircle: {
    width: 14,
    height: 14,
    borderRadius: 7,
    borderWidth: 1,
    borderColor: '#0084ff',
    alignItems: 'center',
    justifyContent: 'center',
  },
  statusSent: {
    backgroundColor: '#0084ff',
  },
  statusCheck: {
    color: '#fff',
    fontSize: 8,
    fontWeight: 'bold',
  },
  statusText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#64748b',
  },
  seenAvatar: {
    width: 14,
    height: 14,
    borderRadius: 7,
  },
  seenAvatarUI: {
    width: 16,
    height: 16,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#fff',
    backgroundColor: '#eee'
  },
  avatarSpace: {
    width: 28,
    marginRight: 6,
    justifyContent: 'flex-end',
  },
  systemContainer: {
    alignItems: 'center',
    marginVertical: 12,
  },
  systemBadge: {
    backgroundColor: isDark ? 'rgba(255,255,255,0.07)' : 'rgba(0,0,0,0.05)',
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 12,
  },
  systemText: {
    fontSize: 11,
    fontWeight: '700',
    color: isDark ? '#9ca3b5' : '#5a6781',
  },
  systemTime: {
    fontSize: 9,
    color: isDark ? '#6b7280' : '#9ba3b2',
    marginTop: 2,
  },
  pinBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: isDark ? 'rgba(253,216,53,0.12)' : '#fff9c4',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: isDark ? 'rgba(255,214,0,0.4)' : '#ffd600',
    marginBottom: 4,
  },
  pinIcon: {
    fontFamily: 'Material Symbols Outlined',
    fontSize: 12,
    color: isDark ? '#fbbf24' : '#f57f17',
    marginRight: 4,
  },
  pinText: {
    fontSize: 10,
    fontWeight: '700',
    color: isDark ? '#fbbf24' : '#f57f17',
  },
  audioPlayer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: isDark ? '#1f2438' : '#fff',
    padding: 12,
    borderRadius: 20,
    width: 250,
    marginTop: 4,
    borderWidth: 1,
    borderColor: isDark ? '#3a3f52' : '#e2e8f0',
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: isDark ? 0.4 : 0.05,
    shadowRadius: 4,
  },
  audioPlayerMe: {
    backgroundColor: isDark ? '#1a3a5c' : 'rgba(255,255,255,0.85)',
  },
  audioPlayBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  audioPlayIcon: {
    fontFamily: 'Material Symbols Outlined',
    fontSize: 22,
    color: '#fff',
  },
  audioPlayIconMe: {
    color: '#fff',
  },
  audioProgress: {
    flex: 1,
  },
  audioHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  audioLabel: {
    fontSize: 10,
    fontWeight: '800',
    color: colors.primary,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  audioLabelMe: {
    color: colors.primary,
  },
  audioTrack: {
    height: 6,
    backgroundColor: isDark ? '#3a3f52' : '#e2e8f0',
    borderRadius: 3,
    position: 'relative',
    marginVertical: 4,
  },
  audioFill: {
    height: '100%',
    backgroundColor: colors.primary,
    borderRadius: 3,
  },
  audioFillMe: {
    backgroundColor: colors.primary,
  },
  audioKnob: {
    position: 'absolute',
    top: -3,
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: colors.primary,
    marginLeft: -6,
    borderWidth: 2,
    borderColor: isDark ? '#1f2438' : '#fff',
    elevation: 3,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.2,
    shadowRadius: 1,
  },
  audioKnobMe: {
    backgroundColor: colors.primary,
  },
  audioTime: {
    fontSize: 10,
    color: isDark ? '#9ca3b5' : '#64748b',
    fontWeight: '700',
  },
  audioTimeMe: {
    color: isDark ? '#93c5fd' : '#5a6781',
  },
  audioPos: {
    fontSize: 9,
    color: isDark ? '#6b7280' : '#94a3b8',
    fontWeight: '600',
  },
  audioPosMe: {
    color: isDark ? '#6b7280' : '#94a3b8',
  },
  replySwipeIndicator: {
    position: 'absolute',
    left: -40,
    top: '30%',
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: 'rgba(0,0,0,0.05)',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: -1,
  },
  replySwipeIcon: {
    fontFamily: 'Material Symbols Outlined',
    fontSize: 18,
    color: '#666',
  },
  inviteBubble: {
    minWidth: 220,
    maxWidth: '100%',
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 12,
    borderWidth: 1,
    borderColor: 'rgba(0,0,0,0.05)',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  inviteLoadingText: {
    fontSize: 12,
    color: '#64748b',
    marginTop: 8,
    textAlign: 'center',
  },
  inviteRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  inviteAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    marginRight: 10,
    borderWidth: 1,
    borderColor: '#f1f5f9',
  },
  inviteInfo: {
    flex: 1,
  },
  inviteName: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#1e293b',
  },
  inviteMembers: {
    fontSize: 11,
    color: '#64748b',
    marginTop: 2,
  },
  inviteBtn: {
    backgroundColor: colors.primary,
    paddingVertical: 8,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  inviteBtnText: {
    color: '#fff',
    fontSize: 13,
    fontWeight: 'bold',
  }
});
