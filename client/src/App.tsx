import { useState, useRef, useEffect, useCallback } from 'react'

// ── Constants ──────────────────────────────────────────────────────────────────

const ROAST_STYLES = [
  { id: 'default',   label: '🔥 Classic',   desc: 'Straight fire' },
  { id: 'corporate', label: '💼 Corporate',  desc: 'Synergy overload' },
  { id: 'pirate',    label: '🏴‍☠️ Pirate',    desc: 'Arr, matey' },
  { id: 'haiku',     label: '🌸 Haiku',      desc: '5 · 7 · 5' },
  { id: 'genz',      label: '💅 Gen Z',      desc: 'No cap fr fr' },
]

const LOADING_MESSAGES = [
  'Scanning commit history for crimes against code…',
  'Analyzing your README.md (or lack thereof)…',
  'Counting abandoned side-projects…',
  'Judging your variable names…',
  'Consulting the ancient scrolls of Stack Overflow…',
  'Measuring your todos-to-done ratio…',
  'Tallying up forked repos you never touched…',
  'Calculating your bus factor (spoiler: it\'s 1)…',
]

// ── Types ──────────────────────────────────────────────────────────────────────

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

type ErrorKind = 'not_found' | 'rate_limit' | 'network' | 'generic'

interface AppError {
  kind: ErrorKind
  message: string
}

// ── Language colours ───────────────────────────────────────────────────────────

const LANG_COLORS: Record<string, string> = {
  JavaScript: 'bg-yellow-500/15 text-yellow-300 border-yellow-500/25',
  TypeScript: 'bg-blue-500/15 text-blue-300 border-blue-500/25',
  Python:     'bg-green-500/15 text-green-300 border-green-500/25',
  Rust:       'bg-orange-500/15 text-orange-300 border-orange-500/25',
  Go:         'bg-cyan-500/15 text-cyan-300 border-cyan-500/25',
  Java:       'bg-red-500/15 text-red-300 border-red-500/25',
  'C++':      'bg-purple-500/15 text-purple-300 border-purple-500/25',
  C:          'bg-gray-500/15 text-gray-300 border-gray-500/25',
  Ruby:       'bg-pink-500/15 text-pink-300 border-pink-500/25',
  PHP:        'bg-indigo-500/15 text-indigo-300 border-indigo-500/25',
  Swift:      'bg-orange-400/15 text-orange-200 border-orange-400/25',
  Kotlin:     'bg-violet-500/15 text-violet-300 border-violet-500/25',
  Shell:      'bg-emerald-700/15 text-emerald-400 border-emerald-700/25',
  HTML:       'bg-orange-600/15 text-orange-300 border-orange-600/25',
  CSS:        'bg-blue-600/15 text-blue-300 border-blue-600/25',
  Dart:       'bg-sky-500/15 text-sky-300 border-sky-500/25',
  Lua:        'bg-indigo-400/15 text-indigo-300 border-indigo-400/25',
}

function langClass(lang: string) {
  return LANG_COLORS[lang] ?? 'bg-gray-700/30 text-gray-300 border-gray-600/30'
}

// ── Helpers ────────────────────────────────────────────────────────────────────

function accountAge(createdAt?: string): string | null {
  if (!createdAt) return null
  const years = (Date.now() - new Date(createdAt).getTime()) / (1000 * 60 * 60 * 24 * 365)
  if (years < 1) return `${Math.floor(years * 12)}mo`
  return `${years.toFixed(1)}y`
}

function classifyError(message: string): ErrorKind {
  const m = message.toLowerCase()
  if (m.includes('not found'))   return 'not_found'
  if (m.includes('rate limit'))  return 'rate_limit'
  if (m.includes('network') || m.includes('reach')) return 'network'
  return 'generic'
}

function formatNumber(n: number): string {
  if (n >= 1000) return `${(n / 1000).toFixed(1)}k`
  return String(n)
}

// ── Sub-components ─────────────────────────────────────────────────────────────

function ProfileSkeleton() {
  return (
    <div className="bg-[#161b22] border border-[#30363d] rounded-2xl p-5 animate-fade-in-up">
      <div className="flex items-start gap-4">
        <div className="skeleton w-16 h-16 rounded-full shrink-0" />
        <div className="flex-1 space-y-2 pt-1">
          <div className="skeleton h-4 w-32 rounded" />
          <div className="skeleton h-3 w-20 rounded" />
          <div className="skeleton h-3 w-48 rounded" />
        </div>
      </div>
      <div className="mt-4 grid grid-cols-4 gap-2">
        {[...Array(4)].map((_, i) => (
          <div key={i} className="skeleton h-12 rounded-xl" />
        ))}
      </div>
      <div className="mt-3 flex gap-2">
        {[...Array(3)].map((_, i) => (
          <div key={i} className="skeleton h-6 w-20 rounded-full" />
        ))}
      </div>
    </div>
  )
}

function ProfileCard({ profile, stats }: ProfileData) {
  const age = accountAge(profile.created_at)
  return (
    <div className="bg-[#161b22] border border-[#30363d] rounded-2xl p-5 animate-fade-in-up">
      <div className="flex items-start gap-4">
        <div className="relative shrink-0">
          <img
            src={profile.avatar_url}
            alt={profile.login}
            className="w-16 h-16 rounded-full border-2 border-orange-500/70"
          />
          <span className="absolute -bottom-0.5 -right-0.5 text-base">🔥</span>
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <p className="text-white font-semibold text-lg leading-tight">
              {profile.name || profile.login}
            </p>
            {profile.location && (
              <span className="text-gray-500 text-xs">📍 {profile.location}</span>
            )}
          </div>
          <a
            href={`https://github.com/${profile.login}`}
            target="_blank"
            rel="noreferrer"
            className="text-gray-500 text-sm hover:text-orange-400 transition"
          >
            @{profile.login}
          </a>
          {profile.bio && (
            <p className="text-gray-400 text-sm mt-1.5 line-clamp-2 leading-snug italic">
              "{profile.bio}"
            </p>
          )}
        </div>
      </div>

      {/* Stats grid */}
      <div className="mt-4 grid grid-cols-4 gap-2 text-center">
        {[
          { label: 'Repos',     value: formatNumber(profile.public_repos), icon: '📁' },
          { label: 'Stars',     value: formatNumber(stats.totalStars),     icon: '⭐' },
          { label: 'Followers', value: formatNumber(profile.followers),    icon: '👥' },
          { label: 'Age',       value: age ?? '—',                         icon: '📅' },
        ].map(({ label, value, icon }) => (
          <div key={label} className="bg-[#0d1117] rounded-xl py-2.5 px-1">
            <p className="text-base mb-0.5">{icon}</p>
            <p className="text-white font-bold text-sm">{value}</p>
            <p className="text-gray-600 text-xs">{label}</p>
          </div>
        ))}
      </div>

      {/* Language badges */}
      {stats.topLanguages.length > 0 && (
        <div className="mt-3 flex flex-wrap gap-1.5">
          {stats.topLanguages.map(({ lang, count }) => (
            <span
              key={lang}
              className={`text-xs px-2.5 py-0.5 rounded-full border font-medium ${langClass(lang)}`}
            >
              {lang} <span className="opacity-60">×{count}</span>
            </span>
          ))}
        </div>
      )}
    </div>
  )
}

function ErrorCard({ error, onReset }: { error: AppError; onReset: () => void }) {
  const configs: Record<ErrorKind, { icon: string; title: string; color: string; border: string }> = {
    not_found: {
      icon: '🔍',
      title: 'User not found',
      color: 'text-amber-300',
      border: 'border-amber-700/50',
    },
    rate_limit: {
      icon: '⏱️',
      title: 'GitHub rate limit hit',
      color: 'text-yellow-300',
      border: 'border-yellow-700/50',
    },
    network: {
      icon: '🌐',
      title: 'Connection error',
      color: 'text-blue-300',
      border: 'border-blue-700/50',
    },
    generic: {
      icon: '⚠️',
      title: 'Something went wrong',
      color: 'text-red-300',
      border: 'border-red-700/50',
    },
  }

  const cfg = configs[error.kind]

  return (
    <div className={`bg-[#161b22] border ${cfg.border} rounded-2xl p-6 animate-fade-in-up`}>
      <div className="flex items-start gap-3">
        <span className="text-3xl shrink-0">{cfg.icon}</span>
        <div>
          <p className={`font-semibold text-base ${cfg.color}`}>{cfg.title}</p>
          <p className="text-gray-400 text-sm mt-1">{error.message}</p>
        </div>
      </div>
      <button
        onClick={onReset}
        className="mt-4 text-sm text-gray-500 hover:text-white border border-[#30363d] hover:border-gray-500 px-4 py-2 rounded-lg transition"
      >
        ← Try a different username
      </button>
    </div>
  )
}

function RotatingMessage({ active }: { active: boolean }) {
  const [index, setIndex]   = useState(0)
  const [visible, setVisible] = useState(true)

  useEffect(() => {
    if (!active) return
    const cycle = setInterval(() => {
      setVisible(false)
      setTimeout(() => {
        setIndex((i) => (i + 1) % LOADING_MESSAGES.length)
        setVisible(true)
      }, 300)
    }, 2800)
    return () => clearInterval(cycle)
  }, [active])

  if (!active) return null

  return (
    <div className="text-center py-8">
      <div className="text-3xl mb-3 animate-flame">🎤</div>
      <p
        className="text-gray-400 text-sm transition-all duration-300"
        style={{ opacity: visible ? 1 : 0, transform: visible ? 'translateY(0)' : 'translateY(4px)' }}
      >
        {LOADING_MESSAGES[index]}
      </p>
    </div>
  )
}

function BlinkCursor() {
  return (
    <span
      className="inline-block align-middle ml-0.5 w-0.5 bg-orange-400 animate-cursor"
      style={{ height: '1.1em' }}
    />
  )
}

// ── Main App ───────────────────────────────────────────────────────────────────

export default function App() {
  const [username, setUsername] = useState('')
  const [style, setStyle]       = useState('default')

  const [previewLoading, setPreviewLoading] = useState(false)
  const [preview, setPreview]               = useState<ProfileData | null>(null)

  const [roastLoading, setRoastLoading] = useState(false)
  const [streaming, setStreaming]       = useState(false)
  const [roastText, setRoastText]       = useState('')
  const [roastDone, setRoastDone]       = useState(false)

  const [error, setError]   = useState<AppError | null>(null)
  const [copied, setCopied] = useState(false)

  const abortRef = useRef<AbortController | null>(null)

  const reset = useCallback(() => {
    abortRef.current?.abort()
    setPreview(null)
    setRoastText('')
    setRoastDone(false)
    setStreaming(false)
    setRoastLoading(false)
    setPreviewLoading(false)
    setError(null)
    setUsername('')
  }, [])

  const makeError = (message: string): AppError => ({
    kind: classifyError(message),
    message,
  })

  const handleSubmit = async () => {
    const u = username.trim()
    if (!u) return

    abortRef.current?.abort()
    abortRef.current = new AbortController()

    setError(null)
    setRoastText('')
    setRoastDone(false)
    setStreaming(false)
    setPreview(null)

    // ── Step 1: profile preview ────────────────────────────────────────────────
    setPreviewLoading(true)
    let profileData: ProfileData | null = null
    try {
      const res  = await fetch(`/api/github/${encodeURIComponent(u)}`, { signal: abortRef.current.signal })
      const data = await res.json()
      if (!res.ok) { setError(makeError(data.error ?? 'Could not fetch GitHub profile.')); return }
      profileData = data
      setPreview(data)
    } catch (err: unknown) {
      if ((err as Error).name !== 'AbortError')
        setError(makeError('Network error fetching profile. Please try again.'))
      return
    } finally {
      setPreviewLoading(false)
    }

    if (!profileData) return

    // ── Step 2: stream roast ───────────────────────────────────────────────────
    setRoastLoading(true)
    try {
      const res = await fetch('/api/roast', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ username: u, style }),
        signal:  abortRef.current.signal,
      })

      const ct = res.headers.get('content-type') ?? ''
      if (!res.ok || ct.includes('application/json')) {
        const data = await res.json()
        setError(makeError(data.error ?? 'Failed to generate roast.'))
        return
      }

      setRoastLoading(false)
      setStreaming(true)

      const reader  = res.body!.getReader()
      const decoder = new TextDecoder()
      let buffer    = ''

      while (true) {
        const { done, value } = await reader.read()
        if (done) break

        buffer += decoder.decode(value, { stream: true })
        const lines = buffer.split('\n')
        buffer = lines.pop() ?? ''

        for (const line of lines) {
          if (!line.startsWith('data: ')) continue
          const raw = line.slice(6).trim()
          if (!raw) continue
          try {
            const event = JSON.parse(raw)
            if      (event.type === 'token') setRoastText((p) => p + event.text)
            else if (event.type === 'done')  { setStreaming(false); setRoastDone(true) }
            else if (event.type === 'error') { setError(makeError(event.message)); setStreaming(false) }
          } catch { /* skip malformed */ }
        }
      }
    } catch (err: unknown) {
      if ((err as Error).name !== 'AbortError')
        setError(makeError('Network error generating roast. Please try again.'))
      setStreaming(false)
    } finally {
      setRoastLoading(false)
    }
  }

  const handleCopy = () => {
    if (!roastText) return
    navigator.clipboard.writeText(roastText)
    setCopied(true)
    setTimeout(() => setCopied(false), 2200)
  }

  const isActive     = previewLoading || roastLoading || streaming
  const showRoastBox = roastText.length > 0

  return (
    <div className="min-h-screen flex flex-col items-center px-4 py-16">
      <div className="w-full max-w-2xl">

        {/* ── Header ──────────────────────────────────────────────────────────── */}
        <div className="text-center mb-10">
          <div className="text-6xl mb-4 animate-flame select-none">🔥</div>
          <h1 className="text-5xl font-extrabold gradient-text mb-3 tracking-tight">
            Roast My GitHub
          </h1>
          <p className="text-gray-400 text-base max-w-sm mx-auto leading-relaxed">
            Drop a GitHub username. Get a friendly, AI-powered roast based on their public repos.
          </p>
        </div>

        {/* ── Input card ──────────────────────────────────────────────────────── */}
        <div className="bg-[#161b22] border border-[#30363d] rounded-2xl p-6 mb-5">
          <label className="block text-xs font-semibold text-gray-500 uppercase tracking-widest mb-2">
            GitHub Username
          </label>
          <div className="flex gap-2.5">
            <div className="flex-1 relative">
              <span className="github-prefix absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-500 text-sm select-none">
                github.com /
              </span>
              <input
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && !isActive && handleSubmit()}
                placeholder="torvalds"
                disabled={isActive}
                className="username-input w-full bg-[#0d1117] border border-[#30363d] rounded-xl pl-24 pr-4 py-3 text-white placeholder-gray-600 transition disabled:opacity-50"
              />
            </div>
            <button
              onClick={handleSubmit}
              disabled={isActive || !username.trim()}
              className="bg-orange-500 hover:bg-orange-400 active:bg-orange-600 disabled:opacity-40 disabled:cursor-not-allowed text-white font-bold px-6 py-3 rounded-xl transition-all duration-150 shrink-0"
            >
              {isActive ? (
                <span className="inline-flex items-center gap-2">
                  <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24" fill="none">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z"/>
                  </svg>
                  Working…
                </span>
              ) : (
                'Roast 🔥'
              )}
            </button>
          </div>

          {/* ── Style picker ────────────────────────────────────────────────── */}
          <div className="mt-5">
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-widest mb-2.5">
              Roast Style
            </p>
            <div className="flex flex-wrap gap-2">
              {ROAST_STYLES.map((s) => (
                <button
                  key={s.id}
                  onClick={() => setStyle(s.id)}
                  disabled={isActive}
                  title={s.desc}
                  className={`px-3.5 py-1.5 rounded-full text-sm font-medium transition-all duration-150 border disabled:opacity-40 ${
                    style === s.id
                      ? 'bg-orange-500 border-orange-400 text-white style-btn-active'
                      : 'bg-[#0d1117] border-[#30363d] text-gray-400 hover:border-orange-500/60 hover:text-gray-200'
                  }`}
                >
                  {s.label}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* ── Profile skeleton ────────────────────────────────────────────────── */}
        {previewLoading && <div className="mb-4"><ProfileSkeleton /></div>}

        {/* ── Profile card ────────────────────────────────────────────────────── */}
        {preview && !error && (
          <div className="mb-4">
            <ProfileCard profile={preview.profile} stats={preview.stats} />
          </div>
        )}

        {/* ── Roast loading spinner ────────────────────────────────────────────── */}
        {roastLoading && <RotatingMessage active={true} />}

        {/* ── Roast box ───────────────────────────────────────────────────────── */}
        {showRoastBox && (
          <div className={`roast-box bg-[#161b22] rounded-2xl p-6 animate-fade-in-up ${streaming ? 'streaming' : ''}`}>
            {/* Header row */}
            <div className="flex items-center gap-2 mb-4 pb-4 border-b border-[#21262d]">
              <span className="text-2xl">🎤</span>
              <div>
                <p className="text-white font-semibold text-sm">The Roast</p>
                <p className="text-gray-600 text-xs">
                  {ROAST_STYLES.find((s) => s.id === style)?.label ?? 'Classic Roast'} · llama-3.3-70b
                </p>
              </div>
              {streaming && (
                <span className="ml-auto flex items-center gap-1.5 text-orange-400 text-xs font-medium">
                  <span className="inline-block w-1.5 h-1.5 rounded-full bg-orange-400 animate-pulse" />
                  Live
                </span>
              )}
            </div>

            {/* Roast text */}
            <p className="text-gray-100 text-[1.05rem] leading-[1.75] whitespace-pre-wrap font-[450] tracking-wide">
              {roastText}
              {streaming && <BlinkCursor />}
            </p>

            {/* Actions — only after done */}
            {roastDone && (
              <div className="mt-6 pt-4 border-t border-[#21262d] flex flex-wrap gap-2 animate-fade-in">
                <button
                  onClick={handleCopy}
                  className="inline-flex items-center gap-1.5 text-sm text-gray-400 hover:text-white border border-[#30363d] hover:border-gray-500 px-4 py-2 rounded-lg transition"
                >
                  {copied ? '✅ Copied!' : '📋 Copy roast'}
                </button>
                <button
                  onClick={reset}
                  className="inline-flex items-center gap-1.5 text-sm text-gray-400 hover:text-white border border-[#30363d] hover:border-gray-500 px-4 py-2 rounded-lg transition"
                >
                  🔄 Roast another
                </button>
                <a
                  href={`https://github.com/${preview?.profile.login}`}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-1.5 text-sm text-gray-400 hover:text-white border border-[#30363d] hover:border-gray-500 px-4 py-2 rounded-lg transition"
                >
                  👤 View profile
                </a>
              </div>
            )}
          </div>
        )}

        {/* ── Error card ──────────────────────────────────────────────────────── */}
        {error && <ErrorCard error={error} onReset={reset} />}
      </div>

      {/* ── Footer ────────────────────────────────────────────────────────────── */}
      <footer className="mt-20 text-gray-700 text-xs text-center space-y-1 pb-8">
        <p>Powered by <span className="text-gray-500">Groq</span> · <span className="text-gray-500">llama-3.3-70b</span> · <span className="text-gray-500">GitHub API</span></p>
        <p>No repos were harmed in the making of this roast.</p>
      </footer>
    </div>
  )
}
