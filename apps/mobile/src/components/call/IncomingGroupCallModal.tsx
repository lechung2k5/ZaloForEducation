import React, { useEffect } from 'react';
import { Modal, View, Text, TouchableOpacity, StyleSheet, Image, Vibration } from 'react-native';
import { useGroupCallStore } from '../../store/groupCallStore';
import { apiPost } from '../../utils/api';
import SocketService from '../../utils/socket';
import { useAuth } from '../../context/AuthContext';
import { MaterialCommunityIcons as Icon } from "@expo/vector-icons";
import { Audio } from 'expo-av';

const IncomingGroupCallModal = () => {
  const { callState, convId, callId, callType, fromEmail, peerProfile, groupName, groupAvatar, resetGroupCall } = useGroupCallStore();
  const { user } = useAuth();

  const ringtoneSound = React.useRef<any>(null);

  useEffect(() => {
    let isMounted = true;
    const playRing = async () => {
      try {
        await Audio.setAudioModeAsync({
          allowsRecordingIOS: false,
          playsInSilentModeIOS: true,
          shouldDuckAndroid: true,
          staysActiveInBackground: true,
          playThroughEarpieceAndroid: false,
        });

        if (ringtoneSound.current) {
          await ringtoneSound.current.unloadAsync();
        }

        const { sound } = await Audio.Sound.createAsync(
          require('../../../assets/audio_sound/ringtone.mp3'),
          { shouldPlay: true, isLooping: true }
        );
        
        if (isMounted) {
          ringtoneSound.current = sound;
        } else {
          sound.unloadAsync();
        }
      } catch (err) {
        console.warn('Error playing ringtone', err);
      }
    };

    const stopRing = async () => {
      if (ringtoneSound.current) {
        try {
          await ringtoneSound.current.stopAsync();
          await ringtoneSound.current.unloadAsync();
        } catch (err) {}
        ringtoneSound.current = null;
      }
      Vibration.cancel();
    };

    if (callState === 'RINGING') {
      playRing();
      Vibration.vibrate([1000, 2000, 1000, 2000], true);
    } else {
      stopRing();
    }
    
    return () => {
      isMounted = false;
      stopRing();
      Vibration.cancel();
    };
  }, [callState]);

  useEffect(() => {
    let timeout: ReturnType<typeof setTimeout>;
    if (callState === 'RINGING') {
      timeout = setTimeout(() => {
        console.log('[IncomingGroupCall] Timeout after 60s');
        handleDecline();
      }, 60000);
    }
    return () => {
      if (timeout) clearTimeout(timeout);
    };
  }, [callState]);

  if (callState !== 'RINGING') return null;

  const handleAccept = async () => {
    if (ringtoneSound.current) {
      ringtoneSound.current.stopAsync().catch(() => {});
      ringtoneSound.current.unloadAsync().catch(() => {});
      ringtoneSound.current = null;
    }
    Vibration.cancel();

    try {
      const res = await apiPost('/group-call/join', {
        conversationId: convId,
        callId
      });

      if (res.meeting && res.attendee) {
        useGroupCallStore.getState().setMeetingData(res.meeting, res.attendee);
        useGroupCallStore.getState().startJoining(convId!, callId!, callType!);
        if (res.participants) {
          useGroupCallStore.getState().setParticipants(res.participants);
        }
      }
    } catch (e) {
      console.error('[IncomingGroupCall] Accept error:', e);
      resetGroupCall();
    }
  };

  const handleDecline = () => {
    if (ringtoneSound.current) {
      ringtoneSound.current.stopAsync().catch(() => {});
      ringtoneSound.current.unloadAsync().catch(() => {});
      ringtoneSound.current = null;
    }
    Vibration.cancel();
    if (SocketService.socket && convId && callId) {
      (SocketService.socket as any).emit('group-call:decline', {
        convId,
        callId,
        email: user?.email
      });
    }
    resetGroupCall();
  };

  const avatarSource = groupName ? groupAvatar : (peerProfile?.avatarUrl || peerProfile?.avatar);
  const displayName = groupName || peerProfile?.fullName || peerProfile?.name || fromEmail;

  return (
    <Modal visible={true} transparent animationType="slide">
      <View style={styles.container}>
        <View style={styles.topSection}>
          {avatarSource ? (
            <Image source={{ uri: avatarSource }} style={styles.avatar} />
          ) : (
            <View style={[styles.avatar, styles.avatarPlaceholder]}>
              <Icon name={groupName ? "account-group" : "account"} size={60} color="white" />
            </View>
          )}
          <Text style={styles.name}>{displayName}</Text>
          <Text style={styles.status}>
            {callType === 'video' ? 'Cuộc gọi Video Nhóm đến...' : 'Cuộc gọi Thoại Nhóm đến...'}
          </Text>
        </View>

        <View style={styles.bottomSection}>
          <TouchableOpacity style={[styles.btn, styles.declineBtn]} onPress={handleDecline}>
            <Icon name="phone-hangup" size={32} color="white" />
          </TouchableOpacity>
          <TouchableOpacity style={[styles.btn, styles.acceptBtn]} onPress={handleAccept}>
            <Icon name={callType === 'video' ? "video" : "phone"} size={32} color="white" />
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: 'rgba(20,20,20,0.95)',
    justifyContent: 'space-between',
    paddingVertical: 80,
  },
  topSection: {
    alignItems: 'center',
    marginTop: 50,
  },
  avatar: {
    width: 120,
    height: 120,
    borderRadius: 60,
    marginBottom: 20,
  },
  avatarPlaceholder: {
    backgroundColor: '#333',
    justifyContent: 'center',
    alignItems: 'center',
  },
  name: {
    color: 'white',
    fontSize: 28,
    fontWeight: 'bold',
    marginBottom: 10,
  },
  status: {
    color: '#aaa',
    fontSize: 18,
  },
  bottomSection: {
    flexDirection: 'row',
    justifyContent: 'space-evenly',
    alignItems: 'center',
    paddingBottom: 40,
  },
  btn: {
    width: 70,
    height: 70,
    borderRadius: 35,
    justifyContent: 'center',
    alignItems: 'center',
    elevation: 5,
  },
  declineBtn: {
    backgroundColor: '#ff3b30',
  },
  acceptBtn: {
    backgroundColor: '#34c759',
  },
});

export default IncomingGroupCallModal;
