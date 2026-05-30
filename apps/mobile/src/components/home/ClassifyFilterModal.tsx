import React from 'react';
import { useTheme } from '../../context/ThemeContext';
import { View, Text, TouchableOpacity, Pressable, StyleSheet, ScrollView } from 'react-native';
import { Colors } from '../../constants/Theme';
import { useChatStore } from '../../store/chatStore';

interface ClassifyFilterModalProps {
  isVisible: boolean;
  currentTag: string | null;
  onClose: () => void;
  onSelectFilter: (tagId: string | null) => void;
  onManageTags: () => void;
}

export const ClassifyFilterModal: React.FC<ClassifyFilterModalProps> = ({
  isVisible,
  currentTag,
  onClose,
  onSelectFilter,
  onManageTags,
}) => {
  const { t } = useTheme();
  const { tags } = useChatStore();

  if (!isVisible) return null;

  return (
    <Pressable style={styles.overlay} onPress={onClose}>
      <Pressable style={styles.actionSheet} onPress={(e) => e.stopPropagation()}>
        <View style={styles.header}>
          <Text style={styles.headerText}>{t('home.filter_by')}</Text>
        </View>
        <ScrollView style={{ maxHeight: 300 }}>
          <View style={styles.actionList}>
            <TouchableOpacity style={styles.actionListItem} onPress={() => { onSelectFilter(null); onClose(); }}>
              <View style={[styles.colorBox, { backgroundColor: '#f0f0f0' }]} />
              <Text style={[styles.actionListText, currentTag === null && { color: Colors.primary, fontWeight: 'bold' }]}>{t('common.all')}</Text>
              {currentTag === null && <Text style={[styles.actionListIcon, { color: Colors.primary, marginLeft: 'auto' }]}>check</Text>}
            </TouchableOpacity>

            <TouchableOpacity style={styles.actionListItem} onPress={() => { onSelectFilter("none"); onClose(); }}>
              <View style={[styles.colorBox, { backgroundColor: '#e5e7eb' }]} />
              <Text style={[styles.actionListText, currentTag === "none" && { color: Colors.primary, fontWeight: 'bold' }]}>{t('home.no_tag')}</Text>
              {currentTag === "none" && <Text style={[styles.actionListIcon, { color: Colors.primary, marginLeft: 'auto' }]}>check</Text>}
            </TouchableOpacity>

            {tags.map((tag) => (
              <TouchableOpacity key={tag.id} style={styles.actionListItem} onPress={() => { onSelectFilter(tag.id); onClose(); }}>
                <View style={[styles.colorBox, { backgroundColor: tag.color || Colors.primary }]} />
                <Text style={[styles.actionListText, currentTag === tag.id && { color: Colors.primary, fontWeight: 'bold' }]}>{tag.name}</Text>
                {currentTag === tag.id && <Text style={[styles.actionListIcon, { color: Colors.primary, marginLeft: 'auto' }]}>check</Text>}
              </TouchableOpacity>
            ))}
          </View>
        </ScrollView>
        <View style={styles.divider} />
        <TouchableOpacity style={styles.actionListItem} onPress={() => { onClose(); onManageTags(); }}>
          <Text style={styles.actionListIcon}>sell</Text>
          <Text style={styles.actionListText}>{t('home.manage_tags')}</Text>
        </TouchableOpacity>
      </Pressable>
    </Pressable>
  );
};

const styles = StyleSheet.create({
  overlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.4)',
    justifyContent: 'flex-end',
    zIndex: 100,
  },
  actionSheet: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingBottom: 32,
    paddingTop: 16,
    paddingHorizontal: 16,
  },
  header: {
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
    marginBottom: 8,
    alignItems: 'center',
  },
  headerText: {
    fontFamily: 'PlusJakartaSans_600SemiBold',
    fontSize: 16,
    color: Colors.onBackground,
  },
  actionList: {
    marginTop: 8,
  },
  actionListItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
    paddingHorizontal: 8,
  },
  actionListIcon: {
    fontFamily: 'Material Symbols Outlined',
    fontSize: 20,
    color: Colors.onSurfaceVariant,
    marginRight: 16,
  },
  actionListText: {
    fontFamily: 'PlusJakartaSans_500Medium',
    fontSize: 15,
    color: Colors.onBackground,
  },
  divider: {
    height: 1,
    backgroundColor: '#f0f0f0',
    marginVertical: 8,
  },
  colorBox: {
    width: 16,
    height: 16,
    borderRadius: 4,
    marginRight: 16,
  }
});
