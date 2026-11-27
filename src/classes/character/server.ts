import { Remote, RemoteClassProvider } from "@overextended/ox_lib/index";
import { KvpStore } from "../../database/server/kvp";
import { db, type CharacterRow } from "../../database/server/sqlite";

/**
 * A persistent identity associated with a user. Multiple characters can exist for a single user.
 */
export class Character extends RemoteClassProvider {
  private static kvp = new KvpStore("character", "char_id");

  static override fromId(id: string | number) {
    const charId = Number(id);

    if (!Number.isSafeInteger(charId) || charId < 1) throw new Error(`Invalid Character identifier '${id}'.`);

    const cached = Character.getCached(charId);

    if (cached) return cached;

    const row = db.get<CharacterRow>`
      SELECT id, user_id, uuid_from_blob(uuid) AS uuid FROM character WHERE id = ${charId}
    `;

    if (!row) return;

    return Character.intern(charId, () => new Character(row.id, row.user_id, row.uuid));
  }

  @Remote("id")
  public readonly id: number;
  @Remote
  public readonly userId: number;
  @Remote
  public readonly uuid: string;

  constructor(id: number, userId: number, uuid: string) {
    super();
    this.id = id;
    this.userId = userId;
    this.uuid = uuid;
  }

  @Remote
  set(key: string, value: any) {
    return Character.kvp.set(this.id, key, value);
  }

  @Remote
  get(...keys: string[]) {
    return Character.kvp.get(this.id, ...keys);
  }
}

Character.register();
