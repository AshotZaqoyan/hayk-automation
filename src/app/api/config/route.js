import { NextResponse } from 'next/server';
import fs from 'fs-extra';
import path from 'path';

const configPath = path.join(process.cwd(), 'config.json');

export async function GET() {
  try {
    const config = await fs.readJson(configPath).catch(() => ({ telegramChannels: [], websites: [], cronTime: "21:00" }));
    return NextResponse.json(config);
  } catch (error) {
    return NextResponse.json({ error: 'Failed to read config' }, { status: 500 });
  }
}

function cleanDomain(url) {
  try {
    let domain = url.trim().replace(/^(https?:\/\/)?(www\.)?/, '');
    domain = domain.split(/[/?#]/)[0];
    return domain.toLowerCase();
  } catch (e) {
    return url.toLowerCase();
  }
}

export async function POST(request) {
  try {
    const { type, action, value } = await request.json();
    const config = await fs.readJson(configPath).catch(() => ({ telegramChannels: [], websites: [], cronTime: "21:00" }));

    if (type === 'telegram') {
      if (action === 'add') {
        const id = parseInt(value);
        if (!isNaN(id) && !config.telegramChannels.includes(id)) {
          config.telegramChannels.push(id);
        }
      } else if (action === 'delete') {
        config.telegramChannels = config.telegramChannels.filter(c => c !== parseInt(value));
      }
    } else if (type === 'website') {
      if (action === 'add') {
        const domain = cleanDomain(value);
        if (domain && !config.websites.includes(domain)) {
          config.websites.push(domain);
        }
      } else if (action === 'delete') {
        config.websites = config.websites.filter(w => w !== value);
      }
    } else if (type === 'time') {
      config.cronTime = value; // update logic
    }

    await fs.writeJson(configPath, config, { spaces: 2 });
    return NextResponse.json({ success: true, config });
  } catch (error) {
    return NextResponse.json({ error: 'Failed to update config' }, { status: 500 });
  }
}
