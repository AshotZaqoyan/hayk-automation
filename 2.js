import fetch from 'node-fetch';
import fs from 'fs-extra';
import path from 'path';
import { fileURLToPath } from 'url';
import { addLog } from './logger.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export const code = async (inputs) => {
    const SERPAPI_KEY = inputs.SERPAPI_KEY;
    const GEMINI_API_KEY = inputs.GEMINI_API_KEY;
    const TELEGRAM_BOT_TOKEN = inputs.TELEGRAM_BOT_TOKEN;
    const TELEGRAM_USER_ID = inputs.TELEGRAM_USER_ID || 7407779466;

    const configPath = path.join(__dirname, 'config.json');
    const config = await fs.readJson(configPath).catch(() => ({ websites: [] }));
    const SITES = config.websites || [];
    const TARGET_KEYWORDS = [
        "Cognitive Warfare", "CogWar", "influence operations", "information warfare", 
        "Psychological Operations", "strategic communication", "Narrative", "Sociology", 
        "Civilization", "Noosphere", "Philosophy", "China", "India", "Armenia", 
        "Turkey", "Azerbaijan", "Iran", "Israel", "PSYOP", "Psychological Warfare", 
        "Information Warfare", "Mental Warfare", "Cultural Warfare", "Hybrid Warfare", "analytics"
    ];

    if (!SITES.length) {
      await addLog("Web", "warning", "Ստուգելու համար վեբ կայքեր չկան");
      return false;
    }

    const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

    const sendToTelegram = async (text) => {
        try {
            const res = await fetch(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    chat_id: TELEGRAM_USER_ID,
                    text: text,
                    parse_mode: "Markdown",
                    disable_web_page_preview: true
                })
            });
            const data = await res.json();
            if (!res.ok) {
                await addLog("Web", "error", `Telegram API սխալ: ${data.description}`);
                return false;
            }
            return true;
        } catch(e) {
            await addLog("Web", "error", `Չհաջողվեց հաղորդագրություն ուղարկել: ${e.message}`);
            return false;
        }
    };

    async function analyzeWithGemini(text, expectedKeyword, attempt = 1) {
        const cleanText = text.replace(/[\x00-\x1F\x7F]/g, "").substring(0, 40000);
        const prompt = `Analyze webpage relevance to Geopolitics, Cognitive Warfare, Information Warfare, PSYOP. Keyword: "${expectedKeyword}". Respond in JSON: {isRelevant:boolean, summary:string (2 sentences in Russian), matchedKeywords:string[]}. Text: ${cleanText}`;

        const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${GEMINI_API_KEY}`;
        try {
            const res = await fetch(url, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    contents: [{ parts: [{ text: prompt }] }],
                    generationConfig: {
                        responseMimeType: "application/json",
                        responseSchema: {
                            type: "object",
                            properties: {
                                isRelevant: { type: "boolean" },
                                summary: { type: "string" },
                                matchedKeywords: { type: "array", items: { type: "string" } }
                            },
                            required: ["isRelevant", "summary", "matchedKeywords"]
                        }
                    }
                })
            });

            const data = await res.json();
            if (data.error) {
                if ((data.error.message.toLowerCase().includes("high demand") || data.error.message.toLowerCase().includes("quota")) && attempt < 6) {
                    const waitTime = 10000 * attempt; // Սպասում ենք 10վրկ, 20վրկ, 30վրկ...
                    await addLog("Web", "warning", `Gemini-ն ծանրաբեռնված է, սպասում ենք ${waitTime/1000}վրկ... (Փորձ ${attempt})`);
                    await sleep(waitTime);
                    return analyzeWithGemini(text, expectedKeyword, attempt + 1);
                }
                throw new Error(data.error.message);
            }
            if (data.candidates && data.candidates[0]) {
                const result = JSON.parse(data.candidates[0].content.parts[0].text.trim());
                if (result.isRelevant && result.summary) return result.summary;
            }
            return null;
        } catch (e) {
            await addLog("Web", "warning", `Gemini վրիպակ: ${e.message} (Փորձ ${attempt})`);
            return null;
        }
    }

    await addLog("Web", "info", `Սկսվեց ${SITES.length} կայքերի վերլուծությունը`);
    let finalOutput = "";
    const allArticles = [];

    // 1. Gather all potential articles from SerpAPI
    for (const site of SITES) {
        try {
            const url = `https://serpapi.com/search?engine=google&q=site:${site}&as_qdr=d&api_key=${SERPAPI_KEY}`;
            const res = await fetch(url);
            if (!res.ok) continue;
            const data = await res.json();
            (data.organic_results || []).forEach(art => allArticles.push({ ...art, site }));
        } catch (e) {}
    }

    // 2. Process articles in parallel with a smaller limit to avoid Gemini overload
    const CONCURRENCY = 3;
    const processArticle = async (article) => {
        if (article.title.toLowerCase().includes("archives") || article.title.toLowerCase().includes("topics")) return null;
        try {
            const response = await fetch(article.link, { 
                headers: {
                    'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0.0.0 Safari/537.36'
                }, 
                timeout: 10000 
            });
            if (!response.ok) return null;
            const html = await response.text();
            let content = html.replace(/<(script|style)[^>]*>[\s\S]*?<\/\1>/gi, ' ').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();

            const textToSearch = (article.title + " " + content).toLowerCase();
            const foundKeyword = TARGET_KEYWORDS.find(k => textToSearch.includes(k.toLowerCase()));

            if (foundKeyword) {
                const result = await analyzeWithGemini(content, foundKeyword);
                if (result) {
                    await addLog("Web", "info", `Գտնվել է հոդված. ${article.title} (${article.site})`);
                    return `📝 ${result}\n\n🔗 [Открыть пост](${article.link})\n\n---\n\n`;
                }
            }
        } catch (e) {}
        return null;
    };

    const results = [];
    for (let i = 0; i < allArticles.length; i += CONCURRENCY) {
        const batch = allArticles.slice(i, i + CONCURRENCY);
        const batchResults = await Promise.all(batch.map(art => processArticle(art)));
        results.push(...batchResults.filter(Boolean));
    }

    finalOutput = results.join("");

    if (finalOutput) {
        const parts = [];
        let current = "";
        for (const chunk of finalOutput.split('\n\n---\n\n').filter(Boolean)) {
            const block = chunk + '\n\n---\n\n';
            if ((current + block).length > 3500) {
                parts.push(current.trim());
                current = block;
            } else {
                current += block;
            }
        }
        if (current) parts.push(current.trim());
        for (const part of parts) await sendToTelegram(part);
        await addLog("Web", "info", `Վեբ արդյունքները ուղարկվեցին (${results.length} հոդված)`);
    } else {
        await addLog("Web", "info", "Համապատասխան հոդվածներ չեն գտնվել");
    }

    return true;
};
