import { supabase } from "@/lib/supabase";

type MentorEncontro = {
  id: string;
  nome: string | null;
  email: string;
  foto_url: string | null;
};

type PresencaEncontro = {
  id: string;
  usuario_id: string;
  presente: boolean;
  confirmado_em: string | null;
};

export type EncontroAluno = {
  id: string;
  turma_id: string;
  titulo: string;
  descricao: string | null;
  data_encontro: string;
  hora_inicio: string;
  hora_fim: string | null;
  tipo: string | null;
  local: string | null;
  link_online: string | null;
  mentor_id: string | null;
  mentor: MentorEncontro | null;
  confirmados_count: number;
  presenca_id: string | null;
  presente: boolean;
  confirmado_em: string | null;
};

export type EncontroAdmin = {
  id: string;
  turma_id: string;
  titulo: string;
  descricao: string | null;
  data_encontro: string;
  hora_inicio: string;
  hora_fim: string | null;
  tipo: string | null;
  local: string | null;
  link_online: string | null;
  mentor_id: string | null;
  mentor: MentorEncontro | null;
  confirmados_count: number;
};

export type EncontroAdminDetalhe = {
  id: string;
  turma_id: string;
  titulo: string;
  descricao: string | null;
  data_encontro: string;
  hora_inicio: string;
  hora_fim: string | null;
  tipo: string | null;
  local: string | null;
  link_online: string | null;
  mentor_id: string | null;
  mentor: MentorEncontro | null;
};

export type PresencaAlunoEncontro = {
  usuario_id: string;
  nome: string | null;
  email: string;
  foto_url: string | null;
  presente: boolean;
  confirmado_em: string | null;
};

type EncontroRow = {
  id: string;
  turma_id: string;
  titulo: string;
  descricao: string | null;
  data_encontro: string;
  hora_inicio: string;
  hora_fim: string | null;
  tipo: string | null;
  local: string | null;
  link_online: string | null;
  mentor_id: string | null;
  mentor:
    | MentorEncontro
    | MentorEncontro[]
    | null;
  presencas: PresencaEncontro[] | null;
};

type EncontroAdminRow = Omit<EncontroRow, "presencas"> & {
  presencas: Array<Pick<PresencaEncontro, "id" | "presente">> | null;
};

type AlunoMatriculaRow = {
  usuario_id: string;
  usuarios:
    | {
        nome: string | null;
        email: string;
        foto_url: string | null;
      }
    | {
        nome: string | null;
        email: string;
        foto_url: string | null;
      }[]
    | null;
};

export async function listarEncontrosDaSemana(
  turmaId: string,
  usuarioId: string,
  dataInicio: string,
  dataFim: string,
) {
  const { data, error } = await supabase
    .from("encontros")
    .select(
      `
      id,
      turma_id,
      titulo,
      descricao,
      data_encontro,
      hora_inicio,
      hora_fim,
      tipo,
      local,
      link_online,
      mentor_id,
      mentor:mentor_id (
        id,
        nome,
        email,
        foto_url
      ),
      presencas (
        id,
        usuario_id,
        presente,
        confirmado_em
      )
    `,
    )
    .eq("turma_id", turmaId)
    .gte("data_encontro", dataInicio)
    .lte("data_encontro", dataFim)
    .order("data_encontro", { ascending: true })
    .order("hora_inicio", { ascending: true });

  if (error) {
    return { encontros: [] as EncontroAluno[], error };
  }

  const encontros = ((data as EncontroRow[] | null) ?? []).map((item) => {
    const mentor = Array.isArray(item.mentor) ? item.mentor[0] ?? null : item.mentor;
    const presenca = (item.presencas ?? []).find((registro) => registro.usuario_id === usuarioId) ?? null;

    return {
      id: item.id,
      turma_id: item.turma_id,
      titulo: item.titulo,
      descricao: item.descricao,
      data_encontro: item.data_encontro,
      hora_inicio: item.hora_inicio,
      hora_fim: item.hora_fim,
      tipo: item.tipo,
      local: item.local,
      link_online: item.link_online,
      mentor_id: item.mentor_id,
      mentor,
      confirmados_count: (item.presencas ?? []).filter((registro) => registro.presente).length,
      presenca_id: presenca?.id ?? null,
      presente: presenca?.presente ?? false,
      confirmado_em: presenca?.confirmado_em ?? null,
    };
  });

  return { encontros, error: null };
}

export async function salvarPresencaDoAlunoNoEncontro(
  encontroId: string,
  usuarioId: string,
  presente: boolean,
  presencaId?: string | null,
) {
  if (presencaId) {
    const { error } = await supabase
      .from("presencas")
      .update({
        presente,
        confirmado_em: presente ? new Date().toISOString() : null,
      })
      .eq("id", presencaId);

    return { error };
  }

  const { error } = await supabase.from("presencas").insert({
    encontro_id: encontroId,
    usuario_id: usuarioId,
    presente,
    confirmado_em: presente ? new Date().toISOString() : null,
  });

  return { error };
}

export async function listarEncontrosDaSemanaAdmin(
  turmaId: string,
  dataInicio: string,
  dataFim: string,
) {
  const { data, error } = await supabase
    .from("encontros")
    .select(
      `
      id,
      turma_id,
      titulo,
      descricao,
      data_encontro,
      hora_inicio,
      hora_fim,
      tipo,
      local,
      link_online,
      mentor_id,
      mentor:mentor_id (
        id,
        nome,
        email,
        foto_url
      ),
      presencas (
        id,
        presente
      )
    `,
    )
    .eq("turma_id", turmaId)
    .gte("data_encontro", dataInicio)
    .lte("data_encontro", dataFim)
    .order("data_encontro", { ascending: true })
    .order("hora_inicio", { ascending: true });

  if (error) {
    return { encontros: [] as EncontroAdmin[], error };
  }

  const encontros = ((data as EncontroAdminRow[] | null) ?? []).map((item) => {
    const mentor = Array.isArray(item.mentor) ? item.mentor[0] ?? null : item.mentor;

    return {
      id: item.id,
      turma_id: item.turma_id,
      titulo: item.titulo,
      descricao: item.descricao,
      data_encontro: item.data_encontro,
      hora_inicio: item.hora_inicio,
      hora_fim: item.hora_fim,
      tipo: item.tipo,
      local: item.local,
      link_online: item.link_online,
      mentor_id: item.mentor_id,
      mentor,
      confirmados_count: (item.presencas ?? []).filter((registro) => registro.presente).length,
    };
  });

  return { encontros, error: null };
}

export async function getEncontroByIdAdmin(encontroId: string) {
  const { data, error } = await supabase
    .from("encontros")
    .select(
      `
      id,
      turma_id,
      titulo,
      descricao,
      data_encontro,
      hora_inicio,
      hora_fim,
      tipo,
      local,
      link_online,
      mentor_id,
      mentor:mentor_id (
        id,
        nome,
        email,
        foto_url
      )
    `,
    )
    .eq("id", encontroId)
    .maybeSingle();

  if (error || !data) {
    return { encontro: null as EncontroAdminDetalhe | null, error };
  }

  const item = data as Omit<EncontroAdminRow, "presencas">;
  const mentor = Array.isArray(item.mentor) ? item.mentor[0] ?? null : item.mentor;

  return {
    encontro: {
      id: item.id,
      turma_id: item.turma_id,
      titulo: item.titulo,
      descricao: item.descricao,
      data_encontro: item.data_encontro,
      hora_inicio: item.hora_inicio,
      hora_fim: item.hora_fim,
      tipo: item.tipo,
      local: item.local,
      link_online: item.link_online,
      mentor_id: item.mentor_id,
      mentor,
    },
    error: null,
  };
}

export async function listarPresencasDoEncontro(turmaId: string, encontroId: string) {
  const [{ data: matriculas, error: matriculasError }, { data: presencas, error: presencasError }] = await Promise.all([
    supabase
      .from("alunos_turma")
      .select(
        `
        usuario_id,
        usuarios (
          nome,
          email,
          foto_url
        )
      `,
      )
      .eq("turma_id", turmaId),
    supabase
      .from("presencas")
      .select("usuario_id, presente, confirmado_em")
      .eq("encontro_id", encontroId),
  ]);

  if (matriculasError || presencasError) {
    return { alunos: [] as PresencaAlunoEncontro[], error: matriculasError || presencasError };
  }

  const presencasMap = new Map(
    ((presencas as Array<Pick<PresencaEncontro, "usuario_id" | "presente" | "confirmado_em">> | null) ?? []).map(
      (item) => [item.usuario_id, item],
    ),
  );

  const alunos = ((matriculas as AlunoMatriculaRow[] | null) ?? []).map((item) => {
    const usuario = Array.isArray(item.usuarios) ? item.usuarios[0] ?? null : item.usuarios;
    const presenca = presencasMap.get(item.usuario_id);

    return {
      usuario_id: item.usuario_id,
      nome: usuario?.nome ?? null,
      email: usuario?.email ?? "",
      foto_url: usuario?.foto_url ?? null,
      presente: presenca?.presente ?? false,
      confirmado_em: presenca?.confirmado_em ?? null,
    };
  });

  return { alunos, error: null };
}

export async function criarEncontro(payload: {
  turma_id: string;
  titulo: string;
  descricao: string | null;
  data_encontro: string;
  hora_inicio: string;
  hora_fim: string | null;
  tipo: "online" | "presencial";
  local: string | null;
  link_online: string | null;
  mentor_id: string;
}) {
  const { data, error } = await supabase
    .from("encontros")
    .insert(payload)
    .select("id")
    .single<{ id: string }>();

  return { encontroId: data?.id ?? null, error };
}

export async function atualizarEncontro(
  encontroId: string,
  payload: {
    titulo: string;
    descricao: string | null;
    data_encontro: string;
    hora_inicio: string;
    hora_fim: string | null;
    tipo: "online" | "presencial";
    local: string | null;
    link_online: string | null;
  },
) {
  const { data, error } = await supabase
    .from("encontros")
    .update(payload)
    .eq("id", encontroId)
    .select("id")
    .single<{ id: string }>();

  return { encontroId: data?.id ?? null, error };
}

export async function excluirEncontro(encontroId: string) {
  const { error } = await supabase.from("encontros").delete().eq("id", encontroId);
  return { error };
}

export async function limparPresencasDoEncontro(encontroId: string) {
  const { error } = await supabase.from("presencas").delete().eq("encontro_id", encontroId);
  return { error };
}
