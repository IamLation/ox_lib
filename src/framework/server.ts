import { oxmysql } from "@overextended/oxmysql";
import { framework } from "./common";
import { User } from "../database/server/user";

const [USER_TABLE, IDENTIFIER_COLUMN] = framework.db;

export const SELECT_UUID = `SELECT uuid FROM \`${USER_TABLE}\` WHERE \`${IDENTIFIER_COLUMN}\` = ? LIMIT 1`;
export const UPDATE_UUID = `UPDATE \`${USER_TABLE}\` SET uuid = ? WHERE \`${IDENTIFIER_COLUMN}\` = ?`;

oxmysql.ready(async () => {
  if (!USER_TABLE) return;

  const column = await oxmysql.single(`SHOW COLUMNS FROM \`${USER_TABLE}\` WHERE Field = "uuid"`);

  if (column) return;

  oxmysql.query(`ALTER TABLE \`${USER_TABLE}\` ADD COLUMN \`uuid\` CHAR(36) NULL UNIQUE`);
});

on("esx:playerLoaded", (playerId: number, player: any) => User.fromFramework(playerId, player.identifier));
on("QBCore:Server:PlayerLoaded", ({ PlayerData }: any) => User.fromFramework(PlayerData.source, PlayerData.citizenid));
