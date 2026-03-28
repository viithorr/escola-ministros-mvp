import { NextResponse } from "next/server";
import { criarNotificacoesParaTurma } from "@/lib/server-notificacoes";
import { getSupabaseAdmin } from "@/lib/supabase-admin";

export async function POST() {
  let supabaseAdmin;

  try {
    supabaseAdmin = getSupabaseAdmin();
  } catch (error) {
    const message = error instanceof Error ? error.message : "Configuracao do servidor indisponivel.";
    return NextResponse.json({ error: message }, { status: 500 });
  }

  const agora = new Date().toISOString();

  const { data: aulasPendentes, error: buscaError } = await supabaseAdmin
    .from("aulas")
    .select(`
      id,
      titulo,
      modulos (
        turma_id
      )
    `)
    .eq("publicado", false)
    .not("data_publicacao", "is", null)
    .lte("data_publicacao", agora);

  if (buscaError) {
    return NextResponse.json({ error: buscaError.message }, { status: 500 });
  }

  if (!aulasPendentes || aulasPendentes.length === 0) {
    return NextResponse.json({ publicados: 0 });
  }

  const ids = aulasPendentes.map((aula) => aula.id);

  const { error: updateError } = await supabaseAdmin
    .from("aulas")
    .update({
      publicado: true,
      publicado_em: agora,
    })
    .in("id", ids);

  if (updateError) {
    return NextResponse.json({ error: updateError.message }, { status: 500 });
  }

  for (const aula of aulasPendentes) {
    const modulo = Array.isArray(aula.modulos) ? aula.modulos[0] : aula.modulos;
    const turmaId = modulo?.turma_id;

    if (!turmaId) continue;

    await criarNotificacoesParaTurma({
      turmaId,
      tipo: "nova_aula",
      titulo: "Nova aula disponivel",
      mensagem: `Nova aula disponivel: ${aula.titulo}`,
      acao_tipo: "abrir_aula",
      acao_payload: { aula_id: aula.id },
    });
  }

  return NextResponse.json({ publicados: ids.length });
}
