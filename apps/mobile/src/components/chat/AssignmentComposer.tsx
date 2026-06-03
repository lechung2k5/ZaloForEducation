import React, { useMemo, useState } from "react";
import {
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { Colors } from "../../constants/Theme";
import Alert from "../../utils/Alert";

interface AssignmentComposerProps {
  members: string[];
  currentUserEmail?: string | null;
  userProfiles?: Record<string, any>;
  onClose: () => void;
  onCreate: (assignment: {
    title: string;
    description?: string;
    deadline: string;
    assignees: string[];
    allowedFileTypes: string[];
    maxFiles: number;
    maxFileSizeMB: number;
  }) => void;
}

const fileTypeOptions = [
  { key: "pdf", label: "PDF" },
  { key: "doc", label: "Word" },
  { key: "sheet", label: "Excel" },
  { key: "image", label: "Ảnh" },
  { key: "archive", label: "Nén" },
  { key: "any", label: "Tất cả" },
];

const pad2 = (value: number) => String(value).padStart(2, "0");

const getDefaultDeadline = () => {
  const date = new Date(Date.now() + 24 * 60 * 60 * 1000);
  return `${date.getFullYear()}-${pad2(date.getMonth() + 1)}-${pad2(date.getDate())}T${pad2(date.getHours())}:${pad2(date.getMinutes())}`;
};

const normalizeEmail = (email?: string | null) =>
  String(email || "").trim().toLowerCase();

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

export default function AssignmentComposer({
  members,
  currentUserEmail,
  userProfiles,
  onClose,
  onCreate,
}: AssignmentComposerProps) {
  const assigneeOptions = useMemo(
    () =>
      members
        .map(normalizeEmail)
        .filter(
          (email, index, arr) =>
            email && email !== normalizeEmail(currentUserEmail) && arr.indexOf(email) === index,
        ),
    [members, currentUserEmail],
  );

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [deadline, setDeadline] = useState(getDefaultDeadline());
  const [assignees, setAssignees] = useState<string[]>(assigneeOptions);
  const [allowedFileTypes, setAllowedFileTypes] = useState<string[]>([
    "pdf",
    "doc",
    "image",
  ]);
  const [maxFiles, setMaxFiles] = useState("3");

  const toggleAssignee = (email: string) => {
    setAssignees((prev) =>
      prev.includes(email) ? prev.filter((item) => item !== email) : [...prev, email],
    );
  };

  const toggleFileType = (type: string) => {
    setAllowedFileTypes((prev) => {
      if (type === "any") return prev.includes("any") ? ["pdf", "doc", "image"] : ["any"];
      const withoutAny = prev.filter((item) => item !== "any");
      return withoutAny.includes(type)
        ? withoutAny.filter((item) => item !== type)
        : [...withoutAny, type];
    });
  };

  const handleCreate = () => {
    const normalizedTitle = title.trim();
    const parsedMaxFiles = Math.min(10, Math.max(1, Number(maxFiles) || 1));
    const deadlineDate = new Date(deadline);

    if (!normalizedTitle) {
      Alert.alert("Lỗi", "Vui lòng nhập tiêu đề bài tập.");
      return;
    }
    if (!Number.isFinite(deadlineDate.getTime())) {
      Alert.alert("Lỗi", "Deadline không hợp lệ. Dùng dạng YYYY-MM-DDTHH:mm.");
      return;
    }
    if (assignees.length === 0) {
      Alert.alert("Lỗi", "Vui lòng chọn ít nhất một người nhận.");
      return;
    }
    if (allowedFileTypes.length === 0) {
      Alert.alert("Lỗi", "Vui lòng chọn loại file được phép nộp.");
      return;
    }

    onCreate({
      title: normalizedTitle,
      description: description.trim(),
      deadline: deadlineDate.toISOString(),
      assignees,
      allowedFileTypes,
      maxFiles: parsedMaxFiles,
      maxFileSizeMB: 10,
    });
    onClose();
  };

  return (
    <View style={styles.card}>
      <ScrollView showsVerticalScrollIndicator={false}>
        <Text style={styles.title}>Giao bài tập</Text>

        <Text style={styles.label}>Tiêu đề</Text>
        <TextInput
          value={title}
          onChangeText={setTitle}
          placeholder="Nhập tiêu đề bài tập"
          placeholderTextColor="#94a3b8"
          style={styles.input}
        />

        <Text style={[styles.label, { marginTop: 12 }]}>Mô tả</Text>
        <TextInput
          value={description}
          onChangeText={setDescription}
          placeholder="Yêu cầu, nội dung bài tập..."
          placeholderTextColor="#94a3b8"
          style={[styles.input, styles.textarea]}
          multiline
        />

        <Text style={[styles.label, { marginTop: 12 }]}>Deadline</Text>
        <TextInput
          value={deadline}
          onChangeText={setDeadline}
          placeholder="YYYY-MM-DDTHH:mm"
          placeholderTextColor="#94a3b8"
          style={styles.input}
        />

        <Text style={[styles.label, { marginTop: 12 }]}>Người nhận</Text>
        <View style={styles.chipWrap}>
          {assigneeOptions.map((email) => {
            const selected = assignees.includes(email);
            return (
              <TouchableOpacity
                key={email}
                style={[styles.chip, selected && styles.chipActive]}
                onPress={() => toggleAssignee(email)}
              >
                <Text style={[styles.chipText, selected && styles.chipTextActive]}>
                  {getDisplayName(email, currentUserEmail, userProfiles)}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>

        <Text style={[styles.label, { marginTop: 12 }]}>Loại file được nộp</Text>
        <View style={styles.chipWrap}>
          {fileTypeOptions.map((option) => {
            const selected = allowedFileTypes.includes(option.key);
            return (
              <TouchableOpacity
                key={option.key}
                style={[styles.chip, selected && styles.chipActive]}
                onPress={() => toggleFileType(option.key)}
              >
                <Text style={[styles.chipText, selected && styles.chipTextActive]}>
                  {option.label}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>

        <Text style={[styles.label, { marginTop: 12 }]}>Số lượng file tối đa</Text>
        <TextInput
          value={maxFiles}
          onChangeText={setMaxFiles}
          keyboardType="number-pad"
          style={styles.input}
        />
        <Text style={styles.hint}>Kích thước tối đa: 10MB/file</Text>
      </ScrollView>

      <View style={styles.footer}>
        <TouchableOpacity style={styles.btnSecondary} onPress={onClose}>
          <Text style={styles.btnSecondaryText}>Hủy</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.btnPrimary} onPress={handleCreate}>
          <Text style={styles.btnPrimaryText}>Giao bài</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: "#fff",
    borderRadius: 18,
    maxHeight: 620,
    padding: 16,
  },
  title: {
    color: "#0f172a",
    fontSize: 18,
    fontWeight: "900",
    marginBottom: 14,
  },
  label: {
    color: "#64748b",
    fontSize: 12,
    fontWeight: "800",
    marginBottom: 6,
    textTransform: "uppercase",
  },
  input: {
    backgroundColor: "#f8fafc",
    borderColor: "#e2e8f0",
    borderRadius: 12,
    borderWidth: 1,
    color: "#0f172a",
    paddingHorizontal: 12,
    paddingVertical: 11,
  },
  textarea: {
    minHeight: 86,
    textAlignVertical: "top",
  },
  chipWrap: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  chip: {
    backgroundColor: "#fff",
    borderColor: "#dbe3ee",
    borderRadius: 999,
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  chipActive: {
    backgroundColor: Colors.primary,
    borderColor: Colors.primary,
  },
  chipText: {
    color: "#475569",
    fontSize: 12,
    fontWeight: "800",
  },
  chipTextActive: {
    color: "#fff",
  },
  hint: {
    color: "#64748b",
    fontSize: 12,
    fontWeight: "700",
    marginTop: 6,
  },
  footer: {
    flexDirection: "row",
    gap: 12,
    marginTop: 14,
  },
  btnSecondary: {
    alignItems: "center",
    borderColor: Colors.primary,
    borderRadius: 12,
    borderWidth: 1,
    flex: 1,
    height: 46,
    justifyContent: "center",
  },
  btnSecondaryText: {
    color: Colors.primary,
    fontWeight: "900",
  },
  btnPrimary: {
    alignItems: "center",
    backgroundColor: Colors.primary,
    borderRadius: 12,
    flex: 1.2,
    height: 46,
    justifyContent: "center",
  },
  btnPrimaryText: {
    color: "#fff",
    fontWeight: "900",
  },
});
