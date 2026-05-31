import express from 'express'
import cors from 'cors'
import Groq from 'groq-sdk'

const app = express()
const PORT = 3001

app.use(cors({ origin: '*' }))
app.use(express.json())

const groq = new Groq({ apiKey: process.env.GROQ_API_KEY })

const STYLE_PROMPTS = {
  default: 'You are a witty comedian doing a friendly, light-hearted roast. Be funny and specific but never mean-spirited.',
  corporate: 'You are a consultant who speaks exclusively in corporate jargon and buzzwords. Translate their GitHub activity into synergy-filled corporate speak while roasting them.',
  pirate: 'You are a pirate captain roasting a fellow seafarer. Use pirate slang, nautical metaphors, and old English pirate speak. Arr!',
  haiku: 'You are a haiku master. Roast the developer using only haikus (5-7-5 syllable structure). Write 3-4 haikus about their coding habits.',
  genz: 'You are Gen Z roasting someone. Use Gen Z slang, abbreviations, and references. Be chaotic and unhinged in a funny way. No cap.',
}

app.post('/api/roast', async (req, res) => {
  const { username, style = 'default' } = req.body

  if (!username) {
    return res.status(400).json({ error: 'Username is required.' })
  }

  try {
    // Fetch GitHub profile
    const profileRes = await fetch(`https://api.github.com/users/${username}`, {
      headers: { 'User-Agent': 'RoastMyGitHub/1.0' },
    })

    if (profileRes.status === 404) {
      return res.status(404).json({ error: `GitHub user "${username}" not found. Check the username and try again.` })
    }

    if (!profileRes.ok) {
      return res.status(502).json({ error: 'Could not reach the GitHub API. Try again in a moment.' })
    }

    const profile = await profileRes.json()

    // Fetch public repos
    const reposRes = await fetch(
      `https://api.github.com/users/${username}/repos?sort=updated&per_page=10&type=public`,
      { headers: { 'User-Agent': 'RoastMyGitHub/1.0' } }
    )

    const repos = reposRes.ok ? await reposRes.json() : []

    // Build summary for the LLM
    const repoSummary = repos.length === 0
      ? 'No public repositories.'
      : repos.map((r) => {
          const parts = [`- ${r.name}`]
          if (r.description) parts.push(`(${r.description})`)
          if (r.language) parts.push(`[${r.language}]`)
          parts.push(`⭐${r.stargazers_count}`)
          if (r.fork) parts.push(`(forked)`)
          return parts.join(' ')
        }).join('\n')

    const languages = [...new Set(repos.map((r) => r.language).filter(Boolean))]
    const forkCount = repos.filter((r) => r.fork).length
    const ownRepos = repos.length - forkCount

    const userContext = `
GitHub user: ${profile.login}
Name: ${profile.name || 'No name set'}
Bio: ${profile.bio || 'No bio'}
Public repos: ${profile.public_repos}
Followers: ${profile.followers}
Following: ${profile.following}
Account created: ${profile.created_at?.slice(0, 10) || 'unknown'}
Languages used (recent repos): ${languages.join(', ') || 'None detected'}
Own repos (non-forks): ${ownRepos}, Forked repos: ${forkCount}

Recent repositories:
${repoSummary}
`.trim()

    const systemPrompt = STYLE_PROMPTS[style] || STYLE_PROMPTS.default

    const completion = await groq.chat.completions.create({
      model: 'llama-3.3-70b-versatile',
      messages: [
        { role: 'system', content: systemPrompt },
        {
          role: 'user',
          content: `Here is the GitHub profile data. Give a roast (2-4 paragraphs or equivalent) that is funny, specific to their actual repos/data, and friendly:\n\n${userContext}`,
        },
      ],
      temperature: 0.9,
      max_tokens: 600,
    })

    const roast = completion.choices[0]?.message?.content?.trim() || 'Could not generate roast.'

    return res.json({
      roast,
      profile: {
        login: profile.login,
        name: profile.name,
        avatar_url: profile.avatar_url,
        public_repos: profile.public_repos,
        followers: profile.followers,
        bio: profile.bio,
      },
    })
  } catch (err) {
    console.error('Roast error:', err)
    return res.status(500).json({ error: 'Internal server error. Please try again.' })
  }
})

app.get('/api/health', (_req, res) => res.json({ ok: true }))

app.listen(PORT, 'localhost', () => {
  console.log(`Server running on http://localhost:${PORT}`)
})
