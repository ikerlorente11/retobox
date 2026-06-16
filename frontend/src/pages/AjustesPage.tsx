import { motion } from 'framer-motion'
import { useRef, useState } from 'react'
import { useStore } from '../store'
import { Modal } from '../components/Modal'
import { DownloadIcon, ImportIcon } from '../components/icons'
import {
  EXPORT_FILENAME,
  buildRetosFileContent,
  parseRetosFile,
} from '../lib/retosFile'
import {
  GROUPS_EXPORT_FILENAME,
  buildGroupsFileContent,
  parseGroupsFile,
} from '../lib/groupsFile'
import { useT } from '../lib/i18n'

export function AjustesPage() {
  const {
    theme,
    setTheme,
    revealStyle,
    setRevealStyle,
    soundEnabled,
    setSoundEnabled,
    stats,
    resetSession,
    challenges,
    importChallenges,
    wordGroups,
    importWordGroups,
    lang,
    setLang,
  } = useStore()
  const t = useT()

  const [confirmReset, setConfirmReset] = useState(false)
  const [resetting, setResetting] = useState(false)
  const [resetCount, setResetCount] = useState<number | null>(null)

  async function handleReset() {
    setResetting(true)
    try {
      const n = await resetSession()
      setResetCount(n)
      setConfirmReset(false)
    } finally {
      setResetting(false)
    }
  }

  return (
    <div className="flex flex-col gap-5 pb-4">
      <h1 className="text-2xl font-extrabold">{t('settings.title')}</h1>

      {/* En tablet (md+) las tarjetas se reparten en 2 columnas tipo masonry
          (CSS multi-columna) para que se empaqueten sin huecos ni tarjetas
          colgando. break-inside-avoid impide que una tarjeta se parta. */}
      <div className="flex flex-col gap-5 md:block md:columns-2 md:gap-5 md:[&>section]:mb-5 md:[&>section]:break-inside-avoid">
      {/* Stats */}
      <section className="glass rounded-3xl p-5">
        <h2 className="mb-3 font-bold">{t('settings.stats')}</h2>
        <div className="grid grid-cols-2 gap-3">
          <Stat label={t('settings.statTotal')} value={stats?.total ?? 0} />
          <Stat
            label={t('settings.statAvailable')}
            value={stats?.available ?? 0}
            accent="cyan"
          />
          <Stat label={t('settings.statUsed')} value={stats?.used ?? 0} accent="pink" />
          <Stat
            label={t('settings.statUsers')}
            value={stats?.users ?? 0}
            accent="purple"
          />
        </div>
      </section>

      {/* Estilo de animación */}
      <section className="glass rounded-3xl p-5">
        <h2 className="mb-1 font-bold">{t('settings.reveal')}</h2>
        <p className="mb-4 text-sm text-slate-400">{t('settings.revealHint')}</p>
        <div className="grid grid-cols-2 gap-3">
          <StyleCard
            active={revealStyle === 'slot'}
            onClick={() => setRevealStyle('slot')}
            emoji="🎰"
            label={t('settings.slot')}
            desc={t('settings.slotDesc')}
          />
          <StyleCard
            active={revealStyle === 'dice'}
            onClick={() => setRevealStyle('dice')}
            emoji="🎲"
            label={t('settings.dice')}
            desc={t('settings.diceDesc')}
          />
        </div>
      </section>

      {/* Tema */}
      <section className="glass rounded-3xl p-5">
        <h2 className="mb-1 font-bold">{t('settings.theme')}</h2>
        <p className="mb-4 text-sm text-slate-400">{t('settings.themeHint')}</p>
        <div className="grid grid-cols-2 gap-3">
          <StyleCard
            active={theme === 'dark'}
            onClick={() => setTheme('dark')}
            emoji="🌙"
            label={t('settings.dark')}
            desc={t('settings.darkDesc')}
          />
          <StyleCard
            active={theme === 'light'}
            onClick={() => setTheme('light')}
            emoji="☀️"
            label={t('settings.light')}
            desc={t('settings.lightDesc')}
          />
        </div>
      </section>

      {/* Sonido */}
      <section className="glass flex items-center justify-between rounded-3xl p-5">
        <div>
          <h2 className="font-bold">{t('settings.sound')}</h2>
          <p className="text-sm text-slate-400">{t('settings.soundHint')}</p>
        </div>
        <Toggle
          on={soundEnabled}
          onChange={setSoundEnabled}
          label={t('settings.sound')}
        />
      </section>

      {/* Idioma (control discreto tipo segmentado ES/EN) */}
      <section className="glass flex items-center justify-between gap-3 rounded-3xl p-5">
        <div>
          <h2 className="font-bold">{t('settings.language')}</h2>
          <p className="text-sm text-slate-400">{t('settings.languageHint')}</p>
        </div>
        <div className="flex shrink-0 rounded-full bg-white/5 p-1 text-sm font-semibold">
          <button
            onClick={() => setLang('es')}
            className={`rounded-full px-3 py-1.5 transition ${
              lang === 'es' ? 'bg-neon-gradient text-white' : 'text-slate-400'
            }`}
          >
            ES
          </button>
          <button
            onClick={() => setLang('en')}
            className={`rounded-full px-3 py-1.5 transition ${
              lang === 'en' ? 'bg-neon-gradient text-white' : 'text-slate-400'
            }`}
          >
            EN
          </button>
        </div>
      </section>

      {/* Exportar / importar Retos */}
      <ExportImportCard
        title={t('settings.retosCard')}
        hint={t('settings.retosCardHint')}
        exportLabel={t('settings.exportRetos')}
        noun={t('noun.retos')}
        canExport={challenges.length > 0}
        filename={EXPORT_FILENAME}
        buildContent={() => buildRetosFileContent(challenges)}
        importFile={(text) => importChallenges(parseRetosFile(text))}
      />

      {/* Exportar / importar Combos (grupos de palabras) */}
      <ExportImportCard
        title={t('settings.combosCard')}
        hint={t('settings.combosCardHint')}
        exportLabel={t('settings.exportGroups')}
        noun={t('noun.grupos')}
        canExport={wordGroups.length > 0}
        filename={GROUPS_EXPORT_FILENAME}
        buildContent={() => buildGroupsFileContent(wordGroups)}
        importFile={(text) => importWordGroups(parseGroupsFile(text))}
      />

      {/* Reset */}
      <section className="glass rounded-3xl p-5">
        <h2 className="mb-1 font-bold">{t('settings.session')}</h2>
        <p className="mb-4 text-sm text-slate-400">{t('settings.sessionHint')}</p>
        <button
          onClick={() => setConfirmReset(true)}
          className="btn-ghost w-full"
        >
          ♻️ {t('sorteo.resetSession')}
        </button>
        {resetCount !== null && (
          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="mt-3 text-center text-sm text-emerald-300"
          >
            {t('settings.resetDone', { n: resetCount })}
          </motion.p>
        )}
      </section>

      </div>

      <p className="text-center text-xs text-slate-600">RetoBox · v1.0</p>

      <Modal
        open={confirmReset}
        onClose={() => setConfirmReset(false)}
        title={t('settings.resetConfirmTitle')}
      >
        <p className="text-sm text-slate-300">{t('settings.resetConfirmBody')}</p>
        <div className="mt-5 flex gap-3">
          <button
            onClick={() => setConfirmReset(false)}
            className="btn-ghost flex-1"
          >
            {t('common.cancel')}
          </button>
          <button
            onClick={handleReset}
            disabled={resetting}
            className="btn-primary flex-1"
          >
            {resetting ? t('sorteo.resetting') : t('sorteo.resetSession')}
          </button>
        </div>
      </Modal>
    </div>
  )
}

// Tarjeta reutilizable de exportar/importar (se usa para Retos y para Combos).
function ExportImportCard({
  title,
  hint,
  exportLabel,
  noun,
  canExport,
  filename,
  buildContent,
  importFile,
}: {
  title: string
  hint: string
  exportLabel: string
  noun: string
  canExport: boolean
  filename: string
  buildContent: () => string
  importFile: (text: string) => Promise<{ imported: number; skipped: number }>
}) {
  const t = useT()
  const inputRef = useRef<HTMLInputElement>(null)
  const [importing, setImporting] = useState(false)
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null)

  // Descarga el fichero. Mantiene el objeto URL vivo un momento (revocarlo justo
  // tras el click aborta la descarga en algunos navegadores).
  function download() {
    const blob = new Blob([buildContent()], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = filename
    a.rel = 'noopener'
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    setTimeout(() => URL.revokeObjectURL(url), 2000)
    setMsg({ ok: true, text: t('settings.exportedTo', { file: filename }) })
  }

  async function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    e.target.value = '' // permite volver a elegir el mismo fichero
    if (!file) return
    setImporting(true)
    setMsg(null)
    try {
      const res = await importFile(await file.text())
      setMsg({
        ok: true,
        text:
          res.imported === 0
            ? t('settings.importNothing', { n: res.skipped })
            : t('settings.importDone', {
                imported: res.imported,
                noun,
                extra:
                  res.skipped > 0
                    ? t('settings.importDoneExtra', { n: res.skipped })
                    : '',
              }),
      })
    } catch (err) {
      setMsg({
        ok: false,
        text: err instanceof Error ? err.message : t('settings.importError'),
      })
    } finally {
      setImporting(false)
    }
  }

  return (
    <section className="glass rounded-3xl p-5">
      <h2 className="mb-1 font-bold">{title}</h2>
      <p className="mb-4 text-sm text-slate-400">{hint}</p>
      <div className="flex flex-col gap-3">
        <button
          onClick={download}
          disabled={!canExport}
          className="btn-primary w-full disabled:opacity-40"
        >
          <DownloadIcon className="h-5 w-5" />
          {exportLabel}
        </button>
        <button
          onClick={() => inputRef.current?.click()}
          disabled={importing}
          className="btn-ghost w-full"
        >
          <ImportIcon className="h-5 w-5" />
          {importing ? t('settings.importing') : t('settings.import')}
        </button>
        <input
          ref={inputRef}
          type="file"
          accept="application/json,.json"
          className="hidden"
          onChange={onFile}
        />
      </div>
      {msg && (
        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className={`mt-3 text-center text-sm ${
            msg.ok ? 'text-emerald-300' : 'text-rose-300'
          }`}
        >
          {msg.text}
        </motion.p>
      )}
    </section>
  )
}

function StyleCard({
  active,
  onClick,
  emoji,
  label,
  desc,
}: {
  active: boolean
  onClick: () => void
  emoji: string
  label: string
  desc: string
}) {
  return (
    <button
      onClick={onClick}
      className={`relative overflow-hidden rounded-2xl border p-4 text-left transition ${
        active
          ? 'border-transparent bg-neon-gradient/10 shadow-glow'
          : 'border-white/10 bg-white/5 hover:bg-white/10'
      }`}
    >
      {active && (
        <span className="absolute right-3 top-3 grid h-5 w-5 place-items-center rounded-full bg-neon-gradient text-[10px] text-white">
          ✓
        </span>
      )}
      <span className="text-3xl">{emoji}</span>
      <p className={`mt-2 font-bold ${active ? 'gradient-text' : ''}`}>{label}</p>
      <p className="text-xs text-slate-400">{desc}</p>
    </button>
  )
}

function Toggle({
  on,
  onChange,
  label,
}: {
  on: boolean
  onChange: (v: boolean) => void
  label: string
}) {
  return (
    <button
      role="switch"
      aria-checked={on}
      aria-label={label}
      onClick={() => onChange(!on)}
      className={`relative h-8 w-14 rounded-full transition ${
        on ? 'bg-neon-gradient' : 'bg-white/10'
      }`}
    >
      <motion.span
        layout
        transition={{ type: 'spring', stiffness: 500, damping: 30 }}
        className="absolute top-1 h-6 w-6 rounded-full bg-white shadow"
        style={{ left: on ? 'calc(100% - 1.75rem)' : '0.25rem' }}
      />
    </button>
  )
}

function Stat({
  label,
  value,
  accent,
}: {
  label: string
  value: number
  accent?: 'cyan' | 'pink' | 'purple'
}) {
  const color =
    accent === 'cyan'
      ? 'text-neon-cyan'
      : accent === 'pink'
        ? 'text-neon-pink'
        : accent === 'purple'
          ? 'text-neon-purple'
          : 'text-slate-100'
  return (
    <div className="rounded-2xl bg-white/5 p-3 text-center">
      <p className={`text-2xl font-extrabold ${color}`}>{value}</p>
      <p className="text-xs text-slate-400">{label}</p>
    </div>
  )
}
