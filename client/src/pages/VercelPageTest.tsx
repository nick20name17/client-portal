import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'

/** Raw file from https://github.com/nick20name17/test-html/blob/main/vercel-page.html */
const VERCEL_PAGE_URL =
  'https://raw.githubusercontent.com/nick20name17/test-html/main/vercel-page.html'

export function VercelPageTest() {
  const [html, setHtml] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    fetch(VERCEL_PAGE_URL)
      .then((r) => {
        if (!r.ok) throw new Error(`${r.status} ${r.statusText}`)
        return r.text()
      })
      .then((t) => {
        if (!cancelled) setHtml(t)
      })
      .catch((e: unknown) => {
        if (!cancelled)
          setError(e instanceof Error ? e.message : 'Request failed')
      })
    return () => {
      cancelled = true
    }
  }, [])

  if (error) {
    return (
      <div
        style={{
          padding: '2rem',
          fontFamily: 'system-ui, sans-serif',
          maxWidth: 520,
        }}
      >
        <p>Could not load the HTML from GitHub: {error}</p>
        <p>
          <a href={VERCEL_PAGE_URL} target="_blank" rel="noreferrer">
            Open raw file
          </a>{' '}
          ·{' '}
          <a
            href="https://github.com/nick20name17/test-html/blob/main/vercel-page.html"
            target="_blank"
            rel="noreferrer"
          >
            View on GitHub
          </a>
        </p>
        <p>
          <Link to="/">← Back</Link>
        </p>
      </div>
    )
  }

  if (!html) {
    return (
      <div
        style={{
          padding: '2rem',
          fontFamily: 'system-ui, sans-serif',
        }}
      >
        Loading…
      </div>
    )
  }

  return (
    <div style={{ position: 'relative', minHeight: '100vh' }}>
      <Link
        to="/"
        style={{
          position: 'fixed',
          top: 12,
          left: 12,
          zIndex: 10000,
          fontFamily: 'system-ui, sans-serif',
          fontSize: 14,
          color: '#fff',
          background: 'rgba(0,0,0,0.65)',
          padding: '8px 12px',
          borderRadius: 8,
          textDecoration: 'none',
        }}
      >
        ← Back to app
      </Link>
      <iframe
        title="vercel-page.html from GitHub"
        srcDoc={html}
        sandbox="allow-scripts allow-same-origin"
        style={{
          width: '100%',
          minHeight: '100vh',
          border: 'none',
          display: 'block',
        }}
      />
    </div>
  )
}
