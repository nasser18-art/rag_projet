import { useEffect, useRef } from 'react'
import { ArrowUp, Database, Paperclip, Square } from 'lucide-react'
import type { Health, KnowledgeBases } from '../api/types'
import { formatBytes } from '../lib/format'
import { IconButton } from './ui'

type Props = {
  value: string
  onChange: (value: string) => void
  onSend: () => void
  onStop: () => void
  streaming: boolean
  disabled: boolean
  category: string | null
  onCategoryChange: (category: string | null) => void
  knowledge: KnowledgeBases | null
  health: Health | null
  onAttach: (file: File) => void
}

export function Composer({
  value,
  onChange,
  onSend,
  onStop,
  streaming,
  disabled,
  category,
  onCategoryChange,
  knowledge,
  health,
  onAttach,
}: Props) {
  const textarea = useRef<HTMLTextAreaElement>(null)
  const fileInput = useRef<HTMLInputElement>(null)

  useEffect(() => {
    const element = textarea.current
    if (!element) return
    element.style.height = 'auto'
    element.style.height = `${Math.min(element.scrollHeight, 132)}px`
  }, [value])

  const canSend = value.trim().length > 0 && !streaming && !disabled

  return (
    <div className="composer-shell">
      <div className="composer">
        <textarea
          ref={textarea}
          rows={1}
          value={value}
          aria-label="Votre question"
          placeholder={disabled ? 'Le service est indisponible : réessayez plus tard' : 'Interrogez vos documents…'}
          onChange={(event) => onChange(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === 'Enter' && !event.shiftKey) {
              event.preventDefault()
              if (canSend) onSend()
            }
          }}
        />

        <div className="composer-actions">
          <input
            ref={fileInput}
            type="file"
            className="sr-only"
            accept={knowledge?.formats.map((format) => `.${format}`).join(',') ?? undefined}
            onChange={(event) => {
              const file = event.target.files?.[0]
              if (file) onAttach(file)
              event.target.value = ''
            }}
          />
          <IconButton label="Importer un document dans la base" onClick={() => fileInput.current?.click()}>
            <Paperclip size={18} />
          </IconButton>

          <label className="select-button select-field">
            <Database size={15} />
            <span className="sr-only">Base de connaissances interrogée</span>
            <select
              value={category ?? ''}
              onChange={(event) => onCategoryChange(event.target.value || null)}
              aria-label="Base de connaissances interrogée"
            >
              <option value="">Toutes les bases</option>
              {(knowledge?.categories ?? []).map((base) => (
                <option key={base.name} value={base.name}>
                  {base.name} ({base.documents})
                </option>
              ))}
            </select>
          </label>

          <span className="select-button model" title="Modèle configuré côté serveur (fichier .env)">
            {health?.model ?? 'Modèle inconnu'}
            {health && !health.llm_configured ? ' · clé absente' : ''}
          </span>

          {streaming ? (
            <button type="button" className="send-button stop" aria-label="Arrêter la génération" title="Arrêter" onClick={onStop}>
              <Square size={13} fill="currentColor" />
            </button>
          ) : (
            <button type="button" className="send-button" disabled={!canSend} aria-label="Envoyer" title="Envoyer" onClick={onSend}>
              <ArrowUp size={18} />
            </button>
          )}
        </div>
      </div>
      <small>
        Entrée pour envoyer · Maj + Entrée pour une nouvelle ligne
        {knowledge ? ` · ${knowledge.formats.map((format) => format.toUpperCase()).join(', ')} jusqu’à ${formatBytes(knowledge.max_upload_bytes)}` : ''}
      </small>
    </div>
  )
}
