import { Stack, router, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { Button, ChipMulti, ChipSelect, Field, Screen, SectionHeader, FieldError } from '../../src/components/ui';
import { MOOD_LABELS, MOOD_TAGS, STRESS_LABELS } from '../../src/features/mind/content';
import { useRecord } from '../../src/hooks/useRecords';
import { repos } from '../../src/repositories';
import { confirmDelete, showError } from '../../src/utils/alerts';
import { LIMITS } from '../../src/utils/validation';

export default function MoodCheckin() {
  const { id } = useLocalSearchParams<{ id?: string }>();
  const existing = useRecord(repos.moods, id);
  const [mood, setMood] = useState<number | null>(null);
  const [stress, setStress] = useState<number | null>(null);
  const [energy, setEnergy] = useState<number | null>(null);
  const [tags, setTags] = useState<string[]>([]);
  const [note, setNote] = useState('');
  const [moodError, setMoodError] = useState<string | null>(null);

  useEffect(() => {
    const m = existing.data?.data;
    if (!m) return;
    setMood(m.mood);
    setStress(m.stress ?? null);
    setEnergy(m.energy ?? null);
    setTags(m.tags);
    setNote(m.note ?? '');
  }, [existing.data]);

  const save = async () => {
    if (!mood) return setMoodError('Choose how you’re feeling to save a check-in.');
    const data = { mood, stress, energy, tags, note: note.trim() || undefined };
    try {
      if (id && existing.data) await repos.moods.update(id, data);
      else await repos.moods.create(data);
      router.back();
    } catch (e) {
      showError(e);
    }
  };

  return (
    <Screen keyboard footer={<Button full label="Save check-in" onPress={save} />}>
      <Stack.Screen options={{ title: id ? 'Edit check-in' : 'Check in' }} />
      <SectionHeader title="Mood" />
      <ChipSelect
        options={MOOD_LABELS.map((l, i) => ({ label: l, value: i + 1 }))}
        value={mood}
        onChange={(v) => {
          setMood(v);
          setMoodError(null);
        }}
      />
      <FieldError message={moodError} />
      <SectionHeader title="Stress" />
      <ChipSelect allowNone options={STRESS_LABELS.map((l, i) => ({ label: l, value: i + 1 }))} value={stress} onChange={setStress} />
      <SectionHeader title="Energy" />
      <ChipSelect allowNone options={['Very low', 'Low', 'Okay', 'Good', 'High'].map((l, i) => ({ label: l, value: i + 1 }))} value={energy} onChange={setEnergy} />
      <SectionHeader title="What’s on your mind" />
      <ChipMulti options={MOOD_TAGS.map((t) => ({ label: t, value: t }))} values={tags} onChange={setTags} />
      <Field label="Note (optional)" value={note} onChangeText={setNote} multiline maxLength={LIMITS.note} showCount />
      {id && existing.data ? (
        <Button
          label="Delete check-in"
          variant="danger"
          icon="trash-outline"
          onPress={() =>
            confirmDelete('this check-in', async () => {
              await repos.moods.remove(id);
              router.back();
            })
          }
        />
      ) : null}
    </Screen>
  );
}
