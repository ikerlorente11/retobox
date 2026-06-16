import { motion } from 'framer-motion'
import { useEffect, useState } from 'react'
import { useStore } from './store'
import { useT } from './lib/i18n'
import { TabBar, type Tab } from './components/TabBar'
import { SorteoPage } from './pages/SorteoPage'
import { RetosPage } from './pages/RetosPage'
import { UsuariosPage } from './pages/UsuariosPage'
import { CombosPage } from './pages/CombosPage'
import { AjustesPage } from './pages/AjustesPage'

export default function App() {
  const { bootstrap, loading, loadError } = useStore()
  const [tab, setTab] = useState<Tab>('sorteo')

  useEffect(() => {
    void bootstrap()
  }, [bootstrap])

  return (
    <div className="mx-auto flex min-h-full max-w-md flex-col px-4 pt-6 pb-28 md:max-w-3xl md:px-8 md:pt-10 lg:max-w-5xl">
      {loading ? (
        <LoadingScreen />
      ) : loadError ? (
        <ErrorScreen message={loadError} onRetry={() => void bootstrap()} />
      ) : (
        <motion.main
          key={tab}
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.22 }}
          className="flex flex-1 flex-col"
        >
          {tab === 'sorteo' && <SorteoPage goTo={setTab} />}
          {tab === 'retos' && <RetosPage />}
          {tab === 'usuarios' && <UsuariosPage />}
          {tab === 'combos' && <CombosPage />}
          {tab === 'ajustes' && <AjustesPage />}
        </motion.main>
      )}

      {!loading && !loadError && <TabBar active={tab} onChange={setTab} />}
    </div>
  )
}

function LoadingScreen() {
  return (
    <div className="grid flex-1 place-items-center py-24">
      <motion.div
        animate={{ rotate: 360 }}
        transition={{ repeat: Infinity, duration: 1.2, ease: 'linear' }}
        className="text-5xl"
      >
        🎲
      </motion.div>
    </div>
  )
}

function ErrorScreen({
  message,
  onRetry,
}: {
  message: string
  onRetry: () => void
}) {
  const t = useT()
  return (
    <div className="grid flex-1 place-items-center py-24">
      <div className="glass max-w-sm rounded-3xl p-8 text-center">
        <span className="mb-3 block text-4xl">⚠️</span>
        <h2 className="mb-2 font-bold">{t('app.loadErrorTitle')}</h2>
        <p className="mb-5 text-sm text-slate-400">{message}</p>
        <button onClick={onRetry} className="btn-primary w-full">
          {t('common.retry')}
        </button>
      </div>
    </div>
  )
}
