/**
 * Mock module for react-native-webrtc on Web platform.
 * react-native-webrtc uses requireNativeComponent which does not exist in browser.
 * When running `expo start --web`, Metro replaces this module with this stub.
 *
 * Real WebRTC APIs are available natively in browsers, so most of this is a no-op.
 */
import React from 'react';

// RTCView: on web, just render a plain <video> element
export const RTCView = ({ streamURL, style, objectFit, ...props }) => {
  const ref = React.useRef(null);

  React.useEffect(() => {
    // streamURL on web won't be used (browser uses srcObject directly)
    // This is a no-op stub
  }, [streamURL]);

  return React.createElement('video', {
    ref,
    style: { ...(style || {}), objectFit: objectFit || 'cover' },
    autoPlay: true,
    playsInline: true,
    muted: true,
    ...props,
  });
};

// RTCPeerConnection: browser already has this globally
export const RTCPeerConnection = global.RTCPeerConnection || class RTCPeerConnection {};

// RTCIceCandidate: browser already has this globally
export const RTCIceCandidate = global.RTCIceCandidate || class RTCIceCandidate {};

// RTCSessionDescription: browser already has this globally
export const RTCSessionDescription = global.RTCSessionDescription || class RTCSessionDescription {};

// mediaDevices: use the browser's native one
export const mediaDevices = navigator.mediaDevices || {
  getUserMedia: () => Promise.reject(new Error('Not supported')),
  enumerateDevices: () => Promise.resolve([]),
  getDisplayMedia: () => Promise.reject(new Error('Not supported')),
};

// registerGlobals: no-op on web (browser already has WebRTC globals)
export const registerGlobals = () => {
  console.log('[WebRTCMock] registerGlobals() called on web - no-op, browser already supports WebRTC');
};

// MediaStream: use browser native
export const MediaStream = global.MediaStream || class MediaStream {};

// Stubs for other commonly imported items
export const RTCView2 = RTCView;
export default {
  RTCView,
  RTCPeerConnection,
  RTCIceCandidate,
  RTCSessionDescription,
  mediaDevices,
  registerGlobals,
  MediaStream,
};
