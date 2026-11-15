/**
 * Experimental user management for ox_lib
 * Currently intended for internal use only
 * Note: Resource internals (including this) need to be rewritten into TS eventually (v4?)
 */

import { cfxExport } from "@overextended/ox_lib/common/exports";
import { dbr } from "./sqlite";
import { User } from "./user";
import "framework";

cfxExport("dbFindOne", (query = "", parameters = []) => dbr.prepare(query).get(parameters));
cfxExport("dbFindAll", (query = "", parameters = []) => dbr.prepare(query).all(parameters));

on("playerJoining", () => new User(source));
on("playerDropped", () => User.Registry.delete(source));

setTimeout(
  () =>
    getPlayers().forEach((playerId) => {
      const user = new User(+playerId);
      user.setCharacter(-1);
    }),
  100,
);
