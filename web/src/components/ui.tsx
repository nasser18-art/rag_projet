import type { ReactNode } from 'react'

export function IconButton({
  label,
  children,
  className = '',
  onClick,
  disabled = false,
}: {
  label: string
  children: ReactNode
  className?: string
  onClick?: () => void
  disabled?: boolean
}) {
  return (
    <button
      type="button"
      className={`icon-button ${className}`}
      aria-label={label}
      title={label}
      onClick={onClick}
      disabled={disabled}
    >
      {children}
    </button>
  )
}

export type NoticeKind = 'error' | 'info' | 'success'
export type Notice = {
  id: number
  kind: NoticeKind
  title: string
  detail?: string
  action?: { label: string; onClick: () => void }
}

export function ToastStack({ notices, dismiss }: { notices: Notice[]; dismiss: (id: number) => void }) {
  return (
    <div className="toast-stack" role="status" aria-live="polite">
      {notices.map((notice) => (
        <div className={`toast ${notice.kind}`} key={notice.id}>
          <div>
            <strong>{notice.title}</strong>
            {notice.detail ? <p>{notice.detail}</p> : null}
            {notice.action ? (
              <button
                type="button"
                className="toast-action"
                onClick={() => {
                  notice.action?.onClick()
                  dismiss(notice.id)
                }}
              >
                {notice.action.label}
              </button>
            ) : null}
          </div>
          <button type="button" className="toast-close" aria-label="Masquer ce message" onClick={() => dismiss(notice.id)}>
            ✕
          </button>
        </div>
      ))}
    </div>
  )
}

export function Banner({
  title,
  detail,
  action,
  tone = 'error',
}: {
  title: string
  detail?: string
  action?: { label: string; onClick: () => void } | null
  tone?: 'error' | 'info'
}) {
  return (
    <div className={`banner ${tone}`} role={tone === 'error' ? 'alert' : 'status'}>
      <div>
        <strong>{title}</strong>
        {detail ? <p>{detail}</p> : null}
      </div>
      {action ? (
        <button type="button" onClick={action.onClick}>
          {action.label}
        </button>
      ) : null}
    </div>
  )
}

export function Spinner({ size = 14 }: { size?: number }) {
  return <span className="spinner" style={{ width: size, height: size }} aria-hidden="true" />
}

export function EmptyState({ title, detail, action }: { title: string; detail: string; action?: ReactNode }) {
  return (
    <div className="empty-state">
      <strong>{title}</strong>
      <p>{detail}</p>
      {action}
    </div>
  )
}

export function ConfirmDialog({
  title,
  detail,
  confirmLabel,
  busy = false,
  onCancel,
  onConfirm,
}: {
  title: string
  detail: string
  confirmLabel: string
  busy?: boolean
  onCancel: () => void
  onConfirm: () => void
}) {
  return (
    <div className="modal-backdrop" onMouseDown={onCancel} role="presentation">
      <div
        className="command-palette confirm-dialog"
        role="dialog"
        aria-modal="true"
        aria-label={title}
        onMouseDown={(event) => event.stopPropagation()}
      >
        <div className="confirm-body">
          <strong>{title}</strong>
          <p>{detail}</p>
        </div>
        <div className="confirm-actions">
          <button type="button" className="ghost-button" onClick={onCancel} disabled={busy}>
            Annuler
          </button>
          <button type="button" className="danger-button" onClick={onConfirm} disabled={busy}>
            {busy ? 'Suppression…' : confirmLabel}
          </button>
        </div>
      </div>
    </div>
  )
}
