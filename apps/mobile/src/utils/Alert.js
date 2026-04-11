import { Alert as RNAlert, Platform } from 'react-native';
import Swal from 'sweetalert2';

const Alert = {
  alert: (title, message, buttons) => {
    if (Platform.OS === 'web') {
      const isError = title.toLowerCase().includes('lỗi') || title.toLowerCase().includes('thất bại');
      const isSuccess = title.toLowerCase().includes('thành công');
      const type = isError ? 'error' : isSuccess ? 'success' : 'info';
      
      const hasButtons = buttons && buttons.length >= 2;
      const cancelButton = hasButtons ? buttons[0] : null;
      const confirmButton = hasButtons ? buttons[1] : (buttons && buttons.length === 1 ? buttons[0] : null);

      Swal.fire({
        title: title,
        text: message,
        icon: type,
        showCancelButton: !!cancelButton,
        cancelButtonText: cancelButton ? cancelButton.text : 'Hủy',
        confirmButtonText: confirmButton ? confirmButton.text : 'Đóng',
        confirmButtonColor: '#00418f',
        cancelButtonColor: '#d33',
        backdrop: 'rgba(0, 0, 0, 0.4)',
      }).then((result) => {
        if (result.isConfirmed && confirmButton && confirmButton.onPress) {
          confirmButton.onPress();
        } else if (result.isDismissed && cancelButton && cancelButton.onPress) {
          cancelButton.onPress();
        }
      });
    } else {
      RNAlert.alert(title, message, buttons);
    }
  }
};

export default Alert;
