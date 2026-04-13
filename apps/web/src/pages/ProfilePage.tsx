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

type ProfilePost = {
  id: string;
  content: string;
  createdAt: string;
  authorName?: string;
  authorAvatar?: string;
  attachment?: ProfileAttachment | null;
};

type ProfileAttachment = {
  type: 'image' | 'video';
  uri: string;
  name?: string;
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
  const [infoExpanded, setInfoExpanded] = useState(false);
  const [showPostComposer, setShowPostComposer] = useState(false);
  const [postDraft, setPostDraft] = useState('');
  const [postAttachment, setPostAttachment] = useState<ProfileAttachment | null>(null);
  const [posts, setPosts] = useState<ProfilePost[]>([]);
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
  const attachmentInputRef = useRef<HTMLInputElement>(null);

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
  const postsStorageKey = `web_profile_posts_${user?.email || 'default'}`;

  useEffect(() => {
    const raw = localStorage.getItem(postsStorageKey);
    if (!raw) {
      setPosts([]);
      return;
    }
    try {
      const parsed = JSON.parse(raw);
      setPosts(Array.isArray(parsed) ? parsed : []);
    } catch (error) {
      console.error('Load web profile posts error', error);
      setPosts([]);
    }
  }, [postsStorageKey]);

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

  const handleCreatePost = async () => {
    const content = postDraft.trim();
    if (!content && !postAttachment) {
      await Swal.fire({
        icon: 'warning',
        title: 'Thiếu nội dung',
        text: 'Vui lòng nhập nội dung hoặc đính kèm ảnh/video trước khi đăng bài.',
        confirmButtonColor: '#00418f',
      });
      return;
    }

    const nextPost: ProfilePost = {
      id: `${Date.now()}`,
      content,
      createdAt: new Date().toISOString(),
      authorName: displayName,
      authorAvatar: displayAvatar || '',
      attachment: postAttachment ? { ...postAttachment } : null,
    };
    const nextPosts = [nextPost, ...posts];
    setPosts(nextPosts);
    localStorage.setItem(postsStorageKey, JSON.stringify(nextPosts));
    setPostDraft('');
    setPostAttachment(null);
    setShowPostComposer(false);
  };

  const handleAttachmentButtonClick = () => {
    attachmentInputRef.current?.click();
  };

  const handleAttachmentChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) {
      return;
    }

    const isVideo = file.type.startsWith('video/');
    const isImage = file.type.startsWith('image/');
    if (!isImage && !isVideo) {
      await Swal.fire({
        icon: 'warning',
        title: 'File không hợp lệ',
        text: 'Chỉ hỗ trợ ảnh hoặc video.',
        confirmButtonColor: '#00418f',
      });
      event.target.value = '';
      return;
    }

    const reader = new FileReader();
    const dataUrl = await new Promise<string>((resolve, reject) => {
      reader.onload = () => resolve(String(reader.result || ''));
      reader.onerror = () => reject(new Error('Không thể đọc file đính kèm.'));
      reader.readAsDataURL(file);
    });

    setPostAttachment({
      type: isVideo ? 'video' : 'image',
      uri: dataUrl,
      name: file.name || (isVideo ? 'video' : 'image'),
    });
    setShowPostComposer(true);
    event.target.value = '';
  };

  return (
    <div className="min-h-screen bg-[#e8edf4]">
      <div className="max-w-5xl mx-auto px-4 md:px-6 py-5">
        {loading ? (
          <div className="h-[70vh] rounded-2xl border border-slate-300 bg-white flex items-center justify-center">
            <div className="w-10 h-10 rounded-full border-4 border-primary border-t-transparent animate-spin" />
          </div>
        ) : editing ? (
          <div className="rounded-2xl border border-slate-300 bg-white shadow-sm overflow-hidden">
            <div className="h-14 border-b border-slate-300 px-4 flex items-center justify-between">
              <button onClick={handleCancelEdit} className="material-symbols-outlined text-2xl text-slate-700">arrow_back</button>
              <h1 className="text-xl leading-none font-bold text-slate-800">Cập nhật thông tin cá nhân</h1>
              <Link to="/" className="material-symbols-outlined text-2xl text-slate-700">home</Link>
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
          </div>
        ) : (
          <div className="rounded-2xl border border-slate-300 bg-white shadow-sm overflow-hidden">
            <div className="h-14 border-b border-slate-300 px-4 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <Link to="/" className="w-9 h-9 rounded-lg border border-slate-300 inline-flex items-center justify-center text-slate-700">
                  <span className="material-symbols-outlined">arrow_back</span>
                </Link>
                <h1 className="text-xl leading-none font-bold text-slate-800">Trang cá nhân</h1>
              </div>
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
              <button
                type="button"
                onClick={() => setInfoExpanded((prev) => !prev)}
                className="w-full flex items-center justify-between rounded-xl border border-slate-300 bg-white px-4 py-3"
              >
                <h3 className="text-lg font-bold text-slate-800">Thông tin cá nhân</h3>
                <span className="material-symbols-outlined text-slate-700">{infoExpanded ? 'expand_less' : 'expand_more'}</span>
              </button>

              {!infoExpanded && <p className="text-sm text-slate-500 mt-2">Nhấn để mở rộng và xem chi tiết</p>}

              {infoExpanded && (
                <>
                  <div className="space-y-3 mb-4 mt-4">
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
                    <div className="flex flex-col">
                      <span className="w-28 text-base text-slate-500 mb-1">Địa chỉ</span>
                      <span className="text-base text-slate-800">{profile.address || 'Chưa cập nhật'}</span>
                    </div>
                    <div className="flex flex-col">
                      <span className="w-28 text-base text-slate-500 mb-1">Giới thiệu</span>
                      <span className="text-base text-slate-800">{profile.bio || 'Chưa cập nhật'}</span>
                    </div>
                  </div>

                  <p className="text-sm leading-6 text-slate-500 mb-4">Chỉ bạn bè có lưu số của bạn trong danh bạ máy xem được số này</p>

                  <button onClick={handleStartEdit} className="w-full pt-3 border-t border-slate-300 flex items-center justify-center gap-2">
                    <span className="material-symbols-outlined text-xl text-slate-800">edit</span>
                    <span className="text-lg font-bold text-slate-800">Cập nhật</span>
                  </button>
                </>
              )}

              <div className="mt-5 rounded-2xl border border-slate-300 bg-white p-4">
                <button
                  onClick={() => setShowPostComposer((prev) => !prev)}
                  className="w-full inline-flex items-center justify-center gap-2 rounded-full bg-[#0b72ff] px-5 py-2.5 text-base font-bold text-white shadow-[0_8px_20px_rgba(11,114,255,0.3)]"
                >
                  <span className="material-symbols-outlined text-[20px]">edit_square</span>
                  <span>Đăng bài</span>
                </button>

                {showPostComposer && (
                  <div className="mt-3">
                    <div className="flex items-center gap-3 mb-3">
                      {displayAvatar ? (
                        <img src={displayAvatar} alt={displayName} className="w-11 h-11 rounded-full object-cover border border-slate-300" />
                      ) : (
                        <div className="w-11 h-11 rounded-full bg-primary text-white flex items-center justify-center font-bold">{displayInitial}</div>
                      )}
                      <div>
                        <p className="text-sm font-bold text-slate-800">{displayName}</p>
                        <p className="text-xs text-slate-500">{profile.email || user?.email}</p>
                      </div>
                    </div>
                    <textarea
                      value={postDraft}
                      onChange={(event) => setPostDraft(event.target.value)}
                      rows={4}
                      placeholder="Bạn đang nghĩ gì?"
                      className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-800 resize-none"
                    />
                    <input ref={attachmentInputRef} type="file" accept="image/*,video/*" className="hidden" onChange={handleAttachmentChange} />
                    {postAttachment && (
                      <div className="mt-3 rounded-xl border border-slate-300 bg-slate-50 p-3 relative overflow-hidden">
                        <button
                          type="button"
                          onClick={() => setPostAttachment(null)}
                          className="absolute top-2 right-2 w-8 h-8 rounded-full bg-white border border-slate-300 text-slate-600 inline-flex items-center justify-center"
                        >
                          <span className="material-symbols-outlined text-[18px]">close</span>
                        </button>
                        {postAttachment.type === 'image' ? (
                          <img src={postAttachment.uri} alt={postAttachment.name || 'attachment'} className="w-full max-h-56 object-cover rounded-lg" />
                        ) : (
                          <video src={postAttachment.uri} controls className="w-full max-h-56 rounded-lg bg-black" />
                        )}
                        <p className="text-xs text-slate-500 mt-2 truncate">{postAttachment.name}</p>
                      </div>
                    )}
                    <div className="mt-3 flex flex-wrap gap-2">
                      <button type="button" onClick={handleAttachmentButtonClick} className="inline-flex items-center gap-2 rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-semibold text-slate-700">
                        <span className="material-symbols-outlined text-[18px]">attach_file</span>
                        Ảnh / Video
                      </button>
                      {postAttachment && (
                        <button type="button" onClick={() => setPostAttachment(null)} className="inline-flex items-center gap-2 rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-semibold text-slate-700">
                          <span className="material-symbols-outlined text-[18px]">delete</span>
                          Bỏ đính kèm
                        </button>
                      )}
                    </div>
                    <div className="mt-3 flex justify-end gap-2">
                      <button
                        type="button"
                        onClick={() => {
                          setShowPostComposer(false);
                          setPostDraft('');
                        }}
                        className="px-4 py-2 rounded-lg bg-slate-200 text-sm font-semibold text-slate-800"
                      >
                        Hủy
                      </button>
                      <button type="button" onClick={handleCreatePost} className="px-4 py-2 rounded-lg bg-blue-500 text-sm font-semibold text-white">
                        Đăng
                      </button>
                    </div>
                  </div>
                )}
              </div>

              {posts.length > 0 && (
                <div className="mt-4 space-y-3">
                  {posts.map((post) => (
                    <article key={post.id} className="rounded-2xl border border-slate-300 bg-white p-4">
                      <div className="flex items-center gap-3 mb-3">
                        {post.authorAvatar ? (
                          <img src={post.authorAvatar} alt={post.authorName || 'Người dùng'} className="w-11 h-11 rounded-full object-cover border border-slate-300" />
                        ) : (
                          <div className="w-11 h-11 rounded-full bg-primary text-white flex items-center justify-center font-bold">{(post.authorName || 'U').charAt(0).toUpperCase()}</div>
                        )}
                        <div>
                          <p className="text-sm font-bold text-slate-800">{post.authorName || 'Người dùng'}</p>
                          <p className="text-xs text-slate-500">{new Date(post.createdAt).toLocaleString('vi-VN')}</p>
                        </div>
                      </div>
                      <p className="text-sm text-slate-800 leading-6 whitespace-pre-wrap">{post.content}</p>
                    </article>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default ProfilePage;
