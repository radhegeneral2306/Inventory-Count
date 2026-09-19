import { useEffect } from 'react'
import { createPortal } from 'react-dom'
import { WarningCircle } from '@phosphor-icons/react'

interface ConfirmDialogProps {
  title: string
  body: string
  confirmLabel: string
  cancelLabel: string
  busy?: boolean
  onConfirm: () => void
  onCancel: () => void
}

export function ConfirmDialog({
  title,
  body,
  confirmLabel,
  cancelLabel,
  busy = false,
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape' && !busy) onCancel()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [busy, onCancel])

  useEffect(() => {
    const previous = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = previous
    }
  }, [])

  /**
   * Rendered into body: an ancestor with a transform (the page's entry
   * animation) would otherwise become the containing block for this fixed
   * overlay and push it far below the viewport.
   */
  return createPortal(
    <div className="dialog-backdrop" role="dialog" aria-modal="true" aria-label={title}>
      <div className="dialog glass">
        <span className="dialog-icon">
          <WarningCircle size={24} weight="bold" />
        </span>
        <div className="dialog-text">
          <h2>{title}</h2>
          <p className="hint-text">{body}</p>
        </div>
        <div className="dialog-actions">
          <button type="button" onClick={onCancel} disabled={busy}>
            {cancelLabel}
          </button>
          <button type="button" className="btn-danger" onClick={onConfirm} disabled={busy}>
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>,
    document.body,
  )
}
