import type { ReactNode } from 'react'
import { ArrowRight, CheckCircle2, RotateCcw } from 'lucide-react'
import './task-success-modal.css'

type TaskSuccessModalProps = {
  english: boolean
  titleId: string
  kicker: string
  title: string
  description: string
  continueLabel: string
  onContinue: () => void
  icon?: ReactNode
  restartLabel?: string
  onRestart?: () => void
}

export default function TaskSuccessModal({
  english,
  titleId,
  kicker,
  title,
  description,
  continueLabel,
  onContinue,
  icon = <CheckCircle2 size={42} aria-hidden="true"/>,
  restartLabel,
  onRestart,
}: TaskSuccessModalProps) {
  return <div className="task-success-backdrop" role="dialog" aria-modal="true" aria-labelledby={titleId}>
    <section className="task-success-card">
      <div className="task-success-icon" aria-hidden="true">{icon}</div>
      <span className="task-success-kicker">{kicker}</span>
      <h1 id={titleId}>{title}</h1>
      <p>{description}</p>
      <div className="task-success-actions">
        {onRestart && <button type="button" className="is-secondary" onClick={onRestart}>
          <RotateCcw size={16} aria-hidden="true"/>{restartLabel ?? (english ? 'Restart task' : 'Reiniciar tarefa')}
        </button>}
        <button type="button" className="is-primary" onClick={onContinue}>
          {continueLabel}<ArrowRight size={17} aria-hidden="true"/>
        </button>
      </div>
    </section>
  </div>
}
