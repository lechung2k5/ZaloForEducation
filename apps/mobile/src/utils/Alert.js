import { Alert as RNAlert, Platform } from 'react-native';
import Swal from 'sweetalert2';

const Alert = {
  alert: (title, message, buttons) => {
    if (Platform.OS === 'web') {
      const isError = title.toLowerCase().includes('lỗi') || title.toLowerCase().includes('thất bại');
      const isSuccess = title.toLowerCase().includes('thành công');
      const type = isError ? 'error' : isSuccess ? 'success' : 'info';
      
      const confirmButton = (buttons && buttons.length > 0) ? buttons[0] : null;

      Swal.fire({
        title: title,
        text: message,
        icon: type,
        confirmButtonText: confirmButton ? confirmButton.text : 'Đóng',
        confirmButtonColor: '#00418f',
        backdrop: 'rgba(0, 0, 0, 0.4)',
        customClass: {
          popup: 'rounded-2xl',
          confirmButton: 'rounded-xl px-4 py-2 font-bold'
        }
      }).then((result) => {
        if (result.isConfirmed && confirmButton && confirmButton.onPress) {
          confirmButton.onPress();
        }
      });
    } else {
      RNAlert.alert(title, message, buttons);
    }
  }
};

export default Alert;
