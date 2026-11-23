import type * as SQLite from 'expo-sqlite';
import { Platform } from 'react-native';
import { COLLECTIONS } from './collections';
import { openMemoryDatabase } from './memoryDb';

const DB_NAME = 'knivy.db';

let dbPromise: Promise<SQLite.SQLiteDatabase> | null = null;

function collectionTableSql(table: string) {
  // payload: JSON document; recorded_at: UTC ISO; sync_status: outbox marker for future cloud sync.
  return `
    CREATE TABLE IF NOT EXISTS ${table} (
      id TEXT PRIMARY KEY NOT NULL,
      recorded_at TEXT NOT NULL,
      source TEXT NOT NULL DEFAULT 'manual',
      source_name TEXT,
      external_id TEXT,
      payload TEXT NOT NULL,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      deleted_at TEXT,
      sync_status TEXT NOT NULL DEFAULT 'pending'
    );
    CREATE INDEX IF NOT EXISTS idx_${table}_recorded ON ${table} (recorded_at);
    CREATE UNIQUE INDEX IF NOT EXISTS idx_${table}_external ON ${table} (external_id) WHERE external_id IS NOT NULL;
  `;
}

type Migration = (db: SQLite.SQLiteDatabase) => Promise<void>;

const MIGRATIONS: Migration[] = [
  async (db) => {
    for (const table of COLLECTIONS) {
      await db.execAsync(collectionTableSql(table));
    }
    await db.execAsync('CREATE TABLE IF NOT EXISTS kv (key TEXT PRIMARY KEY NOT NULL, value TEXT NOT NULL);');
  },
];

async function migrate(db: SQLite.SQLiteDatabase) {
  const row = await db.getFirstAsync<{ user_version: number }>('PRAGMA user_version');
  const current = row?.user_version ?? 0;
  for (let i = current; i < MIGRATIONS.length; i++) {
    await db.withTransactionAsync(async () => {
      await MIGRATIONS[i](db);
    });
    await db.execAsync(`PRAGMA user_version = ${i + 1}`);
  }
}

export function getDb(): Promise<SQLite.SQLiteDatabase> {
  if (!dbPromise) {
    dbPromise = (async () => {
      let db: SQLite.SQLiteDatabase;
      if (Platform.OS === 'web') {
        // Browser / Snack web preview: SQLite isn't available there, so use the in-memory stand-in.
        db = openMemoryDatabase();
      } else {
        // Loaded lazily so the web preview never has to bundle native SQLite.
        const { openDatabaseAsync } = require('expo-sqlite') as typeof SQLite;
        db = await openDatabaseAsync(DB_NAME);
        await db.execAsync('PRAGMA journal_mode = WAL;');
      }
      await migrate(db);
      return db;
    })().catch((error) => {
      dbPromise = null;
      throw error;
    });
  }
  return dbPromise;
}

/** Removes every record and setting on this device. Used by "Delete all data". */
export async function wipeDatabase() {
  const db = await getDb();
  await db.withTransactionAsync(async () => {
    for (const table of COLLECTIONS) {
      await db.execAsync(`DELETE FROM ${table};`);
    }
    await db.execAsync('DELETE FROM kv;');
  });
  await db.execAsync('VACUUM;');
}
