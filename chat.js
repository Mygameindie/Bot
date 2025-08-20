import { SlashCommandBuilder, ChannelType, PermissionFlagsBits } from "discord.js";
import OpenAI from "openai";
import { moderateOrBlock } from "../utils/moderate.js";
import { log, error } from "../utils/logger.js";
import fs from "node:fs";
import path from "node:path";

const settingsPath = path.resolve("data/settings.json");

const data = new SlashCommandBuilder()
  .setName("chat")
  .setDescription("Chat with OpenAI in-channel.")
  .addStringOption(opt => opt
    .setName("prompt")
    .setDescription("What do you want to say?")
    .setRequired(true)
  )
  .setDMPermission(false);

async function execute(interaction) {
  const prompt = interaction.options.getString("prompt", true);

  // Load per-guild channel restriction if any
  let allowedChannelIds = (process.env.ALLOWED_CHANNEL_IDS || "").split(",").map(s => s.trim()).filter(Boolean);
  try {
    if (fs.existsSync(settingsPath)) {
      const raw = JSON.parse(fs.readFileSync(settingsPath, "utf8") || "{}");
      const guildAllowed = raw[interaction.guildId]?.allowedChannelId;
      if (guildAllowed) allowedChannelIds = Array.from(new Set([ ...allowedChannelIds, guildAllowed ]));
    }
  } catch (e) {
    error("Failed to read settings.json", e);
  }

  // Enforce channel whitelist if provided
  if (allowedChannelIds.length > 0 && !allowedChannelIds.includes(interaction.channelId)) {
    return interaction.reply({ ephemeral: true, content: "❌ This command is not allowed in this channel." });
  }

  await interaction.deferReply();

  // Basic moderation
  const mod = await moderateOrBlock(prompt);
  if (!mod.ok) {
    return interaction.editReply("⚠️ Your message was flagged by moderation.");
  }

  try {
    const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
    const model = process.env.OPENAI_MODEL || "gpt-4o-mini";

    const response = await client.responses.create({
      model,
      input: [
        { role: "system", content: "You are a helpful Discord bot. Keep answers concise." },
        { role: "user", content: prompt }
      ]
    });

    const reply = response.output_text?.trim() || "*(No output)*";
    // Discord limit safety
    const MAX = 1900;
    const chunks = reply.match(/.{1,1900}(
|$)/gs) || [reply];

    // Stream chunks
    let first = true;
    for (const c of chunks) {
      if (first) {
        await interaction.editReply(c);
        first = false;
      } else {
        await interaction.followUp(c);
      }
    }
  } catch (e) {
    error("OpenAI error", e);
    const msg = String(e?.message || e);
    await interaction.editReply("❌ Error talking to OpenAI: " + msg.slice(0, 1500));
  }
}

export default { data, execute };
