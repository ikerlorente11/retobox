// Pantalla de Ajustes. Porta AjustesPage: tema, estilo de revelado, sonido,
// estadísticas y reinicio de sesión.

import { useState } from 'react'
import { Pressable, ScrollView, StyleSheet, Switch, Text, View } from 'react-native'
import { useStore } from '../../src/store'
import { useResponsive } from '../../src/lib/responsive'
import { useT } from '../../src/lib/useT'
import { NEON_GRADIENT, useColors } from '../../src/theme'
import { LinearGradient } from 'expo-linear-gradient'
import { pickGroupsFile, pickRetosFile, shareGroups, shareRetos } from '../../src/lib/retosShare'
import { Card } from '../../src/ui/Card'
import { AppModal } from '../../src/ui/AppModal'
import { GradientButton } from '../../src/ui/GradientButton'
import { Screen } from '../../src/ui/Screen'
import { ImportIcon, RefreshIcon, ShareIcon } from '../../src/ui/icons'

export default function AjustesScreen() {
  const colors = useColors()
  const t = useT()
  const { isTablet, maxContentWidth } = useResponsive()
  const {
    theme,
    setTheme,
    soundEnabled,
    setSoundEnabled,
    lang,
    setLang,
    stats,
    resetSession,
    challenges,
    importChallenges,
    wordGroups,
    importWordGroups,
  } = useStore()

  const [confirmReset, setConfirmReset] = useState(false)
  const [resetting, setResetting] = useState(false)
  const [resetCount, setResetCount] = useState<number | null>(null)

  const [sharing, setSharing] = useState(false)
  const [importing, setImporting] = useState(false)
  const [dataMsg, setDataMsg] = useState<{ ok: boolean; text: string } | null>(null)
  const canExport = challenges.length > 0

  // Estado independiente para la tarjeta de Combos (grupos).
  const [sharingG, setSharingG] = useState(false)
  const [importingG, setImportingG] = useState(false)
  const [dataMsgG, setDataMsgG] = useState<{ ok: boolean; text: string } | null>(null)
  const canExportG = wordGroups.length > 0

  async function handleReset() {
    setResetting(true)
    try {
      const count = await resetSession()
      setResetCount(count)
      setConfirmReset(false)
    } finally {
      setResetting(false)
    }
  }

  // Construye el fichero y abre el menú nativo de compartir (WhatsApp, Telegram,
  // correo…), enviando el JSON directamente.
  async function handleShare() {
    setSharing(true)
    setDataMsg(null)
    try {
      await shareRetos(challenges)
    } catch (err) {
      setDataMsg({ ok: false, text: err instanceof Error ? t(err.message) : t('settings.shareError') })
    } finally {
      setSharing(false)
    }
  }

  async function handleImport() {
    setImporting(true)
    setDataMsg(null)
    try {
      const retos = await pickRetosFile()
      if (retos === null) {
        return // el usuario canceló
      }
      const res = await importChallenges(retos)
      setDataMsg({
        ok: true,
        text:
          res.imported === 0
            ? t('settings.importNothingRetos', { n: res.skipped })
            : t('settings.importDone', {
                imported: res.imported,
                extra: res.skipped > 0 ? t('settings.importDoneExtra', { n: res.skipped }) : '',
              }),
      })
    } catch (err) {
      setDataMsg({ ok: false, text: err instanceof Error ? t(err.message) : t('settings.importError') })
    } finally {
      setImporting(false)
    }
  }

  async function handleShareGroups() {
    setSharingG(true)
    setDataMsgG(null)
    try {
      await shareGroups(wordGroups)
    } catch (err) {
      setDataMsgG({ ok: false, text: err instanceof Error ? t(err.message) : t('settings.shareError') })
    } finally {
      setSharingG(false)
    }
  }

  async function handleImportGroups() {
    setImportingG(true)
    setDataMsgG(null)
    try {
      const groups = await pickGroupsFile()
      if (groups === null) {
        return
      }
      const res = await importWordGroups(groups)
      setDataMsgG({
        ok: true,
        text:
          res.imported === 0
            ? t('settings.importNothingGroups', { n: res.skipped })
            : t('settings.importDone', {
                imported: res.imported,
                extra: res.skipped > 0 ? t('settings.importDoneExtra', { n: res.skipped }) : '',
              }),
      })
    } catch (err) {
      setDataMsgG({ ok: false, text: err instanceof Error ? t(err.message) : t('settings.importError') })
    } finally {
      setImportingG(false)
    }
  }

  // Tarjetas de ajustes. En tablet se reparten en 2 columnas (masonry real:
  // cada columna se apila por separado, sin huecos ni tarjetas estiradas).
  const cards = [
    <Card key="stats">
      <Text style={[styles.h2, { color: colors.text, marginBottom: 12 }]}>{t('settings.stats')}</Text>
      <View style={styles.grid2}>
        <Stat label={t('settings.statTotal')} value={stats?.total ?? 0} color={colors.text} />
        <Stat label={t('settings.statAvailable')} value={stats?.available ?? 0} color={colors.accentCyan} />
        <Stat label={t('settings.statUsed')} value={stats?.used ?? 0} color={colors.accentPink} />
        <Stat label={t('settings.statUsers')} value={stats?.users ?? 0} color={colors.accentPurple} />
      </View>
    </Card>,

    <Card key="tema">
      <Text style={[styles.h2, { color: colors.text }]}>{t('settings.theme')}</Text>
      <Text style={[styles.muted, { color: colors.textMuted }]}>{t('settings.themeHint')}</Text>
      <View style={styles.grid2}>
        <StyleCard active={theme === 'dark'} emoji="🌙" label={t('settings.dark')} desc={t('settings.darkDesc')} onPress={() => setTheme('dark')} />
        <StyleCard active={theme === 'light'} emoji="☀️" label={t('settings.light')} desc={t('settings.lightDesc')} onPress={() => setTheme('light')} />
      </View>
    </Card>,

    <Card key="sonido" style={styles.soundRow}>
      <View style={styles.flex1}>
        <Text style={[styles.h2, { color: colors.text }]}>{t('settings.sound')}</Text>
        <Text style={[styles.muted, { color: colors.textMuted }]}>{t('settings.soundHint')}</Text>
      </View>
      <Switch
        value={soundEnabled}
        onValueChange={setSoundEnabled}
        trackColor={{ true: colors.primary, false: colors.cardBorder }}
      />
    </Card>,

    <Card key="lang">
      <Text style={[styles.h2, { color: colors.text }]}>{t('settings.language')}</Text>
      <Text style={[styles.muted, { color: colors.textMuted }]}>{t('settings.languageHint')}</Text>
      <View style={[styles.segment, { borderColor: colors.cardBorder }]}>
        <LangButton active={lang === 'es'} label={t('settings.spanish')} onPress={() => setLang('es')} />
        <LangButton active={lang === 'en'} label={t('settings.english')} onPress={() => setLang('en')} />
      </View>
    </Card>,

    <Card key="data">
      <Text style={[styles.h2, { color: colors.text }]}>{t('settings.retosCard')}</Text>
      <Text style={[styles.muted, { color: colors.textMuted }]}>{t('settings.retosCardHint')}</Text>
      <GradientButton
        label={sharing ? t('settings.sharing') : t('settings.shareRetos')}
        onPress={handleShare}
        disabled={sharing || !canExport}
        icon={<ShareIcon size={18} color="#fff" />}
        style={styles.fullBtn}
      />
      <Pressable
        onPress={handleImport}
        disabled={importing}
        style={[styles.importBtn, { borderColor: colors.cardBorder, opacity: importing ? 0.6 : 1 }]}
      >
        <ImportIcon size={18} color={colors.text} />
        <Text style={{ color: colors.text, fontWeight: '700' }}>
          {importing ? t('settings.importing') : t('settings.import')}
        </Text>
      </Pressable>
      {dataMsg && (
        <Text style={[styles.dataMsg, { color: dataMsg.ok ? '#34d399' : colors.danger }]}>
          {dataMsg.text}
        </Text>
      )}
    </Card>,

    <Card key="combos-data">
      <Text style={[styles.h2, { color: colors.text }]}>{t('settings.combosCard')}</Text>
      <Text style={[styles.muted, { color: colors.textMuted }]}>{t('settings.combosCardHint')}</Text>
      <GradientButton
        label={sharingG ? t('settings.sharing') : t('settings.shareGroups')}
        onPress={handleShareGroups}
        disabled={sharingG || !canExportG}
        icon={<ShareIcon size={18} color="#fff" />}
        style={styles.fullBtn}
      />
      <Pressable
        onPress={handleImportGroups}
        disabled={importingG}
        style={[styles.importBtn, { borderColor: colors.cardBorder, opacity: importingG ? 0.6 : 1 }]}
      >
        <ImportIcon size={18} color={colors.text} />
        <Text style={{ color: colors.text, fontWeight: '700' }}>
          {importingG ? t('settings.importing') : t('settings.importCombos')}
        </Text>
      </Pressable>
      {dataMsgG && (
        <Text style={[styles.dataMsg, { color: dataMsgG.ok ? '#34d399' : colors.danger }]}>
          {dataMsgG.text}
        </Text>
      )}
    </Card>,

    <Card key="sesion">
      <Text style={[styles.h2, { color: colors.text }]}>{t('settings.session')}</Text>
      <Text style={[styles.muted, { color: colors.textMuted }]}>{t('settings.sessionHint')}</Text>
      <Pressable
        onPress={() => setConfirmReset(true)}
        style={[styles.resetBtn, { borderColor: colors.cardBorder }]}
      >
        <RefreshIcon size={18} color={colors.text} />
        <Text style={{ color: colors.text, fontWeight: '700' }}>{t('sorteo.resetSession')}</Text>
      </Pressable>
      {resetCount !== null && (
        <Text style={[styles.resetMsg, { color: '#34d399' }]}>{t('settings.resetDone', { n: resetCount })}</Text>
      )}
    </Card>,
  ]

  // Reparte alternando para equilibrar las dos columnas (0,2,4 | 1,3).
  const leftCards = cards.filter((_, i) => i % 2 === 0)
  const rightCards = cards.filter((_, i) => i % 2 === 1)

  return (
    <Screen>
      <ScrollView contentContainerStyle={styles.content}>
      <View
        style={[
          styles.inner,
          isTablet && { maxWidth: maxContentWidth, alignSelf: 'center', width: '100%' },
        ]}
      >
      <Text style={[styles.title, { color: colors.text }]}>{t('settings.title')}</Text>

      {isTablet ? (
        <View style={styles.columns}>
          <View style={styles.column}>{leftCards}</View>
          <View style={styles.column}>{rightCards}</View>
        </View>
      ) : (
        <View style={styles.cardsWrap}>{cards}</View>
      )}

      <Text style={[styles.footer, { color: colors.textFaint }]}>{t('settings.footer')}</Text>
      </View>

      <AppModal open={confirmReset} title={t('settings.resetConfirmTitle')} onClose={() => setConfirmReset(false)}>
        <Text style={{ color: colors.textMuted }}>
          {t('settings.resetConfirmBody')}
        </Text>
        <View style={styles.modalActions}>
          <Pressable
            onPress={() => setConfirmReset(false)}
            style={[styles.ghost, styles.flex1, { borderColor: colors.cardBorder, marginTop: 0 }]}
          >
            <Text style={{ color: colors.text, fontWeight: '700' }}>{t('common.cancel')}</Text>
          </Pressable>
          <GradientButton
            label={resetting ? t('sorteo.resetting') : t('settings.reset')}
            onPress={handleReset}
            disabled={resetting}
            style={styles.flex1}
          />
        </View>
      </AppModal>
      </ScrollView>
    </Screen>
  )
}

function StyleCard({
  active,
  emoji,
  label,
  desc,
  onPress,
}: {
  active: boolean
  emoji: string
  label: string
  desc: string
  onPress: () => void
}) {
  const colors = useColors()
  return (
    <Pressable
      onPress={onPress}
      style={[
        styles.styleCard,
        {
          borderColor: active ? colors.primary : colors.cardBorder,
          backgroundColor: active ? 'rgba(168,85,247,0.12)' : colors.card,
        },
      ]}
    >
      <Text style={styles.styleEmoji}>{emoji}</Text>
      <Text style={[styles.styleLabel, { color: active ? colors.accentPurple : colors.text }]}>{label}</Text>
      <Text style={[styles.styleDesc, { color: colors.textMuted }]}>{desc}</Text>
    </Pressable>
  )
}

function Stat({ label, value, color }: { label: string; value: number; color: string }) {
  const colors = useColors()
  return (
    <View style={[styles.stat, { backgroundColor: colors.card }]}>
      <Text style={[styles.statValue, { color }]}>{value}</Text>
      <Text style={[styles.statLabel, { color: colors.textMuted }]}>{label}</Text>
    </View>
  )
}

// Botón segmentado del selector de idioma (ES/EN).
function LangButton({
  active,
  label,
  onPress,
}: {
  active: boolean
  label: string
  onPress: () => void
}) {
  const colors = useColors()
  return (
    <Pressable onPress={onPress} style={styles.segBtnWrap}>
      {active ? (
        <LinearGradient colors={NEON_GRADIENT} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.segBtn}>
          <Text style={styles.segTextActive}>{label}</Text>
        </LinearGradient>
      ) : (
        <View style={styles.segBtn}>
          <Text style={{ color: colors.textMuted, fontWeight: '700' }}>{label}</Text>
        </View>
      )}
    </Pressable>
  )
}

const styles = StyleSheet.create({
  content: { padding: 20, paddingTop: 8, paddingBottom: 120 },
  inner: { gap: 16 },
  cardsWrap: { gap: 16 },
  columns: { flexDirection: 'row', gap: 16, alignItems: 'flex-start' },
  column: { flex: 1, gap: 16 },
  title: { fontSize: 24, fontWeight: '900' },
  h2: { fontSize: 16, fontWeight: '800' },
  segment: { flexDirection: 'row', gap: 4, borderWidth: 1, borderRadius: 14, padding: 4, marginTop: 12 },
  segBtnWrap: { flex: 1 },
  segBtn: { borderRadius: 10, paddingVertical: 10, alignItems: 'center', justifyContent: 'center' },
  segTextActive: { color: '#fff', fontWeight: '800' },
  muted: { fontSize: 13, marginTop: 2, marginBottom: 12 },
  grid2: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  styleCard: { flexGrow: 1, flexBasis: '46%', borderWidth: 1, borderRadius: 18, padding: 14 },
  styleEmoji: { fontSize: 28 },
  styleLabel: { marginTop: 8, fontWeight: '800' },
  styleDesc: { fontSize: 12 },
  soundRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  flex1: { flex: 1 },
  stat: { flexGrow: 1, flexBasis: '46%', borderRadius: 16, padding: 12, alignItems: 'center' },
  statValue: { fontSize: 22, fontWeight: '900' },
  statLabel: { fontSize: 12 },
  ghost: { borderWidth: 1, borderRadius: 16, paddingVertical: 12, alignItems: 'center', justifyContent: 'center', marginTop: 12 },
  resetBtn: { flexDirection: 'row', gap: 8, borderWidth: 1, borderRadius: 16, paddingVertical: 12, alignItems: 'center', justifyContent: 'center', marginTop: 12 },
  resetMsg: { textAlign: 'center', marginTop: 12, fontSize: 13 },
  fullBtn: { width: '100%' },
  importBtn: { flexDirection: 'row', gap: 8, borderWidth: 1, borderRadius: 16, paddingVertical: 12, alignItems: 'center', justifyContent: 'center', marginTop: 12 },
  dataMsg: { textAlign: 'center', marginTop: 12, fontSize: 13 },
  footer: { textAlign: 'center', fontSize: 12 },
  modalActions: { flexDirection: 'row', gap: 12, marginTop: 16 },
})
