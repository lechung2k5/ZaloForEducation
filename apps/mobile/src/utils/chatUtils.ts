export const timeToMinutes = (timeString: string) => {
  const [hours, minutes] = String(timeString || "00:00")
    .split(":")
    .map(Number);
  if (Number.isNaN(hours) || Number.isNaN(minutes)) return 0;
  return hours * 60 + minutes;
};

export const isValidTimeString = (value: string) =>
  /^([01]\d|2[0-3]):([0-5]\d)$/.test(String(value || "").trim());

export const createMuteUntilHours = (hours: number) => {
  const now = Date.now();
  const endAt = now + hours * 60 * 60 * 1000;
  return { enabled: true, mode: `hours_${hours}`, endAt, createdAt: now };
};

export const createMuteUntilMorning = (targetHour = 8) => {
  const now = new Date();
  const end = new Date(now);
  end.setHours(targetHour, 0, 0, 0);
  if (end.getTime() <= now.getTime()) end.setDate(end.getDate() + 1);
  return {
    enabled: true,
    mode: "until_morning",
    endAt: end.getTime(),
    createdAt: now.getTime(),
  };
};

export const createCustomWindowMuteSchedule = (
  startTime: string,
  endTime: string,
) => ({
  enabled: true,
  mode: "custom_window",
  startTime,
  endTime,
  createdAt: Date.now(),
});

export const pruneExpiredSchedules = (map: Record<string, any>) => {
  const safeMap = map && typeof map === "object" ? map : {};
  const now = Date.now();
  const next: Record<string, any> = {};
  Object.entries(safeMap).forEach(([convId, schedule]: [string, any]) => {
    if (!schedule || schedule.enabled !== true) return;
    if (schedule.mode === "custom_window") {
      if (
        !isValidTimeString(schedule.startTime) ||
        !isValidTimeString(schedule.endTime)
      )
        return;
      next[convId] = schedule;
      return;
    }
    if (typeof schedule.endAt !== "number") return;
    if (schedule.endAt <= now) return;
    next[convId] = schedule;
  });
  return next;
};

export const getMuteLabel = (schedule: any) => {
  if (!schedule) return "Đã tắt thông báo";
  if (
    schedule.mode === "custom_window" &&
    schedule.startTime &&
    schedule.endTime
  ) {
    return `Đã tắt theo khung ${schedule.startTime} - ${schedule.endTime}`;
  }
  if (typeof schedule.endAt !== "number") return "Đã tắt thông báo";
  const endTime = new Date(schedule.endAt).toLocaleTimeString("vi-VN", {
    hour: "2-digit",
    minute: "2-digit",
  });
  return `Đã tắt thông báo đến ${endTime}`;
};

export const getMessagePreview = (message: any): string => {
  if (!message) return "Tin nhắn";
  if (message.recalled) return "Tin nhắn đã được thu hồi";

  const contentStr = typeof message.content === "string" ? message.content : "";

  // Rich Preview for Calls
  if (
    message.type === "call" ||
    message.type === "SYSTEM_CALL" ||
    (message.type === "system" && contentStr.includes("Cuộc gọi"))
  ) {
    const meta = message.metadata || {};
    const isVideo = meta.callType === "video" || contentStr.includes("video");
    const label = isVideo ? "Video" : "Thoại";
    const status = (meta.callStatus || "").toLowerCase();
    if (
      status === "missed" ||
      status === "no_answer" ||
      status === "cancelled"
    ) {
      return `[Cuộc gọi ${label} nhỡ]`;
    }
    return `[Cuộc gọi ${label}]`;
  }

  if (message.type === "system") {
    try {
      const parsed = JSON.parse(contentStr);
      if (parsed.action) {
        switch (parsed.action) {
          case "member_added":
            return "[Thêm thành viên]";
          case "member_removed":
          case "member_kicked":
            return "[Xóa thành viên]";
          case "member_left":
            return "[Rời nhóm]";
          case "member_joined_link":
            return "[Tham gia bằng link]";
          case "promoted_to_deputy":
          case "demoted_from_deputy":
          case "demoted_to_member":
          case "ownership_transferred":
          case "transferred_owner":
          case "role_updated":
            return "[Cập nhật vai trò]";
          case "info_updated":
          case "group_name_updated":
          case "group_avatar_updated":
            return "[Cập nhật thông tin]";
          case "group_created":
            return "[Tạo nhóm]";
          case "pin_message":
            return "[Ghim tin nhắn]";
          case "unpin_message":
            return "[Bỏ ghim tin nhắn]";
          default:
            return "[Thông báo hệ thống]";
        }
      }
      if (typeof parsed === 'object' && parsed !== null) {
        return "[Thông báo hệ thống]";
      }
    } catch (e) {}
  }

  if (message.type === "contact_card") return "[Danh thiếp]";

  // Check known placeholders first
  const knownPlaceholders = [
    "[Sticker]",
    "[Hình ảnh]",
    "[Ảnh HD]",
    "[Ảnh/Video]",
    "[Tin nhắn thoại]",
    "[Ghi âm]",
    "[Tệp tin]",
    "[Tệp đính kèm]",
    "[Danh thiếp]",
    "[Vị trí]",
  ];
  if (knownPlaceholders.includes(contentStr)) return contentStr;

  // Media detection
  const mediaArr = Array.isArray(message.media) ? message.media : [];
  if (mediaArr.length > 0) {
    const hasSticker = mediaArr.some((item: any) => {
      const mime = String(item?.mimeType || item?.fileType || "").toLowerCase();
      return mime.includes("sticker") || item?.isSticker === true;
    });
    if (hasSticker) return "[Sticker]";

    const hasHD = mediaArr.some((item: any) => item?.isHD === true);
    if (hasHD) return "[Ảnh HD]";

    return "[Hình ảnh]";
  }

  // File/Audio detection
  const filesArr = Array.isArray(message.files) ? message.files : [];
  if (filesArr.length > 0) {
    const hasAudio = filesArr.some((f: any) => {
      const mime = String(f?.mimeType || f?.fileType || "").toLowerCase();
      return mime.startsWith("audio/");
    });
    if (hasAudio) return "[Tin nhắn thoại]";
    return "[Tệp đính kèm]";
  }

  return message.content || "Tin nhắn";
};

export const formatSystemPreview = (
  content: string | undefined,
  senderId: string | undefined,
  userProfiles: Record<string, any> = {},
  currentUserEmail: string | undefined = "",
): string => {
  if (!content) return "Tin nhắn";
  if (typeof content !== "string") return String(content);

  try {
    const parsed = JSON.parse(content);
    if (parsed && parsed.action) {
      const nameOf = (email: string | undefined) => {
        if (!email) return "";
        const normalized = String(email || "")
          .trim()
          .toLowerCase();
        if (
          normalized ===
          String(currentUserEmail || "")
            .trim()
            .toLowerCase()
        )
          return "Bạn";
        const p = userProfiles[normalized];
        if (p) return p.nickname || p.fullName || p.fullname || normalized;
        return String(email).split("@")[0];
      };

      const actor = parsed.actor || senderId;
      const actorName = nameOf(actor);

      switch (parsed.action) {
        case "group_created":
          return actorName + " đã tạo nhóm";
        case "member_added": {
          const added =
            parsed.members ||
            (parsed.member ? [parsed.member] : parsed.added || []);
          const names = Array.isArray(added)
            ? added.map((e: string) => nameOf(e)).filter(Boolean)
            : [];
          return names.length > 0
            ? `${actorName} đã thêm ${names.join(", ")}`
            : `${actorName} đã thêm thành viên`;
        }
        case "member_removed":
        case "member_kicked": {
          const removed = parsed.member || parsed.target || parsed.removed;
          const name = nameOf(removed);
          return name
            ? `${actorName} đã xóa ${name} khỏi nhóm`
            : `${actorName} đã xóa thành viên`;
        }
        case "member_left": {
          const who = parsed.member || parsed.actor || senderId;
          const name = nameOf(who);
          return name ? `${name} đã rời nhóm` : "Đã rời nhóm";
        }
        case "member_joined_link": {
          const who = parsed.member || parsed.actor || senderId;
          const name = nameOf(who);
          return name ? `${name} đã tham gia nhóm bằng link` : "Đã tham gia nhóm bằng link";
        }
        case "transferred_owner":
        case "ownership_transferred":
        case "role_updated":
        case "promoted_to_deputy":
        case "demoted_from_deputy":
        case "demoted_to_member": {
          const targetEmail = parsed.target || parsed.to || parsed.member;
          const targetName = nameOf(targetEmail);
          const role = parsed.role || parsed.toRole || parsed.newRole || "";
          
          if (parsed.action === "transferred_owner" || parsed.action === "ownership_transferred") {
            return `${actorName} đã chuyển quyền trưởng nhóm cho ${targetName || "một thành viên"}`;
          } else if (parsed.action === "promoted_to_deputy") {
            return `${actorName} đã bổ nhiệm ${targetName || "một thành viên"} làm phó nhóm`;
          } else if (parsed.action === "demoted_from_deputy" || parsed.action === "demoted_to_member") {
            return `${actorName} đã gỡ chức vụ của ${targetName || "một thành viên"} xuống làm thành viên`;
          } else if (role) {
            const roleLabel =
              role === "owner"
                ? "Trưởng nhóm"
                : role === "deputy"
                  ? "Phó nhóm"
                  : "thành viên";
            return `${actorName} đã đặt ${targetName || "một thành viên"} làm ${roleLabel}`;
          }
          return "[Cập nhật vai trò]";
        }
        case "info_updated":
          return actorName + " đã cập nhật thông tin nhóm";
        case "group_name_updated":
          return actorName + " đã đổi tên nhóm";
        case "group_avatar_updated":
          return actorName + " đã thay đổi ảnh đại diện nhóm";
        case "pin_message":
          return actorName + " đã ghim một tin nhắn";
        case "unpin_message":
          return actorName + " đã bỏ ghim tin nhắn";
        default:
          return `${actorName} đã thực hiện một thay đổi hệ thống`;
      }
    }
    // If it's a valid JSON but doesn't have an action, return "[Thông báo hệ thống]"
    if (typeof parsed === 'object' && parsed !== null) {
      return "[Thông báo hệ thống]";
    }
  } catch (e) {
    // ignore, not a JSON
  }
  return content;
};
