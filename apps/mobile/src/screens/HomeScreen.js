import React from 'react';
import {
  View, Text, StyleSheet, SafeAreaView, ScrollView,
  TextInput, TouchableOpacity, Image, Platform, StatusBar
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Colors, Typography, Shadows } from '../constants/Theme';

const MOCK_CHATS = [
  { id: '1', name: 'Khoa học Máy tính K67', lastMsg: 'Thầy vừa đăng bài tập mới trên hệ thống.', time: '10:30', unread: 5, avatar: 'https://i.pravatar.cc/150?u=1' },
  { id: '2', name: 'Giảng viên Nguyễn Văn A', lastMsg: 'Em làm bài tập nhóm tốt lắm.', time: '09:15', unread: 0, avatar: 'https://i.pravatar.cc/150?u=2' },
  { id: '3', name: 'Trần Thị B (Lớp trưởng)', lastMsg: 'Chiều nay họp nhóm nhé!', time: 'Hôm qua', unread: 2, avatar: 'https://i.pravatar.cc/150?u=3' },
  { id: '4', name: 'Thư viện ZaloEdu', lastMsg: 'Đã nhắc nhở: Sách của bạn sắp quá hạn.', time: 'Thứ 2', unread: 0, avatar: 'https://i.pravatar.cc/150?u=4' },
  { id: '5', name: 'ZaloEdu Support', lastMsg: 'Chào mừng bạn đến với Mạng lưới giáo dục số!', time: 'Tuần trước', unread: 0, avatar: 'https://i.pravatar.cc/150?u=5' },
];

export default function HomeScreen({ onNavigate }) {
  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar barStyle="light-content" backgroundColor="#00418f" />
      
      {/* App Header (Glassy / Gradient) */}
      <LinearGradient
        colors={[Colors.primary, '#0058bc']}
        start={{ x: 0, y: 0 }} end={{ x: 0, y: 1 }}
        style={styles.header}
      >
        <View style={styles.headerTop}>
          <Text style={styles.brandName}>ZaloEdu</Text>
          <TouchableOpacity style={styles.iconBtn}>
            <Text style={styles.iconOutline}>notifications</Text>
            <View style={styles.badge} />
          </TouchableOpacity>
        </View>

        <View style={styles.searchContainer}>
          <Text style={styles.searchIcon}>search</Text>
          <TextInput 
            placeholder="Tìm kiếm khóa học, bạn bè, giảng viên..." 
            style={styles.searchInput} 
            placeholderTextColor="rgba(255, 255, 255, 0.7)"
          />
        </View>
      </LinearGradient>

      {/* Quick Access Stories / Courses */}
      <View style={styles.quickAccessSection}>
        <Text style={styles.sectionTitle}>Khóa học gần đây</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.horizontalScroll}>
          {[1, 2, 3, 4].map((i) => (
            <View key={i} style={styles.storyCard}>
              <View style={styles.storyImagePlaceholder}>
                 <Text style={styles.storyIcon}>menu_book</Text>
              </View>
              <Text style={styles.storyText} numberOfLines={1}>React Native {i}</Text>
            </View>
          ))}
        </ScrollView>
      </View>

      {/* Main Chat / Activity Content */}
      <View style={styles.mainFeed}>
        <Text style={[styles.sectionTitle, { marginLeft: 20 }]}>Tin nhắn & Thông báo</Text>
        <ScrollView style={styles.chatList} showsVerticalScrollIndicator={false}>
          {MOCK_CHATS.map((chat) => (
            <TouchableOpacity key={chat.id} style={styles.chatItem} activeOpacity={0.7}>
              <Image source={{ uri: chat.avatar }} style={styles.avatar} />
              <View style={styles.chatInfo}>
                <View style={styles.chatHeader}>
                  <Text style={styles.chatName} numberOfLines={1}>{chat.name}</Text>
                  <Text style={styles.chatTime}>{chat.time}</Text>
                </View>
                <View style={styles.chatFooter}>
                  <Text style={[styles.lastMsg, chat.unread > 0 && styles.lastMsgUnread]} numberOfLines={1}>{chat.lastMsg}</Text>
                  {chat.unread > 0 && (
                    <View style={styles.unreadBadge}>
                      <Text style={styles.unreadText}>{chat.unread}</Text>
                    </View>
                  )}
                </View>
              </View>
            </TouchableOpacity>
          ))}
          <View style={{ height: 100 }} />
        </ScrollView>
      </View>

      {/* Floating Bottom Tabs */}
      <View style={styles.floatingTabBar}>
        <TouchableOpacity style={styles.tabItem}>
          <Text style={[styles.tabIcon, styles.tabIconActive]}>chat</Text>
          <Text style={[styles.tabLabel, styles.tabLabelActive]}>Tin nhắn</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.tabItem}>
          <Text style={styles.tabIcon}>school</Text>
          <Text style={styles.tabLabel}>Lớp học</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.tabItem}>
          <Text style={styles.tabIcon}>explore</Text>
          <Text style={styles.tabLabel}>Khám phá</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.tabItem} onPress={() => onNavigate('login')}>
          <Text style={styles.tabIcon}>person</Text>
          <Text style={styles.tabLabel}>Cá nhân</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: Colors.surface,
  },
  header: {
    paddingTop: Platform.OS === 'android' ? 44 : 20,
    paddingHorizontal: 20,
    paddingBottom: 20,
    borderBottomLeftRadius: 32,
    borderBottomRightRadius: 32,
    ...Shadows.glow,
  },
  headerTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  brandName: {
    ...Typography.heading,
    fontSize: 28,
    color: '#ffffff',
  },
  iconBtn: {
    width: 44,
    height: 44,
    backgroundColor: 'rgba(255, 255, 255, 0.15)',
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  iconOutline: {
    fontFamily: 'Material Symbols Outlined',
    fontSize: 24,
    color: '#ffffff',
  },
  badge: {
    position: 'absolute',
    top: 10,
    right: 12,
    width: 8,
    height: 8,
    backgroundColor: Colors.error,
    borderRadius: 4,
    borderWidth: 1.5,
    borderColor: Colors.primary,
  },
  searchContainer: {
    height: 52,
    backgroundColor: 'rgba(255,255,255,0.2)',
    borderRadius: 16,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
  },
  searchIcon: {
    fontFamily: 'Material Symbols Outlined',
    fontSize: 22,
    marginRight: 10,
    color: '#ffffff',
  },
  searchInput: {
    flex: 1,
    color: '#ffffff',
    ...Typography.body,
    fontSize: 15,
    outlineStyle: 'none',
  },
  
  // Quick Access
  quickAccessSection: {
    paddingTop: 24,
    paddingBottom: 16,
  },
  sectionTitle: {
    ...Typography.heading,
    fontSize: 18,
    color: Colors.onSurface,
    marginLeft: 20,
    marginBottom: 16,
  },
  horizontalScroll: {
    paddingHorizontal: 16,
    paddingRight: 20,
  },
  storyCard: {
    width: 80,
    alignItems: 'center',
    marginRight: 12,
  },
  storyImagePlaceholder: {
    width: 64,
    height: 64,
    borderRadius: 24,
    backgroundColor: Colors.surfaceContainerHighest,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
    borderWidth: 2,
    borderColor: Colors.primaryContainer,
  },
  storyIcon: {
    fontFamily: 'Material Symbols Outlined',
    fontSize: 28,
    color: Colors.primary,
  },
  storyText: {
    ...Typography.body,
    fontSize: 12,
    color: Colors.onSurfaceVariant,
    textAlign: 'center',
  },

  // Feed
  mainFeed: {
    flex: 1,
  },
  chatList: {
    flex: 1,
  },
  chatItem: {
    flexDirection: 'row',
    padding: 16,
    paddingHorizontal: 20,
    alignItems: 'center',
    backgroundColor: Colors.surface,
  },
  avatar: {
    width: 56,
    height: 56,
    borderRadius: 20,
    marginRight: 16,
    backgroundColor: Colors.surfaceContainerHighest,
  },
  chatInfo: {
    flex: 1,
    justifyContent: 'center',
  },
  chatHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  chatName: {
    ...Typography.heading,
    fontSize: 16,
    color: Colors.onSurface,
    flex: 1,
    marginRight: 10,
  },
  chatTime: {
    ...Typography.body,
    fontSize: 12,
    color: Colors.outline,
    fontWeight: '600',
  },
  chatFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  lastMsg: {
    ...Typography.body,
    fontSize: 14,
    color: Colors.onSurfaceVariant,
    flex: 1,
    marginRight: 10,
  },
  lastMsgUnread: {
    ...Typography.heading,
    color: Colors.onSurface,
  },
  unreadBadge: {
    backgroundColor: Colors.error,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 12,
    minWidth: 24,
    alignItems: 'center',
  },
  unreadText: {
    ...Typography.label,
    color: '#fff',
    fontSize: 11,
  },

  // Floating Tab Bar
  floatingTabBar: {
    position: 'absolute',
    bottom: Platform.OS === 'ios' ? 24 : 16,
    left: 20,
    right: 20,
    height: 64,
    backgroundColor: 'rgba(255, 255, 255, 0.95)',
    borderRadius: 32,
    flexDirection: 'row',
    alignItems: 'center',
    ...Shadows.glow,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.8)',
    paddingHorizontal: 8,
  },
  tabItem: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    height: '100%',
  },
  tabIcon: {
    fontFamily: 'Material Symbols Outlined',
    fontSize: 24,
    marginBottom: 2,
    color: Colors.outline,
  },
  tabIconActive: {
    color: Colors.primary,
    fontVariationSettings: "'FILL' 1",
  },
  tabLabel: {
    ...Typography.label,
    fontSize: 10,
    color: Colors.outline,
  },
  tabLabelActive: {
    color: Colors.primary,
  },
});
