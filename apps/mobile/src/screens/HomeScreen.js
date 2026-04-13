import AsyncStorage from '@react-native-async-storage/async-storage';
import { BlurView } from 'expo-blur';
import { LinearGradient } from 'expo-linear-gradient';
import React, { useEffect, useState } from 'react';
import {
    Dimensions,
    Image, Platform,
    SafeAreaView, ScrollView,
    StatusBar,
    StyleSheet,
    Text,
    TouchableOpacity,
    View
} from 'react-native';
import { Typography } from '../constants/Theme';
import Alert from '../utils/Alert';

const { width } = Dimensions.get('window');

const MOCK_CHATS = [
  { id: '1', name: 'Khoa học Máy tính K67', lastMsg: 'Thầy vừa đăng bài tập mới trên hệ thống.', time: '10:30', unread: 5, avatar: 'https://i.pravatar.cc/150?u=1', pinned: true },
  { id: '2', name: 'Nhóm 8 - Đồ án CNM', lastMsg: 'Trung Min: @Lâm Chí Tường ok', time: '09:15', unread: 0, avatar: 'https://i.pravatar.cc/150?u=8' },
  { id: '3', name: 'Giảng viên Nguyễn Văn A', lastMsg: 'Em làm bài tập nhóm tốt lắm.', time: '08:45', unread: 0, avatar: 'https://i.pravatar.cc/150?u=2' },
  { id: '4', name: 'Trần Thị B (Lớp trưởng)', lastMsg: 'Chiều nay họp nhóm nhé!', time: 'Hôm qua', unread: 2, avatar: 'https://i.pravatar.cc/150?u=3' },
  { id: '5', name: 'Media Box', lastMsg: 'Báo Mới: [APP] Không nghỉ liền 9...', time: 'Hôm qua', unread: 0, avatar: 'https://i.pravatar.cc/150?u=media', isSystem: true },
  { id: '6', name: 'ZaloEdu Support', lastMsg: 'Chào mừng bạn đến với Mạng lưới giáo dục số!', time: 'Tuần trước', unread: 0, avatar: 'https://i.pravatar.cc/150?u=5' },
];

const MOCK_FRIENDS = [
  { id: '1', name: 'An Nguyễn', status: 'Đang hoạt động', avatar: 'https://i.pravatar.cc/150?u=a1' },
  { id: '2', name: 'Bảo Quốc', status: 'Truy cập 5 phút trước', avatar: 'https://i.pravatar.cc/150?u=a2' },
  { id: '3', name: 'Cường Đô La', status: 'Bận', avatar: 'https://i.pravatar.cc/150?u=a3' },
];

const ME_PRIMARY_ITEMS = [
  {
    id: 'zcloud',
    icon: 'cloud',
    title: 'zCloud',
    subtitle: 'Data storage space on the cloud',
    color: '#0a5bb7',
    onPress: () => {},
  },
  {
    id: 'zstyle',
    icon: 'auto_awesome',
    title: 'zStyle - Stand out on Zalo',
    subtitle: 'Background and music library on Zalo',
    color: '#0a5bb7',
    onPress: () => {},
  },
  {
    id: 'documents',
    icon: 'folder_open',
    title: 'My Documents',
    subtitle: 'Keep important messages',
    color: '#0a5bb7',
    onPress: () => {},
  },
  {
    id: 'device-data',
    icon: 'pie_chart',
    title: 'Data on device',
    subtitle: 'Manage your Zalo data',
    color: '#0a5bb7',
    onPress: () => {},
  },
  {
    id: 'wallet',
    icon: 'wallet',
    title: 'QR Wallet',
    subtitle: 'Keep important QR codes',
    color: '#0a5bb7',
    onPress: () => {},
  },
];

const ME_SECURITY_ITEMS = [
  {
    id: 'account-security',
    icon: 'shield',
    title: 'Account and security',
    subtitle: '',
    color: '#0a5bb7',
    route: 'settings',
  },
  {
    id: 'privacy',
    icon: 'lock',
    title: 'Privacy',
    subtitle: '',
    color: '#0a5bb7',
    route: 'settings',
  },
];

const STATUS_OPTIONS = [
  'Đang đi học',
  'Đang bận, nhắn sau nhé',
  'Rảnh để trò chuyện',
  'Đang làm bài tập',
  'Đi cà phê',
  'Không làm phiền',
];

export default function HomeScreen({ onNavigate, onLogout, initialTab = 'messages' }) {
  const SETTINGS_KEY = 'mobile_settings';
  const [activeTab, setActiveTab] = useState(initialTab); // 'messages', 'friends', 'ai', 'profile'
  const [user, setUser] = useState({ fullName: 'Người dùng', email: '', currentStatus: '', statusExpiresAt: null });
  const [showOnlineStatus, setShowOnlineStatus] = useState(true);
  const displayName = user.fullName || user.fullname || 'Người dùng';
  const avatarUrl = user.avatarUrl || user.urlAvatar || '';
  const currentStatus = user.currentStatus || user.statusMessage || '';
  const shouldShowOnlineDot = showOnlineStatus;

  const persistUser = async (nextUser) => {
    const storage = AsyncStorage.default || AsyncStorage;
    await storage.setItem('user', JSON.stringify(nextUser));
    setUser(nextUser);
  };

  const clearExpiredStatus = async (baseUser) => {
    const nextUser = {
      ...baseUser,
      currentStatus: '',
      statusMessage: '',
      statusExpiresAt: null,
    };
    await persistUser(nextUser);
  };

  useEffect(() => {
    setActiveTab(initialTab || 'messages');
  }, [initialTab]);

  useEffect(() => {
    const loadUser = async () => {
      const storage = AsyncStorage.default || AsyncStorage;
      const data = await storage.getItem('user');
      const rawSettings = await storage.getItem(SETTINGS_KEY);

      if (rawSettings) {
        const parsedSettings = JSON.parse(rawSettings);
        if (typeof parsedSettings.showOnlineStatus === 'boolean') {
          setShowOnlineStatus(parsedSettings.showOnlineStatus);
        }
      }

      if (data) {
        const parsed = JSON.parse(data);
        const statusExpiresAt = parsed.statusExpiresAt ? Number(parsed.statusExpiresAt) : null;
        const nextUser = {
          ...parsed,
          fullName: parsed.fullName || parsed.fullname || 'Người dùng',
          fullname: parsed.fullName || parsed.fullname || 'Người dùng',
          avatarUrl: parsed.avatarUrl || parsed.urlAvatar || '',
          urlAvatar: parsed.avatarUrl || parsed.urlAvatar || '',
          currentStatus: parsed.currentStatus || parsed.statusMessage || '',
          statusMessage: parsed.currentStatus || parsed.statusMessage || '',
          statusExpiresAt,
        };

        if (statusExpiresAt && Date.now() >= statusExpiresAt) {
          await clearExpiredStatus(nextUser);
          return;
        }

        setUser(nextUser);
      }
    };
    loadUser();
  }, []);

  useEffect(() => {
    if (!user.statusExpiresAt) {
      return undefined;
    }

    const ttl = Number(user.statusExpiresAt) - Date.now();
    if (ttl <= 0) {
      clearExpiredStatus(user);
      return undefined;
    }

    const timer = setTimeout(() => {
      clearExpiredStatus(user);
    }, ttl);

    return () => clearTimeout(timer);
  }, [user.statusExpiresAt]);

  const openStatusPicker = () => {
    onNavigate('status-picker');
  };

  const handleLogoutPress = () => {
    Alert.alert(
      'Đăng xuất',
      'Bạn có chắc chắn muốn đăng xuất khỏi tài khoản này?',
      [
        { text: 'Hủy', style: 'cancel' },
        { text: 'Đăng xuất', style: 'destructive', onPress: onLogout }
      ]
    );
  };

  // --- SUB-COMPONENTS ---

  const Header = () => (
    <LinearGradient colors={['#0058bc', '#00418f']} style={styles.header}>
      <View style={styles.headerContent}>
        <View style={styles.searchBar}>
          <Text style={styles.searchIcon}>search</Text>
          <Text style={styles.searchPlaceholder}>Tìm kiếm</Text>
        </View>
        <View style={styles.headerIcons}>
          <TouchableOpacity style={styles.iconButton}>
            <Text style={styles.headerIconText}>qr_code_scanner</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.iconButton} onPress={() => onNavigate('settings')}>
            <Text style={styles.headerIconText}>settings</Text>
          </TouchableOpacity>
        </View>
      </View>
    </LinearGradient>
  );

  const MessagesView = () => (
    <ScrollView style={styles.scrollContainer} showsVerticalScrollIndicator={false}>
      <View style={styles.chatList}>
        {MOCK_CHATS.map((chat) => (
          <TouchableOpacity key={chat.id} style={styles.chatItem}>
            <Image source={{ uri: chat.avatar }} style={styles.avatar} />
            <View style={styles.chatInfo}>
              <View style={styles.chatHeader}>
                <Text style={styles.chatName} numberOfLines={1}>
                  {chat.name.toUpperCase()}
                </Text>
                <View style={styles.chatHeaderRight}>
                  {chat.pinned && <Text style={styles.pinnedIcon}>push_pin</Text>}
                  <Text style={styles.chatTime}>{chat.time}</Text>
                </View>
              </View>
              <Text style={styles.lastMsg} numberOfLines={1}>
                {chat.lastMsg}
              </Text>
            </View>
          </TouchableOpacity>
        ))}
      </View>
      <View style={{ height: 100 }} />
    </ScrollView>
  );

  const FriendsView = () => (
    <ScrollView style={styles.scrollContainer}>
      <View style={styles.sectionHeader}>
        <Text style={styles.sectionTitle}>Danh sách bạn bè</Text>
      </View>
      {MOCK_FRIENDS.map((friend) => (
        <View key={friend.id} style={styles.friendItem}>
          <Image source={{ uri: friend.avatar }} style={styles.friendAvatar} />
          <View style={styles.friendInfo}>
            <Text style={styles.friendName}>{friend.name}</Text>
            <Text style={styles.friendStatus}>{friend.status}</Text>
          </View>
          <TouchableOpacity style={styles.friendAction}>
            <Text style={styles.friendActionIcon}>chat</Text>
          </TouchableOpacity>
        </View>
      ))}
    </ScrollView>
  );

  const AIView = () => (
    <View style={styles.centeredView}>
      <Text style={styles.aiIcon}>smart_toy</Text>
      <Text style={styles.aiTitle}>AI Assistant</Text>
      <Text style={styles.aiSubtitle}>Đang được nâng cấp. Sắp ra mắt!</Text>
    </View>
  );

  const MeMenuItem = ({ item, isLast = false }) => (
    <TouchableOpacity
      style={[styles.meItem, !isLast && styles.meItemBorder]}
      onPress={item.route ? () => onNavigate(item.route) : item.onPress}
      activeOpacity={0.85}
    >
      <View style={styles.meItemIconWrap}>
        <Text style={[styles.meItemIcon, { color: item.color || '#0a5bb7' }]}>{item.icon}</Text>
      </View>
      <View style={styles.meItemTextWrap}>
        <Text style={styles.meItemTitle}>{item.title}</Text>
        {!!item.subtitle && <Text style={styles.meItemSubtitle}>{item.subtitle}</Text>}
      </View>
      <Text style={styles.meItemChevron}>chevron_right</Text>
    </TouchableOpacity>
  );

  const ProfileView = () => (
    <ScrollView style={styles.scrollContainer} contentContainerStyle={styles.meScrollContent}>
      <View style={styles.meProfileCard}>
        <TouchableOpacity onPress={() => onNavigate('profile')} activeOpacity={0.85} style={styles.meAvatarWrap}>
          {avatarUrl ? (
            <Image source={{ uri: avatarUrl }} style={styles.meAvatarImage} />
          ) : (
            <View style={styles.meAvatarFallback}>
              <Text style={styles.avatarInitial}>{displayName ? displayName[0] : 'U'}</Text>
            </View>
          )}
          {shouldShowOnlineDot && <View style={styles.onlineDot} />}
        </TouchableOpacity>

        <View style={styles.meProfileMeta}>
          <TouchableOpacity onPress={() => onNavigate('profile')} activeOpacity={0.85}>
            <Text style={styles.meProfileName}>{displayName}</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.meStatusBubble}
            onPress={openStatusPicker}
            activeOpacity={0.85}
          >
            <Text style={styles.meStatusText} numberOfLines={1}>
              {currentStatus || 'Set status'}
            </Text>
            <View style={styles.meStatusBubbleTail} />
          </TouchableOpacity>
        </View>
      </View>

      <View style={styles.meSectionCard}>
        {ME_PRIMARY_ITEMS.map((item, index) => (
          <MeMenuItem key={item.id} item={item} isLast={index === ME_PRIMARY_ITEMS.length - 1} />
        ))}
      </View>

      <View style={styles.meSectionCard}>
        {ME_SECURITY_ITEMS.map((item, index) => (
          <MeMenuItem key={item.id} item={item} isLast={index === ME_SECURITY_ITEMS.length - 1} />
        ))}
      </View>

      <View style={styles.meSectionCard}>
        <TouchableOpacity style={styles.meItem} onPress={handleLogoutPress} activeOpacity={0.85}>
          <View style={styles.meItemIconWrap}>
            <Text style={[styles.meItemIcon, { color: '#d93025' }]}>logout</Text>
          </View>
          <View style={styles.meItemTextWrap}>
            <Text style={[styles.meItemTitle, { color: '#d93025' }]}>Đăng xuất</Text>
          </View>
        </TouchableOpacity>
      </View>
    </ScrollView>
  );

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar barStyle="light-content" />
      <Header />
      
      <View style={styles.content}>
        {activeTab === 'messages' && <MessagesView />}
        {activeTab === 'friends' && <FriendsView />}
        {activeTab === 'ai' && <AIView />}
        {activeTab === 'profile' && <ProfileView />}
      </View>

      <BlurView intensity={80} tint="light" style={styles.tabBar}>
        <TouchableOpacity 
          style={styles.tabItem} 
          onPress={() => setActiveTab('messages')}
        >
          <Text style={[styles.tabIcon, activeTab === 'messages' && styles.tabIconActive]}>chat</Text>
          <Text style={[styles.tabLabel, activeTab === 'messages' && styles.tabLabelActive]}>Tin nhắn</Text>
        </TouchableOpacity>

        <TouchableOpacity 
          style={styles.tabItem} 
          onPress={() => setActiveTab('friends')}
        >
          <Text style={[styles.tabIcon, activeTab === 'friends' && styles.tabIconActive]}>contact_page</Text>
          <Text style={[styles.tabLabel, activeTab === 'friends' && styles.tabLabelActive]}>Bạn bè</Text>
        </TouchableOpacity>

        <TouchableOpacity 
          style={styles.tabItem} 
          onPress={() => setActiveTab('ai')}
        >
          <Text style={[styles.tabIcon, activeTab === 'ai' && styles.tabIconActive]}>smart_toy</Text>
          <Text style={[styles.tabLabel, activeTab === 'ai' && styles.tabLabelActive]}>AI Assistant</Text>
        </TouchableOpacity>

        <TouchableOpacity 
          style={styles.tabItem} 
          onPress={() => setActiveTab('profile')}
        >
          <Text style={[styles.tabIcon, activeTab === 'profile' && styles.tabIconActive]}>person</Text>
          <Text style={[styles.tabLabel, activeTab === 'profile' && styles.tabLabelActive]}>Tôi</Text>
        </TouchableOpacity>
      </BlurView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: '#f7f9fb' },
  header: {
    paddingTop: Platform.OS === 'ios' ? 6 : 28,
    paddingBottom: 12,
    paddingHorizontal: 16,
    borderBottomLeftRadius: 0,
    borderBottomRightRadius: 0,
  },
  headerContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  searchBar: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.15)',
    borderRadius: 12,
    paddingHorizontal: 12,
    height: 40,
  },
  searchIcon: {
    fontFamily: 'Material Symbols Outlined',
    fontSize: 20,
    color: '#ffffff',
    marginRight: 8,
  },
  searchPlaceholder: {
    color: 'rgba(255, 255, 255, 0.7)',
    ...Typography.body,
    fontSize: 15,
  },
  headerIcons: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
  },
  iconButton: {
    padding: 4,
  },
  headerIconText: {
    fontFamily: 'Material Symbols Outlined',
    fontSize: 24,
    color: '#ffffff',
  },

  content: { flex: 1 },
  scrollContainer: { flex: 1 },
  
  // Messages Tab Styles
  chatList: { paddingBottom: 20 },
  chatItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    backgroundColor: '#ffffff',
    borderBottomWidth: 0.5,
    borderBottomColor: '#eceef0',
  },
  avatar: {
    width: 60,
    height: 60,
    borderRadius: 30,
    marginRight: 16,
    backgroundColor: '#e0e3e5',
  },
  chatInfo: { flex: 1, justifyContent: 'center' },
  chatHeader: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 4 },
  chatName: { ...Typography.heading, fontSize: 16, color: '#191c1e', flex: 1 },
  chatHeaderRight: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  chatTime: { ...Typography.body, fontSize: 12, color: '#727784' },
  pinnedIcon: {
    fontFamily: 'Material Symbols Outlined',
    fontSize: 14,
    color: '#727784',
    fontVariationSettings: "'FILL' 1",
  },
  lastMsg: { ...Typography.body, fontSize: 14, color: '#424753' },

  // Friends Tab Styles
  sectionHeader: { padding: 16, paddingBottom: 8 },
  sectionTitle: { ...Typography.heading, fontSize: 18, color: '#00418f' },
  friendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    backgroundColor: '#fff',
    borderBottomWidth: 0.5,
    borderBottomColor: '#eceef0',
  },
  friendAvatar: { width: 48, height: 48, borderRadius: 24, marginRight: 16 },
  friendInfo: { flex: 1 },
  friendName: { ...Typography.heading, fontSize: 16, color: '#191c1e' },
  friendStatus: { ...Typography.body, fontSize: 12, color: '#727784' },
  friendAction: { padding: 8 },
  friendActionIcon: { fontFamily: 'Material Symbols Outlined', fontSize: 24, color: '#00418f' },
  // AI Tab Styles
  centeredView: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 20 },
  aiIcon: { fontFamily: 'Material Symbols Outlined', fontSize: 80, color: '#00418f', marginBottom: 20, opacity: 0.8 },
  aiTitle: { ...Typography.heading, fontSize: 24, color: '#191c1e', marginBottom: 8 },
  aiSubtitle: { ...Typography.body, fontSize: 16, color: '#727784', textAlign: 'center' },

  // Me Tab Styles
  meScrollContent: {
    paddingBottom: 110,
  },
  meProfileCard: {
    minHeight: 98,
    backgroundColor: '#f4f4f7',
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    gap: 12,
  },
  meAvatarImage: {
    width: 62,
    height: 62,
    borderRadius: 31,
    backgroundColor: '#e0e3e5',
  },
  meAvatarWrap: {
    width: 62,
    height: 62,
  },
  meAvatarFallback: {
    width: 62,
    height: 62,
    borderRadius: 31,
    backgroundColor: '#0058bc',
    alignItems: 'center',
    justifyContent: 'center',
  },
  onlineDot: {
    position: 'absolute',
    right: 1,
    bottom: 1,
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: '#22c55e',
    borderWidth: 2,
    borderColor: '#ffffff',
  },
  avatarInitial: {
    fontSize: 30,
    color: '#fff',
    fontWeight: 'bold',
  },
  meProfileName: {
    ...Typography.heading,
    fontSize: 15,
    color: '#191c1e',
  },
  meProfileMeta: {
    flex: 1,
    gap: 8,
  },
  meStatusBubble: {
    alignSelf: 'flex-start',
    borderRadius: 14,
    paddingHorizontal: 12,
    paddingVertical: 7,
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#d6e2f4',
    position: 'relative',
  },
  meStatusText: {
    ...Typography.body,
    fontSize: 12,
    color: '#4e627c',
    maxWidth: width * 0.46,
  },
  meStatusBubbleTail: {
    position: 'absolute',
    left: 14,
    bottom: -5,
    width: 10,
    height: 10,
    backgroundColor: '#ffffff',
    borderLeftWidth: 1,
    borderBottomWidth: 1,
    borderColor: '#d6e2f4',
    transform: [{ rotate: '-45deg' }],
  },
  meSectionCard: {
    marginTop: 10,
    backgroundColor: '#fff',
  },
  meItem: {
    minHeight: 80,
    paddingHorizontal: 16,
    flexDirection: 'row',
    alignItems: 'center',
  },
  meItemBorder: {
    borderBottomWidth: 1,
    borderBottomColor: '#eef0f2',
  },
  meItemIconWrap: {
    width: 34,
    height: 34,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 16,
  },
  meItemIcon: {
    fontFamily: 'Material Symbols Outlined',
    fontSize: 28,
  },
  meItemTextWrap: {
    flex: 1,
  },
  meItemTitle: {
    ...Typography.body,
    fontSize: 18,
    color: '#191c1e',
    lineHeight: 22,
  },
  meItemSubtitle: {
    ...Typography.body,
    fontSize: 13,
    color: '#727784',
    marginTop: 3,
  },
  meItemChevron: {
    fontFamily: 'Material Symbols Outlined',
    fontSize: 22,
    color: '#858b95',
  },

  // Bottom Tab Bar
  tabBar: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: Platform.OS === 'ios' ? 88 : 72,
    flexDirection: 'row',
    borderTopWidth: 0.5,
    borderTopColor: 'rgba(200, 200, 200, 0.3)',
    paddingBottom: Platform.OS === 'ios' ? 24 : 12,
    paddingTop: 12,
  },
  tabItem: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  tabIcon: { fontFamily: 'Material Symbols Outlined', fontSize: 24, color: '#727784', marginBottom: 4 },
  tabIconActive: { color: '#00418f', fontVariationSettings: "'FILL' 1" },
  tabLabel: { ...Typography.label, fontSize: 10, color: '#727784' },
  tabLabelActive: { color: '#00418f' },
});
