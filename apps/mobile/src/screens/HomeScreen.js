import React, { useState, useEffect } from 'react';
import {
  View, Text, StyleSheet, SafeAreaView, ScrollView,
  TextInput, TouchableOpacity, Image, Platform, StatusBar,
  Dimensions
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { BlurView } from 'expo-blur';
import { Colors, Typography, Shadows } from '../constants/Theme';
import Alert from '../utils/Alert';
import AsyncStorage from '@react-native-async-storage/async-storage';

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

export default function HomeScreen({ onNavigate, onLogout }) {
  const [activeTab, setActiveTab] = useState('messages'); // 'messages', 'friends', 'ai', 'profile'
  const [user, setUser] = useState({ fullName: 'Người dùng', email: '' });

  useEffect(() => {
    const loadUser = async () => {
      const storage = AsyncStorage.default || AsyncStorage;
      const data = await storage.getItem('user');
      if (data) setUser(JSON.parse(data));
    };
    loadUser();
  }, []);

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
          <TouchableOpacity style={styles.iconButton}>
            <Text style={styles.headerIconText}>add</Text>
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

  const ProfileView = () => (
    <ScrollView style={styles.scrollContainer}>
      <View style={styles.profileHeader}>
        <View style={styles.largeAvatarBox}>
          <Text style={styles.avatarInitial}>{user.fullName ? user.fullName[0] : 'U'}</Text>
        </View>
        <Text style={styles.profileName}>{user.fullName}</Text>
        <Text style={styles.profileEmail}>{user.email}</Text>
      </View>

      <View style={styles.menuContainer}>
        <TouchableOpacity style={styles.menuItem}>
          <View style={[styles.menuIconBox, { backgroundColor: '#E3F2FD' }]}>
            <Text style={[styles.menuIcon, { color: '#2196F3' }]}>person</Text>
          </View>
          <Text style={styles.menuLabel}>Thông tin cá nhân</Text>
          <Text style={styles.menuArrow}>chevron_right</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.menuItem} onPress={() => onNavigate('sessions')}>
          <View style={[styles.menuIconBox, { backgroundColor: '#E8F5E9' }]}>
            <Text style={[styles.menuIcon, { color: '#4CAF50' }]}>devices</Text>
          </View>
          <Text style={styles.menuLabel}>Quản lý thiết bị</Text>
          <Text style={styles.menuArrow}>chevron_right</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.menuItem}>
          <View style={[styles.menuIconBox, { backgroundColor: '#FFF3E0' }]}>
            <Text style={[styles.menuIcon, { color: '#FF9800' }]}>security</Text>
          </View>
          <Text style={styles.menuLabel}>Bảo mật tài khoản</Text>
          <Text style={styles.menuArrow}>chevron_right</Text>
        </TouchableOpacity>

        <View style={styles.divider} />

        <TouchableOpacity style={styles.menuItem} onPress={handleLogoutPress}>
          <View style={[styles.menuIconBox, { backgroundColor: '#FFEBEE' }]}>
            <Text style={[styles.menuIcon, { color: '#F44336' }]}>logout</Text>
          </View>
          <Text style={[styles.menuLabel, { color: '#F44336' }]}>Đăng xuất</Text>
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
          <Text style={[styles.tabLabel, activeTab === 'profile' && styles.tabLabelActive]}>Cá nhân</Text>
        </TouchableOpacity>
      </BlurView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: '#f7f9fb' },
  header: {
    paddingTop: Platform.OS === 'ios' ? 10 : 40,
    paddingBottom: 16,
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

  // Profile Tab Styles
  profileHeader: {
    alignItems: 'center',
    padding: 32,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#eceef0',
  },
  largeAvatarBox: {
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: '#0058bc',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  avatarInitial: { fontSize: 40, color: '#fff', fontWeight: 'bold' },
  profileName: { ...Typography.heading, fontSize: 22, color: '#191c1e', marginBottom: 4 },
  profileEmail: { ...Typography.body, fontSize: 14, color: '#727784' },
  menuContainer: { padding: 16, paddingTop: 24 },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    backgroundColor: '#fff',
    borderRadius: 16,
    marginBottom: 12,
    ...Shadows.soft,
  },
  menuIconBox: { width: 40, height: 40, borderRadius: 12, alignItems: 'center', justifyContent: 'center', marginRight: 16 },
  menuIcon: { fontFamily: 'Material Symbols Outlined', fontSize: 22 },
  menuLabel: { flex: 1, ...Typography.heading, fontSize: 16, color: '#191c1e' },
  menuArrow: { fontFamily: 'Material Symbols Outlined', fontSize: 20, color: '#c2c6d5' },
  divider: { height: 1, backgroundColor: '#eceef0', marginVertical: 12, marginHorizontal: 8 },

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
