#!/usr/bin/env python3
"""Add a unique lead-ID tag to every Follow Up Boss person.

Format: TB-082612028M
  TB   = first + last initial (one letter if no last name)
  08   = created month
  26   = created year (2-digit)
  1/2/3/SD/0 = condo / town / detached / semi-detached / unknown
  2028 = last 4 phone digits (0000 if none)
  M    = first letter of city tag (X if none)

Uses PUT /people/:id?mergeTags=true so existing tags are kept.
Resumes if interrupted. Prints a new line every write.

Run:
  python3 scripts/tag-fub-lead-ids.py
"""

from __future__ import annotations

import base64
import fcntl
import json
import os
import re
import sys
import time
import urllib.error
import urllib.parse
import urllib.request
from pathlib import Path
from urllib.parse import urlparse

ROOT = Path(__file__).resolve().parents[1]
ENV_CANDIDATES = [ROOT / ".env.local.pull", ROOT / ".env.local"]
DONE_FILE = ROOT / "exports" / "fub_lead_id_tagged.json"
FAIL_FILE = ROOT / "exports" / "fub_lead_id_failed.json"
USED_FILE = ROOT / "exports" / "fub_lead_ids_used.json"
DUP_FILE = ROOT / "exports" / "fub_lead_id_duplicates.json"
LOCK_FILE = ROOT / "exports" / "fub_lead_id.lock"
PUT_GAP_SECONDS = 0.45
PAGE_GAP = 0.04

ID_TAG_RE = re.compile(r"^[A-Z]{1,2}-\d{4}(?:SD|[0-3])\d{4}[A-Z](?:-\d+)?$")

CONDO_TAGS = {"condo", "condos"}
TOWN_TAGS = {"townhome", "townhomes", "townhouse", "townhouses"}
DETACHED_TAGS = {"detached"}
SEMI_TAGS = {"semi-detached", "semi detached", "semidetached", "semi"}

CITY_TAGS = {
    "brampton",
    "milton",
    "mississauga",
    "oakville",
    "markham",
    "toronto",
    "hamilton",
    "burlington",
    "vaughan",
    "etobicoke",
    "georgetown",
    "caledon",
}


def load_env() -> dict[str, str]:
    vals: dict[str, str] = {}
    for path in ENV_CANDIDATES:
        if not path.exists():
            continue
        for line in path.read_text().splitlines():
            line = line.strip()
            if not line or line.startswith("#") or "=" not in line:
                continue
            k, v = line.split("=", 1)
            vals[k] = v.strip().strip('"').strip("'")
    return vals


def load_json_list(path: Path) -> list:
    if not path.exists():
        return []
    return json.loads(path.read_text())


def load_json_dict(path: Path) -> dict:
    if not path.exists():
        return {}
    data = json.loads(path.read_text())
    return data if isinstance(data, dict) else {}


def save_json(path: Path, data) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    tmp = path.with_suffix(path.suffix + ".tmp")
    tmp.write_text(json.dumps(data))
    tmp.replace(path)


def to_path(url: str) -> str:
    u = urlparse(url)
    path = u.path
    if path.startswith("/v1"):
        path = path[3:]
    return path + (("?" + u.query) if u.query else "")


def retry_after_seconds(err: urllib.error.HTTPError, attempt: int) -> float:
    raw = (err.headers or {}).get("Retry-After") if err.headers else None
    if raw:
        try:
            return max(1.0, float(raw))
        except ValueError:
            pass
    if err.code == 429:
        return min(90.0, 8.0 + attempt * 4.0)
    return min(60.0, float(2 ** min(attempt, 6)))


def fmt_eta(seconds: float) -> str:
    if seconds <= 0 or seconds == float("inf"):
        return "--:--"
    m, s = divmod(int(seconds), 60)
    h, m = divmod(m, 60)
    if h:
        return f"{h}h{m:02d}m"
    return f"{m}m{s:02d}s"


def person_tags(person: dict) -> list[str]:
    out = []
    for t in person.get("tags") or []:
        if isinstance(t, str) and t.strip():
            out.append(t.strip())
        elif isinstance(t, dict) and str(t.get("name") or "").strip():
            out.append(str(t.get("name")).strip())
    return out


def first_letter(text: str) -> str:
    for ch in text or "":
        if ch.isalpha():
            return ch.upper()
    return ""


def initials(person: dict) -> str:
    first = first_letter(str(person.get("firstName") or ""))
    last = first_letter(str(person.get("lastName") or ""))
    out = first + last
    return out or "X"


def created_mmyy(person: dict) -> str:
    created = str(person.get("created") or "")
    # 2026-08-27T21:01:31Z
    if len(created) >= 7 and created[4] == "-":
        year = created[2:4]
        month = created[5:7]
        if year.isdigit() and month.isdigit():
            return month + year
    return "0000"


def property_type(tags: list[str]) -> str:
    lowered = [t.lower() for t in tags]
    if any(t in SEMI_TAGS for t in lowered):
        return "SD"
    if any(t in CONDO_TAGS for t in lowered):
        return "1"
    if any(t in TOWN_TAGS for t in lowered):
        return "2"
    if any(t in DETACHED_TAGS for t in lowered):
        return "3"
    return "0"


def city_letter(tags: list[str]) -> str:
    for t in tags:
        if t.lower() in CITY_TAGS:
            return first_letter(t) or "X"
    return "X"


def phone_last4(person: dict) -> str:
    phones = person.get("phones") or []
    ordered = []
    for ph in phones:
        if not isinstance(ph, dict):
            continue
        raw = str(ph.get("normalized") or ph.get("value") or "")
        digits = re.sub(r"\D+", "", raw)
        if not digits:
            continue
        if ph.get("isPrimary"):
            ordered.insert(0, digits)
        else:
            ordered.append(digits)
    for digits in ordered:
        if len(digits) >= 4:
            return digits[-4:]
    return "0000"


def lead_id(person: dict) -> str:
    tags = person_tags(person)
    return (
        f"{initials(person)}-{created_mmyy(person)}"
        f"{property_type(tags)}{phone_last4(person)}{city_letter(tags)}"
    )


def unique_lead_id(person: dict, pid: int, used: dict[str, int]) -> str:
    base = lead_id(person)
    candidate = base
    n = 2
    while candidate in used and int(used[candidate]) != pid:
        candidate = f"{base}-{n}"
        n += 1
        if n > 99:
            break
    return candidate


def has_lead_id_tag(person: dict) -> str | None:
    for t in person_tags(person):
        if ID_TAG_RE.match(t):
            return t
    return None


class Fub:
    def __init__(self, base: str, auth: str, extra_headers: dict[str, str] | None = None):
        self.base = base
        self.auth = auth
        self.extra_headers = extra_headers or {}

    def request(self, method: str, path: str, body: dict | None = None):
        url = self.base + path
        last: Exception | None = None
        payload = None if body is None else json.dumps(body).encode()
        attempt = 0
        while True:
            req = urllib.request.Request(
                url,
                data=payload,
                method=method,
                headers={
                    "Authorization": self.auth,
                    "Content-Type": "application/json",
                    "Accept": "application/json",
                    "User-Agent": "fub-lead-id-tag/1.0",
                    **self.extra_headers,
                },
            )
            try:
                with urllib.request.urlopen(req, timeout=90) as res:
                    raw = res.read()
                    return res.status, (json.loads(raw) if raw else {})
            except urllib.error.HTTPError as e:
                raw = e.read().decode("utf-8", "replace")[:400]
                if e.code == 404:
                    return 404, {}
                if e.code in (429, 500, 502, 503):
                    wait = retry_after_seconds(e, attempt)
                    print(f"\n  rate/server {e.code} — retry in {wait:.0f}s", flush=True)
                    time.sleep(wait)
                    attempt += 1
                    last = e
                    continue
                raise RuntimeError(f"{method} {path} -> {e.code}: {raw}") from e
            except Exception as e:
                last = e
                wait = min(60.0, float(2 ** min(attempt, 6)))
                print(f"\n  {type(e).__name__}: {e} — retry in {wait:.0f}s", flush=True)
                time.sleep(wait)
                attempt += 1
                if attempt >= 30:
                    raise RuntimeError(last) from last


def acquire_lock():
    LOCK_FILE.parent.mkdir(parents=True, exist_ok=True)
    fp = open(LOCK_FILE, "w")
    try:
        fcntl.flock(fp.fileno(), fcntl.LOCK_EX | fcntl.LOCK_NB)
    except BlockingIOError:
        print("Another tag-fub-lead-ids.py is already running.", file=sys.stderr)
        fp.close()
        raise SystemExit(1)
    fp.write(str(os.getpid()))
    fp.flush()
    return fp


def main() -> int:
    lock = acquire_lock()
    vals = load_env()
    key = vals.get("FUB_API_KEY", "").strip()
    if not key:
        print("FUB_API_KEY missing from .env.local.pull / .env.local", file=sys.stderr)
        return 1
    base = (vals.get("FUB_BASE_URL") or "https://api.followupboss.com/v1").rstrip("/")
    auth = "Basic " + base64.b64encode((key + ":").encode()).decode()
    extra = {}
    system = (vals.get("FUB_SYSTEM_NAME") or vals.get("FUB_SYSTEM") or "").strip()
    system_key = (vals.get("FUB_SYSTEM_KEY") or "").strip()
    if system and system_key:
        extra["X-System"] = system
        extra["X-System-Key"] = system_key
    fub = Fub(base, auth, extra)
    _ = lock

    done = {int(x) for x in load_json_list(DONE_FILE)}
    failed = {int(x) for x in load_json_list(FAIL_FILE)}
    used_raw = load_json_dict(USED_FILE)
    used: dict[str, int] = {str(k): int(v) for k, v in used_raw.items()}
    dups: list[dict] = load_json_list(DUP_FILE) if DUP_FILE.exists() else []
    print(
        f"Already tagged: {len(done):,}  previously failed: {len(failed):,}  "
        f"IDs tracked: {len(used):,}\n"
        f"Stop: Ctrl+C  (progress is saved)\n"
        f"Resume: python3 scripts/tag-fub-lead-ids.py\n",
        flush=True,
    )

    fields = urllib.parse.quote("id,firstName,lastName,created,phones,tags")
    path: str | None = f"/people?limit=100&includeTrash=true&fields={fields}"
    scanned = 0
    total = 0
    tagged_now = 0
    skipped = 0
    missing = 0
    fail_now = 0
    collided = 0
    started = time.time()
    last_save = time.time()

    def persist() -> None:
        save_json(DONE_FILE, sorted(done))
        save_json(USED_FILE, used)
        if failed:
            save_json(FAIL_FILE, sorted(failed))
        if dups:
            save_json(DUP_FILE, dups)

    try:
        while path:
            _, data = fub.request("GET", path)
            meta = data.get("_metadata") or {}
            if not total:
                total = int(meta.get("total") or 0)
                remaining_puts = max(0, total - len(done))
                print(
                    f"FUB reports {total:,} people. "
                    f"ETA about {fmt_eta(remaining_puts * PUT_GAP_SECONDS)} at FUB write limit.\n",
                    flush=True,
                )
            people = data.get("people") or []
            for person in people:
                scanned += 1
                pid = int(person.get("id"))
                name = f"{person.get('firstName') or ''} {person.get('lastName') or ''}".strip() or "(no name)"
                existing = has_lead_id_tag(person)
                if existing:
                    owner = used.get(existing)
                    if owner is not None and int(owner) != pid:
                        dups.append(
                            {
                                "id": existing,
                                "personId": pid,
                                "otherPersonId": owner,
                                "name": name,
                            }
                        )
                        print(
                            f"[{scanned:,}/{total:,}]  {pid}  {name}  "
                            f"kept {existing} (already on person {owner})",
                            flush=True,
                        )
                    else:
                        used[existing] = pid
                    done.add(pid)
                    skipped += 1
                    continue
                if pid in done:
                    skipped += 1
                    continue
                lid = unique_lead_id(person, pid, used)
                if lid != lead_id(person):
                    collided += 1
                status, _ = fub.request(
                    "PUT",
                    f"/people/{pid}?mergeTags=true",
                    {"tags": [lid]},
                )
                if status in (200, 201, 204):
                    done.add(pid)
                    used[lid] = pid
                    tagged_now += 1
                    result = f"tagged {lid}"
                elif status == 404:
                    done.add(pid)
                    missing += 1
                    result = "gone"
                else:
                    failed.add(pid)
                    fail_now += 1
                    result = f"failed {status}"
                elapsed = max(0.001, time.time() - started)
                rate = tagged_now / elapsed if tagged_now else scanned / elapsed
                left_people = max(0, total - scanned) if total else 0
                eta = left_people / (scanned / elapsed) if scanned else 0
                print(
                    f"[{scanned:,}/{total:,}]  {pid}  {name}  {result}  "
                    f"{rate:3.1f}/s  ETA {fmt_eta(eta)}  "
                    f"tagged +{tagged_now:,} skipped {skipped:,} collided {collided} failed {fail_now}",
                    flush=True,
                )
                time.sleep(PUT_GAP_SECONDS)
                if time.time() - last_save >= 15:
                    persist()
                    last_save = time.time()
            path = to_path(str(meta["nextLink"])) if meta.get("nextLink") else None
            if not people:
                break
            time.sleep(PAGE_GAP)
    except KeyboardInterrupt:
        print("\nInterrupted — progress saved. Run the same command to resume.", flush=True)
        persist()
        return 130
    finally:
        persist()

    print("\nDone.", flush=True)
    print(
        json.dumps(
            {
                "scanned": scanned,
                "tagged_this_run": tagged_now,
                "already_done": len(done),
                "skipped": skipped,
                "collided_suffix": collided,
                "duplicate_existing": len(dups),
                "already_gone_404": missing,
                "failed": len(failed),
            },
            indent=2,
        )
    )
    return 0 if not failed else 2


if __name__ == "__main__":
    raise SystemExit(main())
