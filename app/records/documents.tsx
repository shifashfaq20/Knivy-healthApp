import * as DocumentPicker from 'expo-document-picker';
import { Directory, File, Paths } from 'expo-file-system';
import { Stack } from 'expo-router';
import * as Sharing from 'expo-sharing';
import { useState } from 'react';
import { Modal, Pressable, View } from 'react-native';
import { Banner, Button, Card, ChipSelect, DateTimeField, Divider, EmptyState, Field, IconButton, ListRow, LockGate, Screen, Txt } from '../../src/components/ui';
import { DOCUMENT_CATEGORIES } from '../../src/features/records/schemas';
import { useRecords } from '../../src/hooks/useRecords';
import { repos } from '../../src/repositories';
import { RECORDS_DIR } from '../../src/services/dataExport';
import { colors } from '../../src/theme/tokens';
import type { DocumentCategory } from '../../src/types/models';
import { confirmDelete, showError } from '../../src/utils/alerts';
import { dateKey, formatDate } from '../../src/utils/date';
import { newId } from '../../src/utils/id';
import { LIMITS, check, validate } from '../../src/utils/validation';

type Picked = { uri: string; name: string; mimeType?: string | null; size?: number | null };

const MAX_BYTES = 25 * 1024 * 1024;

function formatSize(bytes?: number | null) {
  if (!bytes) return null;
  return bytes > 1024 * 1024 ? `${(bytes / 1024 / 1024).toFixed(1)} MB` : `${Math.round(bytes / 1024)} KB`;
}

export default function Documents() {
  const docs = useRecords(repos.documents, { limit: 1000 });
  const [filter, setFilter] = useState<DocumentCategory | null>(null);
  const [picked, setPicked] = useState<Picked | null>(null);
  const [title, setTitle] = useState('');
  const [category, setCategory] = useState<DocumentCategory>('lab-report');
  const [date, setDate] = useState<Date | null>(new Date());
  const [note, setNote] = useState('');
  const [saving, setSaving] = useState(false);
  const [titleError, setTitleError] = useState<string | null>(null);

  const pick = async () => {
    try {
      const res = await DocumentPicker.getDocumentAsync({ type: ['application/pdf', 'image/*'], copyToCacheDirectory: true, multiple: false });
      if (res.canceled || !res.assets[0]) return;
      const a = res.assets[0];
      if (a.size && a.size > MAX_BYTES) return showError(new Error('Choose a file smaller than 25 MB.'), 'File too large');
      if (a.mimeType && a.mimeType !== 'application/pdf' && !a.mimeType.startsWith('image/')) return showError(new Error('Choose a PDF or a photo.'), 'Unsupported file');
      setTitleError(null);
      setPicked({ uri: a.uri, name: a.name, mimeType: a.mimeType, size: a.size });
      setTitle(a.name.replace(/\.[^.]+$/, ''));
    } catch (e) {
      showError(e);
    }
  };

  const save = async () => {
    if (!picked) return;
    const problem = validate({ title }, { title: [check.required('a title'), check.text(), check.maxLength(LIMITS.title)] }).title;
    if (problem) return setTitleError(problem);
    setSaving(true);
    try {
      // Copy into Knivy's private documents folder so the record survives cache clean-up.
      const dir = new Directory(Paths.document, RECORDS_DIR);
      if (!dir.exists) dir.create();
      const safe = picked.name.replace(/[^\w.\-]+/g, '_');
      const dest = new File(dir, `${newId()}-${safe}`);
      new File(picked.uri).copy(dest);
      await repos.documents.create({
        title: title.trim(),
        category,
        fileUri: dest.uri,
        fileName: picked.name,
        mimeType: picked.mimeType ?? null,
        sizeBytes: picked.size ?? null,
        date: date ? dateKey(date) : null,
        note: note.trim() || undefined,
      });
      setPicked(null);
      setNote('');
    } catch (e) {
      showError(e, 'Couldn’t save the document');
    } finally {
      setSaving(false);
    }
  };

  const open = async (uri: string, mimeType?: string | null) => {
    try {
      const f = new File(uri);
      if (!f.exists) return showError(new Error('The file is missing from this phone.'), 'Can’t open document');
      await Sharing.shareAsync(uri, { mimeType: mimeType ?? undefined });
    } catch (e) {
      showError(e);
    }
  };

  const remove = (id: string, uri: string) =>
    confirmDelete('this document', async () => {
      try {
        const f = new File(uri);
        if (f.exists) f.delete();
      } finally {
        await repos.documents.remove(id);
      }
    }, 'The file is deleted from this phone.');

  const list = (docs.data ?? []).filter((d) => !filter || d.data.category === filter);

  return (
    <LockGate area="records">
      <Screen>
        <Stack.Screen options={{ title: 'Documents' }} />
        <Button full label="Add a document" icon="document-attach-outline" onPress={() => void pick()} />
        <ChipSelect scroll allowNone options={DOCUMENT_CATEGORIES.map((c) => ({ label: c.label, value: c.value }))} value={filter} onChange={setFilter} />
        <Card padding={14}>
          {list.length === 0 ? (
            <EmptyState compact icon="document-outline" title="No documents" body="Add PDFs or photos of lab reports, prescriptions and letters." />
          ) : (
            list.map((d, i) => (
              <View key={d.id}>
                {i > 0 ? <Divider /> : null}
                <ListRow
                  title={d.data.title}
                  subtitle={[DOCUMENT_CATEGORIES.find((c) => c.value === d.data.category)?.label, d.data.date ? formatDate(d.data.date, true) : null, formatSize(d.data.sizeBytes), d.data.note]
                    .filter(Boolean)
                    .join(', ')}
                  onPress={() => void open(d.data.fileUri, d.data.mimeType)}
                  chevron={false}
                  right={<IconButton icon="trash-outline" tone="clear" size={32} label="Delete document" onPress={() => remove(d.id, d.data.fileUri)} />}
                />
              </View>
            ))
          )}
        </Card>
        <Banner body="Documents are copied into Knivy’s private storage on this phone. Opening one uses your phone’s share sheet, so choose where it goes with care." />

        <Modal visible={!!picked} transparent animationType="slide" onRequestClose={() => setPicked(null)}>
          <Pressable style={{ flex: 1, backgroundColor: 'rgba(43,39,34,0.25)' }} onPress={() => setPicked(null)} />
          <View style={{ backgroundColor: colors.paper, borderTopLeftRadius: 28, borderTopRightRadius: 28, padding: 20, paddingBottom: 40, gap: 12 }}>
            <Txt variant="subtitle">Save document</Txt>
            <Txt variant="caption" tone="muted">
              {picked?.name}
            </Txt>
            <Field
              label="Title"
              value={title}
              onChangeText={(v) => {
                setTitle(v);
                setTitleError(null);
              }}
              maxLength={LIMITS.title}
              error={titleError}
            />
            <ChipSelect scroll options={DOCUMENT_CATEGORIES.map((c) => ({ label: c.label, value: c.value }))} value={category} onChange={(v) => v && setCategory(v)} />
            <DateTimeField label="Date on the document" mode="date" value={date} onChange={setDate} onClear={() => setDate(null)} placeholder="Not set" />
            <Field label="Note" value={note} onChangeText={setNote} maxLength={LIMITS.title} />
            <Button full label="Save" loading={saving} onPress={() => void save()} />
          </View>
        </Modal>
      </Screen>
    </LockGate>
  );
}
