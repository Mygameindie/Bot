require('dotenv').config();
const { Client, GatewayIntentBits, EmbedBuilder } = require('discord.js');
const { OpenAI } = require('openai');
const express = require('express');
const rateLimit = require('express-rate-limit');

// Validate environment variables
const requiredEnvVars = ['OPENAI_API_KEY', 'DISCORD_TOKEN'];
const missingEnvVars = requiredEnvVars.filter(varName => !process.env[varName]);

if (missingEnvVars.length > 0) {
  console.error(`Missing required environment variables: ${missingEnvVars.join(', ')}`);
  process.exit(1);
}

// Discord client setup
const client = new Client({
  intents: [
    GatewayIntentBits.Guilds, 
    GatewayIntentBits.GuildMessages, 
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.DirectMessages
  ]
});

// OpenAI setup
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

// Bot configuration
const CONFIG = {
  prefix: process.env.BOT_PREFIX || '!',
  maxHistoryLength: parseInt(process.env.MAX_HISTORY_LENGTH || '10'),
  defaultModel: process.env.DEFAULT_MODEL || 'gpt-3.5-turbo',
  maxTokens: parseInt(process.env.MAX_TOKENS || '500'),
  temperature: parseFloat(process.env.TEMPERATURE || '0.7'),
  systemPrompt: process.env.SYSTEM_PROMPT || 
    "You are a friendly and helpful AI assistant. Be concise but engaging in your responses."
};

// Conversation memory - using Map for in-memory storage
// For production, consider using a database
const conversations = new Map();

// Command handlers
const commands = {
  help: async (message) => {
    const embed = new EmbedBuilder()
      .setColor(0x0099FF)
      .setTitle('Bot Commands')
      .setDescription('Here are the available commands:')
      .addFields(
        { name: `${CONFIG.prefix}help`, value: 'Show this help message' },
        { name: `${CONFIG.prefix}reset`, value: 'Reset your conversation history' },
        { name: `${CONFIG.prefix}model [model-name]`, value: 'Change the AI model (admins only)' },
        { name: 'Direct message', value: 'You can also chat with the bot in DMs!' }
      )
      .setFooter({ text: 'Just chat normally for AI responses' });
    
    await message.reply({ embeds: [embed] });
  },

  reset: async (message) => {
    if (conversations.has(message.author.id)) {
      initializeConversation(message.author.id);
      await message.reply("Conversation history has been reset!");
    }
  },

  model: async (message, args) => {
    // Admin-only command to change model
    if (!message.member?.permissions.has('ADMINISTRATOR')) {
      await message.reply("You need administrator permissions to change the model.");
      return;
    }

    if (!args[0]) {
      await message.reply(`Current model is: ${CONFIG.defaultModel}`);
      return;
    }

    const validModels = ['gpt-3.5-turbo', 'gpt-4', 'gpt-4-turbo'];
    if (!validModels.includes(args[0])) {
      await message.reply(`Invalid model. Available models: ${validModels.join(', ')}`);
      return;
    }

    CONFIG.defaultModel = args[0];
    await message.reply(`Model changed to ${CONFIG.defaultModel}`);
  }
};

function initializeConversation(userId) {
  conversations.set(userId, [
    {
      role: "system",
      content: CONFIG.systemPrompt
    }
  ]);
  return conversations.get(userId);
}

function getConversationHistory(userId) {
  if (!conversations.has(userId)) {
    return initializeConversation(userId);
  }
  return conversations.get(userId);
}

function trimConversationHistory(history) {
  if (history.length > CONFIG.maxHistoryLength) {
    const systemMessage = history[0];
    history.splice(1, history.length - CONFIG.maxHistoryLength);
    history[0] = systemMessage;
  }
  return history;
}

async function generateAIResponse(history, model = CONFIG.defaultModel) {
  try {
    const completion = await openai.chat.completions.create({
      model: model,
      messages: history,
      temperature: CONFIG.temperature,
      max_tokens: CONFIG.maxTokens
    });

    return completion.choices[0].message.content;
  } catch (error) {
    console.error('OpenAI API Error:', error.response?.data || error.message);
    throw new Error(`OpenAI API Error: ${error.message}`);
  }
}

// Event handlers
client.once('ready', () => {
  console.log(`Logged in as ${client.user.tag}`);
  client.user.setActivity(`${CONFIG.prefix}help for commands`);
});

client.on('messageCreate', async (message) => {
  // Ignore messages from bots
  if (message.author.bot) return;

  // Process direct messages
  if (message.channel.type === 'DM') {
    await handleAIResponse(message);
    return;
  }

  // Check if it's a command or mention
  if (message.content.startsWith(CONFIG.prefix)) {
    const [commandName, ...args] = message.content
      .slice(CONFIG.prefix.length)
      .trim()
      .split(/\s+/);
    
    const command = commands[commandName];
    if (command) {
      await command(message, args);
      return;
    }
  }

  // Check if the bot is mentioned or replied to
  const isMentioned = message.mentions.users.has(client.user.id);
  const isReply = message.reference?.messageId && 
                  (await message.channel.messages.fetch(message.reference.messageId))
                  .author.id === client.user.id;

  if (isMentioned || isReply) {
    await handleAIResponse(message);
  }
});

async function handleAIResponse(message) {
  try {
    // Send typing indicator
    await message.channel.sendTyping();
    
    // Get or initialize conversation history
    const conversationHistory = getConversationHistory(message.author.id);
    
    // Add user message to history
    conversationHistory.push({
      role: "user",
      content: message.content
        .replace(new RegExp(`<@!?${client.user.id}>`, 'g'), '') // Remove mentions
        .trim()
    });
    
    // Trim history if needed
    trimConversationHistory(conversationHistory);
    
    // Generate AI response
    const reply = await generateAIResponse(conversationHistory);
    
    // Add assistant response to history
    conversationHistory.push({
      role: "assistant",
      content: reply
    });
    
    // Split long messages if needed
    if (reply.length <= 2000) {
      await message.reply(reply);
    } else {
      const chunks = splitMessage(reply);
      for (const chunk of chunks) {
        await message.channel.send(chunk);
      }
    }
  } catch (error) {
    console.error('Error handling message:', error);
    await message.reply("I encountered an error processing your message. Please try again later.");
  }
}

// Split long messages for Discord's 2000 character limit
function splitMessage(text, maxLength = 1900) {
  const chunks = [];
  let currentChunk = '';
  
  const lines = text.split('\n');
  
  for (const line of lines) {
    if (currentChunk.length + line.length + 1 > maxLength) {
      chunks.push(currentChunk);
      currentChunk = line;
    } else {
      currentChunk += (currentChunk ? '\n' : '') + line;
    }
  }
  
  if (currentChunk) {
    chunks.push(currentChunk);
  }
  
  return chunks;
}

// Set up error handling
client.on('error', (error) => {
  console.error('Discord Client Error:', error);
});

process.on('unhandledRejection', (error) => {
  console.error('Unhandled promise rejection:', error);
});

// Express server setup for health checks and uptime monitoring
const app = express();

// Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100,                 // Limit each IP to 100 requests per windowMs
  standardHeaders: true,    // Return rate limit info in the `RateLimit-*` headers
  legacyHeaders: false,     // Disable the `X-RateLimit-*` headers
});

app.use(limiter);

// Health check endpoint
app.get('/health', (req, res) => {
  const status = {
    status: 'ok',
    timestamp: new Date().toISOString(),
    discord: client.ws.status === 0 ? 'connected' : 'disconnected',
    uptime: process.uptime(),
    botVersion: '1.0.0'
  };
  res.status(200).json(status);
});

// Start the web server
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Web server running on port ${PORT}`));

// Login to Discord
client.login(process.env.DISCORD_TOKEN)
  .catch(error => {
    console.error('Failed to login to Discord:', error);
    process.exit(1);
  });