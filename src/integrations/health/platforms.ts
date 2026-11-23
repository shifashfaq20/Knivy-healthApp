import Constants, { ExecutionEnvironment } from 'expo-constants';
import { Platform } from 'react-native';
import type { ProviderStatus } from './types';

// Apple HealthKit and Android Health Connect need native modules that Expo Go doesn't include.
// This build reports them honestly as unavailable. See docs/NATIVE_HEALTH_SETUP.md for the
// development-build adapter that implements HealthPlatformAdapter.

const inExpoGo = Constants.executionEnvironment === ExecutionEnvironment.StoreClient;

function reason(platformName: string) {
  return inExpoGo
    ? `${platformName} can’t be reached from Expo Go. It needs a Knivy development build.`
    : `${platformName} isn’t included in this build yet.`;
}

export function getAppleHealthStatus(): ProviderStatus {
  return {
    id: 'apple-health',
    name: 'Apple Health',
    available: false,
    granted: null,
    canAskAgain: false,
    supplies: ['Steps', 'Distance', 'Heart rate', 'Resting heart rate', 'Workouts', 'Sleep', 'Weight', 'Height', 'Blood pressure', 'Blood oxygen', 'Body temperature'],
    note: Platform.OS === 'ios' ? reason('Apple Health') : 'Apple Health is only on iPhone.',
  };
}

export function getHealthConnectStatus(): ProviderStatus {
  return {
    id: 'health-connect',
    name: 'Health Connect',
    available: false,
    granted: null,
    canAskAgain: false,
    supplies: ['Steps', 'Distance', 'Heart rate', 'Resting heart rate', 'Exercise', 'Sleep', 'Weight', 'Height', 'Blood pressure', 'Oxygen saturation', 'Body temperature'],
    note: Platform.OS === 'android' ? reason('Health Connect') : 'Health Connect is only on Android.',
  };
}

export const isExpoGo = inExpoGo;
