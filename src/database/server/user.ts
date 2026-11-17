import { uuid } from "@overextended/ox_lib/common/uuid";
import { Character } from "./character";
import { KvpStore } from "./kvp";
import { db, type UserRow, type CharacterRow } from "./sqlite";
import { createLRU } from "lru.min";

const SV_LAN = GetConvarBool("SV_LAN", false);

function GetPlayerLicense(playerId: string | number) {
  const license = GetPlayerIdentifierByType(playerId as string, "license");

  if (license) return license;

  if (SV_LAN) {
    const hash = GetHashKey(GetPlayerIdentifierByType(playerId as string, "ip"));
    return `temp${hash.toString(16).padStart(36, "0")}`;
  }

  throw new Error(`player:${playerId} has no valid license.`);
}

/**
 * A persistent account associated with a player's game license.
 */
export class User {
  private static cache = createLRU<string, User>({ max: 100 });
  private static active = new Map<string, User>();
  private static playerIds = new Map<number, User>();
  private static kvp = new KvpStore("user");

  static fromLicense(license: string) {
    return User.active.get(license) || User.cache.get(license) || new User(license);
  }

  static fromPlayerId(playerId: number) {
    return User.playerIds.get(playerId) || new User(GetPlayerLicense(playerId), playerId);
  }

  public id: number;
  public character?: Character;

  constructor(
    public license: string,
    public playerId?: number,
  ) {
    const { id } = db.get<UserRow>`
      INSERT INTO user (license, last_seen) VALUES (${license}, unixepoch())
      ON CONFLICT (license) DO UPDATE SET last_seen = unixepoch()
      RETURNING id
    `!;

    this.id = id;

    if (playerId) this.setOnline(playerId);
    else this.setOffline();
  }

  public setOnline(playerId: number) {
    this.playerId = playerId;

    User.cache.delete(this.license);
    User.active.set(this.license, this);
    User.playerIds.set(this.playerId, this);

    getPlayerTokens(playerId).forEach(
      (token) =>
        db.run`INSERT OR IGNORE INTO user_tokens (user_id, token, last_seen) VALUES (${this.id}, ${token}, unixepoch())`,
    );

    $DEBUG: console.debug(`Set User:${this.id} as online.`);
  }

  public setOffline() {
    if (!this.playerId) return;

    User.active.delete(this.license);
    User.playerIds.delete(this.playerId);

    $DEBUG: console.debug(`Set User:${this.id} as offline.`);
  }

  public set(key: string, value: any) {
    return User.kvp.set(this.id, key, value);
  }

  public get(...keys: string[]) {
    return User.kvp.get(this.id, ...keys);
  }

  public setCharacter(charId: number | string): Character | null {
    if (typeof charId === "string") {
      const id =
        (db.get`SELECT id FROM character WHERE uuid = uuid_to_blob(${charId})`?.id as number) ??
        this.addCharacter(charId);

      return this.setCharacter(id);
    } else if (charId === -1) {
      const id = db.get`SELECT id FROM character WHERE user_id = ${this.id} ORDER BY last_seen DESC LIMIT 1`
        ?.id as number;

      return this.setCharacter(id);
    }

    if (!charId) return this.setCharacter(this.addCharacter(uuid.generate()));

    const character = this.getCharacter(charId);

    if (!character) throw new Error(`user:${this.id} does not own character:${charId}.`);

    this.character = new Character(character.id, character.user_id, character.uuid);

    $DEBUG: console.debug(`Set Character:${character.id} (uuid: ${character.uuid}) as active for User:${this.id}.`);

    return this.character;
  }

  public getCharacter(charId: number) {
    return db.get<CharacterRow>`SELECT *, uuid_from_blob(uuid) as uuid FROM character WHERE user_id = ${this.id} AND id = ${charId}`;
  }

  public getCharacters() {
    return db.all<CharacterRow>`SELECT *, uuid_from_blob(uuid) as uuid FROM character WHERE user_id = ${this.id}`;
  }

  public addCharacter(uuid: string) {
    return db.get<CharacterRow>`INSERT INTO character(user_id, uuid, last_seen) VALUES (${this.id}, uuid_to_blob(${uuid}), unixepoch()) RETURNING id`!
      .id;
  }
}
