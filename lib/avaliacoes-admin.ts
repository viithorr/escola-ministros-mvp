import { supabase } from "@/lib/supabase";

export type AvaliacaoResumoTurma = {
  avaliacao_id: string;
  aula_id: string;
  aula_titulo: string;
  modulo_titulo: string | null;
  total_alunos: number;
  fizeram: number;
  aprovados: number;
  pendentes: number;
  media_ultima_nota: number | null;
  total_tentativas: number;
};

export type AvaliacaoAlunoResumo = {
  usuario_id: string;
  nome: string | null;
  email: string;
  foto_url: string | null;
  fez: boolean;
  aprovou: boolean;
  ultima_nota: number | null;
  tentativas: number;
  finalizada_em: string | null;
};

export type AvaliacaoDetalheTurma = {
  avaliacao_id: string;
  aula_id: string;
  aula_titulo: string;
  modulo_titulo: string | null;
  total_alunos: number;
  fizeram: number;
  aprovados: number;
  pendentes: number;
  media_ultima_nota: number | null;
  alunos: AvaliacaoAlunoResumo[];
};

type MatriculaRow = {
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

type AvaliacaoTurmaRow = {
  id: string;
  aula_id: string;
  aulas:
    | {
        id: string;
        titulo: string;
        modulos:
          | {
              id: string;
              titulo: string;
            }
          | {
              id: string;
              titulo: string;
            }[]
          | null;
      }
    | {
        id: string;
        titulo: string;
        modulos:
          | {
              id: string;
              titulo: string;
            }
          | {
              id: string;
              titulo: string;
            }[]
          | null;
      }[]
    | null;
};

type TentativaRow = {
  avaliacao_id: string;
  usuario_id: string;
  nota_percentual: number;
  acertou_tudo: boolean;
  finalizada_em: string;
};

function normalizarUsuario(row: MatriculaRow) {
  const usuario = Array.isArray(row.usuarios) ? row.usuarios[0] ?? null : row.usuarios;

  return {
    usuario_id: row.usuario_id,
    nome: usuario?.nome ?? null,
    email: usuario?.email ?? "",
    foto_url: usuario?.foto_url ?? null,
  };
}

function normalizarAula(row: AvaliacaoTurmaRow) {
  const aula = Array.isArray(row.aulas) ? row.aulas[0] ?? null : row.aulas;
  const modulo = aula?.modulos ? (Array.isArray(aula.modulos) ? aula.modulos[0] ?? null : aula.modulos) : null;

  return {
    aula_id: aula?.id ?? row.aula_id,
    aula_titulo: aula?.titulo ?? "Aula",
    modulo_titulo: modulo?.titulo ?? null,
  };
}

function calcularResumo(
  avaliacaoId: string,
  totalAlunos: number,
  tentativas: TentativaRow[],
) {
  const mapaUltimaTentativa = new Map<string, TentativaRow>();
  const mapaTentativas = new Map<string, number>();

  tentativas.forEach((tentativa) => {
    mapaTentativas.set(tentativa.usuario_id, (mapaTentativas.get(tentativa.usuario_id) ?? 0) + 1);

    const atual = mapaUltimaTentativa.get(tentativa.usuario_id);
    if (!atual || new Date(tentativa.finalizada_em).getTime() > new Date(atual.finalizada_em).getTime()) {
      mapaUltimaTentativa.set(tentativa.usuario_id, tentativa);
    }
  });

  const ultimas = Array.from(mapaUltimaTentativa.values());
  const fizeram = ultimas.length;
  const aprovados = ultimas.filter((tentativa) => tentativa.acertou_tudo).length;
  const somaNotas = ultimas.reduce((acc, tentativa) => acc + tentativa.nota_percentual, 0);

  return {
    avaliacao_id: avaliacaoId,
    total_alunos: totalAlunos,
    fizeram,
    aprovados,
    pendentes: Math.max(totalAlunos - aprovados, 0),
    media_ultima_nota: fizeram > 0 ? Math.round(somaNotas / fizeram) : null,
    total_tentativas: tentativas.length,
    mapaUltimaTentativa,
    mapaTentativas,
  };
}

export async function listarAvaliacoesDaTurma(turmaId: string) {
  const [{ data: matriculas, error: matriculasError }, { data: modulos, error: modulosError }] = await Promise.all([
    supabase
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
      .eq("turma_id", turmaId),
    supabase.from("modulos").select("id").eq("turma_id", turmaId),
  ]);

  if (matriculasError) {
    return { avaliacoes: [] as AvaliacaoResumoTurma[], error: matriculasError };
  }

  if (modulosError) {
    return { avaliacoes: [] as AvaliacaoResumoTurma[], error: modulosError };
  }

  const alunos = ((matriculas as MatriculaRow[] | null) ?? []).map(normalizarUsuario);
  const moduloIds = ((modulos as { id: string }[] | null) ?? []).map((modulo) => modulo.id);

  if (moduloIds.length === 0) {
    return { avaliacoes: [] as AvaliacaoResumoTurma[], error: null };
  }

  const { data: aulas, error: aulasError } = await supabase.from("aulas").select("id").in("modulo_id", moduloIds);

  if (aulasError) {
    return { avaliacoes: [] as AvaliacaoResumoTurma[], error: aulasError };
  }

  const aulaIds = ((aulas as { id: string }[] | null) ?? []).map((aula) => aula.id);

  if (aulaIds.length === 0) {
    return { avaliacoes: [] as AvaliacaoResumoTurma[], error: null };
  }

  const { data: avaliacoes, error: avaliacoesError } = await supabase
    .from("avaliacoes_aula")
    .select(
      `
      id,
      aula_id,
      aulas (
        id,
        titulo,
        modulos (
          id,
          titulo
        )
      )
    `,
    )
    .eq("ativa", true)
    .in("aula_id", aulaIds);

  if (avaliacoesError) {
    return { avaliacoes: [] as AvaliacaoResumoTurma[], error: avaliacoesError };
  }

  const avaliacoesDaTurma = (avaliacoes as AvaliacaoTurmaRow[] | null) ?? [];

  if (avaliacoesDaTurma.length === 0) {
    return { avaliacoes: [] as AvaliacaoResumoTurma[], error: null };
  }

  const usuarioIds = alunos.map((aluno) => aluno.usuario_id);
  const avaliacaoIds = avaliacoesDaTurma.map((avaliacao) => avaliacao.id);

  const { data: tentativas, error: tentativasError } = await supabase
    .from("tentativas_avaliacao_aluno")
    .select("avaliacao_id, usuario_id, nota_percentual, acertou_tudo, finalizada_em")
    .in("avaliacao_id", avaliacaoIds)
    .in("usuario_id", usuarioIds);

  if (tentativasError) {
    return { avaliacoes: [] as AvaliacaoResumoTurma[], error: tentativasError };
  }

  const tentativasPorAvaliacao = new Map<string, TentativaRow[]>();

  ((tentativas as TentativaRow[] | null) ?? []).forEach((tentativa) => {
    const atuais = tentativasPorAvaliacao.get(tentativa.avaliacao_id) ?? [];
    atuais.push(tentativa);
    tentativasPorAvaliacao.set(tentativa.avaliacao_id, atuais);
  });

  const resumo = avaliacoesDaTurma.map((avaliacao) => {
    const aula = normalizarAula(avaliacao);
    const metricas = calcularResumo(avaliacao.id, alunos.length, tentativasPorAvaliacao.get(avaliacao.id) ?? []);

    return {
      ...metricas,
      aula_id: aula.aula_id,
      aula_titulo: aula.aula_titulo,
      modulo_titulo: aula.modulo_titulo,
    };
  });

  return {
    avaliacoes: resumo.sort((a, b) => a.aula_titulo.localeCompare(b.aula_titulo, "pt-BR")),
    error: null,
  };
}

export async function getDetalheDaAvaliacaoNaTurma(turmaId: string, avaliacaoId: string) {
  const [{ data: matriculas, error: matriculasError }, { data: modulos, error: modulosError }] = await Promise.all([
    supabase
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
      .eq("turma_id", turmaId),
    supabase.from("modulos").select("id").eq("turma_id", turmaId),
  ]);

  if (matriculasError) {
    return { detalhe: null as AvaliacaoDetalheTurma | null, error: matriculasError };
  }

  if (modulosError) {
    return { detalhe: null as AvaliacaoDetalheTurma | null, error: modulosError };
  }

  const moduloIds = ((modulos as { id: string }[] | null) ?? []).map((modulo) => modulo.id);

  if (moduloIds.length === 0) {
    return { detalhe: null as AvaliacaoDetalheTurma | null, error: null };
  }

  const { data: aulas, error: aulasError } = await supabase.from("aulas").select("id").in("modulo_id", moduloIds);

  if (aulasError) {
    return { detalhe: null as AvaliacaoDetalheTurma | null, error: aulasError };
  }

  const aulaIds = ((aulas as { id: string }[] | null) ?? []).map((aula) => aula.id);

  if (aulaIds.length === 0) {
    return { detalhe: null as AvaliacaoDetalheTurma | null, error: null };
  }

  const { data: avaliacao, error: avaliacaoError } = await supabase
    .from("avaliacoes_aula")
    .select(
      `
      id,
      aula_id,
      aulas (
        id,
        titulo,
        modulos (
          id,
          titulo
        )
      )
    `,
    )
    .eq("id", avaliacaoId)
    .eq("ativa", true)
    .in("aula_id", aulaIds)
    .maybeSingle<AvaliacaoTurmaRow>();

  if (avaliacaoError || !avaliacao) {
    return { detalhe: null as AvaliacaoDetalheTurma | null, error: avaliacaoError };
  }

  const alunos = ((matriculas as MatriculaRow[] | null) ?? []).map(normalizarUsuario);
  const usuarioIds = alunos.map((aluno) => aluno.usuario_id);

  const { data: tentativas, error: tentativasError } = await supabase
    .from("tentativas_avaliacao_aluno")
    .select("avaliacao_id, usuario_id, nota_percentual, acertou_tudo, finalizada_em")
    .eq("avaliacao_id", avaliacaoId)
    .in("usuario_id", usuarioIds)
    .order("finalizada_em", { ascending: false });

  if (tentativasError) {
    return { detalhe: null as AvaliacaoDetalheTurma | null, error: tentativasError };
  }

  const listaTentativas = (tentativas as TentativaRow[] | null) ?? [];
  const metricas = calcularResumo(avaliacaoId, alunos.length, listaTentativas);
  const alunosDetalhe = alunos
    .map<AvaliacaoAlunoResumo>((aluno) => {
      const ultimaTentativa = metricas.mapaUltimaTentativa.get(aluno.usuario_id) ?? null;

      return {
        usuario_id: aluno.usuario_id,
        nome: aluno.nome,
        email: aluno.email,
        foto_url: aluno.foto_url,
        fez: Boolean(ultimaTentativa),
        aprovou: ultimaTentativa?.acertou_tudo ?? false,
        ultima_nota: ultimaTentativa?.nota_percentual ?? null,
        tentativas: metricas.mapaTentativas.get(aluno.usuario_id) ?? 0,
        finalizada_em: ultimaTentativa?.finalizada_em ?? null,
      };
    })
    .sort((a, b) => {
      if (a.aprovou !== b.aprovou) return a.aprovou ? 1 : -1;
      if (a.fez !== b.fez) return a.fez ? -1 : 1;
      return (a.nome || a.email).localeCompare(b.nome || b.email, "pt-BR");
    });

  const aula = normalizarAula(avaliacao);

  return {
    detalhe: {
      avaliacao_id: avaliacaoId,
      aula_id: aula.aula_id,
      aula_titulo: aula.aula_titulo,
      modulo_titulo: aula.modulo_titulo,
      total_alunos: metricas.total_alunos,
      fizeram: metricas.fizeram,
      aprovados: metricas.aprovados,
      pendentes: metricas.pendentes,
      media_ultima_nota: metricas.media_ultima_nota,
      alunos: alunosDetalhe,
    },
    error: null,
  };
}
