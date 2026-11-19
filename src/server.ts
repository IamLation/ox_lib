import "./common";
import "database";
import "anticheese";
import { RemoteClassConsumer } from "@overextended/ox_lib/common";

$DEBUG: {
  class User extends RemoteClassConsumer {
    declare readonly id: number;
    declare readonly say: (msg: string) => void;

    private constructor() {
      super();
    }

    static fromId(id: number) {
      return this.proxy(id, () => new User());
    }
  }

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
    user.say("hello there");
  });

  on("characterUnloaded", (playerId: number, userId: number, charId: number) => {
    console.debug(`User<${userId}> has unloaded Character<${charId}>.`);

    const user = User.fromId(userId);

    console.debug(user);
  });
}
