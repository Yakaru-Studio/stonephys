import { useEffect, useState, type CSSProperties } from 'react'
import { CheckCircle2 } from 'lucide-react'
import { type AppLocale } from './i18n'
import AudioControls from './audio/AudioControls'
import { readScientificNotes, scientificNoteReadEvent } from './scientificNotes'
import { getAchievementGroups } from './contentCatalog'
import './achievements-home.css'

const images = import.meta.glob('./assets/achievements/**/*.png', { eager: true, query: '?url', import: 'default' }) as Record<string, string>
const image = (folder: 'categorias' | 'conquistas', id: string) => images[`./assets/achievements/${folder}/${id}.png`]

export default function AchievementsHome({ locale, lebomboComplete }: { locale: AppLocale; lebomboComplete: boolean }) {
  const english = locale === 'en'
  const [readNotes, setReadNotes] = useState(readScientificNotes)
  useEffect(() => {
    const update = () => setReadNotes(readScientificNotes())
    window.addEventListener(scientificNoteReadEvent, update)
    window.addEventListener('storage', update)
    return () => { window.removeEventListener(scientificNoteReadEvent, update); window.removeEventListener('storage', update) }
  }, [])
  const groups = getAchievementGroups(locale, lebomboComplete ? ['counting-marks'] : [], readNotes.length)

  return <main className="achievements-home">
    <div className="achievements-home-content">
      <header className="achievements-home-heading">
        <div><p>{english ? 'UNLOCKED' : 'DESBLOQUEADAS'}</p><h1>{english ? 'Achievements' : 'Conquistas'}</h1></div>
        <AudioControls/>
      </header>
      {groups.length === 0 ? <p className="achievement-empty-state">{english ? 'No achievements unlocked yet. Complete the Lebombo Bone activity to begin.' : 'Nenhuma conquista desbloqueada ainda. Conclua a atividade do Osso de Lebombo para começar.'}</p> : <div className="achievement-categories">
        {groups.map((group) => <section className="achievement-category" key={group.id} aria-labelledby={`achievement-category-${group.id}`}>
          <h2 id={`achievement-category-${group.id}`}><img src={image('categorias', group.icon)} alt=""/>{group.title}</h2>
          <div className="achievement-category-items">
            {group.items.map((item) => {
              const { earned, progress, masked: maskedDuringProgress } = item
              return <article className={`achievement-entry ${earned ? 'is-earned' : 'is-progress'} ${maskedDuringProgress ? 'is-masked' : ''}`} key={item.id} aria-label={maskedDuringProgress ? (english ? 'Hidden historical figure achievement, in progress' : 'Conquista de personagem histórico oculta, em progresso') : `${item.title}, ${earned ? (english ? 'achieved' : 'conquistada') : (english ? 'in progress' : 'em progresso')}`}>
                <div className={`achievement-entry-medallion ${earned ? 'is-earned' : 'is-progressing'}`} aria-hidden="true">
                  <img className="achievement-entry-icon" src={image('conquistas', item.icon)} alt=""/>
                  {!earned && <span className="achievement-progress-ring" style={{ '--achievement-progress': `${progress * 100}%` } as CSSProperties}/>}
                </div>
                <div className="achievement-entry-copy"><h3 className={maskedDuringProgress ? 'is-masked' : ''}>{maskedDuringProgress ? (english ? 'Hidden achievement' : 'Conquista oculta') : item.title}</h3>{item.description && !maskedDuringProgress && <p>{item.id === 'chacma-baboon' ? <em>{item.description}</em> : item.description}</p>}{earned ? <span className="achievement-earned-label"><CheckCircle2 size={15} aria-hidden="true"/>{english ? 'Unlocked' : 'Conquistada'}</span> : <span className="achievement-progress-track" aria-hidden="true"><i style={{ width: `${progress * 100}%` }}/></span>}</div>
              </article>
            })}
          </div>
        </section>)}
      </div>}
    </div>
  </main>
}
