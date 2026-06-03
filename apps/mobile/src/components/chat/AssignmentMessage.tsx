import * as DocumentPicker from "expo-document-picker";
import React, { useMemo, useState } from "react";
import {
  ActivityIndicator,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { Colors } from "../../constants/Theme";
import { useAuth } from "../../context/AuthContext";
import { useChatStore } from "../../store/chatStore";
import Alert from "../../utils/Alert";
import { chatDelete, chatPost, chatUpload } from "../../utils/api";
import { downloadAndOpenFile } from "../../utils/fileHelper";

interface AssignmentMessageProps {
  message: any;
  conversation?: any;
  userProfiles?: Record<string, any>;
}

const normalizeEmail = (email?: string | null) =>
  String(email || "").trim().toLowerCase();

const formatFileSize = (bytes?: number) => {
  if (!bytes) return "0 B";
  const units = ["B", "KB", "MB", "GB"];
  let value = bytes;
  let unitIndex = 0;
  while (value >= 1024 && unitIndex < units.length - 1) {
    value /= 1024;
    unitIndex += 1;
  }
  return `${value.toFixed(value >= 10 || unitIndex === 0 ? 0 : 1)} ${units[unitIndex]}`;
};

const getDisplayName = (
  email: string,
  currentUserEmail?: string | null,
  userProfiles?: Record<string, any>,
) => {
  const normalized = normalizeEmail(email);
  if (normalized === normalizeEmail(currentUserEmail)) return "Bạn";
  const profile = userProfiles?.[normalized] || userProfiles?.[email] || {};
  return profile?.nickname || profile?.fullName || profile?.fullname || normalized;
};

const getFileTypeLabels = (types: string[]) => {
  const labels: Record<string, string> = {
    any: "Tất cả",
    pdf: "PDF",
    doc: "Word/Tài liệu",
    sheet: "Excel/Sheet",
    image: "Hình ảnh",
    archive: "File nén",
  };
  return types.map((type) => labels[type] || type).join(", ");
};

const isAllowedFile = (file: any, allowedFileTypes: string[]) => {
  if (allowedFileTypes.includes("any")) return true;
  const name = String(file.name || "").toLowerCase();
  const mime = String(file.mimeType || file.type || "").toLowerCase();

  return allowedFileTypes.some((type) => {
    if (type === "pdf") return mime === "application/pdf" || name.endsWith(".pdf");
    if (type === "doc") {
      return (
        mime.includes("word") ||
        mime === "text/plain" ||
        name.endsWith(".doc") ||
        name.endsWith(".docx") ||
        name.endsWith(".txt")
      );
    }
    if (type === "sheet") {
      return (
        mime.includes("excel") ||
        mime.includes("spreadsheet") ||
        name.endsWith(".xls") ||
        name.endsWith(".xlsx") ||
        name.endsWith(".csv")
      );
    }
    if (type === "image") return mime.startsWith("image/");
    if (type === "archive") {
      return [".zip", ".rar", ".7z", ".tar", ".gz"].some((ext) =>
        name.endsWith(ext),
      );
    }
    return false;
  });
};

export default function AssignmentMessage({
  message,
  conversation,
  userProfiles = {},
}: AssignmentMessageProps) {
  const { user }: any = useAuth();
  const { activeConvId, updateMessage } = useChatStore();
  const [selectedFiles, setSelectedFiles] = useState<any[]>([]);
  const [note, setNote] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isDeletingSubmission, setIsDeletingSubmission] = useState(false);

  const assignment = message.payload?.assignment || message.assignment || {};
  const submissions = assignment.submissions || {};
  const myEmail = normalizeEmail(user?.email);
  const mySubmission = submissions[myEmail];

  const assignees: string[] = Array.isArray(assignment.assignees)
    ? assignment.assignees
    : [];
  const normalizedAssignees = assignees.map(normalizeEmail);
  const isAssignedToMe =
    normalizedAssignees.length === 0 || normalizedAssignees.includes(myEmail);
  const reviewMembers = assignees.length > 0 ? assignees : conversation?.members || [];
  const submittedCount = reviewMembers.filter(
    (email: string) => submissions[normalizeEmail(email)],
  ).length;

  const allowedFileTypes: string[] = Array.isArray(assignment.allowedFileTypes)
    ? assignment.allowedFileTypes
    : ["any"];
  const maxFiles = Number(assignment.maxFiles || 3);
  const maxFileSizeMB = Number(assignment.maxFileSizeMB || 10);
  const maxFileSizeBytes = maxFileSizeMB * 1024 * 1024;

  const deadline = useMemo(
    () => new Date(assignment.deadline),
    [assignment.deadline],
  );
  const isOverdue =
    Number.isFinite(deadline.getTime()) && deadline.getTime() < Date.now();

  const canReviewSubmissions =
    conversation?.type === "group" &&
    (normalizeEmail(conversation.owner || conversation.admin) === myEmail ||
      normalizeEmail(conversation.admin) === myEmail ||
      (conversation.deputies || []).some(
        (deputy: string) => normalizeEmail(deputy) === myEmail,
      ));
  const assignmentCreatorEmail = normalizeEmail(message.senderId);
  const canViewSubmissionFiles = (submitterEmail: string) =>
    assignmentCreatorEmail === myEmail || normalizeEmail(submitterEmail) === myEmail;

  const pickFiles = async () => {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: "*/*",
        copyToCacheDirectory: true,
        multiple: true,
      });
      if (result.canceled) return;

      const next = [...selectedFiles];
      for (const file of result.assets || []) {
        if (next.length >= maxFiles) {
          Alert.alert("Lỗi", `Chỉ được nộp tối đa ${maxFiles} file.`);
          break;
        }
        if ((file.size || 0) > maxFileSizeBytes) {
          Alert.alert("Lỗi", `File "${file.name}" vượt quá ${maxFileSizeMB}MB.`);
          continue;
        }
        if (!isAllowedFile(file, allowedFileTypes)) {
          Alert.alert("Lỗi", `File "${file.name}" không đúng loại được phép nộp.`);
          continue;
        }
        next.push(file);
      }
      setSelectedFiles(next);
    } catch (error) {
      Alert.alert("Lỗi", "Không thể chọn file.");
    }
  };

  const submitAssignment = async () => {
    const convId = activeConvId || conversation?.id || message.conversationId;
    if (!convId || !message.id) return;
    if (selectedFiles.length === 0) {
      Alert.alert("Lỗi", "Vui lòng chọn file bài làm để nộp.");
      return;
    }

    setIsSubmitting(true);
    try {
      const uploadedAttachments = [];
      for (const file of selectedFiles) {
        const res = await chatUpload({
          uri: file.uri,
          name: file.name,
          mimeType: file.mimeType || file.type || "application/octet-stream",
          type: file.mimeType || file.type || "application/octet-stream",
          size: file.size || 0,
        });
        if (!res.ok) throw new Error(res.message || "Upload failed");
        const data = res.data || res;
        uploadedAttachments.push({
          name: data.name || file.name,
          mimeType: data.mimeType || file.mimeType || "application/octet-stream",
          size: data.size || file.size || 0,
          url: data.fileUrl || data.url || data.dataUrl,
          dataUrl: data.fileUrl || data.url || data.dataUrl,
        });
      }

      const res = await chatPost(
        `/conversations/${encodeURIComponent(convId)}/messages/${encodeURIComponent(message.id)}/assignment/submit`,
        { note: note.trim(), attachments: uploadedAttachments },
      );
      if (!res.ok) throw new Error(res.message || "Submit failed");
      updateMessage(message.id, res.data);
      setSelectedFiles([]);
      setNote("");
      Alert.alert("Thành công", "Đã nộp bài.");
    } catch (error: any) {
      Alert.alert("Lỗi", error?.message || "Không thể nộp bài.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const deleteMySubmission = async () => {
    const convId = activeConvId || conversation?.id || message.conversationId;
    if (!convId || !message.id || isOverdue) return;

    setIsDeletingSubmission(true);
    try {
      const res = await chatDelete(
        `/conversations/${encodeURIComponent(convId)}/messages/${encodeURIComponent(message.id)}/assignment/submission`,
      );
      if (!res.ok) throw new Error(res.message || "Delete failed");
      updateMessage(message.id, res.data);
      setSelectedFiles([]);
      setNote("");
      Alert.alert("Thành công", "Đã xóa bài nộp. Bạn có thể nộp lại trước deadline.");
    } catch (error: any) {
      Alert.alert("Lỗi", error?.message || "Không thể xóa bài nộp.");
    } finally {
      setIsDeletingSubmission(false);
    }
  };

  const openFile = (file: any) => {
    const url = file.url || file.dataUrl || file.fileUrl;
    if (!url) return;
    downloadAndOpenFile(url, file.name || "Bài nộp", file.mimeType);
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.label}>Bài tập</Text>
        <Text style={styles.title}>{assignment.title || "Bài tập mới"}</Text>
      </View>

      {!!assignment.description && (
        <Text style={styles.description}>{assignment.description}</Text>
      )}

      <View style={[styles.deadlineBox, isOverdue && styles.deadlineOverdue]}>
        <Text style={[styles.deadlineText, isOverdue && styles.deadlineTextOverdue]}>
          Deadline:{" "}
          {Number.isFinite(deadline.getTime())
            ? deadline.toLocaleString("vi-VN", {
                dateStyle: "medium",
                timeStyle: "short",
              })
            : "Chưa đặt"}
        </Text>
      </View>

      <View style={styles.ruleBox}>
        <Text style={styles.ruleText}>
          Loại file: {getFileTypeLabels(allowedFileTypes)}
        </Text>
        <Text style={styles.ruleText}>
          Tối đa {maxFiles} file, {maxFileSizeMB}MB/file
        </Text>
      </View>

      {canReviewSubmissions && (
        <View style={styles.reviewBox}>
          <View style={styles.reviewHeader}>
            <Text style={styles.reviewTitle}>Bài đã nộp</Text>
            <Text style={styles.reviewCount}>
              {submittedCount}/{reviewMembers.length || 0}
            </Text>
          </View>
          <ScrollView style={styles.reviewList} nestedScrollEnabled>
            {reviewMembers.map((email: string) => {
              const normalized = normalizeEmail(email);
              const submission = submissions[normalized];
              const files = Array.isArray(submission?.attachments)
                ? submission.attachments
                : [];

              return (
                <View key={normalized} style={styles.reviewItem}>
                  <View style={styles.reviewItemHeader}>
                    <Text style={styles.memberName} numberOfLines={1}>
                      {getDisplayName(email, user?.email, userProfiles)}
                    </Text>
                    <Text
                      style={[
                        styles.statusBadge,
                        submission
                          ? styles.statusSubmitted
                          : isOverdue
                            ? styles.statusOverdue
                            : styles.statusPending,
                      ]}
                    >
                      {submission ? "Đã nộp" : isOverdue ? "Quá hạn" : "Chưa nộp"}
                    </Text>
                  </View>
                  {submission && (
                    <View style={styles.submissionBody}>
                      <Text style={styles.submittedAt}>
                        {new Date(submission.submittedAt).toLocaleString("vi-VN", {
                          dateStyle: "medium",
                          timeStyle: "short",
                        })}
                      </Text>
                      {!!submission.note && (
                        <Text style={styles.noteText}>{submission.note}</Text>
                      )}
                      {canViewSubmissionFiles(email) ? (
                        files.map((file: any, index: number) => (
                          <TouchableOpacity
                            key={`${normalized}-${index}`}
                            style={styles.fileRow}
                            onPress={() => openFile(file)}
                          >
                            <Text style={styles.fileIcon}>description</Text>
                            <Text style={styles.fileName} numberOfLines={1}>
                              {file.name || "Bài nộp"}
                            </Text>
                            <Text style={styles.fileSize}>{formatFileSize(file.size)}</Text>
                          </TouchableOpacity>
                        ))
                      ) : (
                        <Text style={styles.privateFileText}>
                          File chỉ hiển thị với người nộp và người giao bài.
                        </Text>
                      )}
                    </View>
                  )}
                </View>
              );
            })}
          </ScrollView>
        </View>
      )}

      {mySubmission ? (
        <View style={styles.doneBox}>
          <Text style={styles.doneText}>
            Bạn đã nộp lúc{" "}
            {new Date(mySubmission.submittedAt).toLocaleString("vi-VN", {
              dateStyle: "medium",
              timeStyle: "short",
            })}
          </Text>
          {(mySubmission.attachments || []).map((file: any, index: number) => (
            <TouchableOpacity
              key={index}
              style={styles.fileRow}
              onPress={() => openFile(file)}
            >
              <Text style={styles.fileIcon}>description</Text>
              <Text style={styles.fileName} numberOfLines={1}>
                {file.name || "Bài nộp"}
              </Text>
            </TouchableOpacity>
          ))}
          {!isOverdue && (
            <TouchableOpacity
              style={[styles.deleteSubmissionButton, isDeletingSubmission && styles.disabled]}
              disabled={isDeletingSubmission}
              onPress={deleteMySubmission}
            >
              {isDeletingSubmission ? (
                <ActivityIndicator color="#ef4444" size="small" />
              ) : (
                <Text style={styles.deleteSubmissionText}>
                  Xóa bài nộp để nộp lại
                </Text>
              )}
            </TouchableOpacity>
          )}
        </View>
      ) : isAssignedToMe ? (
        <View style={styles.submitBox}>
          <TouchableOpacity style={styles.pickButton} onPress={pickFiles}>
            <Text style={styles.pickButtonText}>Chọn file bài làm</Text>
          </TouchableOpacity>

          {selectedFiles.map((file, index) => (
            <View key={`${file.name}-${index}`} style={styles.selectedFileRow}>
              <Text style={styles.fileName} numberOfLines={1}>
                {file.name}
              </Text>
              <Text style={styles.fileSize}>{formatFileSize(file.size)}</Text>
              <TouchableOpacity
                onPress={() =>
                  setSelectedFiles((prev) => prev.filter((_, i) => i !== index))
                }
              >
                <Text style={styles.removeText}>X</Text>
              </TouchableOpacity>
            </View>
          ))}

          <TextInput
            value={note}
            onChangeText={(value) => setNote(value.slice(0, 300))}
            placeholder="Ghi chú nộp bài..."
            placeholderTextColor="#94a3b8"
            style={styles.noteInput}
            multiline
          />

          <TouchableOpacity
            style={[styles.submitButton, (isSubmitting || isOverdue) && styles.disabled]}
            disabled={isSubmitting || isOverdue}
            onPress={submitAssignment}
          >
            {isSubmitting ? (
              <ActivityIndicator color="#fff" size="small" />
            ) : (
              <Text style={styles.submitButtonText}>
                {isOverdue ? "Đã quá hạn" : "Nộp bài"}
              </Text>
            )}
          </TouchableOpacity>
        </View>
      ) : (
        <View style={styles.notAssignedBox}>
          <Text style={styles.notAssignedText}>
            Bạn không nằm trong danh sách được giao bài tập này.
          </Text>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: "#fff",
    borderColor: "#bfdbfe",
    borderRadius: 16,
    borderWidth: 1,
    marginVertical: 4,
    overflow: "hidden",
    width: "100%",
  },
  header: {
    backgroundColor: "#eff6ff",
    borderBottomColor: "#dbeafe",
    borderBottomWidth: 1,
    padding: 14,
  },
  label: {
    color: Colors.primary,
    fontSize: 11,
    fontWeight: "900",
    letterSpacing: 1,
    marginBottom: 4,
    textTransform: "uppercase",
  },
  title: {
    color: "#1e293b",
    fontSize: 17,
    fontWeight: "900",
  },
  description: {
    color: "#334155",
    fontSize: 13,
    fontWeight: "600",
    lineHeight: 19,
    paddingHorizontal: 14,
    paddingTop: 12,
  },
  deadlineBox: {
    backgroundColor: "#fffbeb",
    borderRadius: 10,
    marginHorizontal: 14,
    marginTop: 12,
    padding: 10,
  },
  deadlineOverdue: {
    backgroundColor: "#fff1f2",
  },
  deadlineText: {
    color: "#b45309",
    fontSize: 12,
    fontWeight: "900",
  },
  deadlineTextOverdue: {
    color: "#be123c",
  },
  ruleBox: {
    backgroundColor: "#f8fafc",
    borderRadius: 10,
    marginHorizontal: 14,
    marginTop: 10,
    padding: 10,
  },
  ruleText: {
    color: "#64748b",
    fontSize: 12,
    fontWeight: "800",
  },
  reviewBox: {
    backgroundColor: "#ecfdf5",
    borderColor: "#bbf7d0",
    borderRadius: 12,
    borderWidth: 1,
    margin: 14,
    padding: 10,
  },
  reviewHeader: {
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 8,
  },
  reviewTitle: {
    color: "#047857",
    fontSize: 13,
    fontWeight: "900",
  },
  reviewCount: {
    backgroundColor: "#fff",
    borderRadius: 999,
    color: "#047857",
    fontSize: 12,
    fontWeight: "900",
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  reviewList: {
    maxHeight: 260,
  },
  reviewItem: {
    backgroundColor: "rgba(255,255,255,0.8)",
    borderRadius: 10,
    marginBottom: 8,
    padding: 9,
  },
  reviewItemHeader: {
    alignItems: "center",
    flexDirection: "row",
    gap: 8,
    justifyContent: "space-between",
  },
  memberName: {
    color: "#0f172a",
    flex: 1,
    fontSize: 12,
    fontWeight: "900",
  },
  statusBadge: {
    borderRadius: 999,
    fontSize: 10,
    fontWeight: "900",
    overflow: "hidden",
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  statusSubmitted: {
    backgroundColor: "#dcfce7",
    color: "#15803d",
  },
  statusPending: {
    backgroundColor: "#fef3c7",
    color: "#b45309",
  },
  statusOverdue: {
    backgroundColor: "#ffe4e6",
    color: "#be123c",
  },
  submissionBody: {
    marginTop: 6,
    gap: 6,
  },
  submittedAt: {
    color: "#64748b",
    fontSize: 10,
    fontWeight: "800",
  },
  noteText: {
    backgroundColor: "#f8fafc",
    borderRadius: 8,
    color: "#334155",
    fontSize: 11,
    fontWeight: "600",
    padding: 7,
  },
  privateFileText: {
    backgroundColor: "#f8fafc",
    borderRadius: 8,
    color: "#64748b",
    fontSize: 11,
    fontWeight: "800",
    padding: 8,
  },
  fileRow: {
    alignItems: "center",
    backgroundColor: "#fff",
    borderColor: "#d1fae5",
    borderRadius: 8,
    borderWidth: 1,
    flexDirection: "row",
    gap: 7,
    paddingHorizontal: 8,
    paddingVertical: 7,
  },
  fileIcon: {
    color: Colors.primary,
    fontFamily: "Material Symbols Outlined",
    fontSize: 17,
  },
  fileName: {
    color: "#334155",
    flex: 1,
    fontSize: 12,
    fontWeight: "800",
  },
  fileSize: {
    color: "#64748b",
    fontSize: 10,
    fontWeight: "800",
  },
  doneBox: {
    backgroundColor: "#ecfdf5",
    borderRadius: 12,
    margin: 14,
    padding: 10,
    gap: 7,
  },
  doneText: {
    color: "#047857",
    fontSize: 12,
    fontWeight: "900",
  },
  deleteSubmissionButton: {
    alignItems: "center",
    backgroundColor: "#fff",
    borderColor: "#fecdd3",
    borderRadius: 10,
    borderWidth: 1,
    justifyContent: "center",
    minHeight: 40,
    padding: 10,
  },
  deleteSubmissionText: {
    color: "#e11d48",
    fontSize: 12,
    fontWeight: "900",
  },
  submitBox: {
    gap: 8,
    padding: 14,
  },
  pickButton: {
    alignItems: "center",
    backgroundColor: "#eff6ff",
    borderColor: "#bfdbfe",
    borderRadius: 10,
    borderWidth: 1,
    padding: 11,
  },
  pickButtonText: {
    color: Colors.primary,
    fontSize: 13,
    fontWeight: "900",
  },
  selectedFileRow: {
    alignItems: "center",
    backgroundColor: "#f8fafc",
    borderRadius: 9,
    flexDirection: "row",
    gap: 8,
    padding: 9,
  },
  removeText: {
    color: "#ef4444",
    fontSize: 12,
    fontWeight: "900",
  },
  noteInput: {
    backgroundColor: "#fff",
    borderColor: "#e2e8f0",
    borderRadius: 10,
    borderWidth: 1,
    color: "#0f172a",
    minHeight: 70,
    padding: 10,
    textAlignVertical: "top",
  },
  submitButton: {
    alignItems: "center",
    backgroundColor: Colors.primary,
    borderRadius: 10,
    minHeight: 44,
    justifyContent: "center",
    padding: 12,
  },
  submitButtonText: {
    color: "#fff",
    fontSize: 14,
    fontWeight: "900",
  },
  disabled: {
    opacity: 0.55,
  },
  notAssignedBox: {
    backgroundColor: "#f8fafc",
    borderRadius: 10,
    margin: 14,
    padding: 10,
  },
  notAssignedText: {
    color: "#64748b",
    fontSize: 12,
    fontWeight: "800",
  },
});
