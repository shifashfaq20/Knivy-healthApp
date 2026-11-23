import { Stack, router } from 'expo-router';
import { useMemo } from 'react';
import { Pressable, View } from 'react-native';
import { Button, Card, EmptyState, Icon, Screen, SectionHeader, Txt } from '../../src/components/ui';
import { HABIT_CATEGORIES, ROUTINES } from '../../src/features/habits';
import { useRecords } from '../../src/hooks/useRecords';
import { repos } from '../../src/repositories';
import { colors } from '../../src/theme/tokens';
import type { Habit, Rec } from '../../src/types/models';
import { showError } from '../../src/utils/alerts';
import { WEEKDAYS_LETTER, formatHHMM, isoToKey, keysRange, lastNDays, parseDateKey, todayKey, weekdayOf } from '../../src/utils/date';
import { computeStreaks } from '../../src/utils/streaks';

export default function Habits() {
  const habits = useRecords(repos.habits, { limit: 500 });
  const logs = useRecords(repos.habitLogs, { limit: 20000 });
  const week = lastNDays(7);
  const today = todayKey();

  const doneByHabit = useMemo(() => {
    const m = new Map<string, Map<string, string>>();
    for (const l of logs.data ?? []) {
      if (!m.has(l.data.habitId)) m.set(l.data.habitId, new Map());
      m.get(l.data.habitId)!.set(l.data.date, l.id);
    }
    return m;
  }, [logs.data]);

  const toggle = async (h: Rec<Habit>, key: string) => {
    try {
      const existing = doneByHabit.get(h.id)?.get(key);
      if (existing) await repos.habitLogs.remove(existing);
      else await repos.habitLogs.create({ habitId: h.id, date: key }, { recordedAt: parseDateKey(key).toISOString() });
    } catch (e) {
      showError(e);
    }
  };

  const active = (habits.data ?? []).filter((h) => !h.data.paused);
  const paused = (habits.data ?? []).filter((h) => h.data.paused);

  const renderHabit = (h: Rec<Habit>) => {
    const done = doneByHabit.get(h.id) ?? new Map<string, string>();
    const streak = computeStreaks(new Set(done.keys()), h.data.weekdays, isoToKey(h.createdAt));
    const scheduled = (k: string) => h.data.weekdays.length === 0 || h.data.weekdays.includes(weekdayOf(k));
    return (
      <Card key={h.id} padding={16} onPress={() => router.push({ pathname: '/habits/edit', params: { id: h.id } })}>
        <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 10 }}>
          <View style={{ flex: 1, gap: 2 }}>
            <Txt variant="heading">{h.data.name}</Txt>
            <Txt variant="caption" tone="muted">
              {[
                HABIT_CATEGORIES.find((c) => c.value === h.data.category)?.label,
                h.data.weekdays.length === 0 || h.data.weekdays.length === 7 ? 'Every day' : h.data.weekdays.map((d) => WEEKDAYS_LETTER[d]).join(' '),
                h.data.reminderTime ? `reminder ${formatHHMM(h.data.reminderTime)}` : null,
              ]
                .filter(Boolean)
                .join(', ')}
            </Txt>
          </View>
          <View style={{ alignItems: 'flex-end' }}>
            <Txt variant="heading">{streak.current}</Txt>
            <Txt variant="caption" tone="muted">
              streak, best {streak.best}
            </Txt>
          </View>
        </View>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: 12 }}>
          {week.map((k) => {
            const isDone = done.has(k);
            const due = scheduled(k);
            return (
              <Pressable
                key={k}
                onPress={() => void toggle(h, k)}
                accessibilityRole="checkbox"
                accessibilityState={{ checked: isDone }}
                accessibilityLabel={`${h.data.name}, ${parseDateKey(k).toLocaleDateString()}`}
                style={{ alignItems: 'center', gap: 4 }}
              >
                <Txt variant="caption" tone={k === today ? 'ink' : 'muted'}>
                  {WEEKDAYS_LETTER[weekdayOf(k)]}
                </Txt>
                <View
                  style={{
                    width: 32,
                    height: 32,
                    borderRadius: 16,
                    alignItems: 'center',
                    justifyContent: 'center',
                    backgroundColor: isDone ? colors.moss : 'transparent',
                    borderWidth: 1.5,
                    borderStyle: due ? 'solid' : 'dashed',
                    borderColor: isDone ? colors.moss : due ? colors.stone : colors.sand,
                  }}
                >
                  {isDone ? <Icon name="checkmark" size={16} color={colors.paper} /> : null}
                </View>
              </Pressable>
            );
          })}
        </View>
      </Card>
    );
  };

  return (
    <Screen>
      <Stack.Screen options={{ title: 'Habits' }} />
      <Button full label="New habit" icon="add" onPress={() => router.push('/habits/edit')} />
      {(habits.data ?? []).length === 0 ? (
        <EmptyState icon="checkmark-circle-outline" title="No habits yet" body="Start with one small routine, like a morning glass of water or a ten-minute walk after lunch." />
      ) : null}
      {ROUTINES.map((r) => {
        const items = active.filter((h) => h.data.routine === r.value);
        if (!items.length) return null;
        return (
          <View key={r.value} style={{ gap: 10 }}>
            <SectionHeader title={r.label} />
            {items.map(renderHabit)}
          </View>
        );
      })}
      {paused.length ? (
        <View style={{ gap: 10 }}>
          <SectionHeader title="Paused" />
          {paused.map(renderHabit)}
        </View>
      ) : null}
      <Txt variant="caption" tone="muted">
        Tap a day to mark it done or undo it. Streaks count completed scheduled days; dashed circles are days off.
      </Txt>
    </Screen>
  );
}
