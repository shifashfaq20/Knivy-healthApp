# Apple Health and Health Connect (development build)

Expo Go doesn't include the native modules for HealthKit or Health Connect, so Knivy shows them as unavailable there. To add them you need a development build.

## 1. Create a development build

```bash
npx expo install expo-dev-client
npx eas build --profile development --platform ios      # or android
# or locally: npx expo run:ios / npx expo run:android
```

## 2. Apple HealthKit (iOS)

Install a maintained HealthKit library with an Expo config plugin, for example `@kingstinct/react-native-healthkit`, and add its plugin to `app.json` with usage strings:

```json
["@kingstinct/react-native-healthkit", {
  "NSHealthShareUsageDescription": "Knivy reads the health data you choose to show your steps, heart, sleep and body measurements.",
  "NSHealthUpdateUsageDescription": "Knivy can save workouts you record to Apple Health."
}]
```

Check the library's current README for the exact plugin options before building.

## 3. Health Connect (Android)

Install `react-native-health-connect` and its Expo config plugin (`expo-health-connect`), set `minSdkVersion` to what the library requires with `expo-build-properties`, and declare only the read permissions you use (steps, distance, heart rate, resting heart rate, exercise, sleep, weight, height, blood pressure, oxygen saturation, body temperature). Google Play requires a privacy policy and a declaration for each health permission.

## 4. Implement the adapter

Create `src/integrations/health/appleHealth.ts` and `healthConnect.ts` implementing `HealthPlatformAdapter` from `src/integrations/health/types.ts`:

- `getStatus()` → availability and permission state.
- `requestPermissions()` → ask only for the types the user turns on, with an explanation shown first (reuse `PermissionCard`).
- `importSince(sinceIso)` → read samples and write them with the repository's `importExternal(externalId, data, { source: 'imported', sourceName, recordedAt })`.

Mapping:

| Platform data | Knivy collection | Notes |
| --- | --- | --- |
| Step count (daily sum) | `measurements` type `steps` | One record per day, externalId `hk-steps-YYYY-MM-DD` and update if it grows |
| Heart rate, resting heart rate | `measurements` | value in bpm |
| Blood pressure | `measurements` `blood_pressure` | systolic → `value`, diastolic → `value2` |
| Oxygen saturation | `measurements` `spo2` | convert fraction to % |
| Body temperature | `measurements` `temperature` | store °C |
| Weight, height | `measurements` | kg, cm |
| Workouts / exercise sessions | `activities` | `energySource: 'device'` only if the platform supplies it |
| Sleep sessions and stages | `sleep_sessions` | fill `stages` only from real stage samples |

Use the platform sample UUID as `externalId` so repeated imports never duplicate records. Respect platform background limits: import on app start and when the user pulls to refresh, rather than relying on background tasks.

Finally, replace `getAppleHealthStatus` / `getHealthConnectStatus` in `src/integrations/health/platforms.ts` with calls to the adapters, and have `useDaySteps` prefer imported step records when present.

## Other development-build upgrades

- **Encrypted local database**: enable SQLCipher with the `expo-sqlite` config plugin (`useSQLCipher: true`) and set a key from `expo-secure-store` with `PRAGMA key` right after opening.
- **Background GPS**: `expo-location` background permission plus `expo-task-manager`.
