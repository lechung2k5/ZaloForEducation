import React, { createContext, useContext, useEffect, useState, useMemo } from 'react';
import { useColorScheme } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { LightColors, DarkColors } from '../constants/Theme';
import vi from '../i18n/vi';
import en from '../i18n/en';

type ThemeMode = 'system' | 'light' | 'dark';
type Language = 'vi' | 'en';

type ThemeContextType = {
  themeMode: ThemeMode;
  isDark: boolean;
  colors: typeof LightColors;
  language: Language;
  setThemeMode: (mode: ThemeMode) => void;
  setLanguage: (lang: Language) => void;
  t: (key: string, params?: Record<string, string | number>) => string;
};

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

const SETTINGS_KEY = 'mobile_settings';

export const ThemeProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const systemColorScheme = useColorScheme();
  
  const [themeMode, setThemeModeState] = useState<ThemeMode>('system');
  const [language, setLanguageState] = useState<Language>('vi');
  const [isLoaded, setIsLoaded] = useState(false);

  useEffect(() => {
    const loadSettings = async () => {
      try {
        const raw = await AsyncStorage.getItem(SETTINGS_KEY);
        if (raw) {
          const parsed = JSON.parse(raw);
          if (parsed.themeMode) setThemeModeState(parsed.themeMode);
          if (parsed.language) setLanguageState(parsed.language);
        }
      } catch (error) {
        console.error('Failed to load theme settings', error);
      } finally {
        setIsLoaded(true);
      }
    };
    loadSettings();
  }, []);

  const setThemeMode = async (mode: ThemeMode) => {
    setThemeModeState(mode);
    try {
      const raw = await AsyncStorage.getItem(SETTINGS_KEY);
      const parsed = raw ? JSON.parse(raw) : {};
      parsed.themeMode = mode;
      await AsyncStorage.setItem(SETTINGS_KEY, JSON.stringify(parsed));
    } catch (error) {
      console.error('Failed to save themeMode', error);
    }
  };

  const setLanguage = async (lang: Language) => {
    setLanguageState(lang);
    try {
      const raw = await AsyncStorage.getItem(SETTINGS_KEY);
      const parsed = raw ? JSON.parse(raw) : {};
      parsed.language = lang;
      await AsyncStorage.setItem(SETTINGS_KEY, JSON.stringify(parsed));
    } catch (error) {
      console.error('Failed to save language', error);
    }
  };

  const isDark = useMemo(() => {
    if (themeMode === 'system') return systemColorScheme === 'dark';
    return themeMode === 'dark';
  }, [themeMode, systemColorScheme]);

  const colors = useMemo(() => (isDark ? DarkColors : LightColors), [isDark]);

  const t = useMemo(() => {
    const dict: any = vi;
    return (key: string, params?: Record<string, string | number>) => {
      let str = dict[key] || key;
      if (params) {
        Object.keys(params).forEach((k) => {
          str = str.replace(`{{${k}}}`, String(params[k]));
        });
      }
      return str;
    };
  }, [language]);

  if (!isLoaded) return null; // Or a splash screen

  return (
    <ThemeContext.Provider
      value={{
        themeMode,
        isDark,
        colors,
        language,
        setThemeMode,
        setLanguage,
        t,
      }}
    >
      {children}
    </ThemeContext.Provider>
  );
};

export const useTheme = () => {
  const context = useContext(ThemeContext);
  if (context === undefined) {
    throw new Error('useTheme must be used within a ThemeProvider');
  }
  return context;
};
