import { UAParser } from 'ua-parser-js';
import { v4 as uuidv4 } from 'uuid';

export const getDeviceId = (): string => {
  let deviceId = localStorage.getItem('deviceId');
  if (!deviceId || !deviceId.startsWith('web-')) {
    deviceId = `web-${uuidv4()}`;
    localStorage.setItem('deviceId', deviceId);
  }
  return deviceId;
};

export const getDeviceInfo = () => {
  const parser = new UAParser();
  const result = parser.getResult();
  
  const browserName = result.browser.name || 'Unknown Browser';
  const osName = result.os.name || 'Unknown OS';
  const osVersion = result.os.version || '';
  
  return {
    deviceName: `${browserName} trên ${osName} ${osVersion}`.trim(),
    deviceType: result.device.type || 'desktop'
  };
};
