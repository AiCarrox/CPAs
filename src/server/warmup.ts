import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import type { WarmupApiConfig, WarmupConfig, WarmupEntry, WarmupRuntimeState, WarmupSchedule } from '../shared/types.js';

const DATA_DIR = path.resolve(process.cwd(), '.data');
const WARMUP_CONFIG_FILE = path.join(DATA_DIR, 'warmup-config.json');

const MAX_ENTRIES = 20;
const MAX_COUNT = 10;
const MAX_SPREAD = 120;
const REQUEST_TIMEOUT_MS = 30_000;
const MAX_MISSED_HOURS = 2;
const CHECK_INTERVAL_MS = 30_000;
const SPREAD_OPTIONS = [0, 5, 10, 15, 30, 60];

const WARMUP_MESSAGES: string[] = [
  '快问快答：现在的北京时间',
  '快速回答：请告诉我当前北京时间',
  '请立刻告诉我现在北京时间是多少',
  '急问：此刻北京时间几点',
  '快答：现在北京几点了',
  '请快速告知当前的北京时间',
  '现在北京时间是多少？请快答',
  '速答：告诉我北京此刻的时间',
  '快问：北京时间现在是几点几分',
  '请问现在北京时间？请简短回答',
  '请用一句话告诉我现在北京时间',
];

const DEFAULT_STATE: WarmupRuntimeState = {
  planned_at: null,
  last_run_bj_date: null,
  last_run_at: null,
  last_status: null,
  last_error: null,
};

function ensureDataDir() {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

function loadFromDisk(): WarmupConfig {
  try {
    const raw = fs.readFileSync(WARMUP_CONFIG_FILE, 'utf8');
    const parsed = JSON.parse(raw) as Partial<WarmupConfig>;
    const entries = Array.isArray(parsed?.entries)
      ? parsed.entries.map(normalizeEntry).filter((e): e is WarmupEntry => e !== null)
      : [];
    const states: Record<string, WarmupRuntimeState> = {};
    if (parsed?.states && typeof parsed.states === 'object' && !Array.isArray(parsed.states)) {
      for (const [k, v] of Object.entries(parsed.states as Record<string, Partial<WarmupRuntimeState>>)) {
        if (v && typeof v === 'object') states[k] = { ...DEFAULT_STATE, ...v };
      }
    }
    return { entries, states };
  } catch {
    return { entries: [], states: {} };
  }
}

function saveToDisk() {
  try {
    ensureDataDir();
    fs.writeFileSync(WARMUP_CONFIG_FILE, JSON.stringify(config, null, 2), 'utf8');
  } catch {
    // best effort
  }
}

let config: WarmupConfig = loadFromDisk();
let checkTimer: ReturnType<typeof setInterval> | null = null;
const runningEntries = new Set<string>();
let schedulerGeneration = 0;

// ──── Beijing time helpers ────

function getBeijingNow(): Date {
  // Build a Date representing current Beijing wall-clock time
  const now = new Date();
  const utcMs = now.getTime() + now.getTimezoneOffset() * 60_000;
  return new Date(utcMs + 8 * 60 * 60 * 1000);
}

function bjDateStr(): string {
  const bj = getBeijingNow();
  return `${bj.getUTCFullYear()}-${String(bj.getUTCMonth() + 1).padStart(2, '0')}-${String(bj.getUTCDate()).padStart(2, '0')}`;
}

function bjToUtc(hour: number, minute: number): Date {
  // Convert a Beijing wall-clock time on today's Beijing date to a UTC Date
  const bj = getBeijingNow();
  const bjMs = Date.UTC(bj.getUTCFullYear(), bj.getUTCMonth(), bj.getUTCDate(), hour, minute, 0, 0);
  return new Date(bjMs - 8 * 60 * 60 * 1000);
}

// ──── Entry normalization ────

function normalizeEntry(input: unknown): WarmupEntry | null {
  if (!input || typeof input !== 'object' || Array.isArray(input)) return null;
  const v = input as Record<string, unknown>;
  const api = normalizeApi(v.api);
  if (!api) return null;
  const schedule = normalizeSchedule(v.schedule);
  if (!schedule) return null;
  const count = Math.max(1, Math.min(MAX_COUNT, Math.round(Number(v.count) || 1)));
  return { api, schedule, count, enabled: v.enabled !== false };
}

function normalizeApi(input: unknown): WarmupApiConfig | null {
  if (!input || typeof input !== 'object' || Array.isArray(input)) return null;
  const v = input as Record<string, unknown>;
  const id = typeof v.id === 'string' && v.id.trim() ? v.id : crypto.randomUUID();
  const remark = typeof v.remark === 'string' ? v.remark.trim() : '';
  const apikey = typeof v.apikey === 'string' ? v.apikey.trim() : '';
  const apiurl = typeof v.apiurl === 'string' ? v.apiurl.trim() : '';
  const model = typeof v.model === 'string' ? v.model.trim() : '';
  return { id, remark, apikey, apiurl, model, enabled: v.enabled !== false };
}

function normalizeSchedule(input: unknown): WarmupSchedule | null {
  if (!input || typeof input !== 'object' || Array.isArray(input)) return null;
  const v = input as Record<string, unknown>;
  const hour = Math.max(0, Math.min(23, Math.round(Number(v.hour) || 0)));
  const minute = Math.max(0, Math.min(59, Math.round(Number(v.minute) || 0)));
  const spread = SPREAD_OPTIONS.includes(Number(v.random_spread_minutes))
    ? Number(v.random_spread_minutes)
    : 0;
  return { hour, minute, random_spread_minutes: spread };
}

// ──── Planned time calculation ────

function ensurePlannedTime(entry: WarmupEntry): void {
  const id = entry.api.id;
  const state = config.states[id] ?? { ...DEFAULT_STATE };
  const today = bjDateStr();

  // If we already have a valid plan for today, keep it
  if (state.last_run_bj_date !== today && state.planned_at) {
    const planned = new Date(state.planned_at);
    const bj = getBeijingNow();
    const bjStartOfDay = new Date(Date.UTC(bj.getUTCFullYear(), bj.getUTCMonth(), bj.getUTCDate(), 0, 0, 0, 0));
    if (planned >= bjStartOfDay) return; // plan is for today, keep it
  }

  // Generate new planned time for today
  const { hour, minute, random_spread_minutes } = entry.schedule;
  const spreadMs = random_spread_minutes * 60_000;
  const offset = spreadMs > 0 ? Math.floor(Math.random() * spreadMs * 2) - spreadMs : 0;
  const baseUtc = bjToUtc(hour, minute);
  const plannedUtc = new Date(baseUtc.getTime() + offset);

  state.planned_at = plannedUtc.toISOString();
  if (!config.states[id]) config.states[id] = state;
  else Object.assign(config.states[id], { planned_at: state.planned_at });
  saveToDisk();
}

// ──── Warmup execution ────

function maskLog(url: string): string {
  try { return new URL(url).origin + '/***'; } catch { return '***'; }
}

async function executeOnce(entry: WarmupEntry): Promise<{ ok: boolean; error?: string }> {
  const message = WARMUP_MESSAGES[Math.floor(Math.random() * WARMUP_MESSAGES.length)];
  let url: string;
  try {
    const base = entry.api.apiurl.replace(/\/+$/, '');
    url = new URL(`${base}/chat/completions`).toString();
  } catch {
    return { ok: false, error: `Invalid apiurl: ${maskLog(entry.api.apiurl)}` };
  }

  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${entry.api.apikey}`,
      },
      body: JSON.stringify({ model: entry.api.model, messages: [{ role: 'user', content: message }], max_tokens: 100 }),
      signal: controller.signal,
      redirect: 'manual',
    });
    clearTimeout(timer);
    if (!res.ok) {
      const body = await res.text().catch(() => '');
      return { ok: false, error: `HTTP ${res.status}: ${body.slice(0, 200)}` };
    }
    return { ok: true };
  } catch (err) {
    if (err instanceof DOMException && err.name === 'AbortError') {
      return { ok: false, error: `Request timed out after ${REQUEST_TIMEOUT_MS / 1000}s` };
    }
    return { ok: false, error: err instanceof Error ? err.message : 'Unknown error' };
  }
}

async function executeWarmup(entry: WarmupEntry, gen: number): Promise<void> {
  const id = entry.api.id;
  const count = Math.max(1, entry.count);
  let lastError: string | null = null;
  let anySuccess = false;

  for (let i = 0; i < count; i++) {
    // Check generation — if config was updated mid-execution, stop
    if (gen !== schedulerGeneration) return;

    const result = await executeOnce(entry);
    if (result.ok) {
      anySuccess = true;
      console.log(`[warmup] "${entry.api.remark}" attempt ${i + 1}/${count} succeeded (${maskLog(entry.api.apiurl)})`);
    } else {
      lastError = result.error ?? 'Unknown';
      console.log(`[warmup] "${entry.api.remark}" attempt ${i + 1}/${count} failed: ${lastError}`);
    }

    // Random delay between attempts: 1–3 seconds, non-integer
    if (i < count - 1) {
      const delayMs = 1000 + Math.random() * 2000;
      await new Promise(resolve => setTimeout(resolve, delayMs));
    }
  }

  // Persist runtime state
  const state = config.states[id] ?? { ...DEFAULT_STATE };
  state.last_run_bj_date = bjDateStr();
  state.last_run_at = new Date().toISOString();
  state.last_status = anySuccess ? 'success' : 'error';
  state.last_error = lastError;
  config.states[id] = state;
  saveToDisk();
}

// ──── Scheduler ────

async function checkAndFire(): Promise<void> {
  const now = new Date();
  const today = bjDateStr();

  for (const entry of config.entries) {
    if (!entry.enabled || !entry.api.enabled) continue;
    const id = entry.api.id;

    // Skip if already running
    if (runningEntries.has(id)) continue;

    const state = config.states[id] ?? { ...DEFAULT_STATE };

    // Already ran today
    if (state.last_run_bj_date === today) continue;

    // Ensure we have a planned time
    ensurePlannedTime(entry);

    const plannedAt = config.states[id]?.planned_at;
    if (!plannedAt) continue;

    const plannedDate = new Date(plannedAt);

    // Haven't reached planned time yet
    if (now < plannedDate) continue;

    // Missed window check: if planned time was more than MAX_MISSED_HOURS ago, skip
    const missedMs = now.getTime() - plannedDate.getTime();
    if (missedMs > MAX_MISSED_HOURS * 60 * 60 * 1000) {
      console.log(`[warmup] "${entry.api.remark}" missed window by ${Math.round(missedMs / 3600000)}h, skipping`);
      state.last_run_bj_date = today;
      state.last_status = 'error';
      state.last_error = `Missed by ${Math.round(missedMs / 3600000)}h, skipped`;
      config.states[id] = state;
      saveToDisk();
      continue;
    }

    // Fire!
    const gen = schedulerGeneration;
    runningEntries.add(id);
    console.log(`[warmup] Triggering "${entry.api.remark}" (planned ${plannedAt}, count=${entry.count})`);
    executeWarmup(entry, gen)
      .then(() => {
        console.log(`[warmup] "${entry.api.remark}" done`);
      })
      .catch((err) => {
        console.log(`[warmup] "${entry.api.remark}" error: ${err instanceof Error ? err.message : err}`);
      })
      .finally(() => {
        runningEntries.delete(id);
      });
  }
}

function startScheduler(): void {
  if (checkTimer) clearInterval(checkTimer);
  checkTimer = setInterval(() => { void checkAndFire(); }, CHECK_INTERVAL_MS);
  // Also check immediately on start
  setTimeout(() => { void checkAndFire(); }, 1000);
}

// ──── Public API ────

function maskApikey(key: string): string {
  if (!key) return '';
  if (key.length <= 8) return '***';
  return key.slice(0, 4) + '***' + key.slice(-4);
}

export function getWarmupConfig(): WarmupConfig {
  return {
    entries: config.entries.map(e => ({
      ...e,
      api: { ...e.api, apikey: maskApikey(e.api.apikey) },
    })),
    states: { ...config.states },
  };
}

export function updateWarmupConfig(newEntries: WarmupEntry[]): WarmupConfig {
  // Merge apikey: if incoming apikey is masked ('***' in middle), keep the old one
  const merged = newEntries.map((incoming) => {
    const existing = config.entries.find(e => e.api.id === incoming.api.id);
    if (existing && incoming.api.apikey.includes('***')) {
      return { ...incoming, api: { ...incoming.api, apikey: existing.api.apikey } };
    }
    return incoming;
  }).slice(0, MAX_ENTRIES);

  schedulerGeneration++;
  config.entries = merged;

  // Clean up orphaned states
  const ids = new Set(merged.map(e => e.api.id));
  for (const k of Object.keys(config.states)) {
    if (!ids.has(k)) delete config.states[k];
  }

  // Reset runtime state for changed entries so they can re-trigger today
  for (const entry of merged) {
    const state = config.states[entry.api.id];
    if (state) {
      state.planned_at = null;
      state.last_run_bj_date = null;
    }
  }

  saveToDisk();
  startScheduler();
  return getWarmupConfig();
}

export function startWarmupScheduler(): void {
  // Ensure planned times exist for all enabled entries
  for (const entry of config.entries) {
    if (entry.enabled && entry.api.enabled) {
      ensurePlannedTime(entry);
    }
  }
  startScheduler();
}

export async function testWarmupEntry(entry: WarmupEntry): Promise<{ ok: boolean; error?: string }> {
  // Resolve real apikey if incoming has mask
  const existing = config.entries.find(e => e.api.id === entry.api.id);
  const resolved = { ...entry };
  if (existing && entry.api.apikey.includes('***')) {
    resolved.api = { ...entry.api, apikey: existing.api.apikey };
  }
  // Validate URL
  try {
    const base = resolved.api.apiurl.replace(/\/+$/, '');
    new URL(`${base}/chat/completions`);
  } catch {
    return { ok: false, error: `Invalid apiurl: ${resolved.api.apiurl}` };
  }
  return executeOnce(resolved);
}
