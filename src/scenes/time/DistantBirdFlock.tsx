import type { CSSProperties } from 'react'
import './distant-birds.css'

type FlockVariant = 'border-cave' | 'lebombo'
type BirdPlacement = { x: number; y: number; size: number; delay: number; duration: number; tilt: number; scale: number }

const flocks: Record<FlockVariant, BirdPlacement[]> = {
  'border-cave': [
    { x: 15, y: 46, size: 24, delay: 0, duration: 26, tilt: -8, scale: .9 },
    { x: 28, y: 55, size: 13, delay: 3, duration: 30, tilt: 7, scale: 1.05 },
    { x: 42, y: 42, size: 26, delay: 6, duration: 27, tilt: -3, scale: .94 },
    { x: 57, y: 51, size: 17, delay: 9, duration: 32, tilt: 6, scale: 1.12 },
    { x: 73, y: 44, size: 25, delay: 12, duration: 29, tilt: -5, scale: 1 },
    { x: 85, y: 57, size: 12, delay: 15, duration: 31, tilt: 8, scale: .86 },
  ],
  lebombo: [
    { x: 22, y: 17, size: 14, delay: 0, duration: 26, tilt: -8, scale: .9 },
    { x: 33, y: 27, size: 23, delay: 3, duration: 30, tilt: 5, scale: 1.08 },
    { x: 45, y: 14, size: 12, delay: 6, duration: 27, tilt: -4, scale: .92 },
    { x: 56, y: 23, size: 25, delay: 9, duration: 32, tilt: 7, scale: 1 },
    { x: 68, y: 12, size: 17, delay: 12, duration: 29, tilt: -6, scale: 1.12 },
    { x: 79, y: 25, size: 22, delay: 15, duration: 31, tilt: 4, scale: .88 },
  ],
}

export default function DistantBirdFlock({ variant }: { variant: FlockVariant }) {
  return <div className={`distant-bird-flock distant-bird-flock-${variant}`} aria-hidden="true">
    {flocks[variant].map((bird, index) => <svg
      key={`${variant}-${index}`}
      className="distant-bird"
      viewBox="0 0 72 44"
      style={{
        '--bird-x': `${bird.x}%`,
        '--bird-y': `${bird.y}%`,
        '--bird-size': `clamp(${bird.size * .62}px, ${bird.size / 11}vw, ${bird.size * 1.15}px)`,
        '--bird-delay': `${bird.delay}s`,
        '--bird-duration': `${bird.duration}s`,
        '--wing-delay': `${(bird.delay * .37).toFixed(2)}s`,
        '--wing-duration': `${.72 + (index % 5) * .11}s`,
        '--bird-tilt': `${bird.tilt}deg`,
        '--bird-scale': bird.scale,
      } as CSSProperties}
    >
      <g className="distant-bird-wings">
        <path className="distant-bird-wing distant-bird-wing-left" d="M34 21C25 16 19 6 6 2L11 10 5 7 14 16 9 14 18 21C23 24 29 24 35 23Z"/>
        <path className="distant-bird-wing distant-bird-wing-right" d="M38 21C47 16 53 6 66 2L61 10 67 7 58 16 63 14 54 21C49 24 43 24 37 23Z"/>
      </g>
      <path className="distant-bird-tail" d="M34 22 27 27 31 25 28 30 34 26 37 29 38 24Z"/>
      <path className="distant-bird-body" d="M33 19C28 17 24 16 19 17L12 14 16 19 11 21 19 21C24 23 29 24 35 23L42 20 52 19 46 17 39 18 36 16Z"/>
      <path className="distant-bird-beak" d="m48 17 8-2-5 4Z"/>
      <circle className="distant-bird-head" cx="37" cy="17.7" r="2.1"/>
    </svg>)}
  </div>
}
