import "dotenv/config";
import fs from "node:fs";
import path from "node:path";
import { REST, Routes } from "discord.js";

const commandsDir = path.resolve("src/commands");
const commandDatas = [];

for (const file of fs.readdirSync(commandsDir)) {
  if (!file.endsWith(".js")) continue;
  const { default: command } = await import(`./commands/${file}`);
  commandDatas.push(command.data.toJSON());
}

const rest = new REST({ version: "10" }).setToken(process.env.DISCORD_TOKEN);

try {
  if (!process.env.APPLICATION_ID) {
    throw new Error("Missing APPLICATION_ID in env. Set it to your Discord application's ID.");
  }
  console.log("Registering slash commands globally...");
  await rest.put(Routes.applicationCommands(process.env.APPLICATION_ID), { body: commandDatas });
  console.log("✅ Slash commands registered.");
} catch (e) {
  console.error("Failed to register commands:", e);
  process.exit(1);
}
