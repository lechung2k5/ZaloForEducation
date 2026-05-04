import Swal from "sweetalert2";

export type ReminderRepeatType = "none" | "daily" | "weekly" | "monthly";

export interface ReminderPayload {
  content: string;
  time: string;
  date: string;
  repeatType: ReminderRepeatType;
}

export interface ReminderNotificationSource {
  messageId: string;
  convId: string;
  reminder: ReminderPayload;
  senderId?: string;
}

interface StoredReminderRecord extends ReminderNotificationSource {
  scheduledFor: string;
  createdAt: string;
}

const STORAGE_KEY = "web_reminder_notifications_v1";
const timers = new Map<string, number>();

const isBrowserSupported = () =>
  typeof window !== "undefined" && typeof window.Notification !== "undefined";

const readStoredReminders = (): Record<string, StoredReminderRecord> => {
  if (typeof window === "undefined") return {};

  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) || "{}");
  } catch {
    return {};
  }
};

const writeStoredReminders = (
  records: Record<string, StoredReminderRecord>,
) => {
  if (typeof window === "undefined") return;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(records));
};

const parseLocalReminderDate = (reminder: ReminderPayload) => {
  const [year, month, day] = String(reminder.date || "")
    .split("-")
    .map(Number);
  const [hours, minutes] = String(reminder.time || "00:00")
    .split(":")
    .map(Number);

  if (
    Number.isNaN(year) ||
    Number.isNaN(month) ||
    Number.isNaN(day) ||
    Number.isNaN(hours) ||
    Number.isNaN(minutes)
  ) {
    return null;
  }

  return new Date(year, month - 1, day, hours, minutes, 0, 0);
};

const addDays = (date: Date, days: number) => {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next;
};

const addMonths = (date: Date, months: number) => {
  const next = new Date(date);
  next.setMonth(next.getMonth() + months);
  return next;
};

const resolveNextRun = (reminder: ReminderPayload, now = new Date()) => {
  const base = parseLocalReminderDate(reminder);
  if (!base) return null;

  if (reminder.repeatType === "none") return base;

  let next = new Date(base);
  let guard = 0;
  while (next <= now && guard < 240) {
    if (reminder.repeatType === "daily") next = addDays(next, 1);
    else if (reminder.repeatType === "weekly") next = addDays(next, 7);
    else next = addMonths(next, 1);
    guard += 1;
  }

  return next;
};

const getNotificationBody = (reminder: ReminderPayload, dueAt: Date) => {
  const dueDate = dueAt.toLocaleDateString("vi-VN", {
    weekday: "short",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
  const dueTime = dueAt.toLocaleTimeString("vi-VN", {
    hour: "2-digit",
    minute: "2-digit",
  });

  return `${reminder.content} • ${dueDate} ${dueTime}`;
};

const showReminderNotification = async (record: StoredReminderRecord) => {
  const dueAt = new Date(record.scheduledFor);
  const title = `Nhắc hẹn: ${record.reminder.content}`;
  const body = getNotificationBody(record.reminder, dueAt);

  if (!isBrowserSupported() || Notification.permission !== "granted") {
    await Swal.fire({
      icon: "info",
      title,
      text: body,
      confirmButtonText: "Đã xem",
    });
    return;
  }

  const notification = new Notification(title, {
    body,
    icon: "/logo_blue.png",
    badge: "/logo_blue.png",
    tag: `reminder-${record.messageId}`,
    renotify: true,
    requireInteraction: true,
    data: {
      convId: record.convId,
      messageId: record.messageId,
    },
  });

  notification.onclick = () => {
    try {
      window.focus();
    } finally {
      notification.close();
    }
  };
};

const clearReminderTimer = (messageId: string) => {
  const timer = timers.get(messageId);
  if (timer) {
    window.clearTimeout(timer);
    timers.delete(messageId);
  }
};

const persistReminderRecord = (record: StoredReminderRecord) => {
  const records = readStoredReminders();
  records[record.messageId] = record;
  writeStoredReminders(records);
};

const removeReminderRecord = (messageId: string) => {
  const records = readStoredReminders();
  delete records[messageId];
  writeStoredReminders(records);
};

const scheduleStoredReminder = (record: StoredReminderRecord) => {
  if (typeof window === "undefined") return;

  clearReminderTimer(record.messageId);

  const dueAt = new Date(record.scheduledFor);
  const delay = dueAt.getTime() - Date.now();

  if (delay <= 0) {
    void showReminderNotification(record).finally(() => {
      if (record.reminder.repeatType === "none") {
        removeReminderRecord(record.messageId);
        return;
      }

      const nextDue = resolveNextRun(record.reminder, new Date());
      if (!nextDue) {
        removeReminderRecord(record.messageId);
        return;
      }

      persistReminderRecord({
        ...record,
        scheduledFor: nextDue.toISOString(),
      });
      scheduleStoredReminder({
        ...record,
        scheduledFor: nextDue.toISOString(),
      });
    });
    return;
  }

  const timerId = window.setTimeout(() => {
    void showReminderNotification(record).finally(() => {
      if (record.reminder.repeatType === "none") {
        removeReminderRecord(record.messageId);
        timers.delete(record.messageId);
        return;
      }

      const nextDue = resolveNextRun(record.reminder, new Date());
      if (!nextDue) {
        removeReminderRecord(record.messageId);
        timers.delete(record.messageId);
        return;
      }

      const nextRecord = {
        ...record,
        scheduledFor: nextDue.toISOString(),
      };
      persistReminderRecord(nextRecord);
      scheduleStoredReminder(nextRecord);
    });
  }, delay);

  timers.set(record.messageId, timerId);
};

export const registerReminderNotificationFromMessage = (
  message: any,
  fallbackConvId?: string,
) => {
  const reminder: ReminderPayload | undefined = message?.payload?.reminder;
  if (!reminder || message?.status === "sending") return;

  const messageId = String(message?.id || "").trim();
  const convId = String(message?.conversationId || fallbackConvId || "").trim();

  if (!messageId || !convId) return;

  const scheduledFor = resolveNextRun(reminder, new Date());
  if (!scheduledFor) return;

  const record: StoredReminderRecord = {
    messageId,
    convId,
    reminder,
    senderId: message?.senderId,
    scheduledFor: scheduledFor.toISOString(),
    createdAt: String(message?.createdAt || new Date().toISOString()),
  };

  persistReminderRecord(record);
  scheduleStoredReminder(record);
};

export const bootstrapReminderNotifications = () => {
  if (typeof window === "undefined") return;

  const records = readStoredReminders();
  Object.values(records).forEach((record) => {
    registerReminderNotificationFromMessage(
      {
        id: record.messageId,
        conversationId: record.convId,
        senderId: record.senderId,
        payload: { reminder: record.reminder },
        createdAt: record.createdAt,
      },
      record.convId,
    );
  });
};

export const clearReminderNotification = (messageId: string) => {
  if (!messageId) return;
  clearReminderTimer(messageId);
  removeReminderRecord(messageId);
};
