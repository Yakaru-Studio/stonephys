import type { ActSiteEnvironment } from './arcActs'

export default function ActSiteArt({ environment }: { environment?: ActSiteEnvironment }) {
  if (environment !== 'lebombo-rock-shelter') return null

  return <svg className="act-site-art" viewBox="-180 -180 540 540" aria-hidden="true">
    <defs>
      <linearGradient id="lebombo-bone" x1="0" y1="0" x2=".2" y2="1">
        <stop stopColor="#e2d1a8"/><stop offset=".48" stopColor="#b9a47b"/><stop offset="1" stopColor="#786344"/>
      </linearGradient>
      <linearGradient id="lebombo-flint" x1="0" y1="0" x2="1" y2="1">
        <stop stopColor="#817e72"/><stop offset=".5" stopColor="#4c4b47"/><stop offset="1" stopColor="#282a2a"/>
      </linearGradient>
      <pattern id="lebombo-skull-texture" width="22" height="19" patternUnits="userSpaceOnUse" patternTransform="rotate(-13)">
        <path d="m1 4 4-2 3 2-2 3-4 1Zm11 8 3-2 4 1-1 3-4 1Z" fill="#765b39" opacity=".32"/>
        <path d="m7 14 2-1m9-9 3 1M1 17l2-1" fill="none" stroke="#f0dfb8" strokeWidth=".75" opacity=".58"/>
        <circle cx="13" cy="3" r=".8" fill="#6b5235" opacity=".45"/><circle cx="5" cy="11" r=".55" fill="#604a30" opacity=".55"/>
        <circle cx="19" cy="17" r=".65" fill="#f0dfb8" opacity=".52"/><circle cx="10" cy="8" r=".45" fill="#604a30" opacity=".5"/>
      </pattern>
      <filter id="lebombo-object-shadow" x="-40%" y="-40%" width="180%" height="200%"><feGaussianBlur in="SourceAlpha" stdDeviation="2.5"/><feOffset dy="3"/><feComponentTransfer><feFuncA type="linear" slope=".55"/></feComponentTransfer><feMerge><feMergeNode/><feMergeNode in="SourceGraphic"/></feMerge></filter>
    </defs>

    <g className="lebombo-artifacts" filter="url(#lebombo-object-shadow)">
      <g className="lebombo-baboon-skull" transform="translate(8 12) rotate(-9) scale(.58)">
        <path className="skull-shadow" d="M-25-13-19-23-7-27 5-25 15-19 21-11 27-8 32-3 28 2 22 4 19 13 12 17 4 23-8 21-14 16-20 11-24 4-29 0-27-7Z"/>
        <path className="skull-bone" d="M-26-15-19-24-7-28 5-26 15-20 20-12 27-9 33-4 28 1 23 3 20 11 13 16 5 22-7 20-14 15-20 10-24 3-29-1-27-8Z"/>
        <path className="skull-facet skull-facet-light" d="m-19-24 12-4 12 2 7 8-14 2-8 8-10-2-6-5Z M10-18l10 6 7 3-5 7-10-4-6-7Z"/>
        <path className="skull-facet skull-facet-mid" d="m-15-12 12-6 10 5 4 11-8 5-12-4-8-5Z M12-2l11 1-3 12-7 5-7-9Z"/>
        <path className="skull-patina" d="M-26-15-19-24-7-28 5-26 15-20 20-12 27-9 33-4 28 1 23 3 20 11 13 16 5 22-7 20-14 15-20 10-24 3-29-1-27-8Z"/>
        <path className="skull-eye-socket" d="m-4-13 7-4 7 5-1 7-8 3-6-4Z"/>
        <path className="skull-nasal-cavity" d="m16-6 6 2-4 6-5-2Z"/>
        <path className="skull-jaw" d="m-18 7 8 4 7 7 11 1 7-5 5-1-3 8-10 7-14-2-8-8Z"/>
        <path className="skull-teeth" d="m-4 18 1 4m4-3 1 4m4-5 1 4m4-7 1 3"/>
        <path className="skull-suture" d="m-11-21 3 5-2 5m17-11 2 4-2 4"/>
      </g>

      <g className="lebombo-baboon-bone" transform="translate(196 88) rotate(90) scale(.7)">
        <path className="artifact-shadow" d="M-27-7q-8-5-11 2-3 6 3 10-4 8 4 11 6 2 11-3L19 2q8 4 12-2 3-6-3-10 3-8-5-11-6-2-11 3Z"/>
        <path className="bone-surface" d="M-27-8q-8-5-11 2-3 6 3 10-4 8 4 11 6 2 11-3L19 2q8 4 12-2 3-6-3-10 3-8-5-11-6-2-11 3Z"/>
        <path className="bone-facet bone-facet-light" d="m-34-4 8-4 6 5-4 6-9 1Z M17-13l8 1 5 7-8 2-7-5Z M-18 8l8-5 5 5-8 7Z"/>
        <path className="bone-facet bone-facet-shade" d="m-35 3 9 1 6 8-7 5-8-4Z M11-3l9 5 7 7-8 3-10-8Z"/>
        <path className="bone-wear" d="m-7 7 3-2m4 1 3-2m4 1 3-2m4 0 3-2"/>
        <path className="bone-crack" d="m-24-5 4 3-2 4m31-12-2 4 4 2"/>
      </g>

      <g className="lebombo-flaked-stone" transform="translate(170 16) rotate(18) scale(.76)">
        <path className="stone-shadow" d="m-19 7 8-16 7-4 5-10 8 9 13 2-6 9 1 13-14 4-10-3Z"/>
        <path className="stone-body" d="m-20 4 8-16 7-4 5-10 8 9 13 2-6 9 1 13-14 4-10-3Z"/>
        <path className="stone-facet stone-facet-light" d="m-12-12 7-4 5-10 8 9-7 7Z M8-17l13 2-6 9-10-1Z"/>
        <path className="stone-facet stone-facet-mid" d="m-12-12 13 2 7 10-14 8-9-4Z"/>
        <path className="stone-facet stone-facet-dark" d="m8-17 7 11 1 13-14 4 2-11-7-10Z"/>
        <path className="stone-flake-scar" d="m-13-10 8 3 4 8m4-16 7 7"/>
      </g>
    </g>
  </svg>
}
