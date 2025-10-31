import { mkdir, access } from 'fs/promises';
import { dirname } from 'path';

const SESSIONS_DIR = './sessions';

export async function ensureSessionsDir(): Promise<void> {
  try {
    await access(SESSIONS_DIR);
  } catch {
    await mkdir(SESSIONS_DIR, { recursive: true });
  }
}

export function getSessionPath(stateId: string): string {
  return `${SESSIONS_DIR}/${stateId}.json`;
}

export function generateStateId(name: string): string {
  return `state_${name}_${Date.now()}`;
}

