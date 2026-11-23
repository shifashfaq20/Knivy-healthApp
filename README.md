# Knivy

A free health and wellness app for iOS and Android, built with Expo SDK 58 (React Native 0.88), TypeScript, NativeWind, Expo Router, Zustand, TanStack Query and SQLite.

Phase 1 has **no backend**. Everything is stored on the phone, works offline, and every record is marked so it can sync once accounts exist. Features that genuinely need a server (AI assistant, AI meal-photo recognition, accounts, cloud sync) show an honest "unavailable" state; they never show invented results.

## Run it

Requirements: Node.js 20 or 22 (nodejs.org), and **Expo Go 58** on your phone.

**Easiest:** double-click `start.command`. The first run installs packages and matches them to SDK 58; after that it just starts the app. If macOS says it can't verify the file, run it from Terminal instead:

```bash
bash ~/Downloads/KnivyApp/start.command
```

**Manually:**

```bash
cd KnivyApp
npm install
npx expo install --fix
npx expo start --clear
```

Scan the QR code with the iPhone Camera app (or Expo Go on Android). Phone and Mac must be on the same Wi-Fi; if not, add `--tunnel`. Don't use `npx expo run:ios` unless you want a development build, which needs Xcode and CocoaPods.

### Optional configuration

Copy `.env.example` to `.env`:

| Variable | Purpose |
| --- | --- |
| `EXPO_PUBLIC_FDC_API_KEY` | Adds USDA FoodData Central to food search (free key from fdc.nal.usda.gov). Open Food Facts works without a key. |
| `EXPO_PUBLIC_API_BASE_URL` | Phase 2 backend URL. Leave empty in phase 1. |
| `EXPO_PUBLIC_OFF_CONTACT` | Contact string sent to Open Food Facts in the User-Agent, as their API policy asks. |

`EXPO_PUBLIC_*` values are bundled into the app. Never put AI-provider keys or other secrets there; AI calls are designed to go through the backend.

## What works in Expo Go

| Works in Expo Go | Needs a development build |
| --- | --- |
| Local database, offline storage, all logging screens | Apple HealthKit import |
| iPhone step history (about 7 days) via Core Motion | Android Health Connect import |
| Android live step counting while the app is open | GPS recording with the screen off (background location) |
| GPS recording in the foreground | Encrypted SQLite (SQLCipher) |
| Barcode scanning, camera, photo library, documents | Remote push notifications |
| Local reminders (medication, water, habits, sleep, mood) | |
| Face ID / fingerprint lock for journal and records | |

See `docs/NATIVE_HEALTH_SETUP.md` for the development-build steps.

## Project layout

```
app/                 Expo Router screens (typed routes)
  (tabs)/            Home, Activity, Nutrition, Insights, Profile
  activity/ health/ workouts/ nutrition/ sleep/ cycle/ mind/ habits/ records/
  assistant.tsx hydration.tsx settings.tsx devices.tsx notifications.tsx dashboard.tsx onboarding.tsx
src/
  components/ui      Design-system components (Txt, Card, Button, Field, chips, states…)
  components/charts  SVG bar/line charts that show gaps instead of filling them
  components/home    Dashboard widgets
  db/                SQLite connection, migrations, generic repository, change events
  repositories/      One typed repository per collection
  services/          Notifications, nutrition APIs, AI client, sync engine, export
  integrations/      Health providers (motion sensor, Apple Health, Health Connect)
  stores/            Zustand stores (profile, workout session, drafts, lock)
  features/          Domain data and logic (exercise library, record schemas…)
  hooks/ utils/ types/ theme/
docs/                Architecture, data model, API contract, native setup, status
```

## Testing

- `npm run typecheck` runs the TypeScript compiler over the whole project.
- Manual test plan: `docs/IMPLEMENTATION_STATUS.md` lists every feature with how to exercise it.
- Logic worth unit-testing first (pure functions, no React): `src/utils/cycle.ts`, `src/utils/streaks.ts`, `src/utils/nutrition.ts`, `src/utils/units.ts`, `src/features/workouts/records.ts`, `src/features/insights/buckets.ts`. Add `jest-expo` with `npx expo install jest-expo jest @types/jest` when you're ready.

## Validation

Every form checks what you entered when you tap Save or Continue. Problems appear in red under the exact field, with a message that says how to fix it, in your chosen units ("Enter between 44.1 and 881.8 lb"). Long forms also show a summary banner, and the phone gives a short error vibration. Editing a field clears its error.

The rules live in `src/utils/validation.ts` (`check.*`, `validate`, `useFormErrors`, `LIMITS`, `dobError`, `futureError`, `gtinError`). Goal ranges are in `src/features/goals.ts`; reading ranges in `src/features/health/definitions.ts`. The beginner's guide (PDF) lists every rule screen by screen.

## App icon

`assets/icon.png`, `assets/adaptive-icon.png` (Android) and `assets/splash-icon.png`, wired up in `app.json`. Expo Go shows its own icon; Knivy's appears in development and store builds.

## Product principles in code

- Every record carries `source` (`device`, `manual`, `imported`, `estimated`) and is shown with a source badge.
- Missing nutrients stay `null` and display as "not available"; totals say when they're incomplete.
- Energy from activities is labelled as an estimate unless the user entered it.
- Charts break lines and show dashed marks for days without data.
- Cycle predictions need at least one complete logged cycle, carry a confidence level, and state they can't confirm ovulation or act as contraception.
- Medication details are only ever what the user enters.
