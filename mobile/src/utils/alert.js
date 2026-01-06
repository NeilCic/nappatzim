import { Alert } from 'react-native';

/**
 * Centralized alert utility with consistent styling
 * 
 * @param {string} title - Alert title
 * @param {string} message - Alert message
 * @param {Array} buttons - Optional array of button configs [{ text, onPress, style }]
 */
export function showAlert(title, message, buttons = null) {
  if (buttons) {
    Alert.alert(title, message, buttons);
  } else {
    Alert.alert(title, message, [{ text: 'OK' }]);
  }
}

/**
 * Success alert with default OK button
 */
export function showSuccessAlert(message, title = 'Success') {
  showAlert(title, message);
}

/**
 * Error alert with default OK button
 */
export function showErrorAlert(message, title = 'Error') {
  showAlert(title, message);
}

/**
 * Confirmation alert with Yes/No buttons
 */
export function showConfirmAlert(
  message,
  onConfirm,
  title = 'Confirm',
  confirmText = 'Yes',
  cancelText = 'No'
) {
  showAlert(title, message, [
    {
      text: cancelText,
      style: 'cancel',
    },
    {
      text: confirmText,
      onPress: onConfirm,
    },
  ]);
}

