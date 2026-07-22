import { NextRequest, NextResponse } from "next/server";
import { autenticarAdmin } from "@/lib/server-auth";
import { getSupabaseAdmin } from "@/lib/supabase-admin";

export async function GET(request: NextRequest) {
  try {
    const autenticacao = await autenticarAdmin(request);
    if (autenticacao.error) return NextResponse.json({ error: autenticacao.error }, { status: 401 });

    const { data, error } = await getSupabaseAdmin()
      .from("campanhas_notificacao")
      .select("*")
      .order("criado_em", { ascending: false });

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ campanhas: data ?? [] });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Nao foi possivel carregar as campanhas." },
      { status: 500 },
    );
  }
}
export async function POST(request: NextRequest) {
  try {
    const autenticacao = await autenticarAdmin(request);
    if (autenticacao.error || !autenticacao.usuario) {
      return NextResponse.json({ error: autenticacao.error }, { status: 401 });
    }

    const body = (await request.json()) as Record<string, unknown>;
    if (!body.titulo || !body.mensagem || !body.inicio_em || !body.fim_em) {
      return NextResponse.json({ error: "Preencha titulo, mensagem e periodo da campanha." }, { status: 400 });
    }

    const payload = {
      titulo: String(body.titulo).trim(),
      mensagem: String(body.mensagem).trim(),
      tema: body.tema,
      publico_tipo: body.publico_tipo,
      turma_id: body.turma_id || null,
      inicio_em: body.inicio_em,
      fim_em: body.fim_em,
      frequencia_dia: Number(body.frequencia_dia || 1),
      exibir_sobre_tela: body.exibir_sobre_tela !== false,
      acao_rotulo: body.acao_rotulo ? String(body.acao_rotulo).trim() : null,
      acao_rota: body.acao_rota ? String(body.acao_rota).trim() : null,
      ativa: body.ativa !== false,
      criado_por: autenticacao.usuario.id,
    };

    const { data, error } = await getSupabaseAdmin()
      .from("campanhas_notificacao")
      .insert(payload)
      .select("*")
      .single();

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ campanha: data }, { status: 201 });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Nao foi possivel criar a campanha." },
      { status: 500 },
    );
  }
}
