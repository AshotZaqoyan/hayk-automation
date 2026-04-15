import fs from 'fs-extra';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const LOG_FILE = path.join(__dirname, 'logs.json');

export async function addLog(automation, level, message) {
    try {
        const logs = await fs.readJson(LOG_FILE).catch(() => []);
        const newLog = {
            id: Date.now(),
            timestamp: new Date().toISOString(),
            automation, // 'Telegram' or 'Web'
            level,      // 'info', 'warning', 'error'
            message
        };
        
        logs.unshift(newLog);
        
        const twoWeeksAgo = new Date();
        twoWeeksAgo.setDate(twoWeeksAgo.getDate() - 14);
        
        const filteredLogs = logs.filter(log => new Date(log.timestamp) > twoWeeksAgo);
        
        await fs.writeJson(LOG_FILE, filteredLogs, { spaces: 2 });
    } catch (err) {
        console.error('Failed to write log:', err);
    }
}
