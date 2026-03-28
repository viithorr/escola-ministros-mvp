import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase-admin";

export async function PATCH(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  const { id: usuarioId } = await context.params;
  const body = (await request.json()) as { turmaId?: string; acessoBloqueado?: boolean };

  if (!body.turmaId || typeof body.acessoBloqueado !== "boolean") {
    return NextResponse.json({ error: "Parametros invalidos." }, { status: 400 });
  }

  let supabaseAdmin;

  try {
    supabaseAdmin = getSupabaseAdmin();
  } catch (error) {
    const message = error instanceof Error ? error.message : "Configuracao do servidor indisponivel.";
    return NextResponse.json({ error: message }, { status: 500 });
  }

  const { error } = await supabaseAdmin
    .from("alunos_turma")
    .update({ acesso_bloqueado: body.acessoBloqueado })
    .eq("usuario_id", usuarioId)
    .eq("turma_id", body.turmaId);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}

export async function DELETE(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  const { id: usuarioId } = await context.params;
  const { searchParams } = new URL(request.url);
  const turmaId = searchParams.get("turma");

  if (!turmaId) {
    return NextResponse.json({ error: "Turma nao informada." }, { status: 400 });
  }

  let supabaseAdmin;

  try {
    supabaseAdmin = getSupabaseAdmin();
  } catch (error) {
    const message = error instanceof Error ? error.message : "Configuracao do servidor indisponivel.";
    return NextResponse.json({ error: message }, { status: 500 });
  }

  const [{ data: modulos, error: modulosError }, { data: encontros, error: encontrosError }] = await Promise.all([
    supabaseAdmin.from("modulos").select("id").eq("turma_id", turmaId),
    supabaseAdmin.from("encontros").select("id").eq("turma_id", turmaId),
  ]);

  if (modulosError || encontrosError) {
    return NextResponse.json({ error: modulosError?.message || encontrosError?.message }, { status: 500 });
  }

  const moduloIds = ((modulos as { id: string }[] | null) ?? []).map((item) => item.id);
  const encontroIds = ((encontros as { id: string }[] | null) ?? []).map((item) => item.id);

  if (moduloIds.length > 0) {
    const { data: aulas, error: aulasError } = await supabaseAdmin
      .from("aulas")
      .select("id")
      .in("modulo_id", moduloIds);

    if (aulasError) {
      return NextResponse.json({ error: aulasError.message }, { status: 500 });
    }

    const aulaIds = ((aulas as { id: string }[] | null) ?? []).map((item) => item.id);

    if (aulaIds.length > 0) {
      const { error: progressoError } = await supabaseAdmin
        .from("progresso_aula")
        .delete()
        .eq("usuario_id", usuarioId)
        .in("aula_id", aulaIds);

      if (progressoError) {
        return NextResponse.json({ error: progressoError.message }, { status: 500 });
      }
    }
  }

  if (encontroIds.length > 0) {
    const { error: presencasError } = await supabaseAdmin
      .from("presencas")
      .delete()
      .eq("usuario_id", usuarioId)
      .in("encontro_id", encontroIds);

    if (presencasError) {
      return NextResponse.json({ error: presencasError.message }, { status: 500 });
    }
  }

  const { error: matriculaError } = await supabaseAdmin
    .from("alunos_turma")
    .delete()
    .eq("usuario_id", usuarioId)
    .eq("turma_id", turmaId);

  if (matriculaError) {
    return NextResponse.json({ error: matriculaError.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
