import React, { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import Swal from 'sweetalert2';
import { useAuth } from '../context/AuthContext';
import api from '../services/api';

type ProfileState = {
  fullName: string;
  email: string;
  phone: string;
  address: string;
  bio: string;
  dataOfBirth: string;
  gender: boolean;
  avatarUrl: string;
  backgroundUrl: string;
};

const COVER_IMAGE = 'https://images.unsplash.com/photo-1507525428034-b723cf961d3e?auto=format&fit=crop&w=1600&q=80';

const ProfilePage: React.FC = () => {
  const { user, updateUser } = useAuth();
  const [profile, setProfile] = useState<ProfileState>({
    fullName: '',
    email: '',
    phone: '',
    address: '',
    bio: '',
    dataOfBirth: '',
    gender: true,
    avatarUrl: '',
    backgroundUrl: '',
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState<ProfileState>({
    fullName: '',
    email: '',
    phone: '',
    address: '',
    bio: '',
    dataOfBirth: '',
    gender: true,
    avatarUrl: '',
    backgroundUrl: '',
  });
  const fileInputRef = useRef<HTMLInputElement>(null);
  const backgroundInputRef = useRef<HTMLInputElement>(null);

  const normalizeProfile = (data: any): ProfileState => ({
    fullName: data?.fullName || data?.fullname || '',
    email: data?.email || user?.email || '',
    phone: data?.phone || '',
    address: data?.address || '',
    bio: data?.bio || '',
    dataOfBirth: data?.dataOfBirth || '',
    gender: typeof data?.gender === 'boolean' ? data.gender : true,
    avatarUrl: data?.avatarUrl || data?.urlAvatar || '',
    backgroundUrl: data?.backgroundUrl || data?.urlBackground || '',
  });

  useEffect(() => {
    const fetchProfile = async () => {
      try {
        const res = await api.get('/users/profile');
        const nextProfile = normalizeProfile(res.data?.profile || res.data);
        setProfile(nextProfile);
        setDraft(nextProfile);
        updateUser(nextProfile);
      } catch (error) {
        console.error('Fetch profile error', error);
        const fallback = {
          fullName: user?.fullName || user?.fullname || '',
          email: user?.email || '',
          phone: '',
          address: '',
          bio: '',
          dataOfBirth: '',
          gender: true,
          avatarUrl: user?.avatarUrl || user?.urlAvatar || '',
          backgroundUrl: (user?.backgroundUrl as string) || (user?.urlBackground as string) || '',
        };
        setProfile(fallback);
        setDraft(fallback);
      } finally {
        setLoading(false);
      }
    };

    fetchProfile();
  }, []);

  const handleChange = (field: keyof ProfileState, value: string | boolean) => {
    setDraft((current) => ({ ...current, [field]: value }));
  };

  const toDateParts = (value: string) => {
    if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) {
      return { day: '', month: '', year: '' };
    }
    const [year, month, day] = value.split('-');
    return { day, month, year };
  };

  const buildDate = (day: string, month: string, year: string) => {
    if (!day || !month || !year) {
      return '';
    }
    return `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
  };

  const formatBirthDate = (value: string) => {
    const { day, month, year } = toDateParts(value);
    if (!day || !month || !year) {
      return 'Chưa cập nhật';
    }
    return `${Number(day)} tháng ${month}, ${year}`;
  };

  const handleStartEdit = () => {
    setDraft(profile);
    setEditing(true);
  };

  const handleCancelEdit = () => {
    setDraft(profile);
    setEditing(false);
  };

  const handleAvatarPick = () => {
    fileInputRef.current?.click();
  };

  const handleAvatarChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) {
      return;
    }

    setUploading(true);
    try {
      const formData = new FormData();
      formData.append('file', file);

      const res = await api.post('/users/avatar/upload', formData, {
        headers: {},
      });

      const nextProfile = normalizeProfile(res.data?.profile || res.data);
      setProfile((current) => ({ ...current, avatarUrl: nextProfile.avatarUrl }));
      setDraft((current) => ({ ...current, avatarUrl: nextProfile.avatarUrl }));
      updateUser(nextProfile);

      await Swal.fire({
        icon: 'success',
        title: 'Đã cập nhật ảnh đại diện',
        timer: 1600,
        showConfirmButton: false,
      });
    } catch (error: any) {
      console.error('Upload avatar error', error);
      await Swal.fire({
        icon: 'error',
        title: 'Không thể tải ảnh lên',
        text: error?.response?.data?.message || 'Vui lòng thử lại sau.',
      });
    } finally {
      setUploading(false);
      event.target.value = '';
    }
  };

  const handleBackgroundPick = () => {
    backgroundInputRef.current?.click();
  };

  const handleBackgroundChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) {
      return;
    }

    setUploading(true);
    try {
      const formData = new FormData();
      formData.append('file', file);

      const res = await api.post('/users/background/upload', formData, {
        headers: {},
      });

      const nextProfile = normalizeProfile(res.data?.profile || res.data);
      setProfile((current) => ({ ...current, backgroundUrl: nextProfile.backgroundUrl }));
      setDraft((current) => ({ ...current, backgroundUrl: nextProfile.backgroundUrl }));
      updateUser(nextProfile);

      await Swal.fire({
        icon: 'success',
        title: 'Đã cập nhật ảnh nền',
        timer: 1600,
        showConfirmButton: false,
      });
    } catch (error: any) {
      console.error('Upload background error', error);
      await Swal.fire({
        icon: 'error',
        title: 'Không thể tải ảnh nền lên',
        text: error?.response?.data?.message || 'Vui lòng thử lại sau.',
      });
    } finally {
      setUploading(false);
      event.target.value = '';
    }
  };

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setSaving(true);

    try {
      const res = await api.put('/users/profile', {
        fullName: draft.fullName,
        phone: draft.phone,
        address: draft.address,
        bio: draft.bio,
        dataOfBirth: draft.dataOfBirth,
        gender: draft.gender,
      });

      const nextProfile = normalizeProfile(res.data?.profile || res.data);
      setProfile(nextProfile);
      setDraft(nextProfile);
      setEditing(false);
      updateUser(nextProfile);

      await Swal.fire({
        icon: 'success',
        title: 'Đã lưu hồ sơ',
        text: 'Thông tin cá nhân của bạn đã được cập nhật.',
        confirmButtonColor: '#00418f',
      });
    } catch (error: any) {
      console.error('Update profile error', {
        message: error?.message,
        status: error?.response?.status,
        statusText: error?.response?.statusText,
        data: error?.response?.data,
      });
      await Swal.fire({
        icon: 'error',
        title: 'Không thể lưu hồ sơ',
        text: error?.response?.data?.message || 'Vui lòng thử lại sau.',
      });
    } finally {
      setSaving(false);
    }
  };

  const displayAvatar = profile.avatarUrl || user?.avatarUrl || user?.urlAvatar || '';
  const displayBackground = profile.backgroundUrl || (user?.backgroundUrl as string) || (user?.urlBackground as string) || COVER_IMAGE;
  const displayName = profile.fullName || user?.fullName || user?.fullname || 'Người dùng';
  const displayInitial = displayName.charAt(0).toUpperCase();
  const dateParts = toDateParts(draft.dataOfBirth);

  const handleDayChange = (value: string) => {
    const day = value.replace(/\D/g, '').slice(0, 2);
    handleChange('dataOfBirth', buildDate(day, dateParts.month, dateParts.year));
  };

  const handleMonthChange = (value: string) => {
    const month = value.replace(/\D/g, '').slice(0, 2);
    handleChange('dataOfBirth', buildDate(dateParts.day, month, dateParts.year));
  };

  const handleYearChange = (value: string) => {
    const year = value.replace(/\D/g, '').slice(0, 4);
    handleChange('dataOfBirth', buildDate(dateParts.day, dateParts.month, year));
  };

  return (
    <div className="min-h-screen bg-[#e8edf4] p-2 md:p-6">
      <div className="max-w-2xl mx-auto rounded-md border border-slate-300 bg-white shadow-sm overflow-hidden">
        {loading ? (
          <div className="h-[70vh] flex items-center justify-center">
            <div className="w-10 h-10 rounded-full border-4 border-primary border-t-transparent animate-spin" />
          </div>
        ) : editing ? (
          <>
            <div className="h-14 border-b border-slate-300 px-4 flex items-center justify-between">
              <button onClick={handleCancelEdit} className="material-symbols-outlined text-2xl text-slate-700">arrow_back</button>
              <h1 className="text-xl leading-none font-bold text-slate-800">Cập nhật thông tin cá nhân</h1>
              <button onClick={() => window.history.back()} className="material-symbols-outlined text-2xl text-slate-700">close</button>
            </div>

            <form onSubmit={handleSubmit} className="px-5 py-5 bg-[#f8f9fb] min-h-[560px]">
              <label className="block text-base text-slate-700 mb-2">Tên hiển thị</label>
              <input
                value={draft.fullName}
                onChange={(event) => handleChange('fullName', event.target.value)}
                className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-lg text-slate-800 mb-5"
                placeholder="Nhập tên hiển thị"
              />

              <h2 className="text-xl font-bold text-slate-800 mb-3">Thông tin cá nhân</h2>

              <div className="flex items-center gap-8 mb-4">
                <button type="button" onClick={() => handleChange('gender', true)} className="flex items-center gap-3">
                  <span className={`w-5 h-5 rounded-full border-2 flex items-center justify-center ${draft.gender ? 'border-blue-500' : 'border-slate-400'}`}>
                    {draft.gender && <span className="w-2.5 h-2.5 rounded-full bg-blue-500" />}
                  </span>
                  <span className="text-base text-slate-800">Nam</span>
                </button>
                <button type="button" onClick={() => handleChange('gender', false)} className="flex items-center gap-3">
                  <span className={`w-5 h-5 rounded-full border-2 flex items-center justify-center ${!draft.gender ? 'border-blue-500' : 'border-slate-400'}`}>
                    {!draft.gender && <span className="w-2.5 h-2.5 rounded-full bg-blue-500" />}
                  </span>
                  <span className="text-base text-slate-800">Nữ</span>
                </button>
              </div>

              <label className="block text-base text-slate-700 mb-2">Ngày sinh</label>
              <div className="grid grid-cols-3 gap-3 mb-5">
                <input value={dateParts.day} onChange={(event) => handleDayChange(event.target.value)} placeholder="24" className="rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-base text-slate-800" />
                <input value={dateParts.month} onChange={(event) => handleMonthChange(event.target.value)} placeholder="06" className="rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-base text-slate-800" />
                <input value={dateParts.year} onChange={(event) => handleYearChange(event.target.value)} placeholder="2004" className="rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-base text-slate-800" />
              </div>

              <div className="grid md:grid-cols-2 gap-4 mb-5">
                <div>
                  <label className="block text-sm text-slate-700 mb-2">Điện thoại</label>
                  <input value={draft.phone} onChange={(event) => handleChange('phone', event.target.value)} className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-800" />
                </div>
                <div>
                  <label className="block text-sm text-slate-700 mb-2">Địa chỉ</label>
                  <input value={draft.address} onChange={(event) => handleChange('address', event.target.value)} className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-800" />
                </div>
              </div>

              <label className="block text-sm text-slate-700 mb-2">Giới thiệu</label>
              <textarea value={draft.bio} onChange={(event) => handleChange('bio', event.target.value)} rows={3} className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-800 resize-none" />

              <div className="mt-8 border-t border-slate-300 pt-4 flex justify-end gap-2">
                <button type="button" onClick={handleCancelEdit} className="px-4 py-2 rounded-lg bg-slate-200 text-sm font-semibold text-slate-800">Hủy</button>
                <button type="submit" disabled={saving} className="px-4 py-2 rounded-lg bg-blue-500 text-sm font-semibold text-white disabled:opacity-70">{saving ? 'Đang lưu' : 'Cập nhật'}</button>
              </div>
            </form>
          </>
        ) : (
          <>
            <div className="h-14 border-b border-slate-300 px-4 flex items-center justify-between">
              <h1 className="text-xl leading-none font-bold text-slate-800">Thông tin tài khoản</h1>
              <button onClick={() => window.history.back()} className="material-symbols-outlined text-2xl text-slate-700">close</button>
            </div>

            <div className="relative">
              <img src={displayBackground} alt="cover" className="w-full h-36 object-cover" />
              <button
                onClick={handleBackgroundPick}
                disabled={uploading}
                className="absolute bottom-2 right-2 px-2.5 py-1 rounded-md bg-white/90 border border-slate-300 text-xs font-medium text-slate-700 disabled:opacity-60"
              >
                Đổi ảnh nền
              </button>
              <input ref={backgroundInputRef} type="file" accept="image/*" className="hidden" onChange={handleBackgroundChange} />
            </div>

            <div className="px-5 pt-3 pb-4 border-b-8 border-[#edf1f6]">
              <div className="-mt-10 relative w-20 h-20 rounded-full border-[3px] border-white bg-white">
                {displayAvatar ? (
                  <img src={displayAvatar} alt={displayName} className="w-full h-full rounded-full object-cover" />
                ) : (
                  <div className="w-full h-full rounded-full bg-primary text-white flex items-center justify-center text-3xl font-bold">{displayInitial}</div>
                )}
                <button onClick={handleAvatarPick} disabled={uploading} className="absolute -bottom-1 -right-1 w-7 h-7 rounded-full bg-slate-200 border border-slate-300 flex items-center justify-center">
                  <span className="material-symbols-outlined text-slate-700 text-sm">photo_camera</span>
                </button>
                <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={handleAvatarChange} />
              </div>

              <div className="mt-3 flex items-center gap-3">
                <h2 className="text-2xl leading-none font-bold text-slate-800">{displayName}</h2>
                <button onClick={handleStartEdit} className="material-symbols-outlined text-slate-700 text-xl">edit</button>
              </div>
            </div>

            <div className="px-5 py-5 bg-[#f8f9fb]">
              <h3 className="text-xl font-bold text-slate-800 mb-3">Thông tin cá nhân</h3>

              <div className="space-y-3 mb-4">
                <div className="flex items-center">
                  <span className="w-28 text-base text-slate-500">Giới tính</span>
                  <span className="text-base text-slate-800">{profile.gender ? 'Nam' : 'Nữ'}</span>
                </div>
                <div className="flex items-center">
                  <span className="w-28 text-base text-slate-500">Ngày sinh</span>
                  <span className="text-base text-slate-800">{formatBirthDate(profile.dataOfBirth)}</span>
                </div>
                <div className="flex items-center">
                  <span className="w-28 text-base text-slate-500">Điện thoại</span>
                  <span className="text-base text-slate-800">{profile.phone || 'Chưa cập nhật'}</span>
                </div>
              </div>

              <p className="text-sm leading-6 text-slate-500 mb-4">Chỉ bạn bè có lưu số của bạn trong danh bạ máy xem được số này</p>

              <button onClick={handleStartEdit} className="w-full pt-3 border-t border-slate-300 flex items-center justify-center gap-2">
                <span className="material-symbols-outlined text-xl text-slate-800">edit</span>
                <span className="text-lg font-bold text-slate-800">Cập nhật</span>
              </button>

              <div className="mt-4 flex justify-end gap-2">
                <Link to="/sessions" className="px-4 py-2 rounded-lg bg-slate-200 text-sm font-semibold text-slate-700">Thiết bị</Link>
                <Link to="/" className="px-4 py-2 rounded-lg bg-slate-200 text-sm font-semibold text-slate-700">Đóng</Link>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
};

export default ProfilePage;
