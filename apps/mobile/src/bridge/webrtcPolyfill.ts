import {
  mediaDevices,
  registerGlobals
} from 'react-native-webrtc';

export const setupWebRTCPolyfill = () => {
  // Use official polyfill for WebRTC
  registerGlobals();

  // @ts-ignore
  if (!global.window) global.window = global;
  
  // @ts-ignore
  if (!global.navigator) global.navigator = {};

  // @ts-ignore
  if (!global.window.matchMedia) {
    // @ts-ignore
    global.window.matchMedia = () => ({
      matches: false,
      addListener: () => {},
      removeListener: () => {},
      addEventListener: () => {},
      removeEventListener: () => {},
    });
  }

  // @ts-ignore
  if (!global.window.ResizeObserver) {
    // @ts-ignore
    global.window.ResizeObserver = class ResizeObserver {
      observe() {}
      unobserve() {}
      disconnect() {}
    };
    // @ts-ignore
    global.ResizeObserver = global.window.ResizeObserver;
  }

  // @ts-ignore
  global.navigator.mediaDevices = mediaDevices;
  // @ts-ignore
  if (!global.navigator.mediaDevices.getSupportedConstraints) {
    // @ts-ignore
    global.navigator.mediaDevices.getSupportedConstraints = () => ({});
  }
  
  // Fake user agent for Chime SDK (must include OS version to prevent crash in DefaultBrowserBehavior)
  if (!global.navigator.userAgent) {
    // @ts-ignore
    global.navigator.userAgent = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/100.0.0.0 Safari/537.36';
  }

  // Chime SDK requires document and HTMLMediaElement for binding/playing streams
  if (!global.document) {
    // @ts-ignore
    global.document = {
      createElement: (tag: string): any => {
        if (tag === 'audio' || tag === 'video') {
          return {
            tagName: tag.toUpperCase(),
            play: () => Promise.resolve(),
            pause: () => {},
            setAttribute: () => {},
            removeAttribute: () => {},
            hasAttribute: () => false,
            _srcObject: null,
            get srcObject() {
              return this._srcObject;
            },
            set srcObject(stream) {
              console.log(`[Polyfill] srcObject was set for ${tag}! stream:`, stream ? stream.id : 'null');
              this._srcObject = stream;
              if (this.onStreamReady && stream) {
                this.onStreamReady(stream);
              }
            },
            onStreamReady: null,
            style: {},
            muted: false,
            volume: 1,
            addEventListener: () => {},
            removeEventListener: () => {},
          };
        }
        return {};
      },
      addEventListener: () => {},
      removeEventListener: () => {},
    };
  }
  
  // Fake location
  if (!global.location) {
     // @ts-ignore
     global.location = { protocol: 'https:' };
  }
};
