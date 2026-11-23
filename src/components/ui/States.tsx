import { ActivityIndicator, View } from 'react-native';
import { colors } from '../../theme/tokens';
import { Button } from './Button';
import { Card } from './Card';
import { Icon, type IconName } from './Icon';
import { Txt } from './Txt';

export function EmptyState({
  icon,
  title,
  body,
  actionLabel,
  onAction,
  secondaryLabel,
  onSecondary,
  compact,
}: {
  icon: IconName;
  title: string;
  body?: string;
  actionLabel?: string;
  onAction?: () => void;
  secondaryLabel?: string;
  onSecondary?: () => void;
  compact?: boolean;
}) {
  return (
    <View style={{ alignItems: 'flex-start', gap: 10, paddingVertical: compact ? 4 : 12 }}>
      <View style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: colors.linen, alignItems: 'center', justifyContent: 'center' }}>
        <Icon name={icon} size={20} color={colors.muted} />
      </View>
      <Txt variant="heading">{title}</Txt>
      {body ? <Txt tone="muted">{body}</Txt> : null}
      {actionLabel || secondaryLabel ? (
        <View style={{ flexDirection: 'row', gap: 10, flexWrap: 'wrap', marginTop: 4 }}>
          {actionLabel && onAction ? <Button label={actionLabel} onPress={onAction} size="sm" /> : null}
          {secondaryLabel && onSecondary ? <Button label={secondaryLabel} onPress={onSecondary} size="sm" variant="secondary" /> : null}
        </View>
      ) : null}
    </View>
  );
}

export function LoadingState({ label = 'Loading' }: { label?: string }) {
  return (
    <View style={{ paddingVertical: 24, alignItems: 'center', gap: 8 }} accessibilityLabel={label}>
      <ActivityIndicator color={colors.taupe} />
    </View>
  );
}

export function ErrorState({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <Card tone="outline">
      <View style={{ gap: 10 }}>
        <View style={{ flexDirection: 'row', gap: 8, alignItems: 'center' }}>
          <Icon name="alert-circle-outline" color={colors.danger} />
          <Txt variant="heading">That didn’t load</Txt>
        </View>
        <Txt tone="muted">{message}</Txt>
        {onRetry ? <Button label="Try again" size="sm" variant="secondary" onPress={onRetry} /> : null}
      </View>
    </Card>
  );
}

export function Banner({ tone = 'info', title, body, icon }: { tone?: 'info' | 'warn' | 'calm'; title?: string; body: string; icon?: IconName }) {
  const bg = tone === 'warn' ? colors.dangerSoft : tone === 'calm' ? colors.mossSoft : colors.linen;
  const fg = tone === 'warn' ? colors.danger : tone === 'calm' ? colors.moss : colors.muted;
  return (
    <View style={{ backgroundColor: bg, borderRadius: 16, padding: 14, flexDirection: 'row', gap: 10 }}>
      <Icon name={icon ?? (tone === 'warn' ? 'alert-circle-outline' : 'information-circle-outline')} size={18} color={fg} />
      <View style={{ flex: 1, gap: 2 }}>
        {title ? <Txt variant="label">{title}</Txt> : null}
        <Txt variant="caption" tone="muted">
          {body}
        </Txt>
      </View>
    </View>
  );
}

/** Shown when a form has errors, so they're noticed even when the field is scrolled away. */
export function FormErrorSummary({ count, message }: { count: number; message?: string }) {
  if (count === 0 && !message) return null;
  return (
    <Banner
      tone="warn"
      body={message ?? (count === 1 ? 'Check the highlighted field.' : `Check the ${count} highlighted fields.`)}
    />
  );
}
