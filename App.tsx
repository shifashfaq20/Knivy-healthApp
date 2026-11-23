// Snack entry point. The real app lives in the app/ folder (Expo Router file-based routes);
// this file just hands that folder to Expo Router, the same thing "expo-router/entry" does locally.
import { ExpoRoot } from 'expo-router';

export default function App() {
  const ctx = require.context('./app');
  return <ExpoRoot context={ctx} />;
}
