import React, { useState, useEffect, useCallback, useRef, useMemo } from "react";
import { useAuth } from "../../context/AuthContext";
import { useChatStore } from "../../store/chatStore";
import { getDisplayName, getDisplayAvatar } from "../../utils/chatUtils";
import {
  X,
  Search,
  CheckCircle2,
  Loader2,
  UserPlus,
  AlertCircle,
} from "lucide-react";
import Swal from "sweetalert2";
import api from "../../services/api";
import { useTheme } from "../../context/ThemeContext";

interface AddMembersModalProps {
  isOpen: boolean;
  onClose: () => void;
  conversationId: string;
  currentMembers: string[]; // Array of member emails already in the group
}

interface ContactItem {
  email: string;
  displayName: string;
  avatarUrl: string;
  fullName?: string;
  isFriend: boolean;
}

const AddMembersModal: React.FC<AddMembersModalProps> = ({
  isOpen,
  onClose,
  conversationId,
  currentMembers,
}) => {
  const { t } = useTheme();
  const { user } = useAuth();
  const { addMembers, userProfiles } = useChatStore();

  const [search, setSearch] = useState("");
  const [friends, setFriends] = useState<ContactItem[]>([]);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [isLoading, setIsLoading] = useState(false);
  const [isAdding, setIsAdding] = useState(false);

  // Email search states
  const [isSearchingEmail, setIsSearchingEmail] = useState(false);
  const [emailSearchResult, setEmailSearchResult] =
    useState<ContactItem | null>(null);
  const [emailSearchError, setEmailSearchError] = useState<string | null>(null);
  const searchTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const currentMembersLower = useMemo(
    () => currentMembers.map((m) => m.toLowerCase()),
    [currentMembers]
  );

  const fetchFriends = useCallback(async () => {
    try {
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

  // Reset when modal opens
  const [prevIsOpen, setPrevIsOpen] = useState(false);
  if (isOpen && !prevIsOpen) {
    setPrevIsOpen(true);
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

  // Debounced search for email or phone
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

    if (trimmed.toLowerCase() === (user?.email || "").toLowerCase()) return;

    setIsSearchingEmail(true);
    searchTimeoutRef.current = setTimeout(async () => {
      try {
        const url = isEmail
          ? `/chat/friends/search?email=${encodeURIComponent(trimmed)}`
          : `/chat/friends/search?phone=${encodeURIComponent(cleanQuery)}`;

        const res = await api.get(url);
        const data = res.data;
        if (data.found && !data.isSelf) {
          const isFriend = data.friendship?.status === "accepted";
          const alreadyInGroup = currentMembersLower.includes(
            data.user.email.toLowerCase(),
          );
          if (alreadyInGroup) {
            setEmailSearchError(t("group.already_in_group"));
          } else {
            setEmailSearchResult({
              email: data.user.email,
              displayName: data.user.fullName || data.user.email,
              avatarUrl: data.user.avatarUrl || "",
              isFriend,
            });
            setEmailSearchError(null);
          }
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
  }, [search, friends, user?.email, currentMembersLower, t]);

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

  const handleAddMembers = async () => {
    if (selectedIds.size === 0) {
      Swal.fire(t("modal.error"), t("group.select_one_member"), "error");
      return;
    }

    setIsAdding(true);
    try {
      const membersToAdd = Array.from(selectedIds);
      await addMembers(conversationId, membersToAdd);
      Swal.fire({
        title: t("group.add_members_success"),
        icon: "success",
        timer: 1500,
        showConfirmButton: false,
      });
      onClose();
    } catch (error: any) {
      const msg =
        error?.response?.data?.message ||
        t("group.add_members_error");
      Swal.fire(t("group.failure"), msg, "error");
    } finally {
      setIsAdding(false);
    }
  };

  const filtered = friends.filter((f) => {
    // Don't show members already in the group
    if (currentMembersLower.includes(f.email.toLowerCase())) return false;
    // Filter by search
    return (
      (f.displayName || f.email).toLowerCase().includes(search.toLowerCase()) ||
      f.email.toLowerCase().includes(search.toLowerCase())
    );
  });

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/40 backdrop-blur-[2px] animate-in fade-in duration-200">
      <div className="bg-white dark:bg-surface-container rounded-3xl w-full max-w-[500px] shadow-2xl flex flex-col overflow-hidden animate-in zoom-in-95 duration-300 max-h-[85vh]">
        {/* Header */}
        <div className="px-5 py-4 border-b border-outline-variant/10 dark:border-outline-variant/20 flex items-center justify-between">
          <h2 className="text-[16px] font-extrabold text-on-surface flex items-center gap-2">
            <UserPlus size={18} className="text-primary" />
            {t("group.add_members")}
          </h2>
          <button
            onClick={onClose}
            className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-surface-container-high transition-colors"
          >
            <X size={20} className="text-on-surface-variant" />
          </button>
        </div>

        {/* Search */}
        <div className="p-5 border-b border-outline-variant/10">
          <div className="bg-surface-container-low border border-outline-variant/20 rounded-xl flex items-center px-4 py-2 gap-2 focus-within:ring-2 focus-within:ring-primary/20 transition-all">
            <Search size={18} className="text-on-surface-variant/50" />
            <input
              type="text"
              placeholder={t("group.search_placeholder")}
              className="bg-transparent flex-1 outline-none text-[14px] text-on-surface placeholder:text-on-surface-variant/50"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              autoFocus
            />
            {isSearchingEmail && (
              <Loader2 size={16} className="text-primary animate-spin" />
            )}
          </div>
        </div>

        {/* Members List */}
        <div className="flex-1 overflow-y-auto px-3 pb-3 space-y-1 custom-scrollbar min-h-[250px]">
          {/* Email search result */}
          {emailSearchResult && (
            <div className="mb-2 mt-2">
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

          {emailSearchError && (search.includes("@") || /^[0-9+]{9,15}$/.test(search.trim())) && (
            <div className="mb-2 mt-2 px-3">
              <p className="text-[12px] text-error font-medium flex items-center gap-1.5">
                <AlertCircle size={14} />
                {emailSearchError}
              </p>
            </div>
          )}

          {/* Friends list */}
          <p className="text-[11px] font-bold text-on-surface-variant uppercase tracking-wider px-3 pb-1 mt-2">
            {t("profile.friends")}
          </p>
          {isLoading ? (
            <div className="flex justify-center items-center h-20">
              <Loader2 size={24} className="text-primary animate-spin" />
            </div>
          ) : filtered.length === 0 ? (
            <div className="text-center p-8 opacity-50">
              <p className="text-[13px]">
                {search
                  ? t("group.no_friends_found")
                  : t("group.all_friends_in_group")}
              </p>
            </div>
          ) : (
            filtered.map((f) => {
              const isSelected = selectedIds.has(f.email);
              return (
                <div
                  key={f.email}
                  onClick={() => handleToggle(f.email)}
                  className={`flex items-center p-3 gap-3 rounded-2xl cursor-pointer transition-all ${
                    isSelected
                      ? "bg-primary/5"
                      : "hover:bg-surface-container-high"
                  }`}
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
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-outline-variant/10 bg-surface-container-lowest flex items-center justify-between gap-3">
          <span className="text-[13px] font-medium text-on-surface-variant">
            {t("group.selected_count", { count: selectedIds.size })}
          </span>
          <div className="flex gap-2">
            <button
              onClick={onClose}
              className="px-5 py-2.5 rounded-full font-bold text-[14px] bg-surface-container-high text-on-surface hover:bg-surface-container-highest transition-all"
            >
              {t("inbox.cancel")}
            </button>
            <button
              onClick={handleAddMembers}
              disabled={selectedIds.size === 0 || isAdding}
              className="bg-primary text-white px-5 py-2.5 rounded-full font-bold text-[14px] flex items-center gap-2 hover:bg-primary/90 active:scale-95 transition-all disabled:opacity-50 shadow-md shadow-primary/20"
            >
              {isAdding ? (
                <Loader2 size={18} className="animate-spin" />
              ) : (
                <UserPlus size={18} />
              )}
              {t("modal.confirm")}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AddMembersModal;
