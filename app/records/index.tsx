import { Stack, router } from 'expo-router';
import { useMemo, useState } from 'react';
import { View } from 'react-native';
import { Banner, Card, Divider, Field, Icon, ListRow, LockGate, Screen, Txt } from '../../src/components/ui';
import { DOCUMENT_CATEGORIES, RECORD_KINDS } from '../../src/features/records/schemas';
import { useRecords } from '../../src/hooks/useRecords';
import { repos } from '../../src/repositories';
import { colors } from '../../src/theme/tokens';

export default function Records() {
  const [q, setQ] = useState('');
  const meds = useRecords(repos.medications, { limit: 500 });
  const docs = useRecords(repos.documents, { limit: 1000 });
  const allergies = useRecords(repos.allergies, { limit: 500 });
  const conditions = useRecords(repos.conditions, { limit: 500 });
  const vaccinations = useRecords(repos.vaccinations, { limit: 500 });
  const appointments = useRecords(repos.appointments, { limit: 500 });
  const contacts = useRecords(repos.contacts, { limit: 500 });
  const byKind: Record<string, { id: string; data: Record<string, unknown> }[]> = {
    allergies: (allergies.data ?? []) as never,
    conditions: (conditions.data ?? []) as never,
    vaccinations: (vaccinations.data ?? []) as never,
    appointments: (appointments.data ?? []) as never,
    contacts: (contacts.data ?? []) as never,
  };

  const query = q.trim().toLowerCase();
  const results = useMemo(() => {
    if (query.length < 2) return [];
    const out: { key: string; title: string; subtitle: string; go: () => void }[] = [];
    for (const m of meds.data ?? []) {
      if (`${m.data.name} ${m.data.dosage ?? ''}`.toLowerCase().includes(query))
        out.push({ key: m.id, title: m.data.name, subtitle: 'Medication', go: () => router.push({ pathname: '/records/medication', params: { id: m.id } }) });
    }
    for (const d of docs.data ?? []) {
      if (`${d.data.title} ${d.data.fileName} ${d.data.note ?? ''}`.toLowerCase().includes(query))
        out.push({ key: d.id, title: d.data.title, subtitle: 'Document', go: () => router.push({ pathname: '/records/documents', params: { focus: d.id } }) });
    }
    for (const kind of RECORD_KINDS) {
      for (const r of byKind[kind.id] ?? []) {
        if (JSON.stringify(r.data).toLowerCase().includes(query))
          out.push({ key: r.id, title: kind.titleOf(r.data), subtitle: kind.title, go: () => router.push({ pathname: '/records/edit', params: { kind: kind.id, id: r.id } }) });
      }
    }
    return out;
  }, [query, meds.data, docs.data, allergies.data, conditions.data, vaccinations.data, appointments.data, contacts.data]);

  const sections = [
    { key: 'meds', title: 'Medications', icon: 'medkit-outline' as const, count: meds.data?.length ?? 0, go: () => router.push('/records/medications') },
    ...RECORD_KINDS.map((k) => ({ key: k.id, title: k.title, icon: k.icon, count: byKind[k.id]?.length ?? 0, go: () => router.push({ pathname: '/records/[kind]', params: { kind: k.id } }) })),
    { key: 'docs', title: 'Documents and lab reports', icon: 'document-attach-outline' as const, count: docs.data?.length ?? 0, go: () => router.push('/records/documents') },
  ];

  return (
    <LockGate area="records">
      <Screen keyboard>
        <Stack.Screen options={{ title: 'Health records' }} />
        <Field value={q} onChangeText={setQ} placeholder="Search your records" returnKeyType="search" />
        {query.length >= 2 ? (
          <Card padding={14}>
            {results.length === 0 ? (
              <Txt tone="muted">Nothing matches “{q.trim()}”.</Txt>
            ) : (
              results.map((r, i) => (
                <View key={r.key}>
                  {i > 0 ? <Divider /> : null}
                  <ListRow title={r.title} subtitle={r.subtitle} onPress={r.go} />
                </View>
              ))
            )}
          </Card>
        ) : (
          <Card padding={14}>
            {sections.map((s, i) => (
              <View key={s.key}>
                {i > 0 ? <Divider /> : null}
                <ListRow title={s.title} icon={s.icon} onPress={s.go} right={s.count ? String(s.count) : undefined} />
              </View>
            ))}
          </Card>
        )}
        <Banner
          icon="lock-closed-outline"
          body={`Records are stored only on this phone. You can lock this section with your phone’s passcode or biometrics in Settings. Document types: ${DOCUMENT_CATEGORIES.map((c) => c.label.toLowerCase()).join(', ')}.`}
        />
        <View style={{ flexDirection: 'row', gap: 8, alignItems: 'center' }}>
          <Icon name="information-circle-outline" size={16} color={colors.muted} />
          <Txt variant="caption" tone="muted" style={{ flex: 1 }}>
            Knivy stores what you enter. It never suggests or changes medication or doses.
          </Txt>
        </View>
      </Screen>
    </LockGate>
  );
}
