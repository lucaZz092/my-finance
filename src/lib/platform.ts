import * as Haptics from 'expo-haptics';
import { Alert, Platform } from 'react-native';

/** Confirmação que funciona no Android e no navegador (onde Alert com botões não existe). */
export function confirmAction(title: string, message: string, confirmLabel = 'Confirmar'): Promise<boolean> {
  if (Platform.OS === 'web') {
    return Promise.resolve(typeof window !== 'undefined' ? window.confirm(`${title}\n\n${message}`) : true);
  }
  return new Promise((resolve) => {
    Alert.alert(
      title,
      message,
      [
        { text: 'Cancelar', style: 'cancel', onPress: () => resolve(false) },
        { text: confirmLabel, style: 'destructive', onPress: () => resolve(true) },
      ],
      { cancelable: true, onDismiss: () => resolve(false) },
    );
  });
}

/**
 * Pergunta com várias opções destrutivas. Retorna o índice escolhido ou -1 se cancelar.
 * No navegador, pergunta uma opção de cada vez.
 */
export function chooseAction(title: string, message: string, options: string[]): Promise<number> {
  if (Platform.OS === 'web') {
    if (typeof window === 'undefined') return Promise.resolve(-1);
    for (let i = 0; i < options.length; i++) {
      if (window.confirm(`${title}\n\n${message}\n\nOK = ${options[i]}`)) return Promise.resolve(i);
    }
    return Promise.resolve(-1);
  }
  return new Promise((resolve) => {
    Alert.alert(
      title,
      message,
      [
        { text: 'Cancelar', style: 'cancel', onPress: () => resolve(-1) },
        ...options.map((text, i) => ({ text, style: 'destructive' as const, onPress: () => resolve(i) })),
      ],
      { cancelable: true, onDismiss: () => resolve(-1) },
    );
  });
}

export function notify(title: string, message: string) {
  if (Platform.OS === 'web') {
    if (typeof window !== 'undefined') window.alert(`${title}\n\n${message}`);
    return;
  }
  Alert.alert(title, message);
}

export function tap(kind: 'light' | 'success' = 'light') {
  if (Platform.OS === 'web') return;
  if (kind === 'success') Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
  else Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
}
