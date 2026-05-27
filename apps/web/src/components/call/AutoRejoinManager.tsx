import React, { useEffect, useRef } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useGroupCallStore } from '../../store/groupCallStore';
import { useCallStore } from '../../store/callStore';

const AutoRejoinManager: React.FC = () => {
  const { user } = useAuth();
  const joinGroupMeeting = useGroupCallStore(state => state.joinMeeting);
  const initiateCall = useCallStore(state => state.initiateCall);
  const acceptCall = useCallStore(state => state.acceptCall); // We need to hit backend to rejoin 1-1 actually?
  const hasChecked = useRef(false);

  useEffect(() => {
    // Only run once when user is logged in
    if (!user || hasChecked.current) return;
    
    const storedSession = sessionStorage.getItem('active_call_session');
    if (storedSession) {
      try {
        const data = JSON.parse(storedSession);
        
        console.log('[AutoRejoin] Found active call in session storage, attempting to rejoin:', data);
        
        hasChecked.current = true;
        
        if (data.isGroup) {
          // Rejoin group call
          joinGroupMeeting(data.conversationId, data.callId, data.callType, data.userProfile)
            .then(() => console.log('[AutoRejoin] Successfully rejoined group call'))
            .catch(err => {
              console.error('[AutoRejoin] Failed to rejoin group call:', err);
              sessionStorage.removeItem('active_call_session');
            });
        } else {
          // Rejoin 1-1 call
          // 1-1 calls need the server to return meeting info. We can just use the /join endpoint logic.
          import('../../services/api').then(({ default: api }) => {
            api.post('/call/join', {
              conversationId: data.conversationId,
              callId: data.callId
            }).then(res => {
               const callStore = useCallStore.getState();
               callStore.setCallType(data.callType);
               callStore.acceptCall(res.data);
               // Re-hydrate the peers and status since they were lost
               callStore.setPeerJoined(true); // Assume peer is joined if we were in the call
            }).catch(err => {
               console.error('[AutoRejoin] Failed to rejoin 1-1 call:', err);
               sessionStorage.removeItem('active_call_session');
            });
          });
        }
      } catch (err) {
        console.error('[AutoRejoin] Failed to parse active call session:', err);
        sessionStorage.removeItem('active_call_session');
      }
    } else {
      hasChecked.current = true;
    }
  }, [user, joinGroupMeeting]);

  return null;
};

export default AutoRejoinManager;
