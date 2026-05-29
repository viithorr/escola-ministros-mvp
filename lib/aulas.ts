import { supabase } from "@/lib/supabase";

export type AulaModulo = {
  id: string;
  modulo_id: string;
  titulo: string;
  descricao: string | null;
  video_url: string | null;
  material_url: string | null;
  duracao_texto: string | null;
  ordem: number | null;
  bloqueado: boolean;
  data_publicacao: string | null;
  data_fechamento: string | null;
  publicado: boolean;
  publicado_em: string | null;
  conta_no_progresso: boolean;
  created_at: string;
};

export type MaterialAula = {
  id: string;
  aula_id: string;
  titulo: string;
  arquivo_url: string;
  created_at: string;
};

export type AulaComModuloTurma = AulaModulo & {
  modulos: {
    id: string;
    turma_id: string;
    titulo: string;
    ordem: number | null;
    created_at: string;
    turmas: {
      id: string;
      nome: string;
      categoria: "instrumental" | "vocal" | null;
      capa_url: string | null;
      codigo_entrada: string;
      arquivada: boolean;
      arquivada_em: string | null;
      created_at: string;
    } | null;
  } | null;
};

export function aulaJaFoiPublicadaParaAluno(
  aula: Pick<AulaModulo, "publicado" | "data_publicacao" | "data_fechamento">,
  now = new Date(),
) {
  const timestampAtual = now.getTime();
  return aula.publicado || (aula.data_publicacao ? new Date(aula.data_publicacao).getTime() <= timestampAtual : false);
}

export function aulaPrazoExpiradoParaAluno(
  aula: Pick<AulaModulo, "data_fechamento">,
  now = new Date(),
) {
  if (!aula.data_fechamento) {
    return false;
  }

  return new Date(aula.data_fechamento).getTime() < now.getTime();
}

export function aulaEstaDisponivelParaAluno(
  aula: Pick<AulaModulo, "publicado" | "data_publicacao" | "data_fechamento">,
  now = new Date(),
) {
  const publicada = aulaJaFoiPublicadaParaAluno(aula, now);

  if (!publicada) {
    return false;
  }

  return !aulaPrazoExpiradoParaAluno(aula, now);
}

export function getFimDaSemanaParaPublicacao(dataBase: string | Date) {
  const data = typeof dataBase === "string" ? new Date(dataBase) : new Date(dataBase);
  const dia = data.getDay();
  const diasAteSabado = dia === 6 ? 0 : 6 - dia;
  const fim = new Date(data);
  fim.setDate(data.getDate() + diasAteSabado);
  fim.setHours(23, 59, 59, 999);
  return fim.toISOString();
}

function montarTituloMaterialLegado(arquivoUrl: string, indice: number) {
  try {
    const parsedUrl = new URL(arquivoUrl);
    const ultimoTrecho = parsedUrl.pathname.split("/").filter(Boolean).pop();

    if (ultimoTrecho) {
      return decodeURIComponent(ultimoTrecho).replace(/\.[a-z0-9]+$/i, "");
    }
  } catch {
    // Ignora e usa fallback abaixo.
  }

  return `Material complementar ${indice + 1}`;
}

function normalizarMaterialUrl(arquivoUrl: string) {
  const valor = arquivoUrl.trim();

  try {
    return new URL(valor).toString();
  } catch {
    return valor;
  }
}

function extrairUrlsLegadas(materialUrl: string | null) {
  if (!materialUrl?.trim()) return [];

  return materialUrl
    .split(/\r?\n|[,;]+/)
    .map((item) => item.trim())
    .filter(Boolean);
}

async function sincronizarCampoLegadoMaterialUrl(
  aulaId: string,
  materiais: Array<{ arquivo_url: string }>,
) {
  const materialUrl = materiais.length
    ? materiais
        .map((material) => normalizarMaterialUrl(material.arquivo_url))
        .filter(Boolean)
        .join("\n")
    : null;

  const { error } = await supabase
    .from("aulas")
    .update({
      material_url: materialUrl,
    })
    .eq("id", aulaId);

  return { error };
}

function getExtensao(file: File, fallback: string) {
  return file.name.split(".").pop()?.toLowerCase() || fallback;
}

export function formatarDuracao(segundos: number) {
  const minutos = Math.floor(segundos / 60);
  const restoSegundos = Math.floor(segundos % 60);

  return `${String(minutos).padStart(2, "0")}:${String(restoSegundos).padStart(2, "0")}`;
}

export async function uploadVideoAula(file: File) {
  const extensao = getExtensao(file, "mp4");
  const nomeArquivo = `${Date.now()}-${crypto.randomUUID()}.${extensao}`;
  const caminho = `aulas/${nomeArquivo}`;

  console.error("[uploadVideoAula] Iniciando upload", {
    nome: file.name,
    tamanho: file.size,
    tipo: file.type,
    caminho,
  });

  const { error } = await supabase.storage.from("lesson-videos").upload(caminho, file, {
    upsert: false,
  });

  if (error) {
    console.error("[uploadVideoAula] Falha no upload", {
      mensagem: error.message,
      nome: error.name,
      statusCode: "statusCode" in error ? error.statusCode : undefined,
      error,
    });
    return { videoUrl: null, error };
  }

  const { data } = supabase.storage.from("lesson-videos").getPublicUrl(caminho);

  console.error("[uploadVideoAula] Upload concluido", {
    caminho,
    publicUrl: data.publicUrl,
  });

  return { videoUrl: data.publicUrl, error: null };
}

export async function uploadMaterialAula(file: File) {
  const extensao = getExtensao(file, "pdf");
  const nomeArquivo = `${Date.now()}-${crypto.randomUUID()}.${extensao}`;
  const caminho = `materiais/${nomeArquivo}`;

  const { error } = await supabase.storage.from("lesson-materials").upload(caminho, file, {
    upsert: false,
  });

  if (error) {
    return { arquivoUrl: null, error };
  }

  const { data } = supabase.storage.from("lesson-materials").getPublicUrl(caminho);

  return { arquivoUrl: data.publicUrl, error: null };
}

export async function criarAula(
  moduloId: string,
  titulo: string,
  videoUrl?: string | null,
  duracaoTexto?: string | null,
  publicacao?: {
    data_publicacao?: string | null;
    data_fechamento?: string | null;
    publicado?: boolean;
    publicado_em?: string | null;
    conta_no_progresso?: boolean;
  },
) {
  const { data: ultimaAula, error: ordemError } = await supabase
    .from("aulas")
    .select("ordem")
    .eq("modulo_id", moduloId)
    .order("ordem", { ascending: false })
    .limit(1)
    .maybeSingle<{ ordem: number | null }>();

  if (ordemError) {
    return { aula: null, error: ordemError };
  }

  const proximaOrdem = (ultimaAula?.ordem ?? 0) + 1;

  const { data, error } = await supabase
    .from("aulas")
    .insert({
      modulo_id: moduloId,
      titulo: titulo.trim(),
      video_url: videoUrl ?? null,
      duracao_texto: duracaoTexto ?? null,
      ordem: proximaOrdem,
      bloqueado: false,
      data_publicacao: publicacao?.data_publicacao ?? null,
      data_fechamento: publicacao?.data_fechamento ?? null,
      publicado: publicacao?.publicado ?? true,
      publicado_em: publicacao?.publicado_em ?? null,
      conta_no_progresso: publicacao?.conta_no_progresso ?? true,
    })
    .select(
      "id, modulo_id, titulo, descricao, video_url, material_url, duracao_texto, ordem, bloqueado, data_publicacao, data_fechamento, publicado, publicado_em, conta_no_progresso, created_at",
    )
    .single<AulaModulo>();

  return { aula: data, error };
}

export async function getAulaById(aulaId: string) {
  const { data, error } = await supabase
    .from("aulas")
    .select(
      "id, modulo_id, titulo, descricao, video_url, material_url, duracao_texto, ordem, bloqueado, data_publicacao, data_fechamento, publicado, publicado_em, conta_no_progresso, created_at",
    )
    .eq("id", aulaId)
    .maybeSingle<AulaModulo>();

  return { aula: data, error };
}

export async function getAulaComModuloTurma(aulaId: string) {
  const { data, error } = await supabase
    .from("aulas")
    .select(
      `
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
      created_at,
      modulos (
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
          arquivada,
          arquivada_em,
          created_at
        )
      )
    `,
    )
    .eq("id", aulaId)
    .maybeSingle<AulaComModuloTurma>();

  return { aula: data, error };
}

export async function atualizarAula(
  aulaId: string,
  payload: {
    titulo: string;
    video_url?: string | null;
    duracao_texto?: string | null;
    data_publicacao?: string | null;
    data_fechamento?: string | null;
    publicado?: boolean;
    publicado_em?: string | null;
    conta_no_progresso?: boolean;
  },
) {
  const { data, error } = await supabase
    .from("aulas")
    .update({
      titulo: payload.titulo.trim(),
      video_url: payload.video_url ?? null,
      duracao_texto: payload.duracao_texto ?? null,
      data_publicacao: payload.data_publicacao ?? null,
      data_fechamento: payload.data_fechamento ?? null,
      publicado: payload.publicado ?? true,
      publicado_em: payload.publicado_em ?? null,
      conta_no_progresso: payload.conta_no_progresso ?? true,
    })
    .eq("id", aulaId)
    .select(
      "id, modulo_id, titulo, descricao, video_url, material_url, duracao_texto, ordem, bloqueado, data_publicacao, data_fechamento, publicado, publicado_em, conta_no_progresso, created_at",
    )
    .single<AulaModulo>();

  return { aula: data, error };
}

export async function alternarBloqueioAula(aulaId: string, bloqueado: boolean) {
  const { data, error } = await supabase
    .from("aulas")
    .update({ bloqueado })
    .eq("id", aulaId)
    .select(
      "id, modulo_id, titulo, descricao, video_url, material_url, duracao_texto, ordem, bloqueado, data_publicacao, data_fechamento, publicado, publicado_em, conta_no_progresso, created_at",
    )
    .single<AulaModulo>();

  return { aula: data, error };
}

export async function excluirAula(aulaId: string) {
  const { error: deleteMateriaisError } = await supabase.from("materiais").delete().eq("aula_id", aulaId);

  if (deleteMateriaisError) {
    return { error: deleteMateriaisError };
  }

  const { error } = await supabase.from("aulas").delete().eq("id", aulaId);

  return { error };
}

export async function criarMateriaisDaAula(
  aulaId: string,
  materiais: Array<{ titulo: string; arquivo_url: string }>,
) {
  if (materiais.length === 0) {
    return { materiais: [] as MaterialAula[], error: null };
  }

  const payload = materiais.map((material) => ({
    aula_id: aulaId,
    titulo: material.titulo.trim(),
    arquivo_url: normalizarMaterialUrl(material.arquivo_url),
  }));

  const { data, error } = await supabase
    .from("materiais")
    .insert(payload)
    .select("id, aula_id, titulo, arquivo_url, created_at");

  if (error) {
    return { materiais: [] as MaterialAula[], error };
  }

  const { error: legadoError } = await sincronizarCampoLegadoMaterialUrl(aulaId, payload);

  return { materiais: (data as MaterialAula[] | null) ?? [], error: legadoError };
}

export async function listarMateriaisDaAula(aulaId: string) {
  const [{ data, error }, { data: aulaData, error: aulaError }] = await Promise.all([
    supabase
      .from("materiais")
      .select("id, aula_id, titulo, arquivo_url, created_at")
      .eq("aula_id", aulaId)
      .order("created_at", { ascending: true }),
    supabase
      .from("aulas")
      .select("id, material_url, created_at")
      .eq("id", aulaId)
      .maybeSingle<{ id: string; material_url: string | null; created_at: string }>(),
  ]);

  if (error || aulaError) {
    return { materiais: [] as MaterialAula[], error: error ?? aulaError };
  }

  const materiais = ((data as MaterialAula[] | null) ?? []).slice();
  const urlsJaMapeadas = new Set(materiais.map((material) => material.arquivo_url.trim()));
  const materiaisLegados = extrairUrlsLegadas(aulaData?.material_url ?? null)
    .filter((arquivoUrl) => !urlsJaMapeadas.has(arquivoUrl))
    .map<MaterialAula>((arquivoUrl, indice) => ({
      id: `legado-${aulaId}-${indice}`,
      aula_id: aulaId,
      titulo: montarTituloMaterialLegado(arquivoUrl, indice),
      arquivo_url: arquivoUrl,
      created_at: aulaData?.created_at ?? new Date(0).toISOString(),
    }));

  return { materiais: [...materiais, ...materiaisLegados], error: null };
}

export async function substituirMateriaisDaAula(
  aulaId: string,
  materiais: Array<{ titulo: string; arquivo_url: string }>,
) {
  const { error: deleteError } = await supabase.from("materiais").delete().eq("aula_id", aulaId);

  if (deleteError) {
    return { materiais: [] as MaterialAula[], error: deleteError };
  }

  if (materiais.length === 0) {
    const { error: legadoError } = await sincronizarCampoLegadoMaterialUrl(aulaId, []);
    return { materiais: [] as MaterialAula[], error: legadoError };
  }

  return criarMateriaisDaAula(aulaId, materiais);
}

export async function listarAulasDosModulos(moduloIds: string[]) {
  if (moduloIds.length === 0) {
    return { aulas: [] as AulaModulo[], error: null };
  }

  const { data, error } = await supabase
    .from("aulas")
    .select(
      "id, modulo_id, titulo, descricao, video_url, material_url, duracao_texto, ordem, bloqueado, data_publicacao, data_fechamento, publicado, publicado_em, conta_no_progresso, created_at",
    )
    .in("modulo_id", moduloIds)
    .order("ordem", { ascending: true })
    .order("created_at", { ascending: true });

  return { aulas: (data as AulaModulo[] | null) ?? [], error };
}

export async function abrirTodasAsAulasDoModulo(moduloId: string) {
  const agora = new Date().toISOString();
  const dataFechamento = getFimDaSemanaParaPublicacao(agora);

  const { data, error } = await supabase
    .from("aulas")
    .update({
      publicado: true,
      publicado_em: agora,
      data_publicacao: null,
      data_fechamento: dataFechamento,
    })
    .eq("modulo_id", moduloId)
    .select(
      "id, modulo_id, titulo, descricao, video_url, material_url, duracao_texto, ordem, bloqueado, data_publicacao, data_fechamento, publicado, publicado_em, conta_no_progresso, created_at",
    )
    .order("ordem", { ascending: true })
    .order("created_at", { ascending: true });

  return { aulas: (data as AulaModulo[] | null) ?? [], error };
}
