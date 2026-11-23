import { useQueryClient } from '@tanstack/react-query';
import { router } from 'expo-router';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Platform, View } from 'react-native';
import { BarChart } from '../../src/components/charts/Charts';
import { Button, Card, Divider, EmptyState, ListRow, PageHeader, PermissionCard, ProgressBar, Screen, SectionHeader, SourceBadge, Txt } from '../../src/components/ui';
import { useRecords } from '../../src/hooks/useRecords';
import { useDaySteps, useMotionStatus, useStepSeries } from '../../src/hooks/useSteps';
import { motionHasHistory, requestMotionPermission, watchSteps } from '../../src/integrations/health/motion';
import { repos } from '../../src/repositories';
import { useProfile } from '../../src/stores/profileStore';
import { colors } from '../../src/theme/tokens';
import { showError } from '../../src/utils/alerts';
import { WEEKDAYS_LETTER, addDaysKey, formatDuration, isoToKey, keysRange, lastNDays, relativeDay, startOfMonthKey, todayKey, weekdayOf } from '../../src/utils/date';
import { distance } from '../../src/utils/units';

const KIND_LABEL = { walk: 'Walk', run: 'Run', cycle: 'Ride', hike: 'Hike', swim: 'Swim', other: 'Activity' } as const;

function LiveStepCounter() {
  const [counting, setCounting] = useState(false);
  const [count, setCount] = useState(0);
  const startedAt = useRef<Date | null>(null);
  const stop = useRef<(() => void) | null>(null);

  useEffect(() => () => stop.current?.(), []);

  const start = () => {
    setCount(0);
    startedAt.current = new Date();
    stop.current = watchSteps(setCount);
    setCounting(true);
  };
  const finish = async () => {
    stop.current?.();
    stop.current = null;
    setCounting(false);
    if (count > 0) {
      try {
        await repos.measurements.create(
          { type: 'steps', value: count, note: 'Counted live while Knivy was open' },
          { source: 'device', sourceName: 'Phone step sensor', recordedAt: (startedAt.current ?? new Date()).toISOString() },
        );
      } catch (e) {
        showError(e);
      }
    }
  };

  return (
    <Card tone="linen">
      <View style={{ gap: 10 }}>
        <Txt variant="heading">Count steps now</Txt>
        <Txt tone="muted">
          Android only shares step history through Health Connect. Until that’s set up, Knivy can count steps from the sensor while this screen is open.
        </Txt>
        {counting ? <Txt variant="numberLarge">{count.toLocaleString()}</Txt> : null}
        <Button label={counting ? 'Stop and save' : 'Start counting'} size="sm" icon={counting ? 'stop' : 'play'} onPress={counting ? () => void finish() : start} />
      </View>
    </Card>
  );
}

export default function ActivityTab() {
  const qc = useQueryClient();
  const units = useProfile((s) => s.units);
  const goal = useProfile((s) => s.goals.steps);
  const today = todayKey();
  const { steps, source } = useDaySteps(today);
  const motion = useMotionStatus();
  const week = lastNDays(7);
  const series = useStepSeries(week);

  const monthStart = startOfMonthKey(today);
  const from = monthStart < week[0] ? monthStart : week[0];
  const range = keysRange(from, today);
  const activities = useRecords(repos.activities, range);
  const sessions = useRecords(repos.workoutSessions, range);

  const summary = useMemo(() => {
    const sum = (fromKey: string) => {
      const acts = (activities.data ?? []).filter((a) => isoToKey(a.recordedAt) >= fromKey);
      const ses = (sessions.data ?? []).filter((a) => isoToKey(a.recordedAt) >= fromKey);
      return {
        minutes: acts.reduce((s, a) => s + a.data.durationMin, 0) + ses.reduce((s, a) => s + a.data.durationMin, 0),
        km: acts.reduce((s, a) => s + (a.data.distanceKm ?? 0), 0),
        count: acts.length + ses.length,
      };
    };
    return { week: sum(week[0]), month: sum(monthStart) };
  }, [activities.data, sessions.data, week, monthStart]);

  const recent = useMemo(
    () =>
      [
        ...(activities.data ?? []).map((a) => ({
          id: a.id,
          at: a.recordedAt,
          title: a.data.title || KIND_LABEL[a.data.kind],
          detail: [formatDuration(a.data.durationMin), a.data.distanceKm ? distance.format(a.data.distanceKm, units) : null, a.data.energyKcal ? `${Math.round(a.data.energyKcal)} kcal${a.data.energySource === 'estimated' ? ' (estimate)' : ''}` : null]
            .filter(Boolean)
            .join(', '),
          source: a.source,
          onPress: () => router.push({ pathname: '/activity/log', params: { id: a.id } }),
        })),
        ...(sessions.data ?? []).map((s) => ({
          id: s.id,
          at: s.recordedAt,
          title: s.data.name,
          detail: `${formatDuration(s.data.durationMin)}, ${s.data.exercises.length} exercises`,
          source: s.source,
          onPress: () => router.push({ pathname: '/workouts/history/[id]', params: { id: s.id } }),
        })),
      ]
        .filter((x) => isoToKey(x.at) >= addDaysKey(today, -6))
        .sort((a, b) => b.at.localeCompare(a.at)),
    [activities.data, sessions.data, units, today],
  );

  const iosNeedsPermission = Platform.OS === 'ios' && motion.data?.available && motion.data.granted === false;

  return (
    <Screen tab>
      <PageHeader title="Activity" />

      {iosNeedsPermission ? (
        <PermissionCard
          icon="footsteps-outline"
          title="Show your steps"
          why="Knivy reads step counts from your iPhone’s motion sensor to show daily activity. The data stays on your phone."
          canAskAgain={motion.data?.canAskAgain ?? true}
          denied={motion.data?.granted === false && motion.data.canAskAgain === false}
          onRequest={async () => {
            await requestMotionPermission();
            await qc.invalidateQueries({ queryKey: ['motion'] });
            await qc.invalidateQueries({ queryKey: ['steps'] });
          }}
        />
      ) : null}

      <Card hero>
        <View style={{ gap: 10 }}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
            <Txt variant="label" tone="muted">
              Steps today
            </Txt>
            {source ? <SourceBadge source={source} /> : null}
          </View>
          {steps === null ? (
            <Txt tone="muted">No step data for today yet.</Txt>
          ) : (
            <>
              <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: 8 }}>
                <Txt variant="numberLarge">{steps.toLocaleString()}</Txt>
                {goal ? <Txt tone="muted">of {goal.toLocaleString()}</Txt> : null}
              </View>
              {goal ? <ProgressBar value={steps} max={goal} /> : null}
            </>
          )}
          <Divider />
          <BarChart height={120} goal={goal} data={series.map((s) => ({ label: WEEKDAYS_LETTER[weekdayOf(s.key)], value: s.steps }))} />
          <Button label="Add steps manually" size="sm" variant="secondary" icon="add" onPress={() => router.push({ pathname: '/health/add', params: { type: 'steps' } })} />
        </View>
      </Card>

      {!motionHasHistory && motion.data?.available ? <LiveStepCounter /> : null}

      <View style={{ flexDirection: 'row', gap: 10 }}>
        <View style={{ flex: 1 }}>
          <Button full label="Record outdoors" icon="navigate-outline" onPress={() => router.push('/activity/track')} />
        </View>
        <View style={{ flex: 1 }}>
          <Button full label="Log activity" icon="add" variant="secondary" onPress={() => router.push('/activity/log')} />
        </View>
      </View>
      <Button full label="Workouts and exercise library" icon="barbell-outline" variant="secondary" onPress={() => router.push('/workouts')} />

      <View style={{ flexDirection: 'row', gap: 12 }}>
        {(['week', 'month'] as const).map((k) => (
          <Card key={k} tone="linen" style={{ flex: 1 }}>
            <Txt variant="label" tone="muted">
              {k === 'week' ? 'Last 7 days' : 'This month'}
            </Txt>
            <Txt variant="number" style={{ marginTop: 6 }}>
              {formatDuration(summary[k].minutes)}
            </Txt>
            <Txt variant="caption" tone="muted">
              {summary[k].count} sessions{summary[k].km ? `, ${distance.format(summary[k].km, units)}` : ''}
            </Txt>
          </Card>
        ))}
      </View>

      <SectionHeader title="Recent activity" />
      <Card padding={14}>
        {recent.length === 0 ? (
          <EmptyState compact icon="walk-outline" title="No activity in the last 7 days" body="Recorded walks, runs, rides and workouts will show here." />
        ) : (
          recent.map((r, i) => (
            <View key={r.id}>
              {i > 0 ? <Divider /> : null}
              <ListRow title={r.title} subtitle={`${relativeDay(isoToKey(r.at))}, ${r.detail}`} onPress={r.onPress} right={<SourceBadge source={r.source} />} />
            </View>
          ))
        )}
      </Card>
      <Txt variant="caption" tone="muted" style={{ color: colors.taupe }}>
        Energy values marked as estimates are calculated from duration and your latest weight. They aren’t measured.
      </Txt>
    </Screen>
  );
}
