import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import type { ConstellationConfig } from './constellations'
import type { LearningArc } from './arcActs'

export type AppLocale = 'pt-BR' | 'en'
const LOCALE_KEY = 'sharpstone-phys.locale.v1'
const messages = {
  'pt-BR': {
    'app.title': 'Pedra Lascada: Física', 'app.brand': 'Sharp Stone', 'app.modules': 'Módulos', 'app.universe': 'Universo de módulos científicos',
    'audio.title': 'Áudio', 'audio.effects': 'Efeitos sonoros', 'audio.master': 'Volume geral', 'audio.music': 'Música ambiente', 'audio.musicToggle': 'Ativar música ambiente', 'audio.voice': 'Narração', 'audio.language': 'Idioma', 'audio.portuguese': 'Português (Brasil)', 'audio.english': 'English', 'audio.close': 'Fechar configurações de áudio', 'audio.open': 'Configurações de áudio',
    'scene.back': 'Voltar ao mapa', 'scene.skip': 'Pular introdução', 'scene.pause': 'Pausar cena', 'scene.resume': 'Continuar cena', 'scene.next': 'Próxima viagem', 'scene.return': 'Voltar ao primeiro ato', 'scene.debug': 'Depuração da cena', 'scene.location': 'Oficina de John Harrison', 'scene.period': 'Londres, Inglaterra · 1760', 'scene.loading': 'Preparando a oficina…',
    'constellation.back': 'Voltar aos módulos', 'arc.back': 'Voltar à constelação', 'arc.start': 'INICIAR ATO', 'arc.review': 'REVER ATO', 'arc.complete': 'CONCLUIR ATO', 'arc.completed': 'ATO CONCLUÍDO', 'arc.parchment.close': 'Fechar pergaminho', 'arc.current': 'Ato atual',
  },
  en: {
    'app.title': 'Science Learning Universe', 'app.brand': 'Sharp Stone', 'app.modules': 'Modules', 'app.universe': 'Universe of scientific modules',
    'audio.title': 'Audio', 'audio.effects': 'Sound effects', 'audio.master': 'Master volume', 'audio.music': 'Ambient music', 'audio.musicToggle': 'Enable ambient music', 'audio.voice': 'Narration', 'audio.language': 'Language', 'audio.portuguese': 'Português (Brasil)', 'audio.english': 'English', 'audio.close': 'Close audio settings', 'audio.open': 'Audio settings',
    'scene.back': 'Back to map', 'scene.skip': 'Skip introduction', 'scene.pause': 'Pause scene', 'scene.resume': 'Resume scene', 'scene.next': 'Next journey', 'scene.return': 'Return to Act I', 'scene.debug': 'Scene debug', 'scene.location': 'John Harrison’s workshop', 'scene.period': 'London, England · 1760', 'scene.loading': 'Preparing the workshop…',
    'constellation.back': 'Back to modules', 'arc.back': 'Back to constellation', 'arc.start': 'START ACT', 'arc.review': 'REVIEW ACT', 'arc.complete': 'COMPLETE ACT', 'arc.completed': 'ACT COMPLETED', 'arc.parchment.close': 'Close scroll', 'arc.current': 'Current act',
  },
} satisfies Record<AppLocale, Record<string, string>>

type I18nValue = { locale: AppLocale; setLocale: (locale: AppLocale) => void; t: (key: keyof typeof messages['pt-BR']) => string }
const I18nContext = createContext<I18nValue | null>(null)
const getInitialLocale = (): AppLocale => {
  if (typeof window === 'undefined') return 'pt-BR'
  try { return window.localStorage.getItem(LOCALE_KEY) === 'en' ? 'en' : 'pt-BR' } catch { return 'pt-BR' }
}

export function LocaleProvider({ children }: { children: ReactNode }) {
  const [locale, setLocale] = useState<AppLocale>(getInitialLocale)
  useEffect(() => { try { window.localStorage.setItem(LOCALE_KEY, locale) } catch { /* local storage may be disabled */ } }, [locale])
  const value = useMemo(() => ({ locale, setLocale, t: (key: keyof typeof messages['pt-BR']) => messages[locale][key] }), [locale])
  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>
}

export function useLocale() {
  const value = useContext(I18nContext)
  if (!value) throw new Error('useLocale deve ser usado dentro de LocaleProvider')
  return value
}

export function localizeText(locale: AppLocale, portuguese: string, english: string) {
  return locale === 'en' ? english : portuguese
}

export function localizeModule<T extends { id: string; name: string; subtitle: string; description: string }>(locale: AppLocale, module: T): T {
  if (locale !== 'en') return module
  const english: Record<string, [string, string, string]> = {
    time: ['TIME', 'The first measure', 'Discover how humanity learned to observe, measure, and understand time.'],
    distance: ['DISTANCE', 'Dimensions of the world', 'Explore how civilizations developed ways to measure lengths, distances, and the dimensions of the world.'],
    velocity: ['VELOCITY', 'Space in motion', 'A new physical quantity emerges when distance meets time.'],
  }
  const values = english[module.id]
  return values ? { ...module, name: values[0], subtitle: values[1], description: values[2] } : module
}

const starEnglish: Record<string, [string, string]> = {
  sky: ['Arc I — The Gods of Light and Darkness', 'Explore how the Sun and Moon marked the earliest cycles and inspired stories about the passage of time.'],
  shadow: ['The Measuring Shadow', 'Follow the idea of using the Sun’s position and its shadow to divide the day into intervals.'],
  sundial: ['The Sundial', 'Discover how sundials turned observations of the sky into a practical tool.'],
  water: ['Time That Flows', 'Learn how water clocks measured time through a steady flow.'],
  sand: ['Sand Between the Hands', 'Explore why the hourglass became a simple, portable way to measure duration.'],
  mechanism: ['Gears and Hours', 'See how mechanisms and escapements made clocks more regular.'],
  pocket: ['Time in Your Pocket', 'Follow the miniaturization of clocks and the personal use of measured time.'],
  precision: ['Precision in Motion', 'Explore how pendulums, springs, and new techniques made clocks more accurate.'],
  atomic: ['The Atomic Second', 'Reach the modern definition of the second, based on transitions in atoms.'],
  body: ['Measures of the Body', 'Learn about early units based on steps, hands, and other bodily references.'],
  marks: ['Marks and Standards', 'See how shared standards helped communities compare lengths.'],
  ruler: ['The Ruler', 'Explore the graduated ruler and the measurement of short distances.'],
  survey: ['Measuring the Land', 'Follow instruments and techniques for measuring land and wide areas.'],
  triangulation: ['Triangles on the Horizon', 'Discover how triangulation calculates distances that are hard to reach.'],
  metric: ['The Metric System', 'Learn how standardized units made measurements comparable everywhere.'],
  light: ['Measuring the Invisible', 'See how light and signal travel time help measure immense distances.'],
  cosmic: ['Cosmic Scales', 'Explore tools that reveal the size of stars and galaxies.'],
  motion: ['Noticing Motion', 'Begin by distinguishing a change of position from motion relative to a reference frame.'],
  'distance-time': ['Distance and Time', 'Relate distance travelled to the time interval used for the observation.'],
  average: ['Average Speed', 'Calculate the ratio of displacement to elapsed time along a route.'],
  direction: ['Direction Matters', 'Understand how direction turns speed into a vector quantity.'],
  instant: ['A Moment in the Journey', 'Estimate speed at an instant using progressively shorter intervals.'],
  'light-speed': ['The Speed of Light', 'Explore the speed of light and its central role in modern physics.'],
}

export function localizeConstellation(locale: AppLocale, config: ConstellationConfig): ConstellationConfig {
  if (locale !== 'en') return config
  const names: Record<string, [string, string]> = { time: ['Time', 'The first measure'], distance: ['Distance', 'Dimensions of the world'], velocity: ['Velocity', 'Space in motion'] }
  const [name, eyebrow] = names[config.moduleId] || [config.name, config.eyebrow]
  return { ...config, name, eyebrow, stars: config.stars.map((star) => starEnglish[star.id] ? { ...star, title: starEnglish[star.id][0], description: starEnglish[star.id][1] } : star) }
}

export function localizeArc(locale: AppLocale, arc: LearningArc): LearningArc {
  if (locale !== 'en') return arc
  const names: Record<string, [string, string]> = { time: ['Time', 'The Gods of Light and Darkness'], distance: ['Distance', 'Dimensions of the World'], velocity: ['Velocity', 'Space in Motion'] }
  const [moduleName, title] = names[arc.moduleId] || [arc.moduleName, arc.title]
  const acts: Record<string, [string, string]> = {
    'first-observation': ['The First Look', 'Before clocks, the sky helped people recognize cycles. Observe the stars and discover how early communities found reference points for the passage of time.'],
    'shadow-measure': ['The Shadow That Measures', 'The Sun’s height turns a shadow into a measure. Follow the creation of calendars and early ways to organize the day.'],
    'age-of-sun': ['The Taosi Gnomon', 'At Taosi, a vertical rod and its shadow helped people follow the Sun’s path. A wooden bowl and spoon complete the objects used in this ancient observation.'],
    wayfinder: ['The Compass Rose', 'The stars guided journeys over land and sea. Discover how direction and motion helped people measure distances and duration.'],
    'counting-marks': ['The Lebombo Bone', 'Marks on stone and bone preserved counts long before writing. Revisit early gestures for tracking cycles.'],
    'last-seal': ['The Cycle Still Hidden', 'One final discovery waits beyond the paths already known.'],
  }
  return { ...arc, moduleName, title, acts: arc.acts.map((act) => acts[act.id] ? { ...act, title: acts[act.id][0], description: acts[act.id][1] } : act) }
}
