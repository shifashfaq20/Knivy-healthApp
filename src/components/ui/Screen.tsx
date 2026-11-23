import type { ReactNode } from 'react';
import { KeyboardAvoidingView, Platform, RefreshControl, ScrollView, View, type ViewStyle } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors } from '../../theme/tokens';

interface ScreenProps {
  children: ReactNode;
  /** Tab screens have no native header, so they need the top safe-area inset. */
  tab?: boolean;
  scroll?: boolean;
  keyboard?: boolean;
  refreshing?: boolean;
  onRefresh?: () => void;
  footer?: ReactNode;
  contentStyle?: ViewStyle;
}

export function Screen({ children, tab, scroll = true, keyboard, refreshing, onRefresh, footer, contentStyle }: ScreenProps) {
  const insets = useSafeAreaInsets();
  const padding: ViewStyle = {
    paddingHorizontal: 20,
    paddingTop: tab ? insets.top + 12 : 16,
    paddingBottom: footer ? 16 : tab ? 32 : insets.bottom + 32,
    gap: 16,
  };
  const body = scroll ? (
    <ScrollView
      style={{ flex: 1 }}
      contentContainerStyle={[padding, contentStyle]}
      keyboardShouldPersistTaps="handled"
      refreshControl={onRefresh ? <RefreshControl refreshing={!!refreshing} onRefresh={onRefresh} tintColor={colors.taupe} /> : undefined}
    >
      {children}
    </ScrollView>
  ) : (
    <View style={[{ flex: 1 }, padding, contentStyle]}>{children}</View>
  );
  const content = (
    <View style={{ flex: 1, backgroundColor: colors.ivory }}>
      {body}
      {footer ? (
        <View
          style={{
            paddingHorizontal: 20,
            paddingTop: 12,
            paddingBottom: insets.bottom + 12,
            backgroundColor: colors.ivory,
            borderTopWidth: 1,
            borderTopColor: colors.sand,
          }}
        >
          {footer}
        </View>
      ) : null}
    </View>
  );
  if (!keyboard) return content;
  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined} keyboardVerticalOffset={Platform.OS === 'ios' ? 96 : 0}>
      {content}
    </KeyboardAvoidingView>
  );
}
