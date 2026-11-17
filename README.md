# SharpStone Phys — Pedra Lascada: Física

Protótipo web do Universo do Conhecimento. A interface usa React + TypeScript; os neurônios são estruturas 3D procedurais renderizadas por Three.js com React Three Fiber, em câmera ortográfica fixa e com malhas translúcidas adequadas ao mapa 2.5D.

## Executar

```sh
npm install
npm run dev
```

## Estrutura

- `src/data.ts`: catálogo configurável, estados iniciais, progresso e dependências múltiplas.
- `src/Neuron.tsx`: símbolo, progresso, status e interação de cada neurônio.
- `src/NeuronScene.tsx`: geometria tridimensional procedural, iluminação, linhas internas e filamentos.
- `src/App.tsx`: composição do universo, mapa de sinapses e fluxo de prévia do nascimento.
- `src/style.css`: identidade visual, adaptação mobile e animações com suporte a movimento reduzido.

No protótipo, **Avançar jornada** libera Distância; **Gerar conexão** inicia a formação de Velocidade a partir de Tempo + Distância. Esses controles permitem percorrer o fluxo visual sem antecipar Velocidade no mapa inicial.
