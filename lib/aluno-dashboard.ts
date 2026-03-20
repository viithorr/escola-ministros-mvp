import { supabase } from "@/lib/supabase";

export type AulaAlunoDashboard = {
  id: string;
  modulo_id: string;
  titulo: string;
  video_url: string | null;
  duracao_texto: string | null;
  ordem: number | null;
  bloqueado: boolean;
  created_at: string;
  concluido: boolean;
};

export type ModuloAlunoDashboard = {
  id: string;
  turma_id: string;
  titulo: string;
  ordem: number | null;
  created_at: string;
  aulas: AulaAlunoDashboard[];
};

export type TurmaAlunoDashboard = {
  id: string;
  nome: string;
  categoria: "instrumental" | "vocal" | null;
  capa_url: string | null;
  created_at: string;
};

export async function getTurmaDoAluno(usuarioId: string) {
  const { data, error } = await supabase
    .from("alunos_turma")
    .select(
      `
      turma_id,
      turmas (
        id,
        nome,
        categoria,
        capa_url,
        created_at
      )
    `,
    )
    .eq("usuario_id", usuarioId)
    .maybeSingle<{
      turma_id: string;
      turmas:
        | TurmaAlunoDashboard
        | TurmaAlunoDashboard[]
        | null;
    }>();

  const turmaRelacionada = Array.isArray(data?.turmas) ? data?.turmas[0] : data?.turmas;

  return {
    turmaId: data?.turma_id ?? null,
    turma: turmaRelacionada ?? null,
    error,
  };
}

type ProgressoAulaAluno = {
  aula_id: string;
  concluido: boolean;
};

export async function listarConteudoDaTurmaParaAluno(turmaId: string, usuarioId: string) {
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
        video_url,
        duracao_texto,
        ordem,
        bloqueado,
        created_at
      )
    `,
    )
    .eq("turma_id", turmaId)
    .order("ordem", { ascending: true })
    .order("created_at", { ascending: true });

  if (error) {
    return { modulos: [] as ModuloAlunoDashboard[], error };
  }

  const aulaIds = (((data as ModuloAlunoDashboard[] | null) ?? []).flatMap((modulo) => modulo.aulas ?? [])).map(
    (aula) => aula.id,
  );

  let progressoPorAula = new Map<string, boolean>();

  if (aulaIds.length > 0) {
    const { data: progressoRows, error: progressoError } = await supabase
      .from("progresso_aula")
      .select("aula_id, concluido")
      .eq("usuario_id", usuarioId)
      .in("aula_id", aulaIds);

    if (progressoError) {
      return { modulos: [] as ModuloAlunoDashboard[], error: progressoError };
    }

    progressoPorAula = new Map(
      (((progressoRows as ProgressoAulaAluno[] | null) ?? []).map((row) => [row.aula_id, row.concluido])),
    );
  }

  const modulos = ((data as ModuloAlunoDashboard[] | null) ?? []).map((modulo) => ({
    ...modulo,
    aulas: [...(modulo.aulas ?? [])]
      .sort((a, b) => {
        const ordemA = a.ordem ?? 0;
        const ordemB = b.ordem ?? 0;
        if (ordemA !== ordemB) return ordemA - ordemB;
        return a.created_at.localeCompare(b.created_at);
      })
      .map((aula) => ({
        ...aula,
        concluido: progressoPorAula.get(aula.id) ?? false,
      })),
  }));

  return { modulos, error };
}
