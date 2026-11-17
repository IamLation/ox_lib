import "./sqlite";
import { User } from "./user";
import "framework";

on("playerJoining", () => User.fromPlayerId(+source));
on("playerDropped", () => User.fromPlayerId(+source).setOffline());

setTimeout(() => getPlayers().forEach((playerId) => User.fromPlayerId(+playerId).setCharacter(-1)), 500);
