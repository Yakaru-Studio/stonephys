import { useEffect, useState, type CSSProperties } from 'react'
import { CheckCircle2 } from 'lucide-react'
import { type AppLocale } from './i18n'
import AudioControls from './audio/AudioControls'
import { readScientificNotes, scientificNoteReadEvent } from './scientificNotes'
import './achievements-home.css'

type Achievement = { id: string; title: string; description?: string; icon: string; completedAfterLebombo?: boolean; earnedByDefault?: boolean; inProgress?: boolean; note?: boolean; tenNotes?: boolean }
type AchievementCategory = { id: string; title: string; icon: string; items: Achievement[] }

const images = import.meta.glob('./assets/achievements/**/*.png', { eager: true, query: '?url', import: 'default' }) as Record<string, string>
const image = (folder: 'categorias' | 'conquistas', id: string) => images[`./assets/achievements/${folder}/${id}.png`]

function categories(english: boolean): AchievementCategory[] {
  return [
    { id: 'astros', title: english ? 'Celestial bodies' : 'Astros', icon: 'astros', items: [
      { id: 'sun', title: english ? 'Sun' : 'Sol', icon: 'sol', inProgress: true }, { id: 'moon', title: english ? 'Moon' : 'Lua', icon: 'lua', inProgress: true },
    ] },
    { id: 'module', title: english ? 'Module' : 'Módulo', icon: 'modulos', items: [
      { id: 'time', title: english ? 'Time' : 'Tempo', icon: 'tempo', inProgress: true },
    ] },
    { id: 'artifacts', title: english ? 'Artifact trophies' : 'Artefatos', icon: 'artefatos', items: [
      { id: 'lebombo', title: english ? 'Lebombo Bone' : 'Osso de Lebombo', icon: 'osso_de_lebombo', completedAfterLebombo: true },
    ] },
    { id: 'tools', title: english ? 'Tools' : 'Ferramentas', icon: 'ferramentas', items: [
      { id: 'flaked-stone', title: english ? 'Flaked Stone' : 'Pedra Lascada', icon: 'pedra_lascada', completedAfterLebombo: true },
    ] },
    { id: 'measures', title: english ? 'Measures' : 'Medidas', icon: 'medidas', items: [
      { id: 'day', title: english ? 'Day' : 'Dia', icon: 'unidade_tempo_dia', inProgress: true }, { id: 'month', title: english ? 'Month' : 'Mês', icon: 'unidade_tempo_mes', inProgress: true },
    ] },
    { id: 'countries', title: english ? 'Countries (anachronistic)' : 'Países (anacrônico)', icon: 'paises', items: [
      { id: 'south-africa', title: english ? 'South Africa' : 'África do Sul', icon: 'africa_do_sul', inProgress: true },
    ] },
    { id: 'fossils', title: english ? 'Fossils' : 'Fósseis', icon: 'fosseis', items: [
      { id: 'chacma-baboon-fossil', title: english ? 'Chacma baboon' : 'Babuíno-chacma', description: 'Papio ursinus', icon: 'babuino_chacma_fossil', completedAfterLebombo: true },
    ] },
    { id: 'fauna-sightings', title: english ? 'Fauna sightings' : 'Avistamento de fauna', icon: 'avistamento_fauna', items: [
      { id: 'chacma-baboon', title: english ? 'Chacma baboon' : 'Babuíno-chacma', description: 'Papio ursinus', icon: 'babuino_chacma', completedAfterLebombo: true },
      { id: 'plains-zebra', title: english ? 'Plains zebra' : 'Zebra-das-planícies', description: 'Equus quagga', icon: 'zebra_das_planicies', completedAfterLebombo: true },
      { id: 'impala', title: english ? 'Impala' : 'Antílope-impala', description: 'Aepyceros melampus', icon: 'antilope_impala', completedAfterLebombo: true },
      { id: 'african-warthog', title: english ? 'African warthog' : 'Javali-africano', description: 'Phacochoerus africanus', icon: 'javali_africano', completedAfterLebombo: true },
      { id: 'cape-vulture', title: english ? 'Cape vulture' : 'Abutre-do-cabo', description: 'Gyps coprotheres', icon: 'abutre_do_cabo', completedAfterLebombo: true },
    ] },
    { id: 'flora-sightings', title: english ? 'Flora sightings' : 'Avistamento de Flora', icon: 'avistamento_flora', items: [
      { id: 'sweet-thorn-acacia', title: english ? 'Sweet thorn acacia' : 'Acácia-de-espinhos-doces', description: 'Vachellia karroo', icon: 'acacia_espinhos_doces', completedAfterLebombo: true },
    ] },
    { id: 'characters', title: english ? 'Characters' : 'Personagens', icon: 'personagens', items: [
      { id: 'aru', title: 'Aru', icon: 'aru', completedAfterLebombo: true },
    ] },
    { id: 'historical-characters', title: english ? 'Historical figures' : 'Personagens históricos', icon: 'personagens_historicos', items: [
      { id: 'john-harrison', title: 'John Harrison', icon: 'john_harrison', inProgress: true },
    ] },
    { id: 'places', title: english ? 'Places' : 'Locais', icon: 'locais', items: [
      { id: 'border-cave', title: 'Border Cave', icon: 'border_cave', completedAfterLebombo: true },
    ] },
    { id: 'human-milestones', title: english ? 'Human milestones' : 'Marcos humanos', icon: 'marcos_humanos', items: [
      { id: 'counting', title: english ? 'Counting' : 'Contagem', icon: 'contagem', completedAfterLebombo: true },
    ] },
    { id: 'traditional', title: english ? 'Milestones' : 'Marcos', icon: 'feitos', items: [
      { id: 'first-step', title: english ? 'The First Step' : 'O primeiro passo', description: english ? 'Complete your first interactive activity.' : 'Conclua sua primeira atividade interativa.', icon: 'o_primeiro_passo', completedAfterLebombo: true },
      { id: 'time-guardian', title: english ? 'Guardian of Time' : 'Guardião do tempo', description: english ? 'Complete the full experience of time.' : 'Conclua a experiência completa do Tempo.', icon: 'guardiao_do_tempo', inProgress: true },
      { id: 'curious-mind', title: english ? 'Curious Mind' : 'Mente curiosa', description: english ? 'Read your first scientific note.' : 'Leia sua primeira nota científica.', icon: 'mente_curiosa', note: true },
      { id: 'thirst-for-knowledge', title: english ? 'Thirst for Knowledge' : 'Sede de conhecimento', description: english ? 'Read 10 historical or scientific notes.' : 'Leia 10 notas históricas ou científicas.', icon: 'sede_de_conhecimento', tenNotes: true },
      { id: 'world-explorer', title: english ? 'World Explorer' : 'Explorador do mundo', description: english ? 'Unlock 10 countries.' : 'Desbloqueie 10 países.', icon: 'explorador_do_mundo', inProgress: true },
      { id: 'eyes-to-the-cosmos', title: english ? 'Eyes to the Cosmos' : 'Olhos para o cosmos', description: english ? 'Complete your first astronomical collection.' : 'Conclua sua primeira coleção astronômica.', icon: 'olhos_para_o_cosmos', inProgress: true },
      { id: 'stone-to-stars', title: english ? 'From Stone to Stars' : 'Da pedra às estrelas', description: english ? 'Travel through humanity’s journey to space exploration.' : 'Percorra toda a jornada da humanidade até a exploração espacial.', icon: 'da_pedra_as_estrelas', inProgress: true },
    ] },
  ]
}

export default function AchievementsHome({ locale, lebomboComplete }: { locale: AppLocale; lebomboComplete: boolean }) {
  const english = locale === 'en'
  const [readNotes, setReadNotes] = useState(readScientificNotes)
  useEffect(() => {
    const update = () => setReadNotes(readScientificNotes())
    window.addEventListener(scientificNoteReadEvent, update)
    window.addEventListener('storage', update)
    return () => { window.removeEventListener(scientificNoteReadEvent, update); window.removeEventListener('storage', update) }
  }, [])
  const groups = categories(english).map((group) => ({
    ...group,
    items: group.items.filter((item) => item.earnedByDefault || item.inProgress || (item.completedAfterLebombo ? lebomboComplete : item.note ? readNotes.length > 0 : item.tenNotes ? readNotes.length > 0 : false)),
  })).filter((group) => group.items.length > 0)

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
              const noteCount = readNotes.length
              const earned = Boolean(item.earnedByDefault || (item.completedAfterLebombo ? lebomboComplete : item.note ? noteCount > 0 : item.tenNotes ? noteCount >= 10 : false))
              const progress = earned ? 1 : item.tenNotes ? Math.min(.92, noteCount / 10) : item.inProgress ? .28 : 0
              const maskedDuringProgress = group.id === 'historical-characters' && !earned
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
