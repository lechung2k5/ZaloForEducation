import { useQuery } from '@tanstack/react-query';
import { chatGet } from '../../utils/api';
import { useChatStore } from '../../store/chatStore';

export const useConversations = () => {

  return useQuery({
    queryKey: ['conversations'],
    queryFn: async () => {
      // Use the store's fetch function which handles normalization and local read state preservation
      return await useChatStore.getState().fetchConversations();
    },
    staleTime: 1000 * 60, // 1 minute
  });
};
