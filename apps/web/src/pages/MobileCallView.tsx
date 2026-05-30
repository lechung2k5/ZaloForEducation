import React, { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import api from '../services/api';
import { useCallStore } from '../store/callStore';
import CallOverlay from '../components/call/CallOverlay';
import ChimeSessionManager from '../components/call/ChimeSessionManager';

const MobileCallView = () => {
  const [searchParams] = useSearchParams();
  const token = searchParams.get('token');
  const conversationId = searchParams.get('conversationId');
  const callId = searchParams.get('callId');
  const apiUrl = searchParams.get('apiUrl');
  const [ready, setReady] = useState(false);
  
  const acceptCall = useCallStore(state => state.acceptCall);
  
  useEffect(() => {
    if (token) {
      localStorage.setItem('token', token);
    }
    
    if (conversationId && callId) {
      api.post('/call/join', { conversationId, callId })
        .then(res => {
           const data = res.data?.data || res.data;
           acceptCall({ meeting: data.meeting, attendee: data.attendee });
           setReady(true);
        })
        .catch(err => {
           console.error('[MobileCallView] Lỗi kết nối Chime:', err);
           // Vẫn setReady để ít nhất hiện UI, hoặc hiển thị lỗi
           setReady(true);
        });
    }
  }, [token, conversationId, callId, acceptCall]);

  if (!ready) {
    return (
      <div style={{ 
        display: 'flex', 
        justifyContent: 'center', 
        alignItems: 'center', 
        height: '100vh', 
        background: '#1c1c2e', 
        color: 'white',
        fontSize: '18px'
      }}>
        Đang kết nối máy chủ...
      </div>
    );
  }

  return (
    <div style={{ height: '100vh', width: '100vw', overflow: 'hidden', background: '#1c1c2e' }}>
      <CallOverlay />
      <ChimeSessionManager />
    </div>
  );
};

export default MobileCallView;
