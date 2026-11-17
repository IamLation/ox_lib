import { db, decode, encode, type Row } from "./sqlite";

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

  public set(charId: number, key: string, value: any) {
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

  public get<T extends Row>(charId: number, ...keys: string[]) {
    const filter = keys.length ? ` AND key IN (${keys.map(() => "?").join(", ")})` : "";

    const { data } = db.get<{ data: string }>(
      `SELECT json_group_object(key, json(value)) AS data
     FROM ${this.table}
     WHERE ${this.id_col} = ?${filter}`,
      charId,
      ...keys,
    )!;

    return decode<T>(data);
  }
}
