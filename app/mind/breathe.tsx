import * as Haptics from 'expo-haptics';
import { Stack } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { AccessibilityInfo, Animated, Easing, View } from 'react-native';
import { Button, Card, ChipSelect, Screen, Txt } from '../../src/components/ui';
import { BREATH_PATTERNS } from '../../src/features/mind/content';
import { colors } from '../../src/theme/tokens';
import { formatClock } from '../../src/utils/date';

export default function Breathe() {
  const [patternId, setPatternId] = useState(BREATH_PATTERNS[0].id);
  const [minutes, setMinutes] = useState(3);
  const [running, setRunning] = useState(false);
  const [phaseIndex, setPhaseIndex] = useState(0);
  const [phaseLeft, setPhaseLeft] = useState(0);
  const [remaining, setRemaining] = useState(0);
  const [reduceMotion, setReduceMotion] = useState(false);
  const scale = useRef(new Animated.Value(0.6)).current;
  const pattern = BREATH_PATTERNS.find((p) => p.id === patternId)!;

  useEffect(() => {
    AccessibilityInfo.isReduceMotionEnabled().then(setReduceMotion).catch(() => undefined);
  }, []);

  useEffect(() => {
    if (!running) return;
    const phase = pattern.phases[phaseIndex];
    if (!reduceMotion) {
      const to = phase.label === 'Breathe in' ? 1 : phase.label === 'Breathe out' ? 0.6 : null;
      if (to !== null) Animated.timing(scale, { toValue: to, duration: phase.seconds * 1000, easing: Easing.inOut(Easing.ease), useNativeDriver: true }).start();
    }
    void Haptics.selectionAsync().catch(() => undefined);
    setPhaseLeft(phase.seconds);
    const tick = setInterval(() => {
      setPhaseLeft((s) => s - 1);
      setRemaining((r) => r - 1);
    }, 1000);
    const next = setTimeout(() => setPhaseIndex((i) => (i + 1) % pattern.phases.length), phase.seconds * 1000);
    return () => {
      clearInterval(tick);
      clearTimeout(next);
    };
  }, [running, phaseIndex, pattern, reduceMotion, scale]);

  useEffect(() => {
    if (running && remaining <= 0) {
      setRunning(false);
      scale.setValue(0.6);
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => undefined);
    }
  }, [remaining, running, scale]);

  const start = () => {
    setPhaseIndex(0);
    setRemaining(minutes * 60);
    scale.setValue(0.6);
    setRunning(true);
  };

  const phase = pattern.phases[phaseIndex];

  return (
    <Screen>
      <Stack.Screen options={{ title: 'Breathing' }} />
      {!running ? (
        <>
          {BREATH_PATTERNS.map((p) => (
            <Card key={p.id} tone={p.id === patternId ? 'moss' : 'paper'} onPress={() => setPatternId(p.id)} padding={16}>
              <Txt variant="heading">{p.name}</Txt>
              <Txt variant="caption" tone="muted">
                {p.description} {p.phases.map((ph) => `${ph.label.toLowerCase()} ${ph.seconds}`).join(', ')}.
              </Txt>
            </Card>
          ))}
          <Txt variant="label" tone="muted">
            Length
          </Txt>
          <ChipSelect options={[1, 3, 5].map((m) => ({ label: `${m} min`, value: m }))} value={minutes} onChange={(v) => v && setMinutes(v)} />
          <Button full label="Begin" icon="play" onPress={start} />
          <Txt variant="caption" tone="muted">
            Breathe gently, without forcing. If you feel light-headed, return to normal breathing.
          </Txt>
        </>
      ) : (
        <View style={{ alignItems: 'center', gap: 24, paddingVertical: 24 }}>
          <Animated.View
            style={{
              width: 240,
              height: 240,
              borderRadius: 120,
              backgroundColor: colors.mossSoft,
              alignItems: 'center',
              justifyContent: 'center',
              transform: [{ scale: reduceMotion ? 1 : scale }],
            }}
          >
            <Txt variant="title" accessibilityLiveRegion="polite">
              {phase.label}
            </Txt>
            <Txt variant="numberLarge">{Math.max(0, phaseLeft)}</Txt>
          </Animated.View>
          <Txt tone="muted">{formatClock(Math.max(0, remaining))} left</Txt>
          <Button label="Stop" variant="secondary" onPress={() => setRunning(false)} />
        </View>
      )}
    </Screen>
  );
}
