import React from 'react';
import { Stack, router, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { Button, ChipSelect, DateTimeField, EmptyState, Field, FieldError, FormErrorSummary, LockGate, Screen, Txt } from '../../src/components/ui';
import { RECORD_KINDS, recordKind } from '../../src/features/records/schemas';
import { useRecord } from '../../src/hooks/useRecords';
import { confirmDelete, showError } from '../../src/utils/alerts';
import { dateKey, parseDateKey } from '../../src/utils/date';
import { LIMITS, check, futureError, useFormErrors, validate, type Check } from '../../src/utils/validation';

export default function RecordEdit() {
  const params = useLocalSearchParams<{ kind: string; id?: string }>();
  const kind = recordKind(params.kind);
  const existing = useRecord((kind ?? RECORD_KINDS[0]).repo, kind ? params.id : undefined);
  const [values, setValues] = useState<Record<string, string | null>>({});
  const form = useFormErrors<string>();

  useEffect(() => {
    const d = existing.data?.data;
    if (!d) return;
    setValues(Object.fromEntries(Object.entries(d).map(([k, v]) => [k, typeof v === 'string' ? v : null])));
  }, [existing.data]);

  if (!kind) {
    return (
      <Screen>
        <EmptyState icon="alert-circle-outline" title="Unknown record type" />
      </Screen>
    );
  }

  const set = (key: string, v: string | null) => {
    setValues((s) => ({ ...s, [key]: v }));
    form.clear(key);
  };

  const save = async () => {
    const schema: Record<string, Check[]> = {};
    const extra: Record<string, string | null> = {};
    for (const f of kind.fields) {
      const v = values[f.key];
      if (f.type === 'text' || f.type === 'multiline') {
        const rules: Check[] = [];
        if (f.required) rules.push(check.required(f.requiredLabel ?? f.label.toLowerCase()));
        rules.push(check.text(), check.maxLength(f.max ?? (f.type === 'multiline' ? LIMITS.note : LIMITS.title)));
        if (f.format === 'email') rules.push(check.email());
        if (f.format === 'phone') rules.push(check.phone());
        schema[f.key] = rules;
      } else if (f.required && !v) {
        extra[f.key] = `Choose ${f.requiredLabel ?? f.label.toLowerCase()}.`;
      }
      if ((f.type === 'date' || f.type === 'datetime') && f.notFuture && v) {
        extra[f.key] = futureError(f.type === 'date' ? parseDateKey(v) : new Date(v), 'The date');
      }
    }
    const text = Object.fromEntries(kind.fields.map((f) => [f.key, values[f.key] ?? '']));
    if (!form.apply({ ...validate(text, schema), ...extra })) return;
    const data: Record<string, unknown> = {};
    for (const f of kind.fields) {
      const v = values[f.key];
      data[f.key] = typeof v === 'string' && v.trim() ? v.trim() : null;
    }
    try {
      if (params.id && existing.data) await kind.repo.update(params.id, data);
      else await kind.repo.create(data);
      router.back();
    } catch (e) {
      showError(e);
    }
  };

  return (
    <LockGate area="records">
      <Screen keyboard footer={<Button full label="Save" onPress={save} />}>
        <Stack.Screen options={{ title: params.id ? kind.titleOf(existing.data?.data ?? {}) : `Add ${kind.singular}` }} />
        {kind.fields.map((f) => {
          const v = values[f.key] ?? '';
          const error = form.errors[f.key];
          if (f.type === 'select')
            return (
              <React.Fragment key={f.key}>
                <Txt variant="label" tone={error ? 'danger' : 'muted'}>
                  {f.label}
                </Txt>
                <ChipSelect allowNone options={(f.options ?? []).map((o) => ({ label: o, value: o }))} value={values[f.key] ?? null} onChange={(x) => set(f.key, x)} />
                <FieldError message={error} />
              </React.Fragment>
            );
          if (f.type === 'date')
            return (
              <DateTimeField
                key={f.key}
                label={f.label}
                mode="date"
                value={v ? parseDateKey(v) : null}
                onChange={(d) => set(f.key, dateKey(d))}
                maximumDate={f.notFuture ? new Date() : undefined}
                placeholder="Not set"
                onClear={() => set(f.key, null)}
                error={error}
              />
            );
          if (f.type === 'datetime')
            return (
              <DateTimeField
                key={f.key}
                label={f.label}
                mode="datetime"
                value={v ? new Date(v) : null}
                onChange={(d) => set(f.key, d.toISOString())}
                placeholder="Not set"
                onClear={() => set(f.key, null)}
                error={error}
              />
            );
          return (
            <Field
              key={f.key}
              label={f.required ? f.label : `${f.label} (optional)`}
              value={v}
              onChangeText={(x) => set(f.key, x)}
              multiline={f.type === 'multiline'}
              placeholder={f.placeholder}
              keyboardType={f.keyboard}
              autoCapitalize={f.keyboard === 'email-address' ? 'none' : undefined}
              maxLength={f.max ?? (f.type === 'multiline' ? LIMITS.note : LIMITS.title)}
              error={error}
            />
          );
        })}
        <FormErrorSummary count={form.count} />
        {params.id && existing.data ? (
          <Button
            label="Delete"
            variant="danger"
            icon="trash-outline"
            onPress={() =>
              confirmDelete(`this ${kind.singular}`, async () => {
                await kind.repo.remove(params.id!);
                router.back();
              })
            }
          />
        ) : null}
      </Screen>
    </LockGate>
  );
}
