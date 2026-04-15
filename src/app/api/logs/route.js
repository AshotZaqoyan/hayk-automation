import { NextResponse } from 'next/server';
import fs from 'fs-extra';
import path from 'path';

const logsPath = path.join(process.cwd(), 'logs.json');

export async function GET() {
  try {
    const logs = await fs.readJson(logsPath).catch(() => []);
    return NextResponse.json(logs);
  } catch (error) {
    return NextResponse.json({ error: 'Failed to read logs' }, { status: 500 });
  }
}
