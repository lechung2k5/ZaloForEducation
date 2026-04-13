import React, { createContext, useContext, useState, useEffect, useRef } from 'react';
import api from '../services/api';
import { io } from 'socket.io-client';
import { getDeviceId, getDeviceInfo } from '../utils/device';

interface AuthContextType {
  user: any;
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  requestRegisterOtp: (email: string) => Promise<void>;
  confirmRegister: (data: any) => Promise<void>;
  resendOtp: (email: string, type: 'register' | 'forgot_password') => Promise<void>;
  requestForgotPassword: (email: string) => Promise<void>;
  resetPassword: (data: any) => Promise<void>;
  getSessions: () => Promise<any>;
  revokeSession: (deviceId: string) => Promise<void>;
  refreshUser: () => Promise<any>;
  logout: () => void;
  logoutAll: () => Promise<void>;
  requestChangePassword: (data: { currentPassword: string; newPassword: string }) => Promise<void>;
  confirmChangePassword: (otp: string) => Promise<void>;
  socket: any;
  deviceId: string;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [socket, setSocket] = useState<any>(null);
  const [deviceId, setDeviceId] = useState<string>('');

  // FIX 2+3: dùng ref để track socket hiện tại,
  // tránh tạo nhiều socket và memory leak
  const socketRef = useRef<any>(null);

  // FIX 5: getDeviceId có thể async, dùng useEffect để lấy
  useEffect(() => {
    const initDeviceId = async () => {
      const id = await Promise.resolve(getDeviceId());
      setDeviceId(id);
    };
    initDeviceId();
  }, []);

  useEffect(() => {
    const savedUser = localStorage.getItem('user');
    if (savedUser) {
      const parsedUser = JSON.parse(savedUser);
      setUser(parsedUser);
      setupSocket(parsedUser.email);
    }
    setLoading(false);

    // FIX 2: cleanup socket khi unmount
    return () => {
      if (socketRef.current) {
        socketRef.current.disconnect();
        socketRef.current = null;
      }
    };
  }, []);

  const setupSocket = (email: string) => {
    // FIX 3: disconnect socket cũ trước khi tạo mới
    if (socketRef.current) {
      socketRef.current.disconnect();
      socketRef.current = null;
    }

    const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:3000';
    const newSocket = io(apiUrl);

    newSocket.on('connect', () => {
      console.log('Connected to socket server');
      // FIX 1: gửi cả deviceId khi join_identity
      const currentDeviceId = deviceId || localStorage.getItem('deviceId') || '';
      newSocket.emit('join_identity', { email, deviceId: currentDeviceId });
    });

    // FIX 4: xử lý cả 2 trường hợp backend emit force_logout
    // TH1: backend emit thẳng tới socket (không có targetDeviceId)
    // TH2: backend emit kèm targetDeviceId hoặc all
    newSocket.on('force_logout', (data) => {
      const currentDeviceId = deviceId || localStorage.getItem('deviceId') || '';

      // FIX: Chỉ logout khi có targetDeviceId khớp hoặc data.all === true
      // Không logout khi thiếu thông tin để tránh logout nhầm sau QR login
      const shouldLogout =
        data?.all === true ||
        (data?.targetDeviceId && data.targetDeviceId === currentDeviceId);

      if (shouldLogout) {
        alert('Phiên đăng nhập của bạn đã hết hạn hoặc bị đăng xuất từ thiết bị khác.');
        logoutLocal();
      } else {
        console.log('[SOCKET] force_logout ignored — not targeting this device', {
          targetDeviceId: data?.targetDeviceId,
          currentDeviceId,
        });
      }
    });

    newSocket.on('profile_update', (data) => {
      if (data && data.profile) {
        console.log('⚡ [SOCKET] Profile update event received:', data.profile);
        setUser((prevUser: any) => {
          const merged = { ...prevUser, ...data.profile };
          localStorage.setItem('user', JSON.stringify(merged));
          console.log('✅ [AUTH] User state updated from socket sync');
          return merged;
        });
      }
    });

    // FIX 2: lưu vào ref để quản lý lifecycle
    socketRef.current = newSocket;
    setSocket(newSocket);
  };

  const login = async (email: string, password: string) => {
    const { deviceName, deviceType } = getDeviceInfo();
    const currentDeviceId = deviceId || await Promise.resolve(getDeviceId());

    const res = await api.post('/auth/login', {
      email,
      password,
      deviceId: currentDeviceId,
      deviceName,
      deviceType,
      platform: 'web',
    });
    const { accessToken, user: userData } = res.data;

    localStorage.setItem('token', accessToken);
    localStorage.setItem('user', JSON.stringify(userData));
    // Lưu deviceId để dùng trong force_logout khi deviceId state chưa kịp set
    localStorage.setItem('deviceId', currentDeviceId);

    setUser(userData);
    // FIX 3: setupSocket đã tự disconnect socket cũ trước khi tạo mới
    setupSocket(userData.email);
  };

  const requestRegisterOtp = async (email: string) => {
    await api.post('/auth/register', { email });
  };

  const confirmRegister = async (data: any) => {
    await api.post('/auth/register/confirm', data);
  };

  const resendOtp = async (email: string, type: 'register' | 'forgot_password') => {
    await api.post('/auth/resend-otp', { email, type });
  };

  const requestForgotPassword = async (email: string) => {
    await api.post('/auth/forgot-password', { email });
  };

  const resetPassword = async (data: any) => {
    await api.post('/auth/reset-password', data);
  };

  const getSessions = async () => {
    try {
      const token = localStorage.getItem('token');
      if (!token) return [];
      const res = await api.get('/auth/sessions');
      return res.data;
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
    localStorage.removeItem('deviceId');
    // FIX 2: disconnect socket đúng cách qua ref
    if (socketRef.current) {
      socketRef.current.disconnect();
      socketRef.current = null;
    }
    setUser(null);
    setSocket(null);
    window.location.href = '/login';
  };

  const logout = async () => {
    try {
      if (user) {
        // FIX: Ưu tiên deviceId từ localStorage (đúng với session đang active)
        // vì sau QR login, deviceId state có thể khác với deviceId trong JWT
        const currentDeviceId = deviceId || localStorage.getItem('deviceId') || '';
        await api.post('/auth/logout', { email: user.email, deviceId: currentDeviceId });
      }
    } catch (err) {
      console.error('Logout error', err);
    } finally {
      logoutLocal();
    }
  };

  const refreshUser = async () => {
    try {
      const res = await api.get('/users/profile');
      const updatedProfile = res.data.profile;
      const newUser = { ...user, ...updatedProfile };
      localStorage.setItem('user', JSON.stringify(newUser));
      setUser(newUser);
      return newUser;
    } catch (err) {
      console.error('Refresh user error', err);
      return user;
    }
  };

  const logoutAll = async () => {
    if (user) {
      await api.post('/auth/logout-all', { email: user.email });
      logoutLocal();
    }
  };

  const requestChangePassword = async (data: { currentPassword: string; newPassword: string }) => {
    await api.post('/auth/change-password/request', data);
  };

  const confirmChangePassword = async (otp: string) => {
    await api.post('/auth/change-password/confirm', { otp });
    // confirm xong backend đá logoutall rồi, web gọi logoutLocal để dọn dẹp
    logoutLocal();
  };

  return (
    <AuthContext.Provider value={{
      user, loading, login, requestRegisterOtp, confirmRegister,
      resendOtp, requestForgotPassword, resetPassword, getSessions,
      revokeSession, logout, logoutAll, socket, deviceId, refreshUser,
      requestChangePassword, confirmChangePassword
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