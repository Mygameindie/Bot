
require('dotenv').config();
const { Client, GatewayIntentBits } = require('discord.js');
const OpenAI = require('openai');

const client = new Client({
  intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages, GatewayIntentBits.MessageContent]
});

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

// Store conversations for each user
const conversations = new Map();

client.once('ready', () => {
  console.log(`Logged in as ${client.user.tag}`);
});

client.on('messageCreate', async (message) => {
  if (message.author.bot) return;

  // Initialize conversation for new users
  if (!conversations.has(message.author.id)) {
    conversations.set(message.author.id, [
      {
        role: "system",
        content: "You are a friendly and helpful AI assistant. Be concise but engaging in your responses."
      }
    ]);
  }

  const conversationHistory = conversations.get(message.author.id);
  
  // Add user's message to conversation history
  conversationHistory.push({
    role: "user",
    content: message.content
  });

  // Keep conversation history limited to prevent token overflow
  if (conversationHistory.length > 10) {
    // Keep system message and trim old messages
    const systemMessage = conversationHistory[0];
    conversationHistory.splice(1, conversationHistory.length - 6);
    conversationHistory[0] = systemMessage;
  }

  try {
    // Show typing indicator
    await message.channel.sendTyping();

    const response = await openai.chat.completions.create({
      model: "gpt-3.5-turbo",
      messages: conversationHistory,
      temperature: 0.7,
      max_tokens: 150
    });

    const reply = response.choices[0].message.content;
    
    // Add AI's response to conversation history
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

// Keep the web server running
const express = require('express');
const app = express();
app.get('/', (req, res) => res.send('Bot is running!'));
app.listen(3000, '0.0.0.0', () => console.log('Web server running on port 3000'));
