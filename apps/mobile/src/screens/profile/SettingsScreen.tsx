import AsyncStorage from '@react-native-async-storage/async-storage';
import { LinearGradient } from 'expo-linear-gradient';
import React, { useEffect, useMemo, useState } from 'react';
import {
    KeyboardAvoidingView,
    Modal,
    Platform,
    SafeAreaView,
    ScrollView,
    StatusBar,
    StyleSheet,
    Text,
    TextInput,
    TouchableOpacity,
    TouchableWithoutFeedback,
    useWindowDimensions,
    View
} from 'react-native';
import { Shadows, Typography } from '../../constants/Theme';
import { useAuth } from '../../context/AuthContext';
import { useTheme } from '../../context/ThemeContext';
import Alert from '../../utils/Alert';
import { apiPut } from '../../utils/api';

const SETTINGS_KEY = 'mobile_settings';

const DEFAULT_SETTINGS = {
  notifications: true,
  messageSound: true,
  callVibrate: true,
  showOnlineStatus: true,
  allowSearchByPhone: true,
  themeMode: 'system',
  language: 'vi',
};

const SECTION_SPACING = 14;

interface SettingRowProps {
  icon: any;
  title: any;
  subtitle?: any;
  rightElement?: any;
  onPress?: any;
  divider?: boolean;
  compact?: boolean;
  styles: any;
}

function SettingRow({ icon, title, subtitle, rightElement, onPress, divider = false, compact = false, styles }: SettingRowProps) {
  return (
    <TouchableOpacity
      activeOpacity={onPress ? 0.8 : 1}
      onPress={onPress}
      disabled={!onPress}
      style={[
        styles.row,
        compact && styles.rowCompact,
        divider && styles.rowDivider,
      ]}
    >
      <View style={[styles.rowIconBox, compact && styles.rowIconBoxCompact]}>
        <Text style={[styles.rowIcon, compact && styles.rowIconCompact]}>{icon}</Text>
      </View>
      <View style={styles.rowBody}>
        <Text style={[styles.rowTitle, compact && styles.rowTitleCompact]}>{title}</Text>
        {!!subtitle && <Text style={[styles.rowSubtitle, compact && styles.rowSubtitleCompact]}>{subtitle}</Text>}
      </View>
      <View style={styles.rowRight}>{rightElement}</View>
    </TouchableOpacity>
  );
}

interface SectionProps {
  title: any;
  subtitle?: any;
  children: React.ReactNode;
  compact?: boolean;
  cardRadius?: number;
  styles: any;
}

function Section({ title, subtitle, children, compact = false, cardRadius = 22, styles }: SectionProps) {
  return (
    <View style={[styles.sectionCard, { borderRadius: cardRadius }]}> 
      <View style={[styles.sectionHeader, compact && styles.sectionHeaderCompact]}>
        <Text style={[styles.sectionTitle, compact && styles.sectionTitleCompact]}>{title}</Text>
        {!!subtitle && <Text style={[styles.sectionSubtitle, compact && styles.sectionSubtitleCompact]}>{subtitle}</Text>}
      </View>
      {children}
    </View>
  );
}

interface ChipProps {
  label: string;
  active: boolean;
  onPress: () => void;
  compact?: boolean;
  styles: any;
}

function Chip({ label, active, onPress, compact = false, styles }: ChipProps) {
  return (
    <TouchableOpacity onPress={onPress} activeOpacity={0.85} style={[styles.chip, compact && styles.chipCompact, active && styles.chipActive]}>
      <Text style={[styles.chipText, compact && styles.chipTextCompact, active && styles.chipTextActive]}>{label}</Text>
    </TouchableOpacity>
  );
}

interface PillToggleProps {
  value: boolean;
  onValueChange: () => void;
  compact?: boolean;
  styles: any;
}

function PillToggle({ value, onValueChange, compact = false, styles }: PillToggleProps) {
  return (
    <TouchableOpacity
      activeOpacity={0.9}
      onPress={onValueChange}
      style={[
        styles.pillToggle,
        compact && styles.pillToggleCompact,
        value ? styles.pillToggleOn : styles.pillToggleOff,
      ]}
      accessibilityRole="switch"
      accessibilityState={{ checked: value }}
    >
      <View
        style={[
          styles.pillToggleKnob,
          compact && styles.pillToggleKnobCompact,
          value ? (compact ? styles.pillToggleKnobOnCompact : styles.pillToggleKnobOn) : styles.pillToggleKnobOff,
        ]}
      />
    </TouchableOpacity>
  );
}

interface SettingsScreenProps {
  onNavigate: (screen: string, params?: any) => void;
  returnTo?: string;
  onLogout: () => void;
}

export default function SettingsScreen({ onNavigate, returnTo = 'Main', onLogout }: SettingsScreenProps) {
  const { width } = useWindowDimensions();
  const storage = useMemo(() => AsyncStorage, []);
  const { requestLockAccount, confirmLockAccount, requestDeleteAccount, confirmDeleteAccount, user } = useAuth() as any;
  const { themeMode, setThemeMode, language, setLanguage, isDark, colors, t } = useTheme();
  const [settings, setSettings] = useState(DEFAULT_SETTINGS);
  const [loading, setLoading] = useState(true);
  const [lockModalVisible, setLockModalVisible] = useState(false);
  const [deleteModalVisible, setDeleteModalVisible] = useState(false);
  const isCompact = width < 380;
  const horizontalPadding = width < 360 ? 12 : 16;
  const cardRadius = isCompact ? 18 : 22;

  useEffect(() => {
    const loadSettings = async () => {
      try {
        const saved = await storage.getItem(SETTINGS_KEY);
        let parsed: any = {};
        if (saved) {
          parsed = JSON.parse(saved);
        }
        if (user && user.showOnlineStatus !== undefined) {
          parsed.showOnlineStatus = user.showOnlineStatus;
        }
        setSettings({ ...DEFAULT_SETTINGS, ...parsed });
      } catch (error) {
        console.error('Load settings error', error);
      } finally {
        setLoading(false);
      }
    };

    loadSettings();
  }, [storage, user]);

  const persistSettings = async (nextSettings: any) => {
    setSettings(nextSettings);
    await storage.setItem(SETTINGS_KEY, JSON.stringify(nextSettings));
    if (nextSettings.showOnlineStatus !== settings.showOnlineStatus) {
      try {
        await apiPut('/users/profile', { showOnlineStatus: nextSettings.showOnlineStatus });
      } catch (e) {
        console.warn('Failed to sync showOnlineStatus to server', e);
      }
    }
  };

  const updateSetting = async (key: string, value: any) => {
    const next = { ...settings, [key]: value };
    await persistSettings(next);
  };

  const handleThemeChange = async (value: string) => {
    setThemeMode(value as any);
  };

  const handleLanguageChange = async (value: string) => {
    setLanguage(value as any);
  };

  const toggleSwitch = async (key: string) => {
    await updateSetting(key, !((settings as any)[key]));
  };

  const styles = useMemo(() => getStyles(colors), [colors]);

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar barStyle={isDark ? 'light-content' : 'dark-content'} />
      <LinearGradient colors={[colors.primaryContainer, colors.primary]} style={styles.header}>
        <View style={styles.headerRow}>
          <TouchableOpacity style={styles.headerButton} onPress={() => onNavigate(returnTo)}>
            <Text style={styles.headerIcon}>arrow_back</Text>
          </TouchableOpacity>
          <View style={styles.headerTextWrap}>
            <Text style={styles.headerTitle}>{t('nav.settings')}</Text>
          </View>
        </View>
      </LinearGradient>

      <ScrollView
        style={styles.scrollView}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[styles.scrollContent, { paddingHorizontal: horizontalPadding }]}
      >

        <Section title={t('settings.section.account')} subtitle={t('settings.section.account_sub')} compact={isCompact} cardRadius={cardRadius} styles={styles}>
          <SettingRow
            icon="security"
            title={t('settings.devices')}
            subtitle={t('settings.devices_sub')}
            rightElement={<Text style={styles.chevron}>chevron_right</Text>}
            onPress={() => onNavigate('Sessions')}
            divider
            compact={isCompact}
            styles={styles}
          />
          <SettingRow
            icon="lock"
            title={t('settings.password')}
            subtitle={t('settings.password_sub')}
            rightElement={<Text style={styles.chevron}>chevron_right</Text>}
            onPress={() => onNavigate('ChangePassword')} 
            divider
            compact={isCompact}
            styles={styles}
          />
          <SettingRow
            icon="lock_person"
            title={t('settings.lock')}
            subtitle={t('settings.lock_sub')}
            rightElement={<Text style={styles.chevronDanger}>chevron_right</Text>}
            onPress={() => setLockModalVisible(true)}
            divider
            compact={isCompact}
            styles={styles}
          />
          <SettingRow
            icon="delete_forever"
            title={t('settings.delete')}
            subtitle={t('settings.delete_sub')}
            rightElement={<Text style={styles.chevronDanger}>chevron_right</Text>}
            onPress={() => setDeleteModalVisible(true)}
            compact={isCompact}
            styles={styles}
          />
        </Section>

        <Section title={t('settings.section.privacy')} subtitle={t('settings.section.privacy_sub')} compact={isCompact} cardRadius={cardRadius} styles={styles}>
          <SettingRow
            icon="visibility"
            title={t('settings.online')}
            subtitle={t('settings.online_sub')}
            rightElement={
              <PillToggle
                value={settings.showOnlineStatus}
                onValueChange={() => toggleSwitch('showOnlineStatus')}
                compact={isCompact}
                styles={styles}
              />
            }
            onPress={() => toggleSwitch('showOnlineStatus')}
            divider
            compact={isCompact}
            styles={styles}
          />
          <SettingRow
            icon="contact_phone"
            title={t('settings.search_phone')}
            subtitle={t('settings.search_phone_sub')}
            rightElement={
              <PillToggle
                value={settings.allowSearchByPhone}
                onValueChange={() => toggleSwitch('allowSearchByPhone')}
                compact={isCompact}
                styles={styles}
              />
            }
            onPress={() => toggleSwitch('allowSearchByPhone')}
            compact={isCompact}
            styles={styles}
          />
        </Section>

        <Section title={t('settings.section.notifications')} subtitle={t('settings.section.notifications_sub')} compact={isCompact} cardRadius={cardRadius} styles={styles}>
          <SettingRow
            icon="notifications"
            title={t('settings.notif')}
            subtitle={t('settings.notif_sub')}
            rightElement={
              <PillToggle
                value={settings.notifications}
                onValueChange={() => toggleSwitch('notifications')}
                compact={isCompact}
                styles={styles}
              />
            }
            onPress={() => toggleSwitch('notifications')}
            compact={isCompact}
            styles={styles}
          />
        </Section>

        <Section title={t('settings.section.theme')} subtitle={t('settings.section.theme_sub')} compact={isCompact} cardRadius={cardRadius} styles={styles}>
          <Text style={[styles.optionLabel, { fontSize: isCompact ? 13 : 14 }]}>{t('settings.theme')}</Text>
          <View style={styles.choiceRow}>
            <Chip label={t('settings.theme.system')} active={themeMode === 'system'} onPress={() => handleThemeChange('system')} compact={isCompact} styles={styles} />
            <Chip label={t('settings.theme.light')} active={themeMode === 'light'} onPress={() => handleThemeChange('light')} compact={isCompact} styles={styles} />
            <Chip label={t('settings.theme.dark')} active={themeMode === 'dark'} onPress={() => handleThemeChange('dark')} compact={isCompact} styles={styles} />
          </View>

          <Text style={[styles.optionLabel, { marginTop: SECTION_SPACING, fontSize: isCompact ? 13 : 14 }]}>{t('settings.language')}</Text>
          <View style={styles.choiceRow}>
            <Chip label={t('settings.lang.vi')} active={language === 'vi'} onPress={() => handleLanguageChange('vi')} compact={isCompact} styles={styles} />
            <Chip label={t('settings.lang.en')} active={language === 'en'} onPress={() => handleLanguageChange('en')} compact={isCompact} styles={styles} />
          </View>
        </Section>

        <View style={styles.footerNote}>
          <Text style={styles.footerNoteText}>
            {t('settings.footer')}
          </Text>
        </View>
      </ScrollView>

      {/* Lock Account Modal */}
      <AccountActionModal
        visible={lockModalVisible}
        onClose={() => setLockModalVisible(false)}
        mode="lock"
        onRequestOtp={requestLockAccount}
        onConfirmOtp={(otp) => {
          return confirmLockAccount(otp).then(() => {
            setLockModalVisible(false);
            if (onLogout) onLogout();
          });
        }}
      />

      {/* Delete Account Modal */}
      <AccountActionModal
        visible={deleteModalVisible}
        onClose={() => setDeleteModalVisible(false)}
        mode="delete"
        onRequestOtp={requestDeleteAccount}
        onConfirmOtp={(otp) => {
          return confirmDeleteAccount(otp).then(() => {
            setDeleteModalVisible(false);
            if (onLogout) onLogout();
          });
        }}
      />
    </SafeAreaView>
  );
}

const getStyles = (colors: any) => StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: colors.background,
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
    color: '#ffffff',
  },
  headerTextWrap: {
    flex: 1,
  },
  headerTitle: {
    ...Typography.heading,
    fontSize: 22,
    color: '#ffffff',
  },
  headerSubtitle: {
    ...Typography.body,
    color: 'rgba(255,255,255,0.8)',
    fontSize: 13,
    marginTop: 3,
  },
  scrollContent: {
    paddingTop: 16,
    paddingBottom: 28,
  },
  scrollView: {
    flex: 1,
  },
  profileSummary: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
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
    backgroundColor: colors.primaryContainer,
    marginRight: 12,
  },
  summaryIcon: {
    fontFamily: 'Material Symbols Outlined',
    fontSize: 26,
    color: colors.primary,
  },
  summaryTextWrap: {
    flex: 1,
  },
  summaryTitle: {
    ...Typography.heading,
    color: colors.onSurface,
    fontSize: 17,
  },
  summaryText: {
    ...Typography.body,
    color: colors.onSurfaceVariant,
    fontSize: 13,
    lineHeight: 19,
    marginTop: 4,
  },
  sectionCard: {
    backgroundColor: colors.surface,
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
  sectionHeaderCompact: {
    paddingHorizontal: 14,
    paddingTop: 12,
    paddingBottom: 8,
  },
  sectionTitle: {
    ...Typography.heading,
    fontSize: 17,
    color: colors.onSurface,
  },
  sectionTitleCompact: {
    fontSize: 15,
  },
  sectionSubtitle: {
    ...Typography.body,
    fontSize: 13,
    color: colors.onSurfaceVariant,
    marginTop: 4,
  },
  sectionSubtitleCompact: {
    fontSize: 12,
  },
  row: {
    minHeight: 68,
    paddingHorizontal: 16,
    paddingVertical: 12,
    flexDirection: 'row',
    alignItems: 'center',
  },
  rowCompact: {
    minHeight: 58,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  rowDivider: {
    borderBottomWidth: 1,
    borderBottomColor: colors.surfaceVariant,
  },
  rowIconBox: {
    width: 40,
    height: 40,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.surfaceVariant,
    marginRight: 12,
  },
  rowIconBoxCompact: {
    width: 34,
    height: 34,
    borderRadius: 12,
    marginRight: 10,
  },
  rowIcon: {
    fontFamily: 'Material Symbols Outlined',
    fontSize: 22,
    color: colors.primary,
  },
  rowIconCompact: {
    fontSize: 20,
  },
  rowBody: {
    flex: 1,
  },
  rowTitle: {
    ...Typography.body,
    color: colors.onSurface,
    fontSize: 15,
  },
  rowTitleCompact: {
    fontSize: 14,
  },
  rowSubtitle: {
    ...Typography.body,
    color: colors.onSurfaceVariant,
    fontSize: 12,
    marginTop: 3,
    lineHeight: 17,
  },
  rowSubtitleCompact: {
    fontSize: 11,
    lineHeight: 15,
  },
  rowRight: {
    marginLeft: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  chevron: {
    fontFamily: 'Material Symbols Outlined',
    fontSize: 24,
    color: colors.onSurfaceVariant,
  },
  chevronDanger: {
    fontFamily: 'Material Symbols Outlined',
    fontSize: 24,
    color: colors.error,
  },
  optionLabel: {
    ...Typography.body,
    fontSize: 14,
    color: colors.onSurface,
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
    backgroundColor: colors.background,
  },
  chipCompact: {
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  chipActive: {
    backgroundColor: colors.surfaceVariant,
  },
  chipText: {
    ...Typography.body,
    fontSize: 13,
    color: colors.onSurfaceVariant,
  },
  chipTextCompact: {
    fontSize: 12,
  },
  chipTextActive: {
    color: colors.primary,
  },
  pillToggle: {
    width: 74,
    height: 42,
    borderRadius: 999,
    position: 'relative',
    overflow: 'hidden',
  },
  pillToggleCompact: {
    width: 62,
    height: 36,
  },
  pillToggleOn: {
    backgroundColor: '#16ef67',
    borderWidth: 1,
    borderColor: '#18d95f',
  },
  pillToggleOff: {
    backgroundColor: colors.outlineVariant,
    borderWidth: 1,
    borderColor: '#d0d0d4',
  },
  pillToggleKnob: {
    position: 'absolute',
    top: 2,
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: colors.surfaceVariant,
    shadowColor: colors.outline,
    shadowOpacity: 0.16,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 1 },
    elevation: 2,
  },
  pillToggleKnobCompact: {
    width: 30,
    height: 30,
    borderRadius: 15,
  },
  pillToggleKnobOn: {
    left: 36,
  },
  pillToggleKnobOnCompact: {
    left: 30,
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
    color: colors.onSurfaceVariant,
    fontSize: 12,
    textAlign: 'center',
    lineHeight: 18,
  },
});

// ─── AccountActionModal ────────────────────────────────────────────────────────
interface AccountActionModalProps {
  visible: boolean;
  onClose: () => void;
  mode: 'lock' | 'delete';
  onRequestOtp: (password: string) => Promise<any>;
  onConfirmOtp: (otp: string) => Promise<any>;
}

function AccountActionModal({ visible, onClose, mode, onRequestOtp, onConfirmOtp }: AccountActionModalProps) {
  const { colors, t } = useTheme();
  const [step, setStep] = useState<1 | 2>(1);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [currentPassword, setCurrentPassword] = useState('');
  const [otp, setOtp] = useState('');

  const modalStyles = useMemo(() => getModalStyles(colors), [colors]);

  const isLock = mode === 'lock';
  const accentColor = isLock ? '#ea580c' : '#dc2626';
  const title = isLock ? t('settings.lock_title') : t('settings.delete_title');
  const icon = isLock ? 'lock_person' : 'delete_forever';
  const confirmLabel = isLock ? t('settings.lock_confirm') : t('settings.delete_confirm');
  const warningMsg = isLock
    ? t('settings.lock_warning')
    : t('settings.delete_warning');

  const handleClose = () => {
    setStep(1);
    setCurrentPassword('');
    setOtp('');
    setError(null);
    onClose();
  };

  const handleRequestOtp = async () => {
    if (!currentPassword) return;
    setLoading(true);
    setError(null);
    try {
      await onRequestOtp(currentPassword);
      setStep(2);
    } catch (err: any) {
      setError(err?.message || t('common.error_retry'));
    } finally {
      setLoading(false);
    }
  };

  const handleConfirmOtp = async () => {
    if (otp.length < 6) return;
    setLoading(true);
    setError(null);
    try {
      await onConfirmOtp(otp);
    } catch (err: any) {
      setError(err?.message || t('auth.otp_invalid_code'));
      setLoading(false);
    }
  };

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={handleClose}>
      <View style={modalStyles.overlay}>
        <TouchableWithoutFeedback onPress={handleClose}>
          <View style={modalStyles.backdrop} />
        </TouchableWithoutFeedback>
        
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={modalStyles.keyboardView}
        >
          <View style={modalStyles.sheet}>
            {/* Header */}
            <View style={[modalStyles.iconBox, { backgroundColor: isLock ? '#fff7ed' : '#fef2f2', borderColor: isLock ? '#fed7aa' : '#fecaca' }]}>
              <Text style={[modalStyles.icon, { color: accentColor }]}>{icon}</Text>
            </View>
            <Text style={modalStyles.title}>{title}</Text>
            <Text style={modalStyles.subtitle}>{step === 1 ? warningMsg : (t('settings.otp_sent') || 'Nhập mã OTP đã được gửi về email của bạn.')}</Text>

            {!!error && (
              <View style={modalStyles.errorBox}>
                <Text style={modalStyles.errorText}>{error}</Text>
              </View>
            )}

            {step === 1 ? (
              <View style={modalStyles.form}>
                <Text style={modalStyles.label}>{t('settings.current_password') || 'Mật khẩu hiện tại'}</Text>
                <TextInput
                  style={modalStyles.input}
                  secureTextEntry
                  placeholder={t('settings.verify_identity') || 'Xác nhận danh tính'}
                  placeholderTextColor="#9ca3af"
                  value={currentPassword}
                  onChangeText={setCurrentPassword}
                  autoFocus
                />
                <TouchableOpacity
                  style={[modalStyles.btn, { backgroundColor: accentColor, opacity: loading || !currentPassword ? 0.5 : 1 }]}
                  onPress={handleRequestOtp}
                  disabled={loading || !currentPassword}
                  activeOpacity={0.85}
                >
                  <Text style={modalStyles.btnText}>{loading ? (t('common.sending') || 'Đang gửi...') : (t('common.continue') || 'Tiếp tục')}</Text>
                </TouchableOpacity>
              </View>
            ) : (
              <View style={modalStyles.form}>
                <TextInput
                  style={modalStyles.otpInput}
                  keyboardType="number-pad"
                  maxLength={6}
                  placeholder="000000"
                  placeholderTextColor="#d1d5db"
                  value={otp}
                  onChangeText={setOtp}
                  autoFocus
                />
                <TouchableOpacity
                  style={[modalStyles.btn, { backgroundColor: accentColor, opacity: loading || otp.length < 6 ? 0.5 : 1 }]}
                  onPress={handleConfirmOtp}
                  disabled={loading || otp.length < 6}
                  activeOpacity={0.85}
                >
                  <Text style={modalStyles.btnText}>{loading ? (t('common.processing') || 'Đang xử lý...') : confirmLabel}</Text>
                </TouchableOpacity>
                <TouchableOpacity style={modalStyles.backBtn} onPress={() => setStep(1)}>
                  <Text style={modalStyles.backBtnText}>{t('common.go_back') || 'Quay lại'}</Text>
                </TouchableOpacity>
              </View>
            )}

            <TouchableOpacity style={modalStyles.cancelBtn} onPress={handleClose}>
              <Text style={modalStyles.cancelText}>{t('common.close') || 'Đóng'}</Text>
            </TouchableOpacity>
          </View>
        </KeyboardAvoidingView>
      </View>
    </Modal>
  );
}

const getModalStyles = (colors: any) => StyleSheet.create({
  overlay: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.6)',
  },
  keyboardView: {
    width: '100%',
    alignItems: 'center',
    justifyContent: 'center',
  },
  sheet: {
    width: '88%',
    maxWidth: 340,
    backgroundColor: colors.surface,
    borderRadius: 32,
    padding: 24,
    alignItems: 'center',
    ...Shadows.strong,
    elevation: 10,
  },
  form: {
    width: '100%',
    alignItems: 'center',
  },
  iconBox: {
    width: 64,
    height: 64,
    borderRadius: 22,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
    ...Shadows.soft,
  },
  icon: {
    fontFamily: 'Material Symbols Outlined',
    fontSize: 34,
  },
  title: {
    ...Typography.heading,
    fontSize: 22,
    color: colors.onSurface,
    marginBottom: 10,
    textAlign: 'center',
  },
  subtitle: {
    ...Typography.body,
    fontSize: 14,
    color: colors.onSurfaceVariant,
    textAlign: 'center',
    lineHeight: 21,
    marginBottom: 24,
    paddingHorizontal: 10,
  },
  errorBox: {
    width: '100%',
    backgroundColor: '#fef2f2',
    borderRadius: 14,
    padding: 12,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#fee2e2',
  },
  errorText: {
    ...Typography.body,
    fontSize: 13,
    color: '#dc2626',
    textAlign: 'center',
    fontWeight: '600',
  },
  label: {
    ...Typography.heading,
    fontSize: 13,
    color: colors.onSurfaceVariant,
    alignSelf: 'flex-start',
    marginBottom: 8,
    marginLeft: 4,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  input: {
    width: '100%',
    height: 56,
    borderWidth: 1.5,
    borderColor: colors.surfaceVariant,
    borderRadius: 18,
    paddingHorizontal: 18,
    fontSize: 16,
    color: colors.onSurface,
    marginBottom: 20,
    backgroundColor: colors.surface,
  },
  otpInput: {
    width: '100%',
    height: 80,
    borderWidth: 2,
    borderColor: colors.primary,
    borderRadius: 24,
    textAlign: 'center',
    fontSize: 36,
    letterSpacing: 12,
    color: colors.primary,
    marginBottom: 24,
    backgroundColor: colors.surfaceVariant,
    fontWeight: 'bold',
  },
  btn: {
    width: '100%',
    height: 56,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 14,
    ...Shadows.soft,
  },
  btnText: {
    ...Typography.heading,
    color: colors.surface,
    fontSize: 16,
    letterSpacing: 0.5,
  },
  backBtn: {
    paddingVertical: 10,
    marginTop: 4,
  },
  backBtnText: {
    ...Typography.body,
    color: colors.primary,
    fontSize: 15,
    fontWeight: '600',
  },
  cancelBtn: {
    paddingVertical: 12,
    marginTop: 8,
    width: '100%',
    alignItems: 'center',
  },
  cancelText: {
    ...Typography.body,
    color: colors.onSurfaceVariant,
    fontSize: 15,
  },
});
