import type { ReactNode } from 'react';
import { View } from 'react-native';
import { Txt } from './Txt';

/** Large serif page title for tab screens (they have no native header). */
export function PageHeader({ title, subtitle, right }: { title: string; subtitle?: string; right?: ReactNode }) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between', gap: 12, marginBottom: 4 }}>
      <View style={{ flex: 1, gap: 4 }}>
        {subtitle ? (
          <Txt variant="label" tone="muted">
            {subtitle}
          </Txt>
        ) : null}
        <Txt variant="display" accessibilityRole="header">
          {title}
        </Txt>
      </View>
      {right}
    </View>
  );
}
