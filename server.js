import { createServer } from 'http';
import { parse } from 'url';
import next from 'next';
import cron from 'node-cron';
import fs from 'fs-extra';
import path from 'path';
import { code as runTelegram } from './1.js';
import { code as runWeb } from './2.js';
import { fileURLToPath } from 'url';
import 'dotenv/config';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const configPath = path.join(__dirname, 'config.json');

const dev = false; // Always run in production mode to fix WebSocket / HTTPS issues
const hostname = 'localhost';
const port = 3000;

const app = next({ dev, hostname, port });
const handle = app.getRequestHandler();

let currentCronObj = null;

function padZero(num) {
  return num.toString().padStart(2, '0');
}

function initCronWatcher() {
  // Rather than resetting tasks over and over, we'll run a minutely cron check
  // This evaluates every single minute if the current 'Asia/Yerevan' time matches the user's config time
  cron.schedule('* * * * *', async () => {
    try {
      const config = await fs.readJson(configPath);
      const cronTimeStr = config.cronTime || "21:00"; // default to 21:00
      
      const parts = cronTimeStr.split(":");
      if (parts.length !== 2) return;
      
      const targetHour = parts[0];
      const targetMinute = parts[1];

      // Get current date time in Yerevan
      const now = new Date();
      const options = { timeZone: 'Asia/Yerevan', hour: '2-digit', minute: '2-digit', hour12: false };
      const formatter = new Intl.DateTimeFormat([], options);
      const partsArr = formatter.formatToParts(now);
      
      const currentHour = partsArr.find(p => p.type === 'hour').value;
      const currentMinute = partsArr.find(p => p.type === 'minute').value;
      
      if (currentHour === targetHour && currentMinute === targetMinute) {
         console.log(`[Scheduled] Current Yerevan time is ${currentHour}:${currentMinute}. Triggering automations!`);
         
         const inputs = {
          bot_token: process.env.bot_token,
          api_id: process.env.api_id,
          api_hash: process.env.api_hash,
          session_string: process.env.session_string,
          gemini_api_key: process.env.gemini_api_key,
          SERPAPI_KEY: process.env.SERPAPI_KEY,
          GEMINI_API_KEY: process.env.GEMINI_API_KEY,
          TELEGRAM_BOT_TOKEN: process.env.TELEGRAM_BOT_TOKEN,
          TELEGRAM_USER_ID: process.env.TELEGRAM_USER_ID,
        };
        
        runTelegram(inputs).catch(console.error);
        runWeb(inputs).catch(console.error);
      }

    } catch(e) {
      console.error("Cron watcher error:", e);
    }
  });

  console.log('> Cron watcher active. Tasks will trigger automatically based on config.cronTime (default 21:00 Asia/Yerevan).');
}

app.prepare().then(() => {
  createServer(async (req, res) => {
    try {
      const parsedUrl = parse(req.url, true);
      await handle(req, res, parsedUrl);
    } catch (err) {
      console.error('Error occurred handling', req.url, err);
      res.statusCode = 500;
      res.end('internal server error');
    }
  })
    .once('error', (err) => {
      console.error(err);
      process.exit(1);
    })
    .listen(port, () => {
      console.log(`> Ready on http://${hostname}:${port}`);
      initCronWatcher();
    });
});
