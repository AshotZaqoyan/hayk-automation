import { TelegramClient } from "telegram";
import { StringSession } from "telegram/sessions/index.js";
import fs from "fs-extra";
import path from "path";
import { fileURLToPath } from 'url';
import { addLog } from "./logger.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export const code = async (inputs) => {
  const botToken = inputs.bot_token;
  const chatId = inputs.TELEGRAM_USER_ID || 7407779466;

  const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

  const sendTelegram = async (text) => {
    try {
      const res = await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          chat_id: chatId,
          text: text,
          parse_mode: "Markdown",
          disable_web_page_preview: true
        })
      });
      return res.ok;
    } catch (e) {
      return false;
    }
  };

  try {
    const apiId = inputs.api_id;
    const apiHash = inputs.api_hash;
    const sessionString = inputs.session_string;
    const geminiApiKey = inputs.gemini_api_key;

    const configPath = path.join(__dirname, 'config.json');
    const config = await fs.readJson(configPath).catch(() => ({}));
    const channels = config.telegramChannels || [];

    if (!channels.length) return { matches: [] };

    const stringSession = new StringSession(sessionString);
    const client = new TelegramClient(stringSession, Number(apiId), apiHash, { connectionRetries: 5 });

    await client.connect();
    await addLog("Telegram", "info", `Սկսվեց ${channels.length} ալիքների ստուգումը`);

    const rawMessages = [];
    const now = Date.now();
    const timeLimit = 24 * 60 * 60 * 1000;

    for (const channel of channels) {
      try {
        const entity = await client.getEntity(channel);
        const messages = await client.getMessages(entity, { limit: 30 });
        for (const msg of messages) {
          if (msg.date && msg.message && (now - Number(msg.date) * 1000 <= timeLimit)) {
            rawMessages.push({ channel, id: msg.id, text: msg.message, date: new Date(Number(msg.date) * 1000) });
          }
        }
      } catch (e) {}
    }
    await client.disconnect();

    const terms = ["Когнитивная война", "CogWar", "операции влияния", "информационная война", "Психологические операции", "стратегическая коммуникация", "Повествование", "Социология", "Цивилизация", "Ноосфера", "Философия", "Китай", "Индия", "Армения", "Турция", "Азербайджан", "Иրան", "Израиль", "Психотерапевт", "Гибридная война", "аналитика"];

    const summarizeWithGemini = async (text, attempt = 1) => {
      try {
        const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-lite:generateContent?key=${geminiApiKey}`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ contents: [{ parts: [{ text: `Summarize in 2 sentences Russian: ${text}` }] }] })
        });
        const data = await response.json();
        if (data.error) {
            if (data.error.message.includes("high demand") && attempt < 3) {
                await sleep(2000 * attempt);
                return summarizeWithGemini(text, attempt + 1);
            }
            return "Gemini Error";
        }
        return data?.candidates?.[0]?.content?.parts?.[0]?.text?.trim() || "No summary";
      } catch (e) { return "Error"; }
    };

    const matches = [];
    // Process summaries sequentially for stability or small batches
    for (const msg of rawMessages) {
        const found = terms.find(t => msg.text.toLowerCase().includes(t.toLowerCase()));
        if (found) {
            const summary = await summarizeWithGemini(msg.text);
            const cid = String(msg.channel).replace("-100", "");
            matches.push({ summary, link: `https://t.me/c/${cid}/${msg.id}` });
        }
    }

    if (matches.length) {
      let current = "";
      for (const m of matches) {
        const block = `${m.summary}\n\n🔗 [Открыть пост](${m.link})\n\n---\n\n`;
        if ((current + block).length > 3500) {
            await sendTelegram(current.trim());
            current = block;
        } else { current += block; }
      }
      if (current) await sendTelegram(current.trim());
      await addLog("Telegram", "info", `Ստուգումն ավարտվեց (${matches.length} համընկնում)`);
    } else {
      await addLog("Telegram", "info", "Telegram: Համընկնումներ չկան");
    }
    return { matches };
  } catch (err) {
    await addLog("Telegram", "error", `Սխալ: ${err.message}`);
    return { error: err.message };
  }
};