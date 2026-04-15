import AsyncStorage from '@react-native-async-storage/async-storage';
import { LinearGradient } from 'expo-linear-gradient';
import React, { useEffect, useMemo, useState } from 'react';
import {
    ScrollView,
    StatusBar,
    StyleSheet,
    Text,
    TextInput,
    TouchableOpacity,
    View
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Colors, Shadows, Typography } from '../constants/Theme';
import Alert from '../utils/Alert';
import { getApiBaseUrl } from '../utils/api';

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
const API_BASE = getApiBaseUrl();

function SettingRow({ icon, title, subtitle, rightElement, onPress, divider = false }) {
  return (
    <TouchableOpacity
      activeOpacity={onPress ? 0.8 : 1}
      onPress={onPress}
      disabled={!onPress}
      style={[styles.row, divider && styles.rowDivider]}
    >
      {!!icon && (
        <View style={styles.rowIconBox}>
          <Text style={styles.rowIcon}>{icon}</Text>
        </View>
      )}
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
  const [lockingAccount, setLockingAccount] = useState(false);
  const [deletingAccount, setDeletingAccount] = useState(false);
  const [showLockOtpForm, setShowLockOtpForm] = useState(false);
  const [lockOtp, setLockOtp] = useState('');
  const [lockNotice, setLockNotice] = useState({ type: null, text: '' });
  const [showDeleteConfirmForm, setShowDeleteConfirmForm] = useState(false);
  const [deleteConfirmText, setDeleteConfirmText] = useState('');
  const [deleteNotice, setDeleteNotice] = useState({ type: null, text: '' });

  useEffect(() => {
    const loadSettings = async () => {
      try {
        const saved = await storage.getItem(SETTINGS_KEY);
        if (saved) {
          setSettings({ ...DEFAULT_SETTINGS, ...JSON.parse(saved) });
        }
      } catch (error) {
        console.error('Load settings error', error);
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
    Alert.alert('About Zalo', 'ZaloEdu Mobile\nPhiên bản giáo dục nội bộ cho hồ sơ, thiết bị và cài đặt.');
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

  const handleLockAccount = async () => {
    setLockNotice({ type: null, text: '' });
    setLockingAccount(true);
    try {
      const token = await storage.getItem('token');
      const requestOtpResponse = await fetch(`${API_BASE}/auth/account/request-lock-otp`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      });

      const requestOtpData = await requestOtpResponse.json();
      if (!requestOtpResponse.ok) {
        setLockNotice({ type: 'error', text: requestOtpData.message || 'Không thể gửi mã OTP xác nhận khóa tài khoản' });
        return;
      }

      setShowLockOtpForm(true);
      setLockOtp('');
      setLockNotice({ type: 'success', text: requestOtpData.message || 'Mã OTP đã được gửi qua email.' });
    } catch (error) {
      setLockNotice({ type: 'error', text: 'Lỗi kết nối, vui lòng thử lại' });
    } finally {
      setLockingAccount(false);
    }
  };

  const handleConfirmLockAccount = async () => {
    if (!lockOtp.trim()) {
      setLockNotice({ type: 'error', text: 'Vui lòng nhập mã OTP.' });
      return;
    }

    setLockingAccount(true);
    try {
      const token = await storage.getItem('token');
      const confirmResponse = await fetch(`${API_BASE}/auth/account/confirm-lock-otp`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ otp: lockOtp.trim(), reason: 'Yêu cầu từ người dùng' }),
      });

      const confirmData = await confirmResponse.json();
      if (confirmResponse.ok) {
        setLockNotice({ type: 'success', text: confirmData.message || 'Khóa tài khoản thành công.' });
        setShowLockOtpForm(false);
        setLockOtp('');
        await storage.removeItem('token');
        onLogout();
      } else {
        setLockNotice({ type: 'error', text: confirmData.message || 'Không thể khóa tài khoản' });
      }
    } catch (error) {
      setLockNotice({ type: 'error', text: 'Lỗi kết nối, vui lòng thử lại' });
    } finally {
      setLockingAccount(false);
    }
  };

  const handleDeleteAccount = () => {
    setDeleteNotice({ type: 'error', text: 'Nhập XÓA CÓ để xác nhận xóa tài khoản vĩnh viễn.' });
    setShowDeleteConfirmForm(true);
    setDeleteConfirmText('');
  };

  const handleConfirmDeleteAccount = async () => {
    if (deleteConfirmText.trim() !== 'XÓA CÓ') {
      setDeleteNotice({ type: 'error', text: 'Vui lòng nhập đúng XÓA CÓ để xác nhận.' });
      return;
    }

    setDeletingAccount(true);
    try {
      const token = await storage.getItem('token');
      const response = await fetch(`${API_BASE}/auth/account/delete`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      });

      const data = await response.json();
      if (response.ok) {
        Alert.alert('Thành công', data.message);
        await storage.removeItem('token');
        onLogout();
      } else {
        setDeleteNotice({ type: 'error', text: data.message || 'Không thể xóa tài khoản' });
      }
    } catch (error) {
      setDeleteNotice({ type: 'error', text: 'Lỗi kết nối, vui lòng thử lại' });
    } finally {
      setDeletingAccount(false);
    }
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
            onPress={() => Alert.alert('Sắp ra mắt', 'Tính năng đổi mật khẩu sẽ được mở sau.')} 
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

        <Section title="Bảo mật tài khoản" subtitle="Quản lý bảo mật và xóa tài khoản">
          <SettingRow
            icon={null}
            title="Khóa tài khoản (OTP email)"
            subtitle="Yêu cầu mã xác nhận email trước khi khóa"
            rightElement={<Text style={styles.chevronWarning}>chevron_right</Text>}
            onPress={handleLockAccount}
            divider
          />

          {!!lockNotice.text && (
            <View style={[styles.otpNotice, lockNotice.type === 'success' ? styles.otpNoticeSuccess : styles.otpNoticeError]}>
              <Text style={[styles.otpNoticeText, lockNotice.type === 'success' ? styles.otpNoticeTextSuccess : styles.otpNoticeTextError]}>{lockNotice.text}</Text>
            </View>
          )}

          {showLockOtpForm && (
            <View style={styles.otpFormWrap}>
              <Text style={styles.otpFormLabel}>Nhập mã OTP đã gửi qua email</Text>
              <TextInput
                style={styles.otpInput}
                value={lockOtp}
                onChangeText={setLockOtp}
                keyboardType="number-pad"
                placeholder="Nhập mã OTP"
                placeholderTextColor={Colors.outline}
                editable={!lockingAccount}
              />
              <View style={styles.otpActions}>
                <TouchableOpacity style={[styles.otpBtnPrimary, lockingAccount && styles.otpBtnDisabled]} onPress={handleConfirmLockAccount} disabled={lockingAccount}>
                  <Text style={styles.otpBtnPrimaryText}>{lockingAccount ? 'Đang xác nhận...' : 'Xác nhận OTP'}</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.otpBtnSecondary, lockingAccount && styles.otpBtnDisabled]}
                  onPress={() => {
                    setShowLockOtpForm(false);
                    setLockOtp('');
                  }}
                  disabled={lockingAccount}
                >
                  <Text style={styles.otpBtnSecondaryText}>Hủy</Text>
                </TouchableOpacity>
              </View>
            </View>
          )}

          <SettingRow
            icon={null}
            title="Xóa tài khoản"
            subtitle="Xóa tài khoản vĩnh viễn"
            rightElement={<Text style={styles.chevronDanger}>chevron_right</Text>}
            onPress={() => {
              setShowDeleteConfirmForm(true);
              setDeleteConfirmText('');
              setDeleteNotice({ type: 'error', text: 'Nhập XÓA CÓ để xác nhận xóa tài khoản vĩnh viễn.' });
            }}
          />

          {!!deleteNotice.text && (
            <View style={[styles.otpNotice, deleteNotice.type === 'success' ? styles.otpNoticeSuccess : styles.otpNoticeError]}>
              <Text style={[styles.otpNoticeText, deleteNotice.type === 'success' ? styles.otpNoticeTextSuccess : styles.otpNoticeTextError]}>{deleteNotice.text}</Text>
            </View>
          )}

          {showDeleteConfirmForm && (
            <View style={styles.otpFormWrap}>
              <Text style={styles.otpFormLabel}>Nhập XÓA CÓ để xác nhận xóa tài khoản</Text>
              <TextInput
                style={styles.otpInput}
                value={deleteConfirmText}
                onChangeText={setDeleteConfirmText}
                placeholder='Nhập XÓA CÓ'
                placeholderTextColor={Colors.outline}
                editable={!deletingAccount}
              />
              <View style={styles.otpActions}>
                <TouchableOpacity style={[styles.otpBtnPrimary, deletingAccount && styles.otpBtnDisabled]} onPress={handleConfirmDeleteAccount} disabled={deletingAccount}>
                  <Text style={styles.otpBtnPrimaryText}>{deletingAccount ? 'Đang xóa...' : 'Xác nhận xóa'}</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.otpBtnSecondary, deletingAccount && styles.otpBtnDisabled]}
                  onPress={() => {
                    setShowDeleteConfirmForm(false);
                    setDeleteConfirmText('');
                    setDeleteNotice({ type: null, text: '' });
                  }}
                  disabled={deletingAccount}
                >
                  <Text style={styles.otpBtnSecondaryText}>Hủy</Text>
                </TouchableOpacity>
              </View>
            </View>
          )}
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
  chevronWarning: {
    fontFamily: 'Material Symbols Outlined',
    fontSize: 24,
    color: '#d97706',
  },
  otpFormWrap: {
    marginTop: 10,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: '#fde68a',
    backgroundColor: '#fff7ed',
    borderRadius: 14,
    padding: 12,
    marginHorizontal: 16,
  },
  otpNotice: {
    marginHorizontal: 16,
    marginTop: 10,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  otpNoticeSuccess: {
    backgroundColor: '#dcfce7',
  },
  otpNoticeError: {
    backgroundColor: '#fee2e2',
  },
  otpNoticeText: {
    ...Typography.body,
    fontSize: 13,
  },
  otpNoticeTextSuccess: {
    color: '#166534',
  },
  otpNoticeTextError: {
    color: '#991b1b',
  },
  otpFormLabel: {
    ...Typography.body,
    fontSize: 13,
    color: '#7c2d12',
    marginBottom: 8,
  },
  otpInput: {
    borderWidth: 1,
    borderColor: '#fbbf24',
    backgroundColor: '#fff',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    color: Colors.onSurface,
    ...Typography.body,
    fontSize: 14,
  },
  otpActions: {
    marginTop: 10,
    flexDirection: 'row',
    gap: 8,
  },
  otpBtnPrimary: {
    flex: 1,
    borderRadius: 10,
    backgroundColor: '#ea580c',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
  },
  otpBtnPrimaryText: {
    ...Typography.label,
    color: '#fff',
    fontSize: 13,
  },
  otpBtnSecondary: {
    borderRadius: 10,
    backgroundColor: '#e5e7eb',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  otpBtnSecondaryText: {
    ...Typography.label,
    color: '#1f2937',
    fontSize: 13,
  },
  otpBtnDisabled: {
    opacity: 0.55,
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
