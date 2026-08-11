/**
 * Remove person-name tags from Follow Up Boss people.
 * Does NOT delete leads — only strips matching tags via PUT /people/:id { tags }.
 *
 * Usage:
 *   npx tsx --env-file=.env.local.pull scripts/remove-fub-name-tags.ts
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
const auth = 'Basic ' + Buffer.from(key + ':').toString('base64');

const nameTagsPath = path.join('exports', 'fub-name-tags-to-remove.txt');
if (!fs.existsSync(nameTagsPath)) {
  console.error('Missing', nameTagsPath);
  process.exit(1);
}

const nameTags = fs
  .readFileSync(nameTagsPath, 'utf8')
  .split(/\n/)
  .map((s) => s.trim())
  .filter(Boolean);
const nameTagSet = new Set(nameTags);
const nameTagLower = new Map(nameTags.map((t) => [t.toLowerCase(), t]));

const statePath = path.join('exports', 'fub-name-tag-removal-state.json');
type State = {
  doneIds: number[];
  updated: number;
  skipped: number;
  errors: number;
  tagIndex: number;
  startedAt: string;
  updatedAt?: string;
  finishedAt?: string;
};

let state: State = {
  doneIds: [],
  updated: 0,
  skipped: 0,
  errors: 0,
  tagIndex: 0,
  startedAt: new Date().toISOString(),
};
if (fs.existsSync(statePath)) {
  try {
    state = { ...state, ...JSON.parse(fs.readFileSync(statePath, 'utf8')) };
  } catch {
    /* ignore */
  }
}
const doneIds = new Set<number>(state.doneIds || []);

async function fub(method: string, apiPath: string, body?: unknown) {
  const res = await fetch('https://api.followupboss.com/v1' + apiPath, {
    method,
    headers: {
      Authorization: auth,
      Accept: 'application/json',
      'Content-Type': 'application/json',
    },
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
    const err = new Error(`${method} ${apiPath} ${res.status} ${text.slice(0, 200)}`) as Error & {
      status?: number;
    };
    err.status = res.status;
    throw err;
  }
  return json as {
    people?: Array<{ id: number; tags?: string[] }>;
    _metadata?: { next?: string };
  };
}

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

function saveState() {
  state.doneIds = [...doneIds];
  state.updatedAt = new Date().toISOString();
  fs.writeFileSync(statePath, JSON.stringify(state));
}

function stripNameTags(tags: string[] | undefined) {
  const kept: string[] = [];
  let removed = 0;
  for (const t of tags || []) {
    const s = String(t);
    if (nameTagSet.has(s) || nameTagLower.has(s.toLowerCase())) removed++;
    else kept.push(s);
  }
  return { kept, removed };
}

async function main() {
  console.log(`Removing ${nameTags.length} name tags from people. Leads will NOT be deleted.`);
  console.log(`Already processed people: ${doneIds.size}`);

  for (let ti = state.tagIndex || 0; ti < nameTags.length; ti++) {
    const tag = nameTags[ti];
    state.tagIndex = ti;
    console.log(`\n=== Tag ${ti + 1}/${nameTags.length}: ${tag} ===`);

    let next: string | null = null;
    let pages = 0;
    while (pages < 2000) {
      pages++;
      const apiPath = next
        ? `/people?limit=100&tags=${encodeURIComponent(tag)}&fields=id,tags&next=${encodeURIComponent(next)}`
        : `/people?limit=100&tags=${encodeURIComponent(tag)}&fields=id,tags`;

      let d: Awaited<ReturnType<typeof fub>>;
      try {
        d = await fub('GET', apiPath);
      } catch (e) {
        console.error('list fail', e instanceof Error ? e.message : e);
        state.errors++;
        await sleep(2000);
        continue;
      }

      for (const p of d.people || []) {
        if (doneIds.has(p.id)) {
          state.skipped++;
          continue;
        }
        const { kept, removed } = stripNameTags(p.tags || []);
        if (removed === 0) {
          doneIds.add(p.id);
          state.skipped++;
          continue;
        }
        let ok = false;
        for (let attempt = 1; attempt <= 5 && !ok; attempt++) {
          try {
            await fub('PUT', `/people/${p.id}`, { tags: kept });
            ok = true;
            doneIds.add(p.id);
            state.updated++;
            if (state.updated % 25 === 0) {
              console.log(
                `updated=${state.updated} errors=${state.errors} people=${doneIds.size}`
              );
              saveState();
            }
            // Stay under FUB rate limits (no X-System on this key)
            await sleep(450);
          } catch (e) {
            const err = e as Error & { status?: number };
            console.error(`PUT fail attempt ${attempt}`, p.id, err.message);
            if (err.status === 429) {
              const wait = 15000 * attempt;
              console.log(`rate limited — waiting ${wait}ms`);
              await sleep(wait);
            } else {
              state.errors++;
              await sleep(1000);
              break;
            }
          }
        }
        if (!ok) {
          state.errors++;
          // leave out of doneIds so a later pass can retry
        }
      }

      next = d._metadata?.next || null;
      if (!next || !(d.people || []).length) break;
    }
    saveState();
  }

  state.finishedAt = new Date().toISOString();
  saveState();
  console.log('\nDONE', {
    updated: state.updated,
    skipped: state.skipped,
    errors: state.errors,
    peopleTouched: doneIds.size,
  });
}

main().catch((e) => {
  console.error('FATAL', e);
  process.exit(1);
});
