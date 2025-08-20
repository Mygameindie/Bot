# Discord + OpenAI Bot (Node.js, discord.js v14, Responses API)

## Quick start
1) Install Node.js 18+ (LTS recommended).
2) Create a bot in the [Discord Developer Portal], add a bot user, and copy its Token.
3) Rename `.env.example` to `.env` and fill in:
```
DISCORD_TOKEN=...your token...
OPENAI_API_KEY=...your OpenAI key...
OPENAI_MODEL=gpt-4o-mini
ALLOWED_CHANNEL_IDS= # optional comma-separated channel IDs
```
4) Install deps:
```
npm i
```
5) Register slash commands (run once, or whenever you change commands):
```
npm run register
```
6) Start:
```
npm start
```

## Commands
- `/chat prompt:<text>` — Chat with the model. Respects channel restrictions.
- `/setchannel channel:<#channel>` — Save/override the allowed channel for this guild.
  (Stores settings in `data/settings.json`).

## Notes
- Uses OpenAI **Responses API** via the official `openai` Node SDK.
- Includes a basic moderation check before sending content to the model.
- Add your own commands in `src/commands/` and register again.

