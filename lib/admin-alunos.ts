export async function atualizarBloqueioDoAlunoNaTurma(
  usuarioId: string,
  turmaId: string,
  acessoBloqueado: boolean,
) {
  const response = await fetch(`/api/admin/alunos/${usuarioId}`, {
    method: "PATCH",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      turmaId,
      acessoBloqueado,
    }),
  });

  const payload = (await response.json().catch(() => ({}))) as { error?: string };

  return {
    error: response.ok ? null : payload.error ?? "Nao foi possivel atualizar o acesso do aluno.",
  };
}

export async function excluirAlunoDaTurma(usuarioId: string, turmaId: string) {
  const response = await fetch(`/api/admin/alunos/${usuarioId}?turma=${turmaId}`, {
    method: "DELETE",
  });

  const payload = (await response.json().catch(() => ({}))) as { error?: string };

  return {
    error: response.ok ? null : payload.error ?? "Nao foi possivel excluir o aluno desta turma.",
  };
}
