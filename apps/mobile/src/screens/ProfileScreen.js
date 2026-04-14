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
  currentFeeling: '',
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
  const [quickMode, setQuickMode] = useState(null);
  const [quickSaving, setQuickSaving] = useState(false);
  const [bioDraft, setBioDraft] = useState('');
  const [feelingDraft, setFeelingDraft] = useState('');

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
    const currentFeeling = source.currentFeeling || source.feelingMessage || source.currentStatus || source.statusMessage || '';

    return {
      ...EMPTY_PROFILE,
      ...source,
      fullName,
      fullname: fullName,
      avatarUrl,
      urlAvatar: avatarUrl,
      backgroundUrl,
      urlBackground: backgroundUrl,
      currentFeeling,
      feelingMessage: currentFeeling,
      currentStatus: currentFeeling,
      statusMessage: currentFeeling,
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
      currentFeeling:
        nextProfile.currentFeeling ||
        nextProfile.feelingMessage ||
        nextProfile.currentStatus ||
        nextProfile.statusMessage ||
        currentUser.currentFeeling ||
        currentUser.feelingMessage ||
        currentUser.currentStatus ||
        currentUser.statusMessage ||
        '',
      feelingMessage:
        nextProfile.currentFeeling ||
        nextProfile.feelingMessage ||
        nextProfile.currentStatus ||
        nextProfile.statusMessage ||
        currentUser.currentFeeling ||
        currentUser.feelingMessage ||
        currentUser.currentStatus ||
        currentUser.statusMessage ||
        '',
      currentStatus:
        nextProfile.currentFeeling ||
        nextProfile.feelingMessage ||
        nextProfile.currentStatus ||
        nextProfile.statusMessage ||
        currentUser.currentFeeling ||
        currentUser.feelingMessage ||
        currentUser.currentStatus ||
        currentUser.statusMessage ||
        '',
      statusMessage:
        nextProfile.currentFeeling ||
        nextProfile.feelingMessage ||
        nextProfile.currentStatus ||
        nextProfile.statusMessage ||
        currentUser.currentFeeling ||
        currentUser.feelingMessage ||
        currentUser.currentStatus ||
        currentUser.statusMessage ||
        '',
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
        const parsedSavedUser = savedUser ? JSON.parse(savedUser) : null;
        if (savedUser) {
          const localProfile = normalizeProfile(parsedSavedUser);
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

        const apiProfile = normalizeProfile({ ...(parsedSavedUser || {}), ...(data.profile || data) });
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

  const openQuickBioEditor = () => {
    setBioDraft(profile.bio || '');
    setQuickMode('bio');
  };

  const openQuickStatusEditor = () => {
    setFeelingDraft(profile.currentFeeling || profile.currentStatus || '');
    setQuickMode('status');
  };

  const closeQuickEditor = () => {
    setQuickMode(null);
    setBioDraft('');
    setFeelingDraft('');
  };

  const saveQuickBio = async () => {
    setQuickSaving(true);
    try {
      const headers = await authHeaders();
      const response = await fetch(`${API_URL}/users/profile`, {
        method: 'PUT',
        headers,
        body: JSON.stringify({
          fullName: profile.fullName,
          phone: profile.phone,
          address: profile.address,
          bio: bioDraft.trim(),
          dataOfBirth: profile.dataOfBirth,
          gender: profile.gender,
        }),
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.message || 'Không thể cập nhật bio.');
      }

      const nextProfile = normalizeProfile({ ...profile, ...(data.profile || data), bio: bioDraft.trim() });
      setProfile(nextProfile);
      setDraft(nextProfile);
      await persistUser(nextProfile);
      closeQuickEditor();
      Alert.alert('Thành công', 'Đã cập nhật bio.');
    } catch (error) {
      Alert.alert('Lỗi', error.message || 'Không thể cập nhật bio.');
    } finally {
      setQuickSaving(false);
    }
  };

  const saveQuickStatus = async () => {
    setQuickSaving(true);
    try {
      const nextProfile = normalizeProfile({ ...profile, currentFeeling: feelingDraft.trim() });
      setProfile(nextProfile);
      setDraft(nextProfile);
      await persistUser(nextProfile);
      closeQuickEditor();
      Alert.alert('Thành công', 'Đã cập nhật feeling.');
    } catch (error) {
      Alert.alert('Lỗi', 'Không thể cập nhật feeling.');
    } finally {
      setQuickSaving(false);
    }
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
              <View style={styles.profileCanvas}>
              <View style={styles.heroCard}>
                <Image source={{ uri: backgroundUrl || COVER_URL }} style={styles.heroImage} />
                <View style={styles.heroOverlay} />

                <View style={styles.heroBar}>
                  <TouchableOpacity style={styles.heroIconButton} onPress={() => onNavigate && onNavigate('home')}>
                    <Text style={styles.heroIcon}>arrow_back</Text>
                  </TouchableOpacity>
                  <View style={styles.heroActions}>
                    <TouchableOpacity style={styles.heroIconButton} onPress={openQuickStatusEditor}>
                      <Text style={styles.heroIcon}>schedule</Text>
                    </TouchableOpacity>
                    <TouchableOpacity style={styles.heroIconButton} onPress={() => onNavigate && onNavigate('profile-more')}>
                      <Text style={styles.heroIcon}>more_horiz</Text>
                    </TouchableOpacity>
                  </View>
                </View>

                <View style={styles.avatarDock}>
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
                  <TouchableOpacity style={styles.statusBubble} onPress={openQuickStatusEditor} activeOpacity={0.85}>
                    <Text style={styles.statusBubbleText}>{profile.currentFeeling || profile.currentStatus || 'Current feeling'}</Text>
                  </TouchableOpacity>
                </View>
              </View>

              <View style={styles.identityCard}>
                <Text style={styles.nameTitle}>{displayName}</Text>
                <TouchableOpacity style={styles.bioButton} onPress={openQuickBioEditor}>
                  <Text style={styles.bioButtonIcon}>edit</Text>
                  <Text style={styles.bioButtonText}>Update Bio</Text>
                </TouchableOpacity>
              </View>

              {quickMode === 'bio' && (
                <View style={styles.quickEditorCard}>
                  <Text style={styles.quickEditorTitle}>Cập nhật Bio</Text>
                  <TextInput
                    style={[styles.quickEditorInput, styles.quickEditorInputMulti]}
                    value={bioDraft}
                    onChangeText={setBioDraft}
                    placeholder="Nhập bio của bạn"
                    placeholderTextColor={Colors.outline}
                    multiline
                    maxLength={180}
                    textAlignVertical="top"
                  />
                  <View style={styles.quickEditorActions}>
                    <TouchableOpacity style={styles.quickEditorCancel} onPress={closeQuickEditor}>
                      <Text style={styles.quickEditorCancelText}>Hủy</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={[styles.quickEditorSave, quickSaving && styles.quickEditorSaveDisabled]}
                      onPress={saveQuickBio}
                      disabled={quickSaving}
                    >
                      <Text style={styles.quickEditorSaveText}>{quickSaving ? 'Đang lưu...' : 'Lưu Bio'}</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              )}

              {quickMode === 'status' && (
                <View style={styles.quickEditorCard}>
                  <Text style={styles.quickEditorTitle}>Cập nhật Current feeling</Text>
                  <TextInput
                    style={styles.quickEditorInput}
                    value={feelingDraft}
                    onChangeText={setFeelingDraft}
                    placeholder="Nhập feeling hiện tại"
                    placeholderTextColor={Colors.outline}
                    maxLength={60}
                  />
                  <View style={styles.quickEditorActions}>
                    <TouchableOpacity style={styles.quickEditorCancel} onPress={closeQuickEditor}>
                      <Text style={styles.quickEditorCancelText}>Hủy</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={[styles.quickEditorSave, quickSaving && styles.quickEditorSaveDisabled]}
                      onPress={saveQuickStatus}
                      disabled={quickSaving}
                    >
                      <Text style={styles.quickEditorSaveText}>{quickSaving ? 'Đang lưu...' : 'Lưu feeling'}</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              )}

              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.actionStrip}>
                <TouchableOpacity style={styles.actionPill} onPress={() => Alert.alert('Riêng tư', 'Mục này sẽ được mở rộng trong màn Settings.') }>
                  <Text style={styles.actionPillIcon}>lock</Text>
                  <Text style={styles.actionPillText}>Riêng tư</Text>
                </TouchableOpacity>
              </ScrollView>

              <View style={styles.infoSection}>
                <View style={styles.infoHeader}>
                  <Text style={styles.infoTitle}>Thông tin cá nhân</Text>
                </View>

                <View style={styles.infoRow}>
                  <Text style={styles.infoLabel}>Họ tên</Text>
                  <Text style={styles.infoValue}>{displayName}</Text>
                </View>
                <View style={styles.infoRow}>
                  <Text style={styles.infoLabel}>Email</Text>
                  <Text style={styles.infoValue}>{profile.email || 'Chưa cập nhật'}</Text>
                </View>
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
                <View style={styles.infoColumn}>
                  <Text style={styles.infoLabel}>Địa chỉ</Text>
                  <Text style={styles.infoValue}>{profile.address || 'Chưa cập nhật'}</Text>
                </View>
                <View style={styles.infoColumn}>
                  <Text style={styles.infoLabel}>Giới thiệu</Text>
                  <Text style={styles.infoValue}>{profile.bio || 'Chưa cập nhật'}</Text>
                </View>

                <Text style={styles.privacyNote}>Chỉ bạn bè có lưu số của bạn trong danh bạ máy xem được số này</Text>

                <TouchableOpacity style={styles.updateInlineButton} onPress={startEditing}>
                  <Text style={styles.updateInlineIcon}>edit</Text>
                  <Text style={styles.updateInlineText}>Cập nhật</Text>
                </TouchableOpacity>
              </View>
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
  profileCanvas: {
    paddingBottom: 18,
  },

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

  sheetWrap: {
    borderRadius: 24,
    overflow: 'hidden',
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#d7dbe3',
    ...Shadows.soft,
  },
  heroCard: {
    backgroundColor: '#0f2540',
  },
  heroImage: {
    width: '100%',
    height: 280,
    backgroundColor: '#d9dde4',
  },
  heroOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(7, 18, 33, 0.22)',
  },
  heroBar: {
    position: 'absolute',
    top: 12,
    left: 12,
    right: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  heroActions: {
    flexDirection: 'row',
    gap: 10,
  },
  heroIconButton: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.18)',
  },
  heroIcon: {
    fontFamily: 'Material Symbols Outlined',
    fontSize: 22,
    color: '#fff',
  },
  avatarDock: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: -52,
    alignItems: 'center',
  },
  statusBubble: {
    position: 'absolute',
    top: -8,
    right: 28,
    backgroundColor: '#fff',
    borderRadius: 14,
    paddingHorizontal: 16,
    paddingVertical: 12,
    ...Shadows.soft,
  },
  statusBubbleText: {
    ...Typography.body,
    color: '#7e7e7e',
    fontSize: 13,
    maxWidth: 90,
  },
  avatarWrapperLarge: {
    width: 112,
    height: 112,
    borderRadius: 56,
    borderWidth: 4,
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
  identityCard: {
    paddingTop: 64,
    paddingBottom: 18,
    paddingHorizontal: 16,
    alignItems: 'center',
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#eef1f5',
  },
  nameTitle: {
    ...Typography.heading,
    color: '#1e2f4d',
    fontSize: 28,
    textAlign: 'center',
  },
  nameRow: {
    marginTop: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  editIcon: {
    fontFamily: 'Material Symbols Outlined',
    fontSize: 23,
    color: '#1e2f4d',
  },
  bioButton: {
    marginTop: 14,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  bioButtonIcon: {
    fontFamily: 'Material Symbols Outlined',
    fontSize: 20,
    color: Colors.primary,
  },
  bioButtonText: {
    ...Typography.body,
    fontSize: 16,
    color: Colors.primary,
  },
  postButton: {
    marginTop: 4,
    alignSelf: 'center',
    borderRadius: 22,
    backgroundColor: '#0b72ff',
    paddingHorizontal: 18,
    paddingVertical: 10,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    ...Shadows.soft,
  },
  postButtonIcon: {
    fontFamily: 'Material Symbols Outlined',
    fontSize: 18,
    color: '#fff',
  },
  postButtonText: {
    ...Typography.heading,
    fontSize: 16,
    color: '#fff',
  },
  postSection: {
    marginTop: 10,
    paddingHorizontal: 16,
    paddingBottom: 4,
    gap: 10,
  },
  postComposerCard: {
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#d7e0ef',
    backgroundColor: '#f7fbff',
    padding: 12,
  },
  postComposerAuthorRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 10,
  },
  postComposerAvatar: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: '#e0e3e5',
  },
  postComposerAvatarFallback: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: '#0058bc',
    alignItems: 'center',
    justifyContent: 'center',
  },
  postComposerAvatarInitial: {
    fontSize: 18,
    color: '#fff',
    fontWeight: '800',
  },
  postComposerAuthorInfo: {
    flex: 1,
  },
  postComposerAuthorName: {
    ...Typography.heading,
    fontSize: 15,
    color: '#1e2f4d',
  },
  postComposerAuthorEmail: {
    ...Typography.body,
    fontSize: 12,
    color: '#6f7d91',
    marginTop: 2,
  },
  postComposerInput: {
    minHeight: 90,
    borderWidth: 1,
    borderColor: '#d3d9e2',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    backgroundColor: '#fff',
    ...Typography.body,
    color: '#1e2f4d',
    fontSize: 14,
  },
  postComposerToolbar: {
    marginTop: 10,
    flexDirection: 'row',
    gap: 10,
  },
  postComposerAttachButton: {
    flex: 1,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#d3d9e2',
    backgroundColor: '#fff',
    paddingVertical: 10,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 6,
  },
  postComposerAttachIcon: {
    fontFamily: 'Material Symbols Outlined',
    fontSize: 18,
    color: '#1e2f4d',
  },
  postComposerAttachText: {
    ...Typography.label,
    fontSize: 13,
    color: '#1e2f4d',
  },
  postAttachmentPreview: {
    marginTop: 10,
    borderRadius: 12,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: '#d3d9e2',
    backgroundColor: '#fff',
    position: 'relative',
  },
  postAttachmentImage: {
    width: '100%',
    height: 180,
    backgroundColor: '#eef1f6',
  },
  postAttachmentVideoCard: {
    minHeight: 180,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#0f172a',
    padding: 14,
  },
  postAttachmentVideoIcon: {
    fontFamily: 'Material Symbols Outlined',
    fontSize: 44,
    color: '#fff',
    marginBottom: 8,
  },
  postAttachmentVideoText: {
    ...Typography.body,
    fontSize: 14,
    color: '#fff',
    textAlign: 'center',
  },
  postAttachmentRemoveButton: {
    position: 'absolute',
    top: 8,
    right: 8,
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: 'rgba(255,255,255,0.92)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  postAttachmentRemoveIcon: {
    fontFamily: 'Material Symbols Outlined',
    fontSize: 18,
    color: '#1e2f4d',
  },
  postComposerActions: {
    marginTop: 10,
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 8,
  },
  postComposerCancel: {
    borderRadius: 8,
    backgroundColor: '#e3e9f2',
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  postComposerCancelText: {
    ...Typography.label,
    color: '#1e2f4d',
    fontSize: 13,
  },
  postComposerSubmit: {
    borderRadius: 8,
    backgroundColor: '#0b72ff',
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  postComposerSubmitText: {
    ...Typography.label,
    color: '#fff',
    fontSize: 13,
  },
  postList: {
    gap: 10,
    marginTop: 2,
  },
  postCard: {
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#e0e6f0',
    backgroundColor: '#fff',
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  postCardAuthorRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 10,
  },
  postCardAvatar: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: '#e0e3e5',
  },
  postCardAvatarFallback: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: '#0058bc',
    alignItems: 'center',
    justifyContent: 'center',
  },
  postCardAvatarInitial: {
    fontSize: 18,
    color: '#fff',
    fontWeight: '800',
  },
  postCardAuthorInfo: {
    flex: 1,
  },
  postCardAuthorName: {
    ...Typography.heading,
    fontSize: 15,
    color: '#1e2f4d',
  },
  postDate: {
    ...Typography.body,
    fontSize: 12,
    color: '#7a879b',
    marginBottom: 6,
  },
  postContent: {
    ...Typography.body,
    fontSize: 14,
    color: '#1e2f4d',
    lineHeight: 20,
  },
  postCardAttachment: {
    marginTop: 10,
    borderRadius: 12,
    overflow: 'hidden',
  },
  postCardAttachmentImage: {
    width: '100%',
    height: 180,
    backgroundColor: '#eef1f6',
    borderRadius: 12,
  },
  postCardVideoCard: {
    minHeight: 150,
    borderRadius: 12,
    backgroundColor: '#0f172a',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 12,
  },
  postCardVideoIcon: {
    fontFamily: 'Material Symbols Outlined',
    fontSize: 38,
    color: '#fff',
    marginBottom: 6,
  },
  postCardVideoText: {
    ...Typography.body,
    fontSize: 13,
    color: '#fff',
    textAlign: 'center',
  },
  quickEditorCard: {
    marginHorizontal: 16,
    marginBottom: 12,
    marginTop: 2,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#d7e0ef',
    backgroundColor: '#f7fbff',
    padding: 12,
  },
  quickEditorTitle: {
    ...Typography.heading,
    fontSize: 15,
    color: '#1e2f4d',
    marginBottom: 8,
  },
  quickEditorInput: {
    borderWidth: 1,
    borderColor: '#d3d9e2',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    backgroundColor: '#fff',
    ...Typography.body,
    color: '#1e2f4d',
    fontSize: 14,
  },
  quickEditorInputMulti: {
    minHeight: 78,
  },
  quickEditorActions: {
    marginTop: 10,
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 8,
  },
  quickEditorCancel: {
    borderRadius: 8,
    backgroundColor: '#e3e9f2',
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  quickEditorCancelText: {
    ...Typography.label,
    color: '#1e2f4d',
    fontSize: 13,
  },
  quickEditorSave: {
    borderRadius: 8,
    backgroundColor: '#0b72ff',
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  quickEditorSaveDisabled: {
    opacity: 0.7,
  },
  quickEditorSaveText: {
    ...Typography.label,
    color: '#fff',
    fontSize: 13,
  },
  actionStrip: {
    paddingHorizontal: 16,
    paddingTop: 4,
    paddingBottom: 8,
    gap: 12,
  },
  actionPill: {
    width: 160,
    minHeight: 54,
    borderRadius: 16,
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#e3e8f1',
    paddingHorizontal: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  actionPillIcon: {
    fontFamily: 'Material Symbols Outlined',
    fontSize: 18,
    color: Colors.primary,
  },
  actionPillText: {
    ...Typography.heading,
    fontSize: 14,
    color: '#223553',
  },

  infoSection: {
    padding: 16,
    backgroundColor: '#fff',
  },
  infoHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  infoTitle: {
    ...Typography.heading,
    color: '#1e2f4d',
    fontSize: 18,
  },
  infoChevron: {
    fontFamily: 'Material Symbols Outlined',
    fontSize: 24,
    color: '#1e2f4d',
  },
  infoCollapsedHint: {
    ...Typography.body,
    marginTop: 8,
    fontSize: 13,
    color: '#70819b',
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 12,
  },
  infoColumn: {
    marginTop: 12,
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
