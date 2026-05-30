import React from 'react';
import { useTheme } from '../../context/ThemeContext';
import { View, Text, TouchableOpacity, Pressable, TextInput, Image, ActivityIndicator } from 'react-native';
import { getContactsStyles } from '../../screens/main/style/ContactsScreen.styles';

interface ContactModalsProps {
  actionFriend: any;
  setActionFriend: (val: any) => void;
  nicknameFriend: any;
  setNicknameFriend: (val: any) => void;
  nicknameDraft: string;
  setNicknameDraft: (val: string) => void;
  nicknameSaving: boolean;
  onSaveNickname: () => void;
  profileFriend: any;
  setProfileFriend: (val: any) => void;
  profileLoading: boolean;
  onUnfriend: (email: string) => void;
  onBlock: (email: string) => void;
  onToggleCloseFriend: (email: string, status: boolean) => void;
  onOpenDirectChat: (email: string) => void;
  formatBirthDate: (val: any) => string;
}

export const ContactModals: React.FC<ContactModalsProps> = ({
  actionFriend,
  setActionFriend,
  nicknameFriend,
  setNicknameFriend,
  nicknameDraft,
  setNicknameDraft,
  nicknameSaving,
  onSaveNickname,
  profileFriend,
  setProfileFriend,
  profileLoading,
  onUnfriend,
  onBlock,
  onToggleCloseFriend,
  onOpenDirectChat,
  formatBirthDate,
}) => {
  const { t, colors } = useTheme();
  const styles = getContactsStyles(colors);;
  return (
    <>
      {/* Action Sheet */}
      {actionFriend && (
        <Pressable style={styles.overlay} onPress={() => setActionFriend(null)}>
          <View style={styles.sheet}>
            <View style={[styles.sheetItem, { borderBottomWidth: 0 }]}>
              <Text style={[styles.sheetText, { textAlign: "center", color: "#738098" }]}>
                {t('home.chat_options')} {actionFriend.displayName}
              </Text>
            </View>

            <TouchableOpacity
              style={styles.sheetItem}
              onPress={() => onOpenDirectChat(actionFriend.email)}
            >
              <Text style={styles.sheetText}>{t('chat.message_label')}</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.sheetItem}
              onPress={() => onToggleCloseFriend(actionFriend.email, !actionFriend.isCloseFriend)}
            >
              <Text style={styles.sheetText}>
                {actionFriend.isCloseFriend ? t('contacts.unmark_close_friend') : t('contacts.mark_close_friend')}
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.sheetItem}
              onPress={() => {
                setNicknameFriend(actionFriend);
                setNicknameDraft(actionFriend.nickname || "");
                setActionFriend(null);
              }}
            >
              <Text style={styles.sheetText}>{t('contacts.alias_title')}</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.sheetItem}
              onPress={() => onUnfriend(actionFriend.email)}
            >
              <Text style={[styles.sheetText, { color: "#ef4444" }]}>{t('common.delete')}</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.sheetItem}
              onPress={() => onBlock(actionFriend.email)}
            >
              <Text style={[styles.sheetText, { color: "#ef4444" }]}>{t('common.block')}</Text>
            </TouchableOpacity>
          </View>
        </Pressable>
      )}

      {/* Nickname Modal */}
      {nicknameFriend && (
        <Pressable style={styles.overlay} onPress={() => setNicknameFriend(null)}>
          <View style={styles.nicknameModal}>
            <Text style={styles.nickTitle}>{t('contacts.alias_title')}</Text>
            <Text style={styles.nickHint}>
              Biệt danh giúp bạn dễ dàng nhận diện bạn bè hơn.
            </Text>
            <TextInput
              style={styles.nickInput}
              value={nicknameDraft}
              onChangeText={setNicknameDraft}
              placeholder={t('contacts.alias_placeholder')}
              autoFocus
            />
            <View style={styles.nickActions}>
              <TouchableOpacity
                style={styles.cancelBtn}
                onPress={() => setNicknameFriend(null)}
              >
                <Text style={styles.cancelText}>{t('common.cancel')}</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.saveBtn, nicknameSaving && styles.disabledBtn]}
                onPress={onSaveNickname}
                disabled={nicknameSaving}
              >
                <Text style={styles.saveText}>
                  {nicknameSaving ? t('common.saving') : t('common.save')}
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </Pressable>
      )}

      {/* Profile Modal */}
      {profileFriend && (
        <Pressable style={styles.overlay} onPress={() => setProfileFriend(null)}>
          <View style={styles.profileModal}>
            <View style={styles.profileHead}>
              <Image
                source={{ uri: profileFriend.avatarUrl }}
                style={styles.profileAvatar}
              />
              <View>
                <Text style={styles.profileName}>{profileFriend.displayName}</Text>
                <Text style={styles.profileEmail}>{profileFriend.email}</Text>
              </View>
            </View>

            {profileLoading ? (
              <View style={styles.profileLoadingRow}>
                <ActivityIndicator size="small" color="#1f8fff" />
                <Text style={styles.profileLoadingText}>{t('profile.loading')}</Text>
              </View>
            ) : (
              <View style={styles.profileInfoWrap}>
                <Text style={styles.profileInfoRow}>
                  {t('profile.gender')}: {profileFriend.profile?.gender || t('profile.not_updated')}
                </Text>
                <Text style={styles.profileInfoRow}>
                  {t('profile.birthdate')}: {formatBirthDate(profileFriend.profile?.dateOfBirth || profileFriend.profile?.date_of_birth) || t('profile.not_updated')}
                </Text>
                <Text style={styles.profileInfoRow}>
                  {t('profile.phone')}: {profileFriend.profile?.phoneNumber || t('profile.not_updated')}
                </Text>
              </View>
            )}

            <View style={styles.profileActions}>
              <TouchableOpacity
                style={styles.cancelBtn}
                onPress={() => setProfileFriend(null)}
              >
                <Text style={styles.cancelText}>{t('common.close')}</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.saveBtn}
                onPress={() => {
                  onOpenDirectChat(profileFriend.email);
                  setProfileFriend(null);
                }}
              >
                <Text style={styles.saveText}>{t('chat.message_label')}</Text>
              </TouchableOpacity>
            </View>
          </View>
        </Pressable>
      )}
    </>
  );
};
