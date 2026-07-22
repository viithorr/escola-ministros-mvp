import { NextRequest, NextResponse } from "next/server";
import { autenticarAdmin } from "@/lib/server-auth";
import { getSupabaseAdmin } from "@/lib/supabase-admin";

const camposPermitidos = [
  "titulo",
  "mensagem",
  "tema",
  "publico_tipo",
  "turma_id",
  "inicio_em",
  "fim_em",
  "frequencia_dia",
  "exibir_sobre_tela",
  "acao_rotulo",
  "acao_rota",
  "ativa",
] as const;

export async function PATCH(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    const autenticacao = await autenticarAdmin(request);
    if (autenticacao.error) return NextResponse.json({ error: autenticacao.error }, { status: 401 });

    const { id } = await context.params;
    const body = (await request.json()) as Record<string, unknown>;
    const payload: Record<string, unknown> = { atualizado_em: new Date().toISOString() };

    for (const campo of camposPermitidos) {
      if (campo in body) payload[campo] = body[campo];
    }

    const { data, error } = await getSupabaseAdmin()
      .from("campanhas_notificacao")
      .update(payload)
      .eq("id", id)
      .select("*")
      .single();

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ campanha: data });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Nao foi possivel atualizar a campanha." },
      { status: 500 },
    );
  }
}
