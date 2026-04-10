import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  ScrollView,
  TextInput,
  TouchableOpacity,
  Image,
  Platform,
} from 'react-native';

const MOCK_CHATS = [
  { id: '1', name: 'Nhóm Lớp Công Nghệ Mới', lastMsg: 'Bạn: Mai có đi học không mọi người?', time: '10:30', unread: 5, avatar: 'https://i.pravatar.cc/150?u=1' },
  { id: '2', name: 'Nguyễn Văn A', lastMsg: 'Gửi mình cái file bài tập với', time: '09:15', unread: 0, avatar: 'https://i.pravatar.cc/150?u=2' },
  { id: '3', name: 'Trần Thị B', lastMsg: 'Ok bạn nhé!', time: 'Hôm qua', unread: 2, avatar: 'https://i.pravatar.cc/150?u=3' },
  { id: '4', name: 'Lê Văn C', lastMsg: 'Đã gửi một ảnh', time: 'Thứ 2', unread: 0, avatar: 'https://i.pravatar.cc/150?u=4' },
  { id: '5', name: 'ZaloEdu Support', lastMsg: 'Chào mừng bạn đến với ZaloEdu!', time: 'Dự án', unread: 0, avatar: 'https://i.pravatar.cc/150?u=5' },
];

export default function HomeScreen({ onNavigate }) {
  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.searchContainer}>
          <Text style={styles.searchIcon}>🔍</Text>
          <TextInput 
            placeholder="Tìm kiếm bạn bè, tin nhắn..." 
            style={styles.searchInput} 
            placeholderTextColor="#94a3b8"
          />
        </View>
        <TouchableOpacity style={styles.plusBtn}>
          <Text style={styles.plusText}>+</Text>
        </TouchableOpacity>
      </View>

      {/* Main Content */}
      <ScrollView style={styles.chatList}>
        {MOCK_CHATS.map((chat) => (
          <TouchableOpacity key={chat.id} style={styles.chatItem}>
            <Image source={{ uri: chat.avatar }} style={styles.avatar} />
            <View style={styles.chatInfo}>
              <View style={styles.chatHeader}>
                <Text style={styles.chatName} numberOfLines={1}>{chat.name}</Text>
                <Text style={styles.chatTime}>{chat.time}</Text>
              </View>
              <View style={styles.chatFooter}>
                <Text style={styles.lastMsg} numberOfLines={1}>{chat.lastMsg}</Text>
                {chat.unread > 0 && (
                  <View style={styles.unreadBadge}>
                    <Text style={styles.unreadText}>{chat.unread}</Text>
                  </View>
                )}
              </View>
            </View>
          </TouchableOpacity>
        ))}
      </ScrollView>

      {/* Bottom Tabs */}
      <View style={styles.bottomTabs}>
        <TouchableOpacity style={styles.tabItem}>
          <Text style={[styles.tabIcon, styles.tabIconActive]}>💬</Text>
          <Text style={[styles.tabLabel, styles.tabLabelActive]}>Tin nhắn</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.tabItem}>
          <Text style={styles.tabIcon}>👥</Text>
          <Text style={styles.tabLabel}>Danh bạ</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.tabItem}>
          <Text style={styles.tabIcon}>🧭</Text>
          <Text style={styles.tabLabel}>Khám phá</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.tabItem} onPress={() => onNavigate('login')}>
          <Text style={styles.tabIcon}>👤</Text>
          <Text style={styles.tabLabel}>Cá nhân</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },
  header: {
    paddingTop: Platform.OS === 'android' ? 40 : 10,
    paddingHorizontal: 16,
    paddingBottom: 12,
    backgroundColor: '#135bec',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  searchContainer: {
    flex: 1,
    height: 40,
    backgroundColor: 'rgba(255,255,255,0.2)',
    borderRadius: 20,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
  },
  searchIcon: {
    fontSize: 16,
    marginRight: 8,
    color: '#fff',
  },
  searchInput: {
    flex: 1,
    color: '#fff',
    fontSize: 14,
    fontWeight: '500',
  },
  plusBtn: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  plusText: {
    color: '#fff',
    fontSize: 28,
    fontWeight: '300',
  },
  chatList: {
    flex: 1,
  },
  chatItem: {
    flexDirection: 'row',
    padding: 16,
    alignItems: 'center',
    borderBottomWidth: 0.5,
    borderBottomColor: '#f1f5f9',
  },
  avatar: {
    width: 60,
    height: 60,
    borderRadius: 30,
    marginRight: 16,
    backgroundColor: '#f1f5f9',
  },
  chatInfo: {
    flex: 1,
    justifyContent: 'center',
  },
  chatHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 6,
  },
  chatName: {
    fontSize: 16,
    fontWeight: '700',
    color: '#1e293b',
    flex: 1,
    marginRight: 10,
  },
  chatTime: {
    fontSize: 12,
    color: '#94a3b8',
  },
  chatFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  lastMsg: {
    fontSize: 14,
    color: '#64748b',
    flex: 1,
    marginRight: 10,
  },
  unreadBadge: {
    backgroundColor: '#ef4444',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 10,
    minWidth: 20,
    alignItems: 'center',
  },
  unreadText: {
    color: '#fff',
    fontSize: 10,
    fontWeight: '700',
  },
  bottomTabs: {
    flexDirection: 'row',
    borderTopWidth: 1,
    borderTopColor: '#f1f5f9',
    paddingBottom: Platform.OS === 'ios' ? 25 : 10,
    paddingTop: 10,
  },
  tabItem: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tabIcon: {
    fontSize: 22,
    marginBottom: 4,
    color: '#94a3b8',
  },
  tabIconActive: {
    color: '#135bec',
  },
  tabLabel: {
    fontSize: 11,
    color: '#94a3b8',
    fontWeight: '600',
  },
  tabLabelActive: {
    color: '#135bec',
  },
});
