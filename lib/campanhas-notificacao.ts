"use client";

import { supabase } from "@/lib/supabase";

export type TemaCampanha = "informacao" | "aviso" | "urgente";
export type PublicoCampanha = "todos" | "turma" | "progresso_incompleto";

export type CampanhaNotificacao = {
  id: string;
  titulo: string;
  mensagem: string;
  tema: TemaCampanha;
  publico_tipo: PublicoCampanha;
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

export type CampanhaAtivaAluno = CampanhaNotificacao & {
  notificacao_id: string;
};

export type NovaCampanhaPayload = Omit<CampanhaNotificacao, "id" | "criado_em">;

async function getHeadersAutenticados() {
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;

  if (!token) throw new Error("Sua sessao expirou. Entre novamente.");

  return {
    "Content-Type": "application/json",
    Authorization: `Bearer ${token}`,
  };
}
async function lerResposta<T>(response: Response) {
  const data = (await response.json()) as T & { error?: string };
  if (!response.ok) throw new Error(data.error || "Nao foi possivel concluir a operacao.");
  return data;
}

export async function listarCampanhasAdmin() {
  const response = await fetch("/api/admin/notificacoes", {
    headers: await getHeadersAutenticados(),
    cache: "no-store",
  });
  return lerResposta<{ campanhas: CampanhaNotificacao[] }>(response);
}

export async function criarCampanhaAdmin(payload: NovaCampanhaPayload) {
  const response = await fetch("/api/admin/notificacoes", {
    method: "POST",
    headers: await getHeadersAutenticados(),
    body: JSON.stringify(payload),
  });
  return lerResposta<{ campanha: CampanhaNotificacao }>(response);
}

export async function atualizarCampanhaAdmin(id: string, payload: Partial<NovaCampanhaPayload>) {
  const response = await fetch(`/api/admin/notificacoes/${id}`, {
    method: "PATCH",
    headers: await getHeadersAutenticados(),
    body: JSON.stringify(payload),
  });
  return lerResposta<{ campanha: CampanhaNotificacao }>(response);
}

export async function buscarCampanhaAtivaAluno() {
  const response = await fetch("/api/notificacoes/campanhas/ativas", {
    headers: await getHeadersAutenticados(),
    cache: "no-store",
  });
  return lerResposta<{ campanha: CampanhaAtivaAluno | null }>(response);
}

export async function registrarEventoCampanha(notificacaoId: string, evento: "exibir" | "dispensar") {
  const response = await fetch("/api/notificacoes/campanhas/evento", {
    method: "POST",
    headers: await getHeadersAutenticados(),
    body: JSON.stringify({ notificacaoId, evento }),
  });
  return lerResposta<{ ok: true }>(response);
}
