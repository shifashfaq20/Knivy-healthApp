import { Alert } from 'react-native';

export function confirmDelete(what: string, onConfirm: () => void | Promise<void>, detail?: string) {
  Alert.alert(`Delete ${what}?`, detail ?? 'This removes it from this device.', [
    { text: 'Cancel', style: 'cancel' },
    { text: 'Delete', style: 'destructive', onPress: () => void onConfirm() },
  ]);
}

export function showError(error: unknown, title = 'Something went wrong') {
  const message = error instanceof Error ? error.message : 'Please try again.';
  Alert.alert(title, message);
}
