import { ArrowLeft } from 'lucide-react'
import type { SceneLocale } from '../sceneTypes'

export default function BorderCaveArrival({ locale, onExit }: { locale: SceneLocale; onExit: () => void }) {
  const english = locale === 'en'
  return <main className="border-cave-arrival" aria-label={english ? 'Border Cave, Southern Africa' : 'Border Cave, África Austral'}>
    <svg className="border-cave-landscape" viewBox="0 0 1600 900" preserveAspectRatio="xMidYMid slice" role="img" aria-label={english ? 'Low-poly rocky cave at dusk' : 'Caverna rochosa ao entardecer'}>
      <defs>
        <linearGradient id="cave-sky" x2="0" y2="1"><stop stopColor="#e5a664"/><stop offset=".48" stopColor="#a95d3d"/><stop offset="1" stopColor="#342626"/></linearGradient>
        <linearGradient id="cave-depth" x2=".2" y2="1"><stop stopColor="#171819"/><stop offset="1" stopColor="#090d0f"/></linearGradient>
        <radialGradient id="cave-fire"><stop stopColor="#ffd17d" stopOpacity=".9"/><stop offset=".35" stopColor="#e77732" stopOpacity=".46"/><stop offset="1" stopColor="#e77732" stopOpacity="0"/></radialGradient>
      </defs>
      <rect width="1600" height="900" fill="url(#cave-sky)"/>
      <circle cx="1230" cy="236" r="134" fill="#ffd08c" opacity=".38"/>
      <path d="M0 430 170 300 312 390 465 280 628 404 818 290 990 400 1192 276 1370 396 1600 282V700H0Z" fill="#735044"/>
      <path d="m0 510 186-126 173 87 170-121 183 150 176-126 187 134 169-119 186 112 170-122v380H0Z" fill="#4c3b35"/>
      <path d="M0 644 144 530l185 96 193-121 198 114 202-93 208 124 198-126 272 130v246H0Z" fill="#342b29"/>
      <path d="M0 0h1600v125q-235 44-366 194-117-86-220-65-83 20-141 130-79-126-185-113-105 13-166 165-93-129-213-111-127 18-215 167Q44 508 0 535Z" fill="#292728"/>
      <path d="M0 0h1600v190q-191 36-315 194-143-119-266-50-102 56-143 174-76-165-212-148-130 17-195 180-110-134-224-105Q107 466 0 610Z" fill="#393331"/>
      <path d="M0 0h1600v290q-160 6-267 147-143-115-260-16-95 82-112 184-86-151-206-117-113 32-159 176-103-122-210-67Q279 645 0 718Z" fill="#655047"/>
      <path d="M0 0h1600v386q-148-43-242 82-139-106-247 11-69 75-94 179-79-119-178-69-82 41-131 157-95-90-179-12Q351 822 0 900Z" fill="#171819"/>
      <path d="M1600 0v900H0q295-134 474-280 118-96 203-97 105-2 214 81 91-176 199-186 99-9 201 73Q1422 278 1600 0Z" fill="url(#cave-depth)"/>
      <g opacity=".9" stroke="#171819" strokeWidth="5">
        <path d="m74 235 181-50-89 104Z" fill="#9a6650"/><path d="m255 185 116 69-205 35Z" fill="#805746"/>
        <path d="m1244 350 111-81 69 137Z" fill="#8c5e4d"/><path d="m1355 269 166-33-97 170Z" fill="#a06c52"/>
        <path d="m380 420 141-58-89 120Z" fill="#755044"/><path d="m521 362 121 103-210 17Z" fill="#63463d"/>
        <path d="m1017 481 138-66 35 146Z" fill="#6b4b41"/><path d="m1155 415 120 81-85 65Z" fill="#795348"/>
      </g>
      <ellipse cx="790" cy="803" rx="320" ry="104" fill="url(#cave-fire)"/>
      <g fill="#2c2825" stroke="#171819" strokeWidth="7">
        <path d="m0 838 172-84 128 38-88 108H0Z"/><path d="m260 900 119-122 158 21 95 101Z"/><path d="m1087 900 90-109 151-18 140 94v33Z"/>
        <path d="m536 900 92-62 78 26 77-50 106 32 84-30 99 84Z"/>
      </g>
      <g transform="translate(800 760)">
        <path d="M-9 36Q-30 2-4-36Q-6-7 8-2Q20 9 5 36Z" fill="#ed7833"/>
        <path d="M-4 35Q-13 11 3-7Q3 9 12 13Q15 26 5 35Z" fill="#ffd17d"/>
        <path d="m-72 65 38-16 50 8 45-10 27 18-35 16-98-1Z" fill="#51433a" stroke="#171819" strokeWidth="5"/>
      </g>
      <g fill="#f4bd78" opacity=".4"><circle cx="673" cy="606" r="3"/><circle cx="922" cy="581" r="2"/><circle cx="1014" cy="703" r="3"/><circle cx="555" cy="724" r="2"/></g>
    </svg>
    <div className="border-cave-shade"/>
    <header className="historical-scene-header">
      <button className="historical-scene-icon-button" onClick={onExit} aria-label={english ? 'Return to the constellation' : 'Voltar à constelação'}><ArrowLeft size={19}/></button>
      <div className="historical-scene-meta"><span>{english ? 'SOUTHERN AFRICA' : 'ÁFRICA AUSTRAL'}</span><b>{english ? 'AROUND 42,000 YEARS AGO' : 'HÁ CERCA DE 42 MIL ANOS'}</b></div>
    </header>
    <section className="border-cave-title" aria-live="polite">
      <span>{english ? 'THE JOURNEY CONTINUES' : 'A VIAGEM CONTINUA'}</span>
      <h1>Border Cave</h1>
      <p>{english ? 'Before clocks, people marked time by watching the sky, seasons, and the traces left on bone.' : 'Antes dos relógios, as pessoas observavam o céu, as estações e os sinais gravados no osso.'}</p>
    </section>
  </main>
}
