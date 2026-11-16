import { useEffect, useMemo, useRef, useState, type CSSProperties } from 'react'
import { ArrowLeft, X } from 'lucide-react'
import { audioManager } from './audio/AudioManager'
import { learningArcs, type ArcAct, type ArcConnection, type ActSymbol } from './arcActs'
import './arc-map.css'

const ancientStoneTexture = new URL('./assets/arcs/ancient-stone-floor.png', import.meta.url).href
const ancientMedallionStoneTexture = new URL('./assets/arcs/ancient-medallion-limestone-weathered.png', import.meta.url).href
const greekRuinsArtwork = new URL('./assets/arcs/greek-ruins-rudimentary.png', import.meta.url).href
const greekRuinStonesArtwork = new URL('./assets/arcs/greek-ruin-stones-lowpoly.png', import.meta.url).href
const greekRuinStonesCompactArtwork = new URL('./assets/arcs/greek-ruin-stones-compact.png', import.meta.url).href
const greekRuinWallArtwork = new URL('./assets/arcs/greek-ruin-wall.png', import.meta.url).href
const greekRuinCapitalArtwork = new URL('./assets/arcs/greek-ruin-capital.png', import.meta.url).href
const templeWeedsArtwork = new URL('./assets/arcs/temple-weeds-lowpoly.png', import.meta.url).href
const templeStoneFragmentsArtwork = new URL('./assets/arcs/temple-stone-fragments.png', import.meta.url).href
const currentFlameArtwork = new URL('./assets/arcs/current-fire-fluid.png', import.meta.url).href

function pointFor(act: ArcAct) {
  return { x: act.position.x * 10, y: act.position.y * 16 }
}

function routeGeometry(from: ArcAct, to: ArcAct, kind: ArcConnection['kind']) {
  const a = pointFor(from)
  const b = pointFor(to)
  const dx = b.x - a.x
  const dy = b.y - a.y
  const bend = kind === 'optional' ? 64 : -42
  const p1 = { x: a.x + dx * .34 + bend, y: a.y + dy * .29 }
  const p2 = { x: a.x + dx * .69 - bend, y: a.y + dy * .72 }
  const d = `M${a.x} ${a.y} C${p1.x} ${p1.y} ${p2.x} ${p2.y} ${b.x} ${b.y}`
  const trunk = taperedRoot(a, p1, p2, b, 16, 11, kind === 'optional' ? 10 : 7, (from.id.length + to.id.length) * .17, 1.55)
  const crossingRoots: Array<{
    path: string
    facetPath: string
    thornD: string
    thornFacetD: string
    start: ThornPoint
    angle: number
    twigs: Array<{ path: string; facetPath: string; thornD: string; thornFacetD: string; start: ThornPoint; angle: number }>
  }> = []

  const fmt = (point: ThornPoint) => `${point.x.toFixed(1)} ${point.y.toFixed(1)}`
  const addSpine = (sample: ThornSample, index: number, thorns: string[], thornFacets: string[], scale = 1) => {
    const direction = index % 2 === 0 ? 1 : -1
    const length = (17 + (index % 3) * 3) * scale
    const halfBase = (5 + (index % 2)) * scale
    const tip = { x: sample.point.x + sample.normal.x * direction * length, y: sample.point.y + sample.normal.y * direction * length }
    const left = { x: sample.point.x - sample.tangent.x * halfBase, y: sample.point.y - sample.tangent.y * halfBase }
    const right = { x: sample.point.x + sample.tangent.x * halfBase, y: sample.point.y + sample.tangent.y * halfBase }
    thorns.push(`M${fmt(left)} L${fmt(tip)} L${fmt(right)} Z`)
    const facetLeft = { x: left.x * .42 + tip.x * .58, y: left.y * .42 + tip.y * .58 }
    const facetRight = { x: right.x * .42 + tip.x * .58, y: right.y * .42 + tip.y * .58 }
    thornFacets.push(`M${fmt(facetLeft)} L${fmt(tip)} L${fmt(facetRight)} Z`)
  }

  const crossings = [
    { t: .1, side: -1, width: 29, startShift: -16, endShift: 8, bend: 19, wave: 8, phase: .3 },
    { t: .22, side: 1, width: 37, startShift: 18, endShift: -12, bend: -25, wave: 9, phase: 1.3 },
    { t: .36, side: -1, width: 31, startShift: -7, endShift: 18, bend: 14, wave: 7, phase: 2.1 },
    { t: .49, side: 1, width: 40, startShift: 22, endShift: -21, bend: -19, wave: 12, phase: .7 },
    { t: .63, side: -1, width: 34, startShift: -24, endShift: 5, bend: 26, wave: 10, phase: 1.9 },
    { t: .74, side: 1, width: 29, startShift: 6, endShift: -19, bend: -15, wave: 8, phase: .5 },
    { t: .85, side: -1, width: 38, startShift: 17, endShift: -6, bend: 22, wave: 11, phase: 2.7 },
    { t: .94, side: 1, width: 33, startShift: -14, endShift: 20, bend: -27, wave: 7, phase: 1.1 },
  ]
  crossings.forEach((crossing, index) => {
    const thorns: string[] = []
    const thornFacets: string[] = []
    const sample = trunk.samples[Math.round(crossing.t * (trunk.samples.length - 1))]
    const { side, width: crossingWidth } = crossing
    const start = { x: sample.point.x + sample.normal.x * side * crossingWidth + sample.tangent.x * crossing.startShift, y: sample.point.y + sample.normal.y * side * crossingWidth + sample.tangent.y * crossing.startShift }
    const end = { x: sample.point.x - sample.normal.x * side * (crossingWidth + 4) + sample.tangent.x * crossing.endShift, y: sample.point.y - sample.normal.y * side * (crossingWidth + 4) + sample.tangent.y * crossing.endShift }
    const controlA = { x: start.x + sample.tangent.x * crossing.bend + sample.normal.x * side * 8, y: start.y + sample.tangent.y * crossing.bend + sample.normal.y * side * 8 }
    const controlB = { x: end.x - sample.tangent.x * crossing.bend * .72 - sample.normal.x * side * 7, y: end.y - sample.tangent.y * crossing.bend * .72 - sample.normal.y * side * 7 }
    const branch = taperedRoot(start, controlA, controlB, end, 8.4 + (index % 2) * .8, .3, crossing.wave, crossing.phase, 1.5 + (index % 3) * .28)
    ;[.23, .51, .8].forEach((spineT, spineIndex) => addSpine(branch.samples[Math.round(spineT * (branch.samples.length - 1))], index + spineIndex + 1, thorns, thornFacets, .9))

    const twigCount = index % 3 === 0 ? 2 : index % 2 === 0 ? 1 : 0
    const twigGeometries: Array<{ path: string; facetPath: string; thornD: string; thornFacetD: string; start: ThornPoint; angle: number }> = []
    Array.from({ length: twigCount }, (_, twigIndex) => {
      const twigThorns: string[] = []
      const twigThornFacets: string[] = []
      const twigProgress = twigCount === 1 ? .55 : .34 + twigIndex * .34
      const twigStartSample = branch.samples[Math.round(twigProgress * (branch.samples.length - 1))]
      const twigSide = (index + twigIndex) % 2 === 0 ? -1 : 1
      const twigStart = twigStartSample.point
      const twigLength = 19 + ((index + twigIndex) % 3) * 4
      const alongPath = twigIndex % 2 === 0 ? 11 : -9
      const twigEnd = { x: twigStart.x + twigStartSample.normal.x * twigSide * twigLength + twigStartSample.tangent.x * alongPath, y: twigStart.y + twigStartSample.normal.y * twigSide * twigLength + twigStartSample.tangent.y * alongPath }
      const twigControlA = { x: twigStart.x + twigStartSample.tangent.x * 5 + twigStartSample.normal.x * twigSide * 9, y: twigStart.y + twigStartSample.tangent.y * 5 + twigStartSample.normal.y * twigSide * 9 }
      const twigControlB = { x: twigEnd.x - twigStartSample.tangent.x * 6 + twigStartSample.normal.x * twigSide * 3, y: twigEnd.y - twigStartSample.tangent.y * 6 + twigStartSample.normal.y * twigSide * 3 }
      const twig = taperedRoot(twigStart, twigControlA, twigControlB, twigEnd, 4.8, .12, 4.2, index * .8 + twigIndex, 1.7)
      addSpine(twig.samples[Math.round(.58 * (twig.samples.length - 1))], index + twigIndex + 2, twigThorns, twigThornFacets, .72)
      twigGeometries.push({
        path: twig.path,
        facetPath: twig.facetPath,
        thornD: twigThorns.join(' '),
        thornFacetD: twigThornFacets.join(' '),
        start: twig.start,
        angle: Math.atan2(twig.samples[0].tangent.y, twig.samples[0].tangent.x) * 180 / Math.PI,
      })
    })
    crossingRoots.push({
      path: branch.path,
      facetPath: branch.facetPath,
      thornD: thorns.join(' '),
      thornFacetD: thornFacets.join(' '),
      start: branch.start,
      angle: Math.atan2(branch.samples[0].tangent.y, branch.samples[0].tangent.x) * 180 / Math.PI,
      twigs: twigGeometries,
    })
  })

  return { d, crossingRoots }
}

function Terrain() {
  return <svg className="arc-terrain" viewBox="0 0 1000 1600" preserveAspectRatio="none" aria-hidden="true">
    <defs>
      <linearGradient id="arc-stone-ground" x2=".8" y2="1"><stop stopColor="#77736d"/><stop offset=".48" stopColor="#625f5a"/><stop offset="1" stopColor="#494743"/></linearGradient>
      <pattern id="arc-stone-phototexture" width="420" height="420" patternUnits="userSpaceOnUse">
        <image href={ancientStoneTexture} width="420" height="420" preserveAspectRatio="xMidYMid slice" style={{ filter: 'grayscale(.34) brightness(.96) sepia(.1) contrast(1.05)' }} />
      </pattern>
      <radialGradient id="edge-shadow"><stop offset=".55" stopColor="#171510" stopOpacity="0"/><stop offset="1" stopColor="#171510" stopOpacity=".5"/></radialGradient>
    </defs>
    <rect width="1000" height="1600" fill="url(#arc-stone-ground)"/>
    <rect width="1000" height="1600" fill="url(#arc-stone-phototexture)" opacity=".92"/>
    <rect width="1000" height="1600" fill="#8d9293" opacity=".12"/>
    <rect width="1000" height="1600" fill="url(#edge-shadow)"/>
    <g className="arc-ground-details" aria-hidden="true">
      <image className="arc-ground-weed-art" href={templeWeedsArtwork} x="430" y="390" width="92" height="78" preserveAspectRatio="xMidYMid meet" transform="rotate(8 476 429)"/>
      <image className="arc-ground-weed-art" href={templeWeedsArtwork} x="820" y="485" width="80" height="68" preserveAspectRatio="xMidYMid meet" transform="rotate(-17 860 519)"/>
      <image className="arc-ground-weed-art" href={templeWeedsArtwork} x="80" y="780" width="84" height="72" preserveAspectRatio="xMidYMid meet" transform="rotate(10 122 816)"/>
      <image className="arc-ground-weed-art" href={templeWeedsArtwork} x="860" y="1048" width="88" height="76" preserveAspectRatio="xMidYMid meet" transform="rotate(-12 904 1086)"/>
      <image className="arc-ground-weed-art" href={templeWeedsArtwork} x="470" y="1395" width="76" height="65" preserveAspectRatio="xMidYMid meet" transform="rotate(18 508 1427)"/>
      <image className="arc-ground-stone-art" href={templeStoneFragmentsArtwork} x="384" y="448" width="88" height="58" preserveAspectRatio="xMidYMid meet" transform="rotate(-11 428 477)"/>
      <image className="arc-ground-stone-art" href={templeStoneFragmentsArtwork} x="120" y="1034" width="94" height="62" preserveAspectRatio="xMidYMid meet" transform="rotate(12 167 1065)"/>
      <image className="arc-ground-stone-art" href={templeStoneFragmentsArtwork} x="842" y="775" width="100" height="66" preserveAspectRatio="xMidYMid meet" transform="rotate(7 892 808)"/>
      <image className="arc-ground-stone-art" href={templeStoneFragmentsArtwork} x="576" y="1190" width="84" height="56" preserveAspectRatio="xMidYMid meet" transform="rotate(-16 618 1218)"/>
      <image className="arc-ground-stone-art" href={templeStoneFragmentsArtwork} x="780" y="1450" width="90" height="60" preserveAspectRatio="xMidYMid meet" transform="rotate(14 825 1480)"/>
    </g>
    <image className="arc-ruin-art" href={greekRuinsArtwork} x="-48" y="78" width="405" height="405" preserveAspectRatio="xMidYMid meet"/>
    <g className="arc-temple-mosaic" transform="translate(1010 1300) rotate(-18)" aria-hidden="true">
      <path d={polygonPathAt(0, 0, 226, 16)}/><path d={polygonPathAt(0, 0, 206, 16)}/><path d={polygonPathAt(0, 0, 184, 16)}/>
      <path d="M-184 0h368M0-184v368M-130-130l260 260m0-260-260 260"/>
      <path d="M-164-164h38v14h-24v24h-14zm328 0h-38v14h24v24h14zM-164 164h38v-14h-24v-24h-14zm328 0h-38v-14h24v-24h14z"/>
      <path d="m0-138 18 120L138 0 18 18 0 138-18 18-138 0-18-18z"/>
    </g>
    <image className="arc-ruin-stones-art" href={greekRuinStonesArtwork} x="-24" y="1275" width="205" height="137" preserveAspectRatio="xMidYMid meet"/>
    <image className="arc-ruin-stones-art" href={greekRuinStonesCompactArtwork} x="818" y="708" width="188" height="125" preserveAspectRatio="xMidYMid meet"/>
    <image className="arc-ruin-stones-art" href={greekRuinCapitalArtwork} x="-24" y="1435" width="198" height="132" preserveAspectRatio="xMidYMid meet"/>
    <image className="arc-ruin-stones-art" href={greekRuinWallArtwork} x="820" y="1482" width="185" height="123" preserveAspectRatio="xMidYMid meet"/>
    <EdgeThornBranches/>
  </svg>
}

function MedallionSymbol({ symbol }: { symbol: ActSymbol }) {
  if (symbol === 'telescope') return <g className="medallion-symbol telescope-symbol"><path d="m54 74 64-24 12 20-64 26z"/><path d="M82 90 78 126m4-27-23 30m23-30 25 24"/><path d="m48 72 9-4 9 23-9 4z"/></g>
  if (symbol === 'pyramid') return <g className="medallion-symbol pyramid-symbol"><path d="m48 116 42-58 42 58z"/><path d="M58 102h64M68 88h44M78 74h24"/></g>
  if (symbol === 'bull') return <g className="medallion-symbol bull-symbol">
    <path className="bull-body" d="m47 90 8-15 18-8 29 2 15 11 18 4-4 13-16 2-8 24-8 2-5-23-19 1-7 22-9-1 1-25-13 3z"/>
    <path className="bull-facet" d="m57 77 18-10 27 2 14 10-25 6-19-2z"/>
    <path className="bull-legs" d="m58 95-3 25 8 1 8-22m21-1 4 23 8-1 4-24m14-12 1 33 8 1 3-32"/>
    <path className="bull-horns" d="m56 76-8-11-9 2m70 5 9-10 10 2"/>
  </g>
  if (symbol === 'compass') return <g className="medallion-symbol compass-symbol"><path d="m90 47 9 33 31 10-31 9-9 34-9-34-32-9 32-10z"/><path d="m90 63 4 23 22 4-22 4-4 25-5-25-22-4 22-4z"/></g>
  if (symbol === 'tally') return <g className="medallion-symbol tally-symbol"><path d="m58 62 18 61m7-68 18 61m7-68 18 61M47 112l84-32"/><path d="M52 129h76"/></g>
  if (symbol === 'bone') return <g className="medallion-symbol bone-symbol"><path className="bone-base" d="M45 77 54 67 65 67 74 76 106 76 115 67 126 67 136 77 136 86 127 95 136 104 126 113 115 113 106 104 74 104 65 113 54 113 45 104 45 95 54 86z"/><path className="bone-facet" d="M72 80h36l-7 20H79z"/></g>
  return <g className="medallion-lock"><path d="M75 88V76a15 15 0 0 1 30 0v12"/><rect x="66" y="86" width="48" height="37" rx="5"/><circle cx="90" cy="103" r="4"/><path d="M90 106v8"/></g>
}

function CurrentFlame() {
  const contourRef = useRef<SVGPathElement>(null)
  const silhouetteRef = useRef<SVGPathElement>(null)
  const coreRef = useRef<SVGPathElement>(null)

  useEffect(() => {
    const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)')
    if (reducedMotion.matches) return

    const point = (x: number, y: number) => `${x.toFixed(1)} ${y.toFixed(1)}`
    const wave = (time: number, rate: number, phase: number, amplitude: number) => Math.sin(time * rate + phase) * amplitude
    const outerPath = (time: number) => `M90 216
      C${point(79 + wave(time, 1.8, .1, 9), 202)} ${point(59 + wave(time, 2.3, 1.1, 12), 190)} ${point(50 + wave(time, 2.7, .6, 9), 168)}
      C${point(43 + wave(time, 2.1, 2.2, 9), 148)} ${point(53 + wave(time, 3.1, .3, 11), 132)} ${point(60 + wave(time, 2.4, 1.8, 9), 115)}
      C${point(68 + wave(time, 2.6, .5, 12), 98)} ${point(58 + wave(time, 3.3, 1.5, 9), 82)} ${point(66 + wave(time, 2, 2.6, 9), 65)}
      C${point(74 + wave(time, 2.8, .2, 10), 47)} ${point(87 + wave(time, 3.2, 1, 8), 36)} ${point(87 + wave(time, 2.5, 2, 8), 16)}
      C${point(103 + wave(time, 2.7, .4, 9), 25)} ${point(112 + wave(time, 2.2, 1.6, 12), 45)} ${point(118 + wave(time, 3, .9, 10), 64)}
      C${point(127 + wave(time, 2.4, 2.4, 11), 82)} ${point(134 + wave(time, 3.1, .1, 10), 102)} ${point(128 + wave(time, 2.2, 1.3, 9), 123)}
      C${point(122 + wave(time, 2.9, .7, 11), 143)} ${point(137 + wave(time, 2.1, 2.1, 9), 157)} ${point(130 + wave(time, 3.2, .5, 8), 175)}
      C${point(124 + wave(time, 2.5, 1.7, 10), 195)} ${point(106 + wave(time, 2.8, .3, 9), 204)} 90 216 Z`
    const corePath = (time: number) => `M90 207
      C${point(80 + wave(time, 2.2, .5, 6), 190)} ${point(65 + wave(time, 2.8, 1.2, 8), 177)} ${point(62 + wave(time, 2.4, .1, 6), 159)}
      C${point(58 + wave(time, 3, 1.6, 7), 143)} ${point(68 + wave(time, 2.6, .7, 8), 127)} ${point(74 + wave(time, 2.1, 2.2, 6), 111)}
      C${point(81 + wave(time, 2.7, .4, 8), 94)} ${point(75 + wave(time, 3.3, 1.4, 6), 80)} ${point(83 + wave(time, 2.5, 2.3, 7), 65)}
      C${point(88 + wave(time, 2.2, .8, 6), 51)} ${point(94 + wave(time, 3, .2, 6), 46)} ${point(96 + wave(time, 2.4, 1.7, 6), 34)}
      C${point(105 + wave(time, 2.8, .5, 7), 51)} ${point(104 + wave(time, 2.3, 1.9, 6), 68)} ${point(112 + wave(time, 2.7, .9, 7), 85)}
      C${point(120 + wave(time, 3.1, 1.5, 8), 103)} ${point(117 + wave(time, 2.4, .3, 6), 120)} ${point(111 + wave(time, 2.9, 2.1, 7), 139)}
      C${point(105 + wave(time, 2.2, .7, 8), 158)} ${point(108 + wave(time, 3, 1.3, 6), 182)} 90 207 Z`

    let frame = 0
    let lastUpdate = 0
    const animateFlame = (now: number) => {
      if (now - lastUpdate >= 40) {
        const time = now / 1000
        const contour = outerPath(time)
        contourRef.current?.setAttribute('d', contour)
        silhouetteRef.current?.setAttribute('d', contour)
        coreRef.current?.setAttribute('d', corePath(time))
        lastUpdate = now
      }
      frame = window.requestAnimationFrame(animateFlame)
    }

    frame = window.requestAnimationFrame(animateFlame)
    return () => window.cancelAnimationFrame(frame)
  }, [])

  return <svg className="act-current-flame" viewBox="0 0 180 240" aria-hidden="true">
    <defs>
      <clipPath id="current-flame-shape"><path ref={contourRef} d="M90 216 C79 202 59 190 50 168 C43 148 53 132 60 115 C68 98 58 82 66 65 C74 47 87 36 87 16 C103 25 112 45 118 64 C127 82 134 102 128 123 C122 143 137 157 130 175 C124 195 106 204 90 216 Z"/></clipPath>
      <linearGradient id="current-flame-body-gradient" x1="35%" y1="100%" x2="70%" y2="0%"><stop offset="0" stopColor="#ffd553"/><stop offset=".28" stopColor="#ff9f26"/><stop offset=".68" stopColor="#ff7018"/><stop offset="1" stopColor="#ffba43"/></linearGradient>
      <linearGradient id="current-flame-core-gradient" x1="50%" y1="100%" x2="50%" y2="0%"><stop offset="0" stopColor="#fff6ba" stopOpacity=".72"/><stop offset=".45" stopColor="#ffdc75" stopOpacity=".55"/><stop offset="1" stopColor="#ff9f27" stopOpacity=".12"/></linearGradient>
    </defs>
    <path ref={silhouetteRef} className="act-current-flame-silhouette" d="M90 216 C79 202 59 190 50 168 C43 148 53 132 60 115 C68 98 58 82 66 65 C74 47 87 36 87 16 C103 25 112 45 118 64 C127 82 134 102 128 123 C122 143 137 157 130 175 C124 195 106 204 90 216 Z" fill="url(#current-flame-body-gradient)"/>
    <image href={currentFlameArtwork} x="2.5" y="9.5" width="180" height="240" preserveAspectRatio="xMidYMid meet" clipPath="url(#current-flame-shape)"/>
    <path ref={coreRef} className="act-current-flame-core" d="M90 207 C80 190 65 177 62 159 C58 143 68 127 74 111 C81 94 75 80 83 65 C88 51 94 46 96 34 C105 51 104 68 112 85 C120 103 117 120 111 139 C105 158 108 182 90 207 Z" fill="url(#current-flame-core-gradient)"/>
  </svg>
}

type ThornPoint = { x: number; y: number }
type ThornSample = { point: ThornPoint; normal: ThornPoint; tangent: ThornPoint; halfWidth: number }

function taperedRoot(start: ThornPoint, controlA: ThornPoint, controlB: ThornPoint, end: ThornPoint, startWidth: number, endWidth: number, wave = 0, phase = 0, waves = 1.5) {
  const points = Array.from({ length: 25 }, (_, index) => {
    const t = index / 24
    const inverse = 1 - t
    const point = {
      x: inverse ** 3 * start.x + 3 * inverse ** 2 * t * controlA.x + 3 * inverse * t ** 2 * controlB.x + t ** 3 * end.x,
      y: inverse ** 3 * start.y + 3 * inverse ** 2 * t * controlA.y + 3 * inverse * t ** 2 * controlB.y + t ** 3 * end.y,
    }
    const tangent = {
      x: 3 * inverse ** 2 * (controlA.x - start.x) + 6 * inverse * t * (controlB.x - controlA.x) + 3 * t ** 2 * (end.x - controlB.x),
      y: 3 * inverse ** 2 * (controlA.y - start.y) + 6 * inverse * t * (controlB.y - controlA.y) + 3 * t ** 2 * (end.y - controlB.y),
    }
    const length = Math.hypot(tangent.x, tangent.y) || 1
    const normal = { x: -tangent.y / length, y: tangent.x / length }
    const sway = Math.sin(t * Math.PI * 2 * waves + phase) * Math.sin(t * Math.PI) * wave
    point.x += normal.x * sway
    point.y += normal.y * sway
    return point
  })
  const samples: ThornSample[] = points.map((point, index) => {
    const before = points[Math.max(0, index - 1)]
    const after = points[Math.min(points.length - 1, index + 1)]
    let tangent = { x: after.x - before.x, y: after.y - before.y }
    const length = Math.hypot(tangent.x, tangent.y) || 1
    tangent = { x: tangent.x / length, y: tangent.y / length }
    return {
      point,
      tangent,
      normal: { x: -tangent.y, y: tangent.x },
      halfWidth: endWidth + (startWidth - endWidth) * (1 - index / (points.length - 1)) ** 1.18,
    }
  })
  const fmt = ({ x, y }: ThornPoint) => `${x.toFixed(1)} ${y.toFixed(1)}`
  const side = (sample: ThornSample, amount: number) => ({
    x: sample.point.x + sample.normal.x * sample.halfWidth * amount,
    y: sample.point.y + sample.normal.y * sample.halfWidth * amount,
  })
  const outline = [...samples.map((sample) => side(sample, 1)), ...samples.slice().reverse().map((sample) => side(sample, -1))]
  const facet = [...samples.map((sample) => side(sample, .42)), ...samples.slice().reverse().map((sample) => sample.point)]
  const meshPath = (points: ThornPoint[]) => `M${fmt(points[0])} ${points.slice(1).map((point) => `L${fmt(point)}`).join(' ')} Z`
  const centerline = `M${fmt(start)} C${fmt(controlA)} ${fmt(controlB)} ${fmt(end)}`
  return { path: meshPath(outline), facetPath: meshPath(facet), centerline, samples, start }
}

function thornPointAt(angle: number, radius: number): ThornPoint {
  return { x: 90 + Math.cos(angle) * radius, y: 90 + Math.sin(angle) * radius }
}

function ThornCrown({ state }: { state: 'emerging' | 'rooted' | 'submerging' }) {
  const rootPattern = [
    { degrees: -88, end: -69, radius: 17, bend: 11, wave: 2.4, phase: .2 },
    { degrees: -63, end: -89, radius: 39, bend: -14, wave: 3.8, phase: 1.4 },
    { degrees: -44, end: -30, radius: 24, bend: 17, wave: 2.1, phase: 2.1 },
    { degrees: -18, end: -48, radius: 47, bend: -12, wave: 4.1, phase: .8 },
    { degrees: 5, end: 21, radius: 13, bend: 14, wave: 2.8, phase: 2.8 },
    { degrees: 31, end: 4, radius: 34, bend: -18, wave: 4.8, phase: 1.8 },
    { degrees: 49, end: 67, radius: 46, bend: 12, wave: 2.5, phase: .4 },
    { degrees: 78, end: 52, radius: 20, bend: -16, wave: 3.7, phase: 2.5 },
    { degrees: 103, end: 123, radius: 37, bend: 15, wave: 2.2, phase: 1.1 },
    { degrees: 131, end: 110, radius: 12, bend: -13, wave: 4.2, phase: 2.9 },
    { degrees: 153, end: 174, radius: 43, bend: 18, wave: 3.1, phase: .6 },
    { degrees: 178, end: 151, radius: 28, bend: -15, wave: 2.6, phase: 1.6 },
    { degrees: 204, end: 224, radius: 18, bend: 13, wave: 4.5, phase: 2.2 },
    { degrees: 231, end: 206, radius: 48, bend: -17, wave: 2.4, phase: .9 },
    { degrees: 249, end: 271, radius: 31, bend: 12, wave: 3.6, phase: 2.7 },
    { degrees: 281, end: 258, radius: 41, bend: -14, wave: 2.8, phase: .1 },
  ]
  const radians = (degrees: number) => (degrees * Math.PI) / 180
  const roots = rootPattern.filter((_, sourceIndex) => ![1, 2, 5, 9, 11, 13].includes(sourceIndex)).map((root, index) => {
    const angle = radians(root.degrees)
    const endAngle = radians(root.end)
    const start = thornPointAt(angle, 84 + (index % 4) * 1.8)
    const end = thornPointAt(endAngle, root.radius * .88)
    const tangent = { x: -Math.sin(angle), y: Math.cos(angle) }
    const endTangent = { x: -Math.sin(endAngle), y: Math.cos(endAngle) }
    const shoulder = thornPointAt(angle, 59 + (index % 3) * 3)
    const innerShoulder = thornPointAt(endAngle, root.radius * .88 + 23 + (index % 4) * 2)
    const controlA = { x: shoulder.x + tangent.x * root.bend, y: shoulder.y + tangent.y * root.bend }
    const controlB = { x: innerShoulder.x - endTangent.x * root.bend * .55, y: innerShoulder.y - endTangent.y * root.bend * .55 }
    const main = taperedRoot(start, controlA, controlB, end, 4.7 + (index % 3) * .38, .12, root.wave, root.phase, 1.35 + (index % 4) * .27)
    const branchCount = index % 3 === 1 ? 1 : 0
    const branches = Array.from({ length: branchCount }, (_, branchIndex) => {
      const side = (index * 7) % 3 === 0 ? 1 : -1
      const progress = .38 + ((index * 7) % 5) * .07
      const branchStartSample = main.samples[Math.round(progress * (main.samples.length - 1))]
      const branchStart = branchStartSample.point
      const branchAngle = endAngle + side * (.3 + branchIndex * .13)
      const branchRadius = 23 + ((index + branchIndex * 2) % 5) * 5
      const branchEnd = thornPointAt(branchAngle, branchRadius)
      const branchBend = side * (5 + ((index + branchIndex) % 4) * 2)
      const branchControlA = {
        x: branchStart.x + branchStartSample.tangent.x * 8 + branchStartSample.normal.x * branchBend,
        y: branchStart.y + branchStartSample.tangent.y * 8 + branchStartSample.normal.y * branchBend,
      }
      const branchShoulder = thornPointAt(branchAngle, branchRadius + 17)
      const branchTangent = { x: -Math.sin(branchAngle), y: Math.cos(branchAngle) }
      const branchControlB = { x: branchShoulder.x - branchTangent.x * branchBend * .6, y: branchShoulder.y - branchTangent.y * branchBend * .6 }
      return taperedRoot(branchStart, branchControlA, branchControlB, branchEnd, 2.5 + ((index + branchIndex) % 3) * .22, .08, 1.5 + ((index + branchIndex) % 3) * .36, root.phase + branchIndex * .9, 1.5 + (index % 3) * .3)
    })
    const makeSpines = (samples: ThornSample[], count: number, seed: number, scale: number) => Array.from({ length: count }, (_, spineIndex) => {
      const t = .19 + ((spineIndex + 1) / (count + 1)) * .65 + ((seed + spineIndex) % 3 - 1) * .025
      const sample = samples[Math.max(1, Math.min(samples.length - 2, Math.round(t * (samples.length - 1))))]
      const direction = (spineIndex + seed) % 3 === 0 ? 1 : -1
      const length = (6.2 + ((spineIndex * 2 + seed) % 4) * .7) * scale
      const tip = { x: sample.point.x + sample.normal.x * direction * length, y: sample.point.y + sample.normal.y * direction * length }
      const halfBase = 1.45 * scale
      const left = { x: sample.point.x - sample.tangent.x * halfBase, y: sample.point.y - sample.tangent.y * halfBase }
      const right = { x: sample.point.x + sample.tangent.x * halfBase, y: sample.point.y + sample.tangent.y * halfBase }
      const fmtPoint = ({ x, y }: ThornPoint) => `${x.toFixed(1)} ${y.toFixed(1)}`
      const facetBase = { x: left.x * .42 + tip.x * .58, y: left.y * .42 + tip.y * .58 }
      const facetRight = { x: right.x * .42 + tip.x * .58, y: right.y * .42 + tip.y * .58 }
      return { path: `M${fmtPoint(left)} L${fmtPoint(tip)} L${fmtPoint(right)} Z`, facetPath: `M${fmtPoint(facetBase)} L${fmtPoint(tip)} L${fmtPoint(facetRight)} Z`, index: spineIndex }
    })
    return {
      main,
      branches,
      mainSpines: makeSpines(main.samples, 2 + (index % 2), index, 1),
      branchSpines: branches.map((branch, branchIndex) => makeSpines(branch.samples, 1 + ((index + branchIndex) % 2), index + branchIndex + 1, .85)),
      index,
    }
  })
  return <svg className={`act-thorn-crown act-thorn-crown-${state}`} viewBox="0 0 180 180" aria-hidden="true">
    <g className="thorn-crown-roots">
      {roots.map(({ main, branches, mainSpines, branchSpines, index }) => <g className="thorn-root-primary" key={index} style={{ transformOrigin: `${(main.start.x / 180) * 100}% ${(main.start.y / 180) * 100}%` }}>
        <path className="thorn-root-shadow" d={main.path}/>
        <path className="thorn-root-body" d={main.path}/>
        <path className="thorn-root-facets" d={main.facetPath}/>
        {branches.map((branch, branchIndex) => <g className="thorn-root-branch" key={branchIndex}>
          <path className="thorn-root-shadow thorn-root-branch-shadow" d={branch.path}/>
          <path className="thorn-root-body thorn-root-branch-body" d={branch.path}/>
          <path className="thorn-root-facets thorn-root-branch-facets" d={branch.facetPath}/>
          {branchSpines[branchIndex].map((spine) => <g key={spine.index}><path className="thorn-root-spine" d={spine.path}/><path className="thorn-root-spine-facet" d={spine.facetPath}/></g>)}
        </g>)}
        {mainSpines.map((spine) => <g key={spine.index}><path className="thorn-root-spine" d={spine.path}/><path className="thorn-root-spine-facet" d={spine.facetPath}/></g>)}
      </g>)}
    </g>
  </svg>
}

function ArcBramble({ geometry, state }: {
  geometry: ReturnType<typeof routeGeometry>
  state: 'blocking' | 'submerging'
}) {
  return <g className={`arc-bramble arc-bramble-${state}`} aria-hidden="true">
    {geometry.crossingRoots.map((root, index) => {
      const rootStyle = {
        transformOrigin: `${root.start.x / 10}% ${root.start.y / 16}%`,
        animationDelay: `${index * .085}s`,
        '--cross-angle': `${root.angle}deg`,
      } as CSSProperties & { '--cross-angle': string }
      return <g className="arc-bramble-crossing" key={index} style={rootStyle}>
        <path className="arc-bramble-branch-shadow" d={root.path}/>
        <path className="arc-bramble-branch" d={root.path}/>
        <path className="arc-bramble-branch-facets" d={root.facetPath}/>
        <path className="arc-bramble-thorns-shadow" d={root.thornD}/>
        <path className="arc-bramble-thorns" d={root.thornD}/>
        <path className="arc-bramble-thorn-facets" d={root.thornFacetD}/>
        {root.twigs.map((twig, twigIndex) => {
          const twigStyle = {
            transformOrigin: `${twig.start.x / 10}% ${twig.start.y / 16}%`,
            animationDelay: `${.24 + index * .085 + twigIndex * .12}s`,
            '--cross-angle': `${twig.angle}deg`,
          } as CSSProperties & { '--cross-angle': string }
          return <g className="arc-bramble-crossing-twig" key={twigIndex} style={twigStyle}>
            <path className="arc-bramble-twig-shadow" d={twig.path}/>
            <path className="arc-bramble-twig" d={twig.path}/>
            <path className="arc-bramble-twig-facets" d={twig.facetPath}/>
            <path className="arc-bramble-thorns-shadow" d={twig.thornD}/>
            <path className="arc-bramble-thorns" d={twig.thornD}/>
            <path className="arc-bramble-thorn-facets" d={twig.thornFacetD}/>
          </g>
        })}
      </g>
    })}
  </g>
}

function EdgeThornBranches() {
  const clusters = [
    { start: { x: -18, y: 510 }, a: { x: 16, y: 472 }, b: { x: 18, y: 366 }, end: { x: 112, y: 292 }, wave: 8, phase: .4 },
    { start: { x: 1018, y: 510 }, a: { x: 981, y: 472 }, b: { x: 980, y: 366 }, end: { x: 888, y: 292 }, wave: 7, phase: 1.2 },
    { start: { x: -22, y: 1232 }, a: { x: 17, y: 1192 }, b: { x: 22, y: 1084 }, end: { x: 134, y: 1004 }, wave: 9, phase: 2.2 },
    { start: { x: 1022, y: 1150 }, a: { x: 982, y: 1110 }, b: { x: 970, y: 1010 }, end: { x: 862, y: 936 }, wave: 8, phase: .9 },
  ]
  const point = (value: ThornPoint) => `${value.x.toFixed(1)} ${value.y.toFixed(1)}`
  const makeThorns = (root: ReturnType<typeof taperedRoot>, seed: number, positions: number[]) => {
    const shapes: Array<{ body: string; facet: string }> = []
    positions.forEach((progress, index) => {
      const sample = root.samples[Math.round(progress * (root.samples.length - 1))]
      const side = (seed + index) % 2 === 0 ? 1 : -1
      const length = 13 + ((seed + index) % 3) * 2
      const halfBase = 3.1 + ((seed + index) % 2) * .5
      const tip = { x: sample.point.x + sample.normal.x * side * length, y: sample.point.y + sample.normal.y * side * length }
      const left = { x: sample.point.x - sample.tangent.x * halfBase, y: sample.point.y - sample.tangent.y * halfBase }
      const right = { x: sample.point.x + sample.tangent.x * halfBase, y: sample.point.y + sample.tangent.y * halfBase }
      const facetLeft = { x: left.x * .4 + tip.x * .6, y: left.y * .4 + tip.y * .6 }
      const facetRight = { x: right.x * .4 + tip.x * .6, y: right.y * .4 + tip.y * .6 }
      shapes.push({
        body: `M${point(left)} L${point(tip)} L${point(right)} Z`,
        facet: `M${point(facetLeft)} L${point(tip)} L${point(facetRight)} Z`,
      })
    })
    return shapes
  }

  return <g className="arc-edge-thorn-branches" aria-hidden="true">
    {clusters.map((cluster, clusterIndex) => {
      const main = taperedRoot(cluster.start, cluster.a, cluster.b, cluster.end, 7.4, .35, cluster.wave, cluster.phase, 1.7)
      const branches = [.34, .68].map((progress, branchIndex) => {
        const sample = main.samples[Math.round(progress * (main.samples.length - 1))]
        const side = (clusterIndex + branchIndex) % 2 === 0 ? -1 : 1
        const start = sample.point
        const end = { x: start.x + sample.normal.x * side * 31 + sample.tangent.x * (branchIndex === 0 ? -13 : 16), y: start.y + sample.normal.y * side * 31 + sample.tangent.y * (branchIndex === 0 ? -13 : 16) }
        const controlA = { x: start.x + sample.tangent.x * 8 + sample.normal.x * side * 12, y: start.y + sample.tangent.y * 8 + sample.normal.y * side * 12 }
        const controlB = { x: end.x - sample.tangent.x * 8 + sample.normal.x * side * 4, y: end.y - sample.tangent.y * 8 + sample.normal.y * side * 4 }
        return taperedRoot(start, controlA, controlB, end, 4.2, .12, 5, cluster.phase + branchIndex, 1.6)
      })
      const roots = [main, ...branches]
      return <g key={clusterIndex}>
        {roots.map((root, rootIndex) => {
          const thorns = makeThorns(root, clusterIndex + rootIndex, rootIndex === 0 ? [.22, .45, .69, .88] : [.4, .74])
          return <g key={rootIndex}>
            <path className="arc-bramble-branch-shadow" d={root.path}/>
            <path className="arc-bramble-branch" d={root.path}/>
            <path className="arc-bramble-branch-facets" d={root.facetPath}/>
            <path className="arc-bramble-thorns-shadow" d={thorns.map((thorn) => thorn.body).join(' ')}/>
            <path className="arc-bramble-thorns" d={thorns.map((thorn) => thorn.body).join(' ')}/>
            <path className="arc-bramble-thorn-facets" d={thorns.map((thorn) => thorn.facet).join(' ')}/>
          </g>
        })}
      </g>
    })}
  </g>
}

function polygonPathAt(cx: number, cy: number, radius: number, sides = 20) {
  return Array.from({ length: sides }, (_, index) => {
    const angle = -Math.PI / 2 + index * (Math.PI * 2 / sides)
    const x = cx + Math.cos(angle) * radius
    const y = cy + Math.sin(angle) * radius
    return `${index === 0 ? 'M' : 'L'}${x.toFixed(1)} ${y.toFixed(1)}`
  }).join(' ') + 'Z'
}

function medallionPolygon(radius: number, sides = 16) { return polygonPathAt(90, 90, radius, sides) }

function medallionSideFacet(index: number, radius: number, lowerRadius: number, depth: number, sides = 16) {
  const point = (i: number, lower = false) => {
    const angle = -Math.PI / 2 + i * (Math.PI * 2 / sides)
    const activeRadius = lower ? lowerRadius : radius
    return `${(90 + Math.cos(angle) * activeRadius).toFixed(1)},${(90 + Math.sin(angle) * activeRadius + (lower ? depth : 0)).toFixed(1)}`
  }
  return `M${point(index)} L${point(index + 1)} L${point(index + 1, true)} L${point(index, true)} Z`
}

function ActMedallion({ act, onSelect }: { act: ArcAct; onSelect: () => void }) {
  const locked = act.status === 'locked'
  const [crownState, setCrownState] = useState<'emerging' | 'rooted' | 'submerging' | 'hidden'>(locked ? 'emerging' : 'hidden')
  const statusLabel = act.status === 'current' ? 'ato atual' : act.status === 'completed' ? 'ato concluído' : locked ? 'ato bloqueado' : 'ato disponível'
  const keyPattern = `meander-${act.id}`
  const keyMask = `meander-mask-${act.id}`

  useEffect(() => {
    if (locked) {
      setCrownState('emerging')
      const settleTimer = window.setTimeout(() => setCrownState('rooted'), 1350)
      return () => window.clearTimeout(settleTimer)
    }
    if (crownState === 'hidden') return
    setCrownState('submerging')
    const sinkTimer = window.setTimeout(() => setCrownState('hidden'), 950)
    return () => window.clearTimeout(sinkTimer)
  }, [locked])
  return <button
    className={`act-medallion act-medallion-${act.status} act-medallion-symbol-${act.symbol} ${act.kind === 'optional' ? 'act-medallion-optional' : ''}`}
    style={{ left: `${act.position.x}%`, top: `${act.position.y}%` }}
    onClick={onSelect}
    disabled={locked}
    aria-label={`${statusLabel}: Ato ${String(act.number).padStart(2, '0')}, ${act.title}`}
  >
    <svg className="act-medallion-art" viewBox="0 0 180 180" aria-hidden="true">
      <defs>
        <radialGradient id={`stone-${act.id}`} cx="35%" cy="24%"><stop stopColor="#d0c7b2"/><stop offset=".46" stopColor="#a69b83"/><stop offset="1" stopColor="#716b5c"/></radialGradient>
        <pattern id={`medallion-limestone-${act.id}`} width="180" height="180" patternUnits="userSpaceOnUse" patternTransform={`rotate(${(act.number * 19) % 360} 90 90)`}><image href={ancientMedallionStoneTexture} width="180" height="180" preserveAspectRatio="xMidYMid slice" style={{ filter: 'saturate(.72) brightness(.98) contrast(1.08)' }}/></pattern>
        <pattern id={keyPattern} width="13" height="13" patternUnits="userSpaceOnUse"><path d="M1 2h8v8H4V5h3" fill="none" stroke="#85785f" strokeWidth="1.35"/></pattern>
        <mask id={keyMask}><rect width="180" height="180" fill="black"/><path d={medallionPolygon(78)} fill="white"/><path d={medallionPolygon(65)} fill="black"/></mask>
        <clipPath id={`face-clip-${act.id}`}><path d={medallionPolygon(60)}/></clipPath>
        <clipPath id={`stone-clip-${act.id}`}><path d={medallionPolygon(80)}/></clipPath>
      </defs>
      <path className="medallion-depth" d={medallionPolygon(83)} transform="translate(0 9)"/>
      <path className="medallion-depth-texture" d={medallionPolygon(83)} transform="translate(0 9)" fill={`url(#medallion-limestone-${act.id})`}/>
      <g className="medallion-side-facets">{Array.from({ length: 16 }, (_, index) => <path key={index} className={index % 2 ? 'side-facet-dark' : 'side-facet-light'} d={medallionSideFacet(index, 80, 83, 9)}/>)}</g>
      <g className="medallion-side-texture">{Array.from({ length: 16 }, (_, index) => <path key={index} d={medallionSideFacet(index, 80, 83, 9)} fill={`url(#medallion-limestone-${act.id})`}/>)}</g>
      <path className="medallion-stone" d={medallionPolygon(80)} fill={`url(#stone-${act.id})`}/>
      <g className="medallion-stone-facets" clipPath={`url(#stone-clip-${act.id})`}>
        <path d="M90 90 90 10 147 39Z"/><path d="M90 90 147 39 170 88Z"/><path d="M90 90 170 88 137 147Z"/>
        <path d="M90 90 137 147 75 169Z"/><path d="M90 90 75 169 24 122Z"/><path d="M90 90 24 122 18 58Z"/><path d="M90 90 18 58 53 22Z"/>
      </g>
      <path className="medallion-top-texture" d={medallionPolygon(80)} fill={`url(#medallion-limestone-${act.id})`} clipPath={`url(#stone-clip-${act.id})`}/>
      <path className="medallion-outer-rim" d={medallionPolygon(77)}/>
      <rect className="medallion-meander" width="180" height="180" fill={`url(#${keyPattern})`} mask={`url(#${keyMask})`}/>
      <path className="medallion-rim-line" d={medallionPolygon(65)}/>
      <path className="medallion-face" d={medallionPolygon(60)}/>
      <g className="medallion-facets" clipPath={`url(#face-clip-${act.id})`}>
        <path d="M90 90 90 28 139 52Z"/><path d="M90 90 139 52 151 96Z"/><path d="M90 90 151 96 126 145Z"/><path d="M90 90 126 145 62 144Z"/><path d="M90 90 62 144 32 88Z"/><path d="M90 90 32 88 52 43Z"/>
      </g>
      <path className="medallion-face-texture" d={medallionPolygon(60)} fill={`url(#medallion-limestone-${act.id})`} clipPath={`url(#face-clip-${act.id})`}/>
      <path className="medallion-inner-line" d={medallionPolygon(54)}/>
      <MedallionSymbol symbol={act.symbol}/>
    </svg>
    {crownState !== 'hidden' && <ThornCrown state={crownState === 'rooted' ? 'rooted' : crownState === 'submerging' ? 'submerging' : 'emerging'}/>}
    {act.status === 'current' && <CurrentFlame/>}
    {locked && <span className="act-medallion-lock-shadow"><span className="act-lock-glyph" aria-hidden="true"><svg viewBox="0 0 32 38"><path d="M8 16V10a8 8 0 0 1 16 0v6M5 16h22v18H5z"/><circle cx="16" cy="24" r="2"/><path d="M16 26v4"/></svg></span></span>}
    {act.status === 'completed' && <span className="act-medallion-complete-seal" aria-label="Concluído"><svg viewBox="0 0 40 40" aria-hidden="true"><circle cx="20" cy="20" r="17"/><path d="m11 20 6 6 12-13"/></svg></span>}
  </button>
}

function ArcRouteArt({ connection, from, to }: { connection: ArcConnection; from: ArcAct; to: ArcAct }) {
  const geometry = useMemo(() => routeGeometry(from, to, connection.kind), [from, to, connection.kind])
  const isBlocked = to.status === 'locked'
  const [brambleState, setBrambleState] = useState<'blocking' | 'submerging' | 'hidden'>(isBlocked ? 'blocking' : 'hidden')

  useEffect(() => {
    if (isBlocked) {
      setBrambleState('blocking')
      return
    }
    if (brambleState === 'hidden') return
    setBrambleState('submerging')
    const timer = window.setTimeout(() => setBrambleState('hidden'), 850)
    return () => window.clearTimeout(timer)
  }, [isBlocked])

  const isLit = (from.status === 'completed' || from.status === 'current') && (to.status === 'completed' || to.status === 'current') && (from.status === 'completed' || to.status === 'completed')
  return <g className={`arc-route ${connection.kind === 'optional' ? 'arc-route-optional' : ''} ${isBlocked ? 'arc-route-blocked' : ''} ${isLit ? 'arc-route-lit' : ''}`}>
    <path className="arc-route-underpaint" d={geometry.d}/>
    {isLit && <path className="arc-route-glow" d={geometry.d}/>}
    <path className="arc-route-pigment" d={geometry.d}/>
    <path className="arc-route-etch" d={geometry.d}/>
    {!isBlocked && <path className="arc-route-flourish" d={geometry.d} pathLength="100"/>}
    {brambleState !== 'hidden' && <ArcBramble geometry={geometry} state={brambleState}/>}
  </g>
}

function Parchment({ act, closing, onClose, onStart }: {
  act: ArcAct
  closing: boolean
  onClose: () => void
  onStart: () => void
}) {
  const completed = act.status === 'completed'
  return <div className={`arc-parchment-backdrop ${closing ? 'is-closing' : 'is-opening'}`} onClick={onClose}>
    <section className="arc-parchment" role="dialog" aria-modal="true" aria-labelledby="act-parchment-title" onClick={(event) => event.stopPropagation()}>
      <div className="parchment-roller parchment-roller-top"><span/><span/><span/></div>
      <button className="parchment-close" onClick={onClose} aria-label="Fechar pergaminho"><X size={20}/></button>
      <article className="parchment-paper">
        <div className="parchment-paper-grain" aria-hidden="true"/>
        <div className="parchment-ornament parchment-ornament-top" aria-hidden="true"/>
        <p className="parchment-act-number">Ato {String(act.number).padStart(2, '0')}</p>
        <h2 id="act-parchment-title">{act.title}</h2>
        <figure className="parchment-illustration">
          <img src={act.illustration} alt={`Ilustração de ${act.title}`} />
        </figure>
        <div className="parchment-divider" aria-hidden="true"><span/><b>✦</b><span/></div>
        <p className="parchment-description">{act.description}</p>
        <button className="parchment-start" onClick={onStart}>
          <svg viewBox="0 0 66 44" aria-hidden="true"><path d="M32 39Q13 28 7 9q14-1 22 15Q25 7 31 3q8 8 5 21Q43 9 57 8q-2 18-23 31M12 15q9 0 13 10m18-5q3-9 11-9M24 26l-4 8m21-8 5 8"/></svg>
          <span>{completed ? 'REVER ATO' : 'INICIAR ATO'}</span>
          <svg className="laurel-end" viewBox="0 0 66 44" aria-hidden="true"><path d="M32 39Q13 28 7 9q14-1 22 15Q25 7 31 3q8 8 5 21Q43 9 57 8q-2 18-23 31M12 15q9 0 13 10m18-5q3-9 11-9M24 26l-4 8m21-8 5 8"/></svg>
        </button>
        <div className="parchment-ornament parchment-ornament-bottom" aria-hidden="true"/>
      </article>
      <div className="parchment-roller parchment-roller-bottom"><span/><span/><span/></div>
    </section>
  </div>
}

export default function ArcMapPage({ moduleId, onBack, onStartAct }: {
  moduleId: string
  onBack: () => void
  onStartAct: (act: ArcAct) => void
}) {
  const arc = learningArcs[moduleId]
  const [currentActId, setCurrentActId] = useState(() => arc.acts.find((act) => act.status === 'current')?.id ?? '')
  const [selectedActId, setSelectedActId] = useState<string | null>(null)
  const [closingParchment, setClosingParchment] = useState(false)
  const closeTimer = useRef<number | null>(null)
  const acts = useMemo(() => arc.acts.map((act) => ({
    ...act,
    status: act.id === currentActId ? 'current' as const : act.status === 'current' ? 'available' as const : act.status,
  })), [arc.acts, currentActId])
  const actsById = new Map(acts.map((act) => [act.id, act]))
  const selectedAct = selectedActId ? actsById.get(selectedActId) ?? null : null
  const reducedMotion = typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches

  useEffect(() => () => {
    if (closeTimer.current !== null) window.clearTimeout(closeTimer.current)
  }, [])

  useEffect(() => {
    if (!selectedAct) return
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') closeParchment()
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [selectedAct])

  function closeParchment() {
    if (!selectedActId) return
    if (closeTimer.current !== null) window.clearTimeout(closeTimer.current)
    if (reducedMotion) {
      setSelectedActId(null)
      setClosingParchment(false)
      return
    }
    setClosingParchment(true)
    closeTimer.current = window.setTimeout(() => {
      setSelectedActId(null)
      setClosingParchment(false)
      closeTimer.current = null
    }, 530)
  }

  const openAct = (act: ArcAct) => {
    if (act.status === 'locked') return
    audioManager.play('starSelect')
    setClosingParchment(false)
    setSelectedActId(act.id)
  }

  const startAct = () => {
    if (!selectedAct) return
    if (selectedAct.status !== 'completed') setCurrentActId(selectedAct.id)
    audioManager.play('navigation')
    onStartAct(selectedAct)
    closeParchment()
  }

  return <main className="arc-map-screen" aria-label={`Mapa do arco ${arc.title}`}>
    <div className="arc-map-scroll">
      <section className="arc-map-scene">
        <div className="arc-world-plane">
          <Terrain/>
        <svg className="arc-route-layer" viewBox="0 0 1000 1600" preserveAspectRatio="none" aria-hidden="true">
          <defs>
            <filter id="arc-paint-soft"><feGaussianBlur stdDeviation="2.4"/></filter>
            <filter id="arc-route-lamp"><feGaussianBlur stdDeviation="5"/></filter>
          </defs>
          {arc.connections.map((connection) => {
            const from = actsById.get(connection.from)
            const to = actsById.get(connection.to)
            if (!from || !to) return null
            return <ArcRouteArt key={`${connection.from}-${connection.to}`} connection={connection} from={from} to={to}/>
          })}
          </svg>
          <div className="arc-map-nodes">
            {acts.map((act) => <ActMedallion key={act.id} act={act} onSelect={() => openAct(act)}/>)}
          </div>
        </div>
        <header className="arc-map-header">
          <button className="arc-map-back" onClick={onBack} aria-label="Voltar à constelação"><ArrowLeft size={22}/></button>
          <div className="arc-map-title-block">
            <span className="arc-map-module-name">{arc.moduleName}</span>
            <h1>{arc.title}</h1>
          </div>
          <span className="arc-header-balance" aria-hidden="true"/>
        </header>
      </section>
    </div>
    {selectedAct && <Parchment act={selectedAct} closing={closingParchment} onClose={closeParchment} onStart={startAct}/ >}
  </main>
}
