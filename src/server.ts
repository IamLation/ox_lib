import "./common";
import "database";
import "anticheese";
import "version";
import { User } from "@overextended/ox_lib/remote-class";
import { Player } from "@overextended/ox_lib/game/Player";

$DEBUG: {
  on("userSessionStart", (playerId: number, userId: number) => {
    console.debug(`Player<${playerId}> has loaded User<${userId}>.`);
  });

  on("userSessionEnd", (playerId: number, userId: number) => {
    console.debug(`Player<${playerId}> has unloaded User<${userId}>.`);
  });

  on("characterLoaded", (playerId: number, userId: number, charId: number) => {
    console.debug(`User<${userId}> has loaded Character<${charId}>.`);

    const player = Player.fromId(playerId);
    const user = player.getUser();

    console.debug(user);
  });

  on("characterUnloaded", (playerId: number, userId: number, charId: number) => {
    console.debug(`User<${userId}> has unloaded Character<${charId}>.`);

    const user = User.fromId(userId);

    console.debug(user);
  });
}
