import { Stack } from 'expo-router';
import { View } from 'react-native';
import { Card, Divider, IconButton, Screen, ToggleRow, Txt } from '../src/components/ui';
import { WIDGETS, useProfile } from '../src/stores/profileStore';

export default function DashboardSettings() {
  const widgets = useProfile((s) => s.dashboard.widgets);
  const update = useProfile((s) => s.update);

  const setWidgets = (next: typeof widgets) => update({ dashboard: { widgets: next } });
  const move = (index: number, dir: -1 | 1) => {
    const target = index + dir;
    if (target < 0 || target >= widgets.length) return;
    const next = [...widgets];
    [next[index], next[target]] = [next[target], next[index]];
    setWidgets(next);
  };

  return (
    <Screen>
      <Stack.Screen options={{ title: 'Customise home' }} />
      <Txt tone="muted">Choose what appears on your home screen and in which order.</Txt>
      <Card padding={12}>
        {widgets.map((w, i) => {
          const meta = WIDGETS.find((m) => m.id === w.id);
          if (!meta) return null;
          return (
            <View key={w.id}>
              {i > 0 ? <Divider /> : null}
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                <View style={{ flex: 1 }}>
                  <ToggleRow
                    label={meta.label}
                    description={meta.description}
                    value={w.enabled}
                    onChange={(enabled) => setWidgets(widgets.map((x) => (x.id === w.id ? { ...x, enabled } : x)))}
                  />
                </View>
                <View style={{ gap: 4 }}>
                  <IconButton icon="chevron-up" size={30} tone="clear" label={`Move ${meta.label} up`} onPress={() => move(i, -1)} />
                  <IconButton icon="chevron-down" size={30} tone="clear" label={`Move ${meta.label} down`} onPress={() => move(i, 1)} />
                </View>
              </View>
            </View>
          );
        })}
      </Card>
    </Screen>
  );
}
