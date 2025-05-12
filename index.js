require('dotenv').config();
const { Client, GatewayIntentBits, EmbedBuilder } = require('discord.js');
const { OpenAI } = require('openai');
const express = require('express');
const rateLimit = require('express-rate-limit');

// Validate required environment variables
const REQUIRED_ENV_VARS = ['OPENAI_API_KEY', 'DISCORD_TOKEN'];
const missingVars = REQUIRED_ENV_VARS.filter(key => !process.env[key]);
if (missingVars.length) {
  console.error(`Missing environment variables: ${missingVars.join(', ')}`);
  process.exit(1);
}

// Discord client
const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.DirectMessages,
  ]
});

// OpenAI setup
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

// Bot configuration
const CONFIG = {
  prefix: process.env.BOT_PREFIX || '!',
  maxHistoryLength: parseInt(process.env.MAX_HISTORY_LENGTH || '10'),
  defaultModel: process.env.DEFAULT_MODEL || 'gpt-3.5-turbo',
  maxTokens: parseInt(process.env.MAX_TOKENS || '500'),
  temperature: parseFloat(process.env.TEMPERATURE || '0.7'),
  systemPrompt: process.env.SYSTEM_PROMPT || "You are a friendly and helpful AI assistant. Be concise but engaging."
};

// In-memory conversation storage
const conversations = new Map();

// Command handlers
const commands = {
  help: async (msg) => {
    const embed = new EmbedBuilder()
      .setColor(0x0099FF)
      .setTitle('Bot Commands')
      .addFields(
        { name: `${CONFIG.prefix}help`, value: 'Show this help message' },
        { name: `${CONFIG.prefix}reset`, value: 'Reset your conversation history' },
        { name: `${CONFIG.prefix}model [model]`, value: 'Change the AI model (admin only)' }
      )
      .setFooter({ text: 'Chat normally for AI replies' });
    await msg.reply({ embeds: [embed] });
  },

  reset: async (msg) => {
    initializeConversation(msg.author.id);
    await msg.reply("Conversation history reset!");
  },

  model: async (msg, args) => {
    if (!msg.member?.permissions.has('ADMINISTRATOR')) {
      return msg.reply("Only admins can change the model.");
    }

    const model = args[0];
    const validModels = ['gpt-3.5-turbo', 'gpt-4', 'gpt-4-turbo'];

    if (!model) {
      return msg.reply(`Current model: ${CONFIG.defaultModel}`);
    }

    if (!validModels.includes(model)) {
      return msg.reply(`Invalid model. Options: ${validModels.join(', ')}`);
    }

    CONFIG.defaultModel = model;
    await msg.reply(`Model updated to ${model}`);
  }
};

// Helpers
function initializeConversation(userId) {
  conversations.set(userId, [{ role: 'system', content: CONFIG.systemPrompt }]);
}

function getHistory(userId) {
  if (!conversations.has(userId)) initializeConversation(userId);
  return conversations.get(userId);
}

function trimHistory(history) {
  if (history.length > CONFIG.maxHistoryLength) {
    const systemMsg = history[0];
    history.splice(1, history.length - CONFIG.maxHistoryLength);
    history[0] = systemMsg;
  }
  return history;
}

async function generateAIResponse(history, model = CONFIG.defaultModel) {
  const completion = await openai.chat.completions.create({
    model,
    messages: history,
    temperature: CONFIG.temperature,
    max_tokens: CONFIG.maxTokens
  });
  return completion.choices[0].message.content;
}

function splitMessage(text, max = 1900) {
  const chunks = [];
  let chunk = '';
  for (const line of text.split('\n')) {
    if ((chunk + line).length > max) {
      chunks.push(chunk);
      chunk = line;
    } else {
      chunk += (chunk ? '\n' : '') + line;
    }
  }
  if (chunk) chunks.push(chunk);
  return chunks;
}

// Discord Events
client.once('ready', () => {
  console.log(`Logged in as ${client.user.tag}`);
  client.user.setActivity(`${CONFIG.prefix}help for commands`);
});

client.on('messageCreate', async (msg) => {
  if (msg.author.bot) return;

  if (msg.channel.type === 'DM') return handleAI(msg);

  if (msg.content.startsWith(CONFIG.prefix)) {
    const [cmd, ...args] = msg.content.slice(CONFIG.prefix.length).trim().split(/\s+/);
    if (commands[cmd]) return commands[cmd](msg, args);
  }

  const isMentioned = msg.mentions.users.has(client.user.id);
  const isReply = msg.reference?.messageId && (await msg.channel.messages.fetch(msg.reference.messageId)).author.id === client.user.id;

  if (isMentioned || isReply) handleAI(msg);
});

async function handleAI(msg) {
  try {
    await msg.channel.sendTyping();
    const history = getHistory(msg.author.id);
    history.push({ role: "user", content: msg.content.replace(new RegExp(`<@!?${client.user.id}>`, 'g'), '').trim() });
    trimHistory(history);

    const reply = await generateAIResponse(history);
    history.push({ role: "assistant", content: reply });

    if (reply.length <= 2000) {
      await msg.reply(reply);
    } else {
      for (const chunk of splitMessage(reply)) {
        await msg.channel.send(chunk);
      }
    }
  } catch (err) {
    console.error('AI Error:', err);
    await msg.reply("An error occurred. Try again later.");
  }
}

// Error handlers
client.on('error', (err) => console.error('Discord Error:', err));
process.on('unhandledRejection', (err) => console.error('Unhandled Rejection:', err));

// Web server for health check
const app = express();
app.use(rateLimit({ windowMs: 15 * 60 * 1000, max: 100 }));
app.get('/health', (req, res) => res.status(200).json({
  status: 'ok',
  discord: client.ws.status === 0 ? 'connected' : 'disconnected',
  uptime: process.uptime(),
  version: '1.0.0',
  timestamp: new Date().toISOString()
}));
app.listen(process.env.PORT || 3000, () => console.log('Web server ready.'));

// Login
client.login(process.env.DISCORD_TOKEN).catch(err => {
  console.error('Login failed:', err);
  process.exit(1);
});