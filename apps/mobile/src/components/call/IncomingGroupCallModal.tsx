import React, { useEffect } from 'react';
import { Modal, View, Text, TouchableOpacity, StyleSheet, Image, Vibration } from 'react-native';
import { useGroupCallStore } from '../../store/groupCallStore';
import { useGroupChime } from '../../hooks/useGroupChime';
import { apiRequest } from '../../utils/api';
import SocketService from '../../utils/socket';
import { useAuth } from '../../context/AuthContext';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import { playRingtone, stopAudio } from '../../utils/audioUtils';

const IncomingGroupCallModal = () => {
  const { callState, convId, callId, callType, fromEmail, peerProfile, groupName, resetGroupCall } = useGroupCallStore();
  const { setupSession } = useGroupChime() as any;
  const { user } = useAuth();

  useEffect(() => {
    if (callState === 'RINGING') {
      playRingtone();
      Vibration.vibrate([1000, 2000, 1000, 2000], true);
    } else {
      stopAudio();
      Vibration.cancel();
    }
    return () => {
      stopAudio();
      Vibration.cancel();
    };
  }, [callState]);

  if (callState !== 'RINGING') return null;

  const handleAccept = async () => {
    stopAudio();
    Vibration.cancel();

    try {
      const res = await apiRequest(`/api/chat/group-call/join`, 'POST', {
        convId,
        callId
      });

      if (res.meeting && res.attendee) {
        useGroupCallStore.getState().startJoining(convId!, callId!, callType!);
        
        if (SocketService.socket && convId && callId) {
          (SocketService.socket as any).emit('group_call:join', {
            convId,
            callId,
            email: user?.email,
            participant: {
              email: user?.email,
              name: user?.name,
              avatar: user?.avatar,
            }
          });
        }
        
        await setupSession(res.meeting, res.attendee);
      }
    } catch (e) {
      console.error('[IncomingGroupCall] Accept error:', e);
      resetGroupCall();
    }
  };

  const handleDecline = () => {
    stopAudio();
    Vibration.cancel();
    if (SocketService.socket && convId && callId) {
      (SocketService.socket as any).emit('group_call:decline', {
        convId,
        callId,
        email: user?.email
      });
    }
    resetGroupCall();
  };

  const avatarSource = groupName ? null : peerProfile?.avatarUrl || peerProfile?.avatar;
  const displayName = groupName || peerProfile?.fullName || peerProfile?.name || fromEmail;

  return (
    <Modal visible={true} transparent animationType="slide">
      <View style={styles.container}>
        <View style={styles.topSection}>
          {avatarSource ? (
            <Image source={{ uri: avatarSource }} style={styles.avatar} />
          ) : (
            <View style={[styles.avatar, styles.avatarPlaceholder]}>
              <Icon name="account-group" size={60} color="white" />
            </View>
          )}
          <Text style={styles.name}>{displayName}</Text>
          <Text style={styles.status}>
            {callType === 'video' ? 'Cuá»™c gá» i Video NhÃ³m Ä‘áº¿n...' : 'Cuá»™c gá» i Thoáº¡i NhÃ³m Ä‘áº¿n...'}
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
