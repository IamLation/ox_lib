import { uuid } from "@overextended/ox_lib/common/uuid";
import { Character } from "./character";
import { KvpStore } from "./kvp";
import { db } from "./sqlite";

const SV_LAN = GetConvarBool("SV_LAN", false);

function GetPlayerLicense(playerId: string) {
  const license = GetPlayerIdentifierByType(playerId, "license");

  if (license || !SV_LAN) return license;

  return `temp${GetHashKey(GetPlayerIdentifierByType(playerId, "ip")).toString(16).padStart(36, "0")}`;
}

export class User {
  static Kvp = new KvpStore("user");
  static Registry = new Map<number, User>();

  public id: number;
  public license: string;
  public playerId: number;
  public character?: Character;

  constructor(playerId: string | number) {
    playerId = +playerId;
    const license = GetPlayerLicense(playerId as any);

    if (!license) {
      throw new Error(`player:${playerId} has no valid license.`);
    }

    const { id } = db.get<{ id: number }>`
      INSERT INTO user (license, last_seen)
        VALUES (${license}, unixepoch())
      ON CONFLICT (license) DO
        UPDATE SET last_seen = unixepoch()
      RETURNING id
    `!;

    getPlayerTokens(playerId).forEach(
      (token) =>
        db.run`INSERT OR IGNORE INTO user_tokens (user_id, token, last_seen) VALUES (${this.id}, ${token}, unixepoch())`,
    );

    this.id = id;
    this.license = license;
    this.playerId = playerId;

    User.Registry.set(playerId, this);
  }

  set(key: string, value: any) {
    return User.Kvp.set(this.id, key, value);
  }

  get(...keys: string[]) {
    return User.Kvp.get(this.id, ...keys);
  }

  setCharacter(charId: number | string): Character | null {
    if (typeof charId === "string") {
      const buffer = Buffer.from(charId.replaceAll("-", ""), "hex");
      const id = (db.get`SELECT id FROM character WHERE uuid = ${buffer}`?.id as number) ?? this.addCharacter(charId);

      return this.setCharacter(id);
    } else if (charId === -1) {
      const id = db.get`SELECT id FROM character WHERE user_id = ${this.id} ORDER BY last_seen DESC LIMIT 1`
        ?.id as number;

      return this.setCharacter(id);
    }

    if (!charId) return this.setCharacter(this.addCharacter(uuid.generate()));

    const character = this.getCharacter(charId);

    if (!character) throw new Error(`user:${this.id} does not own character:${charId}.`);

    this.character = new Character(charId);

    return this.character;
  }

  getCharacter(charId: number) {
    return db.get`SELECT * FROM character WHERE user_id = ${this.id} AND id = ${charId}`;
  }

  getCharacters() {
    return db.all`SELECT * FROM character WHERE user_id = ${this.id}`;
  }

  addCharacter(uuid: string) {
    const buffer = Buffer.from(uuid.replaceAll("-", ""), "hex");
    return db.get`INSERT INTO character(user_id, uuid, last_seen) VALUES (${this.id}, ${buffer}, unixepoch()) RETURNING id`!
      .id as number;
  }
}
