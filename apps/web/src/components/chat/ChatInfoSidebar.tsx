import React, { useEffect, useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import ChatWallpaperModal from "./ChatWallpaperModal";
import {
  BellOff,
  Image as ImageIcon,
  Bell,
  Clock3,
  Trash2,
  X,
  Check,
  ChevronLeft,
  ChevronDown,
  FileText,
  UserMinus,
  ShieldCheck,
  ShieldAlert,
  LogOut,
  Settings,
  Link,
  Plus,
  Camera,
  Loader2,
  Pin,
  PinOff,
  QrCode,
  Video,
} from "lucide-react";
import Swal from "sweetalert2";
import api from "../../services/api";
import { useAuth } from "../../context/AuthContext";
import { useChatStore } from "../../store/chatStore";
import {
  getDisplayAvatar,
  getDisplayName,
  normalizeAttachment,
  clearConversationMuteSchedule,
  formatMuteScheduleLabel,
  getConversationMuteSchedule,
  setConversationMuteSchedule,
  type ConversationMuteSchedule,
} from "../../utils/chatUtils";
import AddMembersModal from "./AddMembersModal";
import AssetMediaGrid from "./AssetMediaGrid";
import AssetFileList from "./AssetFileList";
import AssetLinkList from "./AssetLinkList";
import GroupShareModal from "./GroupShareModal";
import { useTheme } from "../../context/ThemeContext";
import { useGroupCallStore } from "../../store/groupCallStore";

const ChatInfoSidebar: React.FC = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { language, t } = useTheme();
  const {
    conversations,
    activeConvId,
    userProfiles,
    messages,
    setConversationAutoDelete,
    clearHistory,
    isConversationMuted,
    removeMember,
    updateMemberRole,
    updateGroupInfo,
    dissolveGroup,
    archiveAssets,
    fetchArchiveAssets,
  } = useChatStore();

  const { callState, joinMeeting, activeCallForConv } = useGroupCallStore();

  const activeChat = conversations.find((c) => c.id === activeConvId);

  // HEAD States
  const [viewMode, setViewMode] = useState<"info" | "archive">("info");
  const [activeStorageTab, setActiveStorageTab] = useState<
    "media" | "file" | "link"
  >("media");
  const [senderFilter, setSenderFilter] = useState("all");
  const [dateFilter, setDateFilter] = useState("all");
  const [showAutoDeleteModal, setShowAutoDeleteModal] = useState(false);
  const [pendingAutoDeleteDays, setPendingAutoDeleteDays] = useState<
    1 | 7 | 30 | null
  >(null);
  const [savingAutoDelete, setSavingAutoDelete] = useState(false);

  // Mute schedule States
  const [showMutePanel, setShowMutePanel] = useState(false);
  const [showCustomTime, setShowCustomTime] = useState(false);
  const [muteStartTime, setMuteStartTime] = useState("22:00");
  const [muteEndTime, setMuteEndTime] = useState("07:00");
  const [muteSummary, setMuteSummary] = useState<string | null>(null);

  // tin_notification States
  const [isAddMembersModalOpen, setIsAddMembersModalOpen] = useState(false);
  const [isGroupShareOpen, setIsGroupShareOpen] = useState(false);
  const [showTransferOwnerModal, setShowTransferOwnerModal] = useState(false);
  const [isTransferringOwnership, setIsTransferringOwnership] = useState(false);
  const [selectedNewOwnerEmail, setSelectedNewOwnerEmail] = useState<
    string | null
  >(null);
  const [isEditingGroupName, setIsEditingGroupName] = useState(false);
  const [newGroupName, setNewGroupName] = useState("");
  const [isSavingGroupName, setIsSavingGroupName] = useState(false);
  const [isWallpaperModalOpen, setIsWallpaperModalOpen] = useState(false);
  const [showClearHistoryPanel, setShowClearHistoryPanel] = useState(false);

  useEffect(() => {
    if (activeChat?.id) {
      // Pre-fetch first few assets for the preview
      fetchArchiveAssets(activeChat.id, "media", true);
      fetchArchiveAssets(activeChat.id, "file", true);
      fetchArchiveAssets(activeChat.id, "link", true);
    }
  }, [activeChat?.id]);

  useEffect(() => {
    if (!activeChat) return;
    // Sync mute schedule state when conversation changes
    const schedule = getConversationMuteSchedule(activeChat.id);
    if (schedule) {
      setMuteStartTime(schedule.startTime);
      setMuteEndTime(schedule.endTime);
      setMuteSummary(formatMuteScheduleLabel(schedule));
    } else {
      setMuteSummary(null);
    }
    setShowMutePanel(false);
    setShowCustomTime(false);
    setIsEditingGroupName(false);
    setNewGroupName(activeChat.name || "");
  }, [activeChat?.id]);

  const normalizedUserEmail = String(user?.email || "")
    .trim()
    .toLowerCase();
  const isGroupOwner =
    activeChat?.type === "group" &&
    ((activeChat.owner || activeChat.admin || "").trim().toLowerCase() ===
      normalizedUserEmail ||
      (activeChat.admin || "").trim().toLowerCase() === normalizedUserEmail);
  const groupMembers = Array.isArray(activeChat?.members)
    ? activeChat.members.filter(Boolean)
    : [];
  const transferOwnerCandidates = groupMembers.filter(
    (memberEmail) =>
      String(memberEmail || "")
        .trim()
        .toLowerCase() !== normalizedUserEmail,
  );

  const isDeputy =
    activeChat?.type === "group" &&
    Array.isArray(activeChat.deputies) &&
    activeChat.deputies.some(
      (d) => String(d).trim().toLowerCase() === normalizedUserEmail,
    );

  const canManageGroup = isGroupOwner || isDeputy;

  const pinnedIds = (activeChat as any)?.pinnedMessageIds || [];
  const pinnedMessages = useMemo(() => {
    if (!activeConvId || pinnedIds.length === 0) return [];
    return pinnedIds.map((id: string) => {
      const msg = messages.find(
        (m) => m.id === id && m.conversationId === activeConvId,
      );
      return msg
        ? { id: msg.id, content: msg.content, createdAt: msg.createdAt }
        : { id, content: t("info.loading"), isPlaceholder: true };
    });
  }, [pinnedIds, messages, activeConvId, t]);

  // Instant Previews Logic
  const mediaPreview = useMemo(() => {
    const local = messages.flatMap(m => [...(m.media || []), ...(m.files || [])].map(a => ({ ...normalizeAttachment(a), msgId: m.id, createdAt: m.createdAt })));
    const remote = archiveAssets.media.items.flatMap(m => [...(m.media || []), ...(m.files || [])].map(a => ({ ...normalizeAttachment(a), msgId: m.id, createdAt: m.createdAt })));
    const combined = [...local, ...remote];
    const unique = Array.from(new Map(combined.map(a => [`${a.msgId}-${a.dataUrl}`, a])).values());
    return (unique as any[])
      .filter(a => a.mimeType?.startsWith("image/") || a.mimeType?.startsWith("video/"))
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
      .slice(0, 4);
  }, [messages, archiveAssets.media.items]);

  const filePreview = useMemo(() => {
    const filterFn = (a: any) => {
      const name = a.name?.toLowerCase() || "";
      const mime = a.mimeType?.toLowerCase() || "";
      return (
        !name.includes("location.json") &&
        !name.includes("contact.json") &&
        !mime.startsWith("audio/")
      );
    };

    const local = messages.flatMap((m) =>
      (m.files || [])
        .map((a) => ({
          ...normalizeAttachment(a),
          msgId: m.id,
          createdAt: m.createdAt,
        }))
        .filter(filterFn),
    );
    const remote = archiveAssets.file.items.flatMap((m) =>
      (m.files || [])
        .map((a) => ({
          ...normalizeAttachment(a),
          msgId: m.id,
          createdAt: m.createdAt,
        }))
        .filter(filterFn),
    );
    const combined = [...local, ...remote];
    const unique = Array.from(
      new Map(combined.map((a) => [`${a.msgId}-${a.name}`, a])).values(),
    );
    return (unique as any[])
      .sort(
        (a, b) =>
          new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
      )
      .slice(0, 3);
  }, [messages, archiveAssets.file.items]);

  const linkPreview = useMemo(() => {
    const extractLinks = (m: any) => {
      const urls = m.content?.match(/https?:\/\/[^\s]+/g) || [];
      return urls.map((url: string) => ({ url, msgId: m.id, createdAt: m.createdAt }));
    };
    const local = messages.flatMap(extractLinks);
    const remote = archiveAssets.link.items.flatMap(extractLinks);
    const combined = [...local, ...remote];
    const unique = Array.from(new Map(combined.map(a => [`${a.msgId}-${a.url}`, a])).values());
    return (unique as any[])
      .sort((a: any, b: any) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
      .slice(0, 3);
  }, [messages, archiveAssets.link.items]);

  useEffect(() => {
    if (!showTransferOwnerModal) return;
    if (!transferOwnerCandidates.length) {
      setSelectedNewOwnerEmail(null);
      return;
    }

    const selectedStillValid = selectedNewOwnerEmail
      ? transferOwnerCandidates.includes(selectedNewOwnerEmail)
      : false;

    if (!selectedStillValid) {
      setSelectedNewOwnerEmail(transferOwnerCandidates[0]);
    }
  }, [showTransferOwnerModal, transferOwnerCandidates, selectedNewOwnerEmail]);

  if (!activeChat) return null;

  const partnerEmail =
    activeChat.type === "direct"
      ? Array.isArray(activeChat.members)
        ? activeChat.members.find((m) => {
            const normalizedM = String(m || "")
              .trim()
              .toLowerCase();
            const normalizedMe = String(user?.email || "")
              .trim()
              .toLowerCase();
            return normalizedM !== normalizedMe;
          })
        : undefined
      : undefined;

  const isBot = partnerEmail?.toLowerCase() === 'bot@UniChat.system';

  const chatName =
    activeChat.type === "direct"
      ? getDisplayName(partnerEmail, user, userProfiles)
      : activeChat.name || t("info.group_fallback");

  const chatAvatar =
    activeChat.type === "direct"
      ? getDisplayAvatar(partnerEmail, user, userProfiles)
      : activeChat.avatar || "/logo_blue.png";

  const currentAutoDeleteDays = activeChat.autoDeleteDays ?? null;
  const muted = !!(activeConvId && isConversationMuted(activeConvId));
  const getMuteStatusLabel = () => {
    return muted ? t('info.mute_status_muted') : t('info.mute_status_active');
  };

  const autoDeleteLabel = (days: 1 | 7 | 30 | null) => {
    if (days === 1) return t('info.day_1');
    if (days === 7) return t('info.days_7');
    if (days === 30) return t('info.days_30');
    return t('info.never');
  };

  const openAutoDeleteModal = () => {
    setPendingAutoDeleteDays(currentAutoDeleteDays as 1 | 7 | 30 | null);
    setShowAutoDeleteModal(true);
  };

  const confirmAutoDelete = async () => {
    if (!activeConvId) return;
    setSavingAutoDelete(true);
    try {
      await setConversationAutoDelete(activeConvId, pendingAutoDeleteDays);
      setShowAutoDeleteModal(false);
    } catch {
      // Errors are logged in store; modal stays open for retry.
    } finally {
      setSavingAutoDelete(false);
    }
  };

  const uniqueSenders = activeChat?.members || [];

  const handleOpenProfile = () => {
    if (!partnerEmail) return;
    navigate(`/profile?email=${encodeURIComponent(partnerEmail)}`);
  };

  const handleToggleMute = () => {
    if (!activeConvId) return;
    if (muted || muteSummary) {
      // Currently muted (DB or schedule) → unmute immediately
      if (muted) {
        const { setConversationMuted } = useChatStore.getState();
        setConversationMuted(activeConvId, false);
      }
      clearConversationMuteSchedule(activeConvId);
      setMuteSummary(null);
      setShowMutePanel(false);
      setShowCustomTime(false);
    } else {
      // Not muted → open panel to choose duration
      setShowMutePanel((prev) => !prev);
      setShowCustomTime(false);
    }
  };

  const applyDurationMute = (label: string, durationMs: number | null) => {
    if (!activeConvId) return;
    const { setConversationMuted } = useChatStore.getState();
    setConversationMuted(activeConvId, true);
    setMuteSummary(label);
    setShowMutePanel(false);
    setShowCustomTime(false);

    // For duration-based mutes, also write a time-range schedule so
    // isConversationMutedNow() catches it in the notification check.
    if (durationMs !== null) {
      const now = new Date();
      const endMs = Date.now() + durationMs;
      const endDate = new Date(endMs);
      const startTime = `${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`;
      const endTime = `${String(endDate.getHours()).padStart(2, "0")}:${String(endDate.getMinutes()).padStart(2, "0")}`;
      setConversationMuteSchedule(activeConvId, { enabled: true, startTime, endTime });
    }
    // "permanent" mute only relies on DB isMuted = true (already set above)
  };


  const handleSaveMuteSchedule = () => {
    if (!activeChat) return;
    const schedule: ConversationMuteSchedule = {
      enabled: true,
      startTime: muteStartTime,
      endTime: muteEndTime,
    };
    setConversationMuteSchedule(activeChat.id, schedule);
    setMuteSummary(formatMuteScheduleLabel(schedule));
    setShowMutePanel(false);
    setShowCustomTime(false);
  };

  const handleClearMuteSchedule = () => {
    if (!activeConvId) return;
    clearConversationMuteSchedule(activeConvId);
    if (muted) {
      const { setConversationMuted } = useChatStore.getState();
      setConversationMuted(activeConvId, false);
    }
    setMuteSummary(null);
    setShowMutePanel(false);
    setShowCustomTime(false);
  };



  const handleLeaveGroup = async () => {
    if (!activeConvId || !user?.email) return;
    if (isGroupOwner) {
      setSelectedNewOwnerEmail(transferOwnerCandidates[0] || null);
      setShowTransferOwnerModal(true);
      return;
    }

    try {
      await removeMember(activeConvId, user.email);
      navigate("/chat");
    } catch (err: any) {
      Swal.fire(
        t('modal.error'),
        err.response?.data?.message || t('info.leave_error'),
        "error",
      );
    }
  };

  const handleDissolveGroup = async () => {
    if (!activeConvId) return;
    const confirm = await Swal.fire({
      title: t('info.dissolve_title'),
      text: t('info.dissolve_text'),
      icon: "warning",
      showCancelButton: true,
      confirmButtonText: t('info.dissolve_button'),
      cancelButtonColor: "#d33",
    });
    if (confirm.isConfirmed) {
      try {
        await dissolveGroup(activeConvId);
      } catch (err: any) {
        Swal.fire(
          t('modal.error'),
          err.response?.data?.message || t('info.dissolve_error'),
          "error",
        );
      }
    }
  };

  const handleClearHistoryForEveryone = async () => {
    if (!activeConvId) return;
    try {
      await clearHistory(activeConvId, true);
      await Swal.fire({
        icon: "success",
        title: t('info.clear_success'),
        timer: 1400,
        showConfirmButton: false,
      });
      setShowClearHistoryPanel(false);
    } catch (err: any) {
      Swal.fire(
        t('modal.error'),
        err.response?.data?.message || t('info.history_error'),
        "error"
      );
    }
  };

  const handleClearHistoryForMe = async () => {
    if (!activeConvId) return;
    try {
      await clearHistory(activeConvId, false);
      await Swal.fire({
        icon: "success",
        title: t('info.clear_success'),
        timer: 1400,
        showConfirmButton: false,
      });
      setShowClearHistoryPanel(false);
    } catch (err: any) {
      Swal.fire(
        t('modal.error'),
        err.response?.data?.message || t('info.clear_error'),
        "error"
      );
    }
  };

  const handleClearHistoryClick = async () => {
    if (!activeConvId) return;

    if (isGroupOwner) {
      setShowClearHistoryPanel(!showClearHistoryPanel);
    } else {
      const confirm = await Swal.fire({
        icon: "warning",
        title: t('info.clear_title_one_side'),
        text: t('info.clear_text_one_side'),
        showCancelButton: true,
        confirmButtonText: t('info.delete_button'),
        cancelButtonText: t('inbox.cancel'),
        confirmButtonColor: "#d93025",
      });

      if (!confirm.isConfirmed) return;

      try {
        await clearHistory(activeConvId, false);
        await Swal.fire({
          icon: "success",
          title: t('info.clear_success'),
          timer: 1400,
          showConfirmButton: false,
        });
      } catch (err: any) {
        Swal.fire(
          t('modal.error'),
          err.response?.data?.message || t('info.clear_error'),
          "error"
        );
      }
    }
  };

  const handleTogglePin = async () => {
    if (!activeConvId) return;
    try {
      // Assuming pinConversation is accessible from store or helper
      const { pinConversation } = useChatStore.getState();
      await pinConversation(activeConvId, !(activeChat as any).isPinned);
    } catch (err: any) {
      Swal.fire(t('modal.error'), t('info.pin_error'), "error");
    }
  };

  const handleKickMember = async (targetEmail: string) => {
    if (!activeConvId) return;
    const confirm = await Swal.fire({
      title: t('info.kick_title'),
      text: t('info.kick_text', { name: getDisplayName(targetEmail, user, userProfiles) }),
      icon: "warning",
      showCancelButton: true,
      confirmButtonText: t('info.remove_button'),
    });
    if (confirm.isConfirmed) {
      try {
        await removeMember(activeConvId, targetEmail);
      } catch (err: any) {
        Swal.fire(
          t('modal.error'),
          err.response?.data?.message || t('info.remove_error'),
          "error",
        );
      }
    }
  };

  const handleOpenChangeRoleDialog = async (
    targetEmail: string,
    currentRole: "member" | "deputy" | "owner",
  ) => {
    if (!activeConvId) return;

    const { value: newRole } = await Swal.fire({
      title: t('info.change_role_title'),
      text: t('info.change_role_text', { name: getDisplayName(targetEmail, user, userProfiles) }),
      input: "radio",
      inputOptions: {
        member: t('info.role_member'),
        deputy: t('info.role_deputy'),
        owner: t('info.role_owner'),
      },
      inputValue: currentRole,
      showCancelButton: true,
      confirmButtonText: t('info.role_save_btn'),
      cancelButtonText: t('inbox.cancel'),
    });

    if (!newRole || newRole === currentRole) return;

    try {
      await updateMemberRole(activeConvId, targetEmail, newRole);
    } catch (err: any) {
      Swal.fire(
        t('modal.error'),
        err.response?.data?.message || t('info.role_error'),
        "error",
      );
    }
  };

  const handleTransferOwnershipAndLeave = async (targetEmail: string) => {
    if (!activeConvId || !user?.email || isTransferringOwnership) return;

    setIsTransferringOwnership(true);
    try {
      await updateMemberRole(activeConvId, targetEmail, "owner");
      await removeMember(activeConvId, user.email);
      setShowTransferOwnerModal(false);
      setSelectedNewOwnerEmail(null);
      navigate("/chat");
    } catch (err: any) {
      Swal.fire(
        t('modal.error'),
        err.response?.data?.message || t('info.transfer_error'),
        "error",
      );
    } finally {
      setIsTransferringOwnership(false);
    }
  };


  const handleAddMembers = async () => {
    setIsAddMembersModalOpen(true);
  };

  const handleUpdateGroupName = async () => {
    if (!activeConvId || !newGroupName.trim() || isSavingGroupName) return;
    if (newGroupName === activeChat.name) {
      setIsEditingGroupName(false);
      return;
    }

    setIsSavingGroupName(true);
    try {
      await updateGroupInfo(activeConvId, { name: newGroupName.trim() });
      setIsEditingGroupName(false);
      Swal.fire({
        icon: "success",
        title: t('info.success'),
        text: t('info.group_name_updated'),
        timer: 1500,
        showConfirmButton: false,
      });
    } catch (err: any) {
      Swal.fire(
        t('modal.error'),
        err.response?.data?.message || t('info.group_name_error'),
        "error",
      );
    } finally {
      setIsSavingGroupName(false);
    }
  };

  const handleUpdateGroupAvatar = async (
    e: React.ChangeEvent<HTMLInputElement>,
  ) => {
    const file = e.target.files?.[0];
    if (!file || !activeConvId) return;

    try {
      const formData = new FormData();
      formData.append("file", file);
      const uploadRes = await api.post("/chat/uploads", formData, {
        headers: { "Content-Type": "multipart/form-data" },
      });
      const avatarUrl = uploadRes.data.fileUrl || uploadRes.data.dataUrl || "";
      await updateGroupInfo(activeConvId, { avatar: avatarUrl });
      Swal.fire({
        icon: "success",
        title: t('info.success'),
        text: t('info.group_avatar_updated'),
        timer: 1500,
        showConfirmButton: false,
      });
    } catch (err: any) {
      Swal.fire(
        t('modal.error'),
        err.response?.data?.message || t('info.group_avatar_error'),
        "error",
      );
    }
  };

  const DEFAULT_GROUP_AVATAR =
    "https://fptupload.s3.ap-southeast-1.amazonaws.com/Zalo_Edu_Logo_2e176b6b7f.png";

  return (
    <div className="w-[320px] h-full border-l border-outline-variant/30 dark:border-outline-variant/30 bg-white dark:bg-surface-container flex flex-col shrink-0 animate-in slide-in-from-right-4 duration-300">
      <div className="p-6 border-b border-outline-variant/10 flex flex-col items-center">
        <div className="relative group mb-3">
          <img
            className={`w-20 h-20 rounded-full object-cover shadow-md border-2 border-white dark:border-surface-container-high ${partnerEmail ? "cursor-pointer hover:opacity-90 transition-opacity" : ""}`}
            src={
              activeChat.avatar ||
              (activeChat.type === "group" ? DEFAULT_GROUP_AVATAR : chatAvatar)
            }
            alt=""
            onClick={
              (activeChat.type === "group" || isBot) ? undefined : handleOpenProfile
            }
            title={
              (partnerEmail && !isBot)
                ? t("info.view_profile")
                : activeChat.type === "group"
                  ? t("info.change_avatar")
                  : undefined
            }
          />
          {activeChat.type === "group" && (
            <label className="absolute inset-0 flex items-center justify-center bg-black/40 rounded-full opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer">
              <Camera size={24} className="text-white" />
              <input
                type="file"
                accept="image/*"
                className="hidden"
                onChange={handleUpdateGroupAvatar}
              />
            </label>
          )}
        </div>
        {isEditingGroupName ? (
          <div className="w-full flex items-center gap-2 px-2 mt-1">
            <input
              autoFocus
              className="flex-1 bg-surface-container-highest px-3 py-2 rounded-xl text-[14px] font-bold text-on-surface outline-none border-2 border-primary"
              value={newGroupName}
              onChange={(e) => setNewGroupName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") handleUpdateGroupName();
                if (e.key === "Escape") setIsEditingGroupName(false);
              }}
            />
            <button
              onClick={handleUpdateGroupName}
              disabled={isSavingGroupName}
              className="p-2 bg-primary text-white rounded-xl hover:opacity-90 disabled:opacity-50"
            >
              {isSavingGroupName ? (
                <Loader2 size={16} className="animate-spin" />
              ) : (
                <Check size={16} />
              )}
            </button>
          </div>
        ) : (
          <div className="flex items-center justify-center gap-2 max-w-full">
            <h3 className="font-bold text-[16px] text-on-surface text-center leading-tight truncate">
              {chatName}
            </h3>
            {activeChat.type === "group" && canManageGroup && (
              <button
                onClick={() => setIsEditingGroupName(true)}
                className="p-1.5 rounded-full hover:bg-surface-container-highest text-on-surface-variant transition-colors"
              >
                <Settings size={14} />
              </button>
            )}
          </div>
        )}
        <p className="text-[12px] text-on-surface-variant font-medium mt-1">
          {activeChat.type === "direct"
            ? isBot ? t("info.ai_assistant") : t("info.direct_chat")
            : t("info.group_chat")}
        </p>
      </div>

      {activeChat.type === "group" && activeCallForConv && callState === 'IDLE' && (
        <div className="px-4 py-3 mx-4 mt-4 bg-green-500/10 border border-green-500/20 rounded-2xl flex flex-col gap-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-green-500">
              <div className="relative flex items-center justify-center">
                <Video size={16} className="relative z-10" />
                <div className="absolute inset-0 bg-green-500/40 rounded-full blur-md animate-pulse"></div>
              </div>
              <span className="text-[13px] font-bold uppercase tracking-widest">Voice Channel</span>
            </div>
            <span className="text-[11px] font-bold bg-green-500/20 text-green-600 px-2 py-0.5 rounded-full">
              {activeCallForConv.participantCount} {t('info.members', { count: activeCallForConv.participantCount })}
            </span>
          </div>
          <p className="text-[12px] text-green-600/80 font-medium">Đang có cuộc gọi nhóm diễn ra.</p>
          <button
            onClick={() => joinMeeting(activeConvId!, activeCallForConv.callId, activeCallForConv.callType || 'video', {
              email: user?.email || '',
              fullName: user?.fullName || user?.email || '',
              avatarUrl: user?.avatarUrl || ''
            })}
            className="mt-1 w-full py-2 bg-green-500 hover:bg-green-600 text-white font-bold text-[13px] rounded-xl transition-all shadow-lg shadow-green-500/20 active:scale-95"
          >
            Tham gia ngay
          </button>
        </div>
      )}

      <div className="flex-1 overflow-y-auto hide-scrollbar">
        <div className="py-2">
          {/* Section: Kho lưu trữ Tabs & Filters */}
            {viewMode === "info" ? (
              <div className="px-4 space-y-6 py-4">
                {/* Media Preview */}
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <h4 className="text-[13px] font-bold text-on-surface">{t("info.media")}</h4>
                    <button 
                      onClick={() => { setViewMode("archive"); setActiveStorageTab("media"); }}
                      className="text-[12px] font-medium text-primary hover:underline"
                    >
                      {t("info.view_all")}
                    </button>
                  </div>
                  <div className="grid grid-cols-4 gap-1">
                    {mediaPreview.map((att, i) => (
                      <div key={i} className="aspect-square rounded-lg overflow-hidden bg-surface-container-highest border border-outline-variant/10">
                         <img src={att.dataUrl} className="w-full h-full object-cover" alt="" />
                      </div>
                    ))}
                    {mediaPreview.length === 0 && !archiveAssets.media.loading && (
                      <p className="text-[12px] italic opacity-50 col-span-4 py-2">{t("info.no_media")}</p>
                    )}
                    {archiveAssets.media.loading && mediaPreview.length === 0 && (
                      <div className="col-span-4 py-2 flex justify-center"><Loader2 size={16} className="animate-spin text-primary/40" /></div>
                    )}
                  </div>
                </div>

                {/* Files Preview */}
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <h4 className="text-[13px] font-bold text-on-surface">{t("info.files")}</h4>
                    <button 
                      onClick={() => { setViewMode("archive"); setActiveStorageTab("file"); }}
                      className="text-[12px] font-medium text-primary hover:underline"
                    >
                      {t("info.view_all")}
                    </button>
                  </div>
                  <div className="space-y-2">
                    {filePreview.map((file, i) => (
                      <div key={i} className="flex items-center gap-3 p-2 bg-surface-container-highest/30 rounded-xl">
                        <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                          <FileText size={16} className="text-primary" />
                        </div>
                        <span className="text-[12px] truncate flex-1 font-medium">{file.name}</span>
                      </div>
                    ))}
                    {filePreview.length === 0 && !archiveAssets.file.loading && (
                      <p className="text-[12px] italic opacity-50 py-2">{t("info.no_files")}</p>
                    )}
                    {archiveAssets.file.loading && filePreview.length === 0 && (
                      <div className="py-2 flex justify-center"><Loader2 size={16} className="animate-spin text-primary/40" /></div>
                    )}
                  </div>
                </div>

                {/* Links Preview */}
                <div className="space-y-3 pb-4">
                  <div className="flex items-center justify-between">
                    <h4 className="text-[13px] font-bold text-on-surface">{t("info.links")}</h4>
                    <button 
                      onClick={() => { setViewMode("archive"); setActiveStorageTab("link"); }}
                      className="text-[12px] font-medium text-primary hover:underline"
                    >
                      {t("info.view_all")}
                    </button>
                  </div>
                  <div className="space-y-2">
                    {linkPreview.map((x: any, i) => (
                      <a key={i} href={x.url} target="_blank" rel="noreferrer" className="flex items-center gap-3 p-2 bg-surface-container-highest/30 rounded-xl hover:bg-surface-container-highest transition-colors">
                        <div className="w-8 h-8 rounded-lg bg-secondary/10 flex items-center justify-center shrink-0">
                          <Link size={14} className="text-secondary" />
                        </div>
                        <span className="text-[11px] truncate flex-1 text-primary hover:underline">{x.url}</span>
                      </a>
                    ))}
                    {linkPreview.length === 0 && !archiveAssets.link.loading && (
                      <p className="text-[12px] italic opacity-50 py-2">{t("info.no_links")}</p>
                    )}
                    {archiveAssets.link.loading && linkPreview.length === 0 && (
                      <div className="py-2 flex justify-center"><Loader2 size={16} className="animate-spin text-primary/40" /></div>
                    )}
                  </div>
                </div>
              </div>
            ) : (
              <div className="flex flex-col">
                <div className="flex items-center gap-2 px-4 py-2 border-b border-outline-variant/10 bg-surface-container-lowest sticky top-0 z-10">
                  <button 
                    onClick={() => setViewMode("info")}
                    className="p-2 hover:bg-surface-container rounded-full"
                  >
                    <ChevronLeft size={20} />
                  </button>
                  <span className="text-[14px] font-bold">{t("info.archive")}</span>
                </div>

                <div className="flex px-4 pt-2 mb-3 border-b border-outline-variant/10">
                  <button
                    className={`flex-1 pb-2 text-[13px] font-semibold border-b-2 transition-colors ${activeStorageTab === "media" ? "border-primary text-primary" : "border-transparent text-on-surface-variant hover:text-on-surface"}`}
                    onClick={() => setActiveStorageTab("media")}
                  >
                    {t("info.media")}
                  </button>
                  <button
                    className={`flex-1 pb-2 text-[13px] font-semibold border-b-2 transition-colors ${activeStorageTab === "file" ? "border-primary text-primary" : "border-transparent text-on-surface-variant hover:text-on-surface"}`}
                    onClick={() => setActiveStorageTab("file")}
                  >
                    {t("info.files")}
                  </button>
                  <button
                    className={`flex-1 pb-2 text-[13px] font-semibold border-b-2 transition-colors ${activeStorageTab === "link" ? "border-primary text-primary" : "border-transparent text-on-surface-variant hover:text-on-surface"}`}
                    onClick={() => setActiveStorageTab("link")}
                  >
                    {t("info.links")}
                  </button>
                </div>

                <div className="flex gap-2 px-4 mb-4">
                  <select
                    value={senderFilter}
                    onChange={(e) => setSenderFilter(e.target.value)}
                    className="flex-1 bg-surface-container-highest px-3 py-2 rounded-xl text-[12px] text-on-surface outline-none border border-transparent focus:border-primary/30 appearance-none cursor-pointer"
                  >
                    <option value="all">{t("info.sender")}</option>
                    {uniqueSenders.map((email) => (
                      <option key={email} value={email}>
                        {getDisplayName(email, user, userProfiles)}
                      </option>
                    ))}
                  </select>

                  <input
                    type="date"
                    value={
                      dateFilter === "all" ||
                      dateFilter === "newest" ||
                      dateFilter === "oldest"
                        ? ""
                        : dateFilter
                    }
                    onChange={(e) => setDateFilter(e.target.value || "all")}
                    className="flex-1 bg-surface-container-highest px-3 py-2 rounded-xl text-[12px] text-on-surface outline-none border border-transparent focus:border-primary/30 cursor-pointer"
                    title={t("info.select_date")}
                  />
                </div>

                <div className="py-2">
                  {activeChat && (
                    <>
                      {activeStorageTab === "media" && <AssetMediaGrid convId={activeChat.id} />}
                      {activeStorageTab === "file" && <AssetFileList convId={activeChat.id} />}
                      {activeStorageTab === "link" && <AssetLinkList convId={activeChat.id} />}
                    </>
                  )}
                </div>
              </div>
            )}

          {/* Section: Pinned Messages */}
          {activeChat.type === "group" && !isBot && pinnedIds.length > 0 && (
            <div className="mt-4 px-4">
              <div className="flex items-center justify-between mb-2 px-1">
                <h4 className="text-[11px] font-extrabold text-on-surface-variant uppercase tracking-wider flex items-center gap-2">
                  <Pin size={12} className="text-primary fill-primary/10" />
                  {t("info.pinned_messages", { count: pinnedIds.length })}
                </h4>
              </div>
              <div className="space-y-2">
                {pinnedMessages.map((msg: any) => (
                  <div
                    key={msg.id}
                    onClick={() => {
                      const { jumpToMessage } = useChatStore.getState();
                      jumpToMessage(msg.id);
                    }}
                    className="group/pin flex items-start gap-3 p-2.5 bg-amber-50/50 dark:bg-primary/5 rounded-xl border border-amber-200/30 dark:border-primary/10 hover:border-primary/30 transition-all cursor-pointer"
                  >
                    <div className="flex-1 min-w-0">
                      <p className="text-[12px] text-on-surface font-medium line-clamp-2 leading-snug">
                        {msg.content}
                      </p>
                      <p className="text-[9px] text-on-surface-variant/70 font-bold uppercase mt-1">
                        {msg.createdAt
                          ? new Date(msg.createdAt).toLocaleDateString(language === "vi" ? "vi-VN" : "en-US")
                          : t("info.recently_pinned")}
                      </p>
                    </div>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        const { patchMessageOptimistic } =
                          useChatStore.getState();
                        if (activeConvId) {
                          patchMessageOptimistic(activeConvId, msg.id, {
                            action: "unpin",
                          });
                        }
                      }}
                      className="opacity-0 group-hover/pin:opacity-100 p-1.5 hover:bg-error/10 text-error rounded-lg transition-all"
                      title={t("info.unpin_conversation")}
                    >
                      <X size={14} />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Section: Settings */}
          <div className="mt-4 px-4 space-y-1">
            <button
              onClick={openAutoDeleteModal}
              className="w-full flex items-center justify-between gap-3 p-3 rounded-xl hover:bg-surface-container text-on-surface font-semibold text-[13px] transition-all"
            >
              <span className="flex items-center gap-3">
                <Clock3 size={20} className="text-on-surface-variant" />
                {t("info.auto_delete_label")}
              </span>
              <span className="text-[12px] font-bold text-primary">
                {autoDeleteLabel(currentAutoDeleteDays as 1 | 7 | 30 | null)}
              </span>
            </button>

            <button
              onClick={handleTogglePin}
              className="w-full flex items-center gap-3 p-3 rounded-xl hover:bg-surface-container text-on-surface font-semibold text-[13px] transition-all"
            >
              {(activeChat as any).isPinned ? (
                <>
                  <PinOff size={20} className="text-on-surface-variant" />
                  {t("info.unpin_conversation")}
                </>
              ) : (
                <>
                  <Pin size={20} className="text-on-surface-variant" />
                  {t("info.pin_conversation")}
                </>
              )}
            </button>

            <button
              onClick={() => setIsWallpaperModalOpen(true)}
              className="w-full flex items-center gap-3 p-3 rounded-xl hover:bg-surface-container text-on-surface font-semibold text-[13px] transition-all"
            >
              <ImageIcon size={20} className="text-on-surface-variant" />
              {t("info.change_wallpaper")}
            </button>

            <div className="w-full">
              <button
                onClick={handleClearHistoryClick}
                className={`w-full flex items-center justify-between gap-3 p-3 rounded-xl hover:bg-error/10 text-error font-semibold text-[13px] transition-all ${
                  showClearHistoryPanel ? "bg-error/10" : ""
                }`}
              >
                <span className="flex items-center gap-3">
                  <Trash2 size={20} />
                  {t("info.delete_chat_history")}
                </span>
                {isGroupOwner && (
                  <ChevronDown
                    size={14}
                    className={`text-error/70 transition-transform ${
                      showClearHistoryPanel ? "rotate-180" : ""
                    }`}
                  />
                )}
              </button>

              {/* Expandable panel for leader */}
              {isGroupOwner && showClearHistoryPanel && (
                <div className="mt-2 pl-10 pr-3 flex flex-col gap-1 overflow-hidden animate-in slide-in-from-top-2 duration-200">
                  <button
                    onClick={handleClearHistoryForMe}
                    className="w-full text-left py-2 px-3 rounded-lg hover:bg-error/10 text-error font-medium text-[12px] transition-colors"
                  >
                    {t("info.delete_chat_me_btn")}
                  </button>
                  <button
                    onClick={handleClearHistoryForEveryone}
                    className="w-full text-left py-2 px-3 rounded-lg hover:bg-error/10 text-error font-bold text-[12px] transition-colors"
                  >
                    {t("info.delete_chat_everyone_btn")}
                  </button>
                </div>
              )}
            </div>

            {activeChat.type === "group" && (
              <button
                onClick={() => setIsGroupShareOpen(true)}
                className="w-full flex items-center gap-3 p-3 rounded-xl hover:bg-surface-container text-on-surface font-semibold text-[13px] transition-all"
              >
                <QrCode size={20} className="text-on-surface-variant" />
                {t("info.share_link_qr")}
              </button>
            )}

            {/* Mute Setting */}
            {!isBot && (
              <div className="w-full">
                {/* Main button */}
                <button
                  onClick={handleToggleMute}
                  className={`w-full flex items-center justify-between gap-3 p-3 rounded-xl hover:bg-surface-container text-on-surface font-semibold text-[13px] transition-all ${
                    (muted || !!muteSummary) ? "bg-surface-container/60" : ""
                  }`}
                >
                  <span className="flex items-center gap-3">
                    {(muted || !!muteSummary) ? (
                      <BellOff size={20} className="text-primary" />
                    ) : (
                      <Bell size={20} className="text-on-surface-variant" />
                    )}
                    {t("info.mute_notifications")}
                  </span>
                  <span className="flex items-center gap-1.5">
                    {(muted || !!muteSummary) && (
                      <span className="text-[11px] font-bold text-primary">
                        {muteSummary || t("info.mute_label_muted")}
                      </span>
                    )}
                    <ChevronDown
                      size={14}
                      className={`text-on-surface-variant/50 transition-transform ${
                        showMutePanel ? "rotate-180" : ""
                      } ${(muted || !!muteSummary) ? "hidden" : ""}`}
                    />
                  </span>
                </button>

                {/* Duration picker panel (only when not muted) */}
                {showMutePanel && !(muted || muteSummary) && (
                  <div className="mx-1 mb-2 p-3 rounded-xl bg-surface-container border border-outline-variant/20 space-y-2 animate-in fade-in slide-in-from-top-2 duration-150">
                    <p className="text-[11px] font-bold text-on-surface-variant uppercase tracking-wider px-1">{t("info.mute_for")}</p>

                    {/* Quick presets */}
                    <div className="grid grid-cols-2 gap-1.5">
                      {[
                        { label: t("info.mute_1_hour"), ms: 60 * 60 * 1000 },
                        { label: t("info.mute_4_hours"), ms: 4 * 60 * 60 * 1000 },
                        { label: t("info.mute_12_hours"), ms: 12 * 60 * 60 * 1000 },
                        {
                          label: t("info.mute_until_8am"),
                          ms: (() => {
                            const now = new Date();
                            const target = new Date(now);
                            target.setHours(8, 0, 0, 0);
                            if (target <= now) target.setDate(target.getDate() + 1);
                            return target.getTime() - now.getTime();
                          })(),
                        },
                      ].map(({ label, ms }) => (
                        <button
                          key={label}
                          onClick={() => applyDurationMute(label, ms)}
                          className="px-3 py-2 rounded-xl bg-surface hover:bg-primary/10 hover:text-primary border border-outline-variant/20 text-[12px] font-semibold text-on-surface transition-colors text-center"
                        >
                          {label}
                        </button>
                      ))}
                      <button
                        onClick={() => applyDurationMute(t("info.mute_permanent"), null)}
                        className="col-span-2 px-3 py-2 rounded-xl bg-surface hover:bg-primary/10 hover:text-primary border border-outline-variant/20 text-[12px] font-semibold text-on-surface transition-colors"
                      >
                        {t("info.mute_permanent")}
                      </button>
                    </div>

                    {/* Custom time range collapsible */}
                    <button
                      onClick={() => setShowCustomTime((p) => !p)}
                      className="w-full flex items-center justify-between px-1 py-1 text-[11px] font-bold text-on-surface-variant/70 hover:text-primary transition-colors"
                    >
                      <span>{t("info.mute_custom")}</span>
                      <ChevronDown size={12} className={`transition-transform ${showCustomTime ? "rotate-180" : ""}`} />
                    </button>

                    {showCustomTime && (
                      <div className="space-y-2 pt-1">
                        <div className="flex items-center gap-2">
                          <div className="flex-1">
                            <label className="block text-[10px] text-on-surface-variant mb-1">{t("info.mute_from")}</label>
                            <input
                              type="time"
                              value={muteStartTime}
                              onChange={(e) => setMuteStartTime(e.target.value)}
                              className="w-full text-[12px] font-semibold bg-surface rounded-lg px-2 py-1.5 border border-outline-variant/30 focus:outline-none focus:ring-2 focus:ring-primary/30 text-on-surface"
                            />
                          </div>
                          <div className="flex-1">
                            <label className="block text-[10px] text-on-surface-variant mb-1">{t("info.mute_to")}</label>
                            <input
                              type="time"
                              value={muteEndTime}
                              onChange={(e) => setMuteEndTime(e.target.value)}
                              className="w-full text-[12px] font-semibold bg-surface rounded-lg px-2 py-1.5 border border-outline-variant/30 focus:outline-none focus:ring-2 focus:ring-primary/30 text-on-surface"
                            />
                          </div>
                        </div>
                        <p className="text-[10px] text-on-surface-variant/50">{t("info.mute_custom_desc")}</p>
                        <button
                          onClick={handleSaveMuteSchedule}
                          className="w-full flex items-center justify-center gap-1.5 px-3 py-2 bg-primary text-white rounded-xl text-[12px] font-bold hover:bg-primary/90 transition-colors"
                        >
                          <Check size={13} />
                          {t("info.mute_confirm_custom")}
                        </button>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}




            {activeChat.type === "group" && !isBot && (
              <>
                <div className="pt-4 pb-2">
                  <h4 className="px-3 text-[11px] font-extrabold text-on-surface-variant uppercase tracking-wider">
                    {t("info.group_mgmt")}
                  </h4>
                </div>

                <button
                  onClick={handleLeaveGroup}
                  className="w-full flex items-center gap-3 p-3 rounded-xl hover:bg-error/10 text-error font-bold text-[13px] transition-all"
                >
                  <LogOut size={20} />
                  {t("info.leave_group")}
                </button>

                {(activeChat.owner === user?.email ||
                  activeChat.admin === user?.email) && (
                  <button
                    onClick={handleDissolveGroup}
                    className="w-full flex items-center gap-3 p-3 rounded-xl hover:bg-error/10 text-error font-extrabold text-[13px] transition-all"
                  >
                    <Trash2 size={20} />
                    {t("info.dissolve_group")}
                  </button>
                )}

                <div className="pt-6 pb-2 flex items-center justify-between px-3">
                  <h4 className="text-[11px] font-extrabold text-on-surface-variant uppercase tracking-wider">
                    {t("info.members_count", { count: activeChat.members?.length || 0 })}
                  </h4>
                  {activeChat.type === "group" && (
                    <button
                      onClick={handleAddMembers}
                      className="p-1.5 rounded-full bg-primary/10 text-primary hover:bg-primary/20 transition-all"
                    >
                      <Plus size={16} />
                    </button>
                  )}
                </div>


                <div className="space-y-1 mt-1">
                  {activeChat.members?.map((memberEmail) => {
                    const memberEmailLower = String(memberEmail).trim().toLowerCase();
                    const isMe = memberEmail === user?.email;
                    const isOwner =
                      String(activeChat.owner || "").trim().toLowerCase() === memberEmailLower ||
                      String(activeChat.admin || "").trim().toLowerCase() === memberEmailLower;
                    const isDeputy = (activeChat.deputies || []).some(
                      (d) => String(d).trim().toLowerCase() === memberEmailLower,
                    );
                    const myRole = isGroupOwner
                      ? "owner"
                      : (activeChat.deputies || []).some(
                          (d) => String(d).trim().toLowerCase() === normalizedUserEmail
                        )
                        ? "deputy"
                        : "member";

                    return (
                      <div
                        key={memberEmail}
                        onClick={() => {
                          if (memberEmail) {
                            navigate(`/profile?email=${encodeURIComponent(memberEmail)}`);
                          }
                        }}
                        className="group/member flex items-center gap-3 p-2 rounded-xl hover:bg-surface-container transition-all cursor-pointer"
                      >
                        <img
                          src={getDisplayAvatar(
                            memberEmail,
                            user,
                            userProfiles,
                          )}
                          className="w-9 h-9 rounded-full object-cover border border-outline-variant/10"
                          alt=""
                        />
                        <div className="flex-1 min-w-0">
                          <p className="text-[13px] font-bold text-on-surface truncate">
                            {getDisplayName(memberEmail, user, userProfiles)}
                            {isMe && (
                              <span className="ml-1 opacity-50 font-medium">
                                {t("info.you")}
                              </span>
                            )}
                          </p>
                          <div className="flex items-center gap-1">
                            {isOwner && (
                              <span className="flex items-center gap-0.5 text-[10px] font-extrabold text-primary uppercase">
                                <ShieldCheck size={10} /> {t("info.owner")}
                              </span>
                            )}
                            {isDeputy && (
                              <span className="flex items-center gap-0.5 text-[10px] font-extrabold text-secondary uppercase">
                                <ShieldAlert size={10} /> {t("info.deputy")}
                              </span>
                            )}
                            {!isOwner && !isDeputy && (
                              <span className="flex items-center gap-0.5 text-[10px] font-bold text-on-surface-variant/70 uppercase">
                                {t("info.member")}
                              </span>
                            )}
                          </div>
                        </div>

                        {!isMe && (
                          <div className="flex items-center gap-1">
                            {myRole === "owner" && (
                              <div className="flex items-center gap-1">
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    const currentTargetRole = isOwner ? "owner" : (isDeputy ? "deputy" : "member");
                                    handleOpenChangeRoleDialog(memberEmail, currentTargetRole);
                                  }}
                                  title={t("info.change_role_btn_title")}
                                  className="p-1.5 rounded-lg hover:bg-surface-container-highest text-on-surface-variant hover:text-primary"
                                >
                                  <Settings size={16} />
                                </button>
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleKickMember(memberEmail);
                                  }}
                                  title={t("info.kick_btn_title")}
                                  className="p-1.5 rounded-lg hover:bg-error/10 text-error"
                                >
                                  <UserMinus size={16} />
                                </button>
                              </div>
                            )}
                            {myRole === "deputy" && !isOwner && !isDeputy && (
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleKickMember(memberEmail);
                                }}
                                title={t("info.kick_btn_title")}
                                className="p-1.5 rounded-lg hover:bg-error/10 text-error"
                              >
                                <UserMinus size={16} />
                              </button>
                            )}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </>
            )}
          </div>
        </div>
      </div>

      {showTransferOwnerModal && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/35">
          <button
            type="button"
            className="absolute inset-0 h-full w-full cursor-default"
            aria-label={t("modal.back")}
            onClick={() => {
              if (!isTransferringOwnership) {
                setShowTransferOwnerModal(false);
              }
            }}
          />
          <div className="relative z-10 w-full max-w-140 rounded-t-[28px] bg-white dark:bg-surface-container shadow-[0_-16px_40px_rgba(0,0,0,0.18)] border border-outline-variant/10 px-5 pb-6 pt-3">
            <div className="mx-auto mb-3 h-1.5 w-12 rounded-full bg-outline-variant/30" />
            <div className="flex items-start justify-between gap-4 mb-4">
              <div>
                <h3 className="text-[18px] font-extrabold text-on-surface">
                  {t("info.appoint_owner_title")}
                </h3>
                <p className="mt-1 text-[12px] text-on-surface-variant">
                  {t("info.appoint_owner_desc")}
                </p>
              </div>
              <button
                type="button"
                onClick={() => {
                  if (!isTransferringOwnership) {
                    setShowTransferOwnerModal(false);
                  }
                }}
                className="flex h-9 w-9 items-center justify-center rounded-full hover:bg-surface-container-high text-on-surface-variant"
              >
                <X size={20} />
              </button>
            </div>

            <div className="max-h-[48vh] space-y-2 overflow-y-auto pr-1 custom-scrollbar">
              {transferOwnerCandidates.length === 0 ? (
                <div className="rounded-2xl border border-dashed border-outline-variant/20 bg-surface-container-low px-4 py-8 text-center">
                  <p className="text-[13px] font-medium text-on-surface-variant">
                    {t("info.no_candidates")}
                  </p>
                </div>
              ) : (
                transferOwnerCandidates.map((memberEmail) => {
                  const isDeputy = (activeChat.deputies || []).includes(
                    memberEmail,
                  );
                  const isSelected = selectedNewOwnerEmail === memberEmail;
                  return (
                    <button
                      key={memberEmail}
                      type="button"
                      disabled={isTransferringOwnership}
                      onClick={() => setSelectedNewOwnerEmail(memberEmail)}
                      className={`flex w-full items-center gap-3 rounded-2xl border px-4 py-3 text-left transition-all disabled:cursor-not-allowed disabled:opacity-60 ${
                        isSelected
                          ? "border-primary/40 bg-primary/5"
                          : "border-outline-variant/10 bg-surface-container-lowest hover:bg-primary/5"
                      }`}
                    >
                      <img
                        src={getDisplayAvatar(memberEmail, user, userProfiles)}
                        className="h-11 w-11 rounded-full object-cover border border-outline-variant/10"
                        alt=""
                      />
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-[14px] font-bold text-on-surface">
                          {getDisplayName(memberEmail, user, userProfiles)}
                        </p>
                        <p className="text-[12px] text-on-surface-variant">
                          {isDeputy ? t("info.deputy") : t("info.role_member")}
                        </p>
                      </div>
                      <div
                        className={`flex h-6 w-6 items-center justify-center rounded-full border-2 ${
                          isSelected
                            ? "border-primary bg-primary"
                            : "border-outline-variant/40"
                        }`}
                      >
                        {isSelected && (
                          <Check size={14} className="text-white" />
                        )}
                      </div>
                    </button>
                  );
                })
              )}
            </div>

            <div className="mt-4 flex justify-end gap-2 border-t border-outline-variant/10 pt-4">
              <button
                type="button"
                disabled={isTransferringOwnership}
                onClick={() => setShowTransferOwnerModal(false)}
                className="rounded-xl bg-surface-container-high px-4 py-2 text-[13px] font-semibold text-on-surface disabled:opacity-60"
              >
                {t("inbox.cancel")}
              </button>
              <button
                type="button"
                disabled={
                  isTransferringOwnership ||
                  !selectedNewOwnerEmail ||
                  transferOwnerCandidates.length === 0
                }
                onClick={() => {
                  if (selectedNewOwnerEmail) {
                    void handleTransferOwnershipAndLeave(selectedNewOwnerEmail);
                  }
                }}
                className="inline-flex items-center gap-2 rounded-xl bg-primary px-4 py-2 text-[13px] font-bold text-white disabled:cursor-not-allowed disabled:opacity-60"
              >
                {isTransferringOwnership && (
                  <Loader2 size={16} className="animate-spin" />
                )}
                {t("info.appoint_leave_btn")}
              </button>
            </div>
          </div>
        </div>
      )}

      {showAutoDeleteModal && (
        <div className="absolute inset-0 z-50 flex items-center justify-center bg-black/35 p-4">
          <div className="w-full max-w-115 rounded-2xl bg-white dark:bg-surface-container shadow-2xl border border-outline-variant/20 overflow-hidden">
            <div className="flex items-center justify-between px-6 py-4 border-b border-outline-variant/20">
              <h3 className="text-[18px] font-extrabold text-on-surface">
                {t("info.auto_delete_title")}
              </h3>
              <button
                onClick={() => setShowAutoDeleteModal(false)}
                type="button"
                className="w-9 h-9 rounded-full hover:bg-surface-container flex items-center justify-center text-on-surface-variant"
              >
                <X size={22} />
              </button>
            </div>

            <div className="px-6 py-5 space-y-5">
              {[1, 7, 30].map((days) => (
                <label
                  key={days}
                  className="flex items-center gap-3 cursor-pointer"
                >
                  <input
                    type="radio"
                    checked={pendingAutoDeleteDays === days}
                    onChange={() =>
                      setPendingAutoDeleteDays(days as 1 | 7 | 30)
                    }
                    className="w-4 h-4"
                  />
                  <span className="text-[18px] text-on-surface">
                    {t("info.auto_delete_days", { count: days })}
                  </span>
                </label>
              ))}

              <label className="flex items-center gap-3 cursor-pointer">
                <input
                  type="radio"
                  checked={pendingAutoDeleteDays === null}
                  onChange={() => setPendingAutoDeleteDays(null)}
                  className="w-4 h-4"
                />
                <span className="text-[18px] text-on-surface">
                  {t("info.never")}
                </span>
              </label>
            </div>

            <div className="flex justify-end gap-3 px-6 py-4 border-t border-outline-variant/20 bg-surface-container/40">
              <button
                onClick={() => setShowAutoDeleteModal(false)}
                className="px-6 py-3 rounded-lg bg-surface-container-high text-on-surface font-bold hover:opacity-90"
                type="button"
              >
                {t("inbox.cancel")}
              </button>
              <button
                onClick={confirmAutoDelete}
                disabled={
                  savingAutoDelete ||
                  pendingAutoDeleteDays === currentAutoDeleteDays
                }
                className="px-6 py-3 rounded-lg bg-primary text-white font-bold disabled:opacity-50"
                type="button"
              >
                {savingAutoDelete ? t("info.saving") : t("modal.confirm")}
              </button>
            </div>
          </div>
        </div>
      )}

      <ChatWallpaperModal
        isOpen={isWallpaperModalOpen}
        onClose={() => setIsWallpaperModalOpen(false)}
        conversationId={activeConvId || ""}
      />

      {isAddMembersModalOpen && (
        <AddMembersModal
          isOpen={isAddMembersModalOpen}
          onClose={() => setIsAddMembersModalOpen(false)}
          conversationId={activeConvId || ""}
          currentMembers={activeChat?.members || []}
        />
      )}

      {isGroupShareOpen && (
        <GroupShareModal
          isOpen={isGroupShareOpen}
          onClose={() => setIsGroupShareOpen(false)}
          conversationId={activeChat.id}
        />
      )}
    </div>
  );
};

export default ChatInfoSidebar;
