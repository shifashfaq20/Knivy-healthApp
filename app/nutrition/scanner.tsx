import * as ImagePicker from 'expo-image-picker';
import { Stack, router, useLocalSearchParams } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { Image, View } from 'react-native';
import { Banner, Button, Card, ChipSelect, Divider, Field, IconButton, LoadingState, Screen, SourceBadge, Txt } from '../../src/components/ui';
import { recognizeFoodPhoto, aiConfigured, type RecognizedFood } from '../../src/services/ai/client';
import { providerLabel, searchFoods } from '../../src/services/nutrition';
import { repos } from '../../src/repositories';
import { useDraft } from '../../src/stores/draftStore';
import type { FoodItem, MealSlot } from '../../src/types/models';
import { showError } from '../../src/utils/alerts';
import { todayKey } from '../../src/utils/date';
import { MEAL_SLOTS, sumPortions } from '../../src/utils/nutrition';
import { parseNumber } from '../../src/utils/units';
import { timestampForDay } from '../../src/features/nutrition/dates';

interface Item {
  label: string;
  confidence: number | null;
  food: FoodItem | null;
  grams: string;
  approximate: boolean;
}

export default function FoodPhotoScanner() {
  const params = useLocalSearchParams<{ date?: string }>();
  const [photo, setPhoto] = useState<{ uri: string; mimeType?: string } | null>(null);
  const [phase, setPhase] = useState<'pick' | 'analysing' | 'review' | 'unavailable' | 'error'>('pick');
  const [message, setMessage] = useState('');
  const [items, setItems] = useState<Item[]>([]);
  const [slot, setSlot] = useState<MealSlot>('lunch');
  const [saving, setSaving] = useState(false);
  const replaceIndex = useRef<number | null>(null);
  const picked = useDraft((s) => s.pickedIngredient);
  const setPicked = useDraft((s) => s.setPickedIngredient);

  useEffect(() => {
    if (!picked) return;
    const idx = replaceIndex.current;
    setItems((xs) => {
      const next = { label: picked.food.name, confidence: null, food: picked.food, grams: String(Math.round(picked.grams)), approximate: false };
      if (idx === null || idx >= xs.length) return [...xs, next];
      return xs.map((x, i) => (i === idx ? { ...next, label: x.label, confidence: x.confidence } : x));
    });
    replaceIndex.current = null;
    setPicked(null);
  }, [picked, setPicked]);

  const choose = async (from: 'camera' | 'library') => {
    const perm = from === 'camera' ? await ImagePicker.requestCameraPermissionsAsync() : await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) {
      setMessage(from === 'camera' ? 'Camera access is off. Turn it on in Settings to take a photo.' : 'Photo access is off. Turn it on in Settings to choose a photo.');
      return;
    }
    const opts: ImagePicker.ImagePickerOptions = { mediaTypes: ['images'], quality: 0.7, allowsEditing: false };
    const res = from === 'camera' ? await ImagePicker.launchCameraAsync(opts) : await ImagePicker.launchImageLibraryAsync(opts);
    if (res.canceled || !res.assets[0]) return;
    setPhoto({ uri: res.assets[0].uri, mimeType: res.assets[0].mimeType ?? undefined });
    setMessage('');
    setPhase('pick');
  };

  const analyse = async () => {
    if (!photo) return;
    setPhase('analysing');
    const res = await recognizeFoodPhoto(photo.uri, photo.mimeType);
    if (res.status === 'unavailable') {
      setMessage(res.message);
      setPhase('unavailable');
      return;
    }
    if (res.status === 'error') {
      setMessage(res.message);
      setPhase('error');
      return;
    }
    // Match each recognised item to a real nutrition record. Nothing is invented.
    const matched: Item[] = [];
    for (const r of res.data.items as RecognizedFood[]) {
      let food: FoodItem | null = null;
      try {
        food = (await searchFoods(r.label, 'all'))[0] ?? null;
      } catch {
        food = null;
      }
      matched.push({ label: r.label, confidence: r.confidence, food, grams: r.estimatedGrams ? String(Math.round(r.estimatedGrams)) : '', approximate: !!r.estimatedGrams });
    }
    setItems(matched);
    setPhase('review');
  };

  const findFood = (index: number | null, q?: string) => {
    replaceIndex.current = index;
    router.push({ pathname: '/nutrition/search', params: { target: 'photo', q: q ?? '' } });
  };

  const ready = items.filter((i) => i.food && parseNumber(i.grams));
  const totals = sumPortions(ready.map((i) => ({ food: i.food!, grams: parseNumber(i.grams)! })));

  const confirm = async () => {
    if (ready.length === 0) return;
    setSaving(true);
    try {
      const at = timestampForDay(params.date || todayKey());
      for (const i of ready) {
        await repos.foodEntries.create(
          { slot, food: i.food!, grams: parseNumber(i.grams)!, origin: 'photo' },
          { recordedAt: at, source: 'manual', sourceName: `Photo, ${providerLabel(i.food!.provider)}` },
        );
      }
      router.back();
    } catch (e) {
      showError(e);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Screen keyboard footer={phase === 'review' ? <Button full label={`Save ${ready.length} item${ready.length === 1 ? '' : 's'}`} onPress={confirm} loading={saving} disabled={!ready.length} /> : undefined}>
      <Stack.Screen options={{ title: 'Meal photo' }} />
      {!aiConfigured ? (
        <Banner tone="warn" title="Photo recognition isn’t connected yet" body="It needs the Knivy backend, which comes in a later release. You can still log food by search or barcode." />
      ) : null}

      {photo ? <Image source={{ uri: photo.uri }} style={{ width: '100%', height: 240, borderRadius: 24 }} resizeMode="cover" accessibilityLabel="Meal photo" /> : null}

      {phase === 'pick' || phase === 'unavailable' || phase === 'error' ? (
        <View style={{ gap: 10 }}>
          <View style={{ flexDirection: 'row', gap: 10 }}>
            <View style={{ flex: 1 }}>
              <Button full label="Take photo" icon="camera-outline" variant={photo ? 'secondary' : 'primary'} onPress={() => void choose('camera')} />
            </View>
            <View style={{ flex: 1 }}>
              <Button full label="Choose photo" icon="images-outline" variant="secondary" onPress={() => void choose('library')} />
            </View>
          </View>
          {photo ? <Button full label="Analyse photo" icon="sparkles-outline" onPress={() => void analyse()} /> : null}
        </View>
      ) : null}

      {phase === 'analysing' ? <LoadingState label="Analysing" /> : null}
      {message ? <Banner tone={phase === 'error' ? 'warn' : 'info'} body={message} /> : null}
      {phase === 'unavailable' || phase === 'error' ? <Button label="Search foods instead" variant="secondary" onPress={() => router.replace({ pathname: '/nutrition/search', params: { slot, date: params.date ?? '' } })} /> : null}

      {phase === 'review' ? (
        <>
          <ChipSelect options={MEAL_SLOTS.map((s) => ({ label: s.label, value: s.id }))} value={slot} onChange={(v) => v && setSlot(v)} />
          <Card padding={14}>
            {items.map((it, i) => (
              <View key={i}>
                {i > 0 ? <Divider /> : null}
                <View style={{ paddingVertical: 10, gap: 8 }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                    <View style={{ flex: 1 }}>
                      <Txt variant="bodyMedium">{it.food?.name ?? it.label}</Txt>
                      <Txt variant="caption" tone="muted">
                        {it.confidence !== null ? `Recognised as “${it.label}”, ${Math.round(it.confidence * 100)}% confidence` : 'Added by you'}
                        {it.food ? `. Nutrition from ${providerLabel(it.food.provider)}` : '. No database match yet'}
                      </Txt>
                    </View>
                    <IconButton icon="close" tone="clear" size={30} label="Remove item" onPress={() => setItems((xs) => xs.filter((_, j) => j !== i))} />
                  </View>
                  <View style={{ flexDirection: 'row', gap: 10, alignItems: 'center' }}>
                    <View style={{ flex: 1 }}>
                      <Field value={it.grams} onChangeText={(v) => setItems((xs) => xs.map((x, j) => (j === i ? { ...x, grams: v, approximate: false } : x)))} keyboardType="decimal-pad" suffix={it.food?.basis ?? 'g'} placeholder="Portion" />
                    </View>
                    <Button size="sm" variant="secondary" label={it.food ? 'Change' : 'Find'} onPress={() => findFood(i, it.label)} />
                  </View>
                  {it.approximate ? <SourceBadge source="estimated" name="portion from photo" /> : null}
                </View>
              </View>
            ))}
          </Card>
          <Button label="Add a missing item" icon="add" variant="secondary" onPress={() => findFood(null)} />
          <Card tone="linen">
            <Txt variant="heading">{Math.round(totals.values.energyKcal)} kcal</Txt>
            <Txt variant="caption" tone="muted">
              Protein {Math.round(totals.values.proteinG)} g, carbs {Math.round(totals.values.carbsG)} g, fat {Math.round(totals.values.fatG)} g
              {totals.missing.energyKcal ? `. ${totals.missing.energyKcal} item(s) lack energy data.` : ''}
            </Txt>
          </Card>
          <Banner body="Portions from a photo are approximate. A photo can’t show exact weight, cooking oil, sauces or hidden ingredients, so adjust the amounts before saving." />
        </>
      ) : null}
    </Screen>
  );
}
