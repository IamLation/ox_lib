import "./common";
import "database";
import "anticheese";

$DEBUG: {
  const lib = global.exports.ox_lib as any;

  on("userSessionStart", (playerId: number, userId: number) => {
    console.debug(`Player<${playerId}> has loaded User<${userId}>.`);
  });

  on("userSessionEnd", (playerId: number, userId: number) => {
    console.debug(`Player<${playerId}> has unloaded User<${userId}>.`);
  });

  on("characterLoaded", (playerId: number, userId: boolean, charId: number) => {
    console.debug(`User<${userId}> has loaded Character<${charId}>.`);

    const user = lib.getUserfromPlayerId(playerId);

    console.debug(user);
  });

  on("characterUnloaded", (playerId: number, userId: boolean, charId: number) => {
    console.debug(`User<${userId}> has unloaded Character<${charId}>.`);

    const user = lib.getUserfromPlayerId(playerId);

    console.debug(user);
  });
}
