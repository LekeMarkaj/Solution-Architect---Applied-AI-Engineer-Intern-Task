import { useState } from 'react'

const ROAST_STYLES = [
  { id: 'default', label: '🔥 Classic Roast' },
  { id: 'corporate', label: '💼 Corporate Jargon' },
  { id: 'pirate', label: '🏴‍☠️ Pirate' },
  { id: 'haiku', label: '🌸 Haiku' },
  { id: 'genz', label: '💅 Gen Z' },
]

interface RoastResponse {
  roast: string
  profile: {
    login: string
    name: string | null
    avatar_url: string
    public_repos: number
    followers: number
    bio: string | null
  }
}

export default function App() {
  const [username, setUsername] = useState('')
  const [style, setStyle] = useState('default')
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState<RoastResponse | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)

  const loadingMessages = [
    'Scanning your commit history for crimes against code…',
    'Analyzing your README.md (or lack thereof)…',
    'Counting your abandoned projects…',
    'Judging your variable names…',
    'Preparing the roast…',
  ]
  const [loadingMsg] = useState(() =>
    loadingMessages[Math.floor(Math.random() * loadingMessages.length)]
  )

  const handleRoast = async () => {
    if (!username.trim()) return
    setLoading(true)
    setResult(null)
    setError(null)

    try {
      const res = await fetch('/api/roast', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: username.trim(), style }),
      })

      const data = await res.json()

      if (!res.ok) {
        setError(data.error || 'Something went wrong.')
      } else {
        setResult(data)
      }
    } catch {
      setError('Network error. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  const handleCopy = () => {
    if (result?.roast) {
      navigator.clipboard.writeText(result.roast)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    }
  }

  const handleReset = () => {
    setResult(null)
    setError(null)
    setUsername('')
  }

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

        {/* Input */}
        <div className="bg-gray-900 border border-gray-700 rounded-2xl p-6 mb-6">
          <label className="block text-sm font-medium text-gray-400 mb-2">
            GitHub Username
          </label>
          <div className="flex gap-3">
            <input
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleRoast()}
              placeholder="e.g. torvalds"
              className="flex-1 bg-gray-800 border border-gray-600 rounded-xl px-4 py-3 text-white placeholder-gray-500 focus:outline-none focus:border-orange-500 transition"
            />
            <button
              onClick={handleRoast}
              disabled={loading || !username.trim()}
              className="bg-orange-500 hover:bg-orange-600 disabled:opacity-50 disabled:cursor-not-allowed text-white font-semibold px-6 py-3 rounded-xl transition"
            >
              {loading ? '…' : 'Roast 🔥'}
            </button>
          </div>

          {/* Style Picker */}
          <div className="mt-4">
            <label className="block text-sm font-medium text-gray-400 mb-2">
              Roast Style
            </label>
            <div className="flex flex-wrap gap-2">
              {ROAST_STYLES.map((s) => (
                <button
                  key={s.id}
                  onClick={() => setStyle(s.id)}
                  className={`px-4 py-2 rounded-full text-sm font-medium transition border ${
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

        {/* Loading */}
        {loading && (
          <div className="text-center py-12 text-gray-400 animate-pulse">
            <div className="text-3xl mb-3">⏳</div>
            <p>{loadingMsg}</p>
          </div>
        )}

        {/* Error */}
        {error && (
          <div className="bg-red-900/30 border border-red-700 rounded-2xl p-6 text-red-300">
            <p className="font-medium">⚠️ {error}</p>
            <button
              onClick={handleReset}
              className="mt-3 text-sm text-red-400 hover:text-red-300 underline"
            >
              Try again
            </button>
          </div>
        )}

        {/* Result */}
        {result && (
          <div className="space-y-4">
            {/* Profile Card */}
            <div className="bg-gray-900 border border-gray-700 rounded-2xl p-5 flex items-center gap-4">
              <img
                src={result.profile.avatar_url}
                alt={result.profile.login}
                className="w-16 h-16 rounded-full border-2 border-orange-500"
              />
              <div>
                <p className="text-white font-semibold text-lg">
                  {result.profile.name || result.profile.login}
                </p>
                <p className="text-gray-400 text-sm">@{result.profile.login}</p>
                <p className="text-gray-500 text-sm">
                  {result.profile.public_repos} repos · {result.profile.followers} followers
                </p>
              </div>
            </div>

            {/* Roast Box */}
            <div className="bg-gray-900 border border-orange-500/40 rounded-2xl p-6 relative">
              <div className="text-2xl mb-3">🎤</div>
              <p className="text-gray-200 text-lg leading-relaxed whitespace-pre-wrap">
                {result.roast}
              </p>
              <div className="mt-4 flex gap-3">
                <button
                  onClick={handleCopy}
                  className="text-sm text-gray-400 hover:text-white border border-gray-600 hover:border-gray-400 px-4 py-2 rounded-lg transition"
                >
                  {copied ? '✅ Copied!' : '📋 Copy'}
                </button>
                <button
                  onClick={handleReset}
                  className="text-sm text-gray-400 hover:text-white border border-gray-600 hover:border-gray-400 px-4 py-2 rounded-lg transition"
                >
                  🔄 Roast Another
                </button>
              </div>
            </div>
          </div>
        )}
      </div>

      <footer className="mt-16 text-gray-600 text-sm text-center">
        Powered by Groq + GitHub API · No repos were harmed in the making of this roast.
      </footer>
    </div>
  )
}
