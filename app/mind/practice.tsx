import * as Haptics from 'expo-haptics';
import { Stack } from 'expo-router';
import { useEffect, useState } from 'react';
import { View } from 'react-native';
import { Button, Card, ProgressBar, Screen, Txt } from '../../src/components/ui';
import { PRACTICES, type Practice } from '../../src/features/mind/content';
import { colors } from '../../src/theme/tokens';
import { formatClock } from '../../src/utils/date';

const KIND_LABEL = { meditation: 'Meditation', relaxation: 'Relaxation', mindfulness: 'Mindfulness' };

export default function Practices() {
  const [active, setActive] = useState<Practice | null>(null);
  const [elapsed, setElapsed] = useState(0);
  const [paused, setPaused] = useState(false);
  const [done, setDone] = useState(false);

  useEffect(() => {
    if (!active || paused || done) return;
    const t = setInterval(() => setElapsed((e) => e + 1), 1000);
    return () => clearInterval(t);
  }, [active, paused, done]);

  const total = active ? active.minutes * 60 : 0;
  const stepLen = active ? total / active.steps.length : 1;
  const stepIndex = active ? Math.min(active.steps.length - 1, Math.floor(elapsed / stepLen)) : 0;

  useEffect(() => {
    if (!active) return;
    if (elapsed >= total && !done) {
      setDone(true);
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => undefined);
    } else if (elapsed > 0 && elapsed % Math.round(stepLen) === 0) {
      void Haptics.selectionAsync().catch(() => undefined);
    }
  }, [elapsed, total, done, active, stepLen]);

  if (!active) {
    return (
      <Screen>
        <Stack.Screen options={{ title: 'Guided practices' }} />
        <Txt tone="muted">Short written practices. Each step stays on screen for its share of the time.</Txt>
        {PRACTICES.map((p) => (
          <Card
            key={p.id}
            padding={16}
            onPress={() => {
              setActive(p);
              setElapsed(0);
              setPaused(false);
              setDone(false);
            }}
          >
            <Txt variant="heading">{p.name}</Txt>
            <Txt variant="caption" tone="muted">
              {KIND_LABEL[p.kind]}, {p.minutes} minutes
            </Txt>
          </Card>
        ))}
      </Screen>
    );
  }

  return (
    <Screen>
      <Stack.Screen options={{ title: active.name }} />
      <ProgressBar value={elapsed} max={total} color={colors.moss} />
      <Txt variant="caption" tone="muted">
        {done ? 'Complete' : `${formatClock(total - elapsed)} left`}
      </Txt>
      <Card hero tone="moss">
        <View style={{ minHeight: 180, justifyContent: 'center' }}>
          <Txt variant="title" accessibilityLiveRegion="polite">
            {done ? 'Take a moment before moving on.' : active.steps[stepIndex]}
          </Txt>
        </View>
      </Card>
      <View style={{ flexDirection: 'row', gap: 10 }}>
        {!done ? <Button label={paused ? 'Resume' : 'Pause'} variant="secondary" icon={paused ? 'play' : 'pause'} onPress={() => setPaused((p) => !p)} /> : null}
        <Button label={done ? 'Finish' : 'End'} variant={done ? 'primary' : 'ghost'} onPress={() => setActive(null)} />
      </View>
    </Screen>
  );
}
