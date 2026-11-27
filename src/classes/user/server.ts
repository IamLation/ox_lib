import { uuid as UUID } from "@overextended/ox_lib/uuid";
import { Character } from "../character/server";
import { KvpStore } from "../../database/server/kvp";
import { db, type UserRow, type CharacterRow } from "../../database/server/sqlite";
import { SELECT_UUID, UPDATE_UUID } from "framework";
import { oxmysql } from "@overextended/oxmysql";
import { framework } from "framework/common";
import { Player, Remote, RemoteClassProvider } from "@overextended/ox_lib/index";

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
export class User extends RemoteClassProvider {
  private static active = new Map<string, User>();
  private static playerIds = new Map<number, User>();
  private static kvp = new KvpStore("user");

  static override fromId(id: string | number) {
    const userId = Number(id);

    if (!Number.isSafeInteger(userId) || userId < 1) throw new Error(`Invalid User identifier '${id}'.`);

    const user = User.getCached(userId);

    if (user) return user;

    const license = db.get<{ license: string }>`
      SELECT license FROM user WHERE id = ${userId}
    `?.license;

    if (!license) throw new Error(`User<${id}> does not exist.`);

    return User.load(license);
  }

  static fromLicense(license: string) {
    const active = User.active.get(license);

    if (active) return active;

    const id = db.get<{ id: number }>`SELECT id FROM user WHERE license = ${license}`?.id;

    return (id === undefined ? undefined : User.getCached(id)) ?? User.load(license);
  }

  private static load(license: string) {
    const { id } = db.get<UserRow>`
      INSERT INTO user (license, last_seen) VALUES (${license}, unixepoch())
      ON CONFLICT (license) DO UPDATE SET last_seen = unixepoch()
      RETURNING id
    `!;

    return User.intern(id, () => new User(license, id));
  }

  static fromPlayerId(playerId: number) {
    if (!Number.isSafeInteger(playerId) || playerId < 1) throw new Error(`Invalid player ID '${playerId}'.`);

    const online = User.getOnline(playerId);

    if (online) return online;

    const user = User.fromLicense(GetPlayerLicense(playerId));
    user.setOnline(playerId);
    return user;
  }

  static getOnline(playerId: number) {
    return User.playerIds.get(playerId);
  }

  static async fromFramework(playerId: number, identifier: string | number) {
    const user = User.fromPlayerId(playerId);

    await oxmysql.awaitConnection();
    if (User.getOnline(playerId) !== user) return;

    let uuid: string | null = await oxmysql.scalar(SELECT_UUID, [identifier]);
    if (User.getOnline(playerId) !== user) return;

    if (!uuid) {
      await oxmysql.update(UPDATE_UUID, [UUID.generate(), identifier]);
      uuid = await oxmysql.scalar(SELECT_UUID, [identifier]);

      $DEBUG: console.debug(`Generated UUID ${uuid} for ${framework.name} character (${identifier}).`);
    }

    if (!uuid || User.getOnline(playerId) !== user) return;

    user.setCharacter(uuid);
  }

  @Remote("id")
  public readonly id: number;
  @Remote
  public readonly license: string;
  public character?: Character;
  public playerId?: number;

  private constructor(license: string, id: number) {
    super();
    this.id = id;
    this.license = license;
  }

  public setOnline(playerId: number) {
    if (!Number.isSafeInteger(playerId) || playerId < 1) throw new Error(`Invalid player ID '${playerId}'.`);
    if (this.playerId === playerId) return;

    getPlayerTokens(playerId).forEach(
      (token) =>
        db.run`INSERT OR IGNORE INTO user_tokens (user_id, token, last_seen) VALUES (${this.id}, ${token}, unixepoch())`,
    );

    const player = Player.fromId(playerId);

    this.setOffline();
    const previous = User.getOnline(playerId);
    if (previous !== this) previous?.setOffline();

    if (this.playerId === playerId) return;
    if (this.playerId !== undefined || User.getOnline(playerId)) {
      throw new Error(`Session changed while setting User<${this.id}> online for player ${playerId}.`);
    }

    this.playerId = playerId;
    User.active.set(this.license, this);
    User.playerIds.set(playerId, this);

    void player.setr("userId", this.id).catch(console.error);

    if (User.getOnline(playerId) === this) emit("userSessionStart", playerId, this.id);
  }

  public setOffline() {
    const { playerId, character } = this;

    if (playerId === undefined) return;

    delete this.playerId;
    delete this.character;
    if (User.active.get(this.license) === this) User.active.delete(this.license);
    if (User.getOnline(playerId) === this) User.playerIds.delete(playerId);

    if (character) emit("characterUnloaded", playerId, this.id, character.id);

    emit("userSessionEnd", playerId, this.id);
  }

  @Remote
  public set(key: string, value: any) {
    return User.kvp.set(this.id, key, value);
  }

  @Remote
  public get(...keys: string[]) {
    return User.kvp.get(this.id, ...keys);
  }

  public setCharacter(charId: number | string | null): Character | null {
    if (!this.playerId) throw new Error(`Cannot set character for offline users.`);

    if (!charId) {
      const character = this.character;

      if (!character) return null;

      delete this.character;
      emit("characterUnloaded", this.playerId, this.id, character.id);

      return null;
    } else if (typeof charId === "string") {
      const id =
        (db.get`SELECT id FROM character WHERE uuid = uuid_to_blob(${charId})`?.id as number) ??
        this.addCharacter(charId);

      return this.setCharacter(id);
    } else if (charId === -1) {
      const id = db.get`SELECT id FROM character WHERE user_id = ${this.id} ORDER BY last_seen DESC LIMIT 1`
        ?.id as number;

      return this.setCharacter(id);
    }

    if (!charId) return this.setCharacter(this.addCharacter(UUID.generate()));

    const character = this.getCharacter(charId);

    if (!character) throw new Error(`User<${this.id}> does not own Character<${charId}>.`);

    const player = Player.fromId(this.playerId);
    const instance = new Character(character.id, character.user_id, character.uuid);
    this.character = instance;

    void player.sets("uuid", character.uuid).catch(console.error);
    void player.setr("charId", character.id).catch(console.error);

    emit("characterLoaded", this.playerId, this.id, character.id);

    return instance;
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

User.register();
