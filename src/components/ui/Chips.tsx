import { Touchable } from './Touchable';
import { ScrollView, View } from 'react-native';
import { colors } from '../../theme/tokens';
import { Txt } from './Txt';

export interface ChipOption<T> {
  label: string;
  value: T;
}

function Chip({ label, selected, onPress }: { label: string; selected: boolean; onPress: () => void }) {
  return (
    <Touchable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityState={{ selected }}
      style={({ pressed }) => ({
        paddingHorizontal: 14,
        height: 36,
        borderRadius: 999,
        justifyContent: 'center',
        backgroundColor: selected ? colors.ink : colors.paper,
        borderWidth: 1,
        borderColor: selected ? colors.ink : colors.stone,
        opacity: pressed ? 0.8 : 1,
      })}
    >
      <Txt variant="label" tone={selected ? 'inverse' : 'ink'}>
        {label}
      </Txt>
    </Touchable>
  );
}

export function ChipSelect<T extends string | number>({
  options,
  value,
  onChange,
  allowNone,
  scroll,
}: {
  options: ChipOption<T>[];
  value: T | null | undefined;
  onChange: (v: T | null) => void;
  allowNone?: boolean;
  scroll?: boolean;
}) {
  const chips = options.map((o) => (
    <Chip
      key={String(o.value)}
      label={o.label}
      selected={o.value === value}
      onPress={() => onChange(o.value === value && allowNone ? null : o.value)}
    />
  ));
  if (scroll) {
    return (
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
        {chips}
      </ScrollView>
    );
  }
  return <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>{chips}</View>;
}

export function ChipMulti<T extends string | number>({
  options,
  values,
  onChange,
}: {
  options: ChipOption<T>[];
  values: T[];
  onChange: (v: T[]) => void;
}) {
  return (
    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
      {options.map((o) => {
        const selected = values.includes(o.value);
        return (
          <Chip
            key={String(o.value)}
            label={o.label}
            selected={selected}
            onPress={() => onChange(selected ? values.filter((v) => v !== o.value) : [...values, o.value])}
          />
        );
      })}
    </View>
  );
}

export function Segmented<T extends string>({ options, value, onChange }: { options: ChipOption<T>[]; value: T; onChange: (v: T) => void }) {
  return (
    <View style={{ flexDirection: 'row', backgroundColor: colors.sand, borderRadius: 999, padding: 4 }}>
      {options.map((o) => {
        const selected = o.value === value;
        return (
          <Touchable
            key={o.value}
            onPress={() => onChange(o.value)}
            accessibilityRole="tab"
            accessibilityState={{ selected }}
            style={{
              flex: 1,
              height: 34,
              borderRadius: 999,
              alignItems: 'center',
              justifyContent: 'center',
              backgroundColor: selected ? colors.paper : 'transparent',
            }}
          >
            <Txt variant="label" tone={selected ? 'ink' : 'muted'}>
              {o.label}
            </Txt>
          </Touchable>
        );
      })}
    </View>
  );
}

export function WeekdayPicker({ value, onChange }: { value: number[]; onChange: (v: number[]) => void }) {
  const letters = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];
  const names = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  return (
    <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
      {letters.map((l, i) => {
        const on = value.includes(i);
        return (
          <Touchable
            key={i}
            accessibilityRole="checkbox"
            accessibilityLabel={names[i]}
            accessibilityState={{ checked: on }}
            onPress={() => onChange(on ? value.filter((d) => d !== i) : [...value, i].sort())}
            style={{
              width: 40,
              height: 40,
              borderRadius: 20,
              alignItems: 'center',
              justifyContent: 'center',
              backgroundColor: on ? colors.ink : colors.paper,
              borderWidth: 1,
              borderColor: on ? colors.ink : colors.stone,
            }}
          >
            <Txt variant="label" tone={on ? 'inverse' : 'ink'}>
              {l}
            </Txt>
          </Touchable>
        );
      })}
    </View>
  );
}
