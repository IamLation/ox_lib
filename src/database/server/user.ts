import { uuid } from "@overextended/ox_lib/common/uuid";
import { Character } from "./character";
import { KvpStore } from "./kvp";
import { prepare } from "./sqlite";

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

    const { id } = prepare(`
      INSERT INTO user (license, last_seen)
        VALUES (?, unixepoch())
      ON CONFLICT (license) DO
        UPDATE SET last_seen = unixepoch()
      RETURNING id
    `).get(license) as { id: number };

    getPlayerTokens(playerId).forEach((token) =>
      prepare(`INSERT OR IGNORE INTO user_tokens (user_id, token, last_seen) VALUES (?, ?, unixepoch())`).run(
        this.id,
        token,
      ),
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
    console.log("setting character", this.id, this.license, this.playerId, charId);
    if (typeof charId === "string") {
      const id =
        (prepare(`SELECT id FROM character WHERE uuid = ?`).get(Buffer.from(charId.replaceAll("-", ""), "hex"))
          ?.id as number) ?? this.addCharacter(charId);

      return this.setCharacter(id);
    } else if (charId === -1) {
      const id = prepare(`SELECT id FROM character WHERE user_id = ? ORDER BY last_seen DESC LIMIT 1`).get(this.id)
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
    return prepare(`SELECT * FROM character WHERE user_id = ? AND id = ?`).get(this.id, charId);
  }

  getCharacters() {
    return prepare(`SELECT * FROM character WHERE user_id = ?`).all(this.id);
  }

  addCharacter(uuid: string) {
    console.log("adding new user", uuid);
    return prepare(`INSERT INTO character(user_id, uuid, last_seen) VALUES (?, ?, unixepoch()) RETURNING id`).get(
      this.id,
      Buffer.from(uuid.replaceAll("-", ""), "hex"),
    )!.id! as number;
  }
}
