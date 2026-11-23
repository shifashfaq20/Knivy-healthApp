/**
 * In a browser (e.g. the Snack web preview), React Native's Alert.alert does nothing, so delete
 * confirmations and info messages would silently disappear. This routes them to the browser's own
 * alert/confirm dialogs instead. On a phone it does nothing; the native Alert is used as before.
 * Imported once from app/_layout.tsx.
 */
import { Alert, Platform, type AlertButton } from 'react-native';

type BrowserDialogs = { alert?: (msg: string) => void; confirm?: (msg: string) => boolean };
const browser = globalThis as BrowserDialogs;

if (Platform.OS === 'web' && browser.alert && browser.confirm) {
  Alert.alert = (title: string, message?: string, buttons?: AlertButton[]) => {
    const text = [title, message].filter(Boolean).join('\n\n');
    const list = buttons ?? [];
    if (list.length <= 1) {
      browser.alert?.(text);
      list[0]?.onPress?.();
      return;
    }
    const cancel = list.find((b) => b.style === 'cancel');
    const actions = list.filter((b) => b !== cancel);
    const action = actions[actions.length - 1];
    if (browser.confirm?.(text)) action?.onPress?.();
    else cancel?.onPress?.();
  };
}
