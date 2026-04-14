import { useState, useEffect, useCallback } from 'react';

/**
 * Custom hook to manage OTP resend countdown with persistence.
 * @param key Unique identifier (e.g., email) to store expiry in localStorage
 * @param initialSeconds Default cooldown duration (default: 30s)
 */
export const useOtpCountdown = (key: string, initialSeconds: number = 30) => {
  const normalizedKey = key.toLowerCase().trim();
  const storageKey = `otp_expiry_${normalizedKey}`;
  
  const getRemainingTime = useCallback(() => {
    if (!normalizedKey) return 0;
    const expiry = localStorage.getItem(storageKey);
    if (!expiry) return 0;
    const remaining = Math.ceil((parseInt(expiry) - Date.now()) / 1000);
    return remaining > 0 ? remaining : 0;
  }, [storageKey, normalizedKey]);

  const [countdown, setCountdown] = useState(getRemainingTime());

  // Function to start or restart the countdown
  const startCountdown = useCallback((seconds: number = initialSeconds) => {
    if (!normalizedKey) return;
    const expiry = Date.now() + seconds * 1000;
    localStorage.setItem(storageKey, expiry.toString());
    setCountdown(seconds);
  }, [storageKey, initialSeconds, normalizedKey]);

  // Function to sync with server-provided retryAfter time
  const syncWithServer = useCallback((seconds: number) => {
    if (seconds <= 0) return;
    startCountdown(seconds);
  }, [startCountdown]);

  useEffect(() => {
    // Initial sync
    const remaining = getRemainingTime();
    if (remaining !== countdown) {
      setCountdown(remaining);
    }
  }, [normalizedKey, getRemainingTime]);

  useEffect(() => {
    if (countdown <= 0) return;

    const timer = setInterval(() => {
      const remaining = getRemainingTime();
      setCountdown(remaining);
      
      if (remaining <= 0) {
        clearInterval(timer);
        localStorage.removeItem(storageKey);
      }
    }, 1000);

    return () => clearInterval(timer);
  }, [countdown, getRemainingTime, storageKey]);

  return { countdown, startCountdown, syncWithServer };
};
