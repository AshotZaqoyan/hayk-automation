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
      if (!res.ok) {
        throw new Error(`Telegram API Error: ${res.status}`);
      }
      return true;
    } catch (e) {
      await addLog("Telegram", "error", `Չհաջողվեց հաղորդագրություն ուղարկել Telegram: ${e.message}`);
      return false;
    }
  };

  try {
    const apiId = inputs.api_id;
    const apiHash = inputs.api_hash;
    const sessionString = inputs.session_string;
    const geminiApiKey = inputs.gemini_api_key;

    if (!apiId || !apiHash || !sessionString) {
      throw new Error(`Անվավեր տվյալներ API-ի համար: apiId:${!!apiId}, apiHash:${!!apiHash}, session:${!!sessionString}`);
    }
    if (!geminiApiKey) throw new Error("Բացակայում է Gemini API Key-ը");
    if (!botToken) throw new Error("Բացակայում է բոտի տոկենը");

    const configPath = path.join(__dirname, 'config.json');
    const config = await fs.readJson(configPath);
    const channels = config.telegramChannels;

    if (!channels || channels.length === 0) {
      await addLog("Telegram", "warning", "Ստուգելու համար ալիքներ չկան");
      return { matches: [] };
    }

    const stringSession = new StringSession(sessionString);
    const client = new TelegramClient(stringSession, Number(apiId), apiHash, { connectionRetries: 5 });

    await client.connect();
    await addLog("Telegram", "info", `Սկսվեց ${channels.length} ալիքների ստուգումը`);

    const result = [];
    const now = Date.now();
    const timeLimit = 24 * 60 * 60 * 1000;

    for (const channel of channels) {
      try {
        const entity = await client.getEntity(channel);
        const messages = await client.getMessages(entity, { limit: 30 });
        let relevantCount = 0;

        for (const msg of messages) {
          if (!msg.date || !msg.message) continue;
          const msgTime = Number(msg.date) * 1000;
          if (now - msgTime <= timeLimit) {
            result.push({
              channel: channel,
              id: msg.id,
              text: msg.message,
              date: new Date(msgTime)
            });
            relevantCount++;
          }
        }
        await addLog("Telegram", "info", `Ալիք ${channel}-ը հաջողությամբ ստուգվեց (գտնվել է ${relevantCount} թարմ գրառում)`);
      } catch (channelErr) {
        await addLog("Telegram", "warning", `Ալիք ${channel}-ը անհասանելի է: Վրիպակ՝ ${channelErr.message}`);
        continue; // skip cleanly
      }
    }

    await client.disconnect();

    const terms = [
      "Когнитивная война", "CogWar", "операции влияния", "информационная война",
      "Психологические операции", "стратегическая коммуникация", "Повествование",
      "Социология", "Цивилизация", "Ноосфера", "Философия", "Китай", "Индия",
      "Армения", "Турция", "Азербайджан", "Иран", "Израиль", "Психотерапевт",
      "Психологическая война", "Информационная война", "Ментальная война",
      "Культурная война", "Гибридная война", "аналитика"
    ];

    const summarizeWithGemini = async (text) => {
      if (!text || text.trim().length === 0) return "Нет текста для резюмирования.";
      try {
        const response = await fetch(
          `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-lite:generateContent?key=${geminiApiKey}`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              contents: [{ parts: [{ text: `You are a summarization assistant. Respond ONLY with the summary itself — no intro phrases. Just 2 sentences in Russian summarizing the post:\n\n${text}` }] }],
              generationConfig: { maxOutputTokens: 100 }
            })
          }
        );
        const data = await response.json();
        if (data.error) throw new Error(data.error.message);
        return data?.candidates?.[0]?.content?.parts?.[0]?.text?.trim() || `No summary`;
      } catch (err) {
        await addLog("Telegram", "error", `Gemini API-ի խնդիր: ${err.message}`);
        return `Gemini Error`;
      }
    };

    const matches = [];
    for (const post of result) {
      const text = (post.text || "").toLowerCase();
      const foundTerm = terms.find(term => text.includes(term.toLowerCase()));

      if (foundTerm) {
        const channelId = String(post.channel).replace("-100", "");
        const link = `https://t.me/c/${channelId}/${post.id}`;
        try {
          const summary = await summarizeWithGemini(post.text);
          matches.push({
            text: post.text,
            summary: summary,
            link: link,
            matched_term: foundTerm,
            date: post.date,
            channel: post.channel
          });
        } catch (e) {
           await addLog("Telegram", "warning", `Չհաջողվեց վերլուծել պոստը Gemini-ով: Ալիք ${channelId}, ID ${post.id}`);
        }
      }
    }

    if (matches.length === 0) {
      await sendTelegram("ℹ️ Telegram: Վերջին 24 ժամում համապատասխան նյութեր չեն գտնվել:");
      await addLog("Telegram", "info", "Վերլուծությունն ավարտվեց: Համընկնումներ չկան:");
      return { matches: [] };
    }

    const channelOrder = [-1001089943450, -1001831674893, -1001675619132, -1001479340147];
    matches.sort((a, b) => {
      const channelDiff = channelOrder.indexOf(a.channel) - channelOrder.indexOf(b.channel);
      if (channelDiff !== 0) return channelDiff;
      return new Date(a.date) - new Date(b.date);
    });

    const TELEGRAM_MSG_LIMIT = 4000;
    const parts = [];
    let current = "";

    for (const match of matches) {
      const block = `${match.summary}\n\n🔗 [Открыть пост](${match.link})\n\n---\n\n`;
      if ((current + block).length > TELEGRAM_MSG_LIMIT) {
        parts.push(current.trim());
        current = block;
      } else {
        current += block;
      }
    }
    if (current.trim()) parts.push(current.trim());

    let failedPushes = 0;
    for (const part of parts) {
      const success = await sendTelegram(part);
      if (!success) failedPushes++;
    }

    if (failedPushes > 0) {
      await addLog("Telegram", "warning", `Որոշ մասերի հոնորացումը ձախողվեց (${failedPushes} հաղորդագրություն չհասավ)`);
    } else {
      await addLog("Telegram", "info", `Գտնվեց ${matches.length} հաղորդագրություն և հաջողությամբ ուղարկվեց որպես ${parts.length} բլոկ`);
    }

    return { matches };

  } catch (err) {
    const errorMap = [
      { match: "API key", msg: "Неверный API ключ Gemini" },
      { match: "SESSION_REVOKED", msg: "Telegram сессия устарела. Нужно войти заново" },
      { match: "FLOOD_WAIT", msg: "Telegram заблокировал запросы" },
      { match: "ENOTFOUND", msg: "Нет интернет-соединения" },
      { match: "401", msg: "Неверный токен Telegram" }
    ];

    let userMsg = `Անհայտ սխալ: ${err.message}`;
    for (const e of errorMap) {
      if (err.message?.includes(e.match)) {
        userMsg = e.msg;
        break;
      }
    }
    
    await addLog("Telegram", "error", `Ամբողջական սխալ. ${userMsg}`);
    await sendTelegram(`❌ Սխալ Telegram-ում. ${userMsg}`).catch(() => {});
    return { error: userMsg };
  }
};