import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, TextInput, Modal, Pressable } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../../context/ThemeContext';
import { useChatStore } from '../../store/chatStore';

interface TagManagementScreenProps {
  goBack: () => void;
}

const PRESET_COLORS = [
  '#0068FF', '#E54D42', '#39B54A', '#F37B1D', '#8C4AF2', 
  '#1CBBB4', '#E03997', '#A5673F', '#607D8B', '#FFB020'
];

export default function TagManagementScreen({ goBack }: TagManagementScreenProps) {
  const insets = useSafeAreaInsets();
  const { colors, t, isDark } = useTheme();
  const styles = React.useMemo(() => getStyles(colors, isDark), [colors, isDark]);
  const { tags, createTag, updateTag, deleteTag } = useChatStore();

  const [modalVisible, setModalVisible] = useState(false);
  const [editingTag, setEditingTag] = useState<any>(null);
  const [tagName, setTagName] = useState('');
  const [tagColor, setTagColor] = useState(PRESET_COLORS[0]);

  const handleOpenCreate = () => {
    setEditingTag(null);
    setTagName('');
    setTagColor(PRESET_COLORS[0]);
    setModalVisible(true);
  };

  const handleOpenEdit = (tag: any) => {
    setEditingTag(tag);
    setTagName(tag.name);
    setTagColor(tag.color || PRESET_COLORS[0]);
    setModalVisible(true);
  };

  const handleSave = () => {
    if (!tagName.trim()) return;
    
    if (editingTag) {
      updateTag({ ...editingTag, name: tagName.trim(), color: tagColor });
    } else {
      createTag({
        id: `tag_${Date.now()}`,
        name: tagName.trim(),
        color: tagColor,
      });
    }
    setModalVisible(false);
  };

  const handleDelete = (tagId: string) => {
    deleteTag(tagId);
  };

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <View style={styles.header}>
        <TouchableOpacity style={styles.backBtn} onPress={goBack}>
          <Text style={styles.backIcon}>arrow_back</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>{t('tags.title')}</Text>
        <TouchableOpacity style={styles.addBtn} onPress={handleOpenCreate}>
          <Text style={styles.addIcon}>add</Text>
        </TouchableOpacity>
      </View>

      <ScrollView style={styles.content} contentContainerStyle={{ padding: 16 }}>
        {tags.length === 0 ? (
          <View style={styles.emptyContainer}>
            <Text style={styles.emptyIcon}>sell</Text>
            <Text style={styles.emptyText}>{t('tags.empty')}</Text>
            <Text style={styles.emptySubText}>{t('tags.empty_sub')}</Text>
          </View>
        ) : (
          tags.map((tag: any) => (
            <View key={tag.id} style={styles.tagItem}>
              <View style={styles.tagInfo}>
                <View style={[styles.tagColor, { backgroundColor: tag.color || '#ffb020' }]} />
                <Text style={styles.tagName}>{tag.name}</Text>
              </View>
              <View style={styles.tagActions}>
                <TouchableOpacity style={styles.actionBtn} onPress={() => handleOpenEdit(tag)}>
                  <Text style={[styles.actionIcon, { color: colors.primary }]}>edit</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.actionBtn} onPress={() => handleDelete(tag.id)}>
                  <Text style={[styles.actionIcon, { color: '#ef4444' }]}>delete</Text>
                </TouchableOpacity>
              </View>
            </View>
          ))
        )}
      </ScrollView>

      <Modal visible={modalVisible} transparent animationType="fade" onRequestClose={() => setModalVisible(false)}>
        <Pressable style={styles.modalOverlay} onPress={() => setModalVisible(false)}>
          <Pressable style={styles.modalContent} onPress={(e) => e.stopPropagation()}>
            <Text style={styles.modalTitle}>{editingTag ? t('tags.edit_title') : t('tags.create_title')}</Text>
            
            <TextInput
              style={styles.input}
              placeholder={t('tags.placeholder')}
              placeholderTextColor={colors.onSurfaceVariant}
              value={tagName}
              onChangeText={setTagName}
              autoFocus
            />

            <Text style={styles.colorLabel}>{t('tags.color_label')}</Text>
            <View style={styles.colorGrid}>
              {PRESET_COLORS.map(color => (
                <TouchableOpacity
                  key={color}
                  style={[styles.colorItem, { backgroundColor: color }, tagColor === color && styles.colorItemSelected]}
                  onPress={() => setTagColor(color)}
                >
                  {tagColor === color && <Text style={styles.checkIcon}>check</Text>}
                </TouchableOpacity>
              ))}
            </View>

            <View style={styles.modalActions}>
              <TouchableOpacity style={styles.cancelBtn} onPress={() => setModalVisible(false)}>
                <Text style={styles.cancelBtnText}>{t('common.cancel')}</Text>
              </TouchableOpacity>
              <TouchableOpacity 
                style={[styles.saveBtn, !tagName.trim() && { opacity: 0.5 }]} 
                onPress={handleSave}
                disabled={!tagName.trim()}
              >
                <Text style={styles.saveBtnText}>{t('tags.save')}</Text>
              </TouchableOpacity>
            </View>
          </Pressable>
        </Pressable>
      </Modal>
    </View>
  );
}

const getStyles = (colors: any, isDark: boolean) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.surface,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    height: 56,
    borderBottomWidth: 1,
    borderBottomColor: colors.outlineVariant,
    paddingHorizontal: 8,
  },
  backBtn: {
    padding: 8,
  },
  backIcon: {
    fontFamily: 'Material Symbols Outlined',
    fontSize: 24,
    color: colors.onSurface,
  },
  headerTitle: {
    flex: 1,
    fontSize: 18,
    fontFamily: 'PlusJakartaSans_600SemiBold',
    color: colors.onSurface,
    marginLeft: 8,
  },
  addBtn: {
    padding: 8,
  },
  addIcon: {
    fontFamily: 'Material Symbols Outlined',
    fontSize: 24,
    color: colors.primary,
  },
  content: {
    flex: 1,
  },
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingTop: 80,
  },
  emptyIcon: {
    fontFamily: 'Material Symbols Outlined',
    fontSize: 64,
    color: colors.outlineVariant,
    marginBottom: 16,
  },
  emptyText: {
    fontSize: 16,
    fontFamily: 'PlusJakartaSans_600SemiBold',
    color: colors.onSurface,
    marginBottom: 8,
  },
  emptySubText: {
    fontSize: 14,
    fontFamily: 'PlusJakartaSans_400Regular',
    color: colors.onSurfaceVariant,
    textAlign: 'center',
  },
  tagItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: colors.outlineVariant,
  },
  tagInfo: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  tagColor: {
    width: 16,
    height: 16,
    borderRadius: 4,
    marginRight: 12,
  },
  tagName: {
    fontSize: 16,
    fontFamily: 'PlusJakartaSans_500Medium',
    color: colors.onSurface,
  },
  tagActions: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  actionBtn: {
    padding: 8,
    marginLeft: 8,
  },
  actionIcon: {
    fontFamily: 'Material Symbols Outlined',
    fontSize: 20,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.4)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContent: {
    width: '85%',
    backgroundColor: colors.surface,
    borderRadius: 16,
    padding: 24,
  },
  modalTitle: {
    fontSize: 18,
    fontFamily: 'PlusJakartaSans_600SemiBold',
    color: colors.onSurface,
    marginBottom: 16,
  },
  input: {
    borderWidth: 1,
    borderColor: colors.outlineVariant,
    borderRadius: 8,
    padding: 12,
    fontSize: 15,
    fontFamily: 'PlusJakartaSans_400Regular',
    marginBottom: 20,
    color: colors.onSurface,
  },
  colorLabel: {
    fontSize: 14,
    fontFamily: 'PlusJakartaSans_500Medium',
    color: colors.onSurface,
    marginBottom: 12,
  },
  colorGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    marginBottom: 24,
  },
  colorItem: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  colorItemSelected: {
    borderWidth: 2,
    borderColor: colors.onSurface,
  },
  checkIcon: {
    fontFamily: 'Material Symbols Outlined',
    fontSize: 18,
    color: '#fff',
  },
  modalActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 12,
  },
  cancelBtn: {
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 8,
  },
  cancelBtnText: {
    fontSize: 15,
    fontFamily: 'PlusJakartaSans_600SemiBold',
    color: colors.onSurfaceVariant,
  },
  saveBtn: {
    backgroundColor: colors.primary,
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 8,
  },
  saveBtnText: {
    fontSize: 15,
    fontFamily: 'PlusJakartaSans_600SemiBold',
    color: '#fff',
  },
});
