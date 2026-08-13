# FANAA

> **A private journal.** Every entry is markdown that gets encrypted on this
> machine — **gpg, AES-256** — *before* it ever leaves, then stored as a `.gpg`
> blob in **Cloudflare R2**. Nothing leaves unencrypted.

---

## Features

**Write — a real vim buffer**
- The whole app is a terminal: entries are edited in **CodeMirror with full vim emulation** (`@replit/codemirror-vim`) — every key works: `hjkl`, `w/e/b`, `d/y/p`, `gg/G`, visual modes, registers, macros, and real `vim-mode-change` status.
- **Ex commands** from `:` — `:w` save, `:q` save + back to the list, `:q!` leave without saving.
- **Autosave** ~0.9 s after the last keystroke (plus on tab-hide/unload) with a `:w — written` status; failures retry every 3 s.
- Search inside the buffer with `/` (incremental, match highlighting) — and it lives on the OS clipboard too: yanked text lands on your system clipboard.
- Display prefs per browser — **font size, background, font color, highlight color** from the editor toolbar — applied straight to the buffer.
- **New entries start with `# Untitled`**; the first heading becomes the title, live.

**Navigate — vim-flavored everywhere**
- Journal **list / calendar** (`c` to toggle); `j/k` move, `Enter`/`l` open, `gg`/`G` top/bottom, `n` new entry, `v` toggle select, `d` delete (confirmation), `/` **grep search**, `:` commands (`:q` lock, `:e` new, `:w` refresh, `:h` help), `?` help, `r` reload.
- **Grep search** — full-text across every entry (decrypted on demand) with result snippets; navigate with `j/k`, open with `Enter`, back with `q`.
- Press `Home` anywhere to jump back to the journal.

**Protect**
- **PIN lock** — 4+ digit PIN, scrypt-hashed in the bucket, server-rendered lock screen with zero content flash; lock manually, after inactivity, or when switching tabs.
- **Hash-key gate** *(optional)* — one key for the whole app: it is asked on every open until you **Log out** from Settings, and the data APIs are guarded too (session cookie, not just the UI).

**Read & manage**
- **Stats** — entries, total words, day streak, written today.
- **Export** — the whole journal as a `.zip` backup (plaintext markdown).

## How it stores your data

Everything lives in one R2 bucket (under `R2_FOLDER/` when set):

| Object | Content |
| --- | --- |
| `<slug>.gpg` | a page, markdown encrypted with `gpg --symmetric --cipher-algo AES256` |
| `index.json` | *plaintext* metadata `{ slug → title, updatedAt, date, words }`, so list/calendar/stats never download + decrypt every file |
| `lock.json` | scrypt salt + hash of the optional lock PIN |

Flow:

```
your browser ──PUT /api/pages──▶ Next.js server
                                     │ markdown
                                     ▼
                        gpg --symmetric --cipher-algo AES256
                                     │ .gpg binary
                                     ▼
                              Cloudflare R2  (key: <slug>.gpg)
```

## Getting started

Requires **Node 18+**, **gpg ≥ 2.1** on the machine that runs the app.

```bash
npm install
cp .env.example .env   # then fill it in
npm run dev            # → http://localhost:3000
```

### Environment variables

| Variable | Required | Description |
| --- | --- | --- |
| `R2_ACCOUNT_ID` | ✓ | Cloudflare R2 account id (subdomain of `*.r2.cloudflarestorage.com`) |
| `R2_ACCESS_KEY_ID` | ✓ | R2 API token access key |
| `R2_SECRET_ACCESS_KEY` | ✓ | R2 API token secret |
| `R2_BUCKET_NAME` | ✓ | Bucket that holds the journal |
| `R2_FOLDER` | | Put all objects under this subfolder (e.g. `journal/`) — empty = bucket root |
| `ENC_PASSPHRASE` | ✓ | Passphrase for the `gpg` encryption. **Changing it later makes old pages undecryptable.** |
| `APP_HASH_KEY` | | Optional "gate" key (or its SHA-256 hex) → the hash-key login appears on open until Log out. Empty = off |
| `R2_ENDPOINT` | | Dev only: point at `scripts/mock-r2.mjs` instead of real Cloudflare |

Create the bucket from the Cloudflare dashboard and an API token with **Object Read & Write** on it.

### Running without Cloudflare

A tiny in-memory S3-only mock ships in `scripts/mock-r2.mjs`, so the whole app runs with **zero external credentials**:

```bash
# terminal 1
R2_ENDPOINT=http://127.0.0.1:9099 \
R2_ACCOUNT_ID=local R2_ACCESS_KEY_ID=test R2_SECRET_ACCESS_KEY=test \
R2_BUCKET_NAME=test-bucket ENC_PASSPHRASE=whatever node scripts/mock-r2.mjs

# terminal 2: same env vars + R2_ENDPOINT, then npm run dev
```

### Deployment

```bash
npm run build && npm run start
```
Set every env var on the host (the bucket key, passphrase, optional gate key). Serve over **HTTPS** — the hash-key session cookie is set `secure` when `NODE_ENV=production`. Remember gpg must be available on the server; it does the encryption from there.

## Security notes

- **Real protection** is the data at rest — `ENC_PASSPHRASE` + AES-256. The PIN and the hash key are access gates for the app: they stop casual access, not someone with the server.
- Every page is **decrypted server-side** only when you open it; the browser never sees another entry.
- `APP_HASH_KEY` set → `api/*` routes answer `401` without a valid session cookie.
- Backups are **plaintext** markdown — store the `.zip` somewhere safe.

## Scripts

| Command | What it does |
| --- | --- |
| `npm run dev` | dev server (HMR) |
| `npm run build` | production build |
| `npm run start` | run the production build |
| `npm run lint` | eslint |
| `node scripts/mock-r2.mjs` | local S3 mock for R2 |