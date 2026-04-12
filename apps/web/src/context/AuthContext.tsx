import React, { createContext, useContext, useState, useEffect } from 'react';
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
  getSessions: () => Promise<any[]>;
  revokeSession: (deviceId: string) => Promise<void>;
  refreshUser: () => Promise<any>;
  logout: () => void;
  logoutAll: () => Promise<void>;
  socket: any;
  deviceId: string;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [socket, setSocket] = useState<any>(null);
  const [deviceId] = useState(() => getDeviceId());

  useEffect(() => {
    const savedUser = localStorage.getItem('user');
    if (savedUser) {
      const parsedUser = JSON.parse(savedUser);
      setUser(parsedUser);
      setupSocket(parsedUser.email);
    }
    setLoading(false);
  }, []);

  const setupSocket = (email: string) => {
    const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:3000';
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

  const login = async (email: string, password: string) => {
    const { deviceName, deviceType } = getDeviceInfo();
    const res = await api.post('/auth/login', { 
      email, 
      password, 
      deviceId,
      deviceName,
      deviceType
    });
    const { accessToken, user: userData } = res.data;
    
    localStorage.setItem('token', accessToken);
    localStorage.setItem('user', JSON.stringify(userData));
    setUser(userData);
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

  const refreshUser = async () => {
    try {
      const res = await api.get('/users/profile');
      const updatedProfile = res.data.profile;
      // Trộn thông tin mới vào record cũ
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

  return (
    <AuthContext.Provider value={{ 
      user, loading, login, requestRegisterOtp, confirmRegister, 
      resendOtp, requestForgotPassword, resetPassword, getSessions, 
      revokeSession, logout, logoutAll, socket, deviceId, refreshUser 
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
