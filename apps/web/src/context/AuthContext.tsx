/* eslint-disable react-refresh/only-export-components */
import React, { createContext, useContext, useEffect, useState } from 'react';
import { io, type Socket } from 'socket.io-client';
import api, { getApiBaseUrl } from '../services/api';
import { getDeviceId, getDeviceInfo } from '../utils/device';

type AppUser = Record<string, unknown> & {
  email: string;
  fullName?: string;
  fullname?: string;
  avatarUrl?: string;
  urlAvatar?: string;
  backgroundUrl?: string;
  urlBackground?: string;
};

type SessionRecord = Record<string, unknown>;
type RegisterConfirmData = Record<string, unknown>;
type ResetPasswordData = Record<string, unknown>;

interface AuthContextType {
  user: AppUser | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<{ locked?: true; email?: string; message?: string } | void>;
  requestRegisterOtp: (email: string) => Promise<void>;
  confirmRegister: (data: RegisterConfirmData) => Promise<void>;
  resendOtp: (email: string, type: 'register' | 'forgot_password') => Promise<void>;
  requestForgotPassword: (email: string) => Promise<void>;
  resetPassword: (data: ResetPasswordData) => Promise<void>;
  getSessions: () => Promise<SessionRecord[]>;
  revokeSession: (deviceId: string) => Promise<void>;
  refreshUserProfile: () => Promise<AppUser | null>;
  updateUser: (patch: Partial<AppUser>) => void;
  logout: () => void;
  logoutAll: () => Promise<void>;
  socket: Socket | null;
  deviceId: string;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<AppUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [socket, setSocket] = useState<Socket | null>(null);
  const [deviceId] = useState(() => getDeviceId());

  const normalizeUser = (input: unknown): AppUser | null => {
    if (!input || typeof input !== 'object') {
      return null;
    }

    const candidate = input as Partial<AppUser>;
    const email = typeof candidate.email === 'string' ? candidate.email : '';
    if (!email) {
      return null;
    }

    const fullName = typeof candidate.fullName === 'string' && candidate.fullName
      ? candidate.fullName
      : typeof candidate.fullname === 'string'
        ? candidate.fullname
        : '';

    const avatarUrl = typeof candidate.avatarUrl === 'string' && candidate.avatarUrl
      ? candidate.avatarUrl
      : typeof candidate.urlAvatar === 'string'
        ? candidate.urlAvatar
        : '';

    const backgroundUrl = typeof candidate.backgroundUrl === 'string' && candidate.backgroundUrl
      ? candidate.backgroundUrl
      : typeof candidate.urlBackground === 'string'
        ? candidate.urlBackground
        : '';

    return {
      ...(candidate as Record<string, unknown>),
      email,
      fullName,
      fullname: fullName,
      avatarUrl,
      urlAvatar: avatarUrl,
      backgroundUrl,
      urlBackground: backgroundUrl,
    };
  };

  const persistUser = (nextUser: unknown) => {
    const normalizedUser = normalizeUser(nextUser);
    if (!normalizedUser) {
      localStorage.removeItem('user');
      setUser(null);
      return null;
    }

    localStorage.setItem('user', JSON.stringify(normalizedUser));
    setUser(normalizedUser);
    return normalizedUser;
  };

  const disconnectSocket = () => {
    setSocket((currentSocket) => {
      currentSocket?.disconnect?.();
      return null;
    });
  };

  const setupSocket = (email: string) => {
    disconnectSocket();

    const apiUrl = getApiBaseUrl();
    const newSocket = io(apiUrl);

    newSocket.on('connect', () => {
      console.log('Connected to socket server');
      newSocket.emit('join_identity', { email });
    });

    newSocket.on('force_logout', (data) => {
      if (data.targetDeviceId === deviceId || data.all) {
        alert('Phiên đăng nhập của bạn đã hết hạn hoặc bị đăng xuất từ thiết bị khác.');
        logoutLocal();
      }
    });

    setSocket(newSocket);
    return () => newSocket.disconnect();
  };

  const refreshUserProfile = async () => {
    const token = localStorage.getItem('token');
    const currentUser = user || normalizeUser(JSON.parse(localStorage.getItem('user') || 'null'));

    if (!token || !currentUser?.email) {
      return currentUser;
    }

    try {
      const res = await api.get('/users/profile');
      const profile = normalizeUser(res.data?.profile || res.data);
      if (!profile) {
        return currentUser;
      }

      return persistUser({
        ...currentUser,
        ...profile,
      });
    } catch (error) {
      console.error('Refresh profile error', error);
      return currentUser;
    }
  };

  const updateUser = (patch: Partial<AppUser>) => {
    persistUser({ ...(user || {}), ...patch });
  };

  useEffect(() => {
    let cancelled = false;

    const initializeAuth = async () => {
      const savedUser = localStorage.getItem('user');
      if (!savedUser) {
        if (!cancelled) {
          setLoading(false);
        }
        return;
      }

      const parsedUser = normalizeUser(JSON.parse(savedUser));
      if (!parsedUser) {
        if (!cancelled) {
          setLoading(false);
        }
        return;
      }

      persistUser(parsedUser);
      setupSocket(parsedUser.email);

      try {
        await refreshUserProfile();
      } catch (error) {
        console.error('Initial profile sync error', error);
      }

      if (!cancelled) {
        setLoading(false);
      }
    };

    initializeAuth();

    return () => {
      cancelled = true;
      disconnectSocket();
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const login = async (email: string, password: string) => {
    const { deviceName, deviceType } = getDeviceInfo();
    const res = await api.post('/auth/login', { 
      email, 
      password, 
      deviceId,
      deviceName,
      deviceType
    });

    if (res.data?.locked) {
      return res.data;
    }

    const { accessToken, user: userData } = res.data;

    if (!accessToken || !userData) {
      throw new Error('Phản hồi đăng nhập không hợp lệ.');
    }
    
    localStorage.setItem('token', accessToken);
    persistUser(userData);
    setupSocket(userData.email);

    try {
      await refreshUserProfile();
    } catch (error) {
      console.error('Login profile sync error', error);
    }
  };

  const requestRegisterOtp = async (email: string) => {
    await api.post('/auth/register', { email });
  };

  const confirmRegister = async (data: RegisterConfirmData) => {
    await api.post('/auth/register/confirm', data);
  };

  const resendOtp = async (email: string, type: 'register' | 'forgot_password') => {
    await api.post('/auth/resend-otp', { email, type });
  };

  const requestForgotPassword = async (email: string) => {
    await api.post('/auth/forgot-password', { email });
  };

  const resetPassword = async (data: ResetPasswordData) => {
    await api.post('/auth/reset-password', data);
  };

  const getSessions = async (): Promise<SessionRecord[]> => {
    try {
      const token = localStorage.getItem('token');
      if (!token) return [];
      const res = await api.get('/auth/sessions');
      const data = res.data;
      return Array.isArray(data) ? data : (data.sessions || []);
    } catch (err) {
      console.error('Error fetching sessions', err);
      return [];
    }
  };

  const revokeSession = async (targetDeviceId: string) => {
    try {
      await api.delete(`/auth/sessions/${targetDeviceId}`);
    } catch (err) {
      console.error('Revoke session error', err);
      throw err;
    }
  };

  const logoutLocal = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    setUser(null);
    disconnectSocket();
    window.location.href = '/login';
  };

  const logout = async () => {
    try {
      if (user) {
        await api.post('/auth/logout', { email: user.email, deviceId });
      }
    } catch (err) {
      console.error('Logout error', err);
    } finally {
      logoutLocal();
    }
  };

  const logoutAll = async () => {
    if (user) {
      await api.post('/auth/logout-all', { email: user.email });
      logoutLocal();
    }
  };

  return (
    <AuthContext.Provider value={{ 
      user, loading, login, requestRegisterOtp, confirmRegister, 
      resendOtp, requestForgotPassword, resetPassword, getSessions, 
      revokeSession, refreshUserProfile, updateUser, logout, logoutAll, socket, deviceId 
    }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used within an AuthProvider');
  return context;
};
