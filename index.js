import "dotenv/config";
import { Client, GatewayIntentBits, Collection, REST, Routes, Events } from "discord.js";
import { log, error } from "./utils/logger.js";
import fs from "node:fs";
import path from "node:path";

// Load commands dynamically
const commands = new Collection();
const commandsPath = path.resolve("src/commands");
for (const file of fs.readdirSync(commandsPath)) {
  if (!file.endsWith(".js")) continue;
  const { default: command } = await import(`./commands/${file}`);
  commands.set(command.data.name, command);
}

const client = new Client({
  intents: [GatewayIntentBits.Guilds]
});

client.once(Events.ClientReady, c => {
  log(`Logged in as ${c.user.tag}`);
});

client.on(Events.InteractionCreate, async interaction => {
  if (!interaction.isChatInputCommand()) return;
  const command = commands.get(interaction.commandName);
  if (!command) return;
  try {
    await command.execute(interaction);
  } catch (e) {
    error("Command error", e);
    const msg = String(e?.message || e);
    if (interaction.deferred || interaction.replied) {
      await interaction.editReply("❌ Command error: " + msg.slice(0, 1500));
    } else {
      await interaction.reply({ ephemeral: true, content: "❌ Command error." });
    }
  }
});

client.login(process.env.DISCORD_TOKEN);
