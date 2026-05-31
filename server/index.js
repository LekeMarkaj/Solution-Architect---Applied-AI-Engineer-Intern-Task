import express from 'express'
import cors from 'cors'
import Groq from 'groq-sdk'
import { fileURLToPath } from 'url'
import { dirname, join } from 'path'
import { existsSync } from 'fs'

const __filename = fileURLToPath(import.meta.url)
const __dirname  = dirname(__filename)

const isProd = process.env.NODE_ENV === 'production'
const PORT   = isProd ? (parseInt(process.env.PORT) || 5000) : 3001

const app = express()

app.use(cors({ origin: '*' }))
app.use(express.json())

const groq = new Groq({ apiKey: process.env.GROQ_API_KEY })

const STYLE_PROMPTS = {
  default: 'You are a witty comedian doing a friendly, light-hearted roast. Be funny and specific but never mean-spirited.',
  corporate:
    'You are a management consultant who speaks exclusively in corporate jargon and buzzwords. Translate their GitHub activity into synergy-filled corporate speak while roasting them. Use terms like "leverage", "paradigm shift", "circle back", "bandwidth", "boil the ocean".',
  pirate:
    'You are a pirate captain roasting a fellow seafarer. Use pirate slang, nautical metaphors, and old English pirate speak throughout. Arr!',
  haiku:
    'You are a haiku master. Roast the developer using ONLY haikus (strict 5-7-5 syllable structure). Write exactly 4 haikus about their coding habits, repos, and career. Label each haiku with a Roman numeral.',
  genz:
    'You are a Gen Z developer roasting someone. Use Gen Z slang: "slay", "lowkey", "no cap", "bussin", "understood the assignment", "rent free", "it\'s giving", "based". Be chaotic and unhinged in a funny way.',
}

// ─── GitHub helpers ───────────────────────────────────────────────────────────

function githubFetch(path) {
  const headers = { 'User-Agent': 'RoastMyGitHub/1.0' }
  if (process.env.GITHUB_TOKEN) {
    headers['Authorization'] = `Bearer ${process.env.GITHUB_TOKEN}`
  }
  return fetch(`https://api.github.com${path}`, { headers })
}

function checkRateLimit(res) {
  const remaining = res.headers.get('X-RateLimit-Remaining')
  const reset = res.headers.get('X-RateLimit-Reset')
  if ((res.status === 403 || res.status === 429) && remaining === '0') {
    const resetTime = reset
      ? new Date(parseInt(reset) * 1000).toLocaleTimeString()
      : 'soon'
    return `GitHub API rate limit exceeded. Resets at ${resetTime}.`
  }
  return null
}

function analyzeRepos(repos) {
  const ownRepos = repos.filter((r) => !r.fork)
  const forkedRepos = repos.filter((r) => r.fork)

  const langMap = {}
  for (const r of ownRepos) {
    if (r.language) langMap[r.language] = (langMap[r.language] || 0) + 1
  }
  const topLanguages = Object.entries(langMap)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([lang, count]) => ({ lang, count }))

  const totalStars = repos.reduce((sum, r) => sum + r.stargazers_count, 0)
  const mostStarred = [...repos]
    .sort((a, b) => b.stargazers_count - a.stargazers_count)
    .slice(0, 3)

  const lastPushed = repos
    .map((r) => r.pushed_at)
    .filter(Boolean)
    .sort()
    .reverse()[0]

  const noDescriptionCount = ownRepos.filter((r) => !r.description).length
  const genericNames = ownRepos
    .map((r) => r.name.toLowerCase())
    .filter((n) =>
      ['test', 'hello-world', 'untitled', 'project', 'demo', 'practice', 'learning'].some(
        (g) => n.includes(g)
      )
    )

  return { ownRepos, forkedRepos, topLanguages, totalStars, mostStarred, lastPushed, noDescriptionCount, genericNames }
}

function buildUserContext(profile, repos, analysis) {
  const accountAgeYears = profile.created_at
    ? ((Date.now() - new Date(profile.created_at).getTime()) / (1000 * 60 * 60 * 24 * 365)).toFixed(1)
    : 'unknown'

  const repoLines = repos.slice(0, 15).map((r) => {
    const parts = [`- ${r.name}`]
    if (r.description) parts.push(`"${r.description}"`)
    if (r.language) parts.push(`[${r.language}]`)
    parts.push(`⭐${r.stargazers_count}`)
    if (r.fork) parts.push(`(forked)`)
    if (!r.description) parts.push(`(no description)`)
    return parts.join(' ')
  })

  // Edge-case notes for the LLM
  const notes = []
  if (profile.public_repos === 0)
    notes.push('⚠️ This user has ZERO public repositories. Roast the emptiness, the potential, or the mystery.')
  else if (analysis.ownRepos.length === 0 && analysis.forkedRepos.length > 0)
    notes.push('⚠️ Every single repo here is a fork — this person has no original public work.')
  if (parseFloat(accountAgeYears) < 0.25)
    notes.push('⚠️ Brand new account (less than 3 months old). Roast the fresh-faced newcomer.')
  if (analysis.totalStars === 0 && profile.public_repos > 5)
    notes.push('⚠️ Zero stars across all repos. Nobody has starred anything.')
  if (profile.followers === 0 && profile.public_repos > 3)
    notes.push('⚠️ Zero followers despite having repos. A legend in their own mind.')

  return `
GitHub user: ${profile.login}
Display name: ${profile.name || 'Not set'}
Bio: ${profile.bio || 'No bio written'}
Location: ${profile.location || 'Unknown'}
Website: ${profile.blog || 'None'}
Account age: ${accountAgeYears} years
Public repos: ${profile.public_repos}
Followers: ${profile.followers} | Following: ${profile.following}
Top languages: ${analysis.topLanguages.map((l) => `${l.lang} (${l.count} repos)`).join(', ') || 'None detected'}
Total stars earned: ${analysis.totalStars}
Own repos: ${analysis.ownRepos.length} | Forked repos: ${analysis.forkedRepos.length}
Repos without a description: ${analysis.noDescriptionCount}
Generic/test repo names: ${analysis.genericNames.join(', ') || 'None'}
Last repo activity: ${analysis.lastPushed ? analysis.lastPushed.slice(0, 10) : 'Unknown'}

Most starred repos:
${analysis.mostStarred.length ? analysis.mostStarred.map((r) => `- ${r.name} (⭐${r.stargazers_count})`).join('\n') : 'None'}

${repoLines.length ? `All recent repos:\n${repoLines.join('\n')}` : 'No public repos.'}

${notes.length ? `Special notes for roast:\n${notes.join('\n')}` : ''}
`.trim()
}

// ─── SSE helper ───────────────────────────────────────────────────────────────

function sendSSE(res, event) {
  res.write(`data: ${JSON.stringify(event)}\n\n`)
}

// ─── Routes ───────────────────────────────────────────────────────────────────

// GET /api/github/:username — profile preview (used before roast)
app.get('/api/github/:username', async (req, res) => {
  const { username } = req.params

  try {
    const [profileRes, reposRes] = await Promise.all([
      githubFetch(`/users/${username}`),
      githubFetch(`/users/${username}/repos?sort=updated&per_page=30&type=public`),
    ])

    if (profileRes.status === 404) {
      return res.status(404).json({ error: `GitHub user "${username}" not found.` })
    }

    const rateLimitError = checkRateLimit(profileRes)
    if (rateLimitError) return res.status(429).json({ error: rateLimitError })

    if (!profileRes.ok) {
      return res.status(502).json({ error: 'Could not reach the GitHub API. Try again in a moment.' })
    }

    const profile = await profileRes.json()
    const repos = reposRes.ok ? await reposRes.json() : []

    if (!Array.isArray(repos)) {
      return res.status(502).json({ error: 'Unexpected response from GitHub. Try again.' })
    }

    const analysis = analyzeRepos(repos)

    return res.json({
      profile: {
        login: profile.login,
        name: profile.name,
        avatar_url: profile.avatar_url,
        bio: profile.bio,
        location: profile.location,
        blog: profile.blog,
        public_repos: profile.public_repos,
        followers: profile.followers,
        following: profile.following,
        created_at: profile.created_at,
      },
      stats: {
        topLanguages: analysis.topLanguages,
        totalStars: analysis.totalStars,
        ownRepos: analysis.ownRepos.length,
        forkedRepos: analysis.forkedRepos.length,
        lastPushed: analysis.lastPushed,
        mostStarred: analysis.mostStarred.map((r) => ({
          name: r.name,
          stars: r.stargazers_count,
          language: r.language,
        })),
      },
    })
  } catch (err) {
    console.error('GitHub fetch error:', err)
    return res.status(500).json({ error: 'Internal server error. Please try again.' })
  }
})

// POST /api/roast — streaming SSE roast generation
app.post('/api/roast', async (req, res) => {
  const { username, style = 'default' } = req.body

  if (!username) {
    return res.status(400).json({ error: 'Username is required.' })
  }

  // ── Step 1: fetch GitHub data (errors returned as plain JSON before streaming) ──
  let profile, repos, analysis
  try {
    const [profileRes, reposRes] = await Promise.all([
      githubFetch(`/users/${username}`),
      githubFetch(`/users/${username}/repos?sort=updated&per_page=30&type=public`),
    ])

    if (profileRes.status === 404) {
      return res.status(404).json({ error: `GitHub user "${username}" not found.` })
    }

    const rateLimitError = checkRateLimit(profileRes)
    if (rateLimitError) return res.status(429).json({ error: rateLimitError })

    if (!profileRes.ok) {
      return res.status(502).json({ error: 'Could not reach the GitHub API. Try again in a moment.' })
    }

    profile = await profileRes.json()
    repos = reposRes.ok ? await reposRes.json() : []

    if (!Array.isArray(repos)) {
      return res.status(502).json({ error: 'Unexpected GitHub response. Try again.' })
    }

    analysis = analyzeRepos(repos)
  } catch (err) {
    console.error('GitHub fetch error (roast):', err)
    return res.status(502).json({ error: 'Failed to fetch GitHub data. Please try again.' })
  }

  // ── Step 2: switch to SSE streaming ──────────────────────────────────────────
  res.setHeader('Content-Type', 'text/event-stream')
  res.setHeader('Cache-Control', 'no-cache')
  res.setHeader('Connection', 'keep-alive')
  res.setHeader('X-Accel-Buffering', 'no')
  res.flushHeaders()

  // Send profile/stats as first event so frontend can update its card
  sendSSE(res, {
    type: 'meta',
    profile: {
      login: profile.login,
      name: profile.name,
      avatar_url: profile.avatar_url,
      bio: profile.bio,
      public_repos: profile.public_repos,
      followers: profile.followers,
      following: profile.following,
      created_at: profile.created_at,
    },
    stats: {
      topLanguages: analysis.topLanguages,
      totalStars: analysis.totalStars,
      ownRepos: analysis.ownRepos.length,
      forkedRepos: analysis.forkedRepos.length,
      mostStarred: analysis.mostStarred.map((r) => ({
        name: r.name,
        stars: r.stargazers_count,
        language: r.language,
      })),
    },
  })

  // Handle client disconnect
  let aborted = false
  req.on('close', () => { aborted = true })

  // ── Step 3: stream Groq response ─────────────────────────────────────────────
  try {
    const userContext = buildUserContext(profile, repos, analysis)
    const systemPrompt = STYLE_PROMPTS[style] || STYLE_PROMPTS.default

    const stream = await groq.chat.completions.create({
      model: 'llama-3.3-70b-versatile',
      messages: [
        { role: 'system', content: systemPrompt },
        {
          role: 'user',
          content: `Here is the GitHub profile data. Write a roast (2-4 paragraphs or equivalent) that is funny, specific to their actual repos and data, and friendly. Reference real repo names, languages, and stats:\n\n${userContext}`,
        },
      ],
      temperature: 0.9,
      max_tokens: 700,
      stream: true,
    })

    for await (const chunk of stream) {
      if (aborted) break
      const text = chunk.choices[0]?.delta?.content || ''
      if (text) {
        sendSSE(res, { type: 'token', text })
      }
    }

    if (!aborted) {
      sendSSE(res, { type: 'done' })
    }
  } catch (err) {
    console.error('Groq streaming error:', err)

    // Distinguish Groq rate limit from other errors
    const isGroqRateLimit = err?.status === 429
    const message = isGroqRateLimit
      ? 'Groq API rate limit hit. Wait a moment and try again.'
      : 'Failed to generate roast. Please try again.'

    if (!aborted) {
      sendSSE(res, { type: 'error', message })
    }
  } finally {
    res.end()
  }
})

app.get('/api/health', (_req, res) => res.json({ ok: true }))

// ─── Production: serve Vite build + SPA fallback ─────────────────────────────
if (isProd) {
  const distPath = join(__dirname, '../client/dist')
  if (existsSync(distPath)) {
    app.use(express.static(distPath))
    app.get('*', (_req, res) => {
      res.sendFile(join(distPath, 'index.html'))
    })
  }
}

const host = isProd ? '0.0.0.0' : 'localhost'
app.listen(PORT, host, () => {
  console.log(`Server running on http://${host}:${PORT} [${isProd ? 'production' : 'development'}]`)
})
