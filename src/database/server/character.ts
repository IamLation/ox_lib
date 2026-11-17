import { KvpStore } from "./kvp";

/**
 * A persistent identity associated with a user. Multiple characters can exist for a single user.
 */
export class Character {
  private static kvp = new KvpStore("character", "char_id");

  constructor(
    readonly id: number,
    readonly userId: number,
    readonly uuid: string,
  ) {}

  set(key: string, value: any) {
    return Character.kvp.set(this.id, key, value);
  }

  get(...keys: string[]) {
    return Character.kvp.get(this.id, ...keys);
  }
}
