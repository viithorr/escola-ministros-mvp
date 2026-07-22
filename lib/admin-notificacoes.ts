type NotificacaoTurmaClientPayload = {
  turmaId: string;
  tipo: string;
  titulo: string;
  mensagem: string;
  acao_tipo?: string | null;
  acao_payload?: Record<string, unknown> | null;
};

export async function notificarTurma(payload: NotificacaoTurmaClientPayload) {
  try {
    const { data: sessionData } = await supabase.auth.getSession();
    const token = sessionData.session?.access_token;

    if (!token) {
      return { error: "Sua sessao expirou. Entre novamente." };
    }

    const response = await fetch("/api/notificacoes/turma", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(payload),
    });

    const data = (await response.json()) as { error?: string };

    if (!response.ok) {
      return { error: data.error || "Nao foi possivel criar a notificacao." };
    }

    return { error: null };
  } catch {
    return { error: "Nao foi possivel criar a notificacao." };
  }
}
import { supabase } from "@/lib/supabase";
