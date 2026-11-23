import { Stack, router } from 'expo-router';
import { useMemo, useState } from 'react';
import { Pressable, View } from 'react-native';
import { Banner, Button, Card, Divider, EmptyState, IconButton, ListRow, Screen, SectionHeader, ToggleRow, Txt } from '../../src/components/ui';
import { useRecords } from '../../src/hooks/useRecords';
import { repos } from '../../src/repositories';
import { useProfile } from '../../src/stores/profileStore';
import { colors } from '../../src/theme/tokens';
import { showError } from '../../src/utils/alerts';
import { toCsv, shareTextFile } from '../../src/utils/csv';
import { computeCycleStats, dayInfo, periodLength, predictNextCycle, sortPeriods } from '../../src/utils/cycle';
import { WEEKDAYS_LETTER, addDaysKey, addMonthsKey, daysBetweenKeys, formatDate, monthLabel, parseDateKey, startOfMonthKey, todayKey, weekdayOf } from '../../src/utils/date';

export default function CycleHome() {
  const enabled = useProfile((s) => s.features.cycleTracking);
  const features = useProfile((s) => s.features);
  const update = useProfile((s) => s.update);
  const periods = useRecords(repos.periods, { limit: 500 });
  const logs = useRecords(repos.cycleLogs, { limit: 2000 });
  const [month, setMonth] = useState(startOfMonthKey(todayKey()));

  const list = periods.data ?? [];
  const stats = useMemo(() => computeCycleStats(list), [list]);
  const prediction = useMemo(() => predictNextCycle(list, stats), [list, stats]);
  const loggedDays = useMemo(() => new Set((logs.data ?? []).map((l) => l.data.date)), [logs.data]);
  const today = todayKey();

  if (!enabled) {
    return (
      <Screen>
        <Stack.Screen options={{ title: 'Cycle' }} />
        <EmptyState icon="flower-outline" title="Cycle tracking is off" body="Turn it on to log periods, symptoms and moods privately on this phone. The rest of Knivy works without it." />
        <Card>
          <ToggleRow label="Turn on cycle tracking" value={false} onChange={(v) => update({ features: { ...features, cycleTracking: v } })} />
        </Card>
      </Screen>
    );
  }

  // Month grid, Monday first.
  const first = month;
  const lead = (weekdayOf(first) + 6) % 7;
  const daysInMonth = new Date(parseDateKey(first).getFullYear(), parseDateKey(first).getMonth() + 1, 0).getDate();
  const cells: (string | null)[] = [...Array(lead).fill(null), ...Array.from({ length: daysInMonth }, (_, i) => addDaysKey(first, i))];
  while (cells.length % 7) cells.push(null);

  const sorted = sortPeriods(list);
  const current = sorted.find((p) => p.data.startDate <= today && (!p.data.endDate || p.data.endDate >= today));
  const lastStart = sorted[sorted.length - 1]?.data.startDate;
  const cycleDay = lastStart && lastStart <= today ? daysBetweenKeys(lastStart, today) + 1 : null;

  const exportReport = async () => {
    try {
      const rows = sorted.map((p, i) => {
        const next = sorted[i + 1];
        return [p.data.startDate, p.data.endDate ?? '', periodLength(p.data) ?? '', next ? daysBetweenKeys(p.data.startDate, next.data.startDate) : ''];
      });
      await shareTextFile('knivy-cycle-history.csv', toCsv(['period_start', 'period_end', 'period_days', 'cycle_length_days'], rows), 'text/csv');
    } catch (e) {
      showError(e, 'Couldn’t create the report');
    }
  };

  return (
    <Screen>
      <Stack.Screen options={{ title: 'Cycle' }} />
      <Card hero tone="rose">
        <View style={{ gap: 6 }}>
          {current ? (
            <>
              <Txt variant="label" tone="muted">
                Period, day {daysBetweenKeys(current.data.startDate, today) + 1}
              </Txt>
              <Txt variant="title">Logged since {formatDate(current.data.startDate)}</Txt>
            </>
          ) : cycleDay ? (
            <>
              <Txt variant="label" tone="muted">
                Cycle day {cycleDay}
              </Txt>
              {prediction ? (
                <Txt variant="title">
                  {prediction.daysLate > 0
                    ? `Estimated start was ${prediction.daysLate} day${prediction.daysLate === 1 ? '' : 's'} ago`
                    : `Next period estimated around ${formatDate(prediction.nextStart)}`}
                </Txt>
              ) : (
                <Txt variant="title">Log one more period to see an estimate</Txt>
              )}
            </>
          ) : (
            <Txt variant="title">Log your last period to begin</Txt>
          )}
          {prediction ? (
            <Txt variant="caption" tone="muted">
              Based on {prediction.basedOnCycles} logged cycle{prediction.basedOnCycles === 1 ? '' : 's'}; confidence {prediction.confidence}. Estimated fertile window {formatDate(prediction.fertileStart)} to {formatDate(prediction.fertileEnd)}.
            </Txt>
          ) : null}
        </View>
        <View style={{ flexDirection: 'row', gap: 10, marginTop: 14 }}>
          <Button size="sm" label={current ? 'Log today' : 'Log period'} onPress={() => router.push({ pathname: '/cycle/log', params: { date: today } })} />
        </View>
      </Card>

      <Card>
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
          <IconButton icon="chevron-back" label="Previous month" onPress={() => setMonth((m) => addMonthsKey(m, -1))} />
          <Txt variant="heading">{monthLabel(month)}</Txt>
          <IconButton icon="chevron-forward" label="Next month" onPress={() => setMonth((m) => addMonthsKey(m, 1))} />
        </View>
        <View style={{ flexDirection: 'row' }}>
          {[1, 2, 3, 4, 5, 6, 0].map((d) => (
            <Txt key={d} variant="caption" tone="muted" style={{ flex: 1, textAlign: 'center' }}>
              {WEEKDAYS_LETTER[d]}
            </Txt>
          ))}
        </View>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', marginTop: 6 }}>
          {cells.map((k, i) => {
            if (!k) return <View key={i} style={{ width: `${100 / 7}%`, height: 44 }} />;
            const info = dayInfo(k, list, prediction);
            const isToday = k === today;
            return (
              <Pressable
                key={k}
                onPress={() => (k <= today ? router.push({ pathname: '/cycle/log', params: { date: k } }) : undefined)}
                accessibilityRole="button"
                accessibilityLabel={`${formatDate(k)}${info.inPeriod ? ', period' : ''}${info.predictedPeriod ? ', estimated period' : ''}${info.fertile ? ', estimated fertile window' : ''}`}
                style={{ width: `${100 / 7}%`, height: 44, alignItems: 'center', justifyContent: 'center' }}
              >
                <View
                  style={{
                    width: 36,
                    height: 36,
                    borderRadius: 18,
                    alignItems: 'center',
                    justifyContent: 'center',
                    backgroundColor: info.inPeriod ? colors.rose : info.fertile ? colors.mossSoft : 'transparent',
                    borderWidth: info.predictedPeriod || isToday ? 1.5 : 0,
                    borderStyle: info.predictedPeriod ? 'dashed' : 'solid',
                    borderColor: info.predictedPeriod ? colors.rose : colors.ink,
                  }}
                >
                  <Txt variant="label" tone={info.inPeriod ? 'inverse' : k > today ? 'faint' : 'ink'}>
                    {parseDateKey(k).getDate()}
                  </Txt>
                </View>
                {loggedDays.has(k) ? <View style={{ position: 'absolute', bottom: 2, width: 4, height: 4, borderRadius: 2, backgroundColor: colors.muted }} /> : null}
              </Pressable>
            );
          })}
        </View>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 14, marginTop: 12 }}>
          {[
            { label: 'Logged period', style: { backgroundColor: colors.rose } },
            { label: 'Estimated period', style: { borderWidth: 1.5, borderStyle: 'dashed' as const, borderColor: colors.rose } },
            { label: 'Estimated fertile window', style: { backgroundColor: colors.mossSoft } },
          ].map((l) => (
            <View key={l.label} style={{ flexDirection: 'row', gap: 6, alignItems: 'center' }}>
              <View style={[{ width: 12, height: 12, borderRadius: 6 }, l.style]} />
              <Txt variant="caption" tone="muted">
                {l.label}
              </Txt>
            </View>
          ))}
        </View>
      </Card>

      {current && !current.data.endDate && daysBetweenKeys(current.data.startDate, today) >= 10 ? (
        <Banner
          tone="warn"
          title="Is your period still ongoing?"
          body={`It’s been logged as ongoing since ${formatDate(current.data.startDate)}. Open that day to set an end date so your history stays accurate.`}
        />
      ) : null}

      <Banner body="Estimates come from the dates you log. A calendar estimate can’t confirm ovulation and isn’t a reliable form of contraception." />

      <SectionHeader title="Your history" actionLabel={list.length ? 'Share report' : undefined} onAction={exportReport} />
      <Card tone="linen">
        <View style={{ flexDirection: 'row', gap: 12 }}>
          <View style={{ flex: 1 }}>
            <Txt variant="heading">{stats.avgCycle ? `${stats.avgCycle} days` : 'Not enough data'}</Txt>
            <Txt variant="caption" tone="muted">
              {stats.avgCycle ? `average cycle (${stats.minCycle}–${stats.maxCycle})` : 'average cycle'}
            </Txt>
          </View>
          <View style={{ flex: 1 }}>
            <Txt variant="heading">{stats.avgPeriod ? `${stats.avgPeriod} days` : 'Not enough data'}</Txt>
            <Txt variant="caption" tone="muted">
              average period
            </Txt>
          </View>
        </View>
      </Card>
      <Card padding={14}>
        {sorted.length === 0 ? (
          <EmptyState compact icon="flower-outline" title="No periods logged" />
        ) : (
          [...sorted].reverse().map((p, i) => {
            const next = sorted[sorted.findIndex((x) => x.id === p.id) + 1];
            const len = periodLength(p.data);
            return (
              <View key={p.id}>
                {i > 0 ? <Divider /> : null}
                <ListRow
                  title={`${formatDate(p.data.startDate, true)}${p.data.endDate ? ` to ${formatDate(p.data.endDate)}` : ', ongoing'}`}
                  subtitle={[len ? `${len} days` : null, next ? `cycle ${daysBetweenKeys(p.data.startDate, next.data.startDate)} days` : null].filter(Boolean).join(', ')}
                  onPress={() => router.push({ pathname: '/cycle/log', params: { date: p.data.startDate } })}
                />
              </View>
            );
          })
        )}
      </Card>
    </Screen>
  );
}
