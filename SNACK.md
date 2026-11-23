# Knivy: Snack copy

This folder is the full Knivy app (every screen in `app/`, all of `src/`), adjusted so it can run on snack.expo.dev.
The app code itself is unchanged apart from the points below.

## What's different from the main project

| Change | Why |
| --- | --- |
| `App.tsx` added (hands the `app/` folder to Expo Router) | Snack starts from an App file. |
| `@/…` imports rewritten as relative paths (`../../src/…`) | Snack doesn't read `tsconfig.json` path aliases. |
| NativeWind removed (`global.css`, `tailwind.config.js`, `babel.config.js`, `metro.config.js`, `nativewind-env.d.ts`, and the unused `className` prop on `Txt`) | Snack can't run custom Babel/Metro config. No screen used Tailwind classes; all styling is `style` + `src/theme/tokens.ts`, so screens look the same. |
| `package.json` targets Expo SDK 56 instead of 58 | Snack doesn't offer SDK 58 yet. Unused packages (`nativewind`, `tailwindcss`, `react-native-reanimated`, `react-native-worklets`, `expo-secure-store`, `expo-system-ui`) removed. |
| `src/db/memoryDb.ts` added; `src/db/database.ts` uses it only when `Platform.OS === 'web'` | SQLite doesn't run in a browser. In Snack's **Web** preview, data is kept in the browser's local storage instead. On a phone (Expo Go) the real SQLite database is used, exactly as before. |
| `configureNotifications()` skips setup on web | Reminders are phone-only. |
| `src/utils/webAlert.ts` added (imported in `app/_layout.tsx`) | In a browser, React Native's `Alert.alert` does nothing, so delete/discard confirmations would never appear. On web they now use the browser's confirm/alert dialogs. Phones are unaffected. |
| `DateTimeField` uses the browser's date/time input on web | The native date pickers don't exist in a browser, so date fields couldn't be changed. Phones are unaffected. |
| Removed: `.expo/`, `node_modules/`, lock files, `start.command`, `.npmrc`, `.env.example` | Not used by Snack. `EXPO_PUBLIC_*` keys are optional; without them food search uses Open Food Facts and the AI features show "unavailable", as designed. |

## What to expect in Snack

- **Web preview:** screens, navigation, forms, validation and charts should all run. Phone-only features (step counter, camera/barcode, GPS tracking, Face ID lock, reminders, share sheet) show their "not available" or permission states.
- **My Device (Expo Go):** the closest to the real app, but only if your Expo Go supports the SDK version selected in Snack.
- Snack doesn't type-check. `npm run typecheck` on the main project reports 8 existing type errors (in `app/(tabs)/_layout.tsx`, `app/assistant.tsx`, `src/utils/validation.ts`). They don't stop the app running.

Keep developing in the main project. Redo this conversion when you want to update the Snack.
