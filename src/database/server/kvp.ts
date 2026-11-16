import { db, decode, encode } from "./sqlite";

export class KvpStore {
  public table: string;
  public id_col: string;

  constructor(table: string, id_col = `${table}_id`) {
    this.table = `${table}_kvp`;
    this.id_col = id_col;

    db.exec(`
      CREATE TABLE IF NOT EXISTS "${this.table}"(
        "${this.id_col}" INTEGER NOT NULL,
        "key" TEXT NOT NULL,
        "value" TEXT NOT NULL,
        PRIMARY KEY("${this.id_col}", "key"),
        FOREIGN KEY("${this.id_col}") REFERENCES "${table}"("id")
          ON UPDATE CASCADE
          ON DELETE CASCADE
      );
    `);
  }

  set(charId: number, key: string, value: any) {
    return (
      db.run(
        `
        INSERT INTO ${this.table} (${this.id_col}, key, value)
          VALUES (?, ?, ?)
        ON CONFLICT (${this.id_col}, key) DO
          UPDATE SET value = excluded.value;
    `,
        charId,
        key,
        encode(value),
      )?.changes > 0
    );
  }

  get(charId: number, ...keys: string[]) {
    const placeholders = keys.map(() => "?").join(", ");

    return db
      .all<{ key: string; value: any }>(
        `SELECT key, value FROM ${this.table} WHERE ${this.id_col} = ? AND key IN (${placeholders})`,
        charId,
        ...keys,
      )
      .reduce(
        (acc, { key, value }) => {
          acc[key] = decode(value);
          return acc;
        },
        {} as Record<string, any>,
      );
  }
}
