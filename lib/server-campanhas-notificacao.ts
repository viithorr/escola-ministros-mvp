import { getSupabaseAdmin } from "@/lib/supabase-admin";

export type CampanhaNotificacaoRow = {
  id: string;
  titulo: string;
  mensagem: string;
  tema: "informacao" | "aviso" | "urgente";
  publico_tipo: "todos" | "turma" | "progresso_incompleto";
  turma_id: string | null;
  inicio_em: string;
  fim_em: string;
  frequencia_dia: number;
  exibir_sobre_tela: boolean;
  acao_rotulo: string | null;
  acao_rota: string | null;
  ativa: boolean;
  criado_em: string;
};

export function getDataLocalSaoPaulo() {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Sao_Paulo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}
async function getTurmasDoAluno(usuarioId: string) {
  const supabaseAdmin = getSupabaseAdmin();
  const { data, error } = await supabaseAdmin
    .from("alunos_turma")
    .select("turma_id")
    .eq("usuario_id", usuarioId)
    .eq("acesso_bloqueado", false);

  return {
    turmaIds: ((data as { turma_id: string }[] | null) ?? []).map((item) => item.turma_id),
    error: error?.message ?? null,
  };
}

async function alunoTemProgressoIncompleto(usuarioId: string, turmaIds: string[]) {
  if (turmaIds.length === 0) return false;

  const supabaseAdmin = getSupabaseAdmin();
  const { data: modulos, error: modulosError } = await supabaseAdmin
    .from("modulos")
    .select("id")
    .in("turma_id", turmaIds);

  if (modulosError) throw new Error(modulosError.message);

  const moduloIds = ((modulos as { id: string }[] | null) ?? []).map((item) => item.id);
  if (moduloIds.length === 0) return false;

  const { data: aulas, error: aulasError } = await supabaseAdmin
    .from("aulas")
    .select("id")
    .in("modulo_id", moduloIds)
    .eq("conta_no_progresso", true)
    .eq("bloqueado", false)
    .eq("publicado", true);

  if (aulasError) throw new Error(aulasError.message);

  const aulaIds = ((aulas as { id: string }[] | null) ?? []).map((item) => item.id);
  if (aulaIds.length === 0) return false;

  const { count, error: progressoError } = await supabaseAdmin
    .from("progresso_aula")
    .select("aula_id", { count: "exact", head: true })
    .eq("usuario_id", usuarioId)
    .eq("concluido", true)
    .in("aula_id", aulaIds);

  if (progressoError) throw new Error(progressoError.message);
  return (count ?? 0) < aulaIds.length;
}

async function alunoPertenceAoPublico(
  campanha: CampanhaNotificacaoRow,
  usuarioId: string,
  turmaIdsAluno: string[],
) {
  if (campanha.publico_tipo === "todos") return true;

  if (campanha.publico_tipo === "turma") {
    return Boolean(campanha.turma_id && turmaIdsAluno.includes(campanha.turma_id));
  }

  const turmasParaCalculo = campanha.turma_id
    ? turmaIdsAluno.filter((turmaId) => turmaId === campanha.turma_id)
    : turmaIdsAluno;

  return alunoTemProgressoIncompleto(usuarioId, turmasParaCalculo);
}

async function garantirNotificacaoDaCampanha(campanha: CampanhaNotificacaoRow, usuarioId: string) {
  const supabaseAdmin = getSupabaseAdmin();
  const { data, error } = await supabaseAdmin
    .from("notificacoes")
    .upsert(
      {
        campanha_id: campanha.id,
        usuario_id: usuarioId,
        tipo: "campanha",
        titulo: campanha.titulo,
        mensagem: campanha.mensagem,
        acao_tipo: campanha.acao_rota ? "abrir_rota" : null,
        acao_payload: campanha.acao_rota
          ? { rota: campanha.acao_rota, rotulo: campanha.acao_rotulo || "Abrir" }
          : null,
      },
      { onConflict: "campanha_id,usuario_id" },
    )
    .select("id")
    .single<{ id: string }>();

  if (error) throw new Error(error.message);
  return data.id;
}

export async function buscarCampanhaParaAluno(usuarioId: string) {
  const supabaseAdmin = getSupabaseAdmin();
  const agora = new Date().toISOString();
  const { data, error } = await supabaseAdmin
    .from("campanhas_notificacao")
    .select("*")
    .eq("ativa", true)
    .lte("inicio_em", agora)
    .gte("fim_em", agora)
    .order("criado_em", { ascending: false });

  if (error) throw new Error(error.message);

  const campanhas = (data as CampanhaNotificacaoRow[] | null) ?? [];
  const { turmaIds, error: turmasError } = await getTurmasDoAluno(usuarioId);
  if (turmasError) throw new Error(turmasError);

  const dataLocal = getDataLocalSaoPaulo();
  let campanhaParaExibir: (CampanhaNotificacaoRow & { notificacao_id: string }) | null = null;

  for (const campanha of campanhas) {
    const pertence = await alunoPertenceAoPublico(campanha, usuarioId, turmaIds);
    if (!pertence) continue;

    const notificacaoId = await garantirNotificacaoDaCampanha(campanha, usuarioId);
    if (!campanha.exibir_sobre_tela || campanhaParaExibir) continue;

    const { data: exibicoes, error: exibicoesError } = await supabaseAdmin
      .from("exibicoes_notificacao")
      .select("id, dispensado_em")
      .eq("notificacao_id", notificacaoId)
      .eq("usuario_id", usuarioId)
      .eq("data_local", dataLocal);

    if (exibicoesError) throw new Error(exibicoesError.message);

    const registros = (exibicoes as { id: string; dispensado_em: string | null }[] | null) ?? [];
    const dispensadaHoje = registros.some((item) => Boolean(item.dispensado_em));

    if (!dispensadaHoje && registros.length < campanha.frequencia_dia) {
      campanhaParaExibir = { ...campanha, notificacao_id: notificacaoId };
    }
  }

  return campanhaParaExibir;
}

export async function registrarEventoNotificacao(
  usuarioId: string,
  notificacaoId: string,
  evento: "exibir" | "dispensar",
) {
  const supabaseAdmin = getSupabaseAdmin();
  const dataLocal = getDataLocalSaoPaulo();

  const { data: notificacao, error: notificacaoError } = await supabaseAdmin
    .from("notificacoes")
    .select("id")
    .eq("id", notificacaoId)
    .eq("usuario_id", usuarioId)
    .maybeSingle();

  if (notificacaoError || !notificacao) {
    throw new Error("Notificacao nao encontrada.");
  }

  if (evento === "exibir") {
    const { error } = await supabaseAdmin.from("exibicoes_notificacao").insert({
      notificacao_id: notificacaoId,
      usuario_id: usuarioId,
      data_local: dataLocal,
    });
    if (error) throw new Error(error.message);
    return;
  }

  const { data: ultimaExibicao } = await supabaseAdmin
    .from("exibicoes_notificacao")
    .select("id")
    .eq("notificacao_id", notificacaoId)
    .eq("usuario_id", usuarioId)
    .eq("data_local", dataLocal)
    .order("exibido_em", { ascending: false })
    .limit(1)
    .maybeSingle<{ id: string }>();

  if (ultimaExibicao) {
    const { error } = await supabaseAdmin
      .from("exibicoes_notificacao")
      .update({ dispensado_em: new Date().toISOString() })
      .eq("id", ultimaExibicao.id);
    if (error) throw new Error(error.message);
    return;
  }

  const { error } = await supabaseAdmin.from("exibicoes_notificacao").insert({
    notificacao_id: notificacaoId,
    usuario_id: usuarioId,
    data_local: dataLocal,
    dispensado_em: new Date().toISOString(),
  });
  if (error) throw new Error(error.message);
}
