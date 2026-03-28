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
    const response = await fetch("/api/notificacoes/turma", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
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
