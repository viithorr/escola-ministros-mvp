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

export type AlunoDetalheProgressoAdmin = {
  usuario_id: string;
  nome: string | null;
  email: string;
  foto_url: string | null;
  aulas_concluidas: number;
  aulas_nao_feitas: number;
  total_aulas_periodo: number;
  faltas_periodo: number;
  acesso_bloqueado: boolean;
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
  acesso_bloqueado?: boolean;
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

type AulaPanoramaRow = {
  id: string;
  created_at: string;
  data_publicacao: string | null;
  publicado: boolean;
  publicado_em: string | null;
  bloqueado: boolean;
  conta_no_progresso: boolean;
};

function getUltimaDataValida(...valores: Array<string | null | undefined>) {
  return valores
    .filter((valor): valor is string => Boolean(valor))
    .sort((a, b) => new Date(b).getTime() - new Date(a).getTime())[0] ?? null;
}

function consolidarProgresso(rows: ProgressoAulaRow[]) {
  if (rows.length === 0) return null;

  const base = rows[0];

  return {
    id: base.id,
    usuario_id: base.usuario_id,
    aula_id: base.aula_id,
    concluido: rows.some((row) => row.concluido),
    data_conclusao: getUltimaDataValida(...rows.map((row) => row.data_conclusao)),
    presente: rows.some((row) => row.presente ?? false),
    confirmado_em: getUltimaDataValida(...rows.map((row) => row.confirmado_em)),
  } satisfies ProgressoAulaRow;
}

type UsuarioDetalheRow = {
  id: string;
  nome: string | null;
  email: string;
  foto_url: string | null;
};

function aulaJaFoiPublicada(aula: AulaPanoramaRow, referencia = new Date()) {
  if (aula.publicado) return true;
  if (!aula.data_publicacao) return false;
  return new Date(aula.data_publicacao).getTime() <= referencia.getTime();
}

function getPeriodoDeFaltas(mes: number, ano: number) {
  const agora = new Date();
  const inicio = new Date(ano, mes - 1, 1, 0, 0, 0, 0);
  const fimMes = new Date(ano, mes, 0, 23, 59, 59, 999);
  const fim = fimMes.getTime() > agora.getTime() ? agora : fimMes;

  const formatar = (data: Date) => {
    const yyyy = data.getFullYear();
    const mm = String(data.getMonth() + 1).padStart(2, "0");
    const dd = String(data.getDate()).padStart(2, "0");
    return `${yyyy}-${mm}-${dd}`;
  };

  return {
    inicio: formatar(inicio),
    fim: formatar(fim),
  };
}

export async function listarAtividadeDosAlunosDaAula(turmaId: string, aulaId: string) {
  const { data: matriculas, error: matriculasError } = await supabase
    .from("alunos_turma")
    .select(
      `
      usuario_id,
      acesso_bloqueado,
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
      acesso_bloqueado: item.acesso_bloqueado ?? false,
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

  const progressoAgrupado = new Map<string, ProgressoAulaRow[]>();
  (((progressoRows as ProgressoAulaRow[] | null) ?? [])).forEach((row) => {
    const atual = progressoAgrupado.get(row.usuario_id) ?? [];
    atual.push(row);
    progressoAgrupado.set(row.usuario_id, atual);
  });

  const alunos = alunosTurma.map<AlunoAtividadeAula>((aluno) => {
    const progresso = consolidarProgresso(progressoAgrupado.get(aluno.usuario_id) ?? []);

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
      acesso_bloqueado,
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
      acesso_bloqueado: item.acesso_bloqueado ?? false,
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

export async function getDetalheDoAlunoNaTurma(
  turmaId: string,
  usuarioId: string,
  mes: number,
  ano: number,
) {
  const agora = new Date();

  const [
    { data: usuario, error: usuarioError },
    { data: matricula, error: matriculaError },
    { data: modulos, error: modulosError },
    { data: encontrosPeriodo, error: encontrosError },
  ] = await Promise.all([
    supabase.from("usuarios").select("id, nome, email, foto_url").eq("id", usuarioId).maybeSingle<UsuarioDetalheRow>(),
    supabase
      .from("alunos_turma")
      .select("acesso_bloqueado")
      .eq("usuario_id", usuarioId)
      .eq("turma_id", turmaId)
      .maybeSingle<{ acesso_bloqueado: boolean }>(),
    supabase.from("modulos").select("id").eq("turma_id", turmaId),
    (() => {
      const periodo = getPeriodoDeFaltas(mes, ano);
      return supabase
        .from("encontros")
        .select("id")
        .eq("turma_id", turmaId)
        .gte("data_encontro", periodo.inicio)
        .lte("data_encontro", periodo.fim);
    })(),
  ]);

  if (usuarioError || !usuario) {
    return { detalhe: null as AlunoDetalheProgressoAdmin | null, error: usuarioError || new Error("Aluno nao encontrado.") };
  }

  if (modulosError) {
    return { detalhe: null as AlunoDetalheProgressoAdmin | null, error: modulosError };
  }

  if (matriculaError) {
    return { detalhe: null as AlunoDetalheProgressoAdmin | null, error: matriculaError };
  }

  if (encontrosError) {
    return { detalhe: null as AlunoDetalheProgressoAdmin | null, error: encontrosError };
  }

  const moduloIds = ((modulos as { id: string }[] | null) ?? []).map((item) => item.id);

  let aulasConcluidas = 0;
  let aulasNaoFeitas = 0;
  let totalAulasPeriodo = 0;

  if (moduloIds.length > 0) {
    const { data: aulas, error: aulasError } = await supabase
      .from("aulas")
      .select("id, created_at, data_publicacao, publicado, publicado_em, bloqueado, conta_no_progresso")
      .in("modulo_id", moduloIds)
      .eq("conta_no_progresso", true)
      .eq("bloqueado", false);

    if (aulasError) {
      return { detalhe: null as AlunoDetalheProgressoAdmin | null, error: aulasError };
    }

    const aulasElegiveis = ((aulas as AulaPanoramaRow[] | null) ?? []).filter((item) => aulaJaFoiPublicada(item, agora));
    totalAulasPeriodo = aulasElegiveis.length;

    if (aulasElegiveis.length > 0) {
      const aulaIds = aulasElegiveis.map((item) => item.id);
      const { data: progressoRows, error: progressoError } = await supabase
        .from("progresso_aula")
        .select("aula_id")
        .eq("usuario_id", usuarioId)
        .in("aula_id", aulaIds)
        .eq("concluido", true);

      if (progressoError) {
        return { detalhe: null as AlunoDetalheProgressoAdmin | null, error: progressoError };
      }

      aulasConcluidas = ((progressoRows as { aula_id: string }[] | null) ?? []).length;
      aulasNaoFeitas = Math.max(totalAulasPeriodo - aulasConcluidas, 0);
    }
  }

  const encontroIds = ((encontrosPeriodo as { id: string }[] | null) ?? []).map((item) => item.id);
  let faltasPeriodo = 0;

  if (encontroIds.length > 0) {
    const { data: presencas, error: presencasError } = await supabase
      .from("presencas")
      .select("encontro_id, presente")
      .eq("usuario_id", usuarioId)
      .in("encontro_id", encontroIds)
      .eq("presente", true);

    if (presencasError) {
      return { detalhe: null as AlunoDetalheProgressoAdmin | null, error: presencasError };
    }

    const presencasConfirmadas = ((presencas as { encontro_id: string; presente: boolean }[] | null) ?? []).length;
    faltasPeriodo = Math.max(encontroIds.length - presencasConfirmadas, 0);
  }

  return {
    detalhe: {
      usuario_id: usuario.id,
      nome: usuario.nome,
      email: usuario.email,
      foto_url: usuario.foto_url,
      aulas_concluidas: aulasConcluidas,
      aulas_nao_feitas: aulasNaoFeitas,
      total_aulas_periodo: totalAulasPeriodo,
      faltas_periodo: faltasPeriodo,
      acesso_bloqueado: matricula?.acesso_bloqueado ?? false,
    },
    error: null,
  };
}

export async function salvarPresencaManualDaAula(
  aulaId: string,
  usuarioId: string,
  presente: boolean,
) {
  const { data: existentes, error: buscarError } = await supabase
    .from("progresso_aula")
    .select("id, usuario_id, aula_id, concluido, data_conclusao, presente, confirmado_em")
    .eq("aula_id", aulaId)
    .eq("usuario_id", usuarioId)
    .returns<ProgressoAulaRow[]>();

  if (buscarError) {
    return { error: buscarError };
  }

  const existente = consolidarProgresso((existentes as ProgressoAulaRow[] | null) ?? []);
  const confirmadoEm = new Date().toISOString();

  if (existente) {
    const { error } = await supabase
      .from("progresso_aula")
      .update({
        presente,
        confirmado_em: presente ? confirmadoEm : existente.confirmado_em,
      })
      .eq("aula_id", aulaId)
      .eq("usuario_id", usuarioId);

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
    .returns<ProgressoAulaRow[]>();

  return { progresso: consolidarProgresso((data as ProgressoAulaRow[] | null) ?? []), error };
}

export async function salvarConclusaoDaAula(
  aulaId: string,
  usuarioId: string,
  concluido: boolean,
) {
  const { data: existentes, error: buscarError } = await supabase
    .from("progresso_aula")
    .select("id, usuario_id, aula_id, concluido, data_conclusao, presente, confirmado_em")
    .eq("aula_id", aulaId)
    .eq("usuario_id", usuarioId)
    .returns<ProgressoAulaRow[]>();

  if (buscarError) {
    return { error: buscarError };
  }

  const existente = consolidarProgresso((existentes as ProgressoAulaRow[] | null) ?? []);
  const concluidoFinal = concluido || existente?.concluido || false;
  const dataConclusao =
    existente?.data_conclusao ?? (concluidoFinal ? new Date().toISOString() : null);
  const confirmadoEm =
    existente?.confirmado_em ?? (concluidoFinal ? dataConclusao : null);
  const presente = concluidoFinal ? true : existente?.presente ?? false;

  if (existente) {
    const { error } = await supabase
      .from("progresso_aula")
      .update({
        concluido: concluidoFinal,
        data_conclusao: dataConclusao,
        presente,
        confirmado_em: confirmadoEm,
      })
      .eq("aula_id", aulaId)
      .eq("usuario_id", usuarioId);

    return { error };
  }

  const { error } = await supabase.from("progresso_aula").insert({
    usuario_id: usuarioId,
    aula_id: aulaId,
    concluido: concluidoFinal,
    data_conclusao: dataConclusao,
    presente,
    confirmado_em: confirmadoEm,
  });

  return { error };
}
