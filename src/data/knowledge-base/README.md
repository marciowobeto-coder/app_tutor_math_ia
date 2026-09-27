# Base de conhecimento de exercícios

Cada arquivo `.json` em `sources/` é **uma fonte** (um livro, uma apostila, uma lista de exercícios…).
O app carrega **todos** os arquivos dessa pasta automaticamente — não é preciso alterar código para incluir uma fonte nova.

## Como adicionar uma fonte nova

1. Gere o arquivo no mesmo formato de `sources/acm7-2022.json` (mesmos campos).
2. Salve em `src/data/knowledge-base/sources/<id-da-fonte>.json`.
3. Confira que:
   - `metadados.fontes` traz a fonte com um `id` **único** (ex.: `outrolivro-2023`) e a `referencia_abnt`;
   - todo exercício tem `fonte_id` igual a esse `id` e um `id` único (convenção: `<fonte_id>-p<página>-q<número>`);
   - todo exercício tem `ano_id` e `tema_id` **existentes no app** (veja `SCHOOL_YEARS` em `src/types/math.ts`), por exemplo `"7fund"` e `"7f-inteiros"`. É isso que faz o exercício aparecer no tema certo.
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
| `modo_pratica` | opcional. `exercicio_inteiro` = os itens viram uma única questão (use quando os itens dependem uns dos outros); padrão = uma questão por item |
| `depende_de_figura` | `true` = precisa de figura (fica fora da prática por enquanto) |
| `confianca_da_leitura` | `alta`, `media` ou `baixa` (`baixa` fica fora da prática); veja também `revisar` |

As regras de quais exercícios entram na prática ficam em `KB_RULES` (`src/lib/knowledge-base.ts`).
