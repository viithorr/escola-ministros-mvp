import { supabase } from "@/lib/supabase";

export type AlternativaQuestaoAvaliacao = {
  id: string;
  questao_id: string;
  ordem: number;
  texto: string;
  correta: boolean;
};

export type QuestaoAvaliacao = {
  id: string;
  avaliacao_id: string;
  ordem: number;
  pergunta: string;
  explicacao: string | null;
  alternativas: AlternativaQuestaoAvaliacao[];
};

export type AvaliacaoAula = {
  id: string;
  aula_id: string;
  ativa: boolean;
  exigir_aprovacao_para_avancar: boolean;
  gerada_por_transcricao: boolean;
  transcricao_base: string | null;
  publicada_em: string | null;
  created_at: string;
  questoes: QuestaoAvaliacao[];
};

export type StatusAvaliacaoAluno = {
  avaliacao: AvaliacaoAula | null;
  temAvaliacaoAtiva: boolean;
  exigeAprovacaoParaAvancar: boolean;
  aprovada: boolean;
  ultimaNotaPercentual: number | null;
  tentativas: number;
};

type ResultadoTentativaAvaliacao = {
  aprovado: boolean;
  notaPercentual: number;
  acertos: number;
  total: number;
};

type AvaliacaoAulaRow = Omit<AvaliacaoAula, "questoes">;

export type QuestaoAvaliacaoPayload = {
  ordem: number;
  pergunta: string;
  explicacao?: string | null;
  alternativas: Array<{
    ordem: number;
    texto: string;
    correta: boolean;
  }>;
};

export function importarQuestoesDeTextoFormatado(texto: string) {
  const conteudo = texto.replace(/\r/g, "").trim();

  if (!conteudo) {
    return {
      questoes: [] as Array<{
        pergunta: string;
        explicacao: string;
        alternativas: Array<{ texto: string; correta: boolean }>;
      }>,
      error: "Cole o texto das questoes antes de importar.",
    };
  }

  const blocos = conteudo
    .split(/\n\s*\n(?=Pergunta:)/i)
    .map((bloco) => bloco.trim())
    .filter(Boolean);

  const questoes = blocos.map((bloco) => {
    const linhas = bloco
      .split("\n")
      .map((linha) => linha.trim())
      .filter(Boolean);

    const perguntaLinha = linhas.find((linha) => /^Pergunta:/i.test(linha));
    const corretaLinha = linhas.find((linha) => /^Correta:/i.test(linha));
    const alternativas = ["A", "B", "C", "D"].map((letra) => {
      const linha = linhas.find((item) => new RegExp(`^${letra}\\)`, "i").test(item));
      return {
        letra,
        texto: linha?.replace(new RegExp(`^${letra}\\)\\s*`, "i"), "").trim() ?? "",
      };
    });

    const correta = corretaLinha?.replace(/^Correta:\s*/i, "").trim().toUpperCase() ?? "";

    return {
      pergunta: perguntaLinha?.replace(/^Pergunta:\s*/i, "").trim() ?? "",
      explicacao: "",
      alternativas: alternativas.map((alternativa) => ({
        texto: alternativa.texto,
        correta: alternativa.letra === correta,
      })),
    };
  });

  const invalida =
    questoes.length === 0 ||
    questoes.some((questao) => {
      const preenchidas = questao.alternativas.filter((alternativa) => alternativa.texto).length;
      const corretas = questao.alternativas.filter((alternativa) => alternativa.correta).length;
      return !questao.pergunta || preenchidas !== 4 || corretas !== 1;
    });

  if (invalida) {
    return {
      questoes: [] as Array<{
        pergunta: string;
        explicacao: string;
        alternativas: Array<{ texto: string; correta: boolean }>;
      }>,
      error:
        "Formato invalido. Use: Pergunta:, A), B), C), D) e Correta: A/B/C/D em cada bloco.",
    };
  }

  return {
    questoes,
    error: null,
  };
}

export async function getAvaliacaoDaAula(aulaId: string) {
  const { data: avaliacao, error: avaliacaoError } = await supabase
    .from("avaliacoes_aula")
    .select("id, aula_id, ativa, exigir_aprovacao_para_avancar, gerada_por_transcricao, transcricao_base, publicada_em, created_at")
    .eq("aula_id", aulaId)
    .maybeSingle<AvaliacaoAulaRow>();

  if (avaliacaoError || !avaliacao) {
    return { avaliacao: null as AvaliacaoAula | null, error: avaliacaoError };
  }

  const { data: questoes, error: questoesError } = await supabase
    .from("questoes_avaliacao")
    .select("id, avaliacao_id, ordem, pergunta, explicacao")
    .eq("avaliacao_id", avaliacao.id)
    .order("ordem", { ascending: true });

  if (questoesError) {
    return { avaliacao: null as AvaliacaoAula | null, error: questoesError };
  }

  const questoesList = (questoes as Omit<QuestaoAvaliacao, "alternativas">[] | null) ?? [];
  const questaoIds = questoesList.map((questao) => questao.id);

  const alternativasPorQuestao = new Map<string, AlternativaQuestaoAvaliacao[]>();

  if (questaoIds.length > 0) {
    const { data: alternativas, error: alternativasError } = await supabase
      .from("alternativas_questao")
      .select("id, questao_id, ordem, texto, correta")
      .in("questao_id", questaoIds)
      .order("ordem", { ascending: true });

    if (alternativasError) {
      return { avaliacao: null as AvaliacaoAula | null, error: alternativasError };
    }

    ((alternativas as AlternativaQuestaoAvaliacao[] | null) ?? []).forEach((alternativa) => {
      const atuais = alternativasPorQuestao.get(alternativa.questao_id) ?? [];
      atuais.push(alternativa);
      alternativasPorQuestao.set(alternativa.questao_id, atuais);
    });
  }

  return {
    avaliacao: {
      ...avaliacao,
      questoes: questoesList.map((questao) => ({
        ...questao,
        alternativas: alternativasPorQuestao.get(questao.id) ?? [],
      })),
    },
    error: null,
  };
}

export async function salvarAvaliacaoManualDaAula(
  aulaId: string,
  payload: {
    ativa: boolean;
    exigirAprovacaoParaAvancar?: boolean;
    questoes: QuestaoAvaliacaoPayload[];
    geradaPorTranscricao?: boolean;
    transcricaoBase?: string | null;
  },
) {
  const { data: existente, error: buscarError } = await supabase
    .from("avaliacoes_aula")
    .select("id")
    .eq("aula_id", aulaId)
    .maybeSingle<{ id: string }>();

  if (buscarError) {
    return { avaliacao: null as AvaliacaoAula | null, error: buscarError };
  }

  let avaliacaoId = existente?.id ?? null;

  if (!avaliacaoId) {
    const { data: criada, error: criarError } = await supabase
      .from("avaliacoes_aula")
      .insert({
        aula_id: aulaId,
        ativa: payload.ativa,
        exigir_aprovacao_para_avancar: payload.exigirAprovacaoParaAvancar ?? true,
        gerada_por_transcricao: payload.geradaPorTranscricao ?? false,
        transcricao_base: payload.transcricaoBase ?? null,
        publicada_em: payload.ativa ? new Date().toISOString() : null,
      })
      .select("id")
      .single<{ id: string }>();

    if (criarError || !criada) {
      return { avaliacao: null as AvaliacaoAula | null, error: criarError };
    }

    avaliacaoId = criada.id;
  } else {
    const { error: atualizarError } = await supabase
      .from("avaliacoes_aula")
      .update({
        ativa: payload.ativa,
        exigir_aprovacao_para_avancar: payload.exigirAprovacaoParaAvancar ?? true,
        gerada_por_transcricao: payload.geradaPorTranscricao ?? false,
        transcricao_base: payload.transcricaoBase ?? null,
        publicada_em: payload.ativa ? new Date().toISOString() : null,
      })
      .eq("id", avaliacaoId);

    if (atualizarError) {
      return { avaliacao: null as AvaliacaoAula | null, error: atualizarError };
    }
  }

  const { data: questoesExistentes, error: questoesExistentesError } = await supabase
    .from("questoes_avaliacao")
    .select("id")
    .eq("avaliacao_id", avaliacaoId);

  if (questoesExistentesError) {
    return { avaliacao: null as AvaliacaoAula | null, error: questoesExistentesError };
  }

  const questaoIdsExistentes = ((questoesExistentes as { id: string }[] | null) ?? []).map((item) => item.id);

  if (questaoIdsExistentes.length > 0) {
    const { error: excluirQuestoesError } = await supabase
      .from("questoes_avaliacao")
      .delete()
      .eq("avaliacao_id", avaliacaoId);

    if (excluirQuestoesError) {
      return { avaliacao: null as AvaliacaoAula | null, error: excluirQuestoesError };
    }
  }

  for (const questao of payload.questoes) {
    const { data: questaoCriada, error: questaoError } = await supabase
      .from("questoes_avaliacao")
      .insert({
        avaliacao_id: avaliacaoId,
        ordem: questao.ordem,
        pergunta: questao.pergunta.trim(),
        explicacao: questao.explicacao?.trim() || null,
      })
      .select("id")
      .single<{ id: string }>();

    if (questaoError || !questaoCriada) {
      return { avaliacao: null as AvaliacaoAula | null, error: questaoError };
    }

    const alternativasPayload = questao.alternativas.map((alternativa) => ({
      questao_id: questaoCriada.id,
      ordem: alternativa.ordem,
      texto: alternativa.texto.trim(),
      correta: alternativa.correta,
    }));

    const { error: alternativasError } = await supabase.from("alternativas_questao").insert(alternativasPayload);

    if (alternativasError) {
      return { avaliacao: null as AvaliacaoAula | null, error: alternativasError };
    }
  }

  return getAvaliacaoDaAula(aulaId);
}

export async function getStatusDaAvaliacaoDoAlunoNaAula(aulaId: string, usuarioId: string) {
  const { avaliacao, error } = await getAvaliacaoDaAula(aulaId);

  if (error) {
    return {
      status: null as StatusAvaliacaoAluno | null,
      error,
    };
  }

  if (!avaliacao || !avaliacao.ativa) {
    return {
      status: {
          avaliacao: null,
          temAvaliacaoAtiva: false,
          exigeAprovacaoParaAvancar: false,
          aprovada: true,
          ultimaNotaPercentual: null,
          tentativas: 0,
      },
      error: null,
    };
  }

  const { data: tentativas, error: tentativasError } = await supabase
    .from("tentativas_avaliacao_aluno")
    .select("nota_percentual, acertou_tudo, finalizada_em")
    .eq("avaliacao_id", avaliacao.id)
    .eq("usuario_id", usuarioId)
    .order("finalizada_em", { ascending: false });

  if (tentativasError) {
    return {
      status: null as StatusAvaliacaoAluno | null,
      error: tentativasError,
    };
  }

  const listaTentativas =
    ((tentativas as { nota_percentual: number; acertou_tudo: boolean; finalizada_em: string }[] | null) ?? []);

  return {
      status: {
        avaliacao,
        temAvaliacaoAtiva: true,
        exigeAprovacaoParaAvancar: avaliacao.exigir_aprovacao_para_avancar,
        aprovada: listaTentativas.some((tentativa) => tentativa.acertou_tudo),
        ultimaNotaPercentual: listaTentativas[0]?.nota_percentual ?? null,
        tentativas: listaTentativas.length,
    },
    error: null,
  };
}

export async function listarStatusDasAvaliacoesDoAlunoPorAulas(aulaIds: string[], usuarioId: string) {
  if (aulaIds.length === 0) {
    return {
      statusPorAula: new Map<
        string,
        {
          temAvaliacaoAtiva: boolean;
          exigeAprovacaoParaAvancar: boolean;
          aprovada: boolean;
        }
      >(),
      error: null,
    };
  }

  const { data: avaliacoes, error: avaliacoesError } = await supabase
    .from("avaliacoes_aula")
    .select("id, aula_id, ativa, exigir_aprovacao_para_avancar")
    .in("aula_id", aulaIds)
    .eq("ativa", true);

  if (avaliacoesError) {
    return {
      statusPorAula: new Map<
        string,
        {
          temAvaliacaoAtiva: boolean;
          exigeAprovacaoParaAvancar: boolean;
          aprovada: boolean;
        }
      >(),
      error: avaliacoesError,
    };
  }

  const avaliacoesAtivas =
    ((avaliacoes as {
      id: string;
      aula_id: string;
      ativa: boolean;
      exigir_aprovacao_para_avancar: boolean;
    }[] | null) ?? []).filter((item) => item.ativa);
  const statusPorAula = new Map<
    string,
    {
      temAvaliacaoAtiva: boolean;
      exigeAprovacaoParaAvancar: boolean;
      aprovada: boolean;
    }
  >();

  avaliacoesAtivas.forEach((avaliacao) => {
    statusPorAula.set(avaliacao.aula_id, {
      temAvaliacaoAtiva: true,
      exigeAprovacaoParaAvancar: avaliacao.exigir_aprovacao_para_avancar,
      aprovada: false,
    });
  });

  if (avaliacoesAtivas.length === 0) {
    return { statusPorAula, error: null };
  }

  const avaliacaoIds = avaliacoesAtivas.map((avaliacao) => avaliacao.id);

  const { data: tentativas, error: tentativasError } = await supabase
    .from("tentativas_avaliacao_aluno")
    .select("avaliacao_id, acertou_tudo")
    .eq("usuario_id", usuarioId)
    .in("avaliacao_id", avaliacaoIds)
    .eq("acertou_tudo", true);

  if (tentativasError) {
    return {
      statusPorAula: new Map<
        string,
        {
          temAvaliacaoAtiva: boolean;
          exigeAprovacaoParaAvancar: boolean;
          aprovada: boolean;
        }
      >(),
      error: tentativasError,
    };
  }

  const aprovadasPorAvaliacao = new Set(
    (((tentativas as { avaliacao_id: string; acertou_tudo: boolean }[] | null) ?? []).map((item) => item.avaliacao_id)),
  );

  avaliacoesAtivas.forEach((avaliacao) => {
    statusPorAula.set(avaliacao.aula_id, {
      temAvaliacaoAtiva: true,
      exigeAprovacaoParaAvancar: avaliacao.exigir_aprovacao_para_avancar,
      aprovada: aprovadasPorAvaliacao.has(avaliacao.id),
    });
  });

  return { statusPorAula, error: null };
}

export async function finalizarTentativaDaAvaliacao(
  aulaId: string,
  usuarioId: string,
  respostas: Array<{ questaoId: string; alternativaId: string }>,
) {
  const { avaliacao, error } = await getAvaliacaoDaAula(aulaId);

  if (error || !avaliacao || !avaliacao.ativa) {
    return {
      resultado: null as
        | {
            aprovado: boolean;
            notaPercentual: number;
            acertos: number;
            total: number;
          }
        | null,
      error: error ?? new Error("Avaliacao nao encontrada."),
    };
  }

  const questoes = avaliacao.questoes;
  const total = questoes.length;

  if (total === 0) {
    return {
      resultado: null as
        | {
            aprovado: boolean;
            notaPercentual: number;
            acertos: number;
            total: number;
          }
        | null,
      error: new Error("Avaliacao sem questoes."),
    };
  }

  const respostasMap = new Map(respostas.map((item) => [item.questaoId, item.alternativaId]));

  if (respostasMap.size !== total) {
    return {
      resultado: null as
        | {
            aprovado: boolean;
            notaPercentual: number;
            acertos: number;
            total: number;
          }
        | null,
      error: new Error("Responda todas as questoes."),
    };
  }

  const respostasProcessadas = questoes.map((questao) => {
    const alternativaCorreta = questao.alternativas.find((alternativa) => alternativa.correta);
    const alternativaEscolhida = respostasMap.get(questao.id) ?? null;
    const correta = Boolean(alternativaCorreta && alternativaEscolhida === alternativaCorreta.id);

    return {
      questaoId: questao.id,
      alternativaId: alternativaEscolhida,
      correta,
    };
  });

  if (respostasProcessadas.some((resposta) => !resposta.alternativaId)) {
    return {
      resultado: null as
        | {
            aprovado: boolean;
            notaPercentual: number;
            acertos: number;
            total: number;
          }
        | null,
      error: new Error("Responda todas as questoes."),
    };
  }

  const acertos = respostasProcessadas.filter((resposta) => resposta.correta).length;
  const notaPercentual = Math.round((acertos / total) * 100);
  const aprovado = acertos === total;

  const { data: tentativa, error: tentativaError } = await supabase
    .from("tentativas_avaliacao_aluno")
    .insert({
      avaliacao_id: avaliacao.id,
      usuario_id: usuarioId,
      nota_percentual: notaPercentual,
      acertou_tudo: aprovado,
    })
    .select("id")
    .single<{ id: string }>();

    if (tentativaError || !tentativa) {
    return {
      resultado: null as ResultadoTentativaAvaliacao | null,
      error: tentativaError,
    };
  }

  const { error: respostasError } = await supabase.from("respostas_tentativa_avaliacao").insert(
    respostasProcessadas.map((resposta) => ({
      tentativa_id: tentativa.id,
      questao_id: resposta.questaoId,
      alternativa_id: resposta.alternativaId,
      correta: resposta.correta,
    })),
  );

  if (respostasError) {
    return {
      resultado: null as ResultadoTentativaAvaliacao | null,
      error: respostasError,
    };
  }

  return {
    resultado: {
      aprovado,
      notaPercentual,
      acertos,
      total,
    },
    error: null,
  };
}
