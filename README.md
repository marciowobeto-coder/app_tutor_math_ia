# TutorMath AI (stepbystep-math-guide)

Aplicativo que ajuda alunos do ensino fundamental a resolver exercícios de matemática.
O aluno resolve no quadro branco (ou envia foto do caderno) e a IA avalia o resultado.

> **Novidade:** os exercícios **não são mais criados pela IA**. Eles vêm de uma **base de conhecimento**
> (arquivos JSON em `src/data/knowledge-base/sources/`). A IA continua sendo usada só para **avaliar** a resolução do aluno
> (as dicas agora vêm da própria base, e a IA só entra se faltar dica).

## Como rodar no VS Code (Windows, macOS ou Linux)

**Pré-requisito:** [Node.js](https://nodejs.org) versão 18 ou mais nova (recomendado a LTS). Confira com `node -v`.

1. Abra a pasta do projeto no VS Code (**Arquivo > Abrir Pasta…** > `stepbystep-math-guide`).
2. Abra o terminal do VS Code (**Ctrl+'** ou **Terminal > Novo Terminal**).
3. Instale as dependências (só na primeira vez):
   ```bash
   npm install
   ```
4. Confirme que existe o arquivo `.env` na raiz (já vem no projeto; se faltar, copie `.env.example` para `.env` e preencha).
5. Rode o app:
   ```bash
   npm run dev
   ```
6. Abra <http://localhost:8080> no navegador (o terminal mostra o endereço).

Outros comandos úteis:

| Comando | Para que serve |
| --- | --- |
| `npm run dev` | roda o app com recarga automática |
| `npm test` | roda os testes (inclui testes da base de conhecimento) |
| `npm run lint` | verifica o código |
| `npm run build` | gera a versão de produção em `dist/` |

Extensões do VS Code que ajudam (opcional): **ESLint**, **Tailwind CSS IntelliSense** e **Vitest**.

> Se `npm install` reclamar de dependências, apague a pasta `node_modules` e o arquivo `package-lock.json` e rode `npm install` de novo
> (o projeto veio do Lovable, que usa `bun.lock`; o `package-lock.json` estava desatualizado).

### O que roda localmente e o que continua na nuvem

- **Local:** a interface (React + Vite) **e a base de exercícios** (JSON dentro do projeto).
- **Nuvem (Supabase/Lovable):** login, banco de dados (pontos, relatórios) e a função `ai-tutor`, que faz a avaliação da resolução com IA.
  Por isso é preciso ter internet e o `.env` com as chaves do projeto Supabase.

## Base de conhecimento

- Arquivos: `src/data/knowledge-base/sources/*.json` (um arquivo por fonte/livro).
- Fonte atual: **GIOVANNI JÚNIOR, José Ruy. _A conquista matemática_: 7º ano. 1. ed. São Paulo: FTD, 2022** (`acm7-2022`), tema "Números Inteiros e Racionais" do 7º ano.
- Código que lê a base: `src/lib/knowledge-base.ts` (regras de quais exercícios entram, sorteio sem repetir, dicas).
- **Para adicionar outra fonte**, veja `src/data/knowledge-base/README.md`.

### Como um exercício da base vira uma questão no app

- Exercícios com itens (a, b, c…) viram **uma questão por item** (o enunciado geral + o item).
- Ficam **de fora**: exercícios abertos ("elabore uma atividade…"), exercícios que dependem de figura (o app ainda não mostra figuras) e os de leitura duvidosa. Dá para mudar isso em `KB_RULES` no início de `src/lib/knowledge-base.ts`.
- O aluno pode filtrar por **fonte** (quando houver mais de uma) e por **assunto**. O app não repete uma questão até o aluno ver todas do filtro escolhido.
- As **dicas** (3 níveis) vêm do campo `dicas` da base. A **resposta esperada** e a **resolução** de referência também vêm da base e são enviadas à IA na hora da avaliação.

## Estrutura

```
src/
  data/knowledge-base/   base de exercícios (JSON) + README de como adicionar fontes
  lib/knowledge-base.ts  leitura da base, filtros, sorteio, dicas
  lib/ai-service.ts      chamadas à IA (dica de reserva e avaliação do quadro)
  pages/                 telas (Home, Temas, Exercício, Progresso, Admin)
supabase/
  functions/ai-tutor     função de IA (avaliação e dica de reserva)
  migrations/            estrutura do banco
```

## Testes

```bash
npm test
```

Os testes conferem, entre outras coisas, que todo exercício da base tem enunciado e resposta, que os ids não se repetem e que todos os temas usados existem no app.
