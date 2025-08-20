import OpenAI from "openai";

/**
 * Simple moderation gate using OpenAI's Moderations API.
 * Returns { ok: boolean, reason?: string }
 */
export async function moderateOrBlock(text, client) {
  try {
    const oai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
    const res = await oai.moderations.create({
      model: "omni-moderation-latest",
      input: text || ""
    });
    const result = res.results?.[0];
    if (!result) return { ok: true };

    if (result.flagged) {
      return { ok: false, reason: "Message flagged by moderation." };
    }
    return { ok: true };
  } catch (e) {
    // Fail open but log — don't silently block all chats on moderation outages
    console.error("Moderation error:", e?.message || e);
    return { ok: true };
  }
}
