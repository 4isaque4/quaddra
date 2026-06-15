# BPMN viewer quality notes

Este arquivo registra decisoes boas, erros ja vistos e o checklist de auditoria
para o viewer BPMN da Quaddra.

## Objetivo

O viewer deve melhorar a leitura dos BPMNs importados do Bizagi sem alterar o XML
original nem depender de ajuste manual por arquivo.

Regras atuais:

- Fonte padrao: Segoe UI, tamanho 8, line-height compacto.
- Marcadores de atividade nao podem colidir com texto interno.
- Partes de um mesmo marcador SVG precisam se mover juntas.
- Anotacoes BPMN devem aparecer como bracket limpo, sem caixa cinza de fundo.
- Texto de anotacao deve ficar alinhado dentro da area util depois do bracket.
- Labels externas de fluxos/gateways devem ficar centralizadas no proprio label box.
- Conectores devem manter linha e ponta consistentes em zooms diferentes.
- Setas de sequence flow devem escalar junto com o diagrama; stroke fixo em pixel
  deixa as pontas pesadas no overview.

## Causas raiz ja confirmadas

1. `getBBox()` puro nao considera `transform` do proprio no SVG.
   O `bpmn-js` desenha o marcador de subprocesso como `rect` transformado +
   `path` sem o mesmo transform. Se o bbox for lido sem CTM, o retangulo parece
   estar no topo e o path parece estar embaixo. Resultado antigo: o quadrado
   subia, mas o sinal de mais ficava dentro do card.

2. A aplicacao de cores do Bizagi era generica demais para `TextAnnotation`.
   O renderer original desenha anotacao como retangulo transparente + bracket +
   texto. Quando colorimos todo `rect/path`, a anotacao virava uma caixa cinza e
   o texto ficava visualmente torto.

3. Labels externas dependem da geometria salva no DI do BPMN.
   BPMNs exportados pelo Bizagi podem trazer labels pouco centradas. A aplicacao
   deve normalizar a posicao visual do texto depois do import.

## Padrao implementado

Arquivo principal: `apps/web/lib/bpmn-marker-layout.ts`.

- `normalizeBpmnDiagramVisuals(instance)` e a unica rotina chamada pelo viewer.
- `arrangeBpmnActivityMarkers` agrupa marcadores depois do label interno.
- `getSvgBoxInSpace` converte bbox usando CTM relativo ao grupo visual.
- `normalizeBpmnTextAnnotations` restaura anotacao como bracket transparente e
  centraliza o texto verticalmente na area util.
- `normalizeBpmnExternalLabels` centraliza textos de elementos `label`.
- `normalizeBpmnConnections` aplica round caps/joins nos caminhos.
- `normalizeBpmnConnections` nao fixa o stroke dos conectores em pixel; a linha e
  a ponta escalam juntas no zoom baixo.

Viewer: `apps/web/components/BpmnViewer.tsx`.

- Chamar a normalizacao logo apos `applyBizagiColors`.
- Chamar novamente no ajuste tardio, porque o import/render do `bpmn-js` pode
  estabilizar depois de alguns milissegundos.

## Erros a nao repetir

- Nao mover cada `path/rect` de marcador separadamente.
- Nao usar `getBBox()` cru para decidir posicao de elementos com `transform`.
- Nao transformar anotacao BPMN em card/caixa preenchida.
- Nao aumentar automaticamente o shape BPMN para resolver colisao; isso quebra o
  DI original e pode desalinhar conectores.
- Nao corrigir so um BPMN especifico. A regra deve operar sobre tipo/estrutura
  BPMN.
- Nao aplicar `vector-effect: non-scaling-stroke` em sequence flow. Em zoom baixo
  isso deixa as setas grandes e chapadas.

## Checklist visual

Rodar em todos os BPMNs locais:

- `/processos/fluxo-contratos-cliente-privado-contratos-clientes`
- `/processos/fluxo-contratos-cliente-publico-contratos-clientes-setor-publico`
- `/processos/fluxo-contratos-credenciada-fluxo-de-contratos-credenciada`
- `/processos/operacao-cartao-operacao-repasse-credenciada`

Verificar:

- Nenhum marcador cobre texto dentro de tarefa/subprocesso.
- Marcador de subprocesso aparece como quadrado + mais no mesmo grupo.
- Icones de usuario/manual/etc. ficam fora ou em canto limpo quando colidem com o
  texto.
- Anotacoes aparecem como bracket sem fundo cinza.
- Texto de anotacao nao encosta no bracket e fica verticalmente equilibrado.
- Labels de gateway/fluxo nao ficam deslocadas em relacao ao espaco esperado.
- Pontas de seta aparecem completas e alinhadas ao segmento.

## Referencias usadas

- bpmn-js: renderer BPMN 2.0 para browser e API de import/render.
- bpmn-js examples: custom rendering, theming e integracao.
- Bizagi: padrao restaurado de texto Segoe UI tamanho 8 e customizacao visual.
