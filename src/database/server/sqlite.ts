import { cache } from "@overextended/ox_lib/server";
import type { SQLInputValue, SQLOutputValue, StatementSync } from "node:sqlite";
import { createLRU } from "lru.min";
import { DatabaseSync } from "node:sqlite";
import { cfxExport } from "@overextended/ox_lib/common/exports";

export interface Row {
  [key: string]: SQLOutputValue;
}

export interface UserRow extends Row {
  id: number;
  license: string;
  last_seen: number;
}

export interface CharacterRow extends Row {
  id: number;
  user_id: number;
  uuid: string;
  last_seen: number;
}

export function encode(value: SQLInputValue) {
  return JSON.stringify(value);
}

export function decode<T extends Row>(value: string) {
  return JSON.parse(value) as T;
}

function uuidToBuffer(uuid: SQLOutputValue): Buffer {
  if (typeof uuid !== "string") {
    throw new TypeError(`UUID must be a string.`);
  }

  return Buffer.from(uuid.replaceAll("-", ""), "hex");
}

function uuidFromBuffer(arr: SQLOutputValue): string {
  if (!(arr instanceof Uint8Array) || arr.byteLength !== 16) {
    throw new TypeError("UUID must be a 16-byte Uint8Array");
  }

  const buffer = Buffer.from(arr);
  const hex = buffer.toString("hex");

  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

class Connection {
  private cache = createLRU<string, StatementSync>({ max: 100 });
  private connection: DatabaseSync;

  constructor(readOnly = false) {
    this.connection = new DatabaseSync("ox.db", { readOnly });

    if (readOnly) {
      this.connection.exec(`
        PRAGMA mmap_size = 134217728;
        PRAGMA cache_size = -8192;
        PRAGMA foreign_keys = ON;
      `);
    } else {
      this.connection.exec(`
        PRAGMA journal_mode = WAL;
        PRAGMA synchronous = NORMAL;
        PRAGMA journal_size_limit = 16777216;
        PRAGMA mmap_size = 134217728;
        PRAGMA cache_size = -8192;
        PRAGMA foreign_keys = ON;
      `);
    }

    this.connection.function("uuid_to_blob", { deterministic: true }, uuidToBuffer);
    this.connection.function("uuid_from_blob", { deterministic: true }, uuidFromBuffer);
  }

  private prepare(query: string | TemplateStringsArray) {
    const sql = typeof query === "string" ? query : query.join("?");
    let statement = this.cache.get(sql);

    if (statement) return statement;

    statement = this.connection.prepare(sql);
    this.cache.set(sql, statement);

    return statement;
  }

  public run(query: string | TemplateStringsArray, ...values: SQLInputValue[]) {
    return this.prepare(query).run(...values);
  }

  public get<T extends Row>(query: string | TemplateStringsArray, ...values: SQLInputValue[]) {
    return this.prepare(query).get(...values) as T | undefined;
  }

  public all<T extends Row>(query: string | TemplateStringsArray, ...values: SQLInputValue[]) {
    return this.prepare(query).all(...values) as T[];
  }

  public exec(sql: string) {
    this.connection.exec(sql);
  }
}

export const db = new Connection();
export const readdb = new Connection(true);

db.exec(LoadResourceFile(cache.resource, "resource/db.sql"));

cfxExport("dbFindOne", (query: string, parameters = []) => readdb.get(query, ...parameters));
cfxExport("dbFindAll", (query: string, parameters = []) => readdb.all(query, ...parameters));
