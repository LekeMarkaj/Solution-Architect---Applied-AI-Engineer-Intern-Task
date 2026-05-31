# 🔥 Roast My GitHub

An AI-powered web app that roasts developers based on their public GitHub activity. Enter a username, pick a style, and get a savage (but friendly) breakdown of your repos, commit habits, and career choices — streamed live from Groq's `llama-3.3-70b-versatile` model.

**Live demo:** [solution-architect-applied-ai-engineer-intern-task--markajleka.replit.app](https://solution-architect-applied-ai-engineer-intern-task--markajleka.replit.app) *(deployed on Replit Autoscale)*

---

## What It Does

1. You enter a GitHub username (or paste a full repo URL — it figures it out)
2. The backend fetches your public profile + up to 30 repos from the GitHub REST API
3. It builds a rich context: top languages, star counts, fork ratio, account age, repos with no descriptions, generic-named projects, abandoned side projects
4. That context is sent to Groq (llama-3.3-70b-versatile) as a structured prompt
5. The roast streams back token-by-token via Server-Sent Events and types out on screen

**5 roast styles:**
| Style | Vibe |
|-------|------|
| 🔥 Classic | Witty stand-up comedian |
| 💼 Corporate | Management consultant drowning in jargon |
| 🏴‍☠️ Pirate | Nautical metaphors, arr |
| 🌸 Haiku | 4 strict 5-7-5 haikus about your code |
| 💅 Gen Z | No cap, it's giving unhinged fr fr |

---

## How to Run It

### Prerequisites
- Node.js 18+
- A [Groq API key](https://console.groq.com) (free tier works fine)

### Setup

```bash
# Clone the repo
git clone https://github.com/LekeMarkaj/Solution-Architect---Applied-AI-Engineer-Intern-Task.git
cd Solution-Architect---Applied-AI-Engineer-Intern-Task

# Install root + server dependencies
npm install
npm --prefix server install

# Install client dependencies
npm --prefix client install
```

Create a `.env` file in the `server/` directory:

```
GROQ_API_KEY=your_groq_api_key_here
```

Optionally add a GitHub token to raise the API rate limit from 60 → 5,000 req/hour:

```
GITHUB_TOKEN=your_github_personal_access_token
```

### Run in development

```bash
npm run dev
```

This starts two processes concurrently:
- **Express backend** on `http://localhost:3001`
- **Vite + React frontend** on `http://localhost:5000`

The Vite dev server proxies `/api` requests to the backend automatically.

### Build for production

```bash
npm run build        # builds client/dist
npm start            # serves everything from Express on port 5000
```

In production, Express serves the Vite build as static files and handles the SPA fallback — single process, single port.

---

## Stack

| Layer | Tech |
|-------|------|
| Frontend | React 19, Vite 6, TypeScript, Tailwind CSS 4 |
| Backend | Express 5, Node.js ESM |
| AI | Groq SDK → llama-3.3-70b-versatile |
| Streaming | Server-Sent Events (SSE) |
| Data | GitHub REST API (unauthenticated or PAT) |
| Deployment | Replit Autoscale |

---

## The Replit Prompts I Used

These are the actual prompts sent to the Replit AI agent, in order:

> **Prompt 1 — Project brief:**
> "Build 'Roast My GitHub' — a web app where users enter a GitHub username and get an AI-powered roast based on their public repos. Uses Groq (llama-3.3-70b-versatile) as the LLM, GitHub REST API for repo data, React+Vite frontend on port 5000, Express backend on port 3001. Bonus: 5 roast styles (Classic, Corporate, Pirate, Haiku, Gen Z)."

> **Prompt 2 — UI polish pass:**
> Requested skeleton loaders, rotating loading messages while the AI thinks, a profile card with stats (stars, repos, followers), language badges with per-language colours, and a typewriter cursor effect on the streamed roast output.

> **Prompt 3 — Production + deployment:**
> "Configure production build and deployment — Express should serve the Vite build as static files in production, use port 5000, listen on 0.0.0.0, Replit Autoscale target." Also added edge-case handling in the LLM prompt for zero-repo accounts, all-forked profiles, zero stars, and brand-new accounts.

> **Prompt 4 — Bug fix (input sanitisation):**
> "It doesn't seem to be finding the public repos, I keep getting this error: User not found — GitHub user 'D4Vinci/Scrapling' not found."
> → Fixed by stripping repo paths and full URLs on the client before submission (`D4Vinci/Scrapling` → `D4Vinci`), and adding a helpful hint in the server error message.

---

## Thoughtful Touches

These are the details added to show care, not just functionality:

### 1. Rotating loading messages (not a spinner)
Instead of a generic spinner, 8 context-aware loading messages cycle while the AI generates:
```
"Scanning commit history for crimes against code…"
"Analyzing your README.md (or lack thereof)…"
"Counting abandoned side-projects…"
"Judging your variable names…"
"Consulting the ancient scrolls of Stack Overflow…"
"Measuring your todos-to-done ratio…"
"Tallying up forked repos you never touched…"
"Calculating your bus factor (spoiler: it's 1)…"
```

### 2. Four distinct, typed error states
Each failure mode has its own icon, colour, and message — not a generic red box:
- 🔍 **Not found** — "That GitHub username doesn't exist" (with a tip if you pasted a repo path)
- ⏱ **Rate limit** — "GitHub API rate limit hit" with the reset time pulled from the response header
- 📡 **Network error** — "Can't reach the GitHub API right now"
- ⚠️ **Generic** — Catches anything else with the raw message

### 3. Smart input sanitisation
Users naturally copy-paste GitHub URLs or repo paths. The app silently fixes these before hitting the API:
- `https://github.com/torvalds/linux` → `torvalds`
- `torvalds/linux` → `torvalds`
- The input field updates itself so you can see the correction

### 4. Edge-case-aware roast prompts
The LLM context includes special instructions for awkward profiles that would otherwise produce a generic roast:
- Zero public repos → "Roast the emptiness, the potential, or the mystery"
- All forks, no originals → flagged explicitly
- Brand new account (< 3 months) → identified
- Zero stars despite many repos → noted
- Zero followers despite public work → noted

### 5. Skeleton loaders that match the actual layout
The loading skeleton mirrors the exact shape of the profile card (avatar circle, name line, bio line, 4-stat grid) so the transition into real content feels seamless rather than jarring.

### 6. Live typewriter streaming with cursor
The roast streams token-by-token via SSE and renders with a blinking `▍` cursor that disappears when generation completes — feels like the AI is thinking in real time.

### 7. Copy-to-clipboard with feedback
The copy button switches to a ✅ checkmark for 2 seconds after copying, confirming the action without a toast popup.

---

## What I Would Do With More Time

**Features:**
- **GitHub OAuth** — let users roast themselves with authenticated access (5,000 req/hour vs 60), and optionally share their roast as a card
- **Shareable roast URLs** — generate a `/roast/:username/:style` permalink so roasts can be shared on Twitter/X
- **Roast leaderboard** — store recent roasts (anonymised) and surface the funniest ones voted on by users
- **Repo-level roast** — roast a single repository instead of an entire profile, going deeper on the code quality signals
- **Voice roast** — pipe the streamed text through a TTS API (e.g. ElevenLabs) for an audio roast

**Technical improvements:**
- **GitHub token support in UI** — let users paste their own PAT to bypass the 60 req/hour public rate limit without needing server config
- **Response caching** — cache roasts by `(username, style)` for 10 minutes to save API calls for popular usernames
- **Abort on re-submit** — the abort controller is wired up but the stop button UX could be more prominent
- **Rate limit UI** — show a countdown to when the GitHub API resets instead of just the time string
- **E2E tests** — Playwright tests covering the happy path, not-found state, and rate limit state
- **CSP headers + helmet** — basic hardening before a real public launch
