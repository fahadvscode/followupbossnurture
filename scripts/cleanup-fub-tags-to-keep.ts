/**
 * Strip all FUB tags except the approved KEEP list.
 * Does NOT delete people. Resumable via exports/fub-tag-cleanup-state.json
 *
 *   caffeinate -dims npx tsx scripts/cleanup-fub-tags-to-keep.ts
 */
import fs from 'fs';
import path from 'path';

function loadEnvFile(file: string): Record<string, string> {
  const out: Record<string, string> = {};
  if (!fs.existsSync(file)) return out;
  for (const line of fs.readFileSync(file, 'utf8').split(/\n/)) {
    const m = line.match(/^([A-Za-z0-9_]+)=(.*)$/);
    if (!m) continue;
    let v = m[2];
    if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) {
      v = v.slice(1, -1);
    }
    out[m[1]] = v;
  }
  return out;
}

const env = {
  ...loadEnvFile(path.join(process.cwd(), '.env.local')),
  ...loadEnvFile(path.join(process.cwd(), '.env.local.pull')),
  ...process.env,
};

const key = (env.FUB_API_KEY || '').trim().replace(/^Bearer\s+/i, '');
if (!key) {
  console.error('Missing FUB_API_KEY');
  process.exit(1);
}

const system = (env.FUB_SYSTEM_NAME || env.FUB_SYSTEM || '').trim();
const systemKey = (env.FUB_SYSTEM_KEY || '').trim();

const KEEP_TAGS = [
  // Property
  'Detached',
  'townhomes',
  'townhome',
  'townhouse',
  'Townhouses',
  'condo',
  'condos',
  'semi-detached',
  'semi detached',
  'commercial',
  'freehold',
  'Bungalow',
  'Apartment',
  'land',
  'retail',
  // Cities
  'Brampton',
  'Milton',
  'Mississauga',
  'Oakville',
  'Markham',
  'Toronto',
  'Hamilton',
  'Burlington',
  'Vaughan',
  'Etobicoke',
  'georgetown',
  // Projects
  'Novella',
  '6071 Fourth Line Townhomes',
  'Hawthorne East Village',
  'Hawthorne',
  'Hawthorne-Townhome',
  'Enclave',
  'The Enclave',
  'Landing Page - Enclave',
  'Enclave — Village & Park',
  'Enclave — The Village Collection',
  'Ivy Rouge',
  'YT on Fourth',
  'Rosemont Grove',
  'Rollingwood',
  'OG Urban Towns',
  'Cornerstone',
  'Ellis Lane',
  'Abacot Hill',
  'Lora Bay',
  'BLVD Q',
  'Creekside by Caivan',
  'Fox Run Caivan',
  'Aura',
  // Drip / process
  'Drip',
  'nvella',
  'replied',
  'Booking',
  'Direct Booking (No Project)',
  // Realtor (only these)
  'Realtor',
  'Imported Stage: Realtors',
  '(Husband Is Realtor)',
  // FJ / PF / Precon Factory
  'Imported Agent: Fahad Javed',
  'Fahad Javed (DIALER)',
  'Fahad Javed',
  'Fahad Javed Real Estate',
  'Precon Factory Dashboard',
  'Fahad Javed Dashboard',
  'Precon Factory Website',
  'Precon Factory',
  'fj dashboard',
  'Fahad Javed Real Estate (maas sms)',
  'pf creekview',
  'pf',
  'pf dashboard',
  'pf creekview agents',
  'creekview fj',
];

const keepExact = new Set(KEEP_TAGS);
const keepLower = new Map(KEEP_TAGS.map((t) => [t.toLowerCase(), t]));

fs.mkdirSync('exports', { recursive: true });
fs.writeFileSync(
  path.join('exports', 'fub-FINAL-KEEP-TAGS.txt'),
  KEEP_TAGS.join('\n') + '\n'
);

type State = {
  next: string | null;
  scanned: number;
  updated: number;
  skippedClean: number;
  skippedNoTags: number;
  errors: number;
  /** Real FUB people total from API `_metadata.total` */
  totalPeople: number | null;
  startedAt: string;
  updatedAt?: string;
  finishedAt?: string;
  lastPersonId?: number;
  percentComplete?: number;
};

const statePath = path.join('exports', 'fub-tag-cleanup-state.json');
const logPath = path.join('exports', 'fub-tag-cleanup.log');
const progressPath = path.join('exports', 'fub-tag-cleanup-progress.txt');

function log(msg: string) {
  // stdout only — wrapper `tee`s into the log file (avoids duplicate lines)
  console.log(`[${new Date().toISOString()}] ${msg}`);
}

function percentDone(): number | null {
  if (!state.totalPeople || state.totalPeople < 1) return null;
  const raw = (state.scanned / state.totalPeople) * 100;
  return Math.min(100, Math.round(raw * 100) / 100); // 2 decimals, cap 100
}

function progressLine(): string {
  const pct = percentDone();
  const pctStr = pct == null ? 'n/a (total unknown)' : `${pct.toFixed(2)}%`;
  return (
    `PROGRESS ${pctStr} | scanned ${state.scanned}` +
    (state.totalPeople ? ` / ${state.totalPeople}` : '') +
    ` | updated=${state.updated} already_clean=${state.skippedClean} no_tags=${state.skippedNoTags} errors=${state.errors}`
  );
}

function writeProgressFile() {
  const pct = percentDone();
  const lines = [
    `percent=${pct == null ? 'unknown' : pct.toFixed(2)}`,
    `scanned=${state.scanned}`,
    `totalPeople=${state.totalPeople ?? 'unknown'}`,
    `updated=${state.updated}`,
    `already_clean=${state.skippedClean}`,
    `no_tags=${state.skippedNoTags}`,
    `errors=${state.errors}`,
    `finished=${state.finishedAt ? 'yes' : 'no'}`,
    `updatedAt=${new Date().toISOString()}`,
    '',
    progressLine(),
    '',
  ];
  fs.writeFileSync(progressPath, lines.join('\n'));
}

let state: State = {
  next: null,
  scanned: 0,
  updated: 0,
  skippedClean: 0,
  skippedNoTags: 0,
  errors: 0,
  totalPeople: null,
  startedAt: new Date().toISOString(),
};
if (fs.existsSync(statePath)) {
  try {
    state = { ...state, ...JSON.parse(fs.readFileSync(statePath, 'utf8')) };
    log(
      `Resuming: scanned=${state.scanned} updated=${state.updated} errors=${state.errors} totalPeople=${state.totalPeople ?? 'unknown'} next=${state.next ? 'yes' : 'start'}`
    );
    const pct = percentDone();
    if (pct != null) log(`Resume progress: ${pct.toFixed(2)}% (${state.scanned}/${state.totalPeople})`);
  } catch {
    log('Could not parse state file; starting fresh counters but ok');
  }
}

function saveState() {
  state.updatedAt = new Date().toISOString();
  state.percentComplete = percentDone() ?? undefined;
  fs.writeFileSync(statePath, JSON.stringify(state, null, 2));
  writeProgressFile();
}

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

async function fub(method: string, apiPath: string, body?: unknown) {
  const headers: Record<string, string> = {
    Authorization: 'Basic ' + Buffer.from(key + ':').toString('base64'),
    Accept: 'application/json',
    'Content-Type': 'application/json',
  };
  if (system && systemKey) {
    headers['X-System'] = system;
    headers['X-System-Key'] = systemKey;
  }

  const res = await fetch('https://api.followupboss.com/v1' + apiPath, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  let json: unknown = null;
  try {
    json = text ? JSON.parse(text) : null;
  } catch {
    json = { raw: text.slice(0, 200) };
  }
  if (!res.ok) {
    const err = new Error(
      `${method} ${apiPath} ${res.status} ${text.slice(0, 220)}`
    ) as Error & { status?: number; retryAfter?: number };
    err.status = res.status;
    const ra = res.headers.get('Retry-After');
    if (ra) err.retryAfter = parseInt(ra, 10) || undefined;
    throw err;
  }
  return json as {
    people?: Array<{ id: number; tags?: string[] }>;
    _metadata?: { next?: string; total?: number };
  };
}

function filterTags(tags: string[] | undefined): {
  kept: string[];
  removed: number;
  changed: boolean;
} {
  const original = tags || [];
  const kept: string[] = [];
  const seen = new Set<string>();
  let removed = 0;
  for (const t of original) {
    const s = String(t);
    const canonical = keepExact.has(s) ? s : keepLower.get(s.toLowerCase());
    if (!canonical) {
      removed++;
      continue;
    }
    const k = canonical.toLowerCase();
    if (seen.has(k)) {
      removed++; // duplicate keep tag
      continue;
    }
    seen.add(k);
    kept.push(canonical);
  }
  return { kept, removed, changed: removed > 0 };
}

/** ~20 PUTs / 10s to stay under FUB PUT.people limit of 25/10s */
const PUT_INTERVAL_MS = 500;
let lastPutAt = 0;

async function putWithLimit(personId: number, tags: string[]) {
  const wait = PUT_INTERVAL_MS - (Date.now() - lastPutAt);
  if (wait > 0) await sleep(wait);

  for (let attempt = 1; attempt <= 8; attempt++) {
    try {
      lastPutAt = Date.now();
      await fub('PUT', `/people/${personId}`, { tags });
      return;
    } catch (e) {
      const err = e as Error & { status?: number; retryAfter?: number };
      if (err.status === 429) {
        const sec = err.retryAfter && err.retryAfter > 0 ? err.retryAfter : 10 * attempt;
        log(`429 on person ${personId}; waiting ${sec}s (attempt ${attempt})`);
        await sleep(sec * 1000);
        continue;
      }
      throw e;
    }
  }
  throw new Error(`Gave up PUT person ${personId} after retries`);
}

async function main() {
  log(`KEEP list size=${KEEP_TAGS.length}`);
  log(`X-System headers=${Boolean(system && systemKey)}`);
  log(`PUT interval=${PUT_INTERVAL_MS}ms (~${Math.floor(10000 / PUT_INTERVAL_MS)} / 10s)`);

  if (state.finishedAt) {
    log(`Already finished at ${state.finishedAt}. Delete ${statePath} to re-run.`);
    return;
  }

  let next = state.next;
  let pages = 0;

  while (true) {
    pages++;
    const apiPath = next
      ? `/people?limit=100&fields=id,tags&next=${encodeURIComponent(next)}`
      : `/people?limit=100&fields=id,tags`;

    let d: Awaited<ReturnType<typeof fub>>;
    try {
      d = await fub('GET', apiPath);
    } catch (e) {
      const err = e as Error & { status?: number; retryAfter?: number };
      state.errors++;
      if (err.status === 429) {
        const sec = err.retryAfter || 10;
        log(`GET 429; waiting ${sec}s`);
        await sleep(sec * 1000);
        continue;
      }
      log(`GET fail: ${err.message}`);
      saveState();
      await sleep(3000);
      continue;
    }

    // Real total from FUB (not estimated)
    if (typeof d._metadata?.total === 'number' && d._metadata.total > 0) {
      if (state.totalPeople !== d._metadata.total) {
        state.totalPeople = d._metadata.total;
        log(`FUB total people = ${state.totalPeople} (from API metadata)`);
      }
    }

    for (const p of d.people || []) {
      state.scanned++;
      state.lastPersonId = p.id;
      const tags = p.tags || [];
      if (tags.length === 0) {
        state.skippedNoTags++;
        continue;
      }
      const { kept, changed } = filterTags(tags);
      if (!changed) {
        state.skippedClean++;
        continue;
      }
      try {
        await putWithLimit(p.id, kept);
        state.updated++;
        // Live % during long PUT batches (real scanned/totalPeople)
        if (state.updated % 10 === 0) {
          log(progressLine());
          saveState();
        }
      } catch (e) {
        state.errors++;
        log(`PUT fail ${p.id}: ${e instanceof Error ? e.message : e}`);
      }
    }

    next = d._metadata?.next || null;
    state.next = next;

    // Log real % every page (100 people) — based on scanned/totalPeople from FUB
    log(progressLine());
    saveState();

    if (!next) break;
    if (pages % 10 === 0) await sleep(200);
  }

  state.finishedAt = new Date().toISOString();
  state.next = null;
  state.percentComplete = 100;
  saveState();
  log(
    `DONE 100.00% | scanned=${state.scanned} / ${state.totalPeople ?? state.scanned} | updated=${state.updated} clean=${state.skippedClean} empty=${state.skippedNoTags} errors=${state.errors}`
  );
}

main().catch((e) => {
  log(`FATAL ${e instanceof Error ? e.message : e}`);
  saveState();
  process.exit(1);
});
