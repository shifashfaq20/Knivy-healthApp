import type { Rec, Source, SyncStatus } from '../types/models';
import { newId } from '../utils/id';
import type { CollectionName } from './collections';
import { getDb } from './database';
import { emitCollectionChange } from './events';

interface Row {
  id: string;
  recorded_at: string;
  source: string;
  source_name: string | null;
  external_id: string | null;
  payload: string;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
  sync_status: string;
}

export interface ListOptions {
  /** Inclusive lower bound on recordedAt (UTC ISO). */
  from?: string;
  /** Exclusive upper bound on recordedAt (UTC ISO). */
  to?: string;
  limit?: number;
  order?: 'asc' | 'desc';
}

export interface CreateMeta {
  recordedAt?: string;
  source?: Source;
  sourceName?: string | null;
  externalId?: string | null;
}

function toRec<T>(row: Row): Rec<T> {
  return {
    id: row.id,
    recordedAt: row.recorded_at,
    source: row.source as Source,
    sourceName: row.source_name,
    externalId: row.external_id,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    syncStatus: row.sync_status as SyncStatus,
    data: JSON.parse(row.payload) as T,
  };
}

export function createRepository<T>(table: CollectionName) {
  return {
    table,

    async list(opts: ListOptions = {}): Promise<Rec<T>[]> {
      const db = await getDb();
      const where = ['deleted_at IS NULL'];
      const params: string[] = [];
      if (opts.from) {
        where.push('recorded_at >= ?');
        params.push(opts.from);
      }
      if (opts.to) {
        where.push('recorded_at < ?');
        params.push(opts.to);
      }
      const order = opts.order === 'asc' ? 'ASC' : 'DESC';
      const limit = opts.limit ? ` LIMIT ${Math.max(1, Math.floor(opts.limit))}` : '';
      const rows = await db.getAllAsync<Row>(
        `SELECT * FROM ${table} WHERE ${where.join(' AND ')} ORDER BY recorded_at ${order}${limit}`,
        params,
      );
      return rows.map((r) => toRec<T>(r));
    },

    async get(id: string): Promise<Rec<T> | null> {
      const db = await getDb();
      const row = await db.getFirstAsync<Row>(`SELECT * FROM ${table} WHERE id = ? AND deleted_at IS NULL`, [id]);
      return row ? toRec<T>(row) : null;
    },

    async create(data: T, meta: CreateMeta = {}): Promise<Rec<T>> {
      const db = await getDb();
      const now = new Date().toISOString();
      const rec: Rec<T> = {
        id: newId(),
        recordedAt: meta.recordedAt ?? now,
        source: meta.source ?? 'manual',
        sourceName: meta.sourceName ?? null,
        externalId: meta.externalId ?? null,
        createdAt: now,
        updatedAt: now,
        syncStatus: 'pending',
        data,
      };
      await db.runAsync(
        `INSERT INTO ${table} (id, recorded_at, source, source_name, external_id, payload, created_at, updated_at, sync_status)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'pending')`,
        [rec.id, rec.recordedAt, rec.source, rec.sourceName, rec.externalId, JSON.stringify(data), now, now],
      );
      emitCollectionChange(table);
      return rec;
    },

    /** Inserts an imported record unless one with the same externalId exists. Returns true if inserted. */
    async importExternal(externalId: string, data: T, meta: Omit<CreateMeta, 'externalId'>): Promise<boolean> {
      const db = await getDb();
      const now = new Date().toISOString();
      const result = await db.runAsync(
        `INSERT OR IGNORE INTO ${table} (id, recorded_at, source, source_name, external_id, payload, created_at, updated_at, sync_status)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'pending')`,
        [newId(), meta.recordedAt ?? now, meta.source ?? 'imported', meta.sourceName ?? null, externalId, JSON.stringify(data), now, now],
      );
      if (result.changes > 0) emitCollectionChange(table);
      return result.changes > 0;
    },

    async update(id: string, data: T, recordedAt?: string): Promise<void> {
      const db = await getDb();
      const now = new Date().toISOString();
      await db.runAsync(
        `UPDATE ${table} SET payload = ?, recorded_at = COALESCE(?, recorded_at), updated_at = ?, sync_status = 'pending'
         WHERE id = ? AND deleted_at IS NULL`,
        [JSON.stringify(data), recordedAt ?? null, now, id],
      );
      emitCollectionChange(table);
    },

    /** Deletes the content immediately and keeps an empty tombstone so a future sync can propagate the deletion. */
    async remove(id: string): Promise<void> {
      const db = await getDb();
      const now = new Date().toISOString();
      await db.runAsync(
        `UPDATE ${table} SET payload = '{}', deleted_at = ?, updated_at = ?, sync_status = 'pending' WHERE id = ?`,
        [now, now, id],
      );
      emitCollectionChange(table);
    },

    async pendingCount(): Promise<number> {
      const db = await getDb();
      const row = await db.getFirstAsync<{ n: number }>(`SELECT COUNT(*) AS n FROM ${table} WHERE sync_status != 'synced'`);
      return row?.n ?? 0;
    },
  };
}

export type Repository<T> = ReturnType<typeof createRepository<T>>;
