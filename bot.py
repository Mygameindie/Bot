import discord
from discord.ext import commands
import openai
import os

# Load environment variables
TOKEN = os.getenv("DISCORD_TOKEN")
OPENAI_API_KEY = os.getenv("OPENAI_API_KEY")

# Set OpenAI API key
openai.api_key = OPENAI_API_KEY

# Bot setup
intents = discord.Intents.default()
intents.messages = True
bot = commands.Bot(command_prefix="!", intents=intents)

@bot.event
async def on_ready():
    print(f"We have logged in as {bot.user}")

@bot.command()
async def ask(ctx, *, question):
    try:
        response = openai.ChatCompletion.create(
            model="gpt-5",
            messages=[{"role": "user", "content": question}]
        )
        answer = response['choices'][0]['message']['content']
        await ctx.send(answer)
    except Exception as e:
        await ctx.send(f"Error: {str(e)}")

bot.run(TOKEN)
