import React, { createContext, useContext, useState, useEffect } from 'react';
import api from '../services/api';
import { io } from 'socket.io-client';
import { v4 as uuidv4 } from 'uuid';

interface AuthContextType {
  user: any;
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  requestRegisterOtp: (email: string) => Promise<void>;
  confirmRegister: (data: any) => Promise<void>;
  logout: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [deviceId] = useState(() => {
    let id = localStorage.getItem('deviceId');
    if (!id) {
      id = uuidv4();
      localStorage.setItem('deviceId', id);
    }
    return id;
  });

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
    const socket = io('http://localhost:3000');
    
    socket.on(`force_logout_${email}`, (data) => {
      if (data.newDeviceId !== deviceId) {
        alert('Tài khoản của bạn đã được đăng nhập ở một thiết bị khác. Bạn sẽ bị đăng xuất.');
        logout();
      }
    });

    return () => socket.disconnect();
  };

  const login = async (email: string, password: string) => {
    const res = await api.post('/auth/login', { email, password, deviceId });
    const { accessToken, user: userData } = res.data;
    
    localStorage.setItem('token', accessToken);
    localStorage.setItem('user', JSON.stringify(userData));
    setUser(userData);
    setupSocket(userData.email);
  };

  const requestRegisterOtp = async (email: string) => {
    await api.post('/auth/register/request-otp', { email });
  };

  const confirmRegister = async (data: any) => {
    await api.post('/auth/register/confirm', data);
  };

  const logout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    setUser(null);
    window.location.href = '/login';
  };

  return (
    <AuthContext.Provider value={{ user, loading, login, requestRegisterOtp, confirmRegister, logout }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used within an AuthProvider');
  return context;
};
