import { useState, useRef, useEffect } from 'react'

const ROAST_STYLES = [
  { id: 'default', label: '🔥 Classic Roast' },
  { id: 'corporate', label: '💼 Corporate' },
  { id: 'pirate', label: '🏴‍☠️ Pirate' },
  { id: 'haiku', label: '🌸 Haiku' },
  { id: 'genz', label: '💅 Gen Z' },
]

const LOADING_MESSAGES = [
  'Scanning commit history for crimes against code…',
  'Analyzing README.md (or lack thereof)…',
  'Counting abandoned projects…',
  'Judging variable names…',
  'Consulting the ancient scrolls of Stack Overflow…',
  'Measuring the ratio of todos to actual code…',
]

interface GitHubProfile {
  login: string
  name: string | null
  avatar_url: string
  bio: string | null
  location?: string | null
  public_repos: number
  followers: number
  following: number
  created_at?: string
}

interface RepoStats {
  topLanguages: { lang: string; count: number }[]
  totalStars: number
  ownRepos: number
  forkedRepos: number
  lastPushed?: string
  mostStarred: { name: string; stars: number; language: string | null }[]
}

interface ProfileData {
  profile: GitHubProfile
  stats: RepoStats
}

const LANG_COLORS: Record<string, string> = {
  JavaScript: 'bg-yellow-500/20 text-yellow-300 border-yellow-500/30',
  TypeScript: 'bg-blue-500/20 text-blue-300 border-blue-500/30',
  Python: 'bg-green-500/20 text-green-300 border-green-500/30',
  Rust: 'bg-orange-500/20 text-orange-300 border-orange-500/30',
  Go: 'bg-cyan-500/20 text-cyan-300 border-cyan-500/30',
  Java: 'bg-red-500/20 text-red-300 border-red-500/30',
  'C++': 'bg-purple-500/20 text-purple-300 border-purple-500/30',
  C: 'bg-gray-500/20 text-gray-300 border-gray-500/30',
  Ruby: 'bg-pink-500/20 text-pink-300 border-pink-500/30',
  PHP: 'bg-indigo-500/20 text-indigo-300 border-indigo-500/30',
  Swift: 'bg-orange-400/20 text-orange-200 border-orange-400/30',
  Kotlin: 'bg-violet-500/20 text-violet-300 border-violet-500/30',
  Shell: 'bg-green-700/20 text-green-400 border-green-700/30',
  HTML: 'bg-orange-600/20 text-orange-300 border-orange-600/30',
  CSS: 'bg-blue-600/20 text-blue-300 border-blue-600/30',
}

function langClass(lang: string) {
  return LANG_COLORS[lang] || 'bg-gray-700/40 text-gray-300 border-gray-600/40'
}

function accountAge(createdAt?: string) {
  if (!createdAt) return null
  const years = (Date.now() - new Date(createdAt).getTime()) / (1000 * 60 * 60 * 24 * 365)
  if (years < 1) return `${Math.floor(years * 12)}mo old`
  return `${years.toFixed(1)}yr old`
}

function ProfileCard({ profile, stats }: ProfileData) {
  const age = accountAge(profile.created_at)
  return (
    <div className="bg-gray-900 border border-gray-700 rounded-2xl p-5">
      <div className="flex items-start gap-4">
        <img
          src={profile.avatar_url}
          alt={profile.login}
          className="w-16 h-16 rounded-full border-2 border-orange-500 shrink-0"
        />
        <div className="flex-1 min-w-0">
          <p className="text-white font-semibold text-lg leading-tight">
            {profile.name || profile.login}
          </p>
          <p className="text-gray-400 text-sm">@{profile.login}</p>
          {profile.bio && (
            <p className="text-gray-400 text-sm mt-1 line-clamp-2">{profile.bio}</p>
          )}
        </div>
      </div>

      <div className="mt-4 grid grid-cols-4 gap-2 text-center">
        {[
          { label: 'Repos', value: profile.public_repos },
          { label: 'Stars', value: stats.totalStars },
          { label: 'Followers', value: profile.followers },
          { label: 'Age', value: age ?? '—' },
        ].map(({ label, value }) => (
          <div key={label} className="bg-gray-800 rounded-xl py-2 px-1">
            <p className="text-white font-bold text-sm">{value}</p>
            <p className="text-gray-500 text-xs">{label}</p>
          </div>
        ))}
      </div>

      {stats.topLanguages.length > 0 && (
        <div className="mt-3 flex flex-wrap gap-2">
          {stats.topLanguages.map(({ lang, count }) => (
            <span
              key={lang}
              className={`text-xs px-2.5 py-1 rounded-full border font-medium ${langClass(lang)}`}
            >
              {lang} · {count}
            </span>
          ))}
        </div>
      )}
    </div>
  )
}

// Blinking cursor component
function Cursor() {
  const [visible, setVisible] = useState(true)
  useEffect(() => {
    const t = setInterval(() => setVisible((v) => !v), 530)
    return () => clearInterval(t)
  }, [])
  return (
    <span className={`inline-block w-0.5 h-5 ml-0.5 bg-orange-400 align-middle transition-opacity ${visible ? 'opacity-100' : 'opacity-0'}`} />
  )
}

export default function App() {
  const [username, setUsername] = useState('')
  const [style, setStyle] = useState('default')

  const [previewLoading, setPreviewLoading] = useState(false)
  const [preview, setPreview] = useState<ProfileData | null>(null)

  const [roastLoading, setRoastLoading] = useState(false)
  const [streaming, setStreaming] = useState(false)
  const [roastText, setRoastText] = useState('')
  const [roastDone, setRoastDone] = useState(false)

  const [error, setError] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)

  const loadingMsgRef = useRef(LOADING_MESSAGES[0])
  const abortRef = useRef<AbortController | null>(null)

  const reset = () => {
    abortRef.current?.abort()
    setPreview(null)
    setRoastText('')
    setRoastDone(false)
    setStreaming(false)
    setRoastLoading(false)
    setPreviewLoading(false)
    setError(null)
    setUsername('')
  }

  const handleSubmit = async () => {
    const u = username.trim()
    if (!u) return

    // Cancel any ongoing stream
    abortRef.current?.abort()
    abortRef.current = new AbortController()

    setError(null)
    setRoastText('')
    setRoastDone(false)
    setStreaming(false)
    setPreview(null)

    loadingMsgRef.current =
      LOADING_MESSAGES[Math.floor(Math.random() * LOADING_MESSAGES.length)]

    // ── Step 1: fetch profile preview ──────────────────────────────────────────
    setPreviewLoading(true)
    let profileData: ProfileData | null = null
    try {
      const res = await fetch(`/api/github/${encodeURIComponent(u)}`, {
        signal: abortRef.current.signal,
      })
      const data = await res.json()
      if (!res.ok) {
        setError(data.error || 'Could not fetch GitHub profile.')
        return
      }
      profileData = data
      setPreview(data)
    } catch (err: unknown) {
      if ((err as Error).name !== 'AbortError') {
        setError('Network error fetching profile. Please try again.')
      }
      return
    } finally {
      setPreviewLoading(false)
    }

    if (!profileData) return

    // ── Step 2: stream roast via SSE ───────────────────────────────────────────
    setRoastLoading(true)
    try {
      const res = await fetch('/api/roast', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: u, style }),
        signal: abortRef.current.signal,
      })

      // If server returned a JSON error (before streaming started)
      const contentType = res.headers.get('content-type') || ''
      if (!res.ok || contentType.includes('application/json')) {
        const data = await res.json()
        setError(data.error || 'Failed to generate roast.')
        return
      }

      // It's an SSE stream — read it
      setRoastLoading(false)
      setStreaming(true)

      const reader = res.body!.getReader()
      const decoder = new TextDecoder()
      let buffer = ''

      while (true) {
        const { done, value } = await reader.read()
        if (done) break

        buffer += decoder.decode(value, { stream: true })

        // SSE lines are separated by \n\n; split on newlines and process
        const lines = buffer.split('\n')
        buffer = lines.pop() ?? ''

        for (const line of lines) {
          if (!line.startsWith('data: ')) continue
          const raw = line.slice(6).trim()
          if (!raw) continue

          try {
            const event = JSON.parse(raw)
            if (event.type === 'token') {
              setRoastText((prev) => prev + event.text)
            } else if (event.type === 'done') {
              setStreaming(false)
              setRoastDone(true)
            } else if (event.type === 'error') {
              setError(event.message)
              setStreaming(false)
            }
          } catch {
            // malformed SSE line — skip
          }
        }
      }
    } catch (err: unknown) {
      if ((err as Error).name !== 'AbortError') {
        setError('Network error generating roast. Please try again.')
      }
      setStreaming(false)
    } finally {
      setRoastLoading(false)
    }
  }

  const handleCopy = () => {
    if (roastText) {
      navigator.clipboard.writeText(roastText)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    }
  }

  const isActive = previewLoading || roastLoading || streaming
  const showRoastBox = roastText.length > 0

  return (
    <div className="min-h-screen flex flex-col items-center justify-start px-4 py-16">
      <div className="w-full max-w-2xl">

        {/* Header */}
        <div className="text-center mb-10">
          <div className="text-6xl mb-4">🔥</div>
          <h1 className="text-4xl font-bold text-white mb-2">Roast My GitHub</h1>
          <p className="text-gray-400 text-lg">
            Enter a GitHub username and get an AI-powered roast based on their public repos.
          </p>
        </div>

        {/* Input card */}
        <div className="bg-gray-900 border border-gray-700 rounded-2xl p-6 mb-6">
          <label className="block text-sm font-medium text-gray-400 mb-2">
            GitHub Username
          </label>
          <div className="flex gap-3">
            <input
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && !isActive && handleSubmit()}
              placeholder="e.g. torvalds"
              disabled={isActive}
              className="flex-1 bg-gray-800 border border-gray-600 rounded-xl px-4 py-3 text-white placeholder-gray-500 focus:outline-none focus:border-orange-500 transition disabled:opacity-50"
            />
            <button
              onClick={handleSubmit}
              disabled={isActive || !username.trim()}
              className="bg-orange-500 hover:bg-orange-600 disabled:opacity-50 disabled:cursor-not-allowed text-white font-semibold px-6 py-3 rounded-xl transition"
            >
              {isActive ? '…' : 'Roast 🔥'}
            </button>
          </div>

          {/* Style picker */}
          <div className="mt-4">
            <label className="block text-sm font-medium text-gray-400 mb-2">
              Roast Style
            </label>
            <div className="flex flex-wrap gap-2">
              {ROAST_STYLES.map((s) => (
                <button
                  key={s.id}
                  onClick={() => setStyle(s.id)}
                  disabled={isActive}
                  className={`px-4 py-2 rounded-full text-sm font-medium transition border disabled:opacity-50 ${
                    style === s.id
                      ? 'bg-orange-500 border-orange-500 text-white'
                      : 'bg-gray-800 border-gray-600 text-gray-300 hover:border-orange-500'
                  }`}
                >
                  {s.label}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Step 1: profile fetch loading */}
        {previewLoading && (
          <div className="text-center py-8 text-gray-400">
            <div className="text-3xl mb-3 animate-spin inline-block">⚙️</div>
            <p className="animate-pulse">Looking up GitHub profile…</p>
          </div>
        )}

        {/* Profile card (shown while roast generates + after) */}
        {preview && (
          <div className="mb-4">
            <ProfileCard profile={preview.profile} stats={preview.stats} />
          </div>
        )}

        {/* Step 2: roast fetch loading (before stream starts) */}
        {roastLoading && (
          <div className="text-center py-8 text-gray-400">
            <div className="text-3xl mb-3">🎤</div>
            <p className="animate-pulse">{loadingMsgRef.current}</p>
          </div>
        )}

        {/* Roast streaming / result box */}
        {showRoastBox && (
          <div className="bg-gray-900 border border-orange-500/40 rounded-2xl p-6">
            <div className="text-2xl mb-3">🎤</div>
            <p className="text-gray-200 text-lg leading-relaxed whitespace-pre-wrap">
              {roastText}
              {streaming && <Cursor />}
            </p>

            {roastDone && (
              <div className="mt-5 flex flex-wrap gap-3">
                <button
                  onClick={handleCopy}
                  className="text-sm text-gray-400 hover:text-white border border-gray-600 hover:border-gray-400 px-4 py-2 rounded-lg transition"
                >
                  {copied ? '✅ Copied!' : '📋 Copy roast'}
                </button>
                <button
                  onClick={reset}
                  className="text-sm text-gray-400 hover:text-white border border-gray-600 hover:border-gray-400 px-4 py-2 rounded-lg transition"
                >
                  🔄 Roast another
                </button>
              </div>
            )}
          </div>
        )}

        {/* Error */}
        {error && (
          <div className="bg-red-900/30 border border-red-700 rounded-2xl p-6 text-red-300">
            <p className="font-medium">⚠️ {error}</p>
            <button
              onClick={reset}
              className="mt-3 text-sm text-red-400 hover:text-red-300 underline"
            >
              Try again
            </button>
          </div>
        )}
      </div>

      <footer className="mt-16 text-gray-600 text-sm text-center">
        Powered by Groq · llama-3.3-70b · GitHub API
        <br />
        No repos were harmed in the making of this roast.
      </footer>
    </div>
  )
}
