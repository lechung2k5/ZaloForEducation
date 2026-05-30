import React, { useEffect, useRef, useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Animated, PanResponder, Image, Alert } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useCallStore } from '../../store/callStore';
import { useAuth } from '../../context/AuthContext';
import { apiRequest } from '../../utils/api';
import SocketService from '../../utils/socket';
import { PermissionsAndroid, Platform } from 'react-native';

const IncomingCallModal = () => {
  const { 
    callState, 
    isIncoming, 
    caller,
    receiver,
    callType, 
    acceptCall, 
    rejectCall,
    conversationId,
    activeCallId,
    cleanup // Not in callStore? We need to verify if cleanup is in callStore or useChime
  } = useCallStore() as any;

  const { user } = useAuth() as any;

  const requestPermissions = async () => {
    if (Platform.OS !== 'android') return true;
    try {
      const hasAudio = await PermissionsAndroid.check(PermissionsAndroid.PERMISSIONS.RECORD_AUDIO);
      if (!hasAudio) {
        const grantedAudio = await PermissionsAndroid.request(PermissionsAndroid.PERMISSIONS.RECORD_AUDIO);
        if (grantedAudio !== PermissionsAndroid.RESULTS.GRANTED) return false;
      }
      const hasVideo = await PermissionsAndroid.check(PermissionsAndroid.PERMISSIONS.CAMERA);
      if (!hasVideo) {
        const grantedVideo = await PermissionsAndroid.request(PermissionsAndroid.PERMISSIONS.CAMERA);
        if (grantedVideo !== PermissionsAndroid.RESULTS.GRANTED) return false;
      }
      return true;
    } catch (e) {
      return false;
    }
  };

  const insets = useSafeAreaInsets();
  const slideAnim = useRef(new Animated.Value(-150)).current;
  const [isAccepting, setIsAccepting] = useState(false);

  useEffect(() => {
    if (callState === 'RINGING' && isIncoming) {
      Animated.spring(slideAnim, {
        toValue: insets.top + 10,
        useNativeDriver: true,
        friction: 8,
        tension: 40,
      }).start();
    } else {
      Animated.timing(slideAnim, {
        toValue: -150,
        duration: 300,
        useNativeDriver: true,
      }).start();
    }
  }, [callState, isIncoming, insets.top]);

  if (callState !== 'RINGING' || !isIncoming) {
    return null;
  }

  const handleAccept = async () => {
    if (isAccepting) return;
    setIsAccepting(true);

    const hasPermission = await requestPermissions();
    if (!hasPermission) {
      setIsAccepting(false);
      return;
    }

    try {
      const res = await apiRequest("/call/join", {
        method: "POST",
        body: JSON.stringify({
          conversationId,
          callId: activeCallId,
        }),
      });

      if (!res.ok) throw new Error(res.message || "Khong the tham gia cuoc goi");

      const meetingData = res.data || res;
      const { meeting, attendee } = meetingData;

      if (!meeting || !attendee) {
        throw new Error("Du lieu cuoc hop khong hop le");
      }

      acceptCall({ meeting, attendee });

      if (SocketService.socket) {
        (SocketService.socket as any).emit("call:accept", {
          convId: conversationId,
          callId: activeCallId,
          fromEmail: user.email,
          toEmail: caller?.email,
        });
      }
    } catch (err: any) {
      console.error("Error accepting call:", err);
      Alert.alert("Lỗi", "Không thể kết nối cuộc gọi");
      rejectCall();
    } finally {
      setIsAccepting(false);
    }
  };

  const handleReject = () => {
    if (SocketService.socket) {
      (SocketService.socket as any).emit("call:reject", {
        convId: conversationId,
        callId: activeCallId,
        fromEmail: user.email,
        toEmail: caller?.email,
        reason: "NO_ANSWER",
      });
    }
    rejectCall();
  };

  return (
    <Animated.View style={[styles.container, { transform: [{ translateY: slideAnim }] }]}>
      <View style={styles.banner}>
        <View style={styles.callerInfo}>
          <Image 
            source={{ uri: caller?.avatarUrl || 'https://via.placeholder.com/150' }} 
            style={styles.avatar} 
          />
          <View style={styles.textContainer}>
            <Text style={styles.callerName}>{caller?.fullName || caller?.email || 'Unknown'}</Text>
            <Text style={styles.callType}>
              Cuộc gọi {callType === 'video' ? 'video' : 'thoại'} đến...
            </Text>
          </View>
        </View>

        <View style={styles.actionButtons}>
          <TouchableOpacity style={[styles.button, styles.rejectBtn]} onPress={handleReject}>
            <Text style={styles.iconText}>call_end</Text>
          </TouchableOpacity>
          <TouchableOpacity 
            style={[styles.button, styles.acceptBtn, isAccepting && { opacity: 0.5 }]} 
            onPress={handleAccept}
            disabled={isAccepting}
          >
            <Text style={styles.iconText}>call</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    top: 0,
    left: 16,
    right: 16,
    zIndex: 9999,
    elevation: 10,
  },
  banner: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 12,
    elevation: 8,
  },
  callerInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  avatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#f0f0f0',
  },
  textContainer: {
    marginLeft: 12,
    flex: 1,
  },
  callerName: {
    fontSize: 16,
    fontWeight: '700',
    color: '#1a1a1a',
  },
  callType: {
    fontSize: 14,
    color: '#666',
    marginTop: 2,
  },
  actionButtons: {
    flexDirection: 'row',
    gap: 12,
  },
  button: {
    width: 44,
    height: 44,
    borderRadius: 22,
    justifyContent: 'center',
    alignItems: 'center',
  },
  rejectBtn: {
    backgroundColor: '#ef4444',
  },
  acceptBtn: {
    backgroundColor: '#10b981',
  },
  iconText: {
    fontFamily: 'Material Symbols Outlined',
    color: '#fff',
    fontSize: 24,
  },
});

export default IncomingCallModal;
