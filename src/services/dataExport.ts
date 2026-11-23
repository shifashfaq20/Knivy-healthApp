import { Directory, Paths } from 'expo-file-system';
import { COLLECTIONS } from '../db/collections';
import { getDb, wipeDatabase } from '../db/database';
import { shareTextFile } from '../utils/csv';
import { cancelAllReminders } from './notifications';

/** Exports every local record (and settings) as JSON and opens the share sheet. */
export async function exportAllData() {
  const db = await getDb();
  const out: Record<string, unknown> = { app: 'Knivy', exportedAt: new Date().toISOString(), version: 1 };
  for (const table of COLLECTIONS) {
    const rows = await db.getAllAsync<Record<string, string | null>>(`SELECT * FROM ${table} WHERE deleted_at IS NULL ORDER BY recorded_at`);
    out[table] = rows.map((r) => ({ ...r, payload: r.payload ? JSON.parse(r.payload) : null }));
  }
  const kv = await db.getAllAsync<{ key: string; value: string }>('SELECT key, value FROM kv');
  out.settings = Object.fromEntries(kv.map((r) => [r.key, JSON.parse(r.value)]));
  const stamp = new Date().toISOString().slice(0, 10);
  await shareTextFile(`knivy-export-${stamp}.json`, JSON.stringify(out, null, 2), 'application/json');
}

export const RECORDS_DIR = 'health-records';

/** Permanently deletes everything Knivy stores on this phone. */
export async function deleteAllLocalData() {
  await cancelAllReminders().catch(() => undefined);
  await wipeDatabase();
  const dir = new Directory(Paths.document, RECORDS_DIR);
  if (dir.exists) dir.delete();
}
