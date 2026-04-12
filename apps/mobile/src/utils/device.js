import { Platform } from 'react-native';
import Storage from './storage';
import { UAParser } from 'ua-parser-js';

// DeviceId persistence helper
export const getDeviceId = async () => {
    try {
        let deviceId = await Storage.getItem('deviceId');
        
        // Force platform override for testing if configured in ENV
        const platformPrefix = process.env.EXPO_PUBLIC_DEVICE_PLATFORM || Platform.OS;

        if (!deviceId || !deviceId.startsWith(platformPrefix)) {
            // Add a session suffix if on web to allow testing multiple "devices" in different tabs
            const sessionSuffix = Platform.OS === 'web' ? `-${Math.random().toString(36).slice(2, 5)}` : '';
            deviceId = `${platformPrefix}-${Math.random().toString(36).slice(2, 7)}${sessionSuffix}`;
            await Storage.setItem('deviceId', deviceId);
        }
        return deviceId;
    } catch (e) {
        console.error('Error getting deviceId', e);
        return `${Platform.OS}-fallback-${Math.random().toString(36).slice(2, 7)}`;
    }
};

export const getDeviceInfo = () => {
    // For Native Apps, we could use expo-device, but since the user asked for ua-parser-js
    // we use it for broad compatibility (especially web mode).
    if (Platform.OS === 'web') {
        const parser = new UAParser();
        const result = parser.getResult();
        const browserName = result.browser.name || 'Unknown Browser';
        const osName = result.os.name || 'Unknown OS';
        
        return {
            deviceName: `${browserName} trên ${osName}`,
            deviceType: result.device.type || 'mobile'
        };
    } else {
        // Native fallback (Simplified)
        return {
            deviceName: `${Platform.OS === 'ios' ? 'iPhone' : 'Android Device'}`,
            deviceType: 'mobile'
        };
    }
};
