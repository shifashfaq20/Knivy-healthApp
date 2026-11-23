import { Stack, router, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { Button, ChipSelect, Field, LockGate, Screen, Txt } from '../../src/components/ui';
import { MOOD_LABELS } from '../../src/features/mind/content';
import { useRecord } from '../../src/hooks/useRecords';
import { repos } from '../../src/repositories';
import { confirmDelete, showError } from '../../src/utils/alerts';
import { formatDateTime } from '../../src/utils/date';
import { LIMITS } from '../../src/utils/validation';

export default function JournalEntryScreen() {
  const { id } = useLocalSearchParams<{ id?: string }>();
  const existing = useRecord(repos.journal, id);
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [mood, setMood] = useState<number | null>(null);
  const [bodyError, setBodyError] = useState<string | null>(null);

  useEffect(() => {
    const e = existing.data?.data;
    if (!e) return;
    setTitle(e.title ?? '');
    setBody(e.body);
    setMood(e.mood ?? null);
  }, [existing.data]);

  const save = async () => {
    if (!body.trim()) return setBodyError('Write something before saving.');
    const data = { title: title.trim() || undefined, body: body.trim(), mood };
    try {
      if (id && existing.data) await repos.journal.update(id, data);
      else await repos.journal.create(data);
      router.back();
    } catch (e) {
      showError(e);
    }
  };

  return (
    <LockGate area="journal">
      <Screen keyboard footer={<Button full label="Save entry" onPress={save} />}>
        <Stack.Screen options={{ title: id ? 'Entry' : 'New entry' }} />
        {existing.data ? (
          <Txt variant="caption" tone="muted">
            Written {formatDateTime(existing.data.createdAt)}
          </Txt>
        ) : null}
        <Field label="Title (optional)" value={title} onChangeText={setTitle} maxLength={LIMITS.title} />
        <Field
          label="Entry"
          value={body}
          onChangeText={(v) => {
            setBody(v);
            setBodyError(null);
          }}
          multiline
          placeholder="Write freely. Only you can see this."
          autoFocus={!id}
          maxLength={LIMITS.journal}
          error={bodyError}
        />
        <Txt variant="label" tone="muted">
          Mood (optional)
        </Txt>
        <ChipSelect allowNone options={MOOD_LABELS.map((l, i) => ({ label: l, value: i + 1 }))} value={mood} onChange={setMood} />
        {id && existing.data ? (
          <Button
            label="Delete entry"
            variant="danger"
            icon="trash-outline"
            onPress={() =>
              confirmDelete('this entry', async () => {
                await repos.journal.remove(id);
                router.back();
              }, 'It will be permanently removed from this phone.')
            }
          />
        ) : null}
      </Screen>
    </LockGate>
  );
}
