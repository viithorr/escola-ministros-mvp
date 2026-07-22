import { NextRequest, NextResponse } from "next/server";
import { autenticarRequest } from "@/lib/server-auth";
import { registrarEventoNotificacao } from "@/lib/server-campanhas-notificacao";

export async function POST(request: NextRequest) {
  try {
    const autenticacao = await autenticarRequest(request);
    if (autenticacao.error || !autenticacao.usuario) {
      return NextResponse.json({ error: autenticacao.error }, { status: 401 });
    }

    const body = (await request.json()) as { notificacaoId?: string; evento?: "exibir" | "dispensar" };
    if (!body.notificacaoId || !body.evento || !["exibir", "dispensar"].includes(body.evento)) {
      return NextResponse.json({ error: "Parametros invalidos." }, { status: 400 });
    }

    await registrarEventoNotificacao(autenticacao.usuario.id, body.notificacaoId, body.evento);
    return NextResponse.json({ ok: true });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Nao foi possivel registrar o aviso." },
      { status: 500 },
    );
  }
}
