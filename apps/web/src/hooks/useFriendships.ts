import { useState, useEffect } from 'react';
import api from '../services/api';

export interface Friendship {
  sender_id: string;
  receiver_id: string;
  status: 'pending' | 'accepted' | 'blocked';
  blockedBy?: string;
}

export const useFriendships = () => {
  const [friendships, setFriendships] = useState<Friendship[]>([]);
  const [loading, setLoading] = useState(false);

  const fetchFriendships = async () => {
    setLoading(true);
    try {
      const res = await api.get('/chat/friends');
      setFriendships(res.data || []);
    } catch (err) {
      console.error('Failed to fetch friendships', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchFriendships();

    const handleFriendshipUpdate = () => {
      fetchFriendships();
    };

    window.addEventListener("friendship-updated", handleFriendshipUpdate);
    return () => {
      window.removeEventListener("friendship-updated", handleFriendshipUpdate);
    };
  }, []);

  const acceptedFriends = friendships
    .filter((f) => f.status === 'accepted');
    
  const pendingFriends = friendships
    .filter((f) => f.status === 'pending');

  const blockedFriendships = friendships
    .filter((f) => f.status === 'blocked');

  return {
    friendships,
    acceptedFriends,
    pendingFriends,
    blockedFriendships,
    loading,
    refreshFriendships: fetchFriendships
  };
};
