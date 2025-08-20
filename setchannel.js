import { SlashCommandBuilder, ChannelType, PermissionFlagsBits } from "discord.js";
import fs from "node:fs";
import path from "node:path";

const settingsPath = path.resolve("data/settings.json");

const data = new SlashCommandBuilder()
  .setName("setchannel")
  .setDescription("Restrict /chat to a specific channel for this server.")
  .addChannelOption(opt => opt
    .setName("channel")
    .setDescription("Choose the allowed channel for /chat")
    .addChannelTypes(ChannelType.GuildText)
    .setRequired(true)
  )
  .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
  .setDMPermission(false);

async function execute(interaction) {
  const channel = interaction.options.getChannel("channel", true);

  if (!interaction.memberPermissions.has(PermissionFlagsBits.ManageGuild)) {
    return interaction.reply({ ephemeral: true, content: "❌ You need Manage Server permission." });
  }

  const guildId = interaction.guildId;
  let fileData = {};
  try {
    if (fs.existsSync(settingsPath)) {
      fileData = JSON.parse(fs.readFileSync(settingsPath, "utf8") || "{}");
    }
  } catch {}

  fileData[guildId] = { allowedChannelId: channel.id };
  fs.mkdirSync(path.dirname(settingsPath), { recursive: true });
  fs.writeFileSync(settingsPath, JSON.stringify(fileData, null, 2), "utf8");

  return interaction.reply({ ephemeral: true, content: `✅ /chat is now restricted to ${channel}.` });
}

export default { data, execute };
