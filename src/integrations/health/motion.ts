import { Pedometer } from 'expo-sensors';
import { Platform } from 'react-native';
import type { ProviderStatus } from './types';

// Phone motion sensor via expo-sensors (works in Expo Go).
// iOS: step history for the last 7 days via Core Motion.
// Android: live step counting only while Knivy is open; history needs Health Connect.

export const motionHasHistory = Platform.OS === 'ios';

export async function getMotionStatus(): Promise<ProviderStatus> {
  const base = {
    id: 'motion' as const,
    name: Platform.OS === 'ios' ? 'iPhone motion sensor' : 'Phone step sensor',
    supplies: Platform.OS === 'ios' ? ['Steps (last 7 days)'] : ['Steps while Knivy is open'],
  };
  try {
    const available = await Pedometer.isAvailableAsync();
    if (!available) {
      return { ...base, available: false, granted: null, canAskAgain: false, note: 'This phone doesn’t report step counts.' };
    }
    const perm = await Pedometer.getPermissionsAsync();
    return {
      ...base,
      available: true,
      granted: perm.granted,
      canAskAgain: perm.canAskAgain,
      note: motionHasHistory
        ? 'Steps are read from Core Motion. iOS keeps about a week of history.'
        : 'Android shares step history only through Health Connect. Without it, Knivy counts steps while open.',
    };
  } catch {
    return { ...base, available: false, granted: null, canAskAgain: false, note: 'The step sensor couldn’t be reached.' };
  }
}

export async function requestMotionPermission() {
  const res = await Pedometer.requestPermissionsAsync();
  return res.granted;
}

/** Steps between two instants (iOS only). Returns null when not supported or not permitted. */
export async function readSteps(from: Date, to: Date): Promise<number | null> {
  if (!motionHasHistory) return null;
  try {
    const perm = await Pedometer.getPermissionsAsync();
    if (!perm.granted) return null;
    const res = await Pedometer.getStepCountAsync(from, to);
    return res.steps;
  } catch {
    return null;
  }
}

export function watchSteps(callback: (stepsSinceStart: number) => void) {
  const sub = Pedometer.watchStepCount((r) => callback(r.steps));
  return () => sub.remove();
}
