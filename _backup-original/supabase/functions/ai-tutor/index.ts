import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

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

async function callLovableAI(systemPrompt: string, userPrompt: string, imageData?: string, temperature = 0.7) {
  const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
  if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY is not configured");

  const messages: any[] = [
    { role: "system", content: systemPrompt },
  ];

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

  const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${LOVABLE_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "google/gemini-2.5-flash",
      messages,
      temperature,
      max_tokens: 1024,
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    console.error("Lovable AI error:", response.status, errorText);
    if (response.status === 429) throw new Error("Rate limit exceeded. Aguarde um momento.");
    if (response.status === 402) throw new Error("Créditos insuficientes.");
    throw new Error("AI service error");
  }

  const data = await response.json();
  return data.choices?.[0]?.message?.content || "";
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const body = await req.json();
    const { action, exercise, steps, stepIndex, imageData, schoolYear, topicId, topicLabel, schoolYearLabel, topicDescription, errorType } = body;

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
Descrição do passo: "${exercise.expectedSteps[stepIndex]?.description}"
Passos do aluno até agora: ${steps.map((s: any) => s.expression).join(' → ')}

Dê uma dica que oriente o aluno sem revelar a resposta.`;

        content = await callLovableAI(systemPrompt, userPrompt);
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
Desenvolvimento completo do aluno: ${steps.map((s: any) => s.expression).join(' → ')}

IMPORTANTE: Foque no resultado final. Se o resultado final bate com a resposta esperada e o desenvolvimento faz sentido, marque como correto independentemente dos passos intermediários.`;

        content = await callLovableAI(systemPrompt, userPrompt);
        break;
      }

      case "analyze_whiteboard": {
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
Resposta esperada: "${exercise?.correctAnswer || 'Não especificada'}"
Analise a imagem do trabalho do aluno. Foque no resultado final e na coerência geral, NÃO em cada linha individualmente.`;

        content = await callLovableAI(systemPrompt, userPrompt, imageData);
        break;
      }

      case "generate_exercise": {
        const randomSeed = Math.floor(Math.random() * 1000000);
        const contexts = [
          "situação do cotidiano (compras, receitas, viagens)",
          "esporte e competições",
          "natureza e meio ambiente",
          "tecnologia e jogos",
          "construção e arquitetura",
          "culinária e medidas",
          "finanças e mesada",
          "música e ritmo",
          "astronomia e espaço",
          "animais e zoológico",
          "festa e organização de eventos",
          "transporte e distâncias",
          "saúde e alimentação",
          "arte e geometria visual",
          "história e curiosidades numéricas",
        ];
        const chosenContext = contexts[randomSeed % contexts.length];

        systemPrompt = `Você é um criador de exercícios de matemática para o ensino fundamental brasileiro, seguindo a BNCC.

REGRAS DE VARIEDADE:
- Varie os CONTEXTOS e FORMATOS a cada exercício (narrativo, charada, desafio prático, enigma, problema inverso)
- Use números variados (não sempre redondos)
- MANTENHA O ENUNCIADO CURTO E DIRETO — máximo 3-4 frases. Não escreva textos longos.

REGRAS SOBRE REFERÊNCIAS VISUAIS:
1. NUNCA use "observe", "analise", "veja", "gráfico", "tabela", "quadro", "figura", "imagem" SEM incluir "tableData".
2. Se precisar de dados tabulares, inclua "tableData" completo.
3. PREFERÊNCIA: problemas textuais contextualizados, sem depender de imagens.
4. NUNCA referencie algo visual que o aluno não verá.

Responda APENAS em JSON válido:
{
  "statement": "enunciado curto e contextualizado",
  "correctAnswer": "resposta correta",
  "expectedSteps": [{"order": 1, "expression": "...", "description": "..."}],
  "points": número (5 a 30),
  "tableData": [["Col1", "Col2"], ["val1", "val2"]] ou null
}
Responda em português do Brasil.`;

        userPrompt = `Semente: ${randomSeed}
Ano: ${schoolYearLabel} | Tema: ${topicLabel}
Descrição: ${topicDescription}
Erros comuns: ${errorType || 'nenhum'}
Contexto sugerido: ${chosenContext}

Crie um exercício CURTO, VARIADO e diferente. Máximo 3-4 frases no enunciado. Adequado ao ${schoolYearLabel} e tema "${topicLabel}".`;

        content = await callLovableAI(systemPrompt, userPrompt, undefined, 1.0);
        break;
      }

      default:
        return new Response(
          JSON.stringify({ error: "Unknown action" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
    }

    let result: any = { content };
    if (["correct_step", "analyze_whiteboard", "generate_exercise"].includes(action)) {
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
