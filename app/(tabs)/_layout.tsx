import Ionicons from '@expo/vector-icons/Ionicons';
import { Tabs } from 'expo-router';
import type { ComponentProps } from 'react';
import { colors, fonts } from '../../src/theme/tokens';

type IconName = ComponentProps<typeof Ionicons>['name'];

const icon =
  (on: IconName, off: IconName) =>
  ({ color, focused }: { color: string; focused: boolean }) => <Ionicons name={focused ? on : off} size={22} color={color} />;

export default function TabsLayout() {
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: colors.ink,
        tabBarInactiveTintColor: colors.taupe,
        tabBarStyle: { backgroundColor: colors.paper, borderTopColor: colors.sand },
        tabBarLabelStyle: { fontFamily: fonts.bodyMedium, fontSize: 11 },
      }}
    >
      <Tabs.Screen name="index" options={{ title: 'Home', tabBarIcon: icon('home', 'home-outline') }} />
      <Tabs.Screen name="activity" options={{ title: 'Activity', tabBarIcon: icon('walk', 'walk-outline') }} />
      <Tabs.Screen name="nutrition" options={{ title: 'Nutrition', tabBarIcon: icon('nutrition', 'nutrition-outline') }} />
      <Tabs.Screen name="insights" options={{ title: 'Insights', tabBarIcon: icon('analytics', 'analytics-outline') }} />
      <Tabs.Screen name="profile" options={{ title: 'Profile', tabBarIcon: icon('person', 'person-outline') }} />
    </Tabs>
  );
}
