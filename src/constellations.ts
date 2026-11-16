export type ConstellationStar = {
  id: string
  title: string
  description: string
  x: number
  y: number
  radius?: number
  emblem?: 'sun-moon'
}

export type ConstellationEdge = { from: string; to: string }

export type ConstellationConfig = {
  moduleId: string
  name: string
  eyebrow: string
  stars: ConstellationStar[]
  edges: ConstellationEdge[]
}

export const constellations: Record<string, ConstellationConfig> = {
  time: {
    moduleId: 'time',
    name: 'Tempo',
    eyebrow: 'A primeira medida',
    stars: [
      { id: 'sky', title: 'Arco I — Os Deuses da Luz e Escuridão', description: 'Explore como Sol e Lua marcaram os primeiros ciclos e inspiraram os deuses que explicavam a passagem do tempo.', x: 300, y: 245, radius: 15, emblem: 'sun-moon' },
      { id: 'shadow', title: 'A sombra que mede', description: 'Acompanhe a ideia de usar a posição da sombra para dividir o dia em intervalos.', x: 500, y: 245, radius: 12 },
      { id: 'sundial', title: 'O relógio de sol', description: 'Descubra como diferentes relógios de sol transformaram a observação do céu em uma ferramenta cotidiana.', x: 700, y: 245, radius: 14 },
      { id: 'water', title: 'O tempo que flui', description: 'Conheça clepsidras e outros instrumentos que mediam o tempo pelo fluxo constante da água.', x: 610, y: 435, radius: 12 },
      { id: 'sand', title: 'Areia entre as mãos', description: 'Investigue por que a ampulheta se tornou uma maneira simples e portátil de marcar durações.', x: 500, y: 500, radius: 16 },
      { id: 'mechanism', title: 'Engrenagens e horas', description: 'Veja como mecanismos e escapamentos permitiram construir relógios cada vez mais regulares.', x: 390, y: 435, radius: 12 },
      { id: 'pocket', title: 'O tempo no bolso', description: 'Siga a miniaturização dos relógios e a transformação da hora em uma medida pessoal.', x: 300, y: 755, radius: 14 },
      { id: 'precision', title: 'Precisão em movimento', description: 'Explore como pêndulos, molas e novas técnicas reduziram as diferenças entre relógios.', x: 500, y: 755, radius: 12 },
      { id: 'atomic', title: 'O segundo atômico', description: 'Chegue à definição moderna do segundo, construída a partir de transições em átomos.', x: 700, y: 755, radius: 15 },
    ],
    edges: [
      { from: 'sky', to: 'shadow' }, { from: 'shadow', to: 'sundial' },
      { from: 'sundial', to: 'water' }, { from: 'water', to: 'sand' },
      { from: 'sand', to: 'mechanism' }, { from: 'mechanism', to: 'sky' },
      { from: 'mechanism', to: 'pocket' }, { from: 'pocket', to: 'precision' },
      { from: 'precision', to: 'atomic' }, { from: 'atomic', to: 'water' },
      { from: 'sand', to: 'precision' },
    ],
  },
  distance: {
    moduleId: 'distance',
    name: 'Distância',
    eyebrow: 'Dimensões do mundo',
    stars: [
      { id: 'body', title: 'Medidas do corpo', description: 'Conheça as primeiras unidades baseadas em passos, mãos e outras referências do corpo.', x: 280, y: 250 },
      { id: 'marks', title: 'Marcas e padrões', description: 'Veja como padrões compartilhados ajudaram comunidades a comparar comprimentos.', x: 500, y: 250 },
      { id: 'ruler', title: 'A régua', description: 'Explore a régua graduada e a leitura de pequenas distâncias.', x: 720, y: 250 },
      { id: 'survey', title: 'Medir a terra', description: 'Acompanhe instrumentos e técnicas usados para medir terrenos e grandes extensões.', x: 720, y: 500 },
      { id: 'triangulation', title: 'Triângulos no horizonte', description: 'Descubra como a triangulação permite calcular distâncias difíceis de alcançar.', x: 500, y: 500 },
      { id: 'metric', title: 'O sistema métrico', description: 'Conheça a criação de unidades padronizadas para comparar medidas em qualquer lugar.', x: 280, y: 500 },
      { id: 'light', title: 'Medir o invisível', description: 'Veja como a luz e o tempo de viagem de sinais ajudam a medir distâncias enormes.', x: 390, y: 750 },
      { id: 'cosmic', title: 'Escalas cósmicas', description: 'Explore as ferramentas que revelam as dimensões de estrelas e galáxias.', x: 610, y: 750 },
    ],
    edges: [
      { from: 'body', to: 'marks' }, { from: 'marks', to: 'ruler' },
      { from: 'ruler', to: 'survey' }, { from: 'survey', to: 'triangulation' },
      { from: 'triangulation', to: 'metric' }, { from: 'metric', to: 'body' },
      { from: 'metric', to: 'light' }, { from: 'light', to: 'cosmic' },
      { from: 'cosmic', to: 'survey' },
    ],
  },
  velocity: {
    moduleId: 'velocity',
    name: 'Velocidade',
    eyebrow: 'O espaço em movimento',
    stars: [
      { id: 'motion', title: 'Perceber o movimento', description: 'Comece distinguindo mudança de posição e movimento em relação a um referencial.', x: 280, y: 500 },
      { id: 'distance-time', title: 'Espaço e tempo', description: 'Relacione a distância percorrida ao intervalo de tempo usado na observação.', x: 450, y: 500 },
      { id: 'average', title: 'Velocidade média', description: 'Calcule uma razão entre deslocamento e tempo ao longo de um percurso.', x: 620, y: 500 },
      { id: 'direction', title: 'Direção importa', description: 'Entenda como a direção transforma rapidez em uma grandeza vetorial.', x: 790, y: 500 },
      { id: 'instant', title: 'Um instante do percurso', description: 'Aproxime a velocidade em um instante usando intervalos cada vez menores.', x: 500, y: 300 },
      { id: 'light-speed', title: 'O limite da luz', description: 'Investigue a velocidade da luz e seu papel central na física moderna.', x: 500, y: 700 },
    ],
    edges: [
      { from: 'motion', to: 'distance-time' }, { from: 'distance-time', to: 'average' },
      { from: 'average', to: 'direction' }, { from: 'average', to: 'instant' },
      { from: 'instant', to: 'light-speed' }, { from: 'light-speed', to: 'motion' },
    ],
  },
}
