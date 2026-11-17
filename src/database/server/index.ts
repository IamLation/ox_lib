import { sleep, waitFor } from "@overextended/ox_lib/common";
import "./sqlite";
import { User } from "./user";
import "framework";

on("playerJoining", async () => {
  const playerId = source as any;

  await sleep(20000);

  const joined = await waitFor(() => {
    if (!DoesPlayerExist(playerId)) return false;
    if (GetPlayerPed(playerId)) return true;
  }, 500);

  if (!joined) return;

  User.fromPlayerId(+source);
});

on("playerDropped", () => User.fromPlayerId(+source).setOffline());

setTimeout(() => getPlayers().forEach((playerId) => User.fromPlayerId(+playerId).setCharacter(-1)), 500);
