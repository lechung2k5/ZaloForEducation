import AsyncStorage from '@react-native-async-storage/async-storage';
import * as ImagePicker from 'expo-image-picker';
import React, { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Image,
  KeyboardAvoidingView,
  Platform,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { Colors, Shadows, Typography } from '../constants/Theme';
import Alert from '../utils/Alert';
import { getApiBaseUrl } from '../utils/api';

const API_URL = getApiBaseUrl();
const COVER_URL = 'https://images.unsplash.com/photo-1507525428034-b723cf961d3e?auto=format&fit=crop&w=1200&q=80';

const EMPTY_PROFILE = {
  fullName: '',
  email: '',
  phone: '',
  address: '',
  bio: '',
  dataOfBirth: '',
  gender: true,
  avatarUrl: '',
  urlAvatar: '',
  backgroundUrl: '',
  urlBackground: '',
};

export default function ProfileScreen({ onNavigate, onLogout }) {
  const [profile, setProfile] = useState(EMPTY_PROFILE);
  const [draft, setDraft] = useState(EMPTY_PROFILE);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [mediaUploading, setMediaUploading] = useState(false);
  const [editing, setEditing] = useState(false);

  const storage = useMemo(() => AsyncStorage.default || AsyncStorage, []);

  const authHeaders = async () => {
    const token = await storage.getItem('token');
    return token
      ? {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        }
      : { 'Content-Type': 'application/json' };
  };

  const getAuthToken = async () => storage.getItem('token');

  const normalizeProfile = (source = {}) => {
    const fullName = source.fullName || source.fullname || '';
    const avatarUrl = source.avatarUrl || source.urlAvatar || '';
    const backgroundUrl = source.backgroundUrl || source.urlBackground || '';

    return {
      ...EMPTY_PROFILE,
      ...source,
      fullName,
      fullname: fullName,
      avatarUrl,
      urlAvatar: avatarUrl,
      backgroundUrl,
      urlBackground: backgroundUrl,
      gender: typeof source.gender === 'boolean' ? source.gender : true,
    };
  };

  const persistUser = async (nextProfile) => {
    const savedUser = await storage.getItem('user');
    const currentUser = savedUser ? JSON.parse(savedUser) : {};
    const mergedUser = {
      ...currentUser,
      ...nextProfile,
      fullName: nextProfile.fullName || nextProfile.fullname || currentUser.fullName || currentUser.fullname || '',
      fullname: nextProfile.fullName || nextProfile.fullname || currentUser.fullName || currentUser.fullname || '',
      avatarUrl: nextProfile.avatarUrl || nextProfile.urlAvatar || currentUser.avatarUrl || currentUser.urlAvatar || '',
      urlAvatar: nextProfile.avatarUrl || nextProfile.urlAvatar || currentUser.avatarUrl || currentUser.urlAvatar || '',
      backgroundUrl: nextProfile.backgroundUrl || nextProfile.urlBackground || currentUser.backgroundUrl || currentUser.urlBackground || '',
      urlBackground: nextProfile.backgroundUrl || nextProfile.urlBackground || currentUser.backgroundUrl || currentUser.urlBackground || '',
    };

    await storage.setItem('user', JSON.stringify(mergedUser));
  };

  const toDateParts = (value) => {
    if (!value || typeof value !== 'string') {
      return { day: '', month: '', year: '' };
    }

    const parts = value.split('-');
    if (parts.length === 3) {
      return { year: parts[0], month: parts[1], day: parts[2] };
    }

    return { day: '', month: '', year: '' };
  };

  const pad2 = (value) => `${value}`.padStart(2, '0');

  const buildIsoDate = (day, month, year) => {
    if (!day || !month || !year) {
      return '';
    }
    return `${year}-${pad2(month)}-${pad2(day)}`;
  };

  const formatBirthDate = (value) => {
    const { day, month, year } = toDateParts(value);
    if (!day || !month || !year) {
      return 'Chưa cập nhật';
    }
    return `${Number(day)} tháng ${pad2(month)}, ${year}`;
  };

  useEffect(() => {
    const fetchProfile = async () => {
      try {
        const savedUser = await storage.getItem('user');
        if (savedUser) {
          const localProfile = normalizeProfile(JSON.parse(savedUser));
          setProfile(localProfile);
          setDraft(localProfile);
        }

        const response = await fetch(`${API_URL}/users/profile`, {
          headers: await authHeaders(),
        });

        const data = await response.json();
        if (!response.ok) {
          throw new Error(data.message || 'Không thể tải hồ sơ.');
        }

        const apiProfile = normalizeProfile(data.profile || data);
        setProfile(apiProfile);
        setDraft(apiProfile);
        await persistUser(apiProfile);
      } catch (error) {
        console.error('Load profile error', error);
      } finally {
        setLoading(false);
      }
    };

    fetchProfile();
  }, []);

  const handleChange = (field, value) => {
    setDraft((current) => ({ ...current, [field]: value }));
  };

  const startEditing = () => {
    setDraft(profile);
    setEditing(true);
  };

  const cancelEditing = () => {
    setDraft(profile);
    setEditing(false);
  };

  const appendImageToFormData = async (formData, asset, target) => {
    const fallbackName = `${target}-${Date.now()}.jpg`;
    const fileName = asset.fileName || fallbackName;
    const mimeType = asset.mimeType || 'image/jpeg';

    if (Platform.OS === 'web') {
      if (asset.file) {
        formData.append('file', asset.file, asset.file.name || fileName);
        return;
      }

      if (asset.uri) {
        const blobResponse = await fetch(asset.uri);
        const blob = await blobResponse.blob();
        formData.append('file', blob, fileName);
        return;
      }

      throw new Error('Không đọc được file ảnh trên trình duyệt.');
    }

    formData.append('file', {
      uri: asset.uri,
      name: fileName,
      type: mimeType,
    });
  };

  const pickAndUploadImage = async (target) => {
    try {
      const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!permission.granted) {
        Alert.alert('Lỗi', 'Vui lòng cấp quyền truy cập thư viện ảnh.');
        return;
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        quality: 0.8,
      });

      if (result.canceled || !result.assets?.length) {
        return;
      }

      const asset = result.assets[0];
      const token = await getAuthToken();
      if (!token) {
        Alert.alert('Lỗi', 'Bạn chưa đăng nhập.');
        return;
      }

      setMediaUploading(true);

      const formData = new FormData();
      await appendImageToFormData(formData, asset, target);

      const endpoint = target === 'avatar' ? 'avatar/upload' : 'background/upload';
      const response = await fetch(`${API_URL}/users/${endpoint}`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
        },
        body: formData,
      });

      const payload = await response.json();
      if (!response.ok) {
        throw new Error(payload.message || 'Không thể tải ảnh lên.');
      }

      if (target === 'avatar') {
        const nextAvatar = payload.profile?.avatarUrl || payload.avatarUrl || payload.profile?.urlAvatar || '';
        if (nextAvatar) {
          setDraft((current) => ({ ...current, avatarUrl: nextAvatar, urlAvatar: nextAvatar }));
        }
      } else {
        const nextBackground = payload.profile?.backgroundUrl || payload.backgroundUrl || payload.profile?.urlBackground || '';
        if (nextBackground) {
          setDraft((current) => ({ ...current, backgroundUrl: nextBackground, urlBackground: nextBackground }));
        }
      }

      Alert.alert('Thành công', target === 'avatar' ? 'Đã cập nhật ảnh đại diện.' : 'Đã cập nhật ảnh nền.');
    } catch (error) {
      console.error('Upload image error', error);
      Alert.alert('Lỗi', error.message || 'Không thể tải ảnh lên.');
    } finally {
      setMediaUploading(false);
    }
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const headers = await authHeaders();
      const nextBirthDate = buildIsoDate(draft.dayInput, draft.monthInput, draft.yearInput) || draft.dataOfBirth;

      const profileResponse = await fetch(`${API_URL}/users/profile`, {
        method: 'PUT',
        headers,
        body: JSON.stringify({
          fullName: draft.fullName,
          phone: draft.phone,
          address: draft.address,
          bio: draft.bio,
          dataOfBirth: nextBirthDate,
          gender: draft.gender,
        }),
      });

      const profileData = await profileResponse.json();
      if (!profileResponse.ok) {
        throw new Error(profileData.message || 'Không thể lưu hồ sơ.');
      }

      const normalizedNext = normalizeProfile({ ...(profileData.profile || profileData), dataOfBirth: nextBirthDate });
      let finalProfile = {
        ...draft,
        ...normalizedNext,
      };

      const currentAvatar = profile.avatarUrl || profile.urlAvatar || '';
      const nextAvatar = (draft.avatarUrl || '').trim();
      const currentBackground = profile.backgroundUrl || profile.urlBackground || '';
      const nextBackground = (draft.backgroundUrl || '').trim();

      if (nextAvatar && nextAvatar !== currentAvatar) {
        const avatarResponse = await fetch(`${API_URL}/users/avatar`, {
          method: 'PUT',
          headers,
          body: JSON.stringify({ imageUrl: nextAvatar }),
        });

        const avatarData = await avatarResponse.json();
        if (!avatarResponse.ok) {
          throw new Error(avatarData.message || 'Không thể cập nhật ảnh đại diện.');
        }

        finalProfile = normalizeProfile({
          ...finalProfile,
          avatarUrl: avatarData.profile?.avatarUrl || avatarData.avatarUrl || nextAvatar,
          urlAvatar: avatarData.profile?.urlAvatar || avatarData.urlAvatar || nextAvatar,
        });
      }

      if (nextBackground && nextBackground !== currentBackground) {
        const backgroundResponse = await fetch(`${API_URL}/users/background`, {
          method: 'PUT',
          headers,
          body: JSON.stringify({ imageUrl: nextBackground }),
        });

        const backgroundData = await backgroundResponse.json();
        if (!backgroundResponse.ok) {
          throw new Error(backgroundData.message || 'Không thể cập nhật ảnh nền.');
        }

        finalProfile = normalizeProfile({
          ...finalProfile,
          backgroundUrl: backgroundData.profile?.backgroundUrl || backgroundData.backgroundUrl || nextBackground,
          urlBackground: backgroundData.profile?.urlBackground || backgroundData.urlBackground || nextBackground,
        });
      }

      setProfile(finalProfile);
      setDraft(finalProfile);
      setEditing(false);
      await persistUser(finalProfile);
      Alert.alert('Thành công', 'Hồ sơ đã được cập nhật.');
    } catch (error) {
      console.error('Save profile error', error);
      Alert.alert('Lỗi', error.message || 'Không thể lưu hồ sơ.');
    } finally {
      setSaving(false);
    }
  };

  const displayName = profile.fullName || profile.fullname || 'Người dùng';
  const avatarUrl = profile.avatarUrl || profile.urlAvatar || '';
  const backgroundUrl = profile.backgroundUrl || profile.urlBackground || '';

  const parts = toDateParts(draft.dataOfBirth);
  const dayValue = draft.dayInput !== undefined ? draft.dayInput : parts.day;
  const monthValue = draft.monthInput !== undefined ? draft.monthInput : parts.month;
  const yearValue = draft.yearInput !== undefined ? draft.yearInput : parts.year;

  return (
    <SafeAreaView style={styles.safeArea}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={styles.flex}>
        <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
          {loading ? (
            <View style={styles.loadingBox}>
              <ActivityIndicator size="large" color={Colors.primary} />
              <Text style={styles.loadingText}>Đang tải hồ sơ...</Text>
            </View>
          ) : editing ? (
            <View style={styles.sheetWrap}>
              <View style={styles.sheetHeader}>
                <TouchableOpacity style={styles.headerIconButton} onPress={cancelEditing}>
                  <Text style={styles.headerIcon}>arrow_back</Text>
                </TouchableOpacity>
                <Text style={styles.sheetTitle}>Cập nhật thông tin cá nhân</Text>
                <TouchableOpacity style={styles.headerIconButton} onPress={() => onNavigate && onNavigate('home')}>
                  <Text style={styles.headerIcon}>close</Text>
                </TouchableOpacity>
              </View>

              <View style={styles.editBody}>
                <Text style={styles.fieldLabel}>Tên hiển thị</Text>
                <TextInput
                  style={styles.editInput}
                  value={draft.fullName}
                  onChangeText={(value) => handleChange('fullName', value)}
                  placeholder="Nhập tên hiển thị"
                  placeholderTextColor={Colors.outline}
                />

                <Text style={styles.sectionHeading}>Thông tin cá nhân</Text>

                <View style={styles.genderRowEdit}>
                  <TouchableOpacity style={styles.radioOption} onPress={() => handleChange('gender', true)}>
                    <View style={[styles.radioOuter, draft.gender && styles.radioOuterActive]}>
                      {draft.gender && <View style={styles.radioInner} />}
                    </View>
                    <Text style={styles.radioText}>Nam</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={styles.radioOption} onPress={() => handleChange('gender', false)}>
                    <View style={[styles.radioOuter, !draft.gender && styles.radioOuterActive]}>
                      {!draft.gender && <View style={styles.radioInner} />}
                    </View>
                    <Text style={styles.radioText}>Nữ</Text>
                  </TouchableOpacity>
                </View>

                <Text style={styles.fieldLabel}>Ngày sinh</Text>
                <View style={styles.birthRow}>
                  <TextInput
                    style={styles.birthInput}
                    value={dayValue}
                    onChangeText={(value) => handleChange('dayInput', value.replace(/[^0-9]/g, '').slice(0, 2))}
                    placeholder="24"
                    placeholderTextColor={Colors.outline}
                    keyboardType="number-pad"
                  />
                  <TextInput
                    style={styles.birthInput}
                    value={monthValue}
                    onChangeText={(value) => handleChange('monthInput', value.replace(/[^0-9]/g, '').slice(0, 2))}
                    placeholder="06"
                    placeholderTextColor={Colors.outline}
                    keyboardType="number-pad"
                  />
                  <TextInput
                    style={styles.birthInput}
                    value={yearValue}
                    onChangeText={(value) => handleChange('yearInput', value.replace(/[^0-9]/g, '').slice(0, 4))}
                    placeholder="2004"
                    placeholderTextColor={Colors.outline}
                    keyboardType="number-pad"
                  />
                </View>

                <Text style={styles.fieldLabel}>Số điện thoại</Text>
                <TextInput
                  style={styles.editInput}
                  value={draft.phone}
                  onChangeText={(value) => handleChange('phone', value)}
                  placeholder="Nhập số điện thoại"
                  placeholderTextColor={Colors.outline}
                  keyboardType="phone-pad"
                />

                <Text style={styles.fieldLabel}>Ảnh đại diện</Text>
                <View style={styles.mediaActionsRow}>
                  <TouchableOpacity
                    style={[styles.mediaActionButton, mediaUploading && styles.mediaActionButtonDisabled]}
                    onPress={() => pickAndUploadImage('avatar')}
                    disabled={mediaUploading}
                  >
                    <Text style={styles.mediaActionIcon}>photo_library</Text>
                    <Text style={styles.mediaActionText}>{mediaUploading ? 'Đang tải...' : 'Chọn ảnh đại diện'}</Text>
                  </TouchableOpacity>
                </View>

                <Text style={styles.fieldLabel}>Ảnh nền</Text>
                <View style={styles.mediaActionsRow}>
                  <TouchableOpacity
                    style={[styles.mediaActionButton, mediaUploading && styles.mediaActionButtonDisabled]}
                    onPress={() => pickAndUploadImage('background')}
                    disabled={mediaUploading}
                  >
                    <Text style={styles.mediaActionIcon}>image</Text>
                    <Text style={styles.mediaActionText}>{mediaUploading ? 'Đang tải...' : 'Chọn ảnh nền'}</Text>
                  </TouchableOpacity>
                </View>
              </View>

              <View style={styles.bottomActions}>
                <TouchableOpacity style={styles.cancelButton} onPress={cancelEditing}>
                  <Text style={styles.cancelText}>Hủy</Text>
                </TouchableOpacity>
                <TouchableOpacity style={[styles.updateButton, (saving || mediaUploading) && styles.updateButtonDisabled]} onPress={handleSave} disabled={saving || mediaUploading}>
                  <Text style={styles.updateText}>{saving ? 'Đang lưu' : 'Cập nhật'}</Text>
                </TouchableOpacity>
              </View>
            </View>
          ) : (
            <View style={styles.sheetWrap}>
              <View style={styles.sheetHeader}>
                <Text style={styles.sheetTitle}>Thông tin tài khoản</Text>
                <TouchableOpacity style={styles.headerIconButton} onPress={() => onNavigate && onNavigate('home')}>
                  <Text style={styles.headerIcon}>close</Text>
                </TouchableOpacity>
              </View>

              <Image source={{ uri: backgroundUrl || COVER_URL }} style={styles.coverImage} />

              <View style={styles.profileBlock}>
                <View style={styles.avatarWrapperLarge}>
                  {avatarUrl ? (
                    <Image source={{ uri: avatarUrl }} style={styles.avatarLarge} />
                  ) : (
                    <View style={styles.avatarFallbackLarge}>
                      <Text style={styles.avatarInitial}>{displayName ? displayName[0].toUpperCase() : 'U'}</Text>
                    </View>
                  )}
                  <TouchableOpacity style={styles.cameraButton} onPress={startEditing}>
                    <Text style={styles.cameraIcon}>photo_camera</Text>
                  </TouchableOpacity>
                </View>
                <View style={styles.nameRow}>
                  <Text style={styles.nameTitle}>{displayName}</Text>
                  <TouchableOpacity onPress={startEditing}>
                    <Text style={styles.editIcon}>edit</Text>
                  </TouchableOpacity>
                </View>
              </View>

              <View style={styles.infoSection}>
                <Text style={styles.infoTitle}>Thông tin cá nhân</Text>

                <View style={styles.infoRow}>
                  <Text style={styles.infoLabel}>Giới tính</Text>
                  <Text style={styles.infoValue}>{profile.gender ? 'Nam' : 'Nữ'}</Text>
                </View>
                <View style={styles.infoRow}>
                  <Text style={styles.infoLabel}>Ngày sinh</Text>
                  <Text style={styles.infoValue}>{formatBirthDate(profile.dataOfBirth)}</Text>
                </View>
                <View style={styles.infoRow}>
                  <Text style={styles.infoLabel}>Điện thoại</Text>
                  <Text style={styles.infoValue}>{profile.phone || 'Chưa cập nhật'}</Text>
                </View>

                <Text style={styles.privacyNote}>Chỉ bạn bè có lưu số của bạn trong danh bạ máy xem được số này</Text>

                <TouchableOpacity style={styles.updateInlineButton} onPress={startEditing}>
                  <Text style={styles.updateInlineIcon}>edit</Text>
                  <Text style={styles.updateInlineText}>Cập nhật</Text>
                </TouchableOpacity>
              </View>

              <View style={styles.quickActions}>
                <TouchableOpacity style={styles.quickActionButton} onPress={() => onNavigate && onNavigate('sessions')}>
                  <Text style={styles.quickActionIcon}>devices</Text>
                  <Text style={styles.quickActionText}>Thiết bị</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.quickActionButton} onPress={onLogout}>
                  <Text style={styles.quickActionIcon}>logout</Text>
                  <Text style={styles.quickActionText}>Đăng xuất</Text>
                </TouchableOpacity>
              </View>
            </View>
          )}
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: '#e7eaef' },
  flex: { flex: 1 },
  scrollContent: { padding: 6, paddingBottom: 18 },

  loadingBox: {
    minHeight: 500,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
  },
  loadingText: {
    ...Typography.body,
    fontSize: 15,
    color: Colors.onSurfaceVariant,
  },

  sheetWrap: {
    borderRadius: 6,
    overflow: 'hidden',
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#d7dbe3',
    ...Shadows.soft,
  },
  sheetHeader: {
    minHeight: 58,
    paddingHorizontal: 12,
    flexDirection: 'row',
    alignItems: 'center',
    borderBottomWidth: 1,
    borderBottomColor: '#d9dde4',
    backgroundColor: '#fff',
  },
  sheetTitle: {
    ...Typography.heading,
    color: '#1e2f4d',
    fontSize: 18,
    flex: 1,
    marginLeft: 6,
  },
  headerIconButton: {
    width: 36,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerIcon: {
    fontFamily: 'Material Symbols Outlined',
    fontSize: 26,
    color: '#1e2f4d',
  },

  coverImage: {
    width: '100%',
    height: 210,
    backgroundColor: '#d9dde4',
  },
  profileBlock: {
    paddingHorizontal: 16,
    paddingTop: 10,
    paddingBottom: 16,
    borderBottomWidth: 8,
    borderBottomColor: '#eef1f5',
  },
  avatarWrapperLarge: {
    marginTop: -54,
    width: 104,
    height: 104,
    borderRadius: 52,
    borderWidth: 3,
    borderColor: '#fff',
    backgroundColor: '#fff',
  },
  avatarLarge: {
    width: '100%',
    height: '100%',
    borderRadius: 52,
  },
  avatarFallbackLarge: {
    width: '100%',
    height: '100%',
    borderRadius: 52,
    backgroundColor: Colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarInitial: {
    fontSize: 38,
    color: '#fff',
    fontWeight: '800',
  },
  cameraButton: {
    position: 'absolute',
    right: -4,
    bottom: -4,
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: '#eef1f6',
    borderWidth: 1,
    borderColor: '#c9d0da',
    alignItems: 'center',
    justifyContent: 'center',
  },
  cameraIcon: {
    fontFamily: 'Material Symbols Outlined',
    fontSize: 19,
    color: '#1e2f4d',
  },
  nameRow: {
    marginTop: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  nameTitle: {
    ...Typography.heading,
    color: '#1e2f4d',
    fontSize: 19,
    flex: 1,
  },
  editIcon: {
    fontFamily: 'Material Symbols Outlined',
    fontSize: 23,
    color: '#1e2f4d',
  },

  infoSection: {
    padding: 16,
  },
  infoTitle: {
    ...Typography.heading,
    color: '#1e2f4d',
    fontSize: 17,
    marginBottom: 16,
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  infoLabel: {
    ...Typography.body,
    color: '#60708a',
    fontSize: 15,
    width: 92,
  },
  infoValue: {
    ...Typography.body,
    color: '#1e2f4d',
    fontSize: 15,
    flex: 1,
  },
  privacyNote: {
    ...Typography.body,
    color: '#5f6f88',
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
    borderTopColor: '#e1e5ec',
    paddingTop: 14,
  },
  updateInlineIcon: {
    fontFamily: 'Material Symbols Outlined',
    fontSize: 22,
    color: '#1e2f4d',
  },
  updateInlineText: {
    ...Typography.heading,
    fontSize: 17,
    color: '#1e2f4d',
  },

  quickActions: {
    paddingHorizontal: 16,
    paddingBottom: 16,
    flexDirection: 'row',
    gap: 10,
  },
  quickActionButton: {
    flex: 1,
    borderRadius: 12,
    backgroundColor: '#eef2f8',
    paddingVertical: 12,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 6,
  },
  quickActionIcon: {
    fontFamily: 'Material Symbols Outlined',
    fontSize: 20,
    color: '#1e2f4d',
  },
  quickActionText: {
    ...Typography.label,
    fontSize: 14,
    color: '#1e2f4d',
  },

  editBody: {
    padding: 16,
    backgroundColor: '#fff',
  },
  fieldLabel: {
    ...Typography.body,
    fontSize: 15,
    color: '#1e2f4d',
    marginBottom: 8,
  },
  editInput: {
    borderWidth: 1,
    borderColor: '#d3d9e2',
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
    marginBottom: 14,
    ...Typography.body,
    fontSize: 15,
    color: '#1e2f4d',
    backgroundColor: '#fff',
  },
  mediaActionsRow: {
    marginBottom: 10,
  },
  mediaActionButton: {
    borderWidth: 1,
    borderColor: '#cfd7e3',
    borderRadius: 10,
    paddingVertical: 10,
    paddingHorizontal: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#f7f9fc',
  },
  mediaActionButtonDisabled: {
    opacity: 0.6,
  },
  mediaActionIcon: {
    fontFamily: 'Material Symbols Outlined',
    fontSize: 20,
    color: '#1e2f4d',
  },
  mediaActionText: {
    ...Typography.body,
    fontSize: 14,
    color: '#1e2f4d',
  },
  sectionHeading: {
    ...Typography.heading,
    color: '#1e2f4d',
    fontSize: 17,
    marginTop: 8,
    marginBottom: 10,
  },
  genderRowEdit: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 24,
    marginBottom: 14,
  },
  radioOption: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  radioOuter: {
    width: 26,
    height: 26,
    borderRadius: 13,
    borderWidth: 2,
    borderColor: '#a8b2c2',
    alignItems: 'center',
    justifyContent: 'center',
  },
  radioOuterActive: {
    borderColor: '#0b72ff',
  },
  radioInner: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: '#0b72ff',
  },
  radioText: {
    ...Typography.body,
    fontSize: 15,
    color: '#1e2f4d',
  },
  birthRow: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 14,
  },
  birthInput: {
    flex: 1,
    borderWidth: 1,
    borderColor: '#d3d9e2',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 12,
    ...Typography.body,
    fontSize: 15,
    color: '#1e2f4d',
    backgroundColor: '#fff',
    textAlign: 'center',
  },
  bottomActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 10,
    borderTopWidth: 1,
    borderTopColor: '#d9dde4',
    backgroundColor: '#f3f4f6',
    padding: 12,
  },
  cancelButton: {
    paddingHorizontal: 22,
    paddingVertical: 11,
    borderRadius: 8,
    backgroundColor: '#dee2e8',
  },
  cancelText: {
    ...Typography.heading,
    fontSize: 16,
    color: '#1e2f4d',
  },
  updateButton: {
    paddingHorizontal: 22,
    paddingVertical: 11,
    borderRadius: 8,
    backgroundColor: '#8ab5ef',
  },
  updateButtonDisabled: {
    opacity: 0.7,
  },
  updateText: {
    ...Typography.heading,
    fontSize: 16,
    color: '#fff',
  },
});
