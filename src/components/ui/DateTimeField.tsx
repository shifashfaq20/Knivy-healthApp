import DateTimePicker, { type DateTimePickerEvent } from '@react-native-community/datetimepicker';
import { createElement, useState } from 'react';
import { Modal, Platform, Pressable, View } from 'react-native';
import { colors, radii } from '../../theme/tokens';
import { formatDate, formatDateTime, formatTime } from '../../utils/date';
import { Button } from './Button';
import { FieldError } from './Field';
import { Icon } from './Icon';
import { Txt } from './Txt';

interface Props {
  label?: string;
  value: Date | null;
  onChange: (d: Date) => void;
  mode?: 'date' | 'time' | 'datetime';
  placeholder?: string;
  maximumDate?: Date;
  minimumDate?: Date;
  onClear?: () => void;
  error?: string | null;
}

export function DateTimeField({ label, value, onChange, mode = 'datetime', placeholder = 'Choose', maximumDate, minimumDate, onClear, error }: Props) {
  const [androidStep, setAndroidStep] = useState<'date' | 'time' | null>(null);
  const [iosOpen, setIosOpen] = useState(false);
  const [iosTemp, setIosTemp] = useState<Date>(value ?? new Date());

  const text = value ? (mode === 'date' ? formatDate(value, true) : mode === 'time' ? formatTime(value) : formatDateTime(value)) : placeholder;

  const open = () => {
    if (Platform.OS === 'ios') {
      setIosTemp(value ?? new Date());
      setIosOpen(true);
    } else {
      setAndroidStep(mode === 'time' ? 'time' : 'date');
    }
  };

  const onAndroidChange = (e: DateTimePickerEvent, d?: Date) => {
    const step = androidStep;
    setAndroidStep(null);
    if (e.type !== 'set' || !d) return;
    if (mode === 'datetime' && step === 'date') {
      const base = value ?? new Date();
      const merged = new Date(d);
      merged.setHours(base.getHours(), base.getMinutes(), 0, 0);
      onChange(merged);
      setTimeout(() => setAndroidStep('time'), 50);
      return;
    }
    if (mode === 'datetime' && step === 'time') {
      const base = value ?? new Date();
      const merged = new Date(base);
      merged.setHours(d.getHours(), d.getMinutes(), 0, 0);
      onChange(merged);
      return;
    }
    onChange(d);
  };

  return (
    <View style={{ gap: 6 }}>
      {label ? (
        <Txt variant="label" tone="muted">
          {label}
        </Txt>
      ) : null}
      {Platform.OS === 'web' ? (
        <WebDateInput
          value={value}
          onChange={onChange}
          mode={mode}
          minimumDate={minimumDate}
          maximumDate={maximumDate}
          label={label}
          error={error}
        />
      ) : (
      <Pressable
        onPress={open}
        accessibilityRole="button"
        accessibilityLabel={`${label ?? 'Date'}: ${text}`}
        style={{
          minHeight: 50,
          borderRadius: radii.control,
          backgroundColor: colors.linen,
          borderWidth: 1,
          borderColor: error ? colors.danger : colors.sand,
          paddingHorizontal: 14,
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
        }}
      >
        <Txt tone={value ? 'ink' : 'faint'}>{text}</Txt>
        <View style={{ flexDirection: 'row', gap: 12, alignItems: 'center' }}>
          {value && onClear ? (
            <Pressable onPress={onClear} hitSlop={10} accessibilityLabel="Clear">
              <Icon name="close-circle" size={18} color={colors.taupe} />
            </Pressable>
          ) : null}
          <Icon name={mode === 'time' ? 'time-outline' : 'calendar-outline'} size={18} color={colors.muted} />
        </View>
      </Pressable>
      )}
      <FieldError message={error} />

      {Platform.OS === 'android' && androidStep ? (
        <DateTimePicker
          value={value ?? new Date()}
          mode={androidStep}
          display="default"
          onChange={onAndroidChange}
          maximumDate={androidStep === 'date' ? maximumDate : undefined}
          minimumDate={androidStep === 'date' ? minimumDate : undefined}
        />
      ) : null}

      {Platform.OS === 'ios' ? (
        <Modal visible={iosOpen} transparent animationType="slide" onRequestClose={() => setIosOpen(false)}>
          <Pressable style={{ flex: 1, backgroundColor: 'rgba(43,39,34,0.25)' }} onPress={() => setIosOpen(false)} />
          <View style={{ backgroundColor: colors.paper, borderTopLeftRadius: 28, borderTopRightRadius: 28, padding: 20, paddingBottom: 36, gap: 8 }}>
            <DateTimePicker
              value={iosTemp}
              mode={mode}
              display="spinner"
              onChange={(_, d) => d && setIosTemp(d)}
              maximumDate={maximumDate}
              minimumDate={minimumDate}
              textColor={colors.ink}
            />
            <Button
              label="Done"
              full
              onPress={() => {
                onChange(iosTemp);
                setIosOpen(false);
              }}
            />
          </View>
        </Modal>
      ) : null}
    </View>
  );
}

// ---------------------------------------------------------------------------
// Web only (e.g. the Snack web preview): the native pickers above don't exist in a
// browser, so use the browser's own date/time input instead.
// ---------------------------------------------------------------------------

type Mode = NonNullable<Props['mode']>;
const pad = (n: number) => String(n).padStart(2, '0');

function toInputValue(d: Date, mode: Mode) {
  const date = `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  const time = `${pad(d.getHours())}:${pad(d.getMinutes())}`;
  return mode === 'date' ? date : mode === 'time' ? time : `${date}T${time}`;
}

function fromInputValue(s: string, mode: Mode, base: Date): Date | null {
  if (!s) return null;
  const d = new Date(base);
  const [datePart, timePart] = mode === 'time' ? [null, s] : s.split('T');
  if (datePart) {
    const [y, m, day] = datePart.split('-').map(Number);
    d.setFullYear(y, m - 1, day);
  }
  if (timePart) {
    const [h, min] = timePart.split(':').map(Number);
    d.setHours(h, min, 0, 0);
  }
  return Number.isNaN(d.getTime()) ? null : d;
}

function WebDateInput({
  value,
  onChange,
  mode,
  minimumDate,
  maximumDate,
  label,
  error,
}: Pick<Props, 'value' | 'onChange' | 'minimumDate' | 'maximumDate' | 'label' | 'error'> & { mode: Mode }) {
  const type = mode === 'date' ? 'date' : mode === 'time' ? 'time' : 'datetime-local';
  return (
    <View
      style={{
        minHeight: 50,
        borderRadius: radii.control,
        backgroundColor: colors.linen,
        borderWidth: 1,
        borderColor: error ? colors.danger : colors.sand,
        paddingHorizontal: 14,
        justifyContent: 'center',
      }}
    >
      {createElement('input', {
        type,
        'aria-label': label ?? 'Date',
        value: value ? toInputValue(value, mode) : '',
        min: minimumDate && mode !== 'time' ? toInputValue(minimumDate, mode) : undefined,
        max: maximumDate && mode !== 'time' ? toInputValue(maximumDate, mode) : undefined,
        onChange: (e: { target: { value: string } }) => {
          const next = fromInputValue(e.target.value, mode, value ?? new Date());
          if (next) onChange(next);
        },
        style: {
          border: 'none',
          outline: 'none',
          background: 'transparent',
          fontSize: 16,
          color: colors.ink,
          fontFamily: 'inherit',
          width: '100%',
          minHeight: 46,
        },
      })}
    </View>
  );
}
