"use client";

import { ChangeEvent, useEffect, useMemo, useRef, useState } from "react";
import Image from "next/image";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import {
  CalendarDays,
  ChartPie,
  CirclePlus,
  CircleUserRound,
  House,
  Pencil,
  Trash2,
} from "lucide-react";
import AppLoader from "@/components/AppLoader";
import { useAuth } from "@/contexts/AuthContext";
import {
  getAvaliacaoDaAula,
  importarQuestoesDeTextoFormatado,
  salvarAvaliacaoManualDaAula,
  type QuestaoAvaliacaoPayload,
} from "@/lib/avaliacoes";
import { getAulaById, type AulaModulo } from "@/lib/aulas";
import { getModuloComTurma, type ModuloTurma } from "@/lib/modulos";
import { getServiceUnavailableMessage, RequestTimeoutError, withTimeout } from "@/lib/network";
import { type TurmaAdmin } from "@/lib/turmas";
import { isValidUserRole, type UsuarioProfile } from "@/lib/usuarios";

type AlternativaRascunho = {
  id: string;
  texto: string;
  correta: boolean;
};

type QuestaoRascunho = {
  id: string;
  pergunta: string;
  explicacao: string;
  alternativas: AlternativaRascunho[];
};

function criarQuestaoVazia() {
  return {
    id: crypto.randomUUID(),
    pergunta: "",
    explicacao: "",
    alternativas: ["A", "B", "C", "D"].map((_, indice) => ({
      id: crypto.randomUUID(),
      texto: "",
      correta: indice === 0,
    })),
  };
}

function getIniciais(profile: UsuarioProfile | null) {
  const nome = profile?.nome?.trim();

  if (nome) {
    const partes = nome.split(/\s+/).filter(Boolean);
    const primeira = partes[0]?.[0] ?? "";
    const ultima = partes.length > 1 ? partes[partes.length - 1]?.[0] ?? "" : "";
    return `${primeira}${ultima || primeira}`.toUpperCase();
  }

  return (profile?.email?.slice(0, 2) || "AD").toUpperCase();
}

export default function QuestoesDaAulaPage() {
  const { user, profile, profileError, loading } = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();
  const params = useParams<{ id: string }>();
  const moduloId = Array.isArray(params?.id) ? params.id[0] : params?.id;
  const aulaId = searchParams.get("aula");

  const [loadingPage, setLoadingPage] = useState(true);
  const [carregandoDados, setCarregandoDados] = useState(true);
  const [salvando, setSalvando] = useState(false);
  const [mensagem, setMensagem] = useState("");
  const [modulo, setModulo] = useState<ModuloTurma | null>(null);
  const [turma, setTurma] = useState<TurmaAdmin | null>(null);
  const [aula, setAula] = useState<AulaModulo | null>(null);
  const [avaliacaoAtiva, setAvaliacaoAtiva] = useState(true);
  const [exigirAprovacaoParaAvancar, setExigirAprovacaoParaAvancar] = useState(true);
  const [textoImportacao, setTextoImportacao] = useState("");
  const [questoes, setQuestoes] = useState<QuestaoRascunho[]>([]);
  const inputArquivoRef = useRef<HTMLInputElement | null>(null);

  const iniciaisAvatar = useMemo(() => getIniciais(profile), [profile]);

  useEffect(() => {
    async function verificarAcesso() {
      if (loading) return;

      if (!user) {
        router.push("/login");
        return;
      }

      if (!profile) {
        setMensagem(profileError || "Nao conseguimos carregar sua conta agora. Tente novamente em alguns instantes.");
        setLoadingPage(false);
        return;
      }

      if (!isValidUserRole(profile.role)) {
        setMensagem("Nao conseguimos liberar seu acesso agora. Fale com o administrador.");
        setLoadingPage(false);
        return;
      }

      if (profile.role !== "admin") {
        router.push("/dashboard");
        return;
      }

      setLoadingPage(false);
    }

    void verificarAcesso();
  }, [loading, profile, profileError, router, user]);

  useEffect(() => {
    if (loadingPage) return;

    if (!moduloId || !aulaId) {
      setMensagem("Salve a aula primeiro para configurar as questoes.");
      setCarregandoDados(false);
      return;
    }

    const moduloIdAtual = moduloId;
    const aulaIdAtual = aulaId;

    async function carregarTela() {
      setCarregandoDados(true);
      setMensagem("");

      try {
        const [{ modulo: moduloComTurma, error: moduloError }, { aula: aulaData, error: aulaError }, { avaliacao, error: avaliacaoError }] =
          await Promise.all([
            withTimeout(getModuloComTurma(moduloIdAtual)),
            withTimeout(getAulaById(aulaIdAtual)),
            withTimeout(getAvaliacaoDaAula(aulaIdAtual)),
          ]);

        if (moduloError || !moduloComTurma || !moduloComTurma.turmas) {
          setMensagem("Nao conseguimos carregar este modulo agora. Tente novamente.");
          setCarregandoDados(false);
          return;
        }

        if (aulaError || !aulaData) {
          setMensagem("Nao conseguimos carregar esta aula agora.");
          setCarregandoDados(false);
          return;
        }

        if (avaliacaoError) {
          setMensagem("Nao conseguimos carregar as questoes desta aula agora.");
          setCarregandoDados(false);
          return;
        }

        setModulo({
          id: moduloComTurma.id,
          turma_id: moduloComTurma.turma_id,
          titulo: moduloComTurma.titulo,
          ordem: moduloComTurma.ordem,
          created_at: moduloComTurma.created_at,
        });
        setTurma(moduloComTurma.turmas as TurmaAdmin);
        setAula(aulaData);

        if (avaliacao) {
          setAvaliacaoAtiva(avaliacao.ativa);
          setExigirAprovacaoParaAvancar(avaliacao.exigir_aprovacao_para_avancar);
          setTextoImportacao(avaliacao.transcricao_base ?? "");
          setQuestoes(
            avaliacao.questoes.map((questao) => ({
              id: questao.id,
              pergunta: questao.pergunta,
              explicacao: questao.explicacao ?? "",
              alternativas: questao.alternativas.map((alternativa) => ({
                id: alternativa.id,
                texto: alternativa.texto,
                correta: alternativa.correta,
              })),
            })),
          );
        } else {
          setAvaliacaoAtiva(true);
          setExigirAprovacaoParaAvancar(true);
          setTextoImportacao("");
          setQuestoes([]);
        }
      } catch (error) {
        setMensagem(
          error instanceof RequestTimeoutError
            ? getServiceUnavailableMessage()
            : "Nao conseguimos carregar esta tela agora. Tente novamente.",
        );
      } finally {
        setCarregandoDados(false);
      }
    }

    void carregarTela();
  }, [aulaId, loadingPage, moduloId]);

  function handleAdicionarQuestao() {
    setQuestoes((estadoAtual) => [...estadoAtual, criarQuestaoVazia()]);
  }

  function handleAtualizarQuestao(id: string, campo: "pergunta" | "explicacao", valor: string) {
    setQuestoes((estadoAtual) =>
      estadoAtual.map((questao) => (questao.id === id ? { ...questao, [campo]: valor } : questao)),
    );
  }

  function handleAtualizarAlternativa(questaoId: string, alternativaId: string, valor: string) {
    setQuestoes((estadoAtual) =>
      estadoAtual.map((questao) =>
        questao.id === questaoId
          ? {
              ...questao,
              alternativas: questao.alternativas.map((alternativa) =>
                alternativa.id === alternativaId ? { ...alternativa, texto: valor } : alternativa,
              ),
            }
          : questao,
      ),
    );
  }

  function handleDefinirCorreta(questaoId: string, alternativaId: string) {
    setQuestoes((estadoAtual) =>
      estadoAtual.map((questao) =>
        questao.id === questaoId
          ? {
              ...questao,
              alternativas: questao.alternativas.map((alternativa) => ({
                ...alternativa,
                correta: alternativa.id === alternativaId,
              })),
            }
          : questao,
      ),
    );
  }

  function handleRemoverQuestao(id: string) {
    setQuestoes((estadoAtual) => estadoAtual.filter((questao) => questao.id !== id));
  }

  async function handleArquivoTexto(event: ChangeEvent<HTMLInputElement>) {
    const arquivo = event.target.files?.[0];

    if (!arquivo) return;

    try {
      const conteudo = await arquivo.text();
      setTextoImportacao(conteudo);
      setMensagem("");
    } catch {
      setMensagem("Nao foi possivel ler o arquivo agora. Tente outro arquivo de texto.");
    } finally {
      event.target.value = "";
    }
  }

  function handleImportarQuestoes() {
    const { questoes: importadas, error } = importarQuestoesDeTextoFormatado(textoImportacao);

    if (error) {
      setMensagem(error);
      return;
    }

    setQuestoes(
      importadas.map((questao) => ({
        id: crypto.randomUUID(),
        pergunta: questao.pergunta,
        explicacao: questao.explicacao,
        alternativas: questao.alternativas.map((alternativa) => ({
          id: crypto.randomUUID(),
          texto: alternativa.texto,
          correta: alternativa.correta,
        })),
      })),
    );
    setMensagem(`${importadas.length} ${importadas.length === 1 ? "questao importada" : "questoes importadas"} para revisao.`);
  }

  async function handleFinalizarQuestoes() {
    if (!aulaId) return;

    if (avaliacaoAtiva && questoes.length === 0) {
      setMensagem("Adicione pelo menos uma questao antes de finalizar.");
      return;
    }

    const temQuestaoInvalida = questoes.some((questao) => {
      const alternativasValidas = questao.alternativas.filter((alternativa) => alternativa.texto.trim()).length;
      const corretas = questao.alternativas.filter((alternativa) => alternativa.correta).length;

      return !questao.pergunta.trim() || alternativasValidas !== 4 || corretas !== 1;
    });

    if (temQuestaoInvalida) {
      setMensagem("Revise as questoes. Cada uma precisa ter enunciado, 4 alternativas e 1 correta.");
      return;
    }

    setSalvando(true);
    setMensagem("");

    const payload: QuestaoAvaliacaoPayload[] = questoes.map((questao, index) => ({
      ordem: index + 1,
      pergunta: questao.pergunta.trim(),
      explicacao: questao.explicacao.trim() || null,
      alternativas: questao.alternativas.map((alternativa, alternativaIndex) => ({
        ordem: alternativaIndex + 1,
        texto: alternativa.texto.trim(),
        correta: alternativa.correta,
      })),
    }));

    const { error } = await salvarAvaliacaoManualDaAula(aulaId, {
      ativa: avaliacaoAtiva,
      exigirAprovacaoParaAvancar,
      questoes: payload,
      geradaPorTranscricao: false,
      transcricaoBase: textoImportacao.trim() || null,
    });

    setSalvando(false);

    if (error) {
      setMensagem("Nao foi possivel salvar as questoes agora. Tente novamente.");
      return;
    }

    router.push(`/aula/${moduloId}?aula=${aulaId}`);
  }

  if (loadingPage) {
    return <AppLoader />;
  }

  return (
    <main className="min-h-screen bg-white pb-28 pt-28">
      <header className="fixed inset-x-0 top-0 z-30 bg-white px-4 pb-4 pt-5">
        <div className="mx-auto flex max-w-md items-center justify-between">
          <div className="w-12" />

          <Image
            src="/img/logo.svg"
            alt="Escola de Ministros"
            width={147}
            height={49}
            className="h-10 w-auto object-contain"
            priority
          />

          <button
            onClick={() => router.push("/conta")}
            className="flex h-11 w-11 items-center justify-center overflow-hidden rounded-full bg-slate-200 text-sm font-semibold text-slate-700"
          >
            {iniciaisAvatar}
          </button>
        </div>
      </header>

      <div className="mx-auto flex w-full max-w-md flex-col gap-6 px-4">
        <section className="space-y-5">
          <h1 className="text-[2rem] font-semibold leading-none text-[#1c6a91]">Questoes</h1>

          {aula ? (
            <div className="rounded-[18px] border border-slate-200 bg-slate-50 px-4 py-4">
              <p className="text-sm font-medium text-slate-800">{aula.titulo}</p>
              <p className="mt-1 text-xs text-slate-500">
                {modulo?.titulo ? `Modulo: ${modulo.titulo}` : ""} {turma?.nome ? `| Turma: ${turma.nome}` : ""}
              </p>
            </div>
          ) : null}

          {mensagem ? (
            <p className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-700">
              {mensagem}
            </p>
          ) : null}

          {carregandoDados ? (
            <AppLoader fullScreen={false} />
          ) : null}

          {!carregandoDados && aula ? (
            <div className="space-y-5">
              <div className="flex items-center justify-between rounded-[18px] border border-slate-200 bg-white px-4 py-4">
                <div>
                  <p className="text-sm font-medium text-slate-800">Ativar avaliacao</p>
                  <p className="text-xs text-slate-500">
                    Quando ativa, o aluno precisa acertar 100% para seguir para a proxima aula.
                  </p>
                </div>

                <button
                  type="button"
                  onClick={() => setAvaliacaoAtiva((estadoAtual) => !estadoAtual)}
                  className={`flex h-8 w-14 items-center rounded-full px-1 transition ${
                    avaliacaoAtiva ? "bg-[#0e5d77] justify-end" : "bg-slate-200 justify-start"
                  }`}
                >
                  <span className="h-6 w-6 rounded-full bg-white shadow-sm" />
                </button>
              </div>

              <div className="flex items-center justify-between rounded-[18px] border border-slate-200 bg-white px-4 py-4">
                <div>
                  <p className="text-sm font-medium text-slate-800">
                    Esta avaliacao bloqueia o proximo conteudo?
                  </p>
                  <p className="text-xs text-slate-500">
                    Se ligado, o aluno so avanca ao acertar 100%. Se desligado, a avaliacao fica opcional.
                  </p>
                </div>

                <button
                  type="button"
                  onClick={() => setExigirAprovacaoParaAvancar((estadoAtual) => !estadoAtual)}
                  className={`flex h-8 w-14 items-center rounded-full px-1 transition ${
                    exigirAprovacaoParaAvancar ? "bg-[#0e5d77] justify-end" : "bg-slate-200 justify-start"
                  }`}
                >
                  <span className="h-6 w-6 rounded-full bg-white shadow-sm" />
                </button>
              </div>

              <div className="space-y-3 rounded-[18px] border border-slate-200 bg-slate-50 px-4 py-4">
                <div className="space-y-1">
                  <span className="text-sm font-medium text-slate-800">Importar questoes por texto</span>
                  <p className="text-xs text-slate-500">
                    Cole ou envie um arquivo com o formato padrao e revise as questoes antes de finalizar.
                  </p>
                </div>

                <textarea
                  value={textoImportacao}
                  onChange={(event) => setTextoImportacao(event.target.value)}
                  rows={10}
                  placeholder={
                    "Pergunta: texto da pergunta\nA) alternativa\nB) alternativa\nC) alternativa\nD) alternativa\nCorreta: A"
                  }
                  className="w-full rounded-[14px] border border-slate-200 bg-white px-4 py-3 text-sm outline-none"
                />

                <div className="flex gap-3">
                  <input
                    ref={inputArquivoRef}
                    type="file"
                    accept=".txt,.md,.text"
                    className="hidden"
                    onChange={handleArquivoTexto}
                  />

                  <button
                    type="button"
                    onClick={() => inputArquivoRef.current?.click()}
                    className="rounded-[12px] border border-slate-200 bg-white px-4 py-3 text-sm font-medium text-slate-700"
                  >
                    Enviar arquivo
                  </button>

                  <button
                    type="button"
                    onClick={handleImportarQuestoes}
                    className="flex-1 rounded-[12px] bg-[#0e5d77] px-4 py-3 text-sm font-semibold text-white"
                  >
                    Importar questoes
                  </button>
                </div>

                <div className="rounded-[14px] border border-dashed border-slate-200 bg-white px-4 py-3 text-xs leading-6 text-slate-500">
                  <p className="font-medium text-slate-700">Formato esperado</p>
                  <p>Pergunta: texto da pergunta</p>
                  <p>A) alternativa</p>
                  <p>B) alternativa</p>
                  <p>C) alternativa</p>
                  <p>D) alternativa</p>
                  <p>Correta: A</p>
                </div>
              </div>

              <div className="space-y-3 rounded-[18px] border border-slate-200 bg-white px-4 py-4">
                <div className="flex items-center justify-between">
                  <div>
                    <span className="text-sm font-medium text-slate-800">Questoes da aula</span>
                    <p className="text-xs text-slate-500">
                      Revise, ajuste a ordem e deixe tudo pronto antes de publicar a avaliacao.
                    </p>
                  </div>

                  <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-500">
                    {questoes.length} {questoes.length === 1 ? "questao" : "questoes"}
                  </span>
                </div>

                {questoes.length === 0 ? (
                  <div className="rounded-[14px] border border-dashed border-slate-200 px-4 py-5 text-sm text-slate-400">
                    Nenhuma questao criada ainda.
                  </div>
                ) : null}

                {questoes.map((questao, index) => (
                  <div key={questao.id} className="space-y-4 rounded-[16px] border border-slate-200 bg-slate-50 px-4 py-4">
                    <div className="flex items-center justify-between">
                      <p className="text-sm font-semibold text-slate-800">Questao {index + 1}</p>
                      <button
                        type="button"
                        onClick={() => handleRemoverQuestao(questao.id)}
                        className="flex items-center gap-1 text-xs font-medium text-[#b42318]"
                      >
                        <Trash2 className="h-4 w-4" />
                        Remover
                      </button>
                    </div>

                    <label className="block space-y-2">
                      <span className="text-xs font-medium uppercase tracking-[0.08em] text-slate-500">Pergunta</span>
                      <div className="flex items-center rounded-[10px] border border-slate-200 bg-white px-4 py-3">
                        <input
                          value={questao.pergunta}
                          onChange={(event) => handleAtualizarQuestao(questao.id, "pergunta", event.target.value)}
                          placeholder="Digite a pergunta objetiva"
                          className="w-full outline-none"
                        />
                        <Pencil className="h-4 w-4 text-slate-400" />
                      </div>
                    </label>

                    <label className="block space-y-2">
                      <span className="text-xs font-medium uppercase tracking-[0.08em] text-slate-500">
                        Observacao opcional
                      </span>
                      <textarea
                        value={questao.explicacao}
                        onChange={(event) => handleAtualizarQuestao(questao.id, "explicacao", event.target.value)}
                        rows={3}
                        placeholder="Use este campo apenas se quiser guardar uma explicacao interna."
                        className="w-full rounded-[10px] border border-slate-200 bg-white px-4 py-3 text-sm outline-none"
                      />
                    </label>

                    <div className="space-y-3">
                      {questao.alternativas.map((alternativa, alternativaIndex) => {
                        const letra = String.fromCharCode(65 + alternativaIndex);

                        return (
                          <div key={alternativa.id} className="space-y-2">
                            <div className="flex items-center justify-between">
                              <span className="text-xs font-medium uppercase tracking-[0.08em] text-slate-500">
                                Alternativa {letra}
                              </span>

                              <button
                                type="button"
                                onClick={() => handleDefinirCorreta(questao.id, alternativa.id)}
                                className={`rounded-full px-3 py-1 text-[11px] font-semibold ${
                                  alternativa.correta
                                    ? "bg-[#0e5d77] text-white"
                                    : "bg-slate-200 text-slate-600"
                                }`}
                              >
                                {alternativa.correta ? "Correta" : "Marcar correta"}
                              </button>
                            </div>

                            <input
                              value={alternativa.texto}
                              onChange={(event) =>
                                handleAtualizarAlternativa(questao.id, alternativa.id, event.target.value)
                              }
                              placeholder={`Texto da alternativa ${letra}`}
                              className="w-full rounded-[10px] border border-slate-200 bg-white px-4 py-3 text-sm outline-none"
                            />
                          </div>
                        );
                      })}
                    </div>
                  </div>
                ))}

                <button
                  type="button"
                  onClick={handleAdicionarQuestao}
                  className="inline-flex items-center gap-2 text-sm font-semibold text-[#0e5d77]"
                >
                  <CirclePlus className="h-4 w-4" />
                  Adicionar questao
                </button>
              </div>

              <button
                type="button"
                onClick={handleFinalizarQuestoes}
                disabled={salvando}
                className="mx-auto block rounded-[10px] bg-[#0e5d77] px-12 py-3 text-sm font-semibold text-white disabled:opacity-60"
              >
                {salvando ? "Salvando questoes..." : "Finalizar Questoes"}
              </button>
            </div>
          ) : null}
        </section>
      </div>

      <nav className="fixed inset-x-0 bottom-0 z-30 border-t border-slate-200 bg-white px-3 py-3">
        <div className="mx-auto flex max-w-md items-center justify-between">
          <button
            onClick={() => router.push(modulo?.turma_id ? `/turma/${modulo.turma_id}` : "/admin")}
            className="flex flex-col items-center gap-1 text-black"
          >
            <House className="h-7 w-7 fill-current stroke-[1.8]" />
            <span className="text-[10px] font-medium">Inicio</span>
          </button>

          <button
            onClick={() => router.push(modulo?.turma_id ? `/admin/encontros?turma=${modulo.turma_id}` : "/admin/encontros")}
            className="flex flex-col items-center gap-1 text-slate-400"
          >
            <CalendarDays className="h-7 w-7 stroke-[1.8]" />
            <span className="text-[10px] font-medium">Encontros</span>
          </button>

          <button
            onClick={() => router.push(modulo?.turma_id ? `/admin/progresso?turma=${modulo.turma_id}` : "/admin/progresso")}
            className="flex flex-col items-center gap-1 text-slate-400"
          >
            <ChartPie className="h-7 w-7 stroke-[1.8]" />
            <span className="text-[10px] font-medium">Progresso</span>
          </button>

          <button
            onClick={() => router.push("/conta")}
            className="flex flex-col items-center gap-1 text-slate-400"
          >
            <CircleUserRound className="h-7 w-7 stroke-[1.8]" />
            <span className="text-[10px] font-medium">Conta</span>
          </button>
        </div>
      </nav>
    </main>
  );
}
