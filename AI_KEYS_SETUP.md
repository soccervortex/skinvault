# AI / Experimentation Keys Setup (Statsig, Hypertune)

This project does **not** use OpenAI/Anthropic/Gemini API keys for in-app chat at the moment.

The only “AI/experimentation style” keys referenced in the codebase are:

- **Statsig** (feature flags + experiments)
  - `STATSIG_SERVER_SECRET_KEY` (server)
  - `NEXT_PUBLIC_STATSIG_CLIENT_KEY` (client)
- **Hypertune** (placeholder integration)
  - `HYPERTUNE_API_KEY` (server)

This guide shows exactly how to create those keys and where to put them.

---

## 0) Where to store keys

- Put secrets in **`.env.local`** (local dev) or your deployment provider’s **environment variables**.
- **Never commit** secrets to Git.
- Only variables prefixed with `NEXT_PUBLIC_` are exposed to the browser.

---

## 1) Statsig (Feature Flags / Experiments)

### 1.1 Create a Statsig project
1. Go to the Statsig Console: https://console.statsig.com/
2. Create a new project (e.g. `SkinVaults`).

### 1.2 Get the keys
In Statsig project settings you will find:

- **Server Secret Key** (secret)
  - Used by: `src/app/lib/statsig.ts`
  - Env var: `STATSIG_SERVER_SECRET_KEY`

- **Client SDK Key** (public)
  - Used by: `src/app/lib/statsig-client.ts`
  - Env var: `NEXT_PUBLIC_STATSIG_CLIENT_KEY`

### 1.3 Add to `.env.local`
```bash
# Statsig
STATSIG_SERVER_SECRET_KEY=your_statsig_server_secret
NEXT_PUBLIC_STATSIG_CLIENT_KEY=your_statsig_client_key
```

### 1.4 Verify it works
- Server-side flags:
  - Code uses `initializeStatsig()` in `src/app/lib/statsig.ts`
  - If the key is missing, it logs: `Statsig server secret key not found. Feature flags will be disabled.`

- Client-side flags:
  - Code uses `StatsigClient` in `src/app/lib/statsig-client.ts`
  - If the key is missing, it logs: `Statsig client key not found. Feature flags will be disabled.`

### 1.5 Security notes
- **Do not** use `NEXT_PUBLIC_` for the server secret.
- Rotate keys if you believe they were exposed.

---

## 2) Hypertune (Placeholder)

Hypertune is currently a placeholder integration (not fully wired) in:
- `src/app/lib/hypertune.ts`

### 2.1 Create a Hypertune project
1. Go to Hypertune docs: https://docs.hypertune.com/getting-started/nextjs
2. Create a project and obtain an API key.

### 2.2 Add the key to `.env.local`
```bash
# Hypertune
HYPERTUNE_API_KEY=your_hypertune_api_key
```

### 2.3 Generate typed code (if you enable Hypertune)
The file indicates you must run codegen:
```bash
npx hypertune generate
```
Then replace the placeholder calls in `src/app/lib/hypertune.ts` with the generated client.

---

## 3) Common mistakes

- **Putting server secrets in `NEXT_PUBLIC_*`** (this leaks them to users).
- **Forgetting to set env vars in production** (it works locally but not on the deployed site).
- **Using different keys across environments** without knowing which one is active.

---

## 4) Quick checklist

- [ ] `STATSIG_SERVER_SECRET_KEY` set (server)
- [ ] `NEXT_PUBLIC_STATSIG_CLIENT_KEY` set (client)
- [ ] (Optional) `HYPERTUNE_API_KEY` set
- [ ] `.env.local` is not committed

---

If you *do* plan to add in-app LLM features (OpenAI/Anthropic/etc.), tell me which provider you want and I’ll extend this document with the correct step-by-step for that provider and the exact env var names we’ll use in the code.
