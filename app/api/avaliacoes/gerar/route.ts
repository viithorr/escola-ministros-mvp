import { NextRequest, NextResponse } from "next/server";

type QuestaoGerada = {
  pergunta: string;
  explicacao?: string;
  alternativas: Array<{
    texto: string;
    correta: boolean;
  }>;
};

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as { transcricao?: string; tituloAula?: string };
    const transcricao = body.transcricao?.trim() ?? "";
    const tituloAula = body.tituloAula?.trim() ?? "Aula";

    if (!transcricao) {
      return NextResponse.json({ error: "Envie a transcricao da aula para gerar as questoes." }, { status: 400 });
    }

    const apiKey = process.env.OPENAI_API_KEY;

    if (!apiKey) {
      return NextResponse.json(
        {
          error:
            "A geracao automatica ainda nao esta configurada. Adicione OPENAI_API_KEY na Vercel para ativar este fluxo.",
        },
        { status: 500 },
      );
    }

    const prompt = `
Voce vai criar uma miniavaliacao objetiva sobre a aula "${tituloAula}".

Regras obrigatorias:
- use apenas informacoes que aparecem explicitamente na transcricao;
- nada de ambiguidade, nada de pegadinhas;
- gere exatamente 4 questoes;
- cada questao deve ter exatamente 4 alternativas;
- cada questao deve ter exatamente 1 alternativa correta;
- as alternativas erradas devem ser plausiveis, mas claramente incorretas com base na transcricao;
- escreva tudo em portugues do Brasil;
- mantenha linguagem clara para alunos.

Transcricao da aula:
${transcricao}
`.trim();

    const response = await fetch("https://api.openai.com/v1/responses", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "gpt-5.4-mini",
        input: prompt,
        text: {
          format: {
            type: "json_schema",
            name: "avaliacao_aula",
            strict: true,
            schema: {
              type: "object",
              additionalProperties: false,
              properties: {
                questoes: {
                  type: "array",
                  minItems: 4,
                  maxItems: 4,
                  items: {
                    type: "object",
                    additionalProperties: false,
                    properties: {
                      pergunta: { type: "string" },
                      explicacao: { type: "string" },
                      alternativas: {
                        type: "array",
                        minItems: 4,
                        maxItems: 4,
                        items: {
                          type: "object",
                          additionalProperties: false,
                          properties: {
                            texto: { type: "string" },
                            correta: { type: "boolean" },
                          },
                          required: ["texto", "correta"],
                        },
                      },
                    },
                    required: ["pergunta", "explicacao", "alternativas"],
                  },
                },
              },
              required: ["questoes"],
            },
          },
        },
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      return NextResponse.json(
        { error: `Nao foi possivel gerar as questoes agora. ${errorText || ""}`.trim() },
        { status: 500 },
      );
    }

    const payload = (await response.json()) as {
      output_text?: string;
    };

    const raw = payload.output_text?.trim() ?? "";

    if (!raw) {
      return NextResponse.json({ error: "O gerador nao retornou questoes validas." }, { status: 500 });
    }

    const parsed = JSON.parse(raw) as { questoes: QuestaoGerada[] };
    const questoes = (parsed.questoes ?? []).map((questao) => ({
      pergunta: questao.pergunta.trim(),
      explicacao: questao.explicacao?.trim() ?? "",
      alternativas: (questao.alternativas ?? []).map((alternativa) => ({
        texto: alternativa.texto.trim(),
        correta: alternativa.correta,
      })),
    }));

    const estruturaInvalida = questoes.length !== 4 || questoes.some((questao) => {
      const totalCorretas = questao.alternativas.filter((alternativa) => alternativa.correta).length;
      return !questao.pergunta || questao.alternativas.length !== 4 || totalCorretas !== 1;
    });

    if (estruturaInvalida) {
      return NextResponse.json(
        { error: "As questoes geradas vieram em formato invalido. Tente novamente com outra transcricao." },
        { status: 500 },
      );
    }

    return NextResponse.json({ questoes });
  } catch {
    return NextResponse.json({ error: "Nao foi possivel gerar as questoes agora." }, { status: 500 });
  }
}
