import { cache } from "@overextended/ox_lib/server";
import type { SQLInputValue, SQLOutputValue, StatementSync } from "node:sqlite";
import { createLRU } from "lru.min";
import { DatabaseSync } from "node:sqlite";
import { cfxExport } from "@overextended/ox_lib/common/exports";

const dbPath = "ox.db";

export const database = new DatabaseSync(dbPath);
export const readonly = new DatabaseSync(dbPath, { readOnly: true });

database.exec(`
  PRAGMA journal_mode = WAL;
  PRAGMA synchronous = NORMAL;
  PRAGMA journal_size_limit = 16777216;
  PRAGMA mmap_size = 134217728;
  PRAGMA cache_size = -8192;
  PRAGMA foreign_keys = ON;
`);

readonly.exec(`
  PRAGMA mmap_size = 134217728;
  PRAGMA cache_size = -8192;
  PRAGMA foreign_keys = ON;
`);

database.exec(LoadResourceFile(cache.resource, "resource/db.sql"));

function createStatementCache(connection: DatabaseSync) {
  const statements = createLRU<string, StatementSync>({
    max: 100,
  });

  return (query: string | TemplateStringsArray) => {
    const sql = typeof query === "string" ? query : query.join("?");
    let statement = statements.get(sql);

    if (statement) return statement;

    statement = connection.prepare(sql);
    statements.set(sql, statement);

    return statement;
  };
}

const prepare = createStatementCache(database);
const prepareReadonly = createStatementCache(readonly);

cfxExport("dbFindOne", (query: string, parameters = []) => prepareReadonly(query).get(...parameters));
cfxExport("dbFindAll", (query: string, parameters = []) => prepareReadonly(query).all(...parameters));

export const db = {
  run: (query: string | TemplateStringsArray, ...values: SQLInputValue[]) => prepare(query).run(...values),
  get: <T extends Record<string, SQLOutputValue>>(query: string | TemplateStringsArray, ...values: SQLInputValue[]) =>
    prepare(query).get(...values) as T | undefined,
  all: <T extends Record<string, SQLOutputValue>>(query: string | TemplateStringsArray, ...values: SQLInputValue[]) =>
    prepare(query).all(...values) as T[],
  exec: (sql: string) => database.exec(sql),
};

export function encode(value: SQLInputValue) {
  return JSON.stringify(value);
}

export function decode(value: string) {
  return JSON.parse(value);
}
