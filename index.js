require('dotenv').config();
const { Client, GatewayIntentBits } = require('discord.js');
const OpenAI = require('openai');
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

  // Trim conversation history
  if (conversationHistory.length > 10) {
    const systemMessage = conversationHistory.shift(); // Keep the system message
    conversationHistory.splice(0, conversationHistory.length - 9); // Keep the last 9 messages
    conversationHistory.unshift(systemMessage); // Add the system message back
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
    console.error('OpenAI API Error:', error.response?.data || error.message);
    await message.reply("I encountered an error processing your message. Please try again later.");
  }
});

client.on('error', (error) => console.error('Discord Client Error:', error));

// Optional: Web server for uptime check (Render/Railway ping)
const app = express();
app.get('/health', (req, res) => res.status(200).json({ status: 'ok' }));
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Web server running on port ${PORT}`));

// Login to Discord
client.login(process.env.DISCORD_TOKEN);