import React, { useMemo, useRef, useState } from "react";
import {
  CalendarClock,
  CheckCircle2,
  ClipboardList,
  FileText,
  Paperclip,
  RotateCcw,
  Send,
  UserCheck,
  X,
} from "lucide-react";
import Swal from "sweetalert2";
import api from "../../services/api";
import { chatService } from "../../services/chatService";
import { useAuth } from "../../context/AuthContext";
import { useChatStore } from "../../store/chatStore";
import { formatFileSize, getDisplayName } from "../../utils/chatUtils";

interface AssignmentMessageProps {
  message: any;
  userProfiles: Record<string, any>;
}

const AssignmentMessage: React.FC<AssignmentMessageProps> = ({
  message,
  userProfiles,
}) => {
  const { user } = useAuth();
  const { activeConvId, conversations, updateMessage } = useChatStore();
  const [note, setNote] = useState("");
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isDeletingSubmission, setIsDeletingSubmission] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const assignment = message.payload?.assignment || {};
  const myEmail = String(user?.email || "").toLowerCase();
  const submissions = assignment.submissions || {};
  const mySubmission = submissions[myEmail];

  const deadline = useMemo(() => new Date(assignment.deadline), [assignment.deadline]);
  const deadlineTime = deadline.getTime();
  const isOverdue = Number.isFinite(deadlineTime) && deadlineTime < Date.now();
  const assignees: string[] = Array.isArray(assignment.assignees)
    ? assignment.assignees
    : [];
  const activeChat = conversations.find((conversation) => conversation.id === activeConvId);
  const normalizeEmail = (email: string) => String(email || "").trim().toLowerCase();
  const normalizedAssignees = assignees.map(normalizeEmail);
  const isAssignedToMe =
    normalizedAssignees.length === 0 || normalizedAssignees.includes(myEmail);
  const canReviewSubmissions =
    activeChat?.type === "group" &&
    (normalizeEmail(activeChat.owner || activeChat.admin || "") === myEmail ||
      normalizeEmail(activeChat.admin || "") === myEmail ||
      (activeChat.deputies || []).some(
        (deputy) => normalizeEmail(deputy) === myEmail,
      ));
  const reviewMembers = assignees.length > 0 ? assignees : activeChat?.members || [];
  const submittedCount = reviewMembers.filter(
    (email) => submissions[normalizeEmail(email)],
  ).length;
  const assignmentCreatorEmail = normalizeEmail(message.senderId || "");
  const canViewSubmissionFiles = (submitterEmail: string) =>
    assignmentCreatorEmail === myEmail || normalizeEmail(submitterEmail) === myEmail;
  const allowedFileTypes: string[] = Array.isArray(assignment.allowedFileTypes)
    ? assignment.allowedFileTypes
    : ["any"];
  const maxFiles = Number(assignment.maxFiles || 3);
  const maxFileSizeMB = Number(assignment.maxFileSizeMB || 10);
  const maxFileSizeBytes = maxFileSizeMB * 1024 * 1024;

  const fileTypeLabels: Record<string, string> = {
    any: "Tất cả",
    pdf: "PDF",
    doc: "Word/Tài liệu",
    sheet: "Excel/Sheet",
    image: "Hình ảnh",
    archive: "File nén",
  };

  const isAllowedFile = (file: File) => {
    if (allowedFileTypes.includes("any")) return true;
    const name = file.name.toLowerCase();
    const mime = file.type.toLowerCase();
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

  const handleSelectFiles = (files: FileList | null) => {
    if (!files) return;
    const incoming = Array.from(files);
    const next = [...selectedFiles];

    for (const file of incoming) {
      if (next.length >= maxFiles) {
        Swal.fire("Lỗi", `Chỉ được nộp tối đa ${maxFiles} file.`, "error");
        break;
      }
      if (file.size > maxFileSizeBytes) {
        Swal.fire("Lỗi", `File "${file.name}" vượt quá ${maxFileSizeMB}MB.`, "error");
        continue;
      }
      if (!isAllowedFile(file)) {
        Swal.fire("Lỗi", `File "${file.name}" không đúng loại được phép nộp.`, "error");
        continue;
      }
      next.push(file);
    }

    setSelectedFiles(next);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const submitAssignment = async () => {
    if (!activeConvId || !message.id) return;
    if (selectedFiles.length === 0) {
      Swal.fire("Lỗi", "Vui lòng chọn file bài làm để nộp.", "error");
      return;
    }

    setIsSubmitting(true);
    try {
      const uploadedAttachments = await Promise.all(
        selectedFiles.map(async (file) => {
          const res = await chatService.upload(file);
          const data = res.data;
          return {
            name: data.name || file.name,
            mimeType: data.mimeType || file.type || "application/octet-stream",
            size: data.size || file.size,
            url: data.fileUrl || data.url || data.dataUrl,
            dataUrl: data.fileUrl || data.url || data.dataUrl,
          };
        }),
      );

      const res = await api.post(
        `/chat/conversations/${encodeURIComponent(activeConvId)}/messages/${encodeURIComponent(message.id)}/assignment/submit`,
        { note: note.trim(), attachments: uploadedAttachments },
      );
      updateMessage(message.id, res.data);
      setNote("");
      setSelectedFiles([]);
      Swal.fire({
        icon: "success",
        title: "Đã nộp bài",
        timer: 1400,
        showConfirmButton: false,
      });
    } catch (error: any) {
      Swal.fire(
        "Lỗi",
        error?.response?.data?.message || "Không thể nộp bài.",
        "error",
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  const deleteMySubmission = async () => {
    if (!activeConvId || !message.id || isOverdue) return;

    const confirm = await Swal.fire({
      icon: "warning",
      title: "Xóa bài đã nộp?",
      text: "Bạn có thể nộp lại bài khác trước khi hết deadline.",
      showCancelButton: true,
      confirmButtonText: "Xóa bài nộp",
      cancelButtonText: "Hủy",
      confirmButtonColor: "#ef4444",
    });
    if (!confirm.isConfirmed) return;

    setIsDeletingSubmission(true);
    try {
      const res = await api.delete(
        `/chat/conversations/${encodeURIComponent(activeConvId)}/messages/${encodeURIComponent(message.id)}/assignment/submission`,
      );
      updateMessage(message.id, res.data);
      setSelectedFiles([]);
      setNote("");
      Swal.fire({
        icon: "success",
        title: "Đã xóa bài nộp",
        timer: 1200,
        showConfirmButton: false,
      });
    } catch (error: any) {
      Swal.fire(
        "Lỗi",
        error?.response?.data?.message || "Không thể xóa bài nộp.",
        "error",
      );
    } finally {
      setIsDeletingSubmission(false);
    }
  };

  return (
    <div className="w-[320px] max-w-full overflow-hidden rounded-md border border-blue-200 bg-white shadow-sm">
      <div className="border-b border-blue-100 bg-blue-50 px-4 py-3">
        <div className="flex items-start gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md bg-primary text-white">
            <ClipboardList size={20} />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-[10px] font-black uppercase tracking-[0.18em] text-primary/70">
              Bài tập
            </p>
            <h3 className="mt-1 text-[16px] font-extrabold leading-tight text-[#1f2f4a]">
              {assignment.title || "Bài tập mới"}
            </h3>
          </div>
        </div>
      </div>

      <div className="space-y-3 px-4 py-3">
        {assignment.description && (
          <p className="whitespace-pre-wrap text-[13px] font-medium leading-relaxed text-on-surface">
            {assignment.description}
          </p>
        )}

        <div className={`flex items-center gap-2 rounded-md px-3 py-2 text-[12px] font-bold ${
          isOverdue ? "bg-rose-50 text-rose-700" : "bg-amber-50 text-amber-700"
        }`}>
          <CalendarClock size={16} />
          <span>
            Deadline:{" "}
            {deadline.toLocaleString("vi-VN", {
              dateStyle: "medium",
              timeStyle: "short",
            })}
          </span>
        </div>

        {assignees.length > 0 && (
          <div className="rounded-md bg-surface-container-low/60 px-3 py-2">
            <p className="mb-1 text-[11px] font-black uppercase tracking-wider text-on-surface-variant">
              Người nhận
            </p>
            <p className="text-[12px] font-semibold text-on-surface">
              {assignees
                .slice(0, 4)
                .map((email) => getDisplayName(email, user, userProfiles))
                .join(", ")}
              {assignees.length > 4 ? ` +${assignees.length - 4}` : ""}
            </p>
          </div>
        )}

        {canReviewSubmissions && (
          <div className="rounded-md border border-emerald-200 bg-emerald-50/80 px-3 py-2">
            <div className="mb-2 flex items-center justify-between gap-3">
              <div className="flex items-center gap-2 text-emerald-800">
                <UserCheck size={15} />
                <p className="text-[12px] font-black">Bài đã nộp</p>
              </div>
              <span className="rounded-full bg-white px-2 py-0.5 text-[11px] font-black text-emerald-700">
                {submittedCount}/{reviewMembers.length || 0}
              </span>
            </div>

            <div className="max-h-56 space-y-2 overflow-y-auto pr-1">
              {reviewMembers.map((email) => {
                const normalizedEmail = normalizeEmail(email);
                const submission = submissions[normalizedEmail];
                const files = Array.isArray(submission?.attachments)
                  ? submission.attachments
                  : [];

                return (
                  <div
                    key={normalizedEmail}
                    className="rounded-md bg-white/80 px-2 py-2 text-[12px]"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <p className="min-w-0 flex-1 truncate font-bold text-on-surface">
                        {getDisplayName(email, user, userProfiles)}
                      </p>
                      <span
                        className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-black ${
                          submission
                            ? "bg-emerald-100 text-emerald-700"
                            : isOverdue
                              ? "bg-rose-100 text-rose-700"
                              : "bg-amber-100 text-amber-700"
                        }`}
                      >
                        {submission ? "Đã nộp" : isOverdue ? "Quá hạn" : "Chưa nộp"}
                      </span>
                    </div>

                    {submission && (
                      <div className="mt-1 space-y-1">
                        <p className="text-[10px] font-semibold text-on-surface-variant">
                          {new Date(submission.submittedAt).toLocaleString("vi-VN", {
                            dateStyle: "medium",
                            timeStyle: "short",
                          })}
                        </p>

                        {submission.note && (
                          <p className="rounded bg-surface-container-low px-2 py-1 text-[11px] font-medium text-on-surface">
                            {submission.note}
                          </p>
                        )}

                        {canViewSubmissionFiles(email) ? (
                          files.map((file: any, index: number) => (
                            <a
                              key={`${normalizedEmail}-${file.url || file.dataUrl}-${index}`}
                              href={file.url || file.dataUrl}
                              target="_blank"
                              rel="noreferrer"
                              className="flex items-center gap-2 rounded border border-emerald-100 bg-white px-2 py-1 text-[11px] font-bold text-emerald-800 hover:underline"
                            >
                              <FileText size={13} />
                              <span className="min-w-0 flex-1 truncate">
                                {file.name || "Bài nộp"}
                              </span>
                              {file.size ? (
                                <span className="shrink-0 text-[10px] text-emerald-700/70">
                                  {formatFileSize(file.size)}
                                </span>
                              ) : null}
                            </a>
                          ))
                        ) : (
                          <p className="rounded bg-surface-container-low px-2 py-1 text-[11px] font-bold text-on-surface-variant">
                            File chỉ hiển thị với người nộp và người giao bài.
                          </p>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {mySubmission ? (
          <div className="space-y-2 rounded-md bg-emerald-50 px-3 py-2 text-[12px] font-bold text-emerald-700">
            <div className="flex items-center gap-2">
              <CheckCircle2 size={16} />
              <span>
                Bạn đã nộp lúc{" "}
                {new Date(mySubmission.submittedAt).toLocaleString("vi-VN", {
                  dateStyle: "medium",
                  timeStyle: "short",
                })}
              </span>
            </div>
            {Array.isArray(mySubmission.attachments) && mySubmission.attachments.length > 0 && (
              <div className="space-y-1">
                {mySubmission.attachments.map((file: any, index: number) => (
                  <a
                    key={`${file.url || file.dataUrl}-${index}`}
                    href={file.url || file.dataUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="flex items-center gap-2 rounded bg-white/70 px-2 py-1 text-[11px] text-emerald-800 hover:underline"
                  >
                    <FileText size={13} />
                    <span className="truncate">{file.name || "Bài nộp"}</span>
                  </a>
                ))}
              </div>
            )}
            {!isOverdue && (
              <button
                type="button"
                onClick={deleteMySubmission}
                disabled={isDeletingSubmission}
                className="mt-1 flex w-full items-center justify-center gap-2 rounded-md border border-rose-200 bg-white px-3 py-2 text-[12px] font-black text-rose-600 hover:bg-rose-50 disabled:opacity-60"
              >
                <RotateCcw size={14} />
                {isDeletingSubmission ? "Đang xóa..." : "Xóa bài nộp để nộp lại"}
              </button>
            )}
          </div>
        ) : isAssignedToMe ? (
          <div className="space-y-2">
            <div className="rounded-md border border-outline-variant/20 bg-surface-container-low/40 px-3 py-2">
              <p className="text-[11px] font-bold text-on-surface-variant">
                Loại file: {allowedFileTypes.map((type) => fileTypeLabels[type] || type).join(", ")}
              </p>
              <p className="text-[11px] font-bold text-on-surface-variant">
                Tối đa {maxFiles} file, {maxFileSizeMB}MB/file
              </p>
            </div>

            <input
              ref={fileInputRef}
              type="file"
              multiple
              className="hidden"
              onChange={(event) => handleSelectFiles(event.target.files)}
            />

            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="flex w-full items-center justify-center gap-2 rounded-md border border-primary/30 bg-primary/5 px-3 py-2 text-[13px] font-bold text-primary hover:bg-primary/10"
            >
              <Paperclip size={15} />
              Chọn file bài làm
            </button>

            {selectedFiles.length > 0 && (
              <div className="space-y-1">
                {selectedFiles.map((file, index) => (
                  <div
                    key={`${file.name}-${file.size}-${index}`}
                    className="flex items-center gap-2 rounded-md bg-white px-2 py-1.5 text-[12px] shadow-sm"
                  >
                    <FileText size={14} className="text-primary" />
                    <span className="min-w-0 flex-1 truncate font-semibold">
                      {file.name}
                    </span>
                    <span className="text-[10px] font-bold text-on-surface-variant">
                      {formatFileSize(file.size)}
                    </span>
                    <button
                      type="button"
                      onClick={() =>
                        setSelectedFiles((prev) => prev.filter((_, i) => i !== index))
                      }
                      className="text-on-surface-variant hover:text-error"
                    >
                      <X size={14} />
                    </button>
                  </div>
                ))}
              </div>
            )}

            <textarea
              value={note}
              onChange={(e) => setNote(e.target.value.slice(0, 300))}
              placeholder="Ghi chú nộp bài..."
              rows={2}
              className="w-full resize-none rounded-md border border-outline-variant/20 bg-white px-3 py-2 text-[13px] outline-none focus:ring-2 focus:ring-primary/20"
            />
            <button
              type="button"
              onClick={submitAssignment}
              disabled={isSubmitting || isOverdue}
              className={`flex w-full items-center justify-center gap-2 rounded-md px-3 py-2 text-[13px] font-bold text-white transition-all ${
                isOverdue
                  ? "cursor-not-allowed bg-rose-300"
                  : "bg-primary hover:bg-primary/90"
              }`}
            >
              <Send size={15} />
              {isSubmitting ? "Đang nộp..." : isOverdue ? "Đã quá hạn" : "Nộp bài"}
            </button>
          </div>
        ) : (
          <div className="rounded-md bg-surface-container-low/60 px-3 py-2 text-[12px] font-bold text-on-surface-variant">
            Bạn không nằm trong danh sách được giao bài tập này.
          </div>
        )}
      </div>
    </div>
  );
};

export default AssignmentMessage;
