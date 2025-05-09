# Discord OpenAI Bot

A Discord bot that uses OpenAI to generate responses to user messages.

## Setup

1. Clone this repo or download and unzip it.
2. Create a `.env` file with your keys (see `.env.example`).
3. Run `npm install` to install dependencies.
4. Start the bot with `npm start`.

### `.env` structure

```
OPENAI_API_KEY=your_openai_api_key
DISCORD_TOKEN=your_discord_bot_token
PORT=3000
```

## Deploying on Render/Railway

- Make sure `/health` is pinged regularly to keep the bot alive.
- Node.js version should be >= 18.