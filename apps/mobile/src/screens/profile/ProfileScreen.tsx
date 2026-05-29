/**
 * ProfileScreen.js
 *
 * Màn hình thông tin cá nhân đã được tích hợp và chuẩn hóa:
 *  - Alert: dùng utils/Alert (không có sweetalert2)
 *  - Avatar: chỉ cho phép upload ảnh qua S3 (expo-image-picker)
 *  - Icons: Material Symbols Outlined đã được load trong App.js
 *  - Date: đọc/ghi theo DD-MM-YYYY (khớp với backend)
 *  - DynamoDB: chỉ dùng avatarUrl, fullName (không dùng urlAvatar, fullname)
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import React, { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Image,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Shadows, Typography } from '../../constants/Theme';
import { useTheme } from '../../context/ThemeContext';
import Alert from '../../utils/Alert';
import { useAuth } from '../../context/AuthContext';
import { toDateParts, formatDisplayDate } from '../../utils/date';
import { apiGet, apiPost, apiPut, apiUpload, chatGet, chatPost } from '../../utils/api';
import { ASSETS } from '../../utils/assets';

const API_URL = process.env.EXPO_PUBLIC_API_URL || 'http://localhost:3000';
const COVER_URL =
  'https://images.unsplash.com/photo-1507525428034-b723cf961d3e?auto=format&fit=crop&w=1200&q=80';

const EMPTY_PROFILE = {
  fullName: '',
  email: '',
  phone: '',
  address: '',
  bio: '',
  dataOfBirth: '',   // DD-MM-YYYY
  gender: true,
  avatarUrl: '',
  backgroundUrl: '',
};

// helpers removed - now using src/utils/date.js

// ─── Component ───────────────────────────────────────────────────────────────

interface ProfileScreenProps {
  onNavigate: (screen: string, params?: any, context?: string) => void;
  onLogout: () => void;
  goBack: () => void;
  params?: {
    userId?: string;
  };
}

export default function ProfileScreen({ onNavigate, onLogout, goBack, params }: ProfileScreenProps) {
  const { user: authUser, updateUser, profileVersion } = useAuth() as any;
  const { colors, t, isDark } = useTheme();
  
  // [SEARCH_FIX] Detect if viewing self or another user
  const targetUserId = params?.userId;
  const normalizeEmail = (email?: string) => String(email || '').trim().toLowerCase();
  const isMe = !targetUserId || normalizeEmail(targetUserId) === normalizeEmail(authUser?.email);

  const [profile, setProfile]   = useState<any>(() => ({
    ...EMPTY_PROFILE,
    ...(authUser || {}),
  }));
  const [draft,   setDraft]     = useState<any>(() => ({
    ...EMPTY_PROFILE,
    ...(authUser || {}),
  }));
  
  const [loading, setLoading]   = useState(true);
  const [saving,  setSaving]    = useState(false);
  const [editing, setEditing]   = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploadingCover, setUploadingCover] = useState(false);
  const [friendship, setFriendship] = useState<any>(null);

  const authHeaders = async () => {
    const token = await AsyncStorage.getItem('token');
    return token
      ? { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }
      : { 'Content-Type': 'application/json' };
  };

interface ProfileData {
  fullName: string;
  phone: string;
  address: string;
  bio: string;
  dataOfBirth: string;
  gender: boolean;
  avatarUrl: string;
  backgroundUrl: string;
}

  const normalizeProfile = (source: any = {}) => ({
    ...EMPTY_PROFILE,
    ...source,
    fullName:  source.fullName || source.fullname || source.nickname || '',
    avatarUrl:      source.avatarUrl || source.urlAvatar || source.avatar || '',
    backgroundUrl:  source.backgroundUrl || '',
    gender:         typeof source.gender === 'boolean' ? source.gender : true,
  });

  // ── Persist user vào AsyncStorage ───────────────────────────────────────────

  const persistUser = async (nextProfile: any) => {
    const savedUser    = await AsyncStorage.getItem('user');
    const currentUser  = savedUser ? JSON.parse(savedUser) : {};
    const mergedUser   = {
      ...currentUser,
      ...nextProfile,
      fullName:  nextProfile.fullName  || currentUser.fullName  || '',
      avatarUrl:     nextProfile.avatarUrl     || currentUser.avatarUrl     || '',
      backgroundUrl: nextProfile.backgroundUrl || currentUser.backgroundUrl || '',
    };
    await AsyncStorage.setItem('user', JSON.stringify(mergedUser));
  };

  // ── Load profile ─────────────────────────────────────────────────────────────

  useEffect(() => {
    const fetchProfile = async () => {
      try {
        setLoading(true);
        // Use standard profile endpoint for me, search endpoint for others
        const isPhone = /^\\d+$/.test(targetUserId || '') || !(targetUserId || '').includes('@');
        const queryParams = !isMe ? (isPhone ? { phone: targetUserId } : { email: targetUserId }) : null;
        const res = isMe 
          ? await apiGet("/users/profile")
          : await chatGet("/friends/search", queryParams);

        if (!res.ok) throw new Error(res.message || t('profile.load_error'));

        const payload = isMe
          ? (res.profile || res.data?.profile || res.data)
          : (res.user || res.data?.user || res.data);
        const apiProfile = normalizeProfile(payload);
        setProfile(apiProfile);
        setDraft(apiProfile);
        const nextFriendship = res.friendship || res.data?.friendship;
        if (!isMe && nextFriendship) {
          setFriendship(nextFriendship);
        }
        
        if (isMe) {
          await persistUser(apiProfile);
        }
      } catch (error) {
        console.error('[ProfileScreen] Load profile error', error);
      } finally {
        setLoading(false);
      }
    };

    fetchProfile();
  }, [targetUserId, isMe]);

  // Sync local profile when context user (e.g. from socket) updates
  useEffect(() => {
    if (isMe && authUser) {
      setProfile((prev: any) => ({ ...prev, ...authUser }));
    }
  }, [authUser, isMe]);

  const tokenLookup = async () => {
    return await AsyncStorage.getItem('token');
  };

  // ── Edit handlers ─────────────────────────────────────────────────────────────

  const handleChange = (field: string, value: any) =>
    setDraft((cur: any) => ({ ...cur, [field]: value }));

  const startEditing  = () => { 
    const dateParts = toDateParts(profile.dataOfBirth);
    setDraft({
      ...profile,
      dayInput: dateParts.day || '',
      monthInput: dateParts.month || '',
      yearInput: dateParts.year || ''
    }); 
    setEditing(true);  
  };
  const cancelEditing = () => { setDraft(profile); setEditing(false); };

  // ── Upload avatar qua S3 (expo-image-picker) ──────────────────────────────────

  const handlePickAvatar = async () => {
    if (!isMe) return;

    try {
      // Lazy-import để không crash nếu thư viện không được cài
      const ImagePicker = await import('expo-image-picker');

      const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!permission.granted) {
        Alert.alert(t('common.permission'), t('profile.permission_denied'));
        return;
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.8,
      });

      if (result.canceled || !result.assets?.length) return;

      const asset = result.assets[0];
      setUploading(true);

      console.log('[ProfileScreen] Asset for upload:', asset);

      const res = await apiUpload('/users/avatar/upload', asset);
      if (!res.ok) throw new Error(res.message || t('profile.avatar_upload_error'));

      const newAvatarUrl = res.profile?.avatarUrl || '';
      const updated = normalizeProfile({ ...profile, avatarUrl: newAvatarUrl });
      setProfile(updated);
      setDraft(updated);
      
      // Update global context
      if (updateUser) await updateUser(updated);
      await persistUser(updated);

      Alert.alert(t('common.success'), t('profile.avatar_updated'));
    } catch (error: any) {
      console.error('[ProfileScreen] Upload avatar error', error);
      Alert.alert(t('common.error'), error.message || t('profile.avatar_upload_error'));
    } finally {
      setUploading(false);
    }
  };

  const handlePickCover = async () => {
    if (!isMe) return;

    try {
      const ImagePicker = await import('expo-image-picker');

      const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!permission.granted) {
        Alert.alert(t('alert.permission_title'), t('alert.permission_desc'));
        return;
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        aspect: [16, 9],
        quality: 0.8,
      });

      if (result.canceled || !result.assets?.length) return;

      const asset = result.assets[0];
      setUploadingCover(true);

      const res = await apiUpload('/users/background/upload', asset);
      if (!res.ok) throw new Error(res.message || t('profile.cover_upload_error'));

      const newBackgroundUrl = res.profile?.backgroundUrl || '';
      const updated = normalizeProfile({ ...profile, backgroundUrl: newBackgroundUrl });
      setProfile(updated);
      setDraft(updated);
      
      if (updateUser) await updateUser(updated);
      await persistUser(updated);

      Alert.alert(t('common.success'), t('profile.cover_updated'));
    } catch (error: any) {
      console.error('[ProfileScreen] Upload cover error', error);
      Alert.alert(t('common.error'), error.message || t('profile.cover_upload_error'));
    } finally {
      setUploadingCover(false);
    }
  };

  // ── Save profile ──────────────────────────────────────────────────────────────
  const handleSave = async () => {
    setSaving(true);
    try {
      const headers = await authHeaders();
      
      // ⚡ CHUẨN HÓA MẠNH MẼ: Đảm bảo có đủ 3 phần và đệm số 0 theo chuẩn DD/MM/YYYY
      const dd = String(draft.dayInput || '').padStart(2, '0');
      const mm = String(draft.monthInput || '').padStart(2, '0');
      const yyyy = String(draft.yearInput || '');

      // Gom lại thành chuỗi DD-MM-YYYY để gửi lên backend
      const nextBirthDate = (dd.length === 2 && mm.length === 2 && yyyy.length === 4 && dd !== '00' && mm !== '00') 
        ? `${dd}-${mm}-${yyyy}` 
        : profile.dataOfBirth;

      const res = await apiPut('/users/profile', {
        fullName:    draft.fullName,
        phone:       draft.phone,
        address:     draft.address,
        bio:         draft.bio,
        dataOfBirth: nextBirthDate,
        gender:      draft.gender,
      });

      if (!res.ok) throw new Error(res.message || t('profile.save_error'));

      const normalizedNext = normalizeProfile({
        ...(res.profile || res.data),
        dataOfBirth: nextBirthDate, // Đảm bảo UI cập nhật đúng ngày vừa lưu
      });
      const finalProfile = { ...draft, ...normalizedNext };

      setProfile(finalProfile);
      setDraft(finalProfile);
      setEditing(false);
      
      // Sync globally via Context (triggers sockets)
      if (updateUser) await updateUser(finalProfile);

      await persistUser(finalProfile);
      Alert.alert(t('common.success'), t('profile.save_success'));
    } catch (error: any) {
      console.error('[ProfileScreen] Save profile error', error);
      Alert.alert(t('common.error'), error.message || t('profile.save_error'));
    } finally {
      setSaving(false);
    }
  };

  // ── Handlers for other users ──────────────────────────────────────────────
  const handleMessage = () => {
    if (onNavigate) {
      onNavigate('Chat', { conversationId: undefined, targetEmail: profile.email });
    }
  };

  const handleCall = () => {
    // Navigate to Chat then start call
    if (onNavigate) {
      onNavigate('Chat', { conversationId: undefined, targetEmail: profile.email, startCall: 'audio' });
    }
  };

  const handleAddFriend = async () => {
    try {
      const res = await chatPost("/friends/request", { targetEmail: profile.email });
      if (res.ok) {
        Alert.alert(t('common.success'), t('profile.friend_request_sent'));
        // Optional: Update UI to show 'Pending'
        setFriendship({ status: 'pending' });
      } else {
        throw new Error(res.message || t('profile.friend_request_error'));
      }
    } catch (error: any) {
      Alert.alert("Lỗi", error.message);
    }
  };

  // ── Derived values ────────────────────────────────────────────────────────────

  const displayName = profile.fullName || t('profile.default_user');
  const avatarUrl = profile.avatarUrl ? `${profile.avatarUrl}?v=${profileVersion}` : '';
  const avatarImageSource = avatarUrl ? { uri: avatarUrl, cache: 'reload' as const } : ASSETS.DEFAULT_AVATAR;
  const parts       = toDateParts(draft.dataOfBirth);
  const dayValue    = draft.dayInput   !== undefined ? draft.dayInput   : parts.day;
  const monthValue  = draft.monthInput !== undefined ? draft.monthInput : parts.month;
  const yearValue   = draft.yearInput  !== undefined ? draft.yearInput  : parts.year;

  // ── Render ────────────────────────────────────────────────────────────────────

  const styles = useMemo(() => getStyles(colors, isDark), [colors, isDark]);

  return (
    <SafeAreaView style={styles.safeArea}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.flex}
      >
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
        >
          {loading ? (
            <View style={styles.loadingBox}>
              <ActivityIndicator size="large" color={colors.primary} />
              <Text style={styles.loadingText}>Đang tải hồ sơ...</Text>
            </View>

          ) : editing ? (
            /* ─── EDIT MODE ─── */
            <View style={styles.sheetWrap}>
              <View style={styles.sheetHeader}>
                <TouchableOpacity style={styles.headerIconButton} onPress={cancelEditing}>
                  <Text style={styles.headerIcon}>arrow_back</Text>
                </TouchableOpacity>
                <Text style={styles.sheetTitle}>{t('profile.update')}</Text>
                <TouchableOpacity
                  style={styles.headerIconButton}
                  onPress={cancelEditing}
                >
                  <Text style={styles.headerIcon}>close</Text>
                </TouchableOpacity>
              </View>

              <View style={styles.editBody}>
                <Text style={styles.fieldLabel}>{t('profile.display_name')}</Text>
                <TextInput
                  style={styles.editInput}
                  value={draft.fullName}
                  onChangeText={(v) => handleChange('fullName', v)}
                  placeholder={t('profile.display_name')}
                  placeholderTextColor={colors.outline}
                />

                <Text style={styles.sectionHeading}>{t('profile.personal_info')}</Text>

                {/* Giới tính */}
                <View style={styles.genderRowEdit}>
                  <TouchableOpacity
                    style={styles.radioOption}
                    onPress={() => handleChange('gender', true)}
                  >
                    <View style={[styles.radioOuter, draft.gender && styles.radioOuterActive]}>
                      {draft.gender && <View style={styles.radioInner} />}
                    </View>
                    <Text style={styles.radioText}>{t('profile.male')}</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={styles.radioOption}
                    onPress={() => handleChange('gender', false)}
                  >
                    <View style={[styles.radioOuter, !draft.gender && styles.radioOuterActive]}>
                      {!draft.gender && <View style={styles.radioInner} />}
                    </View>
                    <Text style={styles.radioText}>{t('profile.female')}</Text>
                  </TouchableOpacity>
                </View>

                {/* Ngày sinh — DD / MM / YYYY */}
                <Text style={styles.fieldLabel}>{t('profile.birthdate')} (DD / MM / YYYY)</Text>
                <View style={styles.birthRow}>
                  <TextInput
                    style={styles.birthInput}
                    value={dayValue}
                    onChangeText={(v) =>
                      handleChange('dayInput', v.replace(/[^0-9]/g, '').slice(0, 2))
                    }
                    placeholder="24"
                    placeholderTextColor={colors.outline}
                    keyboardType="number-pad"
                  />
                  <TextInput
                    style={styles.birthInput}
                    value={monthValue}
                    onChangeText={(v) =>
                      handleChange('monthInput', v.replace(/[^0-9]/g, '').slice(0, 2))
                    }
                    placeholder="06"
                    placeholderTextColor={colors.outline}
                    keyboardType="number-pad"
                  />
                  <TextInput
                    style={styles.birthInput}
                    value={yearValue}
                    onChangeText={(v) =>
                      handleChange('yearInput', v.replace(/[^0-9]/g, '').slice(0, 4))
                    }
                    placeholder="2004"
                    placeholderTextColor={colors.outline}
                    keyboardType="number-pad"
                  />
                </View>

                {/* Số điện thoại */}
                <Text style={styles.fieldLabel}>{t('profile.phone')}</Text>
                <TextInput
                  style={styles.editInput}
                  value={draft.phone}
                  onChangeText={(v) => handleChange('phone', v)}
                  placeholder={t('profile.phone')}
                  placeholderTextColor={colors.outline}
                  keyboardType="phone-pad"
                />

                {/* Địa chỉ */}
                <Text style={styles.fieldLabel}>{t('profile.address')}</Text>
                <TextInput
                  style={styles.editInput}
                  value={draft.address}
                  onChangeText={(v) => handleChange('address', v)}
                  placeholder={t('profile.address')}
                  placeholderTextColor={colors.outline}
                />

                {/* Bio */}
                <Text style={styles.fieldLabel}>{t('profile.bio')}</Text>
                <TextInput
                  style={[styles.editInput, styles.bioInput]}
                  value={draft.bio}
                  onChangeText={(v) => handleChange('bio', v)}
                  placeholder={t('profile.bio_placeholder')}
                  placeholderTextColor={colors.outline}
                  multiline
                  numberOfLines={3}
                />
              </View>

              <View style={styles.bottomActions}>
                <TouchableOpacity style={styles.cancelButton} onPress={cancelEditing}>
                  <Text style={styles.cancelText}>{t('common.cancel')}</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.updateButton, saving && styles.updateButtonDisabled]}
                  onPress={handleSave}
                  disabled={saving}
                >
                  <Text style={styles.updateText}>{saving ? t('profile.saving') : t('profile.update')}</Text>
                </TouchableOpacity>
              </View>
            </View>

          ) : (
            /* ─── VIEW MODE ─── */
            <View style={styles.sheetWrap}>
              <View style={styles.sheetHeader}>
                <TouchableOpacity
                  style={styles.headerIconButton}
                  onPress={() => goBack ? goBack() : onNavigate('Main', {}, 'profile')}
                >
                  <Text style={styles.headerIcon}>arrow_back</Text>
                </TouchableOpacity>
                <Text style={styles.sheetTitle}>{t('profile.info')}</Text>
                <TouchableOpacity
                  style={styles.headerIconButton}
                  onPress={() => goBack ? goBack() : onNavigate('Main', {}, 'profile')}
                >
                  <Text style={styles.headerIcon}>close</Text>
                </TouchableOpacity>
              </View>

              {/* Cover */}
              <View style={{ position: 'relative' }}>
                <Image 
                  source={{ uri: profile.backgroundUrl || COVER_URL }} 
                  style={styles.coverImage} 
                />
                {isMe && (
                  <TouchableOpacity
                    style={styles.coverCameraButton}
                    onPress={handlePickCover}
                    disabled={uploadingCover}
                  >
                    {uploadingCover ? (
                      <ActivityIndicator size="small" color="#1e2f4d" />
                    ) : (
                      <Text style={styles.cameraIcon}>photo_camera</Text>
                    )}
                  </TouchableOpacity>
                )}
              </View>

              {/* Avatar + tên */}
              <View style={styles.profileBlock}>
                <View style={styles.avatarWrapperLarge}>
                  <Image
                    key={`avatar-${profileVersion}-${profile.avatarUrl || 'default'}`}
                    source={avatarImageSource}
                    style={styles.avatarLarge}
                  />

                  {/* Nút camera — mở picker để upload qua S3 */}
                  {isMe && (
                    <TouchableOpacity
                      style={styles.cameraButton}
                      onPress={handlePickAvatar}
                      disabled={uploading}
                    >
                      {uploading ? (
                        <ActivityIndicator size="small" color={colors.primary} />
                      ) : (
                        <Text style={styles.cameraIcon}>photo_camera</Text>
                      )}
                    </TouchableOpacity>
                  )}
                </View>

                <View style={styles.nameRow}>
                  <Text style={styles.nameTitle}>{displayName}</Text>
                  {isMe && (
                    <TouchableOpacity onPress={startEditing}>
                      <Text style={styles.editIcon}>edit</Text>
                    </TouchableOpacity>
                  )}
                </View>

                {!isMe && (
                  <View style={styles.actionRow}>
                    <TouchableOpacity style={styles.actionBtnPrimary} onPress={handleMessage}>
                      <Text style={styles.actionBtnIcon}>chat</Text>
                      <Text style={styles.actionBtnText}>{t('profile.message')}</Text>
                    </TouchableOpacity>
                    {friendship?.status === 'accepted' ? (
                      <TouchableOpacity style={styles.actionBtnSecondary} onPress={handleCall}>
                        <Text style={[styles.actionBtnIcon, styles.actionBtnSecondaryIcon]}>call</Text>
                        <Text style={[styles.actionBtnText, styles.actionBtnSecondaryText]}>{t('profile.call')}</Text>
                      </TouchableOpacity>
                    ) : (
                      <TouchableOpacity 
                        style={[styles.actionBtnSecondary, friendship?.status === 'pending' && { opacity: 0.7 }]} 
                        onPress={friendship?.status === 'pending' ? undefined : handleAddFriend}
                      >
                        <Text style={[styles.actionBtnIcon, styles.actionBtnSecondaryIcon]}>
                          {friendship?.status === 'pending' ? 'hourglass_top' : 'person_add'}
                        </Text>
                        <Text style={[styles.actionBtnText, styles.actionBtnSecondaryText]}>
                          {friendship?.status === 'pending' ? t('profile.request_sent') : t('profile.add_friend')}
                        </Text>
                      </TouchableOpacity>
                    )}
                  </View>
                )}
              </View>

              {/* Thông tin cá nhân */}
              <View style={styles.infoSection}>
                <Text style={styles.infoTitle}>{t('profile.info')}</Text>

                <View style={styles.infoRow}>
                  <Text style={styles.infoLabel}>{t('profile.gender')}</Text>
                  <Text style={styles.infoValue}>{profile.gender ? t('profile.male') : t('profile.female')}</Text>
                </View>
                <View style={styles.infoRow}>
                  <Text style={styles.infoLabel}>{t('profile.birthdate')}</Text>
                  <Text style={styles.infoValue}>{formatDisplayDate(profile.dataOfBirth)}</Text>
                </View>
                <View style={styles.infoRow}>
                  <Text style={styles.infoLabel}>{t('profile.phone')}</Text>
                  <Text style={styles.infoValue}>{profile.phone || t('profile.not_updated')}</Text>
                </View>
                {!!profile.address && (
                  <View style={styles.infoRow}>
                    <Text style={styles.infoLabel}>{t('profile.address')}</Text>
                    <Text style={styles.infoValue}>{profile.address}</Text>
                  </View>
                )}
                {!!profile.bio && (
                  <View style={styles.infoRow}>
                    <Text style={styles.infoLabel}>{t('profile.bio')}</Text>
                    <Text style={styles.infoValue}>{profile.bio}</Text>
                  </View>
                )}

                <Text style={styles.privacyNote}>
                  Chỉ bạn bè có lưu số của bạn trong danh bạ máy xem được số này
                </Text>

                {isMe && (
                  <TouchableOpacity style={styles.updateInlineButton} onPress={startEditing}>
                    <Text style={styles.updateInlineIcon}>edit</Text>
                    <Text style={styles.updateInlineText}>{t('profile.update')}</Text>
                  </TouchableOpacity>
                )}
              </View>

              {/* Quick actions - only show for Me */}
              {isMe && (
                <View style={styles.quickActions}>
                  <TouchableOpacity
                    style={styles.quickActionButton}
                    onPress={() => onNavigate && onNavigate('Settings')}
                  >
                    <Text style={styles.quickActionIcon}>settings</Text>
                    <Text style={styles.quickActionText}>{t('nav.settings')}</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={styles.quickActionButton}
                    onPress={() => onNavigate && onNavigate('Sessions')}
                  >
                    <Text style={styles.quickActionIcon}>devices</Text>
                    <Text style={styles.quickActionText}>{t('profile.devices')}</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={styles.quickActionButton} onPress={onLogout}>
                    <Text style={styles.quickActionIcon}>logout</Text>
                    <Text style={styles.quickActionText}>{t('profile.logout')}</Text>
                  </TouchableOpacity>
                </View>
              )}
            </View>
          )}
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const getStyles = (colors: any, isDark: boolean) => StyleSheet.create({
  safeArea:    { flex: 1, backgroundColor: colors.background },
  flex:        { flex: 1 },
  scrollContent: { padding: 6, paddingBottom: 18 },

  loadingBox: {
    minHeight: 500,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
  },
  loadingText: { ...Typography.body, fontSize: 15, color: colors.onSurfaceVariant },

  sheetWrap: {
    borderRadius: 6,
    overflow: 'hidden',
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.outlineVariant,
    ...Shadows.soft,
  },
  sheetHeader: {
    minHeight: 58,
    paddingHorizontal: 12,
    flexDirection: 'row',
    alignItems: 'center',
    borderBottomWidth: 1,
    borderBottomColor: colors.outlineVariant,
    backgroundColor: colors.surface,
  },
  sheetTitle: {
    ...Typography.heading,
    color: colors.onSurface,
    fontSize: 18,
    flex: 1,
    marginLeft: 6,
  },
  headerIconButton: { width: 36, height: 36, alignItems: 'center', justifyContent: 'center' },
  headerIcon: { fontFamily: 'Material Symbols Outlined', fontSize: 26, color: colors.onSurface },

  coverImage:   { width: '100%', height: 210, backgroundColor: colors.outlineVariant },
  coverCameraButton: {
    position: 'absolute',
    right: 12,
    bottom: 12,
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: 'rgba(255,255,255,0.85)',
    borderWidth: 1,
    borderColor: colors.outline,
    alignItems: 'center',
    justifyContent: 'center',
  },
  profileBlock: {
    paddingHorizontal: 16,
    paddingTop: 10,
    paddingBottom: 16,
    borderBottomWidth: 8,
    borderBottomColor: colors.surfaceVariant,
  },
  avatarWrapperLarge: {
    marginTop: -54,
    width: 104,
    height: 104,
    borderRadius: 52,
    borderWidth: 3,
    borderColor: colors.surface,
    backgroundColor: colors.surface,
  },
  avatarLarge:         { width: '100%', height: '100%', borderRadius: 52 },
  avatarFallbackLarge: {
    width: '100%',
    height: '100%',
    borderRadius: 52,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarInitial: { fontSize: 38, color: colors.surface, fontWeight: '800' },
  cameraButton: {
    position: 'absolute',
    right: -4,
    bottom: -4,
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: colors.surfaceVariant,
    borderWidth: 1,
    borderColor: colors.outline,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cameraIcon: { fontFamily: 'Material Symbols Outlined', fontSize: 19, color: colors.onSurface },
  nameRow:    { marginTop: 12, flexDirection: 'row', alignItems: 'center', gap: 8 },
  nameTitle:  { ...Typography.heading, color: colors.onSurface, fontSize: 19, flex: 1 },
  editIcon:   { fontFamily: 'Material Symbols Outlined', fontSize: 23, color: colors.onSurface },

  infoSection: { padding: 16 },
  infoTitle:   { ...Typography.heading, color: colors.onSurface, fontSize: 17, marginBottom: 16 },
  infoRow:     { flexDirection: 'row', alignItems: 'flex-start', marginBottom: 12 },
  infoLabel:   { ...Typography.body, color: colors.onSurfaceVariant, fontSize: 15, width: 100 },
  infoValue:   { ...Typography.body, color: colors.onSurface, fontSize: 15, flex: 1 },
  privacyNote: {
    ...Typography.body,
    color: colors.onSurfaceVariant,
    fontSize: 13,
    lineHeight: 20,
    marginTop: 6,
    marginBottom: 14,
  },
  updateInlineButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    borderTopWidth: 1,
    borderTopColor: colors.outlineVariant,
    paddingTop: 14,
  },
  updateInlineIcon: { fontFamily: 'Material Symbols Outlined', fontSize: 22, color: colors.onSurface },
  updateInlineText: { ...Typography.heading, fontSize: 17, color: colors.onSurface },

  quickActions: { paddingHorizontal: 16, paddingBottom: 24, flexDirection: 'column', gap: 10 },
  quickActionButton: {
    width: '100%',
    borderRadius: 12,
    backgroundColor: colors.surfaceVariant,
    paddingVertical: 14,
    paddingHorizontal: 16,
    alignItems: 'center',
    justifyContent: 'flex-start',
    flexDirection: 'row',
    gap: 14,
  },
  quickActionIcon: { fontFamily: 'Material Symbols Outlined', fontSize: 24, color: colors.onSurface },
  quickActionText: { ...Typography.heading, fontSize: 16, color: colors.onSurface, flex: 1 },

  // Edit form
  editBody:     { padding: 16, backgroundColor: colors.surface },
  fieldLabel:   { ...Typography.body, fontSize: 15, color: colors.onSurface, marginBottom: 8 },
  editInput: {
    borderWidth: 1,
    borderColor: colors.outlineVariant,
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
    marginBottom: 14,
    ...Typography.body,
    fontSize: 15,
    color: colors.onSurface,
    backgroundColor: colors.surface,
  },
  bioInput:     { minHeight: 80, textAlignVertical: 'top' },
  sectionHeading: {
    ...Typography.heading,
    color: colors.onSurface,
    fontSize: 17,
    marginTop: 8,
    marginBottom: 10,
  },
  genderRowEdit: { flexDirection: 'row', alignItems: 'center', gap: 24, marginBottom: 14 },
  radioOption:   { flexDirection: 'row', alignItems: 'center', gap: 10 },
  radioOuter: {
    width: 26, height: 26, borderRadius: 13,
    borderWidth: 2, borderColor: colors.outline,
    alignItems: 'center', justifyContent: 'center',
  },
  radioOuterActive: { borderColor: colors.primary },
  radioInner:       { width: 12, height: 12, borderRadius: 6, backgroundColor: colors.primary },
  radioText:        { ...Typography.body, fontSize: 15, color: colors.onSurface },
  birthRow:         { flexDirection: 'row', gap: 10, marginBottom: 14 },
  birthInput: {
    flex: 1,
    borderWidth: 1, borderColor: colors.outlineVariant, borderRadius: 10,
    paddingHorizontal: 12, paddingVertical: 12,
    ...Typography.body, fontSize: 15, color: colors.onSurface,
    backgroundColor: colors.surface, textAlign: 'center',
  },
  bottomActions: {
    flexDirection: 'row', justifyContent: 'flex-end', gap: 10,
    borderTopWidth: 1, borderTopColor: colors.outlineVariant,
    backgroundColor: colors.surfaceVariant, padding: 12,
  },
  cancelButton:        { paddingHorizontal: 22, paddingVertical: 11, borderRadius: 8, backgroundColor: colors.surfaceVariant },
  cancelText:          { ...Typography.heading, fontSize: 16, color: colors.onSurface },
  updateButton:        { paddingHorizontal: 22, paddingVertical: 11, borderRadius: 8, backgroundColor: colors.primary },
  updateButtonDisabled: { opacity: 0.7 },
  updateText:          { ...Typography.heading, fontSize: 16, color: colors.surface },

  actionRow: {
    flexDirection: 'row',
    marginTop: 16,
    gap: 12,
  },
  actionBtnPrimary: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.primary,
    paddingVertical: 10,
    borderRadius: 24,
    gap: 8,
  },
  actionBtnSecondary: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.surfaceVariant,
    paddingVertical: 10,
    borderRadius: 24,
    gap: 8,
  },
  actionBtnIcon: {
    fontFamily: 'Material Symbols Outlined',
    fontSize: 20,
    color: colors.surface,
  },
  actionBtnText: {
    ...Typography.heading,
    fontSize: 15,
    color: colors.surface,
  },
  actionBtnSecondaryIcon: {
    fontFamily: 'Material Symbols Outlined',
    fontSize: 20,
    color: colors.onSurface,
  },
  actionBtnSecondaryText: {
    ...Typography.heading,
    fontSize: 15,
    color: colors.onSurface,
  },
});
