require('dotenv').config();
const { Client, GatewayIntentBits } = require('discord.js');
const { OpenAI } = require('openai');
const express = require('express');

// Validate environment variables
if (!process.env.OPENAI_API_KEY || !process.env.DISCORD_TOKEN) {
  console.error("Missing required environment variables: OPENAI_API_KEY or DISCORD_TOKEN");
  process.exit(1);
}

// Discord client setup
const client = new Client({
  intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages, GatewayIntentBits.MessageContent]
});

// OpenAI setup
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

// Conversation memory
const conversations = new Map();

client.once('ready', () => {
  console.log(`Logged in as ${client.user.tag}`);
});

client.on('messageCreate', async (message) => {
  if (message.author.bot) return;

  if (!conversations.has(message.author.id)) {
    conversations.set(message.author.id, [
      {
        role: "system",
        content: "You are a friendly and helpful AI assistant. Be concise but engaging in your responses."
      }
    ]);
  }

  const conversationHistory = conversations.get(message.author.id);

  conversationHistory.push({
    role: "user",
    content: message.content
  });

  if (conversationHistory.length > 10) {
    const systemMessage = conversationHistory.shift();
    conversationHistory.splice(0, conversationHistory.length - 9);
    conversationHistory.unshift(systemMessage);
  }

  try {
    await message.channel.sendTyping();

    const completion = await openai.chat.completions.create({
      model: "gpt-3.5-turbo",
      messages: conversationHistory,
      temperature: 0.7,
      max_tokens: 150
    });

    const reply = completion.choices[0].message.content;

    conversationHistory.push({
      role: "assistant",
      content: reply
    });

    await message.reply(reply);
  } catch (error) {
    console.error('OpenAI API Error:', error.response?.data || error.message);
    await message.reply("I encountered an error processing your message. Please try again later.");
  }
});

client.on('error', (error) => console.error('Discord Client Error:', error));

const app = express();
app.get('/health', (req, res) => res.status(200).json({ status: 'ok' }));
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Web server running on port ${PORT}`));

client.login(process.env.DISCORD_TOKEN);