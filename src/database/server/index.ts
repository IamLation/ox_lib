import { sleep, waitFor } from "@overextended/ox_lib/common";
import "./sqlite";
import { User } from "../../classes/user/server";
import "framework";

on("playerJoining", async () => {
  const playerSource = String(source);

  await sleep(20000);

  const joined = await waitFor(() => {
    if (!DoesPlayerExist(playerSource)) return false;
    if (GetPlayerPed(playerSource)) return true;
  }, 500).catch(() => false);

  if (joined) User.fromPlayerId(+playerSource);
});

on("playerDropped", () => User.getOnline(+source)?.setOffline());

setTimeout(() => getPlayers().forEach((playerId) => User.fromPlayerId(+playerId).setCharacter(-1)), 500);
