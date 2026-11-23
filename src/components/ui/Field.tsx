import { TextInput, View, type KeyboardTypeOptions } from 'react-native';
import { colors, fonts, radii } from '../../theme/tokens';
import { Icon } from './Icon';
import { Txt } from './Txt';

/** Inline error under any input (text fields, chips, date pickers). Announced by screen readers. */
export function FieldError({ message }: { message?: string | null }) {
  if (!message) return null;
  return (
    <View style={{ flexDirection: 'row', gap: 6, alignItems: 'flex-start' }} accessibilityLiveRegion="polite" accessibilityRole="alert">
      <View style={{ marginTop: 1 }}>
        <Icon name="alert-circle" size={14} color={colors.danger} />
      </View>
      <Txt variant="caption" tone="danger" style={{ flex: 1 }}>
        {message}
      </Txt>
    </View>
  );
}

interface FieldProps {
  label?: string;
  value: string;
  onChangeText: (v: string) => void;
  placeholder?: string;
  suffix?: string;
  hint?: string;
  error?: string | null;
  keyboardType?: KeyboardTypeOptions;
  multiline?: boolean;
  autoFocus?: boolean;
  maxLength?: number;
  /** Shows "12/40" under the field when maxLength is set. */
  showCount?: boolean;
  autoCapitalize?: 'none' | 'sentences' | 'words';
  onSubmitEditing?: () => void;
  onBlur?: () => void;
  returnKeyType?: 'done' | 'search' | 'next';
}

export function Field({
  label,
  value,
  onChangeText,
  placeholder,
  suffix,
  hint,
  error,
  keyboardType,
  multiline,
  autoFocus,
  maxLength,
  showCount,
  autoCapitalize,
  onSubmitEditing,
  onBlur,
  returnKeyType,
}: FieldProps) {
  const counter = maxLength && showCount ? `${value.length}/${maxLength}` : null;
  return (
    <View style={{ gap: 6 }}>
      {label ? (
        <Txt variant="label" tone={error ? 'danger' : 'muted'}>
          {label}
        </Txt>
      ) : null}
      <View
        style={{
          flexDirection: 'row',
          alignItems: multiline ? 'flex-start' : 'center',
          backgroundColor: colors.linen,
          borderRadius: radii.control,
          borderWidth: error ? 1.5 : 1,
          borderColor: error ? colors.danger : colors.sand,
          paddingHorizontal: 14,
          minHeight: multiline ? 110 : 50,
        }}
      >
        <TextInput
          value={value}
          onChangeText={onChangeText}
          placeholder={placeholder}
          placeholderTextColor={colors.taupe}
          keyboardType={keyboardType}
          multiline={multiline}
          autoFocus={autoFocus}
          maxLength={maxLength}
          autoCapitalize={autoCapitalize}
          onSubmitEditing={onSubmitEditing}
          onBlur={onBlur}
          returnKeyType={returnKeyType}
          accessibilityLabel={label ?? placeholder}
          accessibilityHint={error ?? hint}
          style={{
            flex: 1,
            fontFamily: fonts.body,
            fontSize: 16,
            color: colors.ink,
            paddingVertical: multiline ? 12 : 0,
            minHeight: multiline ? 100 : 48,
            textAlignVertical: multiline ? 'top' : 'center',
          }}
        />
        {suffix ? (
          <Txt variant="label" tone="muted" style={{ marginLeft: 8 }}>
            {suffix}
          </Txt>
        ) : null}
      </View>
      {error ? (
        <FieldError message={error} />
      ) : hint || counter ? (
        <View style={{ flexDirection: 'row', gap: 8 }}>
          <Txt variant="caption" tone="muted" style={{ flex: 1 }}>
            {hint ?? ''}
          </Txt>
          {counter ? (
            <Txt variant="caption" tone={value.length >= (maxLength ?? 0) ? 'danger' : 'faint'}>
              {counter}
            </Txt>
          ) : null}
        </View>
      ) : null}
    </View>
  );
}
