import type { StateStorage } from 'zustand/middleware';
import { getDb } from './database';

/** Key-value storage backed by SQLite, used to persist Zustand stores. */
export const kvStorage: StateStorage = {
  async getItem(key) {
    const db = await getDb();
    const row = await db.getFirstAsync<{ value: string }>('SELECT value FROM kv WHERE key = ?', [key]);
    return row?.value ?? null;
  },
  async setItem(key, value) {
    const db = await getDb();
    await db.runAsync('INSERT OR REPLACE INTO kv (key, value) VALUES (?, ?)', [key, value]);
  },
  async removeItem(key) {
    const db = await getDb();
    await db.runAsync('DELETE FROM kv WHERE key = ?', [key]);
  },
};
