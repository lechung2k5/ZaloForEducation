import React, { useState, useEffect, useCallback, useRef } from "react";
import { useAuth } from "../../context/AuthContext";
import { useChatStore } from "../../store/chatStore";
import { getDisplayName, getDisplayAvatar } from "../../utils/chatUtils";
import {
  X,
  Users,
  Search,
  CheckCircle2,
  UserPlus,
  Loader2,
  Camera,
  AlertCircle,
} from "lucide-react";
import Swal from "sweetalert2";
import api from "../../services/api";
import { useTheme } from "../../context/ThemeContext";

interface CreateGroupModalProps {
  isOpen: boolean;
  onClose: () => void;
}

interface ContactItem {
  email: string;
  displayName: string;
  avatarUrl: string;
  fullName?: string;
  isFriend: boolean;
}

const CreateGroupModal: React.FC<CreateGroupModalProps> = ({
  isOpen,
  onClose,
}) => {
  const { t } = useTheme();
  const { user } = useAuth();
  const {
    createGroupConversation,
    setActiveConversation,
    userProfiles,
  } = useChatStore();
  const [groupName, setGroupName] = useState("");
  const [search, setSearch] = useState("");
  const [friends, setFriends] = useState<ContactItem[]>([]);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [isLoading, setIsLoading] = useState(false);
  const [isCreating, setIsCreating] = useState(false);

  // Email search states
  const [isSearchingEmail, setIsSearchingEmail] = useState(false);
  const [emailSearchResult, setEmailSearchResult] = useState<ContactItem | null>(null);
  const [emailSearchError, setEmailSearchError] = useState<string | null>(null);
  const searchTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const fetchFriends = useCallback(async () => {
    try {
      // Fetch actual friends list from the API
      const res = await api.get("/chat/friends");
      const friendships = res.data || [];
      const acceptedFriends = friendships.filter(
        (f: any) => f.status === "accepted",
      );

      const contactsMap = new Map<string, ContactItem>();
      for (const f of acceptedFriends) {
        const otherEmail =
          String(f.sender_id || "").trim().toLowerCase() ===
          (user?.email || "").toLowerCase()
            ? String(f.receiver_id || "").trim().toLowerCase()
            : String(f.sender_id || "").trim().toLowerCase();

        if (otherEmail && otherEmail !== (user?.email || "").toLowerCase()) {
          contactsMap.set(otherEmail, {
            email: otherEmail,
            displayName: getDisplayName(otherEmail, user, userProfiles),
            avatarUrl: getDisplayAvatar(otherEmail, user, userProfiles),
            isFriend: true,
          });
        }
      }

      setFriends(Array.from(contactsMap.values()));
    } catch (err) {
      console.error("Failed to fetch friends", err);
      setFriends([]);
    } finally {
      setIsLoading(false);
    }
  }, [user, userProfiles]);

  // Reset form state when modal opens
  const [prevIsOpen, setPrevIsOpen] = useState(false);
  if (isOpen && !prevIsOpen) {
    setPrevIsOpen(true);
    setGroupName("");
    setSearch("");
    setSelectedIds(new Set());
    setIsLoading(true);
    setEmailSearchResult(null);
    setEmailSearchError(null);
  }
  if (!isOpen && prevIsOpen) {
    setPrevIsOpen(false);
  }

  useEffect(() => {
    if (isOpen) {
      fetchFriends();
    }
  }, [isOpen, fetchFriends]);

  // Debounced email search
  useEffect(() => {
    if (searchTimeoutRef.current) clearTimeout(searchTimeoutRef.current);
    setEmailSearchResult(null);
    setEmailSearchError(null);

    const trimmed = search.trim();
    if (!trimmed) return;

    const cleanQuery = trimmed.replace(/[\s-()]/g, "");
    const isEmail = trimmed.includes("@");
    const isPhone = /^[0-9+]{9,15}$/.test(cleanQuery);

    if (!isEmail && !isPhone) return;

    // Don't search own email
    if (trimmed.toLowerCase() === (user?.email || "").toLowerCase()) return;

    // Check if already in friends list
    const alreadyInList = friends.some(
      (f) => f.email.toLowerCase() === trimmed.toLowerCase(),
    );
    if (alreadyInList) return;

    setIsSearchingEmail(true);
    searchTimeoutRef.current = setTimeout(async () => {
      try {
        const url = isEmail
          ? `/chat/friends/search?email=${encodeURIComponent(trimmed)}`
          : `/chat/friends/search?phone=${encodeURIComponent(cleanQuery)}`;

        const res = await api.get(url);
        const data = res.data;
        if (data.found && !data.isSelf) {
          const isFriend =
            data.friendship?.status === "accepted";
          setEmailSearchResult({
            email: data.user.email,
            displayName: data.user.fullName || data.user.email,
            avatarUrl: data.user.avatarUrl || "",
            isFriend,
          });
          setEmailSearchError(null);
        } else if (data.isSelf) {
          setEmailSearchError(t("group.self_add_error"));
        } else {
          setEmailSearchError(t("group.user_not_found"));
        }
      } catch {
        setEmailSearchError(t("group.user_not_found"));
      } finally {
        setIsSearchingEmail(false);
      }
    }, 500);

    return () => {
      if (searchTimeoutRef.current) clearTimeout(searchTimeoutRef.current);
    };
  }, [search, friends, user?.email, t]);

  const [avatarFile, setAvatarFile] = useState<File | null>(null);
  const [avatarPreview, setAvatarPreview] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleToggle = (email: string) => {
    const next = new Set(selectedIds);
    if (next.has(email)) {
      next.delete(email);
    } else {
      next.add(email);
    }
    setSelectedIds(next);
  };

  const handleAvatarChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setAvatarFile(file);
      const reader = new FileReader();
      reader.onloadend = () => {
        setAvatarPreview(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleCreate = async () => {
    if (selectedIds.size < 2) {
      Swal.fire(t("modal.error"), t("group.min_members"), "error");
      return;
    }
    if (!groupName.trim()) {
      Swal.fire(t("modal.error"), t("group.name_required"), "error");
      return;
    }

    setIsCreating(true);
    try {
      let avatarUrl = "";
      if (avatarFile) {
        const formData = new FormData();
        formData.append("file", avatarFile);
        const uploadRes = await api.post("/chat/uploads", formData, {
          headers: { "Content-Type": "multipart/form-data" },
        });
        avatarUrl = uploadRes.data.fileUrl || uploadRes.data.dataUrl || "";
      }

      const members = Array.from(selectedIds);
      // Backend automatically adds the creator
      const newGroup = await createGroupConversation(
        groupName.trim(),
        members,
        avatarUrl,
      );
      Swal.fire({
        title: t("group.create_success"),
        icon: "success",
        timer: 1500,
        showConfirmButton: false,
      });
      onClose();
      // Jump to this conversation (backend returns `id`)
      const convId = newGroup?.id || newGroup?._id || newGroup?.convId;
      if (convId) setActiveConversation(convId);
    } catch (err: any) {
      const msg =
        err?.response?.data?.message ||
        t("group.create_error");
      Swal.fire(t("group.failure"), msg, "error");
    } finally {
      setIsCreating(false);
    }
  };

  const filtered = friends.filter((f) =>
    (f.displayName || f.email).toLowerCase().includes(search.toLowerCase()),
  );

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/40 backdrop-blur-[2px] animate-in fade-in duration-200">
      <div className="bg-white dark:bg-surface-container rounded-3xl w-full max-w-[420px] shadow-2xl flex flex-col overflow-hidden animate-in zoom-in-95 duration-300 max-h-[85vh]">
        {/* Header */}
        <div className="px-5 py-4 border-b border-outline-variant/10 dark:border-outline-variant/20 flex items-center justify-between">
          <h2 className="text-[16px] font-extrabold text-on-surface flex items-center gap-2">
            <Users size={18} className="text-primary" />
            {t("group.create_title")}
          </h2>
          <button
            onClick={onClose}
            className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-surface-container-high transition-colors"
          >
            <X size={20} className="text-on-surface-variant" />
          </button>
        </div>

        <div className="p-5 flex flex-col gap-4">
          <div className="flex items-center gap-4">
            <div className="relative group">
              <div className="w-16 h-16 rounded-2xl bg-surface-container-high flex items-center justify-center overflow-hidden border-2 border-outline-variant/20 group-hover:border-primary/30 transition-all">
                {avatarPreview ? (
                  <img
                    src={avatarPreview}
                    className="w-full h-full object-cover"
                    alt=""
                  />
                ) : (
                  <Camera
                    size={24}
                    className="text-on-surface-variant/50 group-hover:text-primary transition-colors"
                  />
                )}
              </div>
              <input
                type="file"
                accept="image/*"
                onChange={handleAvatarChange}
                className="absolute inset-0 opacity-0 cursor-pointer"
              />
            </div>
            <div className="flex-1 space-y-1">
              <label className="text-[13px] font-bold text-on-surface">
                {t("group.name_label")}
              </label>
              <input
                value={groupName}
                onChange={(e) => setGroupName(e.target.value)}
                placeholder={t("group.name_placeholder")}
                className="w-full bg-surface-container-low border border-outline-variant/20 rounded-xl px-4 py-3 outline-none focus:ring-2 focus:ring-primary/20 transition-all text-[14px]"
              />
            </div>
          </div>

          <div className="space-y-1">
            <label className="text-[13px] font-bold text-on-surface">
              {t("group.add_members_friends")}
            </label>
            <div className="bg-surface-container-low border border-outline-variant/20 rounded-xl flex items-center px-4 py-2 gap-2 focus-within:ring-2 focus-within:ring-primary/20 transition-all">
              <Search size={18} className="text-on-surface-variant/50" />
              <input
                type="text"
                placeholder={t("group.search_placeholder")}
                className="bg-transparent flex-1 outline-none text-[14px] text-on-surface placeholder:text-on-surface-variant/50"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
              {isSearchingEmail && (
                <Loader2 size={16} className="text-primary animate-spin" />
              )}
            </div>
          </div>
        </div>

        {/* List */}
        <div className="flex-1 overflow-y-auto px-3 pb-3 space-y-1 custom-scrollbar min-h-[250px]">
          {/* Email search result (if not already in friend list) */}
          {emailSearchResult && (
            <div className="mb-2">
              <p className="text-[11px] font-bold text-on-surface-variant uppercase tracking-wider px-3 pb-1">
                {t("group.search_results")}
              </p>
              <div
                onClick={() => handleToggle(emailSearchResult.email)}
                className={`flex items-center p-3 gap-3 rounded-2xl cursor-pointer transition-all ${
                  selectedIds.has(emailSearchResult.email)
                    ? "bg-primary/5"
                    : "hover:bg-surface-container-high"
                }`}
              >
                <img
                  src={emailSearchResult.avatarUrl || "/avatar_placeholder.png"}
                  className="w-10 h-10 rounded-full object-cover ring-1 ring-black/5"
                  alt=""
                />
                <div className="flex-1 min-w-0">
                  <h3 className="text-[14px] font-bold text-on-surface truncate">
                    {emailSearchResult.displayName}
                  </h3>
                  <p className="text-[12px] text-on-surface-variant truncate">
                    {emailSearchResult.email}
                  </p>
                  {!emailSearchResult.isFriend && (
                    <p className="text-[11px] text-on-surface-variant/70 font-medium flex items-center gap-1 mt-0.5">
                      <AlertCircle size={12} />
                      {t("group.not_friend")}
                    </p>
                  )}
                </div>
                {selectedIds.has(emailSearchResult.email) ? (
                  <div className="w-5 h-5 rounded-full bg-primary flex items-center justify-center">
                    <CheckCircle2 size={14} className="text-white" />
                  </div>
                ) : (
                  <div className="w-5 h-5 rounded-full border-2 border-outline-variant/30" />
                )}
              </div>
            </div>
          )}

          {emailSearchError && search.includes("@") && (
            <div className="mb-2 px-3">
              <p className="text-[12px] text-error font-medium flex items-center gap-1.5">
                <AlertCircle size={14} />
                {emailSearchError}
              </p>
            </div>
          )}

          {/* Friends list */}
          <p className="text-[11px] font-bold text-on-surface-variant uppercase tracking-wider px-3 pb-1">
            {t("profile.friends")}
          </p>
          {isLoading ? (
            <div className="flex justify-center items-center h-20">
              <Loader2 size={24} className="text-primary animate-spin" />
            </div>
          ) : (
            filtered.map((f) => {
              const isSelected = selectedIds.has(f.email);
              return (
                <div
                  key={f.email}
                  onClick={() => handleToggle(f.email)}
                  className={`flex items-center p-3 gap-3 rounded-2xl cursor-pointer transition-all ${isSelected ? "bg-primary/5" : "hover:bg-surface-container-high"}`}
                >
                  <img
                    src={f.avatarUrl || "/avatar_placeholder.png"}
                    className="w-10 h-10 rounded-full object-cover ring-1 ring-black/5"
                    alt=""
                  />
                  <div className="flex-1 min-w-0">
                    <h3 className="text-[14px] font-bold text-on-surface truncate">
                      {f.displayName || f.fullName || f.email}
                    </h3>
                    {f.displayName && (
                      <p className="text-[12px] text-on-surface-variant truncate">
                        {f.email}
                      </p>
                    )}
                  </div>
                  {!isSelected && (
                    <div className="w-5 h-5 rounded-full border-2 border-outline-variant/30" />
                  )}
                  {isSelected && (
                    <div className="w-5 h-5 rounded-full bg-primary flex items-center justify-center">
                      <CheckCircle2 size={14} className="text-white" />
                    </div>
                  )}
                </div>
              );
            })
          )}
          {!isLoading && filtered.length === 0 && !emailSearchResult && (
            <div className="text-center p-8 opacity-50">
              <p className="text-[13px]">{t("group.no_friends_found")}</p>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-outline-variant/10 bg-surface-container-lowest">
          <div className="flex items-center justify-between">
            <span className="text-[13px] font-medium text-on-surface-variant">
              {t("group.selected_count", { count: selectedIds.size })}
            </span>
            <button
              onClick={handleCreate}
              disabled={selectedIds.size < 2 || !groupName.trim() || isCreating}
              className="bg-primary text-white px-5 py-2.5 rounded-full font-bold text-[14px] flex items-center gap-2 hover:bg-primary/90 active:scale-95 transition-all disabled:opacity-50 shadow-md shadow-primary/20"
            >
              {isCreating ? (
                <Loader2 size={18} className="animate-spin" />
              ) : (
                <UserPlus size={18} />
              )}
              {t("group.create_button")}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default CreateGroupModal;
