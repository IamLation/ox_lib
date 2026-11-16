/**
 * Experimental user management for ox_lib
 * Currently intended for internal use only
 */

import "./sqlite";
import { User } from "./user";
import "framework";

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
