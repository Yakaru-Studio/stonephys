import type { CSSProperties } from 'react'

type SceneIntroTitleProps = {
  place: string
  temporal: string
  geographical: string
  elapsed: number
  duration?: number
  position?: { x?: string; y?: string }
  fadeInSeconds?: number
  holdSeconds?: number
  fadeOutSeconds?: number
}

const smoothstep = (value: number) => { const t = Math.min(1, Math.max(0, value)); return t * t * (3 - 2 * t) }

export default function SceneIntroTitle({ place, temporal, geographical, elapsed, duration = 7, position = { x: '50%', y: '35%' }, fadeInSeconds = 1.5, holdSeconds = 4, fadeOutSeconds = 1.5 }: SceneIntroTitleProps) {
  const fadeOutStarts = Math.min(duration - fadeOutSeconds, fadeInSeconds + holdSeconds)
  const opacity = smoothstep(elapsed / fadeInSeconds) * (1 - smoothstep((elapsed - fadeOutStarts) / fadeOutSeconds))
  const reveal = (delay: number, span = .65) => smoothstep((elapsed - delay) / span) * (elapsed < duration ? 1 : 0)
  const style = { '--intro-opacity': opacity, '--intro-x': position.x, '--intro-y': position.y } as CSSProperties
  return <section className="scene-intro-title" style={style} aria-label={`${place}. ${temporal}. ${geographical}`} aria-live="polite">
    <h1 style={{ opacity: reveal(.12, .85), transform: `translateY(${(1 - reveal(.12, .85)) * 9}px)` }}>{place}</h1>
    <div className="scene-intro-divider" style={{ opacity: reveal(.7, .55) }} aria-hidden="true"><i/><span>✧</span><i/></div>
    <p className="scene-intro-temporal" style={{ opacity: reveal(.85, .65), transform: `translateY(${(1 - reveal(.85, .65)) * 6}px)` }}>{temporal}</p>
    <p className="scene-intro-geographical" style={{ opacity: reveal(1.15, .65), transform: `translateY(${(1 - reveal(1.15, .65)) * 6}px)` }}>{geographical}</p>
  </section>
}
