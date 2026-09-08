import { useEffect, useRef, useState } from 'react'
import { useStore } from '../store'
import { useT } from '../lib/useT'
import { Modal } from './Modal'

type Mode = 'login' | 'register'

// Modal global de inicio de sesión / registro. Se abre desde el store
// (openAuth) o automáticamente cuando el backend responde 401.
export function AuthModal() {
  const { authOpen, closeAuth, login, register, googleClientId, theme } =
    useStore()
  const t = useT()
  const [mode, setMode] = useState<Mode>('login')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [name, setName] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (authOpen) {
      setError(null)
      setPassword('')
    }
  }, [authOpen])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    if (!email.trim() || !password) {
      setError(t('auth.errRequired'))
      return
    }
    if (mode === 'register' && password.length < 8) {
      setError(t('auth.errPassword'))
      return
    }
    setSaving(true)
    try {
      if (mode === 'login') await login({ email: email.trim(), password })
      else
        await register({
          email: email.trim(),
          password,
          name: name.trim() || undefined,
        })
    } catch (err) {
      setError(err instanceof Error ? err.message : t('auth.errGeneric'))
    } finally {
      setSaving(false)
    }
  }

  return (
    <Modal
      open={authOpen}
      onClose={closeAuth}
      title={mode === 'login' ? t('auth.loginTitle') : t('auth.registerTitle')}
    >
      <p className="mb-4 text-sm text-slate-400">{t('auth.why')}</p>

      <div className="mb-4 grid grid-cols-2 gap-1 rounded-2xl bg-white/5 p-1">
        {(['login', 'register'] as Mode[]).map((m) => (
          <button
            key={m}
            type="button"
            onClick={() => {
              setMode(m)
              setError(null)
            }}
            className={`rounded-xl px-3 py-2 text-sm font-semibold transition ${
              mode === m
                ? 'bg-neon-gradient text-white'
                : 'text-slate-300 hover:bg-white/10'
            }`}
          >
            {m === 'login' ? t('auth.login') : t('auth.register')}
          </button>
        ))}
      </div>

      <form onSubmit={handleSubmit} className="flex flex-col gap-3">
        {mode === 'register' && (
          <input
            className="input"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder={t('auth.namePh')}
            autoComplete="name"
            maxLength={80}
          />
        )}
        <input
          className="input"
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder={t('auth.emailPh')}
          autoComplete="email"
          required
        />
        <input
          className="input"
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder={t('auth.passwordPh')}
          autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
          minLength={mode === 'register' ? 8 : undefined}
          maxLength={128}
          required
        />
        {mode === 'register' && (
          <p className="text-xs text-slate-500">{t('auth.passwordHint')}</p>
        )}
        {error && <p className="text-sm text-rose-300">{error}</p>}
        <button type="submit" disabled={saving} className="btn-primary w-full">
          {saving
            ? t('common.saving')
            : mode === 'login'
              ? t('auth.login')
              : t('auth.register')}
        </button>
      </form>

      {googleClientId && (
        <>
          <div className="my-4 flex items-center gap-3 text-xs uppercase tracking-widest text-slate-500">
            <span className="h-px flex-1 bg-white/10" />
            {t('auth.or')}
            <span className="h-px flex-1 bg-white/10" />
          </div>
          <GoogleButton
            clientId={googleClientId}
            dark={theme === 'dark'}
            onError={(msg) => setError(msg)}
          />
        </>
      )}
    </Modal>
  )
}

// --- Google Identity Services ------------------------------------------------

const GIS_SRC = 'https://accounts.google.com/gsi/client'

interface GoogleAccounts {
  accounts: {
    id: {
      initialize: (cfg: {
        client_id: string
        callback: (r: { credential: string }) => void
      }) => void
      renderButton: (el: HTMLElement, opts: Record<string, string | number>) => void
    }
  }
}

declare global {
  interface Window {
    google?: GoogleAccounts
  }
}

let gisLoading: Promise<GoogleAccounts> | null = null

function loadGis(): Promise<GoogleAccounts> {
  if (window.google) return Promise.resolve(window.google)
  if (!gisLoading) {
    gisLoading = new Promise((resolve, reject) => {
      const script = document.createElement('script')
      script.src = GIS_SRC
      script.async = true
      script.onload = () =>
        window.google ? resolve(window.google) : reject(new Error('gis'))
      script.onerror = () => {
        gisLoading = null
        reject(new Error('gis'))
      }
      document.head.appendChild(script)
    })
  }
  return gisLoading
}

function GoogleButton({
  clientId,
  dark,
  onError,
}: {
  clientId: string
  dark: boolean
  onError: (msg: string) => void
}) {
  const t = useT()
  const ref = useRef<HTMLDivElement>(null)
  const loginWithGoogle = useStore((s) => s.loginWithGoogle)
  const [failed, setFailed] = useState(false)

  useEffect(() => {
    let cancelled = false
    loadGis()
      .then((google) => {
        if (cancelled || !ref.current) return
        google.accounts.id.initialize({
          client_id: clientId,
          callback: ({ credential }) => {
            loginWithGoogle(credential).catch((err) =>
              onError(err instanceof Error ? err.message : t('auth.errGeneric')),
            )
          },
        })
        ref.current.innerHTML = ''
        google.accounts.id.renderButton(ref.current, {
          theme: dark ? 'filled_black' : 'outline',
          size: 'large',
          shape: 'pill',
          width: 320,
          text: 'continue_with',
        })
      })
      .catch(() => {
        if (!cancelled) setFailed(true)
      })
    return () => {
      cancelled = true
    }
  }, [clientId, dark])

  if (failed) {
    return <p className="text-center text-xs text-slate-500">{t('auth.googleUnavailable')}</p>
  }
  return <div ref={ref} className="flex min-h-[44px] justify-center" />
}
