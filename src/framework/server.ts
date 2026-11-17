import { oxmysql } from "@overextended/oxmysql";
import { framework } from "./common";
import { uuid as UUID } from "@overextended/ox_lib/common/uuid";
import { User } from "../database/server/user";

const [USER_TABLE, IDENTIFIER_COLUMN] = framework.db;
const SELECT_UUID = `SELECT uuid FROM \`${USER_TABLE}\` WHERE \`${IDENTIFIER_COLUMN}\` = ? LIMIT 1`;
const UPDATE_UUID = `UPDATE \`${USER_TABLE}\` SET uuid = ? WHERE \`${IDENTIFIER_COLUMN}\` = ?`;

oxmysql.ready(async () => {
  if (!USER_TABLE) return;

  const column = await oxmysql.single(`SHOW COLUMNS FROM \`${USER_TABLE}\` WHERE Field = "uuid"`);

  if (column) return;

  oxmysql.query(`ALTER TABLE \`${USER_TABLE}\` ADD COLUMN \`uuid\` CHAR(36) NULL UNIQUE`);
});

async function loadUser(playerId: number, identifier: string | number) {
  await oxmysql.awaitConnection();

  const user = User.Registry.get(playerId);

  if (!user) return;

  let uuid: string | null = await oxmysql.scalar(SELECT_UUID, [identifier]);

  if (!uuid) {
    await oxmysql.update(UPDATE_UUID, [UUID.generate(), identifier]);
    uuid = await oxmysql.scalar(SELECT_UUID, [identifier]);
  }

  if (!uuid) return;

  user.setCharacter(uuid);
}

on("esx:playerLoaded", (playerId: number, player: any) => loadUser(playerId, player.identifier));
on("QBCore:Server:PlayerLoaded", ({ PlayerData }: any) => loadUser(PlayerData.source, PlayerData.citizenid));
