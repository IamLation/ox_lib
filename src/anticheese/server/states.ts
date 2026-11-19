/**
 * Removes players from the server if server-set only states are modified by the client.
 *
 * For servers not using `sv_stateBagStrictMode true`.
 */
function validateEntityState(bag: string, key: string, value: unknown, reserved: number, replicated: boolean) {
  if (!replicated) return;

  const playerId = bag.startsWith("player:")
    ? GetPlayerFromStateBagName(bag)
    : NetworkGetEntityOwner(GetEntityFromStateBagName(bag));

  if (!playerId) return;

  if (reserved) {
    const msg = "Attempted to set invalid state.";

    console.warn(`Dropping ${playerId} from server - ${msg.toLowerCase()}\n  - ${bag}.${key} = ${value}`);
    DropPlayer(playerId as any, msg);
  }
}

AddStateBagChangeHandler("uuid", "", validateEntityState);
AddStateBagChangeHandler("userId", "", validateEntityState);
AddStateBagChangeHandler("charId", "", validateEntityState);
