import type { CSSProperties } from 'react'

const h4CaseDial = new URL('../../assets/scenes/time/harrison-workshop/h4-case-dial.png', import.meta.url).href
const h4Cushion = new URL('../../assets/scenes/time/harrison-workshop/h4-cushion.png', import.meta.url).href

export default function H4Watch({ time, style }: { time: number; style?: CSSProperties }) {
  const rewindStart = 22
  const rewindTime = Math.max(0, time - rewindStart)
  const rewindSeconds = rewindTime + Math.min(rewindTime, 8) ** 2 * .72
  const initialSeconds = 10 * 3600 + 10 * 60 + 30
  const simulatedSeconds = time <= rewindStart ? initialSeconds + time : initialSeconds + rewindStart - rewindSeconds * 5.2
  const seconds = simulatedSeconds * 6
  const minutes = simulatedSeconds * .1
  const hours = simulatedSeconds / 120

  return <svg className="h4-watch" viewBox="0 0 260 340" role="img" aria-label="Relógio marítimo H4 de John Harrison" style={style}>
    <image className="h4-cushion-art" href={h4Cushion} x="-60" y="150" width="380" height="240" preserveAspectRatio="xMidYMid meet"/>
    <image className="h4-case-dial-art" href={h4CaseDial} x="0" y="41" width="260" height="257" preserveAspectRatio="xMidYMid meet"/>
    <g className="h4-hands" transform="translate(0 34)">
      <g className="h4-hand h4-hour-hand" style={{ transform: `rotate(${hours}deg)` }}>
        <path d="M130 189 128.7 153 130 150 131.3 153 130.7 189Z"/>
      </g>
      <g className="h4-hand h4-minute-hand" style={{ transform: `rotate(${minutes}deg)` }}>
        <path d="M130 189 128.8 142 130 140 131.2 142 130.7 189Z"/>
      </g>
      <g className="h4-hand h4-second-hand" style={{ transform: `rotate(${seconds}deg)` }}>
        <path d="M130 189 129.6 140 130 138 130.4 140 130.2 189Z"/>
      </g>
      <circle className="h4-pivot-rim" cx="130" cy="189" r="6.2"/>
      <circle className="h4-pivot" cx="130" cy="189" r="3.6"/>
      <circle className="h4-pivot-glint" cx="128.7" cy="187.8" r="1.2"/>
    </g>
  </svg>
}
