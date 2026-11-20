export * from '../common/remote-class';
import { RemoteClassConsumer } from '../common/remote-class';

type KvpSet = (key: string, value: any) => boolean;
type KvpGet = (...keys: string[]) => Record<string, unknown>;

export class User extends RemoteClassConsumer {
  static readonly resource = 'ox_lib';

  declare readonly id: number;
  declare readonly license: string;
  declare set: KvpSet;
  declare get: KvpGet;

  declare static getUserId: (playerId: number) => number;
}

export class Character extends RemoteClassConsumer {
  static readonly resource = 'ox_lib';

  declare readonly id: number;
  declare set: KvpSet;
  declare get: KvpGet;

  declare static getCharacterId: (playerId: number) => number;
}
