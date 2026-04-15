import { NextResponse } from 'next/server';
import { code as runTelegram } from '../../../../1.js';
import { code as runWeb } from '../../../../2.js';
import 'dotenv/config';

export async function POST(request) {
  try {
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

    const body = await request.json().catch(() => ({}));
    const target = body.target || 'all';

    // Run selectively
    if (target === 'telegram' || target === 'all') {
      runTelegram(inputs).catch(console.error);
    }
    if (target === 'web' || target === 'all') {
      runWeb(inputs).catch(console.error);
    }

    return NextResponse.json({ success: true, message: 'Թեստն սկսվել է', target });
  } catch (error) {
    return NextResponse.json({ error: 'Failed to start test' }, { status: 500 });
  }
}
