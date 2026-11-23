import { COLLECTIONS } from '../../db/collections';
import { getDb } from '../../db/database';
import { backendConfigured } from '../api';

// Offline-first: every write is stored locally first with sync_status = 'pending'.
// Phase 2 will push pending rows to the backend (last-write-wins by updated_at,
// tombstones for deletes) and pull remote changes. Phase 1 only reports status.

export async function pendingChanges() {
  const db = await getDb();
  let total = 0;
  for (const table of COLLECTIONS) {
    const row = await db.getFirstAsync<{ n: number }>(`SELECT COUNT(*) AS n FROM ${table} WHERE sync_status != 'synced'`);
    total += row?.n ?? 0;
  }
  return total;
}

export type SyncResult = { status: 'unavailable'; message: string } | { status: 'ok'; pushed: number };

export async function syncNow(): Promise<SyncResult> {
  if (!backendConfigured) {
    return {
      status: 'unavailable',
      message: 'Cloud sync needs a Knivy account, which comes with the backend in a later release. Everything stays on this phone until then.',
    };
  }
  // Placeholder for phase 2. Never reports success without a real server round-trip.
  return { status: 'unavailable', message: 'Sync isn’t implemented in this build yet.' };
}
