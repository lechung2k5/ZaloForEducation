import React, { useState, useEffect } from 'react';
import { Platform } from 'react-native';
import LoginScreen from './src/screens/LoginScreen';
import RegisterScreen from './src/screens/RegisterScreen';
import ForgotPasswordScreen from './src/screens/ForgotPasswordScreen';
import ResetPasswordScreen from './src/screens/ResetPasswordScreen';
import HomeScreen from './src/screens/HomeScreen';

export default function App() {
  const [screen, setScreen] = useState('login');

  useEffect(() => {
    // Kiểm tra nếu URL có token reset mật khẩu (dành cho Web)
    if (Platform.OS === 'web') {
      const urlParams = new URLSearchParams(window.location.search);
      if (urlParams.has('token')) {
        setScreen('reset-password');
      }
    }
  }, []);

  const navigate = (target) => {
    setScreen(target);
  };

  switch (screen) {
    case 'register':
      return <RegisterScreen onNavigate={navigate} />;
    case 'forgot':
      return <ForgotPasswordScreen onNavigate={navigate} />;
    case 'reset-password':
      return <ResetPasswordScreen onNavigate={navigate} />;
    case 'home':
      return <HomeScreen onNavigate={navigate} />;
    case 'login':
    default:
      return <LoginScreen onNavigate={navigate} />;
  }
}
