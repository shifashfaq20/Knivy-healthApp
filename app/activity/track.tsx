import * as Location from 'expo-location';
import { Stack, router } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { Alert, View } from 'react-native';
import { Banner, Button, Card, ChipSelect, PermissionCard, Screen, SourceBadge, Txt } from '../../src/components/ui';
import { useRecords } from '../../src/hooks/useRecords';
import { repos } from '../../src/repositories';
import { useProfile } from '../../src/stores/profileStore';
import type { ActivityKind, RoutePoint } from '../../src/types/models';
import { showError } from '../../src/utils/alerts';
import { formatClock } from '../../src/utils/date';
import { estimateEnergyKcal } from '../../src/utils/energy';
import { haversineKm } from '../../src/utils/geo';
import { distance } from '../../src/utils/units';

type Phase = 'idle' | 'tracking' | 'paused' | 'done';
const MAX_ACCURACY_M = 25;

export default function TrackActivity() {
  const units = useProfile((s) => s.units);
  const measures = useRecords(repos.measurements, { limit: 200 });
  const latestWeight = measures.data?.find((m) => m.data.type === 'weight')?.data.value ?? null;

  const [kind, setKind] = useState<ActivityKind>('walk');
  const [phase, setPhase] = useState<Phase>('idle');
  const [perm, setPerm] = useState<Location.LocationPermissionResponse | null>(null);
  const [km, setKm] = useState(0);
  const [elapsed, setElapsed] = useState(0);
  const [weakSignal, setWeakSignal] = useState(false);
  const [saving, setSaving] = useState(false);

  const points = useRef<RoutePoint[]>([]);
  const sub = useRef<Location.LocationSubscription | null>(null);
  const startedAt = useRef<number>(0);
  const pausedMs = useRef(0);
  const pauseStart = useRef<number | null>(null);
  const phaseRef = useRef<Phase>('idle');
  phaseRef.current = phase;

  useEffect(() => {
    Location.getForegroundPermissionsAsync().then(setPerm).catch(() => undefined);
    return () => sub.current?.remove();
  }, []);

  useEffect(() => {
    if (phase !== 'tracking') return;
    const t = setInterval(() => setElapsed((Date.now() - startedAt.current - pausedMs.current) / 1000), 1000);
    return () => clearInterval(t);
  }, [phase]);

  const start = async () => {
    let p = perm;
    if (!p?.granted) {
      p = await Location.requestForegroundPermissionsAsync();
      setPerm(p);
      if (!p.granted) return;
    }
    const enabled = await Location.hasServicesEnabledAsync();
    if (!enabled) {
      Alert.alert('Location is off', 'Turn on location services to record distance.');
      return;
    }
    points.current = [];
    pausedMs.current = 0;
    startedAt.current = Date.now();
    setKm(0);
    setElapsed(0);
    setPhase('tracking');
    sub.current = await Location.watchPositionAsync(
      { accuracy: Location.Accuracy.BestForNavigation, timeInterval: 2000, distanceInterval: 4 },
      (loc) => {
        const acc = loc.coords.accuracy ?? 999;
        setWeakSignal(acc > MAX_ACCURACY_M);
        if (phaseRef.current !== 'tracking' || acc > MAX_ACCURACY_M) return;
        const pt = { lat: loc.coords.latitude, lng: loc.coords.longitude, t: loc.timestamp };
        const prev = points.current[points.current.length - 1];
        if (prev) {
          const d = haversineKm(prev, pt);
          // Ignore jumps faster than ~25 m/s (GPS glitches).
          const dt = Math.max(1, (pt.t - prev.t) / 1000);
          if (d * 1000 / dt > 25) return;
          setKm((k) => k + d);
        }
        points.current.push(pt);
      },
    );
  };

  const pause = () => {
    pauseStart.current = Date.now();
    setPhase('paused');
  };
  const resume = () => {
    if (pauseStart.current) pausedMs.current += Date.now() - pauseStart.current;
    pauseStart.current = null;
    // Don't join the line across the paused gap.
    const last = points.current[points.current.length - 1];
    if (last) points.current.push({ ...last, t: Date.now() });
    setPhase('tracking');
  };
  const finish = () => {
    if (pauseStart.current) pausedMs.current += Date.now() - pauseStart.current;
    pauseStart.current = null;
    sub.current?.remove();
    sub.current = null;
    setElapsed((Date.now() - startedAt.current - pausedMs.current) / 1000);
    setPhase('done');
  };

  const durationMin = elapsed / 60;
  const estimate = estimateEnergyKcal(kind, durationMin, latestWeight);

  const save = async () => {
    setSaving(true);
    try {
      const pts = points.current;
      const step = Math.max(1, Math.ceil(pts.length / 500));
      await repos.activities.create(
        {
          kind,
          startedAt: new Date(startedAt.current).toISOString(),
          endedAt: new Date().toISOString(),
          durationMin: Math.max(1, Math.round(durationMin)),
          distanceKm: km > 0 ? km : null,
          energyKcal: estimate,
          energySource: estimate !== null ? 'estimated' : null,
          route: pts.filter((_, i) => i % step === 0),
        },
        { source: 'device', sourceName: 'Phone GPS', recordedAt: new Date(startedAt.current).toISOString() },
      );
      router.back();
    } catch (e) {
      showError(e);
    } finally {
      setSaving(false);
    }
  };

  const speedText = () => {
    if (km < 0.05 || elapsed < 30) return 'Collecting';
    const d = distance.toDisplay(km, units);
    const minPer = elapsed / 60 / d;
    return kind === 'cycle' ? `${(d / (elapsed / 3600)).toFixed(1)} ${units.distance}/h` : `${Math.floor(minPer)}:${String(Math.round((minPer % 1) * 60)).padStart(2, '0')} /${units.distance}`;
  };

  return (
    <Screen>
      <Stack.Screen options={{ title: 'Record outdoors', gestureEnabled: phase === 'idle' || phase === 'done' }} />
      {phase === 'idle' ? (
        <>
          <ChipSelect
            options={[
              { label: 'Walk', value: 'walk' },
              { label: 'Run', value: 'run' },
              { label: 'Ride', value: 'cycle' },
              { label: 'Hike', value: 'hike' },
            ]}
            value={kind}
            onChange={(v) => v && setKind(v)}
          />
          {perm && !perm.granted ? (
            <PermissionCard
              icon="location-outline"
              title="Location while recording"
              why="Knivy uses GPS only while you record, to measure distance and pace. Your route stays on this phone."
              canAskAgain={perm.canAskAgain}
              denied={perm.status === 'denied'}
              onRequest={() => void start()}
              requestLabel="Allow and start"
            />
          ) : (
            <Button full label="Start recording" icon="play" onPress={() => void start()} />
          )}
          <Banner body="Keep Knivy open while recording. Recording with the screen off needs background location, which requires a development build." />
        </>
      ) : null}

      {phase !== 'idle' ? (
        <Card hero>
          <View style={{ gap: 18 }}>
            <View>
              <Txt variant="label" tone="muted">
                Distance
              </Txt>
              <Txt variant="numberLarge">{distance.format(km, units)}</Txt>
            </View>
            <View style={{ flexDirection: 'row', gap: 24 }}>
              <View>
                <Txt variant="label" tone="muted">
                  Time
                </Txt>
                <Txt variant="number">{formatClock(elapsed)}</Txt>
              </View>
              <View>
                <Txt variant="label" tone="muted">
                  {kind === 'cycle' ? 'Speed' : 'Pace'}
                </Txt>
                <Txt variant="number">{speedText()}</Txt>
              </View>
            </View>
            <SourceBadge source="device" name="Phone GPS" />
            {weakSignal && phase === 'tracking' ? <Banner tone="warn" body="GPS signal is weak. Points with poor accuracy aren’t counted." /> : null}
          </View>
        </Card>
      ) : null}

      {phase === 'tracking' ? (
        <View style={{ flexDirection: 'row', gap: 10 }}>
          <View style={{ flex: 1 }}>
            <Button full label="Pause" variant="secondary" icon="pause" onPress={pause} />
          </View>
          <View style={{ flex: 1 }}>
            <Button full label="Finish" icon="stop" onPress={finish} />
          </View>
        </View>
      ) : null}
      {phase === 'paused' ? (
        <View style={{ flexDirection: 'row', gap: 10 }}>
          <View style={{ flex: 1 }}>
            <Button full label="Resume" icon="play" onPress={resume} />
          </View>
          <View style={{ flex: 1 }}>
            <Button full label="Finish" variant="secondary" icon="stop" onPress={finish} />
          </View>
        </View>
      ) : null}

      {phase === 'done' ? (
        <View style={{ gap: 12 }}>
          <Card tone="linen">
            <Txt variant="heading">Energy</Txt>
            <Txt tone="muted" style={{ marginTop: 4 }}>
              {estimate !== null
                ? `About ${estimate} kcal. This is an estimate from duration and your latest weight, not a measurement.`
                : 'No estimate: add your weight in Health readings to see one.'}
            </Txt>
          </Card>
          <Button full label="Save activity" onPress={save} loading={saving} />
          <Button
            full
            label="Discard"
            variant="ghost"
            onPress={() =>
              Alert.alert('Discard this recording?', 'It won’t be saved.', [
                { text: 'Keep', style: 'cancel' },
                { text: 'Discard', style: 'destructive', onPress: () => router.back() },
              ])
            }
          />
        </View>
      ) : null}
    </Screen>
  );
}
