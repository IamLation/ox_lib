import { Remote, RemoteClassProvider } from "@overextended/ox_lib/index";
import { KvpStore } from "../../database/server/kvp";

/**
 * A persistent identity associated with a user. Multiple characters can exist for a single user.
 */
export class Character extends RemoteClassProvider {
  private static kvp = new KvpStore("character", "char_id");

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
