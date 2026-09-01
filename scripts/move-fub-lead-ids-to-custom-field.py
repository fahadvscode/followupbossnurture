#!/usr/bin/env python3
"""Move lead-ID tags into the FUB Client ID custom field and drop those tags.

Field: customClientID (label: Client ID)
ID tags look like TB-082612028M.

One PUT per person that still has an ID tag:
  - writes the ID into customClientID
  - replaces tags with the same list minus ID tags (other tags stay)

Does not generate new IDs. Resume-safe. Do not run two FUB write jobs at once.

Run:
  python3 scripts/move-fub-lead-ids-to-custom-field.py
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
DONE_FILE = ROOT / "exports" / "fub_client_id_field_done.json"
FAIL_FILE = ROOT / "exports" / "fub_client_id_field_failed.json"
LOCK_FILE = ROOT / "exports" / "fub_client_id_field.lock"
PUT_GAP_SECONDS = 0.45
PAGE_GAP = 0.04
FIELD_NAME = "customClientID"
ID_TAG_RE = re.compile(r"^[A-Z]{1,2}-\d{4}(?:SD|[0-3])\d{4}[A-Z](?:-\d+)?$")
OTHER_WRITE_SCRIPTS = (
    "tag-fub-lead-ids.py",
    "clear-fub-form-ids.py",
    "move-fub-lead-ids-to-custom-field.py",
)


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


def id_tags(tags: list[str]) -> list[str]:
    return [t for t in tags if ID_TAG_RE.match(t)]


def other_copies_running() -> bool:
    try:
        import subprocess

        out = subprocess.check_output(["ps", "-ax", "-o", "pid=,command="], text=True)
    except Exception:
        return False
    me = os.getpid()
    for line in out.splitlines():
        parts = line.strip().split(None, 1)
        if len(parts) < 2:
            continue
        try:
            pid = int(parts[0])
        except ValueError:
            continue
        if pid == me:
            continue
        cmd = parts[1]
        exe = cmd.split(None, 1)[0]
        if "python" not in exe.lower() and "Python.app" not in exe:
            continue
        if any(name in cmd for name in OTHER_WRITE_SCRIPTS):
            return True
    return False


def acquire_lock():
    if other_copies_running():
        print(
            "Another FUB people-write script is already running. "
            "Wait — Follow Up Boss rate-limits people updates.",
            file=sys.stderr,
        )
        raise SystemExit(1)
    LOCK_FILE.parent.mkdir(parents=True, exist_ok=True)
    fp = open(LOCK_FILE, "w")
    try:
        fcntl.flock(fp.fileno(), fcntl.LOCK_EX | fcntl.LOCK_NB)
    except BlockingIOError:
        print(
            "Another move-fub-lead-ids-to-custom-field.py is already running.",
            file=sys.stderr,
        )
        fp.close()
        raise SystemExit(1)
    fp.write(str(os.getpid()))
    fp.flush()
    return fp


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
                    "User-Agent": "fub-client-id-field/1.0",
                    **self.extra_headers,
                },
            )
            try:
                with urllib.request.urlopen(req, timeout=90) as res:
                    raw = res.read()
                    data = json.loads(raw) if raw else {}
                    return res.status, data
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

    _, fields_data = fub.request("GET", "/customFields")
    fields = fields_data.get("customfields") or fields_data.get("customFields") or []
    match = next((f for f in fields if str(f.get("name") or "") == FIELD_NAME), None)
    if not match:
        print(f"Custom field {FIELD_NAME} not found. Create Client ID in FUB first.", file=sys.stderr)
        return 1
    print(
        f"Field: {match.get('name')}  label={match.get('label')}  type={match.get('type')}",
        flush=True,
    )

    done = {int(x) for x in load_json_list(DONE_FILE)}
    failed = {int(x) for x in load_json_list(FAIL_FILE)}
    print(f"Already moved: {len(done):,}  previously failed: {len(failed):,}", flush=True)

    scanned = 0
    total = 0
    moved = 0
    skipped = 0
    missing = 0
    fail_now = 0
    started = time.time()
    last_save = time.time()
    fields_q = urllib.parse.quote(f"id,firstName,lastName,tags,{FIELD_NAME}")
    path = f"/people?limit=100&fields={fields_q}"

    def persist() -> None:
        save_json(DONE_FILE, sorted(done))
        if failed:
            save_json(FAIL_FILE, sorted(failed))

    try:
        while path:
            _, data = fub.request("GET", path)
            meta = data.get("_metadata") or {}
            if not total:
                total = int(meta.get("total") or 0)
                print(f"FUB reports {total:,} people.\n", flush=True)
            people = data.get("people") or []
            for person in people:
                scanned += 1
                pid = int(person.get("id"))
                name = (
                    f"{person.get('firstName') or ''} {person.get('lastName') or ''}".strip()
                    or "(no name)"
                )
                tags = person_tags(person)
                found = id_tags(tags)
                current_field = str(person.get(FIELD_NAME) or "").strip()
                if pid in done and not found:
                    skipped += 1
                    continue
                if not found:
                    skipped += 1
                    done.add(pid)
                    continue

                client_id = current_field if ID_TAG_RE.match(current_field) else found[0]
                remaining = [t for t in tags if not ID_TAG_RE.match(t)]
                status, _ = fub.request(
                    "PUT",
                    f"/people/{pid}",
                    {FIELD_NAME: client_id, "tags": remaining},
                )
                if status in (200, 201, 204):
                    done.add(pid)
                    failed.discard(pid)
                    moved += 1
                    result = f"field {client_id}  dropped {len(found)} id tag(s)"
                elif status == 404:
                    done.add(pid)
                    missing += 1
                    result = "gone"
                else:
                    failed.add(pid)
                    fail_now += 1
                    result = f"failed {status}"
                elapsed = max(0.001, time.time() - started)
                eta = (total - scanned) / (scanned / elapsed) if scanned and total else 0
                print(
                    f"[{scanned:,}/{total:,}]  {pid}  {name}  {result}  "
                    f"ETA {fmt_eta(eta)}  moved +{moved:,} skipped {skipped:,} failed {fail_now}",
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

    print(
        json.dumps(
            {
                "field": FIELD_NAME,
                "people_scanned": scanned,
                "moved_this_run": moved,
                "skipped_no_id_tag": skipped,
                "already_gone_404": missing,
                "failed": len(failed),
            },
            indent=2,
        )
    )
    return 0 if not failed else 1


if __name__ == "__main__":
    raise SystemExit(main())
