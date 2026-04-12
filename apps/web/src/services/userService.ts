import api from './api';

export const userService = {
  getProfile: async () => {
    const res = await api.get('/users/profile');
    return res.data.profile;
  },

  updateProfile: async (data: any) => {
    const res = await api.put('/users/profile', data);
    return res.data;
  },

  uploadAvatar: async (file: File | Blob) => {
    const formData = new FormData();
    formData.append('file', file);
    
    // Note: Axios automatically sets the boundary for FormData
    const res = await api.post('/users/avatar/upload', formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    });
    return res.data;
  },

  uploadBackground: async (file: File | Blob) => {
    const formData = new FormData();
    formData.append('file', file);
    
    const res = await api.post('/users/background/upload', formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    });
    return res.data;
  }
};
