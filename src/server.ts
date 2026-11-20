import "./common";
import "database";
import "anticheese";
import "version";
import { User } from "@overextended/ox_lib/remote-class";

$DEBUG: {
  on("userSessionStart", (playerId: number, userId: number) => {
    console.debug(`Player<${playerId}> has loaded User<${userId}>.`);
  });

  on("userSessionEnd", (playerId: number, userId: number) => {
    console.debug(`Player<${playerId}> has unloaded User<${userId}>.`);
  });

  on("characterLoaded", (playerId: number, userId: number, charId: number) => {
    console.debug(`User<${userId}> has loaded Character<${charId}>.`);

    const user = User.fromId(userId);

    console.debug(user);
  });

  on("characterUnloaded", (playerId: number, userId: number, charId: number) => {
    console.debug(`User<${userId}> has unloaded Character<${charId}>.`);

    const user = User.fromId(userId);

    console.debug(user);
  });
}
