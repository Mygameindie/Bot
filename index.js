require('dotenv').config();
const { Client, GatewayIntentBits } = require('discord.js');
const OpenAI = require('openai');
const express = require('express');

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

  // Create conversation if new user
  if (!conversations.has(message.author.id)) {
    conversations.set(message.author.id, [
      {
        role: "system",
        content: "You are a friendly and helpful AI assistant. Be concise but engaging in your responses."
      }
    ]);
  }

  const conversationHistory = conversations.get(message.author.id);

  // Add user message
  conversationHistory.push({
    role: "user",
    content: message.content
  });

  // Trim conversation if too long
  if (conversationHistory.length > 10) {
    const systemMessage = conversationHistory[0];
    conversationHistory.splice(1, conversationHistory.length - 6);
    conversationHistory[0] = systemMessage;
  }

  try {
    await message.channel.sendTyping();

    const response = await openai.chat.completions.create({
      model: "gpt-3.5-turbo",
      messages: conversationHistory,
      temperature: 0.7,
      max_tokens: 150
    });

    const reply = response.choices[0].message.content;

    // Add assistant reply
    conversationHistory.push({
      role: "assistant",
      content: reply
    });

    await message.reply(reply);
  } catch (error) {
    console.error('OpenAI API Error:', error);
    await message.reply("I encountered an error processing your message. Please try again.");
  }
});

client.login(process.env.DISCORD_TOKEN);

// Optional: Web server for uptime check (Render/Railway ping)
const app = express();
app.get('/', (req, res) => res.send('Bot is running!'));
app.listen(3000, () => console.log('Web server running on port 3000'));
