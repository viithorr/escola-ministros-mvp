"use client";

import { supabase } from "@/lib/supabase";

export type AcaoNotificacaoPayload = {
  rota?: string;
  aula_id?: string;
  encontro_id?: string;
};

export type Notificacao = {
  id: string;
  usuario_id: string;
  tipo: string;
  titulo: string;
  mensagem: string;
  acao_tipo: string | null;
  acao_payload: AcaoNotificacaoPayload | null;
  visualizada: boolean;
  modal_exibido_em: string | null;
  criado_em: string;
};

export async function listarNotificacoesDoUsuario(usuarioId: string) {
  const { data, error } = await supabase
    .from("notificacoes")
    .select("*")
    .eq("usuario_id", usuarioId)
    .order("criado_em", { ascending: false });

  return {
    notificacoes: (data as Notificacao[] | null) ?? [],
    error: error?.message ?? null,
  };
}

export async function contarNotificacoesNaoVisualizadas(usuarioId: string) {
  const { count, error } = await supabase
    .from("notificacoes")
    .select("*", { count: "exact", head: true })
    .eq("usuario_id", usuarioId)
    .eq("visualizada", false);

  return {
    total: count ?? 0,
    error: error?.message ?? null,
  };
}

export async function marcarNotificacoesComoVisualizadas(usuarioId: string) {
  const { error } = await supabase
    .from("notificacoes")
    .update({ visualizada: true })
    .eq("usuario_id", usuarioId)
    .eq("visualizada", false);

  return {
    error: error?.message ?? null,
  };
}

export function getRotaDaNotificacao(notificacao: Notificacao) {
  const payload = notificacao.acao_payload;

  if (payload?.rota) return payload.rota;

  if (notificacao.acao_tipo === "abrir_aula" && payload?.aula_id) {
    return `/aluno/aula/${payload.aula_id}`;
  }

  if (notificacao.acao_tipo === "abrir_encontro" && payload?.encontro_id) {
    return `/encontros?encontro=${payload.encontro_id}`;
  }

  if (notificacao.acao_tipo === "abrir_dashboard") {
    return "/dashboard";
  }

  return null;
}

export function getRotuloDaAcao(notificacao: Notificacao) {
  if (notificacao.acao_tipo === "abrir_aula") return "Acessar aula";
  if (notificacao.acao_tipo === "abrir_encontro") return "Confirmar presenca";
  if (notificacao.acao_tipo === "abrir_dashboard") return "Ver minhas aulas";
  return "Abrir";
}
