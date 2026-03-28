import { NextRequest, NextResponse } from "next/server";
import { criarNotificacoesParaTurma } from "@/lib/server-notificacoes";

export async function POST(request: NextRequest) {
  const body = (await request.json()) as {
    turmaId?: string;
    tipo?: string;
    titulo?: string;
    mensagem?: string;
    acao_tipo?: string | null;
    acao_payload?: Record<string, unknown> | null;
  };

  if (!body.turmaId || !body.tipo || !body.titulo || !body.mensagem) {
    return NextResponse.json({ error: "Parametros invalidos." }, { status: 400 });
  }

  try {
    const { error } = await criarNotificacoesParaTurma({
      turmaId: body.turmaId,
      tipo: body.tipo,
      titulo: body.titulo,
      mensagem: body.mensagem,
      acao_tipo: body.acao_tipo ?? null,
      acao_payload: body.acao_payload ?? null,
    });

    if (error) {
      return NextResponse.json({ error }, { status: 500 });
    }

    return NextResponse.json({ ok: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Nao foi possivel criar as notificacoes.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
