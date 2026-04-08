"use client";

import Image from "next/image";
import { useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import {
  CalendarDays,
  ChartPie,
  CheckCircle2,
  ChevronDown,
  CircleUserRound,
  Clock3,
  House,
  Send,
  ShieldCheck,
} from "lucide-react";
import AppLoader from "@/components/AppLoader";
import NotificationBell from "@/components/NotificationBell";
import { YouTubePlayer } from "@/components/YouTubePlayer";
import { useAuth } from "@/contexts/AuthContext";
import {
  finalizarTentativaDaAvaliacao,
  getStatusDaAvaliacaoDoAlunoNaAula,
  type AvaliacaoAula,
} from "@/lib/avaliacoes";
import { ComentarioAula, criarComentarioDaAula, listarComentariosDaAula } from "@/lib/comentarios";
import { listarConteudoDaTurmaParaAluno } from "@/lib/aluno-dashboard";
import {
  aulaEstaDisponivelParaAluno,
  getAulaComModuloTurma,
  listarMateriaisDaAula,
  type MaterialAula,
} from "@/lib/aulas";
import { getMatriculasDoAluno } from "@/lib/matriculas";
import { getServiceUnavailableMessage, RequestTimeoutError, withTimeout } from "@/lib/network";
import { getProgressoDoAlunoNaAula, salvarConclusaoDaAula } from "@/lib/atividade-aula";
import { sincronizarPublicacoesAgendadas } from "@/lib/publicacoes";
import { isValidUserRole, type UsuarioProfile } from "@/lib/usuarios";

type AulaAlunoCache = {
  tituloAula: string;
  videoUrl: string;
  duracaoTexto: string;
  concluida: boolean;
  materiais: MaterialAula[];
  dicaModulo: string;
};

function getIniciais(profile: UsuarioProfile | null) {
  const nome = profile?.nome?.trim();

  if (nome) {
    const partes = nome.split(/\s+/).filter(Boolean);
    const primeira = partes[0]?.[0] ?? "";
    const ultima = partes.length > 1 ? partes[partes.length - 1]?.[0] ?? "" : "";
    return `${primeira}${ultima || primeira}`.toUpperCase();
  }

  return (profile?.email?.slice(0, 2) || "AL").toUpperCase();
}

function getNomeComentario(alvo: ComentarioAula["autor"]) {
  if (alvo?.nome?.trim()) return alvo.nome;
  return alvo?.email ?? "Usuario";
}

function getIniciaisComentario(alvo: ComentarioAula["autor"]) {
  const nome = alvo?.nome?.trim();

  if (nome) {
    const partes = nome.split(/\s+/).filter(Boolean);
    const primeira = partes[0]?.[0] ?? "";
    const ultima = partes.length > 1 ? partes[partes.length - 1]?.[0] ?? "" : "";
    return `${primeira}${ultima || primeira}`.toUpperCase();
  }

  return (alvo?.email?.slice(0, 2) || "US").toUpperCase();
}

function formatarComentarioData(data: string) {
  return new Date(data).toLocaleString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default function AulaAlunoPage() {
  const { user, profile, profileError, loading } = useAuth();
  const router = useRouter();
  const params = useParams<{ id: string }>();
  const aulaId = Array.isArray(params?.id) ? params.id[0] : params?.id;
  const [loadingPage, setLoadingPage] = useState(true);
  const [carregandoDados, setCarregandoDados] = useState(true);
  const [mensagem, setMensagem] = useState("");
  const [tituloAula, setTituloAula] = useState("");
  const [videoUrl, setVideoUrl] = useState("");
  const [duracaoTexto, setDuracaoTexto] = useState("");
  const [concluida, setConcluida] = useState(false);
  const [materiais, setMateriais] = useState<MaterialAula[]>([]);
  const [materiaisAbertos, setMateriaisAbertos] = useState(true);
  const [dicaModulo, setDicaModulo] = useState("");
  const [salvandoConclusao, setSalvandoConclusao] = useState(false);
  const [comentario, setComentario] = useState("");
  const [comentarios, setComentarios] = useState<ComentarioAula[]>([]);
  const [carregandoComentarios, setCarregandoComentarios] = useState(false);
  const [salvandoComentario, setSalvandoComentario] = useState(false);
  const [avaliacao, setAvaliacao] = useState<AvaliacaoAula | null>(null);
  const [avaliacaoAprovada, setAvaliacaoAprovada] = useState(true);
  const [ultimaNotaAvaliacao, setUltimaNotaAvaliacao] = useState<number | null>(null);
  const [modalAvaliacaoAberto, setModalAvaliacaoAberto] = useState(false);
  const [modalConviteAvaliacaoAberto, setModalConviteAvaliacaoAberto] = useState(false);
  const [respostasAvaliacao, setRespostasAvaliacao] = useState<Record<string, string>>({});
  const [finalizandoAvaliacao, setFinalizandoAvaliacao] = useState(false);
  const [mensagemAvaliacao, setMensagemAvaliacao] = useState("");

  const iniciaisAvatar = useMemo(() => getIniciais(profile), [profile]);
  const storageKey = useMemo(() => (aulaId ? `aula-aluno-cache:${aulaId}` : null), [aulaId]);

  useEffect(() => {
    if (!storageKey || typeof window === "undefined") return;

    const cached = window.sessionStorage.getItem(storageKey);
    if (!cached) return;

    try {
      const payload = JSON.parse(cached) as AulaAlunoCache;
      setTituloAula(payload.tituloAula);
      setVideoUrl(payload.videoUrl);
      setDuracaoTexto(payload.duracaoTexto);
      setConcluida(payload.concluida);
      setMateriais(payload.materiais);
      setDicaModulo(payload.dicaModulo);
      setCarregandoDados(false);
    } catch {
      window.sessionStorage.removeItem(storageKey);
    }
  }, [storageKey]);

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

      if (profile.role === "admin") {
        router.push("/admin");
        return;
      }

      if (!profile.onboarding_concluido) {
        router.push("/boas-vindas");
        return;
      }

      setLoadingPage(false);
    }

    void verificarAcesso();
  }, [loading, profile, profileError, router, user]);

  useEffect(() => {
    if (loadingPage || !aulaId || !user) return;

    const userAtual = user;

    async function carregarTela() {
      const userId = userAtual.id;
      const temCache =
        typeof window !== "undefined" && storageKey ? Boolean(window.sessionStorage.getItem(storageKey)) : false;

      if (!temCache) {
        setCarregandoDados(true);
      }

      setMensagem("");

      try {
        await sincronizarPublicacoesAgendadas();

        const [{ aula, error: aulaError }, { progresso, error: progressoError }] = await Promise.all([
          withTimeout(getAulaComModuloTurma(aulaId)),
          withTimeout(getProgressoDoAlunoNaAula(aulaId, userId)),
        ]);

        if (aulaError || !aula || !aula.modulos?.turmas) {
          setMensagem("Nao conseguimos carregar esta aula agora. Tente novamente.");
          setCarregandoDados(false);
          return;
        }

        if (progressoError) {
          setMensagem("Nao conseguimos carregar seu progresso nesta aula agora.");
          setCarregandoDados(false);
          return;
        }

        const { matriculas, error: matriculaError } = await withTimeout(getMatriculasDoAluno(userId));

        if (matriculaError) {
          setMensagem("Nao conseguimos verificar sua turma agora. Tente novamente em alguns instantes.");
          setCarregandoDados(false);
          return;
        }

        const matricula = matriculas[0];
        const turmaDoAluno = matricula?.turma_id;

        if (!turmaDoAluno || turmaDoAluno !== aula.modulos.turmas.id) {
          if (storageKey && typeof window !== "undefined") {
            window.sessionStorage.removeItem(storageKey);
          }
          router.push("/dashboard");
          return;
        }

        if (matricula.acesso_bloqueado || aula.modulos.turmas.arquivada || !aulaEstaDisponivelParaAluno(aula) || aula.bloqueado) {
          if (storageKey && typeof window !== "undefined") {
            window.sessionStorage.removeItem(storageKey);
          }
          router.push("/dashboard");
          return;
        }

        const [
          { materiais: materiaisData, error: materiaisError },
          { modulos: conteudoTurma, error: conteudoError },
          { status: statusAvaliacao, error: statusAvaliacaoError },
        ] = await Promise.all([
          withTimeout(listarMateriaisDaAula(aulaId)),
          withTimeout(listarConteudoDaTurmaParaAluno(matricula.turma_id, userId)),
          withTimeout(getStatusDaAvaliacaoDoAlunoNaAula(aulaId, userId)),
        ]);

        if (materiaisError || conteudoError || statusAvaliacaoError) {
          setMensagem("Nao conseguimos carregar esta aula por completo agora. Tente novamente.");
          setCarregandoDados(false);
          return;
        }

        const aulaNaJornada = conteudoTurma.flatMap((modulo) => modulo.aulas).find((item) => item.id === aulaId);

        if (!aulaNaJornada || aulaNaJornada.bloqueado_por_avaliacao) {
          if (storageKey && typeof window !== "undefined") {
            window.sessionStorage.removeItem(storageKey);
          }
          router.push("/dashboard");
          return;
        }

        setTituloAula(aula.titulo);
        setVideoUrl(aula.video_url ?? "");
        setDuracaoTexto(aula.duracao_texto ?? "");
        setConcluida(progresso?.concluido ?? false);
        setMateriais(materiaisData);
        setDicaModulo(aula.modulos.titulo);
        setAvaliacao(statusAvaliacao?.avaliacao ?? null);
        setAvaliacaoAprovada(statusAvaliacao?.aprovada ?? true);
        setUltimaNotaAvaliacao(statusAvaliacao?.ultimaNotaPercentual ?? null);

        if (storageKey && typeof window !== "undefined") {
          const payload: AulaAlunoCache = {
            tituloAula: aula.titulo,
            videoUrl: aula.video_url ?? "",
            duracaoTexto: aula.duracao_texto ?? "",
            concluida: progresso?.concluido ?? false,
            materiais: materiaisData,
            dicaModulo: aula.modulos.titulo,
          };
          window.sessionStorage.setItem(storageKey, JSON.stringify(payload));
        }
      } catch (error) {
        setMensagem(
          error instanceof RequestTimeoutError
            ? getServiceUnavailableMessage()
            : "Nao conseguimos carregar esta aula agora. Tente novamente.",
        );
      } finally {
        setCarregandoDados(false);
      }
    }

    void carregarTela();
  }, [aulaId, loadingPage, router, storageKey, user]);

  useEffect(() => {
    if (loadingPage || !aulaId || !user) return;

    async function carregarComentarios() {
      setCarregandoComentarios(true);

      try {
        const { comentarios: comentariosData, error } = await withTimeout(listarComentariosDaAula(aulaId));

        if (!error) {
          setComentarios(comentariosData);
        }
      } finally {
        setCarregandoComentarios(false);
      }
    }

    void carregarComentarios();
  }, [aulaId, loadingPage, user]);

  async function handleMarcarConcluida(valor: boolean) {
    if (!user || !aulaId) return;
    if (!valor && concluida) return;

    setSalvandoConclusao(true);
    setMensagem("");

    const { error } = await salvarConclusaoDaAula(aulaId, user.id, valor);

    if (error) {
      setMensagem("Nao foi possivel atualizar a conclusao da aula agora. Tente novamente.");
      setSalvandoConclusao(false);
      return;
    }

    setConcluida(valor);

    if (valor && avaliacao && !avaliacaoAprovada) {
      setModalConviteAvaliacaoAberto(true);
    }

    if (storageKey && typeof window !== "undefined") {
      const cached = window.sessionStorage.getItem(storageKey);
      if (cached) {
        try {
          const payload = JSON.parse(cached) as AulaAlunoCache;
          payload.concluida = valor;
          window.sessionStorage.setItem(storageKey, JSON.stringify(payload));
        } catch {
          window.sessionStorage.removeItem(storageKey);
        }
      }
    }

    setSalvandoConclusao(false);
  }

  function resetarTentativaAvaliacao() {
    setRespostasAvaliacao({});
    setMensagemAvaliacao("");
    setModalAvaliacaoAberto(false);
  }

  function abrirAvaliacao() {
    setMensagemAvaliacao("");
    setRespostasAvaliacao({});
    setModalConviteAvaliacaoAberto(false);
    setModalAvaliacaoAberto(true);
  }

  async function handleFinalizarAvaliacao() {
    if (!user || !aulaId || !avaliacao) return;

    setFinalizandoAvaliacao(true);
    setMensagemAvaliacao("");

    const respostas = avaliacao.questoes.map((questao) => ({
      questaoId: questao.id,
      alternativaId: respostasAvaliacao[questao.id] ?? "",
    }));

    const { resultado, error } = await finalizarTentativaDaAvaliacao(aulaId, user.id, respostas);

    if (error || !resultado) {
      setMensagemAvaliacao(error?.message || "Nao conseguimos finalizar a avaliacao agora.");
      setFinalizandoAvaliacao(false);
      return;
    }

    if (!resultado.aprovado) {
      setUltimaNotaAvaliacao(resultado.notaPercentual);
      setMensagemAvaliacao(
        `Voce acertou ${resultado.acertos} de ${resultado.total}. Para avancar, voce precisa acertar 100%.`,
      );
      setRespostasAvaliacao({});
      setFinalizandoAvaliacao(false);
      return;
    }

    setAvaliacaoAprovada(true);
    setUltimaNotaAvaliacao(resultado.notaPercentual);
    setMensagemAvaliacao("");
    setModalAvaliacaoAberto(false);
    setRespostasAvaliacao({});
    setFinalizandoAvaliacao(false);
  }

  async function handleEnviarComentario() {
    if (!user || !aulaId || !comentario.trim()) {
      setMensagem("Escreva um comentario para enviar.");
      return;
    }

    setSalvandoComentario(true);
    setMensagem("");

    const { error } = await criarComentarioDaAula(aulaId, user.id, comentario);

    if (error) {
      setMensagem("Nao foi possivel enviar o comentario agora. Tente novamente.");
      setSalvandoComentario(false);
      return;
    }

    const { comentarios: comentariosData, error: listarError } = await listarComentariosDaAula(aulaId);

    if (!listarError) {
      setComentarios(comentariosData);
    }

    setComentario("");
    setSalvandoComentario(false);
  }

  if (loading || loadingPage) {
    return <AppLoader />;
  }

  return (
    <main className="min-h-screen bg-white pb-28 pt-28">
      <header className="fixed inset-x-0 top-0 z-30 bg-white px-4 pb-4 pt-5">
        <div className="mx-auto flex max-w-md items-center justify-between">
          <div className="w-[94px]">
            <button onClick={() => router.push("/dashboard")} className="w-12 text-left text-sm text-slate-600">
              Voltar
            </button>
          </div>

          <Image
            src="/img/logo.svg"
            alt="Escola de Ministros"
            width={147}
            height={49}
            className="h-10 w-auto object-contain"
            priority
          />

          <div className="flex items-center justify-end gap-3">
            <NotificationBell userId={user?.id} />
            <button
              onClick={() => router.push("/conta")}
              className="flex h-11 w-11 items-center justify-center overflow-hidden rounded-full bg-slate-200 text-sm font-semibold text-slate-700"
            >
              {profile?.foto_url ? (
                <Image
                  src={profile.foto_url}
                  alt={profile.nome || "Foto de perfil"}
                  width={44}
                  height={44}
                  className="h-full w-full object-cover"
                  unoptimized
                />
              ) : (
                iniciaisAvatar
              )}
            </button>
          </div>
        </div>
      </header>

      <div className="mx-auto flex w-full max-w-md flex-col gap-6 px-4">
        {carregandoDados ? (
          <AppLoader fullScreen={false} />
        ) : (
          <section className="space-y-5">
            <h1 className="text-[2rem] font-semibold leading-none text-[#1c6a91]">{tituloAula}</h1>

            {dicaModulo ? <p className="text-xs text-[#d8d8d8]">{dicaModulo}</p> : null}

            {mensagem ? (
              <p className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                {mensagem}
              </p>
            ) : null}

            {videoUrl ? (
              <YouTubePlayer
                url={videoUrl}
                title={tituloAula}
                className="overflow-hidden rounded-[4px] bg-black"
                onEnded={() => {
                  if (!concluida) {
                    void handleMarcarConcluida(true);
                  }
                }}
              />
            ) : null}

            <button
              type="button"
              onClick={() => void handleMarcarConcluida(true)}
              disabled={salvandoConclusao || concluida}
              className={`flex items-center gap-2 text-base font-medium ${
                concluida ? "text-[#11a6db]" : "text-[#c8c8c8]"
              }`}
            >
              <span>{concluida ? "Aula concluida" : "Marcar aula como Concluida"}</span>
              <CheckCircle2 className="h-5 w-5" strokeWidth={2.4} />
            </button>

            {avaliacao && concluida && !avaliacaoAprovada ? (
              <button
                type="button"
                onClick={abrirAvaliacao}
                className="flex items-center justify-center gap-2 rounded-[10px] bg-[#1f9d55] px-5 py-3 text-sm font-semibold text-white shadow-[0_8px_24px_rgba(31,157,85,0.25)]"
              >
                <ShieldCheck className="h-4 w-4" />
                Fazer avaliacao
              </button>
            ) : null}

            {avaliacao && avaliacaoAprovada ? (
              <div className="rounded-[10px] border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-medium text-emerald-700">
                Avaliacao concluida com sucesso.
              </div>
            ) : null}

            {avaliacao && concluida && !avaliacaoAprovada && ultimaNotaAvaliacao !== null ? (
              <p className="text-sm text-slate-500">Sua ultima nota nesta avaliacao foi {ultimaNotaAvaliacao}%.</p>
            ) : null}

            {duracaoTexto ? (
              <div className="flex items-center gap-1 text-xs text-slate-400">
                <Clock3 className="h-3 w-3" />
                <span>{duracaoTexto}</span>
              </div>
            ) : null}

            <div className="bg-[#555555] px-5 py-4 text-white">
              <div className="flex items-center justify-between gap-3">
                <span className="text-base font-medium">Materiais Complementares</span>
                <button type="button" onClick={() => setMateriaisAbertos((estadoAtual) => !estadoAtual)}>
                  <ChevronDown className={`h-4 w-4 transition-transform ${materiaisAbertos ? "rotate-180" : ""}`} />
                </button>
              </div>

              {materiaisAbertos ? (
                <div className="mt-5 space-y-3">
                  {materiais.length === 0 ? (
                    <p className="text-sm text-white/75">Nenhum material complementar nesta aula.</p>
                  ) : (
                    materiais.map((material) => (
                      <a
                        key={material.id}
                        href={material.arquivo_url}
                        target="_blank"
                        rel="noreferrer"
                        className="block text-sm underline underline-offset-4"
                      >
                        {material.titulo}
                      </a>
                    ))
                  )}
                </div>
              ) : null}
            </div>

            <div className="space-y-4">
              <h2 className="text-[1.3rem] font-medium text-slate-900">Comentarios</h2>
              <textarea
                value={comentario}
                onChange={(event) => setComentario(event.target.value)}
                placeholder="Escreva um comentario sobre esta aula"
                className="min-h-[120px] w-full rounded-[10px] border border-slate-200 bg-slate-50 px-4 py-3 text-sm outline-none"
              />
              <button
                type="button"
                onClick={() => void handleEnviarComentario()}
                disabled={salvandoComentario}
                className="ml-auto flex items-center gap-2 rounded-[8px] bg-[#0e5d77] px-5 py-3 text-sm font-medium text-white disabled:opacity-60"
              >
                {salvandoComentario ? "Enviando..." : "Enviar"}
                <Send className="h-4 w-4" />
              </button>

              <div className="space-y-4">
                {carregandoComentarios ? (
                  <div className="rounded-[16px] border border-slate-200 px-4 py-5 text-sm text-slate-500">
                    Carregando comentarios...
                  </div>
                ) : comentarios.length === 0 ? (
                  <div className="rounded-[16px] border border-slate-200 px-4 py-5 text-sm text-slate-500">
                    Nenhum comentario nesta aula ainda.
                  </div>
                ) : (
                  comentarios.map((item) => (
                    <div key={item.id} className="space-y-3 rounded-[18px] border border-slate-200 bg-white px-4 py-4">
                      <div className="flex items-start gap-3">
                        <div className="flex h-11 w-11 shrink-0 items-center justify-center overflow-hidden rounded-full bg-slate-200 text-xs font-semibold text-slate-700">
                          {item.autor?.foto_url ? (
                            <Image
                              src={item.autor.foto_url}
                              alt={getNomeComentario(item.autor)}
                              width={44}
                              height={44}
                              className="h-full w-full object-cover"
                              unoptimized
                            />
                          ) : (
                            getIniciaisComentario(item.autor)
                          )}
                        </div>

                        <div className="min-w-0 flex-1 space-y-1">
                          <div className="flex flex-wrap items-center justify-between gap-2">
                            <p className="text-sm font-semibold text-slate-900">{getNomeComentario(item.autor)}</p>
                            <p className="text-xs text-slate-400">{formatarComentarioData(item.criado_em)}</p>
                          </div>
                          <p className="text-sm leading-6 text-slate-700">{item.comentario}</p>
                        </div>
                      </div>

                      {item.respostas.length > 0 ? (
                        <div className="space-y-3 border-l-2 border-slate-100 pl-4">
                          {item.respostas.map((resposta) => (
                            <div key={resposta.id} className="flex items-start gap-3">
                              <div className="flex h-9 w-9 shrink-0 items-center justify-center overflow-hidden rounded-full bg-slate-200 text-[11px] font-semibold text-slate-700">
                                {resposta.autor?.foto_url ? (
                                  <Image
                                    src={resposta.autor.foto_url}
                                    alt={getNomeComentario(resposta.autor)}
                                    width={36}
                                    height={36}
                                    className="h-full w-full object-cover"
                                    unoptimized
                                  />
                                ) : (
                                  getIniciaisComentario(resposta.autor)
                                )}
                              </div>

                              <div className="min-w-0 flex-1 space-y-1">
                                <div className="flex flex-wrap items-center justify-between gap-2">
                                  <p className="text-sm font-semibold text-slate-900">{getNomeComentario(resposta.autor)}</p>
                                  <p className="text-xs text-slate-400">{formatarComentarioData(resposta.criado_em)}</p>
                                </div>
                                <p className="text-sm leading-6 text-slate-700">{resposta.comentario}</p>
                              </div>
                            </div>
                          ))}
                        </div>
                      ) : null}
                    </div>
                  ))
                )}
              </div>
            </div>
          </section>
        )}
      </div>

      {modalConviteAvaliacaoAberto ? (
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-slate-950/45 px-4">
          <div className="w-full max-w-sm rounded-[24px] bg-white px-6 py-6 shadow-[0_24px_80px_rgba(15,23,42,0.28)]">
            <div className="space-y-3">
              <p className="text-xs font-semibold uppercase tracking-[0.24em] text-[#1f9d55]">Avaliacao disponivel</p>
              <h3 className="text-2xl font-semibold text-slate-900">Agora falta concluir sua avaliacao</h3>
                <p className="text-sm leading-6 text-slate-600">
                  {avaliacao?.exigir_aprovacao_para_avancar
                    ? "Para desbloquear a proxima aula, voce precisa acertar 100% da miniavaliacao desta aula."
                    : "Sua miniavaliacao desta aula ja esta disponivel para voce responder agora ou depois."}
                </p>
              </div>
            <div className="mt-6 flex gap-3">
              <button
                type="button"
                onClick={() => setModalConviteAvaliacaoAberto(false)}
                className="flex-1 rounded-[12px] border border-slate-200 px-4 py-3 text-sm font-medium text-slate-600"
              >
                Depois
              </button>
              <button
                type="button"
                onClick={abrirAvaliacao}
                className="flex-1 rounded-[12px] bg-[#1f9d55] px-4 py-3 text-sm font-semibold text-white"
              >
                Fazer avaliacao agora
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {modalAvaliacaoAberto && avaliacao ? (
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-slate-950/50 px-4">
          <div className="w-full max-w-md rounded-[28px] bg-white px-5 py-6 shadow-[0_24px_80px_rgba(15,23,42,0.3)]">
            <div className="space-y-2">
              <p className="text-xs font-semibold uppercase tracking-[0.24em] text-[#1f9d55]">Miniavaliacao</p>
              <h3 className="text-2xl font-semibold text-slate-900">{tituloAula}</h3>
              <p className="text-sm leading-6 text-slate-600">
                Responda todas as questoes. Se voce sair desta tela, a tentativa sera zerada.
              </p>
            </div>

            <div className="mt-5 max-h-[54vh] space-y-4 overflow-y-auto pr-1">
              {avaliacao.questoes.map((questao, index) => (
                <div key={questao.id} className="rounded-[18px] border border-slate-200 px-4 py-4">
                  <p className="text-sm font-semibold text-slate-900">
                    {index + 1}. {questao.pergunta}
                  </p>
                  <div className="mt-3 space-y-2">
                    {questao.alternativas.map((alternativa) => {
                      const selecionada = respostasAvaliacao[questao.id] === alternativa.id;

                      return (
                        <button
                          key={alternativa.id}
                          type="button"
                          onClick={() =>
                            setRespostasAvaliacao((estadoAtual) => ({
                              ...estadoAtual,
                              [questao.id]: alternativa.id,
                            }))
                          }
                          className={`flex w-full items-center gap-3 rounded-[14px] border px-4 py-3 text-left text-sm transition ${
                            selecionada
                              ? "border-[#1f9d55] bg-emerald-50 text-emerald-800"
                              : "border-slate-200 bg-white text-slate-700"
                          }`}
                        >
                          <span
                            className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full border text-[11px] font-semibold ${
                              selecionada ? "border-[#1f9d55] bg-[#1f9d55] text-white" : "border-slate-300 text-slate-500"
                            }`}
                          >
                            {String.fromCharCode(64 + alternativa.ordem)}
                          </span>
                          <span>{alternativa.texto}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>

            {mensagemAvaliacao ? (
              <p className="mt-4 rounded-[14px] border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
                {mensagemAvaliacao}
              </p>
            ) : null}

            <div className="mt-5 flex gap-3">
              <button
                type="button"
                onClick={resetarTentativaAvaliacao}
                className="flex-1 rounded-[12px] border border-slate-200 px-4 py-3 text-sm font-medium text-slate-600"
              >
                Sair
              </button>
              <button
                type="button"
                onClick={() => void handleFinalizarAvaliacao()}
                disabled={finalizandoAvaliacao}
                className="flex-1 rounded-[12px] bg-[#1f9d55] px-4 py-3 text-sm font-semibold text-white disabled:opacity-60"
              >
                {finalizandoAvaliacao ? "Finalizando..." : "Finalizar avaliacao"}
              </button>
            </div>
          </div>
        </div>
      ) : null}

      <nav className="fixed inset-x-0 bottom-0 z-30 border-t border-slate-200 bg-white px-3 py-3">
        <div className="mx-auto flex max-w-md items-center justify-between">
          <button onClick={() => router.push("/dashboard")} className="flex flex-col items-center gap-1 text-black">
            <House className="h-7 w-7 fill-current stroke-[1.8]" />
            <span className="text-[10px] font-medium">Inicio</span>
          </button>

          <button onClick={() => router.push("/encontros")} className="flex flex-col items-center gap-1 text-slate-400">
            <CalendarDays className="h-7 w-7 stroke-[1.8]" />
            <span className="text-[10px] font-medium">Encontros</span>
          </button>

          <button onClick={() => router.push("/progresso")} className="flex flex-col items-center gap-1 text-slate-400">
            <ChartPie className="h-7 w-7 stroke-[1.8]" />
            <span className="text-[10px] font-medium">Progresso</span>
          </button>

          <button onClick={() => router.push("/conta")} className="flex flex-col items-center gap-1 text-slate-400">
            <CircleUserRound className="h-7 w-7 stroke-[1.8]" />
            <span className="text-[10px] font-medium">Conta</span>
          </button>
        </div>
      </nav>
    </main>
  );
}
