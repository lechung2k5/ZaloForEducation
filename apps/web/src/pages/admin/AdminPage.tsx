import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  Bell,
  Lock,
  LockOpen,
  Pencil,
  RefreshCw,
  Search,
  Send,
  Trash2,
  UserPlus,
  Users,
} from "lucide-react";
import api from "../../services/api";

type AdminUser = {
  email: string;
  fullName: string;
  phone?: string;
  role?: "admin" | "user";
  status?: string;
  isActive?: boolean;
  createdAt?: string;
  lastLoginAt?: string;
  gender?: boolean;
  dataOfBirth?: string;
  address?: string;
  bio?: string;
};

type Statistics = {
  userCount: number;
  activeUserCount: number;
  lockedUserCount: number;
  totalVisits: number;
  todayVisits: number;
};

type AdminNotification = {
  id: string;
  title: string;
  body: string;
  targetEmails: string[];
  sentBy: string;
  sentAt: string;
};

type UserForm = {
  email: string;
  password: string;
  fullName: string;
  phone: string;
  gender: boolean;
  dataOfBirth: string;
  address: string;
  bio: string;
  role: "user" | "admin";
};

const emptyForm: UserForm = {
  email: "",
  password: "",
  fullName: "",
  phone: "",
  gender: true,
  dataOfBirth: "",
  address: "",
  bio: "",
  role: "user",
};

const formatDate = (value?: string) => {
  if (!value) return "--";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "--";
  return date.toLocaleString("vi-VN");
};

const errorMessage = (error: unknown) => {
  const err = error as { response?: { data?: { message?: string } }; message?: string };
  return err.response?.data?.message || err.message || "Thao tác thất bại.";
};

const AdminPage: React.FC = () => {
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [statistics, setStatistics] = useState<Statistics | null>(null);
  const [notifications, setNotifications] = useState<AdminNotification[]>([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [editingEmail, setEditingEmail] = useState<string | null>(null);
  const [form, setForm] = useState<UserForm>(emptyForm);
  const [notificationForm, setNotificationForm] = useState({
    title: "",
    body: "",
    targetEmails: "",
    sendToAll: false,
  });

  const isEditing = Boolean(editingEmail);

  const loadData = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const [usersRes, statsRes, notiRes] = await Promise.all([
        api.get("/admin/users", { params: { search } }),
        api.get("/admin/statistics"),
        api.get("/admin/notifications"),
      ]);
      setUsers(usersRes.data.users || []);
      setStatistics(statsRes.data);
      setNotifications(notiRes.data.notifications || []);
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setLoading(false);
    }
  }, [search]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      loadData();
    }, 250);
    return () => window.clearTimeout(timer);
  }, [loadData]);

  const selectedRecipients = useMemo(
    () =>
      notificationForm.targetEmails
        .split(/[\n,;]/)
        .map((email) => email.trim())
        .filter(Boolean),
    [notificationForm.targetEmails],
  );

  const statCards: Array<{
    label: string;
    value: number;
    Icon: React.ElementType;
  }> = [
    { label: "Tổng người dùng", value: statistics?.userCount ?? 0, Icon: Users },
    { label: "Đang hoạt động", value: statistics?.activeUserCount ?? 0, Icon: UserPlus },
    { label: "Đang khóa", value: statistics?.lockedUserCount ?? 0, Icon: Lock },
    { label: "Lượt truy cập", value: statistics?.totalVisits ?? 0, Icon: Search },
  ];

  const resetForm = () => {
    setEditingEmail(null);
    setForm(emptyForm);
  };

  const editUser = (user: AdminUser) => {
    setEditingEmail(user.email);
    setForm({
      email: user.email,
      password: "",
      fullName: user.fullName || "",
      phone: user.phone || "",
      gender: user.gender ?? true,
      dataOfBirth: user.dataOfBirth || "",
      address: user.address || "",
      bio: user.bio || "",
      role: user.role === "admin" ? "admin" : "user",
    });
  };

  const saveUser = async (event: React.FormEvent) => {
    event.preventDefault();
    setSaving(true);
    setError("");
    setMessage("");
    try {
      const payload = { ...form };
      if (isEditing && !payload.password) delete (payload as Partial<UserForm>).password;
      if (isEditing) {
        await api.patch(`/admin/users/${encodeURIComponent(editingEmail || "")}`, payload);
        setMessage("Đã cập nhật tài khoản.");
      } else {
        await api.post("/admin/users", payload);
        setMessage("Đã tạo tài khoản.");
      }
      resetForm();
      await loadData();
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setSaving(false);
    }
  };

  const setLock = async (user: AdminUser, locked: boolean) => {
    setError("");
    setMessage("");
    try {
      await api.patch(`/admin/users/${encodeURIComponent(user.email)}/${locked ? "lock" : "unlock"}`);
      setMessage(locked ? "Đã khóa tài khoản." : "Đã mở khóa tài khoản.");
      await loadData();
    } catch (err) {
      setError(errorMessage(err));
    }
  };

  const deleteUser = async (user: AdminUser) => {
    if (!window.confirm(`Xóa tài khoản ${user.email}?`)) return;
    setError("");
    setMessage("");
    try {
      await api.delete(`/admin/users/${encodeURIComponent(user.email)}`);
      setMessage("Đã xóa tài khoản.");
      await loadData();
    } catch (err) {
      setError(errorMessage(err));
    }
  };

  const sendNotification = async (event: React.FormEvent) => {
    event.preventDefault();
    setSaving(true);
    setError("");
    setMessage("");
    try {
      await api.post("/admin/notifications", {
        title: notificationForm.title,
        body: notificationForm.body,
        targetEmails: selectedRecipients,
        sendToAll: notificationForm.sendToAll,
      });
      setNotificationForm({ title: "", body: "", targetEmails: "", sendToAll: false });
      setMessage("Đã gửi thông báo.");
      await loadData();
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="flex-1 h-full overflow-y-auto bg-surface-container-lowest p-4 md:p-6">
      <div className="mx-auto flex w-full max-w-7xl flex-col gap-5">
        <header className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div>
            <h1 className="text-2xl font-bold text-on-surface">Quản trị hệ thống</h1>
            <p className="text-sm text-on-surface-variant">Tài khoản, thông báo và thống kê truy cập</p>
          </div>
          <button
            type="button"
            onClick={loadData}
            className="inline-flex h-10 items-center gap-2 rounded-lg border border-outline bg-surface px-3 text-sm font-semibold text-on-surface hover:bg-surface-container"
          >
            <RefreshCw size={16} />
            Làm mới
          </button>
        </header>

        {(message || error) && (
          <div
            className={`rounded-lg border px-4 py-3 text-sm font-semibold ${
              error
                ? "border-error/40 bg-error-container text-on-error-container"
                : "border-primary/20 bg-primary-container text-on-primary-container"
            }`}
          >
            {error || message}
          </div>
        )}

        <section className="grid gap-3 md:grid-cols-4">
          {statCards.map(({ label, value, Icon }) => (
            <div key={label} className="rounded-lg border border-outline/50 bg-surface p-4">
              <div className="mb-3 flex items-center justify-between">
                <span className="text-sm font-semibold text-on-surface-variant">{label}</span>
                <Icon size={18} className="text-primary" />
              </div>
              <p className="text-3xl font-bold text-on-surface">{value}</p>
            </div>
          ))}
        </section>

        <section className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_380px]">
          <div className="rounded-lg border border-outline/50 bg-surface">
            <div className="flex flex-col gap-3 border-b border-outline/50 p-4 md:flex-row md:items-center md:justify-between">
              <h2 className="text-lg font-bold text-on-surface">Quản lý tài khoản người dùng</h2>
              <label className="relative block w-full md:w-80">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-on-surface-variant" size={16} />
                <input
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                  className="h-10 w-full rounded-lg border border-outline bg-surface-container-low pl-9 pr-3 text-sm text-on-surface outline-none focus:border-primary"
                  placeholder="Tìm email, tên, số điện thoại..."
                />
              </label>
            </div>

            {loading ? (
              <div className="p-8 text-center text-sm text-on-surface-variant">Đang tải dữ liệu...</div>
            ) : users.length === 0 ? (
              <div className="p-8 text-center text-sm text-on-surface-variant">Không có tài khoản phù hợp.</div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[760px] text-left text-sm">
                  <thead className="bg-surface-container-low text-xs uppercase text-on-surface-variant">
                    <tr>
                      <th className="px-4 py-3">Người dùng</th>
                      <th className="px-4 py-3">Vai trò</th>
                      <th className="px-4 py-3">Trạng thái</th>
                      <th className="px-4 py-3">Đăng nhập cuối</th>
                      <th className="px-4 py-3 text-right">Thao tác</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-outline/40">
                    {users.map((user) => {
                      const locked = user.status === "LOCKED";
                      return (
                        <tr key={user.email} className="hover:bg-surface-container-low">
                          <td className="px-4 py-3">
                            <p className="font-bold text-on-surface">{user.fullName || "--"}</p>
                            <p className="text-xs text-on-surface-variant">{user.email}</p>
                            <p className="text-xs text-on-surface-variant">{user.phone || "--"}</p>
                          </td>
                          <td className="px-4 py-3">
                            <span className="rounded-full bg-primary-container px-2 py-1 text-xs font-bold text-on-primary-container">
                              {user.role === "admin" ? "Quản trị viên" : "Người dùng"}
                            </span>
                          </td>
                          <td className="px-4 py-3">
                            <span
                              className={`rounded-full px-2 py-1 text-xs font-bold ${
                                locked ? "bg-error-container text-on-error-container" : "bg-surface-container text-on-surface"
                              }`}
                            >
                              {locked ? "Đã khóa" : "Hoạt động"}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-on-surface-variant">{formatDate(user.lastLoginAt)}</td>
                          <td className="px-4 py-3">
                            <div className="flex justify-end gap-2">
                              <button type="button" onClick={() => editUser(user)} className="rounded-lg border border-outline p-2 hover:bg-surface-container" title="Chỉnh sửa">
                                <Pencil size={16} />
                              </button>
                              <button type="button" onClick={() => setLock(user, !locked)} className="rounded-lg border border-outline p-2 hover:bg-surface-container" title={locked ? "Mở khóa" : "Khóa"}>
                                {locked ? <LockOpen size={16} /> : <Lock size={16} />}
                              </button>
                              <button type="button" onClick={() => deleteUser(user)} className="rounded-lg border border-error/40 p-2 text-error hover:bg-error/10" title="Xóa">
                                <Trash2 size={16} />
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          <form onSubmit={saveUser} className="rounded-lg border border-outline/50 bg-surface p-4">
            <h2 className="mb-4 text-lg font-bold text-on-surface">{isEditing ? "Chỉnh sửa tài khoản" : "Thêm tài khoản"}</h2>
            <div className="grid gap-3">
              <input className="h-10 rounded-lg border border-outline bg-surface-container-low px-3 text-sm" placeholder="Email" value={form.email} disabled={isEditing} onChange={(e) => setForm({ ...form, email: e.target.value })} />
              <input className="h-10 rounded-lg border border-outline bg-surface-container-low px-3 text-sm" placeholder={isEditing ? "Mật khẩu mới (bỏ trống nếu không đổi)" : "Mật khẩu"} type="password" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} />
              <input className="h-10 rounded-lg border border-outline bg-surface-container-low px-3 text-sm" placeholder="Họ tên" value={form.fullName} onChange={(e) => setForm({ ...form, fullName: e.target.value })} />
              <input className="h-10 rounded-lg border border-outline bg-surface-container-low px-3 text-sm" placeholder="Số điện thoại" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
              <input className="h-10 rounded-lg border border-outline bg-surface-container-low px-3 text-sm" type="date" value={form.dataOfBirth} onChange={(e) => setForm({ ...form, dataOfBirth: e.target.value })} />
              <select className="h-10 rounded-lg border border-outline bg-surface-container-low px-3 text-sm" value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value as "user" | "admin" })}>
                <option value="user">Người dùng</option>
                <option value="admin">Quản trị viên</option>
              </select>
              <textarea className="min-h-20 rounded-lg border border-outline bg-surface-container-low px-3 py-2 text-sm" placeholder="Địa chỉ / ghi chú" value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} />
              <div className="flex gap-2">
                <button disabled={saving} className="inline-flex h-10 flex-1 items-center justify-center gap-2 rounded-lg bg-primary px-3 text-sm font-bold text-on-primary disabled:opacity-60">
                  <UserPlus size={16} />
                  {isEditing ? "Lưu" : "Thêm"}
                </button>
                {isEditing && (
                  <button type="button" onClick={resetForm} className="h-10 rounded-lg border border-outline px-3 text-sm font-semibold">
                    Hủy
                  </button>
                )}
              </div>
            </div>
          </form>
        </section>

        <section className="grid gap-5 xl:grid-cols-[380px_minmax(0,1fr)]">
          <form onSubmit={sendNotification} className="rounded-lg border border-outline/50 bg-surface p-4">
            <h2 className="mb-4 flex items-center gap-2 text-lg font-bold text-on-surface">
              <Bell size={18} />
              Gửi thông báo
            </h2>
            <div className="grid gap-3">
              <input className="h-10 rounded-lg border border-outline bg-surface-container-low px-3 text-sm" placeholder="Tiêu đề" value={notificationForm.title} onChange={(e) => setNotificationForm({ ...notificationForm, title: e.target.value })} />
              <textarea className="min-h-24 rounded-lg border border-outline bg-surface-container-low px-3 py-2 text-sm" placeholder="Nội dung" value={notificationForm.body} onChange={(e) => setNotificationForm({ ...notificationForm, body: e.target.value })} />
              <label className="flex items-center gap-2 text-sm font-semibold text-on-surface">
                <input type="checkbox" checked={notificationForm.sendToAll} onChange={(e) => setNotificationForm({ ...notificationForm, sendToAll: e.target.checked })} />
                Gửi tất cả người dùng
              </label>
              <textarea className="min-h-20 rounded-lg border border-outline bg-surface-container-low px-3 py-2 text-sm disabled:opacity-50" disabled={notificationForm.sendToAll} placeholder="Email người nhận, cách nhau bằng dấu phẩy hoặc xuống dòng" value={notificationForm.targetEmails} onChange={(e) => setNotificationForm({ ...notificationForm, targetEmails: e.target.value })} />
              <button disabled={saving} className="inline-flex h-10 items-center justify-center gap-2 rounded-lg bg-primary px-3 text-sm font-bold text-on-primary disabled:opacity-60">
                <Send size={16} />
                Gửi thông báo
              </button>
            </div>
          </form>

          <div className="rounded-lg border border-outline/50 bg-surface">
            <div className="border-b border-outline/50 p-4">
              <h2 className="text-lg font-bold text-on-surface">Lịch sử thông báo</h2>
              <p className="text-sm text-on-surface-variant">Hôm nay: {statistics?.todayVisits ?? 0} lượt truy cập</p>
            </div>
            {notifications.length === 0 ? (
              <div className="p-8 text-center text-sm text-on-surface-variant">Chưa có thông báo nào.</div>
            ) : (
              <div className="divide-y divide-outline/40">
                {notifications.map((item) => (
                  <article key={item.id} className="p-4">
                    <div className="mb-1 flex items-start justify-between gap-3">
                      <h3 className="font-bold text-on-surface">{item.title}</h3>
                      <span className="shrink-0 text-xs text-on-surface-variant">{formatDate(item.sentAt)}</span>
                    </div>
                    <p className="text-sm text-on-surface-variant">{item.body}</p>
                    <p className="mt-2 text-xs text-on-surface-variant">
                      Gửi bởi {item.sentBy} đến {item.targetEmails?.length || 0} người nhận
                    </p>
                  </article>
                ))}
              </div>
            )}
          </div>
        </section>
      </div>
    </div>
  );
};

export default AdminPage;
