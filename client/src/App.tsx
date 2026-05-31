import { useState, useRef } from 'react'

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

interface RoastResult {
  roast: string
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
  const years = ((Date.now() - new Date(createdAt).getTime()) / (1000 * 60 * 60 * 24 * 365))
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
            <p className="text-gray-400 text-sm mt-1 truncate">{profile.bio}</p>
          )}
        </div>
      </div>

      {/* Stats row */}
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

      {/* Top languages */}
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

export default function App() {
  const [username, setUsername] = useState('')
  const [style, setStyle] = useState('default')

  const [previewLoading, setPreviewLoading] = useState(false)
  const [preview, setPreview] = useState<ProfileData | null>(null)

  const [roastLoading, setRoastLoading] = useState(false)
  const [result, setResult] = useState<RoastResult | null>(null)

  const [error, setError] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)

  const loadingMsgRef = useRef(LOADING_MESSAGES[Math.floor(Math.random() * LOADING_MESSAGES.length)])

  const reset = () => {
    setPreview(null)
    setResult(null)
    setError(null)
    setUsername('')
    setPreviewLoading(false)
    setRoastLoading(false)
  }

  const handleSubmit = async () => {
    const u = username.trim()
    if (!u) return

    setError(null)
    setResult(null)
    setPreview(null)
    setPreviewLoading(true)
    loadingMsgRef.current = LOADING_MESSAGES[Math.floor(Math.random() * LOADING_MESSAGES.length)]

    // Step 1: fetch profile preview
    let profileData: ProfileData | null = null
    try {
      const res = await fetch(`/api/github/${encodeURIComponent(u)}`)
      const data = await res.json()
      if (!res.ok) {
        setError(data.error || 'Could not fetch GitHub profile.')
        setPreviewLoading(false)
        return
      }
      profileData = data
      setPreview(data)
    } catch {
      setError('Network error fetching profile. Please try again.')
      setPreviewLoading(false)
      return
    } finally {
      setPreviewLoading(false)
    }

    if (!profileData) return

    // Step 2: generate roast
    setRoastLoading(true)
    try {
      const res = await fetch('/api/roast', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: u, style }),
      })
      const data = await res.json()
      if (!res.ok) {
        setError(data.error || 'Failed to generate roast.')
      } else {
        setResult(data)
      }
    } catch {
      setError('Network error generating roast. Please try again.')
    } finally {
      setRoastLoading(false)
    }
  }

  const handleCopy = () => {
    if (result?.roast) {
      navigator.clipboard.writeText(result.roast)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    }
  }

  const isLoading = previewLoading || roastLoading

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
              onKeyDown={(e) => e.key === 'Enter' && !isLoading && handleSubmit()}
              placeholder="e.g. torvalds"
              disabled={isLoading}
              className="flex-1 bg-gray-800 border border-gray-600 rounded-xl px-4 py-3 text-white placeholder-gray-500 focus:outline-none focus:border-orange-500 transition disabled:opacity-50"
            />
            <button
              onClick={handleSubmit}
              disabled={isLoading || !username.trim()}
              className="bg-orange-500 hover:bg-orange-600 disabled:opacity-50 disabled:cursor-not-allowed text-white font-semibold px-6 py-3 rounded-xl transition"
            >
              {isLoading ? '…' : 'Roast 🔥'}
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
                  disabled={isLoading}
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

        {/* Step 1 loading: fetching profile */}
        {previewLoading && (
          <div className="text-center py-8 text-gray-400">
            <div className="text-3xl mb-3 animate-spin inline-block">⚙️</div>
            <p className="animate-pulse">Looking up GitHub profile…</p>
          </div>
        )}

        {/* Profile preview (shown while roast loads) */}
        {preview && !result && (
          <div className="mb-4">
            <ProfileCard profile={preview.profile} stats={preview.stats} />
          </div>
        )}

        {/* Step 2 loading: generating roast */}
        {roastLoading && (
          <div className="text-center py-8 text-gray-400">
            <div className="text-3xl mb-3">🎤</div>
            <p className="animate-pulse">{loadingMsgRef.current}</p>
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

        {/* Result */}
        {result && (
          <div className="space-y-4">
            <ProfileCard profile={result.profile} stats={result.stats} />

            {/* Roast box */}
            <div className="bg-gray-900 border border-orange-500/40 rounded-2xl p-6">
              <div className="text-2xl mb-3">🎤</div>
              <p className="text-gray-200 text-lg leading-relaxed whitespace-pre-wrap">
                {result.roast}
              </p>
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
            </div>
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
