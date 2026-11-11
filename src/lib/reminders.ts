import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';

const MESSAGES = [
  'Já registrou seus gastos de hoje? Leva menos de 1 minuto. 💚',
  'Seu eu do futuro agradece: anote os gastos de hoje.',
  'Mantenha sua sequência viva! Registre o dia no My Finance.',
  'Um minutinho para suas finanças? Bora registrar o dia.',
];

let handlerSet = false;

function ensureHandler() {
  if (handlerSet || Platform.OS === 'web') return;
  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowBanner: true,
      shouldShowList: true,
      shouldPlaySound: true,
      shouldSetBadge: false,
    }),
  });
  handlerSet = true;
}

/**
 * Agenda (ou cancela) o lembrete diário.
 * Retorna 'ok', 'denied' (sem permissão) ou 'unsupported' (web).
 */
export async function syncDailyReminder(
  enabled: boolean,
  hour: number,
  minute: number,
): Promise<'ok' | 'denied' | 'unsupported'> {
  if (Platform.OS === 'web') return 'unsupported';
  try {
    ensureHandler();
    await Notifications.cancelAllScheduledNotificationsAsync();
    if (!enabled) return 'ok';

    const current = await Notifications.getPermissionsAsync();
    let granted = current.granted;
    if (!granted && current.canAskAgain) {
      const req = await Notifications.requestPermissionsAsync();
      granted = req.granted;
    }
    if (!granted) return 'denied';

    if (Platform.OS === 'android') {
      await Notifications.setNotificationChannelAsync('daily-reminder', {
        name: 'Lembrete diário',
        importance: Notifications.AndroidImportance.DEFAULT,
        lightColor: '#1B9E5A',
      });
    }

    await Notifications.scheduleNotificationAsync({
      content: {
        title: 'My Finance',
        body: MESSAGES[Math.floor(Math.random() * MESSAGES.length)],
      },
      trigger: {
        type: Notifications.SchedulableTriggerInputTypes.DAILY,
        hour,
        minute,
        channelId: 'daily-reminder',
      },
    });
    return 'ok';
  } catch (e) {
    console.warn('Falha ao agendar lembrete', e);
    return 'unsupported';
  }
}
