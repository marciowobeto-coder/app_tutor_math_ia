# Base de conhecimento de exercícios

Cada arquivo `.json` em `sources/` é **uma fonte** (um livro, uma apostila, uma lista de exercícios…).
O app carrega **todos** os arquivos dessa pasta automaticamente — não é preciso alterar código para incluir uma fonte nova.

## Como adicionar uma fonte nova

1. Gere o arquivo no mesmo formato de `sources/acm7-2022.json` (mesmos campos).
2. Salve em `src/data/knowledge-base/sources/<id-da-fonte>.json`.
3. Confira que:
   - `metadados.fontes` traz a fonte com um `id` **único** (ex.: `outrolivro-2023`) e a `referencia_abnt`;
   - todo exercício tem `fonte_id` igual a esse `id` e um `id` único (convenção: `<fonte_id>-p<página>-q<número>`);
   - todo exercício tem `ano_id` e `tema_id` **existentes no app** (veja `SCHOOL_YEARS` em `src/types/math.ts`), por exemplo `"8fund"` e `"8f-numeros"`. É isso que faz o exercício aparecer no tema certo.
4. Rode `npm test`: os testes avisam se algum tema não existe, se há id repetido ou exercício sem resposta.

Quando houver mais de uma fonte no mesmo tema, a tela de exercícios mostra um seletor de **Fonte** para o aluno.

## Campos principais de um exercício

| Campo | Para que serve |
| --- | --- |
| `id`, `fonte_id`, `pagina`, `numero` | identificação e referência na fonte |
| `ano_id`, `tema_id` | onde aparece no app |
| `topico` | assunto dentro do tema (vira o filtro "Assunto") |
| `tipo` | `calculo`, `problema`, `compreensao`, `multipla_escolha`, `figura`, `elaboracao`, `desafio` |
| `enunciado` | texto mostrado ao aluno |
| `alternativas` | só para múltipla escolha (`{ "a": "...", "b": "..." }`) |
| `itens` | itens a), b), c)… cada um com `enunciado`, `resposta` e `resolucao` |
| `resposta` / `resolucao` | usados quando o exercício não tem itens |
| `dicas` | até 3 dicas, da mais leve para a mais forte |
| `depende_de_figura` | `true` = o exercício precisa de uma figura/gráfico/imagem para ser resolvido |
| `imagem` | opcional. Nome do arquivo de imagem (veja "Exercícios com imagem", abaixo) |
| `tabela` | opcional. Uma tabela para mostrar junto do enunciado: lista de linhas, cada linha é uma lista de células; a primeira linha é o cabeçalho. Ex.: `[["Opinião","Qtde"],["Ótimo","105"],["Bom","100"]]` |
| `confianca_da_leitura` | `alta`, `media` ou `baixa` (`baixa` fica fora da prática); veja também `revisar` |

As regras de quais exercícios entram na prática ficam em `KB_RULES` (`src/lib/knowledge-base.ts`).

## Exercícios com imagem

Alguns exercícios do livro dependem de uma figura (reta numérica, gráfico, esquema) para serem resolvidos.
Como o app ainda não sabe reaproveitar a foto original da página do livro, essas figuras são **redesenhadas
do zero** como um SVG simples e cadastradas no exercício:

1. Crie um arquivo `.svg` (ou `.png`/`.jpg`) com o diagrama e salve em
   `src/data/knowledge-base/images/<fonte_id>/<arquivo>` — uma subpasta por fonte.
2. No exercício (ou no item, se a figura for só daquele item), adicione o campo `"imagem": "<arquivo>"`
   com o nome do arquivo (sem o caminho da pasta).
3. Pronto: o app resolve a URL da imagem sozinho e mostra a figura acima do enunciado, na tela de exercício.

**Importante:** um exercício com `depende_de_figura: true` só entra na prática automática do app se tiver
uma `imagem` cadastrada (ou se `KB_RULES.includeFigureExercises` for `true`). Sem imagem, ele fica de fora —
assim nenhum exercício "sem figura visível" aparece para o aluno por engano. Isso vale tanto para os
exercícios novos quanto para os antigos: ao rever uma fonte já existente, vale a pena procurar por
`"depende_de_figura": true` sem `"imagem"` e ver se dá para desenhar uma figura simples para ele.

## Exercícios com várias alternativas (a, b, c…)

Quando um exercício tem `itens`, todos aparecem juntos, numa única questão, **com as letras originais**
do livro (a, b, c…) — o aluno vê e resolve tudo de uma vez, exatamente como no livro/fonte original.

A correção também é por alternativa, não um veredito único para o exercício inteiro: a IA que avalia a
foto/quadro recebe cada alternativa separadamente (enunciado + resposta esperada de cada uma) e devolve
um resultado por alternativa — resolvida e certa, resolvida e errada, ou não encontrada na imagem. O
aluno vê uma lista com o resultado de cada alternativa e um placar final de quantas acertou e quantas
errou, em vez de um "certo/errado" único que esconderia o desempenho em cada parte.

- Um item cuja `resposta` é de elaboração/pesquisa (ex.: "Resposta pessoal…") não entra na correção —
  continua aparecendo no enunciado (fiel ao exercício original), mas fica de fora do placar de
  acertos/erros, já que não tem resposta única para conferir.
- Se algum item específico tiver uma figura só dele (raro), o campo `imagem` no próprio item funciona
  igual ao do exercício.

## Fontes que não são páginas de livro (exercícios de outras fontes na internet)

Nem toda fonte precisa ser um livro fotografado. O arquivo `outras-fontes-web.json` traz exercícios
copiados de páginas educacionais abertas (Toda Matéria, Lereaprender, Tudo Sala de Aula, Beduka), com a
mesma estrutura de sempre — só muda uma convenção:

- Como não existe "página de livro", o campo `"pagina"` fica sempre `0`.
- O `id` de cada exercício vira `<fonte_id>-q<número>` (sem o `-p<página>-` que aparece nas bases de livro).
- A referência mostrada ao aluno (`reference`, gerada por `makeUnit` em `knowledge-base.ts`) detecta
  `pagina === 0` e mostra só "Fonte — ex. N", sem o "p. 0" que apareceria por engano.
- Quando a página de origem não trazia uma resolução passo a passo (só o gabarito), a resolução foi
  escrita por Claude a partir do gabarito informado — sempre conferindo a conta antes de incluir o
  exercício. Um exercício cujo gabarito da própria fonte não batia com a conta foi deixado de fora da
  base, em vez de ser incluído com uma resolução duvidosa.
- Um `metadados.fontes` pode ter várias fontes (uma por página/site), cada exercício aponta para a sua
  em `fonte_id` — é a mesma ideia já usada em `acm8-2022.json` (que tem a fonte do livro e a
  `complemento-claude`).
