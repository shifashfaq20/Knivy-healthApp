# Architecture

## Layers

```
Screens (app/)  →  hooks (useRecords, useSteps)  →  repositories  →  SQLite (expo-sqlite)
                                                  ↘  services (nutrition APIs, AI client, notifications, sync)
                                                  ↘  integrations (motion sensor, HealthKit, Health Connect)
```

- **Repositories** (`src/db/repository.ts`) expose `list`, `get`, `create`, `update`, `remove`, `importExternal` and `pendingCount`. Every write emits a change event.
- **TanStack Query** caches reads. `src/services/queryClient.ts` listens for change events and invalidates the matching `['records', collection]` queries, so any write refreshes every screen that reads that collection.
- **Zustand** holds settings (`profileStore`, persisted to SQLite), the in-progress workout (`sessionStore`, persisted), short-lived screen hand-offs (`draftStore`) and lock state.
- Services and integrations are behind small interfaces so their implementations can change (for example, proxying USDA calls through the backend) without touching screens.

## Local data model

Every collection is a table with the same shape; the domain object is a JSON payload typed in `src/types/models.ts`.

| Column | Type | Notes |
| --- | --- | --- |
| `id` | TEXT PK | UUID v4 generated on the device (safe to merge across devices) |
| `recorded_at` | TEXT | UTC ISO-8601; when the thing happened. Indexed. |
| `source` | TEXT | `manual`, `device`, `imported`, `estimated` |
| `source_name` | TEXT | e.g. "Phone GPS", "Open Food Facts" |
| `external_id` | TEXT | Platform sample ID for imports. Unique index prevents duplicate imports. |
| `payload` | TEXT | JSON document |
| `created_at`, `updated_at` | TEXT | UTC ISO-8601 |
| `deleted_at` | TEXT | Tombstone. On delete, the payload is wiped to `{}` immediately. |
| `sync_status` | TEXT | `pending` until a server confirms it (`synced`) |

Collections: measurements, activities, custom_exercises, workout_templates, workout_sessions, food_entries, custom_foods, recipes, meal_plans, water_entries, sleep_sessions, periods, cycle_logs, moods, journal_entries, habits, habit_logs, medications, medication_logs, allergies, conditions, vaccinations, appointments, contacts, documents, chat_messages. Settings live in a `kv` table.

Migrations are versioned with `PRAGMA user_version` in `src/db/database.ts`. Add a new function to `MIGRATIONS`; never edit an old one.

### Time

Timestamps are stored in UTC. Calendar logic (which day something belongs to, streaks, cycle dates) uses the phone's time zone. Pure calendar values such as a period start are stored as local `YYYY-MM-DD` keys.

### Units

Values are stored in metric (kg, cm, km, ml, °C) and converted for display in `src/utils/units.ts`.

## Sync design (phase 2)

1. Push: send rows with `sync_status != 'synced'` in batches (`id`, `updated_at`, `deleted_at`, `payload`).
2. Server applies last-write-wins by `updated_at` per record, keeps tombstones, and returns accepted IDs → mark `synced`.
3. Pull: fetch records changed since the last server cursor; upsert locally unless the local row has a newer unsynced edit (then keep local and re-push).
4. Failed pushes stay `pending` and retry with backoff. Local records are never discarded.

`src/services/sync/syncEngine.ts` reports pending counts today and returns "unavailable" for `syncNow()` until the backend exists.

## Backend API contract the app already expects (phase 2)

All endpoints are relative to `EXPO_PUBLIC_API_BASE_URL`. The backend holds AI-provider keys; the app never does.

### `POST /v1/assistant/messages`

Request:
```json
{ "messages": [{ "role": "user", "content": "How can I sleep better?" }], "context": {} }
```
Response: `{ "reply": "…" }`

Server responsibilities: refuse diagnosis and medication advice, detect emergencies and point to local services, only use health context the user has consented to share.

### `POST /v1/nutrition/recognize`

Multipart form with an `image` file. Response:
```json
{ "items": [{ "label": "grilled chicken breast", "confidence": 0.82, "estimatedGrams": 120 }] }
```
`estimatedGrams` must be `null` when the model can't support an estimate. The app matches each label to a real nutrition record and asks the user to confirm before saving; the server should never return nutrient values.

### Planned (not yet called)
- `POST /v1/auth/*` — registration, login, refresh, password reset
- `POST /v1/sync/push`, `GET /v1/sync/pull?cursor=` — see sync design
- `POST /v1/documents` — encrypted document storage
- `DELETE /v1/account` — account and data deletion

Suggested backend: NestJS + PostgreSQL + Prisma, with one table per collection mirroring the columns above plus `user_id`, row-level ownership checks on every query, and audit logging for reads of records and documents.
