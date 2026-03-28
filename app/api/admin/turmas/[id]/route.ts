import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase-admin";

export async function PATCH(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  const { id: turmaId } = await context.params;
  const body = (await request.json()) as { arquivada?: boolean };

  if (typeof body.arquivada !== "boolean") {
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
    .from("turmas")
    .update({
      arquivada: body.arquivada,
      arquivada_em: body.arquivada ? new Date().toISOString() : null,
    })
    .eq("id", turmaId);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}

export async function DELETE(_request: NextRequest, context: { params: Promise<{ id: string }> }) {
  const { id: turmaId } = await context.params;

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
      const [{ error: progressoError }, { error: materiaisError }, { error: deleteAulasError }] = await Promise.all([
        supabaseAdmin.from("progresso_aula").delete().in("aula_id", aulaIds),
        supabaseAdmin.from("materiais").delete().in("aula_id", aulaIds),
        supabaseAdmin.from("aulas").delete().in("id", aulaIds),
      ]);

      if (progressoError || materiaisError || deleteAulasError) {
        return NextResponse.json(
          { error: progressoError?.message || materiaisError?.message || deleteAulasError?.message },
          { status: 500 },
        );
      }
    }

    const { error: deleteModulosError } = await supabaseAdmin.from("modulos").delete().in("id", moduloIds);

    if (deleteModulosError) {
      return NextResponse.json({ error: deleteModulosError.message }, { status: 500 });
    }
  }

  if (encontroIds.length > 0) {
    const [{ error: presencasError }, { error: deleteEncontrosError }] = await Promise.all([
      supabaseAdmin.from("presencas").delete().in("encontro_id", encontroIds),
      supabaseAdmin.from("encontros").delete().in("id", encontroIds),
    ]);

    if (presencasError || deleteEncontrosError) {
      return NextResponse.json(
        { error: presencasError?.message || deleteEncontrosError?.message },
        { status: 500 },
      );
    }
  }

  const { error: matriculasError } = await supabaseAdmin.from("alunos_turma").delete().eq("turma_id", turmaId);

  if (matriculasError) {
    return NextResponse.json({ error: matriculasError.message }, { status: 500 });
  }

  const { error: turmaError } = await supabaseAdmin.from("turmas").delete().eq("id", turmaId);

  if (turmaError) {
    return NextResponse.json({ error: turmaError.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
