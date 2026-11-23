# Implementation status (phase 1, no backend)

Legend: **Done** = working on device with real data. **Partial** = works with a stated limit. **Structure only** = code path and UI exist, but it needs the backend or a development build to function. **Not started**.

| Area | Status | Notes / how to test |
| --- | --- | --- |
| Onboarding | Done | Fresh install → five steps. Name, height and weight are required; Continue stays on the step until they're valid |
| Form validation | Done | Every form checks on save: inline red messages under the field, a summary banner on long forms, error vibration. Rules in `src/utils/validation.ts` |
| App icon and splash | Done | `assets/icon.png`, `adaptive-icon.png`, `splash-icon.png`; visible in development and store builds (Expo Go shows its own icon) |
| Home dashboard | Done | 12 widgets; Customise home toggles and reorders them; empty states link to the right screen |
| Health readings | Done | Add HR, resting HR, BP, SpO₂, temperature, weight, height, steps; history chart; delete; BMI from latest weight and height; CSV share |
| Steps (iPhone) | Done | Allow motion access on Activity; reads Core Motion (about 7 days of history) |
| Steps (Android) | Partial | Live counting while the screen is open, saved as device records; history needs Health Connect |
| GPS activity | Partial | Foreground only in Expo Go; distance, time, pace; poor-accuracy points ignored |
| Manual activities | Done | Create, edit, delete; energy estimate labelled when not entered |
| Workouts | Done | Library (36 exercises), custom exercises, builder with schedule, live session with rest timer, resume after closing, history, edit, delete, personal bests |
| Food search | Done | Open Food Facts (no key); USDA when `EXPO_PUBLIC_FDC_API_KEY` is set; offline and error states |
| Barcode scan | Done | expo-camera; manual entry fallback; create food if not found |
| Food logging | Done | Portions by serving or grams; edit, delete; missing nutrients shown as n/a; allergen and diet flags |
| Custom foods, recipes | Done | Recipe nutrition from ingredients; nutrient left empty if any ingredient lacks it |
| Meal planner | Done | Day and week views; log from plan; allergy flags on recipes |
| AI food photo | Structure only | Photo capture, review, matching to real database records and confirm-to-save are built; recognition needs the backend |
| Water | Done | Quick add, custom sizes, edit, delete, goal, weekly chart, scheduled reminders |
| Sleep | Partial | Manual sessions, trends, typical times, recovery summary, bedtime reminder; stages only from devices (needs dev build) |
| Cycle tracking | Done | Optional; calendar, flow, symptoms, mood, energy, mucus, BBT; history; estimates with confidence; CSV report |
| Mind | Done | Mood and stress check-ins, 30-day charts, tags, private journal with optional lock, breathing, guided practices, daily reminder |
| AI assistant | Structure only | Chat UI, local history, emergency wording check works offline; replies need the backend |
| Insights | Done | 7/30/90/365 days and custom; by day, week or month; gaps shown; CSV report |
| Health records | Done | Medications with reminders and "taken" log; allergies, history, vaccinations, appointments, care team, documents (PDF/images, copied to private storage); search; optional lock |
| Habits | Done | Categories, routines, schedules, reminders, pause, 7-day grid, streaks from real completions |
| Notifications | Done | Local reminders; list of scheduled reminders; permission handling |
| Devices | Partial | Motion sensor works; Apple Health and Health Connect report unavailable until the dev-build adapter exists |
| Settings | Done | Units, features, privacy locks, JSON export, delete all data |
| Accounts, login, password reset | Not started | Needs backend (phase 2) |
| Cloud sync, multi-device | Structure only | Every record is marked pending; sync engine reports unavailable |
| Languages other than English | Not started | Dates and numbers follow the phone's region |
| Encrypted local database | Not started | Needs SQLCipher in a dev build (see NATIVE_HEALTH_SETUP.md) |
| Automated tests | Not started | Pure logic modules listed in README are ready for unit tests |

## Before a commercial launch

- Legal review of privacy, health-data and consumer-protection rules in each target market (for example GDPR, HIPAA where applicable, Pakistan's data-protection rules, app-store health-data policies).
- Privacy policy and in-app consent screens matching what's collected.
- Clinical review of wellness copy, emergency wording and the assistant's guardrails.
- Store listings and screenshots. (The app icon and splash screen are included.)
