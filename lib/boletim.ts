import { supabase } from "@/lib/supabase";

export type PeriodoLetivo = {
  id: string;
  codigo: string;
  criado_em: string;
};

export type OfertaBoletim = {
  id: string;
  periodo_id: string;
  turma_id: string;
  modulo_id: string;
  criado_em: string;
  fechamento_em: string | null;
  fechado_em: string | null;
};

export type BoletimAluno = {
  id: string;
  usuario_id: string;
  oferta_id: string;
  periodo_id: string;
  turma_id: string;
  modulo_id: string;
  periodo: string;
  turma: string;
  codigo_turma: string | null;
  modulo: string;
  codigo_modulo: string | null;
  p1: number | null;
  p2: number | null;
  cva: number | null;
  final: number | null;
  resultado: "Aprovado" | "Reprovado" | "Em andamento";
  total_aulas: number;
  aulas_concluidas: number;
  fechamento_em: string | null;
  fechado_em: string | null;
  encerramento_efetivo: string | null;
  encerrado: boolean;
};

const CAMPOS_OFERTA = "id, periodo_id, turma_id, modulo_id, criado_em, fechamento_em, fechado_em";

export async function listarPeriodosLetivos() {
  const { data, error } = await supabase
    .from("periodos_letivos")
    .select("id, codigo, criado_em")
    .order("codigo", { ascending: false });

  return { periodos: (data as PeriodoLetivo[] | null) ?? [], error };
}

export async function criarPeriodoLetivo(codigo: string) {
  const { data, error } = await supabase
    .from("periodos_letivos")
    .insert({ codigo: codigo.trim() })
    .select("id, codigo, criado_em")
    .single<PeriodoLetivo>();

  return { periodo: data, error };
}

export async function buscarOfertaBoletim(periodoId: string, moduloId: string) {
  const { data, error } = await supabase
    .from("ofertas_boletim")
    .select(CAMPOS_OFERTA)
    .eq("periodo_id", periodoId)
    .eq("modulo_id", moduloId)
    .maybeSingle<OfertaBoletim>();

  return { oferta: data, error };
}

export async function criarOfertaBoletim(periodoId: string, turmaId: string, moduloId: string) {
  const { data, error } = await supabase
    .from("ofertas_boletim")
    .insert({ periodo_id: periodoId, turma_id: turmaId, modulo_id: moduloId })
    .select(CAMPOS_OFERTA)
    .single<OfertaBoletim>();

  return { oferta: data, error };
}

export async function listarBoletinsDaOferta(ofertaId: string) {
  const { data, error } = await supabase.from("boletim_aluno").select("*").eq("oferta_id", ofertaId);
  return { boletins: (data as BoletimAluno[] | null) ?? [], error };
}

export async function listarBoletinsDoAluno(usuarioId: string) {
  const { data, error } = await supabase
    .from("boletim_aluno")
    .select("*")
    .eq("usuario_id", usuarioId)
    .order("periodo", { ascending: false });

  return { boletins: (data as BoletimAluno[] | null) ?? [], error };
}

export async function salvarNotasBoletim(
  ofertaId: string,
  notas: Array<{ usuario_id: string; p1: number | null; p2: number | null }>,
) {
  const payload = notas.map((nota) => ({ ...nota, oferta_id: ofertaId }));
  const { error } = await supabase.from("notas_boletim").upsert(payload, {
    onConflict: "oferta_id,usuario_id",
  });

  return { error };
}

export async function agendarFechamentoBoletim(ofertaId: string, fechamentoEm: string) {
  const { data, error } = await supabase
    .from("ofertas_boletim")
    .update({ fechamento_em: fechamentoEm, fechado_em: null })
    .eq("id", ofertaId)
    .select(CAMPOS_OFERTA)
    .single<OfertaBoletim>();

  return { oferta: data, error };
}

export async function fecharBoletimAgora(ofertaId: string) {
  const agora = new Date().toISOString();
  const { data, error } = await supabase
    .from("ofertas_boletim")
    .update({ fechado_em: agora })
    .eq("id", ofertaId)
    .select(CAMPOS_OFERTA)
    .single<OfertaBoletim>();

  return { oferta: data, error };
}

export async function reabrirBoletim(ofertaId: string) {
  const { data, error } = await supabase
    .from("ofertas_boletim")
    .update({ fechamento_em: null, fechado_em: null })
    .eq("id", ofertaId)
    .select(CAMPOS_OFERTA)
    .single<OfertaBoletim>();

  return { oferta: data, error };
}
