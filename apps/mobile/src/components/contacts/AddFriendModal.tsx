import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Image,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import Alert from "../../utils/Alert";
import { chatGet, chatPost } from "../../utils/api";
import { useTheme } from "../../context/ThemeContext";
import {
  buildFriendSearchParams,
  getFriendAvatar,
  getFriendDisplayName,
  unpackFriendSearchResponse,
} from "../../utils/friendSearch";

type AddFriendModalProps = {
  visible: boolean;
  initialQuery?: string;
  onClose: () => void;
  onRequestSent?: () => void;
};

export default function AddFriendModal({
  visible,
  initialQuery = "",
  onClose,
  onRequestSent,
}: AddFriendModalProps) {
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const [query, setQuery] = useState(initialQuery);
  const [loading, setLoading] = useState(false);
  const [sending, setSending] = useState(false);
  const [result, setResult] = useState<any>(null);
  const [searched, setSearched] = useState(false);

  useEffect(() => {
    if (visible) {
      setQuery(initialQuery);
      setResult(null);
      setSearched(false);
      setLoading(false);
      setSending(false);
    }
  }, [initialQuery, visible]);

  const searchFriend = useCallback(async () => {
    const params = buildFriendSearchParams(query);
    if (!params) {
      Alert.alert("Thông báo", "Nhập email hoặc số điện thoại để tìm bạn.");
      return;
    }

    setLoading(true);
    setSearched(true);
    try {
      const res = await chatGet("/friends/search", params);
      const data = unpackFriendSearchResponse(res);
      setResult(data.found ? data : null);
    } catch (error) {
      Alert.alert("Lỗi", "Không thể tìm kiếm người dùng.");
    } finally {
      setLoading(false);
    }
  }, [query]);

  const sendRequest = useCallback(async () => {
    const targetEmail = String(result?.user?.email || "").toLowerCase();
    if (!targetEmail || sending) return;

    setSending(true);
    try {
      const res = await chatPost("/friends/request", { targetEmail });
      if (!res?.ok) throw new Error("REQUEST_FAILED");
      setResult((prev: any) => prev ? { ...prev, friendship: { ...(prev.friendship || {}), status: "pending" } } : prev);
      onRequestSent?.();
      Alert.alert("Thành công", "Đã gửi lời mời kết bạn.");
    } catch (error) {
      Alert.alert("Lỗi", "Không thể gửi lời mời kết bạn.");
    } finally {
      setSending(false);
    }
  }, [onRequestSent, result?.user?.email, sending]);

  const status = result?.friendship?.status;
  const canAdd = result?.user?.email && !result?.isSelf && status !== "accepted" && status !== "pending";
  const statusText = result?.isSelf
    ? "Bạn"
    : status === "accepted"
      ? "Bạn bè"
      : status === "pending"
        ? "Đã gửi"
        : "";

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={styles.overlay} onPress={onClose}>
        <KeyboardAvoidingView
          behavior={Platform.OS === "ios" ? "padding" : undefined}
          style={styles.keyboard}
        >
          <Pressable style={styles.card} onPress={() => {}}>
            <View style={styles.header}>
              <Text style={styles.title}>Thêm bạn</Text>
              <TouchableOpacity style={styles.closeBtn} onPress={onClose}>
                <Text style={styles.closeIcon}>close</Text>
              </TouchableOpacity>
            </View>

            <View style={styles.searchRow}>
              <Text style={styles.searchIcon}>search</Text>
              <TextInput
                value={query}
                onChangeText={setQuery}
                placeholder="Email hoặc số điện thoại"
                placeholderTextColor={colors.onSurfaceVariant}
                style={styles.input}
                autoCapitalize="none"
                autoCorrect={false}
                returnKeyType="search"
                onSubmitEditing={searchFriend}
              />
              <TouchableOpacity style={styles.searchBtn} onPress={searchFriend} disabled={loading}>
                {loading ? (
                  <ActivityIndicator color="#fff" size="small" />
                ) : (
                  <Text style={styles.searchBtnText}>Tìm</Text>
                )}
              </TouchableOpacity>
            </View>

            {result?.user ? (
              <View style={styles.resultRow}>
                <Image source={{ uri: getFriendAvatar(result.user) }} style={styles.avatar} />
                <View style={styles.userInfo}>
                  <Text style={styles.name} numberOfLines={1}>{getFriendDisplayName(result.user)}</Text>
                  <Text style={styles.email} numberOfLines={1}>{result.user.email}</Text>
                </View>
                {canAdd ? (
                  <TouchableOpacity style={styles.addBtn} onPress={sendRequest} disabled={sending}>
                    {sending ? (
                      <ActivityIndicator color="#fff" size="small" />
                    ) : (
                      <Text style={styles.addText}>Kết bạn</Text>
                    )}
                  </TouchableOpacity>
                ) : (
                  <Text style={styles.statusText}>{statusText}</Text>
                )}
              </View>
            ) : searched && !loading ? (
              <Text style={styles.emptyText}>Không tìm thấy người dùng.</Text>
            ) : (
              <Text style={styles.hintText}>Tìm bằng email hoặc số điện thoại giống trên web.</Text>
            )}
          </Pressable>
        </KeyboardAvoidingView>
      </Pressable>
    </Modal>
  );
}

const createStyles = (colors: any) => StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: "rgba(15,23,42,0.45)",
    justifyContent: "center",
    padding: 18,
  },
  keyboard: {
    width: "100%",
  },
  card: {
    backgroundColor: colors.surface,
    borderRadius: 16,
    padding: 16,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 14,
  },
  title: {
    fontSize: 18,
    fontWeight: "800",
    color: colors.onSurface,
  },
  closeBtn: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.surfaceVariant,
  },
  closeIcon: {
    fontFamily: "Material Symbols Outlined",
    fontSize: 20,
    color: colors.onSurface,
  },
  searchRow: {
    minHeight: 44,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.outlineVariant,
    flexDirection: "row",
    alignItems: "center",
    paddingLeft: 12,
    overflow: "hidden",
  },
  searchIcon: {
    fontFamily: "Material Symbols Outlined",
    fontSize: 20,
    color: colors.onSurfaceVariant,
    marginRight: 6,
  },
  input: {
    flex: 1,
    color: colors.onSurface,
    fontSize: 14,
    paddingVertical: 0,
  },
  searchBtn: {
    width: 64,
    alignSelf: "stretch",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#1f8fff",
  },
  searchBtnText: {
    color: "#fff",
    fontWeight: "700",
    fontSize: 13,
  },
  resultRow: {
    marginTop: 14,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    padding: 10,
    borderRadius: 12,
    backgroundColor: colors.surfaceContainer,
  },
  avatar: {
    width: 46,
    height: 46,
    borderRadius: 23,
    backgroundColor: colors.surfaceContainerHigh,
  },
  userInfo: {
    flex: 1,
  },
  name: {
    color: colors.onSurface,
    fontSize: 15,
    fontWeight: "700",
  },
  email: {
    color: colors.onSurfaceVariant,
    fontSize: 12,
    marginTop: 2,
  },
  addBtn: {
    minWidth: 76,
    height: 34,
    borderRadius: 9,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#1f8fff",
    paddingHorizontal: 10,
  },
  addText: {
    color: "#fff",
    fontWeight: "700",
    fontSize: 12,
  },
  statusText: {
    color: "#1f8fff",
    fontSize: 12,
    fontWeight: "700",
  },
  hintText: {
    marginTop: 14,
    color: colors.onSurfaceVariant,
    fontSize: 13,
  },
  emptyText: {
    marginTop: 14,
    color: colors.onSurfaceVariant,
    fontSize: 13,
    textAlign: "center",
  },
});
