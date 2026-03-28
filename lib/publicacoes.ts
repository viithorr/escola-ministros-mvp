export async function sincronizarPublicacoesAgendadas() {
  try {
    await fetch("/api/aulas/sincronizar-publicacoes", {
      method: "POST",
    });
  } catch {
    // Nao bloqueia a experiencia; a leitura por data continua protegendo o aluno.
  }
}
