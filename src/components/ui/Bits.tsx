import { Touchable } from './Touchable';
import type { ReactNode } from 'react';
import { Switch, View } from 'react-native';
import Svg, { Circle } from 'react-native-svg';
import { colors } from '../../theme/tokens';
import type { Source } from '../../types/models';
import { Icon, type IconName } from './Icon';
import { Txt } from './Txt';

const SOURCE_META: Record<Source, { label: string; icon: IconName }> = {
  device: { label: 'Device', icon: 'phone-portrait-outline' },
  manual: { label: 'Entered', icon: 'create-outline' },
  imported: { label: 'Imported', icon: 'download-outline' },
  estimated: { label: 'Estimate', icon: 'help-circle-outline' },
};

/** Shows where a value came from. Always visible next to health data. */
export function SourceBadge({ source, name }: { source: Source; name?: string | null }) {
  const meta = SOURCE_META[source];
  return (
    <View
      accessibilityLabel={`Source: ${meta.label}${name ? `, ${name}` : ''}`}
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
        alignSelf: 'flex-start',
        paddingHorizontal: 8,
        height: 22,
        borderRadius: 11,
        backgroundColor: source === 'estimated' ? colors.paper : colors.linen,
        borderWidth: source === 'estimated' ? 1 : 0,
        borderStyle: source === 'estimated' ? 'dashed' : 'solid',
        borderColor: colors.taupe,
      }}
    >
      <Icon name={meta.icon} size={12} color={colors.muted} />
      <Txt variant="caption" tone="muted">
        {name ? `${meta.label} (${name})` : meta.label}
      </Txt>
    </View>
  );
}

export function ProgressBar({ value, max, color = colors.moss, height = 8 }: { value: number; max: number | null; color?: string; height?: number }) {
  const pct = max && max > 0 ? Math.min(1, value / max) : 0;
  return (
    <View style={{ height, borderRadius: height / 2, backgroundColor: colors.sand, overflow: 'hidden' }}>
      <View style={{ width: `${pct * 100}%`, height, borderRadius: height / 2, backgroundColor: color }} />
    </View>
  );
}

export function Ring({ value, max, size = 64, stroke = 7, color = colors.moss, children }: { value: number; max: number | null; size?: number; stroke?: number; color?: string; children?: ReactNode }) {
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const pct = max && max > 0 ? Math.min(1, value / max) : 0;
  return (
    <View style={{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }}>
      <Svg width={size} height={size} style={{ position: 'absolute' }}>
        <Circle cx={size / 2} cy={size / 2} r={r} stroke={colors.sand} strokeWidth={stroke} fill="none" />
        {pct > 0 ? (
          <Circle
            cx={size / 2}
            cy={size / 2}
            r={r}
            stroke={color}
            strokeWidth={stroke}
            fill="none"
            strokeDasharray={`${c} ${c}`}
            strokeDashoffset={c * (1 - pct)}
            strokeLinecap="round"
            transform={`rotate(-90 ${size / 2} ${size / 2})`}
          />
        ) : null}
      </Svg>
      {children}
    </View>
  );
}

export function SectionHeader({ title, actionLabel, onAction }: { title: string; actionLabel?: string; onAction?: () => void }) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 8 }}>
      <Txt variant="subtitle">{title}</Txt>
      {actionLabel && onAction ? (
        <Touchable onPress={onAction} hitSlop={10} accessibilityRole="button">
          <Txt variant="label" tone="moss">
            {actionLabel}
          </Txt>
        </Touchable>
      ) : null}
    </View>
  );
}

export function ListRow({
  title,
  subtitle,
  right,
  icon,
  onPress,
  chevron = !!onPress,
  children,
}: {
  title: string;
  subtitle?: string | null;
  right?: ReactNode;
  icon?: IconName;
  onPress?: () => void;
  chevron?: boolean;
  children?: ReactNode;
}) {
  const body = (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 12 }}>
      {icon ? (
        <View style={{ width: 36, height: 36, borderRadius: 18, backgroundColor: colors.linen, alignItems: 'center', justifyContent: 'center' }}>
          <Icon name={icon} size={18} color={colors.ink} />
        </View>
      ) : null}
      <View style={{ flex: 1, gap: 2 }}>
        <Txt variant="bodyMedium" numberOfLines={2}>
          {title}
        </Txt>
        {subtitle ? (
          <Txt variant="caption" tone="muted" numberOfLines={3}>
            {subtitle}
          </Txt>
        ) : null}
        {children}
      </View>
      {typeof right === 'string' ? (
        <Txt variant="label" tone="muted">
          {right}
        </Txt>
      ) : (
        right
      )}
      {chevron ? <Icon name="chevron-forward" size={16} color={colors.taupe} /> : null}
    </View>
  );
  if (!onPress) return body;
  return (
    <Touchable onPress={onPress} accessibilityRole="button" style={({ pressed }) => ({ opacity: pressed ? 0.6 : 1 })}>
      {body}
    </Touchable>
  );
}

export function Divider() {
  return <View style={{ height: 1, backgroundColor: colors.sand }} />;
}

export function ToggleRow({ label, description, value, onChange }: { label: string; description?: string; value: boolean; onChange: (v: boolean) => void }) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 10 }}>
      <View style={{ flex: 1, gap: 2 }}>
        <Txt variant="bodyMedium">{label}</Txt>
        {description ? (
          <Txt variant="caption" tone="muted">
            {description}
          </Txt>
        ) : null}
      </View>
      <Switch
        value={value}
        onValueChange={onChange}
        trackColor={{ false: colors.stone, true: colors.moss }}
        thumbColor={colors.paper}
        ios_backgroundColor={colors.stone}
        accessibilityLabel={label}
      />
    </View>
  );
}

/** A compact metric: big serif number with a small label underneath. */
export function Metric({ value, unit, label, tone = 'ink' }: { value: string; unit?: string; label: string; tone?: 'ink' | 'muted' }) {
  return (
    <View style={{ gap: 2 }}>
      <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: 4 }}>
        <Txt variant="number" tone={tone}>
          {value}
        </Txt>
        {unit ? (
          <Txt variant="caption" tone="muted">
            {unit}
          </Txt>
        ) : null}
      </View>
      <Txt variant="caption" tone="muted">
        {label}
      </Txt>
    </View>
  );
}

export function Stepper({ value, onChange, min = 0, max = 99, step = 1, label }: { value: number; onChange: (v: number) => void; min?: number; max?: number; step?: number; label: string }) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }} accessibilityLabel={`${label}: ${value}`}>
      <Touchable
        onPress={() => onChange(Math.max(min, value - step))}
        accessibilityLabel={`Decrease ${label}`}
        style={{ width: 34, height: 34, borderRadius: 17, backgroundColor: colors.sand, alignItems: 'center', justifyContent: 'center' }}
      >
        <Icon name="remove" size={16} />
      </Touchable>
      <Txt variant="heading" style={{ minWidth: 28, textAlign: 'center' }}>
        {value}
      </Txt>
      <Touchable
        onPress={() => onChange(Math.min(max, value + step))}
        accessibilityLabel={`Increase ${label}`}
        style={{ width: 34, height: 34, borderRadius: 17, backgroundColor: colors.sand, alignItems: 'center', justifyContent: 'center' }}
      >
        <Icon name="add" size={16} />
      </Touchable>
    </View>
  );
}
