# Voice Studio — SharpStone Phys

O Voice Studio é uma ferramenta local de desenvolvimento para a introdução de John Harrison no primeiro ato do arco Tempo. Não aparece no menu do jogo e a chave Gemini é lida pelo processo local do Vite; nenhuma credencial deve usar o prefixo `VITE_`.

## Preparação local

1. Copie `.env.example` para `.env.local` e preencha `GEMINI_API_KEY` no seu computador. Esse arquivo é ignorado pelo Git.
2. Inicie o servidor com `npm run dev`.
3. Abra o endereço local do Vite seguido de `/__voice-studio` (por exemplo, `http://localhost:5175/__voice-studio`).
4. Sem credenciais, o perfil, a interface, a importação local, a validação e a edição de legendas continuam disponíveis. As chamadas Gemini ficam desativadas.

O Voice Studio exige conexão local. A chave só é enviada do processo de desenvolvimento à API Google quando uma ação Gemini é selecionada e confirmada.

## Aprovações obrigatórias

1. **Identidade:** consulte vozes predefinidas ou crie quantos candidatos personalizados forem necessários. Se rejeitar um candidato, escreva ajustes para criar outra identidade derivada; o candidato original permanece salvo. Edite a fala no campo da Etapa 1, gere uma amostra curta com essa fala e compare as tomadas. A prévia devolvida pelo Voice Design é separada, pode usar conteúdo próprio e serve apenas como referência.
2. **Aprovação da voz:** selecione a amostra e aprove a identidade. O identificador, a descrição, o modelo, a versão e a URL da referência são persistidos em `content/characters/john-harrison/voice-profile.json`.
3. **Interpretação:** com a identidade já aprovada, edite o texto curto e a direção de leitura (ritmo, pausas, tom, emoção). Cada tomada usa o mesmo ID vocal. Ouça e aprove uma interpretação inicial.
4. **Narração completa:** o fluxo só fica ativo após as duas aprovações. O roteiro integral e a direção podem ser editados antes de cada geração; o áudio final e as legendas ainda exigem revisão e aprovação humana.
5. **Revisão:** valide o áudio, transcreva com timestamps por palavra, compare com o texto, revise as legendas, importe ou ajuste SRT/VTT/JSON quando necessário e aprove a integração.

O texto inicial da audição foi copiado do trecho que o desenvolvedor forneceu na conversa; não foi criado pelo Gemini. Ele pode ser editado antes de gerar e é enviado exatamente como aparece no campo. Cada amostra curta de identidade ou interpretação deve estimar entre 10 e 20 segundos, incluindo a pausa contemplativa. Use a mesma fala para comparar identidades. As direções de voz ficam fora do texto falado. Nenhum limite artificial de candidatos é aplicado.

## Custos e registros

Antes de cada geração ou transcrição, o estúdio informa modelo, texto/tamanho, duração provável e estimativa em USD quando há uma tarifa publicada; uma caixa de confirmação é obrigatória. O TTS padrão usa as tarifas publicadas do Gemini 3.8 Flash TTS. A transcrição mostra a estimativa publicada por minuto do Gemini 3.5 Transcribe. Voice Design não tem uma estimativa separada confiável apresentada na API, então o estúdio avisa isso antes de enviar a solicitação. As estimativas não representam cobrança confirmada e não presumem cota gratuita.

Os registros locais de tentativas, estimativas e indicação de cache ficam em `tools/narration/data/usage.json`; esse arquivo é ignorado pelo Git. Vozes, amostras curtas e interpretações ficam em `content/characters/john-harrison/voice-candidates.json` com os WAVs locais correspondentes em `tools/narration/data/candidates/`, fora do build. Arquivos aprovados não são sobrescritos: cada nova aprovação recebe um nome de versão distinto. A transcrição também usa o endpoint Files da Gemini e registra o uso estimado após o retorno.

## Importação e legendas

WAV, MP3, M4A, OGG e outros formatos que o navegador decodifique podem ser importados. O Voice Studio verifica decodificação, duração, taxa de amostragem, canais, pico, clipping, silêncio e sinal no fim do arquivo. Isso ajuda na revisão; não substitui a audição humana nem detecta com certeza todos os defeitos acústicos.

A sincronização usa `gemini-3.5-transcribe` em modo verbatim com timestamps por palavra. O alinhador preserva as palavras do roteiro e mede a divergência. Se a correspondência ficar abaixo do limiar definido, ele não fabrica timestamps; a pessoa desenvolvedora revisa a transcrição/áudio ou importa e ajusta as legendas manualmente. JSON e WebVTT podem ser exportados. Os timestamps usados na cena vêm do arquivo aprovado.

O player segue o `currentTime` real do elemento de áudio. Pausa, retomada, busca em depuração e saída da cena usam o mesmo elemento; sem um arquivo aprovado, segue a timeline de contingência localizada. Narração tem controle de volume próprio no AudioManager e reduz suavemente o volume da música durante a fala.

## Locales

`src/i18n.tsx` centraliza as mensagens da interface e persiste a preferência entre `pt-BR` e `en`. O menu Áudio inclui o seletor de idioma. Os metadados de cena, narração e legendas têm campos localizados; a cena de Harrison possui script e legendas em inglês como conteúdo-base, mas ainda não tem voz em inglês aprovada. Manifests de áudio são resolvidos por pasta de locale (`audio/narration/{locale}/...`) e uma voz pt-BR nunca é executada com a interface em inglês. Conteúdo que não tenha tradução cadastrada mantém a versão original.

Ao acrescentar idiomas, inclua as mensagens nos dois dicionários e adicione scripts, direção e manifest de cada cena no locale correspondente; não reutilize timestamps nem áudio entre idiomas.

## Verificação

- `npm run test:narration`: testes locais de alinhamento, WebVTT, timestamps e bloqueios de aprovação. Não usam rede nem créditos.
- `npm run build`: compila a aplicação. A chave permanece no plugin Node de desenvolvimento e não é importada pelo bundle do jogo.

Nenhuma chave de API é distribuída. O trabalho de implementação não executa chamadas Gemini nem gera áudio.
