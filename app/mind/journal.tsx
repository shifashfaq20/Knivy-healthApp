import { Stack, router } from 'expo-router';
import { useState } from 'react';
import { View } from 'react-native';
import { Button, Card, EmptyState, Field, LockGate, Screen, Txt } from '../../src/components/ui';
import { useRecords } from '../../src/hooks/useRecords';
import { repos } from '../../src/repositories';
import { formatDateTime } from '../../src/utils/date';

export default function Journal() {
  const entries = useRecords(repos.journal, { limit: 1000 });
  const [q, setQ] = useState('');
  const query = q.trim().toLowerCase();
  const list = (entries.data ?? []).filter((e) => !query || e.data.body.toLowerCase().includes(query) || (e.data.title ?? '').toLowerCase().includes(query));

  return (
    <LockGate area="journal">
      <Screen>
        <Stack.Screen options={{ title: 'Journal' }} />
        <Button full label="New entry" icon="create-outline" onPress={() => router.push('/mind/entry')} />
        {(entries.data ?? []).length > 3 ? <Field value={q} onChangeText={setQ} placeholder="Search your journal" /> : null}
        {list.length === 0 ? (
          <EmptyState icon="book-outline" title={query ? 'No entries match' : 'Your journal is empty'} body="Entries stay on this phone and aren’t shared with anyone. You can lock the journal in Settings." />
        ) : null}
        {list.map((e) => (
          <Card key={e.id} onPress={() => router.push({ pathname: '/mind/entry', params: { id: e.id } })} padding={16}>
            <View style={{ gap: 4 }}>
              <Txt variant="caption" tone="muted">
                {formatDateTime(e.recordedAt)}
              </Txt>
              {e.data.title ? <Txt variant="heading">{e.data.title}</Txt> : null}
              <Txt tone="muted" numberOfLines={3}>
                {e.data.body}
              </Txt>
            </View>
          </Card>
        ))}
      </Screen>
    </LockGate>
  );
}
