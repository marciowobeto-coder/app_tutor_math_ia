import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const admin = createClient(SUPABASE_URL, SERVICE_ROLE, {
  auth: { persistSession: false, autoRefreshToken: false },
});

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

function cleanBase64(dataUrl: string): { mimeType: string; base64: string } {
  const match = dataUrl.match(/^data:([^;]+);base64,(.+)$/s);
  if (match) {
    return { mimeType: match[1], base64: match[2].replace(/\s/g, "") };
  }
  return { mimeType: "image/png", base64: dataUrl.replace(/\s/g, "") };
}

/** Formatos mínimos do que o app envia no corpo da requisição. */
interface StepPayload {
  expression: string;
}

interface SubItemPayload {
  letra: string;
  statement: string;
  correctAnswer: string;
  referenceSolution?: string[];
}

interface ExercisePayload {
  referenceSolution?: string[];
  subItems?: SubItemPayload[];
}

async function callAnthropicAI(systemPrompt: string, userPrompt: string, imageData?: string, temperature = 0.7) {
  const ANTHROPIC_API_KEY = Deno.env.get("ANTHROPIC_API_KEY");
  if (!ANTHROPIC_API_KEY) throw new Error("ANTHROPIC_API_KEY is not configured");

  const content: Array<Record<string, unknown>> = [];

  if (imageData) {
    const { mimeType, base64 } = cleanBase64(imageData);
    content.push({ type: "image", source: { type: "base64", media_type: mimeType, data: base64 } });
  }
  content.push({ type: "text", text: userPrompt });

  const response = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "x-api-key": ANTHROPIC_API_KEY,
      "anthropic-version": "2023-06-01",
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "claude-haiku-4-5-20251001",
      system: systemPrompt,
      messages: [{ role: "user", content }],
      temperature,
      max_tokens: 1024,
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    console.error("Anthropic API error:", response.status, errorText);
    if (response.status === 429) throw new Error("Rate limit exceeded. Aguarde um momento.");
    if (response.status === 401 || response.status === 403) throw new Error("Chave da Anthropic inválida ou sem permissão.");
    if (response.status === 402) throw new Error("Créditos insuficientes.");
    throw new Error("AI service error");
  }

  const data = await response.json();
  const textBlock = (data.content ?? []).find((b: { type?: string; text?: string }) => b?.type === "text");
  return textBlock?.text ?? "";
}

async function callGroqAI(systemPrompt: string, userPrompt: string, imageData?: string, temperature = 0.7) {
  const GROQ_API_KEY = Deno.env.get("tutor_math_api");
  if (!GROQ_API_KEY) throw new Error("Groq API key (tutor_math_api) is not configured");

  const messages: Array<{ role: string; content: unknown }> = [{ role: "system", content: systemPrompt }];

  if (imageData) {
    const { mimeType, base64 } = cleanBase64(imageData);
    messages.push({
      role: "user",
      content: [
        { type: "text", text: userPrompt },
        { type: "image_url", image_url: { url: `data:${mimeType};base64,${base64}` } },
      ],
    });
  } else {
    messages.push({ role: "user", content: userPrompt });
  }

  // qwen/qwen3.8-27b é o único modelo com suporte a imagem no Groq no momento;
  // pra texto puro usamos um modelo mais rápido/barato.
  const model = imageData ? "qwen/qwen3.8-27b" : "openai/gpt-oss-120b";
  // O qwen/qwen3.8-27b tem limite de 1000 tokens de saída/min no plano gratuito da Groq;
  // 1024 estourava esse limite antes mesmo de gerar a resposta.
  const maxTokens = imageData ? 900 : 1024;

  const response = await fetch("https://api.groq.com/openai/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${GROQ_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ model, messages, temperature, max_tokens: maxTokens }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    console.error("Groq API error:", response.status, errorText);
    if (response.status === 429) throw new Error("Rate limit exceeded. Aguarde um momento.");
    if (response.status === 401 || response.status === 403) throw new Error("Chave da Groq inválida ou sem permissão.");
    throw new Error("AI service error");
  }

  const data = await response.json();
  return data.choices?.[0]?.message?.content || "";
}

/** Lê o provedor de IA configurado pelo admin (tabela app_settings). Consultado a cada
 * chamada (sem cache) para que uma troca no painel valha imediatamente pra todo mundo. */
async function getAIProvider(): Promise<"anthropic" | "groq"> {
  try {
    const { data } = await admin
      .from("app_settings")
      .select("value")
      .eq("key", "ai_provider")
      .maybeSingle();
    if (data?.value === "groq") return "groq";
  } catch (e) {
    console.error("Erro ao ler ai_provider, usando anthropic como padrão:", e);
  }
  return "anthropic";
}

async function callAI(systemPrompt: string, userPrompt: string, imageData?: string, temperature = 0.7) {
  const provider = await getAIProvider();
  return provider === "groq"
    ? callGroqAI(systemPrompt, userPrompt, imageData, temperature)
    : callAnthropicAI(systemPrompt, userPrompt, imageData, temperature);
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const body = await req.json();
    const { action, exercise, steps, stepIndex, imageData, schoolYear } = body;
    // Os exercícios agora vêm da base de conhecimento (src/data/knowledge-base); a IA só ajuda a corrigir e dar dicas.
    const referenceText = (ex: ExercisePayload | undefined) =>
      Array.isArray(ex?.referenceSolution) && ex.referenceSolution.length
        ? `\nResolução de referência da base (é UMA forma de resolver; o aluno pode resolver de outro jeito): ${ex.referenceSolution.join(' | ')}`
        : '';

    let systemPrompt = "";
    let userPrompt = "";
    let content = "";

    switch (action) {
      case "generate_hint": {
        systemPrompt = `Você é um tutor de matemática paciente e encorajador para alunos do ensino fundamental brasileiro.
Nunca dê a resposta final. Guie o aluno com perguntas e dicas progressivas.
Responda em português do Brasil. Seja conciso (máximo 3 frases).
Adapte a linguagem ao ano escolar do aluno.`;

        userPrompt = `Ano escolar: ${schoolYear}
Exercício: "${exercise.statement}"
Resposta esperada: "${exercise.correctAnswer}"
Passo atual: ${stepIndex + 1} de ${exercise.expectedSteps.length}
Passo esperado: "${exercise.expectedSteps[stepIndex]?.expression}"
Descrição do passo: "${exercise.expectedSteps[stepIndex]?.description}"${referenceText(exercise)}
Passos do aluno até agora: ${steps.map((s: StepPayload) => s.expression).join(' → ')}

Dê uma dica que oriente o aluno sem revelar a resposta.`;

        content = await callAI(systemPrompt, userPrompt);
        break;
      }

      case "correct_step": {
        systemPrompt = `Você é um tutor de matemática. Analise o desenvolvimento do aluno com foco no RESULTADO FINAL.
Se o resultado final está correto e o desenvolvimento é coerente (mesmo que use passos diferentes dos esperados), considere CORRETO.
Apenas aponte erro se o resultado final estiver errado ou se houver incoerência grave no raciocínio.
Nunca revele a resposta final. Identifique o tipo de erro se houver.
Responda APENAS em JSON válido: { "feedback": "...", "errorType": "sinal|distributiva|salto_logico|calculo|conceitual|nenhum", "isCorrect": boolean, "isPartial": boolean }`;

        userPrompt = `Exercício: "${exercise.statement}"
Resposta esperada: "${exercise.correctAnswer}"
O aluno escreveu: "${steps[steps.length - 1]?.expression}"
Desenvolvimento completo do aluno: ${steps.map((s: StepPayload) => s.expression).join(' → ')}

IMPORTANTE: Foque no resultado final. Se o resultado final bate com a resposta esperada e o desenvolvimento faz sentido, marque como correto independentemente dos passos intermediários.`;

        content = await callAI(systemPrompt, userPrompt);
        break;
      }

      case "analyze_whiteboard": {
        const subItems: SubItemPayload[] = Array.isArray(exercise?.subItems) ? exercise.subItems : [];
        const hasSubItems = subItems.length > 0;

        if (hasSubItems) {
          const itemsListText = subItems
            .map((si: SubItemPayload) => {
              const ref = Array.isArray(si.referenceSolution) && si.referenceSolution.length
                ? ` (resolução de referência: ${si.referenceSolution.join(' | ')})`
                : '';
              return `- letra "${si.letra}": "${si.statement}" — resposta esperada: "${si.correctAnswer}"${ref}`;
            })
            .join('\n');

          systemPrompt = `Você é um tutor de matemática analisando o trabalho manuscrito de um aluno.
A imagem pode vir de um quadro branco digital OU de uma foto de caderno/papel físico.
Este exercício tem VÁRIAS ALTERNATIVAS (itens a, b, c…) que o aluno deveria resolver, todas na mesma imagem.
Para CADA alternativa listada no prompt do usuário, procure na imagem se o aluno resolveu aquela alternativa especificamente.
FOCO NO RESULTADO FINAL de cada alternativa: se o resultado bate com a resposta esperada (aceite formas equivalentes de escrever o mesmo resultado), considere aquela alternativa CORRETA, mesmo com passos diferentes dos esperados.
Se não encontrar na imagem nada que corresponda a uma alternativa, marque "attempted": false para ela (e "isCorrect": false).
Responda APENAS em JSON válido, sem texto adicional, no formato:
{
  "itemResults": [
    { "letra": "a", "attempted": true, "isCorrect": true, "feedback": "comentário curto sobre essa alternativa" }
  ],
  "feedback": "parecer geral sobre o conjunto de alternativas",
  "isCorrect": true,
  "errorLocation": "onde houve o principal erro, se houver, ou null",
  "suggestions": ["sugestão1"]
}
"itemResults" deve ter EXATAMENTE um item para cada alternativa listada no prompt, na mesma ordem e com a mesma letra. "isCorrect" no nível principal só deve ser true se TODAS as alternativas foram resolvidas corretamente.
Responda em português do Brasil.`;

          userPrompt = `Exercício sendo resolvido: "${exercise?.statement || 'Não especificado'}"
Este exercício tem ${subItems.length} alternativa(s) para avaliar separadamente:
${itemsListText}
Analise a imagem do trabalho do aluno e avalie CADA alternativa acima, individualmente, conforme o formato pedido.`;
        } else {
          systemPrompt = `Você é um tutor de matemática analisando o trabalho manuscrito de um aluno.
A imagem pode vir de um quadro branco digital OU de uma foto de caderno/papel físico.
NÃO analise linha por linha como etapas separadas. Olhe o TRABALHO COMO UM TODO e dê um parecer geral.
FOCO ABSOLUTO NO RESULTADO FINAL: Se o resultado final está correto e o desenvolvimento é minimamente coerente, considere CORRETO. Não importa quantos passos o aluno usou ou se pulou etapas.
Só aponte erro se:
- O resultado final estiver ERRADO, ou
- Houver um erro GRAVE e evidente no desenvolvimento (ex: 2+2=5)
Se apontar erro, indique EXATAMENTE onde o aluno errou.
Se estiver tudo certo, dê um feedback positivo e encorajador.
Responda APENAS em JSON válido, sem texto adicional:
{
  "steps": ["todo o desenvolvimento identificado como texto único ou poucas expressões-chave"],
  "feedback": "parecer geral sobre o trabalho, focado no resultado final",
  "isCorrect": true/false,
  "errorLocation": "onde errou, se aplicável, ou null",
  "suggestions": ["sugestão1"]
}
Responda em português do Brasil.`;

          userPrompt = `Exercício sendo resolvido: "${exercise?.statement || 'Não especificado'}"
Resposta esperada (da base de conhecimento; aceite formas equivalentes de escrever o mesmo resultado, como +6 e 6): "${exercise?.correctAnswer || 'Não especificada'}"${referenceText(exercise)}
Analise a imagem do trabalho do aluno. Foque no resultado final e na coerência geral, NÃO em cada linha individualmente.`;
        }

        content = await callAI(systemPrompt, userPrompt, imageData);
        break;
      }

      default:
        return new Response(
          JSON.stringify({ error: "Unknown action" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
    }

    let result: { content: string; parsed?: unknown } = { content };
    if (["correct_step", "analyze_whiteboard"].includes(action)) {
      try {
        const jsonMatch = content.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          result = { ...result, parsed: JSON.parse(jsonMatch[0]) };
        }
      } catch {
        // Keep raw content
      }
    }

    return new Response(JSON.stringify(result), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("ai-tutor error:", e);
    const status = (e instanceof Error && e.message.includes("Rate limit")) ? 429 :
                   (e instanceof Error && e.message.includes("Créditos")) ? 402 : 500;
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }),
      { status, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
