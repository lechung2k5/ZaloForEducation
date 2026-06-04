import React, {
  useRef,
  useEffect,
  useCallback,
  useState,
  memo,
  useMemo,
} from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  TextInput,
  Image,
  FlatList,
  SectionList,
  ActivityIndicator,
  Animated,
  Platform,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import styles from './style/SearchScreen.styles';
import { useSearchStore } from '../../store/searchStore';
import { useChatStore } from '../../store/chatStore';
import SafeImage from '../../components/common/SafeImage';
import { PinModal } from '../../components/home/PinModal';
import Alert from '../../utils/Alert';
import { useTheme } from '../../context/ThemeContext';
import { chatGet, chatPost } from '../../utils/api';
import {
  buildFriendSearchParams,
  getFriendAvatar,
  getFriendDisplayName,
  unpackFriendSearchResponse,
} from '../../utils/friendSearch';

// ─── Constants ────────────────────────────────────────────────────────────────

const DEFAULT_AVATAR = require('../../../assets/logo_blue.png');
const RESULTS_PER_PAGE = 5;

const getTagConfig = (t: any) => ({
  CONTACT: { label: t('search.contact'), color: '#0068FF' },
  CONVERSATION: { label: t('search.conversation'), color: '#9c27b0' },
  MESSAGE: { label: t('search.message_type'), color: '#00AA44' },
  FILE: { label: t('search.file'), color: '#FF6600' },
});

// ─── Utility: keyword highlighter ────────────────────────────────────────────

/**
 * Splits `text` around case-insensitive matches of `keyword` and wraps
 * each match in a bold blue <Text>. Returns an array safe for React Native.
 */
const highlightKeyword = (text: string, keyword: string) => {
  if (!text || !keyword?.trim()) return text;
  const escaped = keyword.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const parts = String(text).split(new RegExp(`(${escaped})`, 'gi'));
  return parts.map((part, i) =>
    part.toLowerCase() === keyword.toLowerCase() ? (
      <Text key={i} style={{ fontWeight: 'bold', color: '#0068FF' }}>
        {part}
      </Text>
    ) : (
      part
    ),
  );
};

const getFileIcon = (mimeType = "", fileName = "") => {
  const lowerName = String(fileName || "").toLowerCase();
  const lowerMime = String(mimeType || "").toLowerCase();
  if (lowerMime.includes("pdf") || lowerName.endsWith(".pdf"))
    return "picture_as_pdf";
  if (
    lowerMime.includes("word") ||
    lowerName.endsWith(".doc") ||
    lowerName.endsWith(".docx")
  )
    return "description";
  if (
    lowerMime.includes("excel") ||
    lowerName.endsWith(".xls") ||
    lowerName.endsWith(".xlsx")
  )
    return "table_chart";
  if (lowerMime.startsWith("image/")) return "image";
  if (lowerMime.startsWith("video/")) return "movie";
  return "draft";
};

const formatFileSize = (size: number | string) => {
  const n = Number(size || 0);
  if (!n) return "--";
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / (1024 * 1024)).toFixed(1)} MB`;
};

const formatTime = (date: string | number | Date) => {
  if (!date) return "";
  const d = new Date(date);
  return d.toLocaleTimeString("vi-VN", {
    hour: "2-digit",
    minute: "2-digit",
  });
};

// ─── SearchItem ───────────────────────────────────────────────────────────────
/**
 * Fully memoized result row.
 * Each item owns its own Animated.Value so animations never conflict.
 */
interface SearchItemProps {
  item: any;
  isActive: boolean;
  isHighlighting: boolean;
  highlightAnim: Animated.Value;
  query: string;
  onPress: () => void;
  userProfiles: Record<string, any>;
  onAddFriend?: (item: any) => void;
  addingFriendEmail?: string | null;
}

const SearchItem = memo(
  ({ item, isActive, isHighlighting, highlightAnim, query, onPress, userProfiles, onAddFriend, addingFriendEmail }: SearchItemProps) => {
    const { t } = useTheme();
    const TAG_CONFIG = getTagConfig(t);
    const tag = TAG_CONFIG[item.type as keyof typeof TAG_CONFIG];
    const isFile = item.type === 'FILE';
    const isMessage = item.type === 'MESSAGE';
    const isContact = item.type === 'CONTACT';
    const isConversation = item.type === 'CONVERSATION';

    // Identity Resolution
    const senderEmail = item.senderId || item.email;
    const profile = senderEmail ? userProfiles[senderEmail.trim().toLowerCase()] : null;
    
    const title = isContact 
      ? (profile?.nickname || profile?.fullName || profile?.fullname || item.fullName || item.displayName || item.sender?.name || '')
      : isConversation
      ? (item.name || t('search.unnamed_group'))
      : (profile?.nickname || profile?.fullName || profile?.fullname || item.sender?.name || item.displayName || t('search.user'));
    
    const subtitle = isConversation 
      ? (item.isHiddenMatch ? t('search.unlock_to_view') : `${item.memberCount} ${t('chat_details.members').toLowerCase()}`)
      : (isMessage || isFile) ? item.content : '';
    const fileMeta = isFile ? formatFileSize(item.size) : null;

    const itemAvatarUri = item.isHiddenMatch
      ? DEFAULT_AVATAR
      : item.source === "friendSearch"
        ? getFriendAvatar(item)
        : (profile?.avatarUrl || item.sender?.avatar || item.sender?.avatarUrl || item.avatar);
    const avatarSource = itemAvatarUri === DEFAULT_AVATAR ? DEFAULT_AVATAR : (itemAvatarUri ? { uri: itemAvatarUri } : DEFAULT_AVATAR);
    const friendshipStatus = item?.friendship?.status;
    const friendActionVisible = isContact && (item.source === "friendSearch" || item.friendship || item.isSelf);
    const canAddFriend = friendActionVisible && !item.isSelf && friendshipStatus !== "accepted" && friendshipStatus !== "pending";
    const friendStatusText = item.isSelf
      ? "Bạn"
      : friendshipStatus === "accepted"
        ? "Bạn bè"
        : friendshipStatus === "pending"
          ? "Đã gửi"
          : "";
    const friendEmail = String(item.email || item.userId || item.id || "").toLowerCase();
    const isAddingFriend = addingFriendEmail === friendEmail;

    const animatedBorderColor = isHighlighting
      ? highlightAnim.interpolate({
        inputRange: [0, 1],
        outputRange: ['#f0f0f0', '#FFD700'],
      })
      : '#f0f0f0';

    return (
      <TouchableOpacity onPress={onPress} activeOpacity={0.7}>
        <Animated.View
          style={[
            styles.resultItem,
            isActive && styles.resultItemActive,
            {
              borderColor: animatedBorderColor,
              borderWidth: isHighlighting ? 2 : 0,
            },
          ]}
        >
          {isFile ? (
            <View style={[styles.avatar, { backgroundColor: '#f0f7ff', justifyContent: 'center', alignItems: 'center' }]}>
              <Text style={{ fontFamily: 'Material Symbols Outlined', fontSize: 24, color: '#0068FF' }}>
                {getFileIcon(item.mimeType, item.name || item.content)}
              </Text>
            </View>
          ) : (
            <SafeImage
              source={avatarSource}
              style={styles.avatar}
              fallback={DEFAULT_AVATAR}
            />
          )}
          <View style={styles.resultInfo}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
              <Text style={[styles.resultName, { flex: 1 }]} numberOfLines={1}>
                {highlightKeyword(title, query)}
              </Text>
              {(isMessage || isFile) && (
                <Text style={{ fontSize: 10, color: '#9ba3b2', marginLeft: 8 }}>
                  {formatTime(item.createdAt)}
                </Text>
              )}
            </View>
            {subtitle ? (
              <Text style={styles.resultSub} numberOfLines={1}>
                {highlightKeyword(subtitle, query)}
              </Text>
            ) : null}
            {fileMeta && (
              <Text style={{ fontSize: 10, color: '#9ba3b2', marginTop: 2 }}>
                {fileMeta}
              </Text>
            )}
          </View>
          {canAddFriend ? (
            <TouchableOpacity
              style={{
                minWidth: 72,
                height: 32,
                borderRadius: 9,
                backgroundColor: '#0068FF',
                alignItems: 'center',
                justifyContent: 'center',
                paddingHorizontal: 10,
              }}
              onPress={(event: any) => {
                event?.stopPropagation?.();
                onAddFriend?.(item);
              }}
              disabled={isAddingFriend}
            >
              {isAddingFriend ? (
                <ActivityIndicator color="#fff" size="small" />
              ) : (
                <Text style={{ color: '#fff', fontSize: 12, fontWeight: '700' }}>Kết bạn</Text>
              )}
            </TouchableOpacity>
          ) : friendActionVisible && friendStatusText ? (
            <Text style={{ color: '#0068FF', fontSize: 12, fontWeight: '700', marginLeft: 6 }}>
              {friendStatusText}
            </Text>
          ) : tag ? (
            <Text style={[styles.resultTypeTag, { color: tag.color }]}>
              {tag.label}
            </Text>
          ) : null}
        </Animated.View>
      </TouchableOpacity>
    );
  },
);

// ─── RecentItem ───────────────────────────────────────────────────────────────

interface RecentItemProps {
  item: string;
  onPress: (text: string) => void;
}

const RecentItem = memo(({ item, onPress }: RecentItemProps) => (
  <TouchableOpacity
    style={styles.recentItem}
    onPress={() => onPress(item)}
    activeOpacity={0.7}
  >
    <Text style={styles.recentIcon}>history</Text>
    <Text style={styles.recentText}>{item}</Text>
  </TouchableOpacity>
));

// ─── Main Screen ──────────────────────────────────────────────────────────────

interface SearchScreenProps {
  onNavigate: (screen: string, params?: any) => void;
  goBack: () => void;
}

export default function SearchScreen({ onNavigate, goBack }: SearchScreenProps) {
  const insets = useSafeAreaInsets();
  const { t } = useTheme();
  const inputRef = useRef<TextInput>(null);

  // Per-item highlight tracking: Map<itemId, Animated.Value>
  const animMap = useRef(new Map<string, Animated.Value>());
  const [highlightingId, setHighlightingId] = useState<string | null>(null);

  // Pagination: which sections are fully expanded (Set of section titles)
  const [expandedSections, setExpandedSections] = useState(new Set());

  const {
    query,
    sections,
    activeId,
    isLoading,
    recentSearches,
    setQuery,
    search,
    searchNow,
    clearResults,
    clearRecentSearches,
    handleSelect,
  } = useSearchStore();

  const { userProfiles, hiddenConversations, conversations, upsertProfiles } = useChatStore();

  const [pinModalVisible, setPinModalVisible] = useState(false);
  const [pinTargetConvId, setPinTargetConvId] = useState<string | null>(null);
  const [pinTargetItem, setPinTargetItem] = useState<any>(null);
  const [friendLookupResult, setFriendLookupResult] = useState<any>(null);
  const [addingFriendEmail, setAddingFriendEmail] = useState<string | null>(null);

  // Auto-focus on mount & Cleanup on exit
  useEffect(() => {
    const t = setTimeout(() => inputRef.current?.focus(), 100);
    return () => {
      clearTimeout(t);
      setQuery('');
      clearResults();
    };
  }, [setQuery, clearResults]);

  // ── Helpers ───────────────────────────────────────────────────────────────

  const getItemId = useCallback(
    (item: any) => item.userId || item.messageId || item.id || '',
    [],
  );

  const getOrCreateAnim = useCallback((id: string) => {
    if (!animMap.current.has(id)) {
      animMap.current.set(id, new Animated.Value(0));
    }
    return animMap.current.get(id) as Animated.Value;
  }, []);

  const animateHighlight = useCallback(
    (id: string) => {
      const anim = getOrCreateAnim(id);
      anim.setValue(0);
      setHighlightingId(id);
      Animated.sequence([
        Animated.timing(anim, {
          toValue: 1,
          duration: 200,
          useNativeDriver: false,
        }),
        Animated.timing(anim, {
          toValue: 0,
          duration: 400,
          useNativeDriver: false,
        }),
      ]).start(() => setHighlightingId(null));
    },
    [getOrCreateAnim],
  );

  // ── Event handlers ────────────────────────────────────────────────────────

  const handleChangeText = useCallback(
    (text: string) => {
      setQuery(text);
      setExpandedSections(new Set());
      // `search` handles the isValidQuery guard internally
      search(text);
    },
    [setQuery, search],
  );

  const handleClear = useCallback(() => {
    setQuery('');
    clearResults();
    setExpandedSections(new Set());
    inputRef.current?.focus();
  }, [setQuery, clearResults]);

  const handleSubmitEditing = useCallback(() => {
    if (query.trim().length >= 2) searchNow(query.trim());
  }, [query, searchNow]);

  useEffect(() => {
    const params = buildFriendSearchParams(query);
    if (!params) {
      setFriendLookupResult(null);
      return;
    }

    let cancelled = false;
    const timer = setTimeout(async () => {
      try {
        const res = await chatGet("/friends/search", params);
        const data = unpackFriendSearchResponse(res);
        if (cancelled) return;
        if (data.found && data.user?.email) {
          const email = String(data.user.email).toLowerCase();
          upsertProfiles({
            [email]: {
              ...data.user,
              email,
            },
          });
          setFriendLookupResult(data);
        } else {
          setFriendLookupResult(null);
        }
      } catch (error) {
        if (!cancelled) setFriendLookupResult(null);
      }
    }, 350);

    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [query, upsertProfiles]);

  const handleSelectResult = useCallback(
    (item: any) => {
      const id = getItemId(item);
      animateHighlight(id);
      
      if (item.isHiddenMatch) {
        setTimeout(() => {
          setPinTargetConvId(id);
          setPinTargetItem(item);
          setPinModalVisible(true);
        }, 150);
        return;
      }
      
      // Small delay so the highlight animation starts before navigation
      setTimeout(() => handleSelect(item, onNavigate), 100);
    },
    [animateHighlight, getItemId, handleSelect, onNavigate],
  );

  const handleSelectRecent = useCallback(
    (text: string) => {
      setQuery(text);
      setExpandedSections(new Set());
      searchNow(text);
    },
    [setQuery, searchNow],
  );

  const toggleSectionExpansion = useCallback((title: string) => {
    setExpandedSections((prev) => {
      const next = new Set(prev);
      if (next.has(title)) next.delete(title);
      else next.add(title);
      return next;
    });
  }, []);

  const handleAddFriend = useCallback(async (item: any) => {
    const targetEmail = String(item?.email || item?.userId || item?.id || "").toLowerCase();
    if (!targetEmail || addingFriendEmail) return;

    setAddingFriendEmail(targetEmail);
    try {
      const res = await chatPost("/friends/request", { targetEmail });
      if (!res?.ok) throw new Error("REQUEST_FAILED");
      setFriendLookupResult((prev: any) => {
        const prevEmail = String(prev?.user?.email || "").toLowerCase();
        if (prevEmail !== targetEmail) return prev;
        return {
          ...prev,
          friendship: { ...(prev.friendship || {}), status: "pending" },
        };
      });
      Alert.alert("Thành công", "Đã gửi lời mời kết bạn.");
    } catch (error) {
      Alert.alert("Lỗi", "Không thể gửi lời mời kết bạn.");
    } finally {
      setAddingFriendEmail(null);
    }
  }, [addingFriendEmail]);

  // ── Derived data ──────────────────────────────────────────────────────────

  const limitedSections = useMemo(() => {
    let baseSections = (sections || [])
      .map((section) => {
        // Filter out results from hidden conversations
        const filteredData = (section.data || []).filter((item: any) => {
          if (item.type === 'MESSAGE' || item.type === 'FILE' || item.type === 'CONVERSATION') {
            const convId = item.conversationId || item.id;
            return !hiddenConversations[convId];
          }
          if (item.type === 'CONTACT') {
            const userId = item.userId || item.id;
            const directConv = conversations.find(c => c.type === 'direct' && c.members?.includes(userId));
            return directConv ? !hiddenConversations[directConv.id] : true;
          }
          return true;
        });

        const isExpanded = expandedSections.has(section.title);
        const slicedData = isExpanded ? filteredData : filteredData.slice(0, RESULTS_PER_PAGE);

        return {
          ...section,
          data: slicedData,
          actualDataCount: filteredData.length,
          isExpanded,
        };
      })
      .filter((s) => s.actualDataCount > 0);

    // Check if query matches any PIN in hiddenConversations
    const q = query.trim();
    if (q) {
      const matchingHiddenIds = Object.keys(hiddenConversations).filter(
        (id) => hiddenConversations[id] === q
      );

      if (matchingHiddenIds.length > 0) {
        const hiddenMatches = conversations
          .filter((c) => matchingHiddenIds.includes(c.id))
          .map((c) => ({
            ...c,
            type: 'CONVERSATION',
            name: t('search.hidden_chat'),
            displayName: t('search.hidden_chat'),
            content: t('search.unlock_to_view'),
            memberCount: c.members?.length || 0,
            isHiddenMatch: true, // flag
          }));

        if (hiddenMatches.length > 0) {
          baseSections.unshift({
            title: t('search.hidden_chat'),
            data: hiddenMatches,
            actualDataCount: hiddenMatches.length,
            isExpanded: true,
          });
        }
      }
    }

    if (friendLookupResult?.user?.email) {
      const email = String(friendLookupResult.user.email).toLowerCase();
      const alreadyInResults = baseSections.some((section: any) =>
        (section.data || []).some((item: any) =>
          item.type === "CONTACT" &&
          String(item.email || item.userId || item.id || "").toLowerCase() === email
        )
      );

      if (!alreadyInResults) {
        baseSections.unshift({
          title: "Tìm bạn bè",
          data: [{
            ...friendLookupResult.user,
            id: email,
            userId: email,
            email,
            type: "CONTACT",
            source: "friendSearch",
            friendship: friendLookupResult.friendship,
            isSelf: friendLookupResult.isSelf,
            fullName: getFriendDisplayName(friendLookupResult.user),
          }],
          actualDataCount: 1,
          isExpanded: true,
        });
      }
    }

    return baseSections;
  }, [sections, expandedSections, query, hiddenConversations, conversations, friendLookupResult]);

  const showRecents =
    !query.trim() && recentSearches?.length > 0;

  // ── Renderers ─────────────────────────────────────────────────────────────

  const renderItem = useCallback(
    ({ item }: { item: any }) => {
      const id = getItemId(item);
      return (
        <SearchItem
          item={item}
          isActive={activeId === id}
          isHighlighting={highlightingId === id}
          highlightAnim={getOrCreateAnim(id)}
          query={query}
          onPress={() => handleSelectResult(item)}
          userProfiles={userProfiles}
          onAddFriend={handleAddFriend}
          addingFriendEmail={addingFriendEmail}
        />
      );
    },
    [activeId, addingFriendEmail, highlightingId, query, getItemId, getOrCreateAnim, handleSelectResult, handleAddFriend, userProfiles],
  );

  const renderRecent = useCallback(
    ({ item }: { item: string }) => <RecentItem item={item} onPress={handleSelectRecent} />,
    [handleSelectRecent],
  );

  const renderSectionHeader = useCallback(
    ({ section }: { section: any }) => (
      <View style={styles.sectionHeaderContainer}>
        <Text style={styles.sectionTitle}>{section.title}</Text>
      </View>
    ),
    [],
  );

  const renderSectionFooter = useCallback(
    ({ section }: { section: any }) => {
      const showExpand = !section.isExpanded && section.actualDataCount > RESULTS_PER_PAGE;
      if (!showExpand) return <View style={styles.sectionFooterSpacer} />;

      return (
        <TouchableOpacity
          style={styles.sectionExpandBtn}
          onPress={() => toggleSectionExpansion(section.title)}
        >
          <Text style={styles.sectionExpandText}>
            {t('search.view_more', { title: section.title.toLowerCase() })} ({section.actualDataCount - RESULTS_PER_PAGE})
          </Text>
          <Text style={styles.sectionExpandIcon}>expand_more</Text>
        </TouchableOpacity>
      );
    },
    [toggleSectionExpansion],
  );

  const keyExtractorResult = useCallback(
    (item: any, index: number) =>
      `result-${item.type}-${item.id || item.messageId || item.userId || index}`,
    [],
  );

  const keyExtractorRecent = useCallback(
    (item: string, index: number) => `recent-${index}-${item}`,
    [],
  );

  const ListFooter = null; // No global load more, use section footers

  // ── Render ────────────────────────────────────────────────────────────────

  const showLoading = isLoading && query.trim().length >= 2;

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      {/* ── Header ── */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.backBtn} onPress={goBack}>
          <Text style={styles.backIcon}>arrow_back</Text>
        </TouchableOpacity>

        <View style={styles.searchBar}>
          <Text style={styles.searchIcon}>search</Text>
          <TextInput
            ref={inputRef}
            style={styles.searchInput}
            placeholder={t('common.search_placeholder')}
            placeholderTextColor="rgba(0,0,0,0.4)"
            value={query}
            onChangeText={handleChangeText}
            onSubmitEditing={handleSubmitEditing}
            autoCapitalize="none"
            autoCorrect={false}
            returnKeyType="search"
          // Do NOT disable input while loading — bad UX on slow connections
          />
          {query.length > 0 && (
            <TouchableOpacity style={styles.clearBtn} onPress={handleClear}>
              <Text style={styles.clearIcon}>close</Text>
            </TouchableOpacity>
          )}
        </View>
      </View>

      {/* ── Body ── */}
      {showLoading ? (
        <View style={styles.centered}>
          <ActivityIndicator color="#0058bc" size="large" />
        </View>
      ) : showRecents ? (
        <View style={{ flex: 1 }}>
          <View style={styles.sectionHeaderContainer}>
            <Text style={styles.sectionTitle}>{t('search.recent_searches')}</Text>
            <TouchableOpacity
              style={styles.clearHistoryBtn}
              onPress={clearRecentSearches}
            >
              <Text style={styles.clearHistoryText}>{t('search.clear_all')}</Text>
            </TouchableOpacity>
          </View>
          <FlatList
            data={recentSearches}
            keyExtractor={keyExtractorRecent}
            renderItem={renderRecent}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
          />
        </View>
      ) : limitedSections.length > 0 ? (
        <SectionList
          style={{ flex: 1 }}
          sections={limitedSections}
          keyExtractor={keyExtractorResult}
          renderItem={renderItem}
          renderSectionHeader={renderSectionHeader}
          renderSectionFooter={renderSectionFooter}
          ListFooterComponent={ListFooter}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode={Platform.OS === 'ios' ? 'on-drag' : 'none'}
          showsVerticalScrollIndicator={false}
          // Performance tuning for large lists
          removeClippedSubviews={Platform.OS === 'android'}
          maxToRenderPerBatch={10}
          windowSize={5}
          initialNumToRender={10}
        />
      ) : query.trim().length >= 2 ? (
        <View style={styles.centered}>
          <Text style={styles.emptyIcon}>search_off</Text>
          <Text style={styles.emptyText}>{t('search.no_results')}</Text>
        </View>
      ) : (
        <View style={styles.centered}>
          <Text style={styles.emptyIcon}>edit_note</Text>
          <Text style={styles.emptyText}>{t('search.type_to_search')}</Text>
        </View>
      )}

      <PinModal
        isVisible={pinModalVisible}
        isSettingPin={false}
        onClose={() => setPinModalVisible(false)}
        onSubmit={(pin) => {
          if (pinTargetConvId && pinTargetItem) {
            const success = useChatStore.getState().unhideConversationWithPin(pinTargetConvId, pin);
            if (success) {
              setPinModalVisible(false);
              setTimeout(() => {
                handleSelect(pinTargetItem, onNavigate);
              }, 100);
            } else {
              Alert.alert(t('common.error'), t('home.wrong_pin'));
            }
          }
        }}
      />
    </View>
  );
}
