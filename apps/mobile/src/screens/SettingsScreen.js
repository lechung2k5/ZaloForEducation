import AsyncStorage from '@react-native-async-storage/async-storage';
import { LinearGradient } from 'expo-linear-gradient';
import React, { useEffect, useMemo, useState } from 'react';
import {
    SafeAreaView,
    ScrollView,
    StatusBar,
    StyleSheet,
    Text,
    TouchableOpacity,
    View
} from 'react-native';
import { Colors, Shadows, Typography } from '../constants/Theme';
import Alert from '../utils/Alert';

const SETTINGS_KEY = 'mobile_settings';

const DEFAULT_SETTINGS = {
  notifications: true,
  messageSound: true,
  callVibrate: true,
  lockApp: false,
  showOnlineStatus: true,
  allowSearchByPhone: true,
  syncContacts: true,
  saveMediaToDevice: false,
  themeMode: 'system',
  language: 'vi',
};

const SECTION_SPACING = 14;

function SettingRow({ icon, title, subtitle, rightElement, onPress, divider = false }) {
  return (
    <TouchableOpacity
      activeOpacity={onPress ? 0.8 : 1}
      onPress={onPress}
      disabled={!onPress}
      style={[styles.row, divider && styles.rowDivider]}
    >
      <View style={styles.rowIconBox}>
        <Text style={styles.rowIcon}>{icon}</Text>
      </View>
      <View style={styles.rowBody}>
        <Text style={styles.rowTitle}>{title}</Text>
        {!!subtitle && <Text style={styles.rowSubtitle}>{subtitle}</Text>}
      </View>
      <View style={styles.rowRight}>{rightElement}</View>
    </TouchableOpacity>
  );
}

function Section({ title, subtitle, children }) {
  return (
    <View style={styles.sectionCard}>
      <View style={styles.sectionHeader}>
        <Text style={styles.sectionTitle}>{title}</Text>
        {!!subtitle && <Text style={styles.sectionSubtitle}>{subtitle}</Text>}
      </View>
      {children}
    </View>
  );
}

function Chip({ label, active, onPress }) {
  return (
    <TouchableOpacity onPress={onPress} activeOpacity={0.85} style={[styles.chip, active && styles.chipActive]}>
      <Text style={[styles.chipText, active && styles.chipTextActive]}>{label}</Text>
    </TouchableOpacity>
  );
}

function PillToggle({ value, onValueChange }) {
  return (
    <TouchableOpacity
      activeOpacity={0.9}
      onPress={onValueChange}
      style={[styles.pillToggle, value ? styles.pillToggleOn : styles.pillToggleOff]}
      accessibilityRole="switch"
      accessibilityState={{ checked: value }}
    >
      <View style={[styles.pillToggleKnob, value ? styles.pillToggleKnobOn : styles.pillToggleKnobOff]} />
    </TouchableOpacity>
  );
}

export default function SettingsScreen({ onNavigate, returnTo = 'home', onLogout }) {
  const storage = useMemo(() => AsyncStorage.default || AsyncStorage, []);
  const [settings, setSettings] = useState(DEFAULT_SETTINGS);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadSettings = async () => {
      try {
        const saved = await storage.getItem(SETTINGS_KEY);
        if (saved) {
          setSettings({ ...DEFAULT_SETTINGS, ...JSON.parse(saved) });
        }
      } catch (error) {
        console.error('Load settings error', error);
      } finally {
        setLoading(false);
      }
    };

    loadSettings();
  }, [storage]);

  const persistSettings = async (nextSettings) => {
    setSettings(nextSettings);
    await storage.setItem(SETTINGS_KEY, JSON.stringify(nextSettings));
  };

  const updateSetting = async (key, value) => {
    const next = { ...settings, [key]: value };
    await persistSettings(next);
  };

  const handleClearLocalData = () => {
    Alert.alert('Xóa dữ liệu cục bộ', 'Xóa dữ liệu thiết bị đã lưu trong app?', [
      { text: 'Hủy', style: 'cancel' },
      {
        text: 'Xóa',
        style: 'destructive',
        onPress: async () => {
          await storage.removeItem(SETTINGS_KEY);
          setSettings(DEFAULT_SETTINGS);
          Alert.alert('Thành công', 'Đã khôi phục cài đặt mặc định.');
        },
      },
    ]);
  };

  const handleSupport = () => {
    Alert.alert('Contact support', 'Tính năng hỗ trợ sẽ được kết nối với trung tâm trợ giúp trong bản tiếp theo.');
  };

  const handleAbout = () => {
    Alert.alert('About Zalo', 'Zalo Education Mobile\nPhiên bản giáo dục nội bộ cho hồ sơ, thiết bị và cài đặt.');
  };

  const handleRestore = () => {
    Alert.alert('Backup and restore', 'Tính năng sao lưu và khôi phục dữ liệu sẽ được mở rộng ở bản cập nhật tiếp theo.');
  };

  const handleThemeChange = async (value) => {
    await updateSetting('themeMode', value);
  };

  const handleLanguageChange = async (value) => {
    await updateSetting('language', value);
  };

  const toggleSwitch = async (key) => {
    await updateSetting(key, !settings[key]);
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar barStyle="light-content" />
      <LinearGradient colors={['#0058bc', '#00418f']} style={styles.header}>
        <View style={styles.headerRow}>
          <TouchableOpacity style={styles.headerButton} onPress={() => onNavigate(returnTo)}>
            <Text style={styles.headerIcon}>arrow_back</Text>
          </TouchableOpacity>
          <View style={styles.headerTextWrap}>
            <Text style={styles.headerTitle}>Settings</Text>
            <Text style={styles.headerSubtitle}>Quản lý quyền riêng tư, thông báo và giao diện</Text>
          </View>
          <TouchableOpacity style={styles.headerButton} onPress={handleSupport}>
            <Text style={styles.headerIcon}>search</Text>
          </TouchableOpacity>
        </View>
      </LinearGradient>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>
        <View style={styles.profileSummary}>
          <View style={styles.summaryBadge}>
            <Text style={styles.summaryIcon}>settings</Text>
          </View>
          <View style={styles.summaryTextWrap}>
            <Text style={styles.summaryTitle}>Tùy chỉnh trải nghiệm mobile</Text>
            <Text style={styles.summaryText}>
              Các thay đổi ở đây được lưu trên thiết bị và đồng bộ theo tài khoản khi có hỗ trợ backend.
            </Text>
          </View>
        </View>

        <Section title="Account and security" subtitle="Thiết bị, mật khẩu và bảo mật">
          <SettingRow
            icon="security"
            title="Quản lý thiết bị đăng nhập"
            subtitle="Xem và đăng xuất phiên đang hoạt động"
            rightElement={<Text style={styles.chevron}>chevron_right</Text>}
            onPress={() => onNavigate('sessions')}
          />
          <SettingRow
            icon="lock"
            title="Đổi mật khẩu"
            subtitle="Cập nhật mật khẩu để tăng an toàn"
            rightElement={<Text style={styles.chevron}>chevron_right</Text>}
            onPress={() => onNavigate('change-password')} 
            divider
          />
          <SettingRow
            icon="verified_user"
            title="Khóa ứng dụng"
            subtitle="Bật xác thực khi mở app"
            rightElement={
              <PillToggle
                value={settings.lockApp}
                onValueChange={() => toggleSwitch('lockApp')}
              />
            }
          />
        </Section>

        <Section title="Privacy" subtitle="Ai nhìn thấy dữ liệu cá nhân của bạn">
          <SettingRow
            icon="visibility"
            title="Trạng thái hoạt động"
            subtitle="Hiển thị khi bạn đang online"
            rightElement={
              <PillToggle
                value={settings.showOnlineStatus}
                onValueChange={() => toggleSwitch('showOnlineStatus')}
              />
            }
          />
          <SettingRow
            icon="contact_phone"
            title="Tìm bằng số điện thoại"
            subtitle="Cho phép người khác tìm bạn qua số điện thoại"
            rightElement={
              <PillToggle
                value={settings.allowSearchByPhone}
                onValueChange={() => toggleSwitch('allowSearchByPhone')}
              />
            }
            divider
          />
          <SettingRow
            icon="badge"
            title="Đồng bộ danh bạ"
            subtitle="Kết nối danh bạ để gợi ý liên hệ"
            rightElement={
              <PillToggle
                value={settings.syncContacts}
                onValueChange={() => toggleSwitch('syncContacts')}
              />
            }
          />
        </Section>

        <Section title="Notifications" subtitle="Âm thanh, rung và nhắc nhở">
          <SettingRow
            icon="notifications"
            title="Thông báo"
            subtitle="Nhận thông báo từ ứng dụng"
            rightElement={
              <PillToggle
                value={settings.notifications}
                onValueChange={() => toggleSwitch('notifications')}
              />
            }
          />
          <SettingRow
            icon="message"
            title="Âm thanh tin nhắn"
            subtitle="Phát âm thanh khi có tin mới"
            rightElement={
              <PillToggle
                value={settings.messageSound}
                onValueChange={() => toggleSwitch('messageSound')}
              />
            }
            divider
          />
          <SettingRow
            icon="phone_in_talk"
            title="Rung cuộc gọi"
            subtitle="Rung khi có cuộc gọi đến"
            rightElement={
              <PillToggle
                value={settings.callVibrate}
                onValueChange={() => toggleSwitch('callVibrate')}
              />
            }
          />
        </Section>

        <Section title="Messages" subtitle="Tin nhắn, media và lưu trữ">
          <SettingRow
            icon="forum"
            title="Lưu media về máy"
            subtitle="Tự động lưu ảnh và video nhận được"
            rightElement={
              <PillToggle
                value={settings.saveMediaToDevice}
                onValueChange={() => toggleSwitch('saveMediaToDevice')}
              />
            }
          />
          <SettingRow
            icon="backup"
            title="Backup and restore"
            subtitle="Sao lưu và khôi phục dữ liệu"
            rightElement={<Text style={styles.chevron}>chevron_right</Text>}
            onPress={handleRestore}
            divider
          />
          <SettingRow
            icon="delete_forever"
            title="Xóa dữ liệu cục bộ"
            subtitle="Xóa cài đặt lưu trên thiết bị"
            rightElement={<Text style={styles.chevronDanger}>chevron_right</Text>}
            onPress={handleClearLocalData}
          />
        </Section>

        <Section title="Theme and language" subtitle="Giao diện hiển thị">
          <Text style={styles.optionLabel}>Theme</Text>
          <View style={styles.choiceRow}>
            <Chip label="System" active={settings.themeMode === 'system'} onPress={() => handleThemeChange('system')} />
            <Chip label="Light" active={settings.themeMode === 'light'} onPress={() => handleThemeChange('light')} />
            <Chip label="Dark" active={settings.themeMode === 'dark'} onPress={() => handleThemeChange('dark')} />
          </View>

          <Text style={[styles.optionLabel, { marginTop: SECTION_SPACING }]}>Language</Text>
          <View style={styles.choiceRow}>
            <Chip label="Tiếng Việt" active={settings.language === 'vi'} onPress={() => handleLanguageChange('vi')} />
            <Chip label="English" active={settings.language === 'en'} onPress={() => handleLanguageChange('en')} />
          </View>
        </Section>

        <Section title="About Zalo" subtitle="Thông tin ứng dụng và hỗ trợ">
          <SettingRow
            icon="info"
            title="About Zalo"
            subtitle="Phiên bản, điều khoản và cập nhật"
            rightElement={<Text style={styles.chevron}>chevron_right</Text>}
            onPress={handleAbout}
          />
          <SettingRow
            icon="support_agent"
            title="Contact support"
            subtitle="Liên hệ khi cần trợ giúp"
            rightElement={<Text style={styles.chevron}>chevron_right</Text>}
            onPress={handleSupport}
            divider
          />
          <SettingRow
            icon="logout"
            title="Đăng xuất"
            subtitle="Thoát khỏi tài khoản hiện tại"
            rightElement={<Text style={styles.chevronDanger}>chevron_right</Text>}
            onPress={onLogout}
          />
        </Section>

        <View style={styles.footerNote}>
          <Text style={styles.footerNoteText}>
            Settings được lưu cục bộ trên thiết bị để phù hợp với luồng mobile hiện tại.
          </Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  header: {
    paddingTop: 14,
    paddingBottom: 18,
    paddingHorizontal: 16,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  headerButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.14)',
  },
  headerIcon: {
    fontFamily: 'Material Symbols Outlined',
    fontSize: 24,
    color: '#fff',
  },
  headerTextWrap: {
    flex: 1,
  },
  headerTitle: {
    ...Typography.heading,
    fontSize: 22,
    color: '#fff',
  },
  headerSubtitle: {
    ...Typography.body,
    color: 'rgba(255,255,255,0.8)',
    fontSize: 13,
    marginTop: 3,
  },
  scrollContent: {
    padding: 16,
    paddingBottom: 28,
  },
  profileSummary: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    borderRadius: 22,
    padding: 16,
    marginBottom: 16,
    ...Shadows.soft,
  },
  summaryBadge: {
    width: 56,
    height: 56,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#e7f1ff',
    marginRight: 12,
  },
  summaryIcon: {
    fontFamily: 'Material Symbols Outlined',
    fontSize: 26,
    color: Colors.primary,
  },
  summaryTextWrap: {
    flex: 1,
  },
  summaryTitle: {
    ...Typography.heading,
    color: Colors.onSurface,
    fontSize: 17,
  },
  summaryText: {
    ...Typography.body,
    color: Colors.onSurfaceVariant,
    fontSize: 13,
    lineHeight: 19,
    marginTop: 4,
  },
  sectionCard: {
    backgroundColor: '#fff',
    borderRadius: 22,
    paddingVertical: 6,
    marginBottom: 14,
    ...Shadows.soft,
  },
  sectionHeader: {
    paddingHorizontal: 16,
    paddingTop: 14,
    paddingBottom: 10,
  },
  sectionTitle: {
    ...Typography.heading,
    fontSize: 17,
    color: Colors.onSurface,
  },
  sectionSubtitle: {
    ...Typography.body,
    fontSize: 13,
    color: Colors.onSurfaceVariant,
    marginTop: 4,
  },
  row: {
    minHeight: 68,
    paddingHorizontal: 16,
    paddingVertical: 12,
    flexDirection: 'row',
    alignItems: 'center',
  },
  rowDivider: {
    borderBottomWidth: 1,
    borderBottomColor: '#edf0f4',
  },
  rowIconBox: {
    width: 40,
    height: 40,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#edf5ff',
    marginRight: 12,
  },
  rowIcon: {
    fontFamily: 'Material Symbols Outlined',
    fontSize: 22,
    color: Colors.primary,
  },
  rowBody: {
    flex: 1,
  },
  rowTitle: {
    ...Typography.body,
    color: Colors.onSurface,
    fontSize: 15,
  },
  rowSubtitle: {
    ...Typography.body,
    color: Colors.onSurfaceVariant,
    fontSize: 12,
    marginTop: 3,
    lineHeight: 17,
  },
  rowRight: {
    marginLeft: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  chevron: {
    fontFamily: 'Material Symbols Outlined',
    fontSize: 24,
    color: Colors.onSurfaceVariant,
  },
  chevronDanger: {
    fontFamily: 'Material Symbols Outlined',
    fontSize: 24,
    color: Colors.error,
  },
  optionLabel: {
    ...Typography.body,
    fontSize: 14,
    color: Colors.onSurface,
    paddingHorizontal: 16,
    marginBottom: 10,
  },
  choiceRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    paddingHorizontal: 16,
    paddingBottom: 6,
  },
  chip: {
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 999,
    backgroundColor: '#f2f5fa',
  },
  chipActive: {
    backgroundColor: '#dcecff',
  },
  chipText: {
    ...Typography.body,
    fontSize: 13,
    color: Colors.onSurfaceVariant,
  },
  chipTextActive: {
    color: Colors.primary,
  },
  pillToggle: {
    width: 74,
    height: 42,
    borderRadius: 999,
    position: 'relative',
    overflow: 'hidden',
  },
  pillToggleOn: {
    backgroundColor: '#16ef67',
    borderWidth: 1,
    borderColor: '#18d95f',
  },
  pillToggleOff: {
    backgroundColor: '#d9d9dc',
    borderWidth: 1,
    borderColor: '#d0d0d4',
  },
  pillToggleKnob: {
    position: 'absolute',
    top: 2,
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#f0f0f0',
    shadowColor: '#0f172a',
    shadowOpacity: 0.16,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 1 },
    elevation: 2,
  },
  pillToggleKnobOn: {
    left: 36,
  },
  pillToggleKnobOff: {
    left: 2,
  },
  footerNote: {
    paddingHorizontal: 8,
    paddingTop: 4,
    paddingBottom: 8,
  },
  footerNoteText: {
    ...Typography.body,
    color: Colors.onSurfaceVariant,
    fontSize: 12,
    textAlign: 'center',
    lineHeight: 18,
  },
});
