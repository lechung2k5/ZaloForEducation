import React, { useEffect, useMemo, useState } from "react";
import { CalendarClock, ClipboardList, X } from "lucide-react";
import Swal from "sweetalert2";
import { getDisplayName } from "../../utils/chatUtils";

interface AssignmentModalProps {
  isOpen: boolean;
  onClose: () => void;
  members: string[];
  currentUser: any;
  userProfiles: Record<string, any>;
  onSendAssignment: (assignment: {
    title: string;
    description?: string;
    deadline: string;
    assignees: string[];
    allowedFileTypes: string[];
    maxFiles: number;
    maxFileSizeMB: number;
  }) => Promise<void>;
}

const AssignmentModal: React.FC<AssignmentModalProps> = ({
  isOpen,
  onClose,
  members,
  currentUser,
  userProfiles,
  onSendAssignment,
}) => {
  const tomorrow = useMemo(() => {
    const date = new Date(Date.now() + 24 * 60 * 60 * 1000);
    date.setMinutes(0, 0, 0);
    return date.toISOString().slice(0, 16);
  }, []);

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [deadline, setDeadline] = useState(tomorrow);
  const [selectedAssignees, setSelectedAssignees] = useState<string[]>([]);
  const [allowedFileTypes, setAllowedFileTypes] = useState<string[]>([
    "pdf",
    "doc",
    "image",
  ]);
  const [maxFiles, setMaxFiles] = useState(3);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const assignableMembers = useMemo(
    () =>
      members
        .map((email) => String(email || "").trim().toLowerCase())
        .filter((email) => email && email !== String(currentUser?.email || "").toLowerCase()),
    [members, currentUser?.email],
  );

  useEffect(() => {
    if (!isOpen) return;
    setTitle("");
    setDescription("");
    setDeadline(tomorrow);
    setSelectedAssignees(assignableMembers);
    setAllowedFileTypes(["pdf", "doc", "image"]);
    setMaxFiles(3);
    setIsSubmitting(false);
  }, [isOpen, tomorrow, assignableMembers]);

  const toggleAssignee = (email: string) => {
    setSelectedAssignees((prev) =>
      prev.includes(email)
        ? prev.filter((item) => item !== email)
        : [...prev, email],
    );
  };

  const handleSubmit = async () => {
    if (!title.trim()) {
      Swal.fire("Lỗi", "Vui lòng nhập tiêu đề bài tập.", "error");
      return;
    }

    const deadlineDate = new Date(deadline);
    if (!deadline || deadlineDate.getTime() <= Date.now()) {
      Swal.fire("Lỗi", "Deadline phải là thời điểm trong tương lai.", "error");
      return;
    }

    if (selectedAssignees.length === 0) {
      Swal.fire("Lỗi", "Vui lòng chọn ít nhất một người nhận bài tập.", "error");
      return;
    }

    if (allowedFileTypes.length === 0) {
      Swal.fire("Lỗi", "Vui lòng chọn ít nhất một loại file được phép nộp.", "error");
      return;
    }

    if (maxFiles < 1 || maxFiles > 10) {
      Swal.fire("Lỗi", "Số lượng file cho phép phải từ 1 đến 10.", "error");
      return;
    }

    setIsSubmitting(true);
    try {
      await onSendAssignment({
        title: title.trim(),
        description: description.trim() || undefined,
        deadline: deadlineDate.toISOString(),
        assignees: selectedAssignees,
        allowedFileTypes,
        maxFiles,
        maxFileSizeMB: 10,
      });
      onClose();
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-150 flex items-center justify-center bg-black/40 backdrop-blur-sm animate-in fade-in">
      <div className="w-full max-w-2xl overflow-hidden rounded-md border border-outline-variant/20 bg-white shadow-2xl animate-in zoom-in-95 duration-200">
        <div className="flex items-center justify-between border-b border-outline-variant/20 px-5 py-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-md bg-primary/10 text-primary">
              <ClipboardList size={20} />
            </div>
            <div>
              <h2 className="text-[18px] font-extrabold text-[#1f2f4a]">
                Giao bài tập
              </h2>
              <p className="text-[12px] font-medium text-on-surface-variant">
                Bài tập sẽ được gửi trực tiếp vào nhóm chat.
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="flex h-8 w-8 items-center justify-center rounded-full hover:bg-surface-container-high transition-colors"
            type="button"
          >
            <X size={20} className="text-on-surface-variant" />
          </button>
        </div>

        <div className="grid gap-5 p-5 md:grid-cols-[1.15fr_0.85fr]">
          <div className="space-y-4">
            <div className="space-y-2">
              <label className="text-[13px] font-bold text-on-surface">
                Tiêu đề bài tập
              </label>
              <input
                value={title}
                onChange={(e) => setTitle(e.target.value.slice(0, 120))}
                placeholder="Ví dụ: Nộp báo cáo chương 3"
                maxLength={120}
                className="w-full rounded-md border border-[#98b5eb] bg-white px-4 py-3 text-[14px] outline-none transition-all focus:ring-2 focus:ring-primary/20"
              />
            </div>

            <div className="space-y-2">
              <label className="text-[13px] font-bold text-on-surface">
                Mô tả / yêu cầu
              </label>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value.slice(0, 800))}
                placeholder="Nhập nội dung yêu cầu, tiêu chí nộp bài hoặc tài liệu cần chuẩn bị..."
                rows={7}
                maxLength={800}
                className="w-full resize-none rounded-md border border-outline-variant/20 bg-white px-4 py-3 text-[14px] outline-none transition-all focus:ring-2 focus:ring-primary/20"
              />
              <p className="text-[11px] text-on-surface-variant">
                {description.length}/800
              </p>
            </div>

            <div className="space-y-2">
              <label className="text-[13px] font-bold text-on-surface">
                Deadline
              </label>
              <div className="flex items-center gap-2 rounded-md border border-outline-variant/20 bg-white px-3 py-2.5">
                <CalendarClock size={17} className="text-primary" />
                <input
                  type="datetime-local"
                  value={deadline}
                  onChange={(e) => setDeadline(e.target.value)}
                  className="flex-1 bg-transparent text-[14px] outline-none"
                />
              </div>
            </div>

            <div className="space-y-3 rounded-md border border-outline-variant/20 bg-surface-container-low/30 p-3">
              <div className="flex items-center justify-between gap-3">
                <label className="text-[13px] font-bold text-on-surface">
                  Quy định file nộp
                </label>
                <span className="text-[11px] font-bold text-rose-600">
                  Tối đa 10MB/file
                </span>
              </div>

              <div className="grid grid-cols-2 gap-2">
                {[
                  { value: "pdf", label: "PDF" },
                  { value: "doc", label: "Word/Tài liệu" },
                  { value: "sheet", label: "Excel/Sheet" },
                  { value: "image", label: "Hình ảnh" },
                  { value: "archive", label: "File nén" },
                  { value: "any", label: "Tất cả" },
                ].map((item) => {
                  const checked = allowedFileTypes.includes(item.value);
                  return (
                    <button
                      key={item.value}
                      type="button"
                      onClick={() => {
                        if (item.value === "any") {
                          setAllowedFileTypes(["any"]);
                          return;
                        }
                        setAllowedFileTypes((prev) => {
                          const withoutAny = prev.filter((value) => value !== "any");
                          return withoutAny.includes(item.value)
                            ? withoutAny.filter((value) => value !== item.value)
                            : [...withoutAny, item.value];
                        });
                      }}
                      className={`rounded-md border px-3 py-2 text-left text-[12px] font-bold transition-colors ${
                        checked
                          ? "border-primary bg-primary/10 text-primary"
                          : "border-outline-variant/20 bg-white text-on-surface hover:bg-surface-container"
                      }`}
                    >
                      {item.label}
                    </button>
                  );
                })}
              </div>

              <div className="space-y-1">
                <label className="text-[12px] font-bold text-on-surface-variant">
                  Số lượng file tối đa
                </label>
                <input
                  type="number"
                  min={1}
                  max={10}
                  value={maxFiles}
                  onChange={(e) =>
                    setMaxFiles(Math.max(1, Math.min(10, Number(e.target.value) || 1)))
                  }
                  className="w-full rounded-md border border-outline-variant/20 bg-white px-3 py-2 text-[13px] outline-none focus:ring-2 focus:ring-primary/20"
                />
              </div>
            </div>
          </div>

          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <label className="text-[13px] font-bold text-on-surface">
                Người nhận
              </label>
              <button
                type="button"
                onClick={() =>
                  setSelectedAssignees(
                    selectedAssignees.length === assignableMembers.length
                      ? []
                      : assignableMembers,
                  )
                }
                className="text-[12px] font-bold text-primary hover:underline"
              >
                {selectedAssignees.length === assignableMembers.length
                  ? "Bỏ chọn tất cả"
                  : "Chọn tất cả"}
              </button>
            </div>

            <div className="max-h-[350px] space-y-2 overflow-y-auto rounded-md border border-outline-variant/20 bg-surface-container-low/40 p-2">
              {assignableMembers.map((email) => {
                const selected = selectedAssignees.includes(email);
                return (
                  <button
                    key={email}
                    type="button"
                    onClick={() => toggleAssignee(email)}
                    className={`flex w-full items-center gap-3 rounded-md px-3 py-2 text-left transition-colors ${
                      selected
                        ? "bg-primary/10 text-primary"
                        : "bg-white text-on-surface hover:bg-surface-container"
                    }`}
                  >
                    <span
                      className={`h-4 w-4 rounded border ${
                        selected
                          ? "border-primary bg-primary"
                          : "border-outline-variant"
                      }`}
                    />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-[13px] font-bold">
                        {getDisplayName(email, currentUser, userProfiles)}
                      </span>
                      <span className="block truncate text-[11px] opacity-70">
                        {email}
                      </span>
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        <div className="flex items-center justify-end gap-3 border-t border-outline-variant/20 px-5 py-3">
          <button
            onClick={onClose}
            disabled={isSubmitting}
            className="rounded-md bg-[#e0e4ea] px-6 py-2.5 text-[14px] font-bold text-[#24334f] transition-all hover:bg-[#d6dce4] disabled:opacity-50"
            type="button"
          >
            Hủy
          </button>
          <button
            onClick={handleSubmit}
            disabled={isSubmitting}
            className="rounded-md bg-primary px-6 py-2.5 text-[14px] font-bold text-white transition-all hover:bg-primary/90 disabled:opacity-50"
            type="button"
          >
            {isSubmitting ? "Đang gửi..." : "Giao bài tập"}
          </button>
        </div>
      </div>
    </div>
  );
};

export default AssignmentModal;
