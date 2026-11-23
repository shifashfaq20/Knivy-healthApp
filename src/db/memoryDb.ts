/**
 * Web-only stand-in for expo-sqlite, used when Knivy runs in a browser (e.g. the Snack web preview),
 * where SQLite isn't available. It understands the small SQL dialect this app actually uses
 * (CREATE TABLE/INDEX, SELECT/INSERT/UPDATE/DELETE with simple AND conditions, PRAGMA user_version)
 * and keeps the tables in memory, saved to the browser's localStorage when it can.
 * On a phone the real SQLite database is used and this file is never loaded.
 * Unknown SQL throws instead of silently doing nothing, so mistakes surface.
 */
import type { SQLiteDatabase } from 'expo-sqlite';

type Value = string | number | null;
type Row = Record<string, Value>;
type Params = readonly unknown[];

interface TableDef {
  columns: string[];
  defaults: Record<string, Value>;
  primaryKey: string | null;
  /** Columns that must be unique when not null (from CREATE UNIQUE INDEX). */
  unique: string[];
}

interface State {
  userVersion: number;
  defs: Record<string, TableDef>;
  rows: Record<string, Row[]>;
}

const STORAGE_KEY = 'knivy.memorydb.v1';

function storage(): Storage | null {
  try {
    const ls = (globalThis as { localStorage?: Storage }).localStorage;
    return ls ?? null;
  } catch {
    return null;
  }
}

function load(): State {
  try {
    const raw = storage()?.getItem(STORAGE_KEY);
    if (raw) return JSON.parse(raw) as State;
  } catch {
    // Corrupt or unavailable storage: start empty.
  }
  return { userVersion: 0, defs: {}, rows: {} };
}

function clone<T>(v: T): T {
  return JSON.parse(JSON.stringify(v)) as T;
}

/** Splits on a separator only when outside quotes and parentheses. */
function splitTop(s: string, sep: ',' | ';'): string[] {
  const out: string[] = [];
  let depth = 0;
  let quote = false;
  let cur = '';
  for (const ch of s) {
    if (ch === "'") quote = !quote;
    if (!quote) {
      if (ch === '(') depth++;
      if (ch === ')') depth--;
      if (ch === sep && depth === 0) {
        out.push(cur);
        cur = '';
        continue;
      }
    }
    cur += ch;
  }
  out.push(cur);
  return out.map((x) => x.trim()).filter(Boolean);
}

/** Numbers each `?` outside quotes as $0, $1, … so values bind in order. */
function numberPlaceholders(sql: string): string {
  let n = 0;
  let quote = false;
  let out = '';
  for (const ch of sql) {
    if (ch === "'") quote = !quote;
    out += !quote && ch === '?' ? `$${n++}` : ch;
  }
  return out;
}

function normalize(sql: string) {
  return numberPlaceholders(sql.replace(/\s+/g, ' ').trim());
}

function toValue(v: unknown): Value {
  if (v === undefined || v === null) return null;
  if (typeof v === 'boolean') return v ? 1 : 0;
  if (typeof v === 'number' || typeof v === 'string') return v;
  return String(v);
}

export function openMemoryDatabase(): SQLiteDatabase {
  let state = load();

  const save = () => {
    try {
      storage()?.setItem(STORAGE_KEY, JSON.stringify(state));
    } catch {
      // Storage full or blocked: data stays in memory for this session.
    }
  };

  const table = (name: string) => {
    const rows = state.rows[name];
    if (!rows) throw new Error(`memoryDb: no such table: ${name}`);
    return rows;
  };

  /** Evaluates a value expression: $n param, 'literal', number, NULL, column name or COALESCE(...). */
  const evalExpr = (expr: string, params: Params, row?: Row): Value => {
    const e = expr.trim();
    let m: RegExpMatchArray | null;
    if ((m = e.match(/^\$(\d+)$/))) return toValue(params[Number(m[1])]);
    if ((m = e.match(/^'(.*)'$/))) return m[1].replace(/''/g, "'");
    if (/^-?\d+(\.\d+)?$/.test(e)) return Number(e);
    if (/^NULL$/i.test(e)) return null;
    if ((m = e.match(/^COALESCE\((.*)\)$/i))) {
      for (const part of splitTop(m[1], ',')) {
        const v = evalExpr(part, params, row);
        if (v !== null) return v;
      }
      return null;
    }
    if (/^\w+$/.test(e) && row) return row[e] ?? null;
    throw new Error(`memoryDb: unsupported expression: ${e}`);
  };

  const matcher = (where: string | undefined, params: Params) => {
    if (!where) return () => true;
    const conds = where.split(/ AND /i).map((c) => {
      let m: RegExpMatchArray | null;
      if ((m = c.match(/^(\w+) IS (NOT )?NULL$/i))) {
        const [, col, not] = m;
        return (r: Row) => ((r[col] ?? null) === null) !== !!not;
      }
      if ((m = c.match(/^(\w+) (=|!=|<>|>=|<=|<|>) (.+)$/))) {
        const [, col, op, rhs] = m;
        const v = evalExpr(rhs, params);
        return (r: Row) => {
          const a = r[col] ?? null;
          if (a === null || v === null) return false; // SQL: comparisons with NULL are never true
          switch (op) {
            case '=':
              return a === v;
            case '!=':
            case '<>':
              return a !== v;
            case '>=':
              return a >= v;
            case '<=':
              return a <= v;
            case '<':
              return a < v;
            default:
              return a > v;
          }
        };
      }
      throw new Error(`memoryDb: unsupported condition: ${c}`);
    });
    return (r: Row) => conds.every((f) => f(r));
  };

  const select = (sql: string, params: Params): Row[] => {
    if (/^PRAGMA user_version$/i.test(sql)) return [{ user_version: state.userVersion }];
    const m = sql.match(/^SELECT (.+?) FROM (\w+)(?: WHERE (.+?))?(?: ORDER BY (\w+)(?: (ASC|DESC))?)?(?: LIMIT (\d+))?$/i);
    if (!m) throw new Error(`memoryDb: unsupported query: ${sql}`);
    const [, cols, name, where, orderBy, dir, limit] = m;
    let rows = table(name).filter(matcher(where, params));
    if (/^COUNT\(\*\) AS (\w+)$/i.test(cols)) {
      const alias = cols.match(/AS (\w+)$/i)![1];
      return [{ [alias]: rows.length }];
    }
    if (orderBy) {
      const sign = dir?.toUpperCase() === 'DESC' ? -1 : 1;
      rows = [...rows].sort((a, b) => {
        const x = a[orderBy] ?? '';
        const y = b[orderBy] ?? '';
        return x < y ? -sign : x > y ? sign : 0;
      });
    }
    if (limit) rows = rows.slice(0, Number(limit));
    if (cols.trim() === '*') return rows.map((r) => ({ ...r }));
    const picked = splitTop(cols, ',');
    return rows.map((r) => Object.fromEntries(picked.map((c) => [c, r[c] ?? null])));
  };

  const run = (sql: string, params: Params): number => {
    let m: RegExpMatchArray | null;

    if ((m = sql.match(/^PRAGMA user_version = (\d+)$/i))) {
      state.userVersion = Number(m[1]);
      return 0;
    }
    if (/^PRAGMA \w+ = \w+$/i.test(sql) || /^VACUUM$/i.test(sql)) return 0;

    if ((m = sql.match(/^CREATE TABLE IF NOT EXISTS (\w+) \((.*)\)$/i))) {
      const [, name, body] = m;
      if (!state.defs[name]) {
        const def: TableDef = { columns: [], defaults: {}, primaryKey: null, unique: [] };
        for (const colDef of splitTop(body, ',')) {
          const col = colDef.split(' ')[0];
          def.columns.push(col);
          if (/PRIMARY KEY/i.test(colDef)) def.primaryKey = col;
          const d = colDef.match(/DEFAULT ('(?:[^']|'')*'|-?\d+(?:\.\d+)?|NULL)/i);
          if (d) def.defaults[col] = evalExpr(d[1], []);
        }
        state.defs[name] = def;
        state.rows[name] = [];
      }
      return 0;
    }

    if ((m = sql.match(/^CREATE (UNIQUE )?INDEX IF NOT EXISTS \w+ ON (\w+) \((\w+)\)(?: WHERE .+)?$/i))) {
      const [, unique, name, col] = m;
      const def = state.defs[name];
      if (unique && def && !def.unique.includes(col)) def.unique.push(col);
      return 0;
    }

    if ((m = sql.match(/^INSERT (?:OR (IGNORE|REPLACE) )?INTO (\w+) \(([^)]*)\) VALUES \((.*)\)$/i))) {
      const [, onConflict, name, colList, valList] = m;
      const def = state.defs[name];
      const rows = table(name);
      const cols = splitTop(colList, ',');
      const vals = splitTop(valList, ',');
      if (cols.length !== vals.length) throw new Error(`memoryDb: column/value count mismatch: ${sql}`);
      const row: Row = {};
      for (const c of def.columns) row[c] = def.defaults[c] ?? null;
      cols.forEach((c, i) => {
        row[c] = evalExpr(vals[i], params);
      });
      const keys = [def.primaryKey, ...def.unique].filter((k): k is string => !!k);
      const clashes = rows.filter((r) => keys.some((k) => row[k] !== null && r[k] === row[k]));
      if (clashes.length) {
        if (onConflict?.toUpperCase() === 'IGNORE') return 0;
        if (onConflict?.toUpperCase() !== 'REPLACE') throw new Error(`memoryDb: UNIQUE constraint failed on ${name}`);
        state.rows[name] = rows.filter((r) => !clashes.includes(r));
      }
      state.rows[name].push(row);
      return 1;
    }

    if ((m = sql.match(/^UPDATE (\w+) SET (.+?) WHERE (.+)$/i))) {
      const [, name, sets, where] = m;
      const assigns = splitTop(sets, ',').map((a) => {
        const am = a.match(/^(\w+) = (.+)$/);
        if (!am) throw new Error(`memoryDb: unsupported assignment: ${a}`);
        return [am[1], am[2]] as const;
      });
      const hit = table(name).filter(matcher(where, params));
      for (const r of hit) {
        const next = { ...r };
        for (const [col, expr] of assigns) next[col] = evalExpr(expr, params, r);
        Object.assign(r, next);
      }
      return hit.length;
    }

    if ((m = sql.match(/^DELETE FROM (\w+)(?: WHERE (.+))?$/i))) {
      const [, name, where] = m;
      const rows = table(name);
      const test = matcher(where, params);
      state.rows[name] = rows.filter((r) => !test(r));
      return rows.length - state.rows[name].length;
    }

    throw new Error(`memoryDb: unsupported statement: ${sql}`);
  };

  const db = {
    async execAsync(source: string) {
      for (const stmt of splitTop(source, ';')) run(normalize(stmt), []);
      save();
    },
    async runAsync(source: string, params: Params = []) {
      const changes = run(normalize(source), params);
      save();
      return { changes, lastInsertRowId: 0 };
    },
    async getFirstAsync<T>(source: string, params: Params = []): Promise<T | null> {
      return (select(normalize(source), params)[0] as T | undefined) ?? null;
    },
    async getAllAsync<T>(source: string, params: Params = []): Promise<T[]> {
      return select(normalize(source), params) as T[];
    },
    async withTransactionAsync(task: () => Promise<void>) {
      const snapshot = clone(state);
      try {
        await task();
        save();
      } catch (error) {
        state = snapshot;
        save();
        throw error;
      }
    },
  };

  return db as unknown as SQLiteDatabase;
}
