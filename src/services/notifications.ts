import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';
import { parseHHMM } from '../utils/date';

const CHANNEL_ID = 'reminders';
let configured = false;

export function configureNotifications() {
  if (configured) return;
  configured = true;
  // Reminders are phone-only; skip setup in a browser (e.g. the Snack web preview).
  if (Platform.OS === 'web') return;
  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowBanner: true,
      shouldShowList: true,
      shouldPlaySound: false,
      shouldSetBadge: false,
    }),
  });
  if (Platform.OS === 'android') {
    void Notifications.setNotificationChannelAsync(CHANNEL_ID, {
      name: 'Reminders',
      importance: Notifications.AndroidImportance.DEFAULT,
    });
  }
}

export async function getNotificationPermission() {
  const { status, canAskAgain } = await Notifications.getPermissionsAsync();
  return { granted: status === 'granted', canAskAgain };
}

/** Asks only when needed. Returns whether reminders can be delivered. */
export async function ensureNotificationPermission() {
  const current = await Notifications.getPermissionsAsync();
  if (current.status === 'granted') return true;
  if (!current.canAskAgain) return false;
  const next = await Notifications.requestPermissionsAsync();
  return next.status === 'granted';
}

export interface ReminderInput {
  title: string;
  body: string;
  /** "HH:MM" local time */
  time: string;
  /** 0 = Sunday … 6 = Saturday. Empty or all seven = every day. */
  weekdays?: number[];
  data?: Record<string, string>;
}

/** Schedules a repeating local reminder. Returns the notification ids to store for cancelling later. */
export async function scheduleReminder(input: ReminderInput): Promise<string[]> {
  const { hour, minute } = parseHHMM(input.time);
  const content = { title: input.title, body: input.body, data: input.data ?? {} };
  const days = input.weekdays ?? [];
  if (days.length === 0 || days.length === 7) {
    const id = await Notifications.scheduleNotificationAsync({
      content,
      trigger: { type: Notifications.SchedulableTriggerInputTypes.DAILY, hour, minute, channelId: CHANNEL_ID },
    });
    return [id];
  }
  const ids: string[] = [];
  for (const d of days) {
    ids.push(
      await Notifications.scheduleNotificationAsync({
        content,
        trigger: {
          type: Notifications.SchedulableTriggerInputTypes.WEEKLY,
          weekday: d + 1,
          hour,
          minute,
          channelId: CHANNEL_ID,
        },
      }),
    );
  }
  return ids;
}

export async function cancelReminders(ids: string[] | undefined | null) {
  if (!ids?.length) return;
  await Promise.all(ids.map((id) => Notifications.cancelScheduledNotificationAsync(id).catch(() => undefined)));
}

export async function listScheduledReminders() {
  return Notifications.getAllScheduledNotificationsAsync();
}

export async function cancelAllReminders() {
  await Notifications.cancelAllScheduledNotificationsAsync();
}
