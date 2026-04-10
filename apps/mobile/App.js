import React, { useState, useEffect } from 'react';
import { Platform, View, Text } from 'react-native';
import * as Font from 'expo-font';
import { 
  PlusJakartaSans_300Light, 
  PlusJakartaSans_400Regular, 
  PlusJakartaSans_500Medium, 
  PlusJakartaSans_600SemiBold, 
  PlusJakartaSans_700Bold, 
  PlusJakartaSans_800ExtraBold 
} from '@expo-google-fonts/plus-jakarta-sans';

import LoginScreen from './src/screens/LoginScreen';
import RegisterScreen from './src/screens/RegisterScreen';
import ForgotPasswordScreen from './src/screens/ForgotPasswordScreen';
import ResetPasswordScreen from './src/screens/ResetPasswordScreen';
import HomeScreen from './src/screens/HomeScreen';

export default function App() {
  const [fontsLoaded, setFontsLoaded] = useState(false);
  const [screen, setScreen] = useState('login');

  useEffect(() => {
    async function loadFonts() {
      try {
        await Font.loadAsync({
          PlusJakartaSans: PlusJakartaSans_400Regular,
          PlusJakartaSans_300Light,
          PlusJakartaSans_400Regular,
          PlusJakartaSans_500Medium,
          PlusJakartaSans_600SemiBold,
          PlusJakartaSans_700Bold,
          PlusJakartaSans_800ExtraBold,
          'Material Symbols Outlined': require('./assets/fonts/MaterialSymbolsOutlined-Regular.ttf') // Just in case, standard MS. Often expo uses material icons via vector-icons but since we used direct TS styling, let's keep it safe. 
        });
        setFontsLoaded(true);
      } catch (e) {
        console.warn(e);
        setFontsLoaded(true); // fallback to defaults if fail
      }
    }
    loadFonts();

    // Lấy token cho reset-password
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

  if (!fontsLoaded) {
    return <View style={{ flex: 1, backgroundColor: '#f7f9fb', alignItems: 'center', justifyContent: 'center' }}><Text>Đang tải tài nguyên giao diện...</Text></View>;
  }

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
