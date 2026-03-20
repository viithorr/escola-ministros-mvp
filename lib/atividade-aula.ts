import { supabase } from "@/lib/supabase";

export type AlunoAtividadeAula = {
  usuario_id: string;
  nome: string | null;
  email: string;
  foto_url: string | null;
  concluido: boolean;
  data_conclusao: string | null;
  presente: boolean;
  confirmado_em: string | null;
};

export type AlunoProgressoTurma = {
  usuario_id: string;
  nome: string | null;
  email: string;
  foto_url: string | null;
  aulas_concluidas: number;
  total_aulas_liberadas: number;
  progresso_percentual: number;
};

type ProgressoAulaRow = {
  id: string;
  usuario_id: string;
  aula_id: string;
  concluido: boolean;
  data_conclusao: string | null;
  presente: boolean | null;
  confirmado_em: string | null;
};

type AlunoTurmaRow = {
  usuario_id: string;
  usuarios:
    | {
        id: string;
        nome: string | null;
        email: string;
        foto_url: string | null;
      }
    | {
        id: string;
        nome: string | null;
        email: string;
        foto_url: string | null;
      }[]
    | null;
};

export async function listarAtividadeDosAlunosDaAula(turmaId: string, aulaId: string) {
  const { data: matriculas, error: matriculasError } = await supabase
    .from("alunos_turma")
    .select(
      `
      usuario_id,
      usuarios (
        id,
        nome,
        email,
        foto_url
      )
    `,
    )
    .eq("turma_id", turmaId)
    .order("data_entrada", { ascending: true });

  if (matriculasError) {
    return { alunos: [] as AlunoAtividadeAula[], error: matriculasError };
  }

  const alunosTurma = ((matriculas as AlunoTurmaRow[] | null) ?? []).map((item) => {
    const usuario = Array.isArray(item.usuarios) ? item.usuarios[0] ?? null : item.usuarios;
    return {
      usuario_id: item.usuario_id,
      nome: usuario?.nome ?? null,
      email: usuario?.email ?? "",
      foto_url: usuario?.foto_url ?? null,
    };
  });

  if (alunosTurma.length === 0) {
    return { alunos: [] as AlunoAtividadeAula[], error: null };
  }

  const usuarioIds = alunosTurma.map((aluno) => aluno.usuario_id);

  const { data: progressoRows, error: progressoError } = await supabase
    .from("progresso_aula")
    .select("id, usuario_id, aula_id, concluido, data_conclusao, presente, confirmado_em")
    .eq("aula_id", aulaId)
    .in("usuario_id", usuarioIds);

  if (progressoError) {
    return { alunos: [] as AlunoAtividadeAula[], error: progressoError };
  }

  const progressoPorUsuario = new Map<string, ProgressoAulaRow>(
    (((progressoRows as ProgressoAulaRow[] | null) ?? []).map((row) => [row.usuario_id, row])),
  );

  const alunos = alunosTurma.map<AlunoAtividadeAula>((aluno) => {
    const progresso = progressoPorUsuario.get(aluno.usuario_id);

    return {
      usuario_id: aluno.usuario_id,
      nome: aluno.nome,
      email: aluno.email,
      foto_url: aluno.foto_url,
      concluido: progresso?.concluido ?? false,
      data_conclusao: progresso?.data_conclusao ?? null,
      presente: progresso?.presente ?? false,
      confirmado_em: progresso?.confirmado_em ?? null,
    };
  });

  return { alunos, error: null };
}

export async function listarProgressoDosAlunosDaTurma(turmaId: string) {
  const { data: matriculas, error: matriculasError } = await supabase
    .from("alunos_turma")
    .select(
      `
      usuario_id,
      usuarios (
        id,
        nome,
        email,
        foto_url
      )
    `,
    )
    .eq("turma_id", turmaId)
    .order("data_entrada", { ascending: true });

  if (matriculasError) {
    return { alunos: [] as AlunoProgressoTurma[], error: matriculasError };
  }

  const alunosTurma = ((matriculas as AlunoTurmaRow[] | null) ?? []).map((item) => {
    const usuario = Array.isArray(item.usuarios) ? item.usuarios[0] ?? null : item.usuarios;
    return {
      usuario_id: item.usuario_id,
      nome: usuario?.nome ?? null,
      email: usuario?.email ?? "",
      foto_url: usuario?.foto_url ?? null,
    };
  });

  if (alunosTurma.length === 0) {
    return { alunos: [] as AlunoProgressoTurma[], error: null };
  }

  const { data: modulos, error: modulosError } = await supabase.from("modulos").select("id").eq("turma_id", turmaId);

  if (modulosError) {
    return { alunos: [] as AlunoProgressoTurma[], error: modulosError };
  }

  const moduloIds = ((modulos as { id: string }[] | null) ?? []).map((modulo) => modulo.id);

  if (moduloIds.length === 0) {
    return {
      alunos: alunosTurma.map((aluno) => ({
        ...aluno,
        aulas_concluidas: 0,
        total_aulas_liberadas: 0,
        progresso_percentual: 0,
      })),
      error: null,
    };
  }

  const { data: aulas, error: aulasError } = await supabase
    .from("aulas")
    .select("id")
    .in("modulo_id", moduloIds)
    .eq("bloqueado", false);

  if (aulasError) {
    return { alunos: [] as AlunoProgressoTurma[], error: aulasError };
  }

  const aulaIds = ((aulas as { id: string }[] | null) ?? []).map((aula) => aula.id);
  const totalAulasLiberadas = aulaIds.length;

  if (aulaIds.length === 0) {
    return {
      alunos: alunosTurma.map((aluno) => ({
        ...aluno,
        aulas_concluidas: 0,
        total_aulas_liberadas: 0,
        progresso_percentual: 0,
      })),
      error: null,
    };
  }

  const usuarioIds = alunosTurma.map((aluno) => aluno.usuario_id);

  const { data: progressoRows, error: progressoError } = await supabase
    .from("progresso_aula")
    .select("usuario_id, aula_id, concluido")
    .in("usuario_id", usuarioIds)
    .in("aula_id", aulaIds)
    .eq("concluido", true);

  if (progressoError) {
    return { alunos: [] as AlunoProgressoTurma[], error: progressoError };
  }

  const concluidasPorUsuario = new Map<string, number>();

  (((progressoRows as { usuario_id: string; aula_id: string; concluido: boolean }[] | null) ?? [])).forEach(
    (row) => {
      concluidasPorUsuario.set(row.usuario_id, (concluidasPorUsuario.get(row.usuario_id) ?? 0) + 1);
    },
  );

  return {
    alunos: alunosTurma.map((aluno) => {
      const aulasConcluidas = concluidasPorUsuario.get(aluno.usuario_id) ?? 0;
      const progressoPercentual =
        totalAulasLiberadas > 0 ? Math.round((aulasConcluidas / totalAulasLiberadas) * 100) : 0;

      return {
        ...aluno,
        aulas_concluidas: aulasConcluidas,
        total_aulas_liberadas: totalAulasLiberadas,
        progresso_percentual: progressoPercentual,
      };
    }),
    error: null,
  };
}

export async function salvarPresencaManualDaAula(
  aulaId: string,
  usuarioId: string,
  presente: boolean,
) {
  const { data: existente, error: buscarError } = await supabase
    .from("progresso_aula")
    .select("id, concluido, data_conclusao")
    .eq("aula_id", aulaId)
    .eq("usuario_id", usuarioId)
    .maybeSingle<{ id: string; concluido: boolean; data_conclusao: string | null }>();

  if (buscarError) {
    return { error: buscarError };
  }

  const confirmadoEm = new Date().toISOString();

  if (existente) {
    const { error } = await supabase
      .from("progresso_aula")
      .update({
        presente,
        confirmado_em: confirmadoEm,
      })
      .eq("id", existente.id);

    return { error };
  }

  const { error } = await supabase.from("progresso_aula").insert({
    usuario_id: usuarioId,
    aula_id: aulaId,
    concluido: false,
    data_conclusao: null,
    presente,
    confirmado_em: confirmadoEm,
  });

  return { error };
}

export async function getProgressoDoAlunoNaAula(aulaId: string, usuarioId: string) {
  const { data, error } = await supabase
    .from("progresso_aula")
    .select("id, usuario_id, aula_id, concluido, data_conclusao, presente, confirmado_em")
    .eq("aula_id", aulaId)
    .eq("usuario_id", usuarioId)
    .maybeSingle<ProgressoAulaRow>();

  return { progresso: data, error };
}

export async function salvarConclusaoDaAula(
  aulaId: string,
  usuarioId: string,
  concluido: boolean,
) {
  const { data: existente, error: buscarError } = await supabase
    .from("progresso_aula")
    .select("id, presente, confirmado_em")
    .eq("aula_id", aulaId)
    .eq("usuario_id", usuarioId)
    .maybeSingle<{ id: string; presente: boolean | null; confirmado_em: string | null }>();

  if (buscarError) {
    return { error: buscarError };
  }

  const dataConclusao = concluido ? new Date().toISOString() : null;

  if (existente) {
    const { error } = await supabase
      .from("progresso_aula")
      .update({
        concluido,
        data_conclusao: dataConclusao,
        presente: concluido ? true : existente.presente ?? false,
        confirmado_em: concluido ? dataConclusao : existente.confirmado_em,
      })
      .eq("id", existente.id);

    return { error };
  }

  const { error } = await supabase.from("progresso_aula").insert({
    usuario_id: usuarioId,
    aula_id: aulaId,
    concluido,
    data_conclusao: dataConclusao,
    presente: concluido,
    confirmado_em: concluido ? dataConclusao : null,
  });

  return { error };
}
