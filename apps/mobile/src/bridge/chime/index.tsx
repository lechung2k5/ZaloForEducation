import React, { useEffect, useRef, useState } from 'react';
import { Platform, View, Text } from 'react-native';
import { RTCView } from 'react-native-webrtc';
import { chimeRef } from '../../utils/chimeRef';

/**
 * [SENIOR] RNChimeVideoView (Polyfill Version)
 * Thay vì gọi Native SurfaceView, Component này dùng WebRTC RTCView.
 * Nó tạo ra một HTMLVideoElement giả, bind vào Chime SDK, sau đó
 * lấy MediaStream từ srcObject để hiển thị.
 */
export const RNChimeVideoView = ({ tileId, style, ...props }: any) => {
  const [streamURL, setStreamURL] = useState<string | null>(null);
  
  // Tạo element video giả để hứng luồng từ Chime SDK
  // @ts-ignore
  const mockVideoRef = useRef<any>(global.document ? global.document.createElement('video') : null);

  useEffect(() => {
    if (!tileId || !mockVideoRef.current || !chimeRef.current?.meetingSession) {
      return;
    }

    const meetingSession = chimeRef.current.meetingSession;
    
    // Đăng ký callback khi Chime SDK gán stream vào thẻ video giả
    mockVideoRef.current.onStreamReady = (stream: any) => {
      console.log(`[Chime-VideoView] onStreamReady triggered for tileId: ${tileId}, stream: ${stream?.id}`);
      if (stream) {
        setStreamURL(stream.toURL());
      }
    };

    try {
      console.log(`[Chime-VideoView] Binding tileId: ${tileId} to mock video element`);
      meetingSession.audioVideo.bindVideoElement(tileId, mockVideoRef.current);
    } catch (e) {
      console.warn(`[Chime-VideoView] Error binding tileId: ${tileId}`, e);
    }

    return () => {
      try {
        console.log(`[Chime-VideoView] Unbinding tileId: ${tileId}`);
        meetingSession.audioVideo.unbindVideoElement(tileId);
      } catch (e) {
        // ignore
      }
      setStreamURL(null);
    };
  }, [tileId]);

  if (Platform.OS === 'web') {
    return <View style={style}><Text>Chime not supported on Web</Text></View>;
  }

  console.log(`[Chime-VideoView] Render tileId: ${tileId}, streamURL: ${streamURL}`);

  if (!streamURL) {
    return (
      <View style={[style, { backgroundColor: '#1a1a1a', justifyContent: 'center', alignItems: 'center' }]}>
        <Text style={{ color: 'white' }}>Đang tải video...</Text>
      </View>
    );
  }

  return (
    <RTCView
      streamURL={streamURL}
      style={style}
      objectFit={props.objectFit || "cover"}
      zOrder={props.zOrder !== undefined ? props.zOrder : 0}
      mirror={props.mirror}
    />
  );
};

export const ChimeModuleBridge = {
  // Mọi API trong đây không còn ý nghĩa nữa vì đã dùng JS SDK
  // Chúng ta giữ lại vỏ bọc rỗng để không bị crash nếu có chỗ khác gọi
  startMeeting: () => {},
  stopMeeting: () => {},
  toggleMic: () => {},
  toggleCamera: () => {},
  switchAudioOutput: () => {},
  switchCamera: () => {},
  addListener: () => ({ remove: () => {} }),
  removeAllListeners: () => {}
};

export default {
  RNChimeVideoView,
  ChimeModuleBridge
};
