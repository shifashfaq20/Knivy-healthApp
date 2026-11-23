import { useState } from 'react';
import { Pressable, type GestureResponderEvent, type PressableProps, type StyleProp, type ViewStyle } from 'react-native';

type StyleInput = StyleProp<ViewStyle> | ((state: { pressed: boolean }) => StyleProp<ViewStyle>);

export type TouchableProps = Omit<PressableProps, 'style'> & { style?: StyleInput };

/**
 * Pressable that tracks its own pressed state and always hands Pressable a plain style.
 * NativeWind's JSX transform can drop Pressable's function-style prop, which left
 * buttons without a background (ivory text on an ivory screen).
 */
export function Touchable({ style, onPressIn, onPressOut, ...rest }: TouchableProps) {
  const [pressed, setPressed] = useState(false);
  const resolved = typeof style === 'function' ? style({ pressed }) : style;
  return (
    <Pressable
      {...rest}
      onPressIn={(e: GestureResponderEvent) => {
        setPressed(true);
        onPressIn?.(e);
      }}
      onPressOut={(e: GestureResponderEvent) => {
        setPressed(false);
        onPressOut?.(e);
      }}
      style={resolved}
    />
  );
}
