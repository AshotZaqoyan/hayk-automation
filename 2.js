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
    const TELEGRAM_USER_ID = inputs.TELEGRAM_USER_ID;

    const configPath = path.join(__dirname, 'config.json');
    const config = await fs.readJson(configPath);
    const SITES = config.websites;
    const TARGET_KEYWORDS = [
        "Cognitive Warfare", "CogWar", "influence operations", "information warfare", 
        "Psychological Operations", "strategic communication", "Narrative", "Sociology", 
        "Civilization", "Noosphere", "Philosophy", "China", "India", "Armenia", 
        "Turkey", "Azerbaijan", "Iran", "Israel", "PSYOP", "Psychological Warfare", 
        "Information Warfare", "Mental Warfare", "Cultural Warfare", "Hybrid Warfare", "analytics"
    ];

    if (!SITES || SITES.length === 0) {
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
                    parse_mode: "HTML"
                })
            });
            if (!res.ok) throw new Error("Not OK from TG");
            return true;
        } catch(e) {
            await addLog("Web", "error", `Չհաջողվեց հաղորդագրություն ուղարկել: ${e.message}`);
            return false;
        }
    };

    async function analyzeWithGemini(text, expectedKeyword) {
        const cleanText = text.replace(/[\x00-\x1F\x7F]/g, "").substring(0, 40000);
        const prompt = `Analyze the following extracted webpage text to determine its relevance to our specific research. RESEARCH CONTEXT: We are monitoring topics strictly related to Geopolitics, Cognitive Warfare, Information Warfare, Psychological Operations (PSYOP), and International Relations. The keyword "${expectedKeyword}" was found in this text. Other target keywords we monitor: ${TARGET_KEYWORDS.join(", ")}. Your tasks: 1. Evaluate if the MAIN article content is actually focused on our RESEARCH CONTEXT. 2. Check that the keyword "${expectedKeyword}" is central to the article's core narrative. 3. If relevant, set "isRelevant" to true, and provide a 2-sentence summary of the main article in Russian. Provide the exact "matchedKeywords" found. 4. If fundamentally about a different subject, set "isRelevant" to false. Text: ${cleanText}`;

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
            if (data.candidates && data.candidates[0]) {
                const result = JSON.parse(data.candidates[0].content.parts[0].text.trim());
                if (result.isRelevant && result.summary) return result.summary;
            }
            return null;
        } catch (e) {
            await addLog("Web", "warning", `Gemini API-ի վրիպակ վեբ էջի վերլուծության ժամանակ: ${e.message}`);
            return null;
        }
    }

    await addLog("Web", "info", `Սկսվեց ${SITES.length} կայքերի վերլուծությունը`);
    let finalOutput = "";

    for (const site of SITES) {
        try {
            const url = `https://serpapi.com/search?engine=google&q=site:${site}&as_qdr=d&api_key=${SERPAPI_KEY}`;
            const res = await fetch(url);
            
            if (!res.ok) {
                await addLog("Web", "warning", `SerpAPI-ն խափանվեց ${site} կայքի համար: Code ${res.status}`);
                continue;
            }
            
            const data = await res.json();
            const articles = data.organic_results || [];
            
            if (articles.length === 0) {
               continue; // No articles found for this site today
            }

            for (const article of articles) {
                if (article.title.toLowerCase().includes("archives") || article.title.toLowerCase().includes("topics")) continue;

                try {
                    const response = await fetch(article.link, { headers: { 'User-Agent': 'Mozilla/5.0' }, timeout: 10000 });
                    if (!response.ok) {
                        await addLog("Web", "warning", `Անհասանելի հոդված՝ ${article.link} (Code ${response.status})`);
                        continue;
                    }
                    const html = await response.text();

                    let content = html.replace(/<(script|style)[^>]*>[\s\S]*?<\/\1>/gi, ' ');
                    content = content.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();

                    const textToSearch = (article.title + " " + content).toLowerCase();
                    const foundKeyword = TARGET_KEYWORDS.find(k => textToSearch.includes(k.toLowerCase()));

                    if (foundKeyword) {
                        const result = await analyzeWithGemini(content, foundKeyword);
                        if (result) {
                            await addLog("Web", "info", `Գտնվել և հաստատվել է հոդված. ${article.title} (${foundKeyword})`);
                            finalOutput += `📝 ${result}\n\n🔗 <a href="${article.link}">Открыть пост</a>\n\n---\n\n`;
                        }
                        await sleep(1000);
                    }
                } catch (articleErr) {
                    await addLog("Web", "warning", `Չհաջողվեց կարդալ հոդվածը ${article.link}. ${articleErr.message}`);
                }
            }
        } catch (siteErr) {
            await addLog("Web", "warning", `Ամբողջ կայքի որոնումը ձախողվեց ${site}-ի համար: ${siteErr.message}`);
        }
    }

    if (finalOutput) {
        const chunks = finalOutput.split('\n\n---\n\n').filter(Boolean);
        let currentMessage = "";
        let failedMessages = 0;

        for (const chunk of chunks) {
            const textToAdd = chunk + '\n\n---\n\n';
            if ((currentMessage + textToAdd).length > 3500) {
                const s = await sendToTelegram(currentMessage.slice(0, -5));
                if (!s) failedMessages++;
                currentMessage = textToAdd;
            } else {
                currentMessage += textToAdd;
            }
        }

        if (currentMessage) {
            const s = await sendToTelegram(currentMessage.slice(0, -5));
             if (!s) failedMessages++;
        }

        if (failedMessages > 0) {
             await addLog("Web", "warning", `${failedMessages} վեբ արդյունքների հաղորդագրություն չի ուղարկվել (Telegram խնդիր)`);
        } else {
             await addLog("Web", "info", "Վեբ արդյունքները հաջողությամբ ուղարկվեցին");
        }
    } else {
        await sendToTelegram("ℹ️ Web: Վերջին 24 ժամում համապատասխան փոփոխություններ չեն գտնվել:");
        await addLog("Web", "info", "Համապատասխան հոդվածներ չեն գտնվել");
    }

    return true;
};
