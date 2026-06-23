import { Alert, Platform } from 'react-native';

// React Native Web's Alert.alert does not invoke button callbacks, so any
// confirm/alert dialog silently no-ops on web. These helpers use the native
// Alert on iOS/Android and the browser's window.confirm/alert on web.

const isWeb = Platform.OS === 'web';

export function confirmAction(title: string, message: string, onConfirm: () => void, confirmLabel = 'Confirm'): void {
  if (isWeb) {
    if (typeof window !== 'undefined' && window.confirm(message ? `${title}\n\n${message}` : title)) onConfirm();
    return;
  }
  Alert.alert(title, message, [
    { text: 'Cancel', style: 'cancel' },
    { text: confirmLabel, onPress: onConfirm },
  ]);
}

export function notify(title: string, message = ''): void {
  if (isWeb) {
    if (typeof window !== 'undefined') window.alert(message ? `${title}\n\n${message}` : title);
    return;
  }
  Alert.alert(title, message);
}

export function notifyThen(title: string, message: string, onDismiss: () => void): void {
  if (isWeb) {
    if (typeof window !== 'undefined') window.alert(message ? `${title}\n\n${message}` : title);
    onDismiss();
    return;
  }
  Alert.alert(title, message, [{ text: 'OK', onPress: onDismiss }]);
}
