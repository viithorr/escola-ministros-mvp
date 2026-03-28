import { supabase } from "@/lib/supabase";
import type { AulaModulo } from "@/lib/aulas";

export type ModuloTurma = {
  id: string;
  turma_id: string;
  titulo: string;
  ordem: number | null;
  created_at: string;
};

export type ModuloComTurma = ModuloTurma & {
  turmas: {
    id: string;
    nome: string;
    categoria: "instrumental" | "vocal" | null;
    capa_url: string | null;
    codigo_entrada: string;
    created_at: string;
  } | null;
};

export type ModuloComAulas = ModuloTurma & {
  aulas: AulaModulo[];
};

export async function getModuloById(moduloId: string) {
  const { data, error } = await supabase
    .from("modulos")
    .select("id, turma_id, titulo, ordem, created_at")
    .eq("id", moduloId)
    .maybeSingle<ModuloTurma>();

  return { modulo: data, error };
}

export async function getModuloComTurma(moduloId: string) {
  const { data, error } = await supabase
    .from("modulos")
    .select(
      `
      id,
      turma_id,
      titulo,
      ordem,
      created_at,
      turmas (
        id,
        nome,
        categoria,
        capa_url,
        codigo_entrada,
        created_at
      )
    `,
    )
    .eq("id", moduloId)
    .maybeSingle<ModuloComTurma>();

  return { modulo: data, error };
}

export async function listarModulosDaTurma(turmaId: string) {
  const { data, error } = await supabase
    .from("modulos")
    .select("id, turma_id, titulo, ordem, created_at")
    .eq("turma_id", turmaId)
    .order("ordem", { ascending: true })
    .order("created_at", { ascending: true });

  return { modulos: (data as ModuloTurma[] | null) ?? [], error };
}

export async function listarModulosComAulasDaTurma(turmaId: string) {
  const { data, error } = await supabase
    .from("modulos")
    .select(
      `
      id,
      turma_id,
      titulo,
      ordem,
      created_at,
      aulas (
        id,
        modulo_id,
        titulo,
        descricao,
        video_url,
        material_url,
        duracao_texto,
        ordem,
        bloqueado,
        data_publicacao,
        data_fechamento,
        publicado,
        publicado_em,
        conta_no_progresso,
        created_at
      )
    `,
    )
    .eq("turma_id", turmaId)
    .order("ordem", { ascending: true })
    .order("created_at", { ascending: true });

  const modulos = ((data as ModuloComAulas[] | null) ?? []).map((modulo) => ({
    ...modulo,
    aulas: [...(modulo.aulas ?? [])].sort((a, b) => {
      const ordemA = a.ordem ?? 0;
      const ordemB = b.ordem ?? 0;
      if (ordemA !== ordemB) return ordemA - ordemB;
      return a.created_at.localeCompare(b.created_at);
    }),
  }));

  return { modulos, error };
}

export async function criarModulo(turmaId: string, titulo: string) {
  const { data: ultimoModulo, error: ordemError } = await supabase
    .from("modulos")
    .select("ordem")
    .eq("turma_id", turmaId)
    .order("ordem", { ascending: false })
    .limit(1)
    .maybeSingle<{ ordem: number | null }>();

  if (ordemError) {
    return { modulo: null, error: ordemError };
  }

  const proximaOrdem = (ultimoModulo?.ordem ?? 0) + 1;

  const { data, error } = await supabase
    .from("modulos")
    .insert({
      turma_id: turmaId,
      titulo: titulo.trim(),
      ordem: proximaOrdem,
    })
    .select("id, turma_id, titulo, ordem, created_at")
    .single<ModuloTurma>();

  return { modulo: data, error };
}

export async function atualizarModulo(moduloId: string, titulo: string) {
  const { data, error } = await supabase
    .from("modulos")
    .update({
      titulo: titulo.trim(),
    })
    .eq("id", moduloId)
    .select("id, turma_id, titulo, ordem, created_at")
    .single<ModuloTurma>();

  return { modulo: data, error };
}

export async function excluirModulo(moduloId: string) {
  const { error } = await supabase.from("modulos").delete().eq("id", moduloId);

  return { error };
}
