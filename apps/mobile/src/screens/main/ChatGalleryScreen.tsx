import React, { useState, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  FlatList,
  Image,
  Dimensions,
  Linking,
  Modal,
  ScrollView,
  ActivityIndicator
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Colors } from '../../constants/Theme';
import { useChatStore } from '../../store/chatStore';
import { normalizeAttachment } from '../../store/chatHelpers';
import { downloadAndOpenFile } from '../../utils/fileHelper';

const { width } = Dimensions.get('window');
const COLUMN_COUNT = 3;
const ITEM_SIZE = (width - 32 - 16) / COLUMN_COUNT;

const formatBytes = (value?: number) => {
  const bytes = Number(value || 0);
  if (!bytes) return 'Không rõ dung lượng';
  const units = ['B', 'KB', 'MB', 'GB'];
  let size = bytes;
  let unitIndex = 0;
  while (size >= 1024 && unitIndex < units.length - 1) {
    size /= 1024;
    unitIndex += 1;
  }
  return `${size.toFixed(unitIndex === 0 ? 0 : 1)} ${units[unitIndex]}`;
};

const getHostName = (url: string) => {
  try {
    return new URL(url).hostname.replace(/^www\./, '');
  } catch {
    return url.replace(/^https?:\/\//, '').split('/')[0] || 'Liên kết';
  }
};

const ChatGalleryScreen = ({ route, navigation }: any) => {
  const { conversationId } = route.params;
  const insets = useSafeAreaInsets();
  const { archiveAssets, fetchArchiveAssets, userProfiles } = useChatStore();
  
  const [activeTab, setActiveTab] = useState<'media' | 'file' | 'link'>('media');
  const [filterSender, setFilterSender] = useState<string | null>(null);
  const [dateFrom, setDateFrom] = useState<Date | null>(null);
  const [dateTo, setDateTo] = useState<Date | null>(null);
  const [showFilterMenu, setShowFilterMenu] = useState(false);

  const galleryData = useMemo(() => {
    const media: any[] = [];
    const files: any[] = [];
    const links: any[] = [];
    
    const urlRegex = /(https?:\/\/[^\s<>"']+)/g;

    // Use store items
    const storeMediaMessages = archiveAssets.media.items;
    const storeFileMessages = archiveAssets.file.items;
    const storeLinkMessages = archiveAssets.link.items;

    // Process Media
    storeMediaMessages.forEach(m => {
      const all = (m.media || m.files) ? [...(m.media || []), ...(m.files || [])] : [m];
      all.forEach((item: any) => {
        const normalized = normalizeAttachment(item);
        if (normalized.mimeType?.startsWith('image/') || normalized.mimeType?.startsWith('video/')) {
          media.push({ ...normalized, messageId: m.id, createdAt: m.createdAt, senderId: m.senderId });
        }
      });
    });

    // Process Files
    storeFileMessages.forEach(m => {
      const all = Array.isArray(m.files) && m.files.length > 0 ? m.files : [m];
      all.forEach((item: any) => {
        const normalized = normalizeAttachment(item);
        const fileName = (normalized.name || '').toLowerCase();
        const mimeType = (normalized.mimeType || '').toLowerCase();
        const isSystemFile = fileName === 'contact.json' || fileName === 'location.json';
        const isMediaFile = mimeType.startsWith('image/') || mimeType.startsWith('video/');
        if (!isSystemFile && !isMediaFile) {
          files.push({ ...normalized, messageId: m.id, createdAt: m.createdAt, senderId: m.senderId });
        }
      });
    });

    // Process Links
    storeLinkMessages.forEach(m => {
      const content = typeof m.content === 'string' ? m.content : '';
      const matches = m.url ? [m.url] : content.match(urlRegex);
      if (matches) {
        matches.forEach((url: string) => {
          const cleanUrl = url.replace(/[),.;!?]+$/, '');
          links.push({ url: cleanUrl, createdAt: m.createdAt, senderId: m.senderId, messageId: m.id });
        });
      }
    });

    // Get unique senders for filter menu
    const allItems = [...media, ...files, ...links];
    const senders = new Set<string>();
    allItems.forEach(item => { if (item.senderId) senders.add(item.senderId); });

    // Apply filter logic
    const applyFilters = (items: any[]) => {
      return items.filter((item: any) => {
        if (filterSender && item.senderId !== filterSender) return false;
        const itemDate = new Date(item.createdAt);
        if (dateFrom && itemDate < dateFrom) return false;
        if (dateTo) {
          const nextDay = new Date(dateTo);
          nextDay.setDate(nextDay.getDate() + 1);
          if (itemDate >= nextDay) return false;
        }
        return true;
      });
    };

    return {
      media: applyFilters(media),
      files: applyFilters(files),
      links: applyFilters(links),
      senders: Array.from(senders)
    };
  }, [archiveAssets, filterSender, dateFrom, dateTo]);

  const currentTabState = archiveAssets[activeTab];

  React.useEffect(() => {
    (['media', 'file', 'link'] as const).forEach((type) => {
      fetchArchiveAssets(conversationId, type, true);
    });
  }, [conversationId]);

  const loadMore = () => {
    if (currentTabState.cursor && !currentTabState.loading) {
      fetchArchiveAssets(conversationId, activeTab);
    }
  };

  const renderFooter = () => {
    if (currentTabState.loading) {
      return (
        <View style={styles.footerLoader}>
          <ActivityIndicator size="small" color={Colors.primary} />
          <Text style={styles.footerLoaderText}>Đang tải thêm...</Text>
        </View>
      );
    }

    if (currentTabState.cursor) {
      return (
        <TouchableOpacity style={styles.loadMoreBtn} onPress={loadMore}>
          <Text style={styles.loadMoreText}>Tải thêm</Text>
        </TouchableOpacity>
      );
    }

    return <View style={{ height: 40 }} />;
  };

  const renderMediaItem = ({ item }: { item: any }) => (
    <TouchableOpacity 
      style={styles.mediaItem}
      onPress={() => navigation.navigate('MediaDetail', { 
        mediaUrl: item.dataUrl || item.url,
        mimeType: item.mimeType
      })}
    >
      <Image source={{ uri: item.dataUrl || item.url }} style={styles.mediaThumb} resizeMode="cover" />
      <View style={styles.mediaOverlay}>
        {item.mimeType?.startsWith('video/') && (
          <View style={styles.playIconOverlay}>
            <Text style={styles.playIcon}>play_circle</Text>
          </View>
        )}
        <View style={styles.mediaMetadata}>
          <Text style={styles.mediaDate}>{new Date(item.createdAt).toLocaleDateString('vi-VN')}</Text>
          {item.senderId && galleryData.senders.length > 1 && (
            <Text style={styles.mediaSender}>{getSenderName(item.senderId)}</Text>
          )}
        </View>
      </View>
    </TouchableOpacity>
  );

  const getFileIcon = (filename: string, mimeType: string) => {
    const ext = filename?.split('.')?.pop()?.toLowerCase() || '';
    const mime = mimeType?.toLowerCase() || '';
    
    if (mime.includes('pdf')) return 'picture_as_pdf';
    if (mime.includes('word') || ext === 'doc' || ext === 'docx') return 'description';
    if (mime.includes('sheet') || ext === 'xls' || ext === 'xlsx') return 'table_chart';
    if (mime.includes('powerpoint') || ext === 'ppt' || ext === 'pptx') return 'slideshow';
    if (mime.includes('zip') || mime.includes('rar') || ext === 'zip' || ext === 'rar') return 'folder_zip';
    if (mime.includes('audio')) return 'audio_file';
    return 'description';
  };

  const getFileAccent = (filename: string, mimeType: string) => {
    const ext = filename?.split('.')?.pop()?.toUpperCase() || '';
    const mime = mimeType?.toLowerCase() || '';
    if (mime.includes('pdf') || ext === 'PDF') return { bg: '#fee2e2', color: '#dc2626', label: 'PDF' };
    if (['DOC', 'DOCX'].includes(ext) || mime.includes('word')) return { bg: '#dbeafe', color: '#2563eb', label: ext || 'DOC' };
    if (['XLS', 'XLSX'].includes(ext) || mime.includes('sheet')) return { bg: '#dcfce7', color: '#16a34a', label: ext || 'XLS' };
    if (['PPT', 'PPTX'].includes(ext) || mime.includes('powerpoint')) return { bg: '#ffedd5', color: '#ea580c', label: ext || 'PPT' };
    if (['ZIP', 'RAR', '7Z'].includes(ext) || mime.includes('zip') || mime.includes('rar')) return { bg: '#f3e8ff', color: '#7c3aed', label: ext || 'ZIP' };
    if (mime.includes('audio')) return { bg: '#fef3c7', color: '#d97706', label: 'AUDIO' };
    return { bg: '#eef2f7', color: '#475569', label: ext || 'FILE' };
  };

  const renderFileItem = ({ item }: { item: any }) => {
    const accent = getFileAccent(item.name, item.mimeType);
    return (
      <TouchableOpacity 
        style={styles.fileItem}
        onPress={() => downloadAndOpenFile(item.dataUrl || item.url, item.name || 'file', item.mimeType)}
      >
        <View style={[styles.fileIconBox, { backgroundColor: accent.bg }]}>
          <Text style={[styles.fileIcon, { color: accent.color }]}>{getFileIcon(item.name, item.mimeType)}</Text>
          <Text style={[styles.fileExt, { color: accent.color }]} numberOfLines={1}>{accent.label}</Text>
        </View>
        <View style={styles.fileInfo}>
          <Text style={styles.fileName} numberOfLines={2}>{item.name || 'Tệp tin'}</Text>
          <Text style={styles.fileSize}>
            {formatBytes(item.size)} · {new Date(item.createdAt).toLocaleDateString('vi-VN')}
          </Text>
          {item.senderId && galleryData.senders.length > 1 && (
            <Text style={styles.fileSender}>{getSenderName(item.senderId)}</Text>
          )}
        </View>
        <View style={styles.downloadCircle}>
          <Text style={styles.downloadIcon}>download</Text>
        </View>
      </TouchableOpacity>
    );
  };

  const renderLinkItem = ({ item }: { item: any }) => (
    <TouchableOpacity 
      style={styles.linkItem}
      onPress={() => Linking.openURL(item.url)}
    >
      <View style={styles.linkIconBox}>
        <Text style={styles.linkIcon}>link</Text>
      </View>
      <View style={styles.linkInfo}>
        <Text style={styles.linkDomain} numberOfLines={1}>{getHostName(item.url)}</Text>
        <Text style={styles.linkUrl} numberOfLines={1}>{item.url}</Text>
        <Text style={styles.linkDate}>
          {new Date(item.createdAt).toLocaleDateString('vi-VN')}
          {item.senderId && galleryData.senders.length > 1 ? ` · ${getSenderName(item.senderId)}` : ''}
        </Text>
      </View>
      <Text style={styles.openIcon}>open_in_new</Text>
    </TouchableOpacity>
  );

  const getSenderName = (senderId: string) => {
    const normalized = String(senderId || '').replace(/^USER#/, '').trim().toLowerCase();
    const profile = userProfiles[normalized] || userProfiles[senderId];
    return profile?.nickname || profile?.fullName || profile?.fullname || normalized || senderId;
  };

  const getFilterLabel = () => {
    let label = '';
    if (filterSender) label += `Từ: ${getSenderName(filterSender)}`;
    if (dateFrom) {
      if (label) label += ' · ';
      label += `Từ: ${dateFrom.toLocaleDateString('vi-VN')}`;
    }
    if (dateTo) {
      if (label) label += ' · ';
      label += `Đến: ${dateTo.toLocaleDateString('vi-VN')}`;
    }
    return label;
  };

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={[styles.header, { paddingTop: insets.top }]}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Text style={styles.headerIcon}>arrow_back_ios</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Kho lưu trữ</Text>
        <TouchableOpacity onPress={() => setShowFilterMenu(!showFilterMenu)} style={styles.filterBtn}>
          <Text style={styles.headerIcon}>tune</Text>
        </TouchableOpacity>
      </View>

      {/* Filter Display */}
      {getFilterLabel() && (
        <View style={styles.filterDisplay}>
          <Text style={styles.filterText}>{getFilterLabel()}</Text>
          <TouchableOpacity onPress={() => {
            setFilterSender(null);
            setDateFrom(null);
            setDateTo(null);
          }}>
            <Text style={styles.clearFilterText}>Xóa bộ lọc</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* Tabs */}
      <View style={styles.tabBar}>
        <TouchableOpacity 
          style={[styles.tab, activeTab === 'media' && styles.activeTab]} 
          onPress={() => setActiveTab('media')}
        >
          <Text style={[styles.tabText, activeTab === 'media' && styles.activeTabText]}>Ảnh/Video</Text>
          <Text style={[styles.tabCount, activeTab === 'media' && styles.activeTabText]}>{galleryData.media.length}</Text>
        </TouchableOpacity>
        <TouchableOpacity 
          style={[styles.tab, activeTab === 'file' && styles.activeTab]} 
          onPress={() => setActiveTab('file')}
        >
          <Text style={[styles.tabText, activeTab === 'file' && styles.activeTabText]}>File</Text>
          <Text style={[styles.tabCount, activeTab === 'file' && styles.activeTabText]}>{galleryData.files.length}</Text>
        </TouchableOpacity>
        <TouchableOpacity 
          style={[styles.tab, activeTab === 'link' && styles.activeTab]} 
          onPress={() => setActiveTab('link')}
        >
          <Text style={[styles.tabText, activeTab === 'link' && styles.activeTabText]}>Link</Text>
          <Text style={[styles.tabCount, activeTab === 'link' && styles.activeTabText]}>{galleryData.links.length}</Text>
        </TouchableOpacity>
      </View>

      {/* Filter Menu Modal */}
      <Modal
        visible={showFilterMenu}
        transparent
        animationType="slide"
        onRequestClose={() => setShowFilterMenu(false)}
      >
        <View style={styles.filterMenuOverlay}>
          <View style={styles.filterMenuContent}>
            <View style={styles.filterMenuHeader}>
              <Text style={styles.filterMenuTitle}>Bộ lọc</Text>
              <TouchableOpacity onPress={() => setShowFilterMenu(false)}>
                <Text style={styles.filterMenuClose}>close</Text>
              </TouchableOpacity>
            </View>
            
            <ScrollView style={styles.filterMenuScroll}>
              {/* Sender Filter */}
              {galleryData.senders.length > 0 && (
                <View style={styles.filterSection}>
                  <Text style={styles.filterSectionTitle}>Lọc theo người gửi</Text>
                  <TouchableOpacity 
                    style={[styles.filterOption, !filterSender && styles.filterOptionActive]}
                    onPress={() => setFilterSender(null)}
                  >
                    <Text style={[styles.filterOptionText, !filterSender && styles.filterOptionTextActive]}>Tất cả</Text>
                  </TouchableOpacity>
                  {galleryData.senders.map((senderId: string) => (
                    <TouchableOpacity 
                      key={senderId}
                      style={[styles.filterOption, filterSender === senderId && styles.filterOptionActive]}
                      onPress={() => setFilterSender(senderId)}
                    >
                      <Text style={[styles.filterOptionText, filterSender === senderId && styles.filterOptionTextActive]}>
                        {getSenderName(senderId)}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              )}
              
              {/* Date Filter */}
              <View style={styles.filterSection}>
                <Text style={styles.filterSectionTitle}>Lọc theo ngày</Text>
                <TouchableOpacity 
                  style={styles.datePickerBtn}
                  onPress={() => {
                    const d = new Date();
                    d.setDate(d.getDate() - 7);
                    setDateFrom(d);
                  }}
                >
                  <Text style={styles.datePickerText}>
                    {dateFrom ? `Từ: ${dateFrom.toLocaleDateString('vi-VN')}` : 'Chọn ngày từ'}
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity 
                  style={styles.datePickerBtn}
                  onPress={() => setDateTo(new Date())}
                >
                  <Text style={styles.datePickerText}>
                    {dateTo ? `Đến: ${dateTo.toLocaleDateString('vi-VN')}` : 'Chọn ngày đến'}
                  </Text>
                </TouchableOpacity>
              </View>
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* Content */}
      <View style={styles.content}>
        {activeTab === 'media' && (
          <FlatList
            data={galleryData.media}
            renderItem={renderMediaItem}
            keyExtractor={(item, index) => `media-${index}`}
            numColumns={COLUMN_COUNT}
            contentContainerStyle={styles.mediaGrid}
            onEndReached={loadMore}
            onEndReachedThreshold={0.1}
            refreshing={archiveAssets.media.loading && galleryData.media.length === 0}
            onRefresh={() => fetchArchiveAssets(conversationId, 'media', true)}
            ListFooterComponent={renderFooter}
            ListEmptyComponent={<Text style={styles.emptyText}>{archiveAssets.media.loading ? 'Đang tải...' : 'Chưa có ảnh hoặc video'}</Text>}
          />
        )}
        {activeTab === 'file' && (
          <FlatList
            data={galleryData.files}
            renderItem={renderFileItem}
            keyExtractor={(item, index) => `file-${index}`}
            contentContainerStyle={styles.listPadding}
            onEndReached={loadMore}
            onEndReachedThreshold={0.1}
            refreshing={archiveAssets.file.loading && galleryData.files.length === 0}
            onRefresh={() => fetchArchiveAssets(conversationId, 'file', true)}
            ListFooterComponent={renderFooter}
            ListEmptyComponent={<Text style={styles.emptyText}>{archiveAssets.file.loading ? 'Đang tải...' : 'Chưa có tệp tin nào'}</Text>}
          />
        )}
        {activeTab === 'link' && (
          <FlatList
            data={galleryData.links}
            renderItem={renderLinkItem}
            keyExtractor={(item, index) => `link-${index}`}
            contentContainerStyle={styles.listPadding}
            onEndReached={loadMore}
            onEndReachedThreshold={0.1}
            refreshing={archiveAssets.link.loading && galleryData.links.length === 0}
            onRefresh={() => fetchArchiveAssets(conversationId, 'link', true)}
            ListFooterComponent={renderFooter}
            ListEmptyComponent={<Text style={styles.emptyText}>{archiveAssets.link.loading ? 'Đang tải...' : 'Chưa có đường dẫn nào'}</Text>}
          />
        )}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingBottom: 12,
    backgroundColor: Colors.primary,
  },
  backBtn: {
    padding: 8,
  },
  filterBtn: {
    padding: 8,
  },
  headerIcon: {
    fontFamily: 'Material Symbols Outlined',
    fontSize: 22,
    color: '#fff',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#fff',
    flex: 1,
    textAlign: 'center',
  },
  filterDisplay: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    backgroundColor: '#f0f9ff',
    borderBottomWidth: 1,
    borderBottomColor: '#e0f2fe',
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  filterText: {
    fontSize: 12,
    color: '#0369a1',
    flex: 1,
  },
  clearFilterText: {
    fontSize: 12,
    color: '#ef4444',
    fontWeight: '600',
  },
  filterMenuOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
  },
  filterMenuContent: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    maxHeight: '80%',
    marginTop: 'auto',
  },
  filterMenuHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#f1f5f9',
  },
  filterMenuTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#1f2631',
  },
  filterMenuClose: {
    fontFamily: 'Material Symbols Outlined',
    fontSize: 20,
    color: '#1f2631',
  },
  filterMenuScroll: {
    padding: 16,
  },
  filterSection: {
    marginBottom: 20,
  },
  filterSectionTitle: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#1f2631',
    marginBottom: 10,
  },
  filterOption: {
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 8,
    marginBottom: 8,
    backgroundColor: '#f1f5f9',
  },
  filterOptionActive: {
    backgroundColor: Colors.primary,
  },
  filterOptionText: {
    fontSize: 13,
    color: '#1f2631',
  },
  filterOptionTextActive: {
    color: '#fff',
    fontWeight: '600',
  },
  datePickerBtn: {
    paddingVertical: 12,
    paddingHorizontal: 12,
    borderRadius: 8,
    marginBottom: 10,
    backgroundColor: '#f1f5f9',
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  datePickerText: {
    fontSize: 13,
    color: '#1f2631',
  },
  tabBar: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderBottomColor: '#f1f5f9',
  },
  tab: {
    flex: 1,
    paddingVertical: 12,
    alignItems: 'center',
    borderBottomWidth: 2,
    borderBottomColor: 'transparent',
  },
  activeTab: {
    borderBottomColor: Colors.primary,
  },
  tabText: {
    fontSize: 13,
    fontWeight: 'bold',
    color: '#64748b',
  },
  tabCount: {
    fontSize: 11,
    color: '#94a3b8',
    marginTop: 2,
    fontWeight: '600',
  },
  activeTabText: {
    color: Colors.primary,
  },
  content: {
    flex: 1,
  },
  mediaGrid: {
    padding: 16,
    gap: 8,
  },
  mediaItem: {
    width: ITEM_SIZE,
    height: ITEM_SIZE,
    margin: 4,
    borderRadius: 8,
    overflow: 'hidden',
    backgroundColor: '#f1f5f9',
  },
  mediaThumb: {
    width: '100%',
    height: '100%',
  },
  mediaOverlay: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'flex-end',
  },
  playIconOverlay: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.2)',
  },
  playIcon: {
    fontFamily: 'Material Symbols Outlined',
    fontSize: 32,
    color: '#fff',
  },
  mediaMetadata: {
    backgroundColor: 'rgba(0,0,0,0.6)',
    paddingHorizontal: 6,
    paddingVertical: 4,
  },
  mediaDate: {
    fontSize: 10,
    color: '#fff',
    fontWeight: '500',
  },
  mediaSender: {
    fontSize: 9,
    color: '#cbd5e1',
  },
  listPadding: {
    padding: 16,
  },
  fileItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderWidth: 1,
    borderColor: '#eef2f7',
    borderRadius: 12,
    marginBottom: 10,
    backgroundColor: '#fff',
  },
  fileIconBox: {
    width: 50,
    height: 50,
    borderRadius: 12,
    backgroundColor: '#eff6ff',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  fileIcon: {
    fontFamily: 'Material Symbols Outlined',
    fontSize: 22,
    color: '#3b82f6',
  },
  fileExt: {
    fontSize: 8,
    fontWeight: '800',
    marginTop: -2,
  },
  fileInfo: {
    flex: 1,
    minWidth: 0,
  },
  fileName: {
    fontSize: 15,
    fontWeight: '700',
    color: '#1e293b',
    marginBottom: 4,
    flexShrink: 1,
  },
  fileSize: {
    fontSize: 12,
    color: '#64748b',
  },
  fileSender: {
    fontSize: 11,
    color: '#94a3b8',
    marginTop: 2,
  },
  downloadCircle: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: '#f8fafc',
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: 8,
  },
  downloadIcon: {
    fontFamily: 'Material Symbols Outlined',
    fontSize: 19,
    color: '#94a3b8',
  },
  linkItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderWidth: 1,
    borderColor: '#eef2f7',
    borderRadius: 12,
    marginBottom: 10,
    backgroundColor: '#fff',
  },
  linkIconBox: {
    width: 50,
    height: 50,
    borderRadius: 12,
    backgroundColor: '#e0f2fe',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  linkIcon: {
    fontFamily: 'Material Symbols Outlined',
    fontSize: 24,
    color: '#0369a1',
  },
  linkInfo: {
    flex: 1,
    minWidth: 0,
  },
  linkDomain: {
    fontSize: 15,
    color: '#0f172a',
    fontWeight: '700',
    marginBottom: 3,
  },
  linkUrl: {
    fontSize: 13,
    color: '#3b82f6',
    marginBottom: 5,
  },
  linkDate: {
    fontSize: 12,
    color: '#64748b',
  },
  openIcon: {
    fontFamily: 'Material Symbols Outlined',
    fontSize: 19,
    color: '#94a3b8',
    marginLeft: 8,
  },
  emptyText: {
    textAlign: 'center',
    marginTop: 40,
    color: '#94a3b8',
    fontSize: 14,
  },
  footerLoader: {
    paddingVertical: 20,
    alignItems: 'center',
    gap: 8,
  },
  footerLoaderText: {
    fontSize: 12,
    color: '#94a3b8',
  },
  loadMoreBtn: {
    paddingVertical: 15,
    alignItems: 'center',
    backgroundColor: '#f8fafc',
    marginHorizontal: 16,
    borderRadius: 8,
    marginTop: 10,
    marginBottom: 30,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  loadMoreText: {
    fontSize: 13,
    color: Colors.primary,
    fontWeight: '600',
  }
});

export default ChatGalleryScreen;
