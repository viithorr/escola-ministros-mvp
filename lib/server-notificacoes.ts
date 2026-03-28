import { getSupabaseAdmin } from "@/lib/supabase-admin";

type NotificacaoTurmaPayload = {
  turmaId: string;
  tipo: string;
  titulo: string;
  mensagem: string;
  acao_tipo?: string | null;
  acao_payload?: Record<string, unknown> | null;
};

export async function criarNotificacoesParaTurma({
  turmaId,
  tipo,
  titulo,
  mensagem,
  acao_tipo = null,
  acao_payload = null,
}: NotificacaoTurmaPayload) {
  const supabaseAdmin = getSupabaseAdmin();

  const { data: matriculas, error: matriculasError } = await supabaseAdmin
    .from("alunos_turma")
    .select("usuario_id")
    .eq("turma_id", turmaId);

  if (matriculasError) {
    return { error: matriculasError.message };
  }

  const usuariosIds = ((matriculas as { usuario_id: string }[] | null) ?? []).map((item) => item.usuario_id);

  if (usuariosIds.length === 0) {
    return { error: null };
  }

  const payload = usuariosIds.map((usuarioId) => ({
    usuario_id: usuarioId,
    tipo,
    titulo,
    mensagem,
    acao_tipo,
    acao_payload,
  }));

  const { error } = await supabaseAdmin.from("notificacoes").insert(payload);

  return { error: error?.message ?? null };
}
