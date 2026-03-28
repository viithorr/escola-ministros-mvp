export async function arquivarTurma(turmaId: string, arquivada: boolean) {
  const response = await fetch(`/api/admin/turmas/${turmaId}`, {
    method: "PATCH",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ arquivada }),
  });

  const payload = (await response.json().catch(() => ({}))) as { error?: string };

  return {
    error: response.ok ? null : payload.error ?? "Nao foi possivel atualizar a turma.",
  };
}

export async function excluirTurma(turmaId: string) {
  const response = await fetch(`/api/admin/turmas/${turmaId}`, {
    method: "DELETE",
  });

  const payload = (await response.json().catch(() => ({}))) as { error?: string };

  return {
    error: response.ok ? null : payload.error ?? "Nao foi possivel excluir a turma.",
  };
}
