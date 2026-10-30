import { Check, Command, Menu, Moon, PanelRightClose, PanelRightOpen, Search, Sun } from 'lucide-react'
import type { Health } from '../api/types'
import { IconButton, Spinner } from './ui'

type Props = {
  view: 'chat' | 'documents'
  context: string
  theme: 'light' | 'dark'
  onToggleTheme: () => void
  onOpenSidebar: () => void
  onOpenCommands: () => void
  onToggleSources: (() => void) | null
  sourcesOpen: boolean
  health: Health | null
  healthError: string | null
  onRetryHealth: () => void
}

export function Topbar({
  view,
  context,
  theme,
  onToggleTheme,
  onOpenSidebar,
  onOpenCommands,
  onToggleSources,
  sourcesOpen,
  health,
  healthError,
  onRetryHealth,
}: Props) {
  return (
    <header className="topbar">
      <div className="topbar-left">
        <IconButton label="Ouvrir le menu" className="mobile-menu" onClick={onOpenSidebar}>
          <Menu size={19} />
        </IconButton>
        <span className="context-dot" />
        <strong>{context}</strong>
        {healthError ? (
          <button type="button" className="health-pill warn" onClick={onRetryHealth} title={healthError}>
            Service injoignable · Réessayer
          </button>
        ) : health ? (
          <span
            className={`health-pill ${health.knowledge_base_ready && health.llm_configured ? 'ok' : 'warn'}`}
            title={`Modèle : ${health.model} · Clé API ${health.llm_configured ? 'configurée' : 'absente'} · ${health.chunks_indexed} extrait(s) indexé(s)`}
          >
            {health.knowledge_base_ready ? <Check size={12} /> : <Spinner size={11} />}
            {health.knowledge_base_ready
              ? health.llm_configured
                ? 'Prêt'
                : 'Clé du modèle absente'
              : 'Base non indexée'}
          </span>
        ) : (
          <span className="health-pill">
            <Spinner size={11} /> Vérification…
          </span>
        )}
      </div>

      <div className="topbar-actions">
        <button type="button" className="command-trigger" onClick={onOpenCommands}>
          <Search size={16} />
          <span>Rechercher</span>
          <kbd>
            <Command size={12} />K
          </kbd>
        </button>
        <IconButton
          label={theme === 'dark' ? 'Activer le thème clair' : 'Activer le thème sombre'}
          onClick={onToggleTheme}
        >
          {theme === 'dark' ? <Sun size={18} /> : <Moon size={18} />}
        </IconButton>
        {view === 'chat' && onToggleSources ? (
          <IconButton label={sourcesOpen ? 'Masquer les sources' : 'Afficher les sources'} onClick={onToggleSources}>
            {sourcesOpen ? <PanelRightClose size={19} /> : <PanelRightOpen size={19} />}
          </IconButton>
        ) : null}
      </div>
    </header>
  )
}
