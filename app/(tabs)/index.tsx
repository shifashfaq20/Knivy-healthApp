import { router } from 'expo-router';
import { useState } from 'react';
import { View } from 'react-native';
import {
  ActivityWidget,
  GoalsWidget,
  HabitsWidget,
  HeartWidget,
  MedicationsWidget,
  NutritionWidget,
  RecentWidget,
  SleepWidget,
  StepsWidget,
  WaterWidget,
  WeeklyWidget,
  WorkoutWidget,
} from '../../src/components/home/Widgets';
import { Icon, IconButton, Screen, Txt, type IconName, Touchable } from '../../src/components/ui';
import { queryClient } from '../../src/services/queryClient';
import { useProfile, type WidgetId } from '../../src/stores/profileStore';
import { colors } from '../../src/theme/tokens';
import { formatDateLong, greeting } from '../../src/utils/date';

const WIDGET_COMPONENTS: Record<WidgetId, () => React.JSX.Element> = {
  steps: StepsWidget,
  activity: ActivityWidget,
  heart: HeartWidget,
  sleep: SleepWidget,
  nutrition: NutritionWidget,
  water: WaterWidget,
  medications: MedicationsWidget,
  workout: WorkoutWidget,
  habits: HabitsWidget,
  goals: GoalsWidget,
  recent: RecentWidget,
  weekly: WeeklyWidget,
};

type Shortcut = { label: string; icon: IconName; href: Parameters<typeof router.push>[0] };

export default function Home() {
  const name = useProfile((s) => s.name);
  const widgets = useProfile((s) => s.dashboard.widgets);
  const cycle = useProfile((s) => s.features.cycleTracking);
  const [refreshing, setRefreshing] = useState(false);

  const shortcuts: Shortcut[] = [
    { label: 'Health readings', icon: 'pulse-outline', href: '/health' },
    { label: 'Workouts', icon: 'barbell-outline', href: '/workouts' },
    { label: 'Sleep', icon: 'moon-outline', href: '/sleep' },
    { label: 'Water', icon: 'water-outline', href: '/hydration' },
    ...(cycle ? [{ label: 'Cycle', icon: 'flower-outline' as IconName, href: '/cycle' as const }] : []),
    { label: 'Mind', icon: 'leaf-outline', href: '/mind' },
    { label: 'Habits', icon: 'checkmark-circle-outline', href: '/habits' },
    { label: 'Health records', icon: 'folder-open-outline', href: '/records' },
    { label: 'Assistant', icon: 'chatbubble-ellipses-outline', href: '/assistant' },
  ];

  const refresh = async () => {
    setRefreshing(true);
    await queryClient.invalidateQueries();
    setRefreshing(false);
  };

  return (
    <Screen tab refreshing={refreshing} onRefresh={refresh}>
      <View style={{ flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between' }}>
        <View style={{ flex: 1, gap: 4 }}>
          <Txt variant="label" tone="muted">
            {formatDateLong(new Date())}
          </Txt>
          <Txt variant="display">{name ? `${greeting()}, ${name}` : greeting()}</Txt>
        </View>
        <View style={{ flexDirection: 'row', gap: 8, marginTop: 4 }}>
          <IconButton icon="notifications-outline" label="Reminders" onPress={() => router.push('/notifications')} />
          <IconButton icon="options-outline" label="Customise dashboard" onPress={() => router.push('/dashboard')} />
        </View>
      </View>

      {widgets
        .filter((w) => w.enabled)
        .map((w) => {
          const Widget = WIDGET_COMPONENTS[w.id];
          return Widget ? <Widget key={w.id} /> : null;
        })}

      <Txt variant="subtitle" style={{ marginTop: 8 }}>
        Everything else
      </Txt>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10 }}>
        {shortcuts.map((s) => (
          <Touchable
            key={s.label}
            onPress={() => router.push(s.href)}
            accessibilityRole="button"
            style={({ pressed }) => ({
              width: '48.5%',
              flexDirection: 'row',
              alignItems: 'center',
              gap: 10,
              padding: 14,
              borderRadius: 16,
              backgroundColor: colors.linen,
              opacity: pressed ? 0.7 : 1,
            })}
          >
            <Icon name={s.icon} size={18} />
            <Txt variant="bodyMedium" style={{ flex: 1 }} numberOfLines={1}>
              {s.label}
            </Txt>
          </Touchable>
        ))}
      </View>
    </Screen>
  );
}
