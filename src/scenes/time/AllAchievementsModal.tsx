import { X } from 'lucide-react'
import type { AchievementGroupView } from '../../AchievementCatalog'
import { achievementImage } from '../../contentCatalog'
import './all-achievements-modal.css'

export default function AllAchievementsModal({
  groups,
  english,
  onClose,
}: {
  groups: AchievementGroupView[]
  english: boolean
  onClose: () => void
}) {
  const earnedGroups = groups.map((group) => ({ ...group, items: group.items.filter((item) => item.earned) })).filter((group) => group.items.length)
  const advancedGroups = groups.map((group) => ({ ...group, items: group.items.filter((item) => !item.earned && item.progress > 0) })).filter((group) => group.items.length)

  return <div className="all-achievements-backdrop" role="dialog" aria-modal="true" aria-labelledby="all-achievements-title">
    <section className="all-achievements-card">
      <header className="all-achievements-header">
        <div><span>{english ? 'YOUR JOURNEY' : 'SUA JORNADA'}</span><h2 id="all-achievements-title">{english ? 'All achievements' : 'Todas as conquistas'}</h2></div>
        <button className="all-achievements-close" type="button" onClick={onClose} aria-label={english ? 'Close achievements' : 'Fechar conquistas'}><X size={20} strokeWidth={2}/></button>
      </header>
      <div className="all-achievements-scroll">
        <section className="all-achievements-state">
          <h3>{english ? 'Conquered' : 'Conquistadas'}</h3>
          {earnedGroups.length ? earnedGroups.map((group) => <div className="all-achievements-category" key={`earned-${group.id}`}>
            <h4><img src={achievementImage('categorias', group.icon)} alt=""/>{group.title}</h4>
            <div className="all-achievements-grid">{group.items.map((item) => <article key={item.id}>
              <img src={achievementImage('conquistas', item.icon)} alt=""/>
              <span>{item.title}</span>
              {!item.masked && item.description && <small>{item.description}</small>}
              <small className="all-achievements-status">{english ? 'Unlocked' : 'Conquistada'}</small>
            </article>)}</div>
          </div>) : <p className="all-achievements-empty">{english ? 'No achievements conquered yet.' : 'Nenhuma conquista conquistada ainda.'}</p>}
        </section>
        <section className="all-achievements-state">
          <h3>{english ? 'In progress' : 'Avançadas'}</h3>
          {advancedGroups.length ? advancedGroups.map((group) => <div className="all-achievements-category" key={`advanced-${group.id}`}>
            <h4><img src={achievementImage('categorias', group.icon)} alt=""/>{group.title}</h4>
            <div className="all-achievements-grid">{group.items.map((item) => <article className={item.masked ? 'is-masked' : ''} key={item.id}>
              <img src={achievementImage('conquistas', item.icon)} alt=""/>
              <span>{item.masked ? (english ? 'Hidden achievement' : 'Conquista oculta') : item.title}</span>
              {!item.masked && item.description && <small>{item.description}</small>}
              <span className="all-achievements-progress"><i style={{ width: `${item.progress * 100}%` }}/></span>
            </article>)}</div>
          </div>) : <p className="all-achievements-empty">{english ? 'No achievements in progress yet.' : 'Nenhuma conquista avançada ainda.'}</p>}
        </section>
      </div>
    </section>
  </div>
}
