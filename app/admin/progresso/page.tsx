"use client";

import Image from "next/image";
import { Suspense, useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { CalendarDays, ChartPie, CircleUserRound, FileQuestion, House } from "lucide-react";
import AppLoader from "@/components/AppLoader";
import { useAuth } from "@/contexts/AuthContext";
import { listarProgressoDosAlunosDaTurma, type AlunoProgressoTurma } from "@/lib/atividade-aula";
import { listarAvaliacoesDaTurma, type AvaliacaoResumoTurma } from "@/lib/avaliacoes-admin";
import {
  agendarFechamentoBoletim,
  buscarOfertaBoletim,
  criarOfertaBoletim,
  criarPeriodoLetivo,
  fecharBoletimAgora,
  listarBoletinsDaOferta,
  listarPeriodosLetivos,
  reabrirBoletim,
  salvarNotasBoletim,
  type BoletimAluno,
  type OfertaBoletim,
  type PeriodoLetivo,
} from "@/lib/boletim";
import { listarModulosDaTurma, type ModuloTurma } from "@/lib/modulos";
import { getServiceUnavailableMessage, RequestTimeoutError, withTimeout } from "@/lib/network";
import { listarTurmas, type TurmaAdmin } from "@/lib/turmas";
import { isValidUserRole, type UsuarioProfile } from "@/lib/usuarios";

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

function getIniciaisAluno(aluno: AlunoProgressoTurma) {
  const nome = aluno.nome?.trim();

  if (nome) {
    const partes = nome.split(/\s+/).filter(Boolean);
    const primeira = partes[0]?.[0] ?? "";
    const ultima = partes.length > 1 ? partes[partes.length - 1]?.[0] ?? "" : "";
    return `${primeira}${ultima || primeira}`.toUpperCase();
  }

  return (aluno.email.slice(0, 2) || "AL").toUpperCase();
}

function formatarDataHoraLocal(valor: string | null) {
  if (!valor) return "";
  const data = new Date(valor);
  const local = new Date(data.getTime() - data.getTimezoneOffset() * 60_000);
  return local.toISOString().slice(0, 16);
}

function AdminProgressoPageContent() {
  const { user, profile, profileError, loading } = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();
  const turmaIdSelecionada = searchParams.get("turma");
  const [loadingPage, setLoadingPage] = useState(true);
  const [carregandoDados, setCarregandoDados] = useState(true);
  const [mensagem, setMensagem] = useState("");
  const [turma, setTurma] = useState<TurmaAdmin | null>(null);
  const [turmas, setTurmas] = useState<TurmaAdmin[]>([]);
  const [alunos, setAlunos] = useState<AlunoProgressoTurma[]>([]);
  const [avaliacoes, setAvaliacoes] = useState<AvaliacaoResumoTurma[]>([]);
  const [abaSelecionada, setAbaSelecionada] = useState<"aulas" | "avaliacoes" | "boletim">("aulas");
  const [periodos, setPeriodos] = useState<PeriodoLetivo[]>([]);
  const [modulos, setModulos] = useState<ModuloTurma[]>([]);
  const [periodoId, setPeriodoId] = useState("");
  const [moduloId, setModuloId] = useState("");
  const [novoPeriodo, setNovoPeriodo] = useState("");
  const [boletins, setBoletins] = useState<BoletimAluno[]>([]);
  const [notas, setNotas] = useState<Record<string, { p1: string; p2: string }>>({});
  const [carregandoBoletim, setCarregandoBoletim] = useState(false);
  const [salvandoBoletim, setSalvandoBoletim] = useState(false);
  const [ofertaBoletim, setOfertaBoletim] = useState<OfertaBoletim | null>(null);
  const [fechamentoEm, setFechamentoEm] = useState("");
  const [atualizandoFechamento, setAtualizandoFechamento] = useState(false);

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

    async function carregarProgresso() {
      setCarregandoDados(true);
      setMensagem("");

      try {
        const [turmasResult, periodosResult] = await Promise.all([
          withTimeout(listarTurmas()),
          withTimeout(listarPeriodosLetivos()),
        ]);
        const { turmas: turmasData, error: turmasError } = turmasResult;

        if (turmasError) {
          setMensagem("Nao conseguimos carregar suas turmas agora. Tente novamente em alguns instantes.");
          setCarregandoDados(false);
          return;
        }

        setTurmas(turmasData);
        if (!periodosResult.error) setPeriodos(periodosResult.periodos);

        if (!turmaIdSelecionada) {
          setTurma(null);
          setAlunos([]);
          setModulos([]);
          setCarregandoDados(false);
          return;
        }

        const turmaData = turmasData.find((item) => item.id === turmaIdSelecionada) ?? null;

        const [
          { alunos: alunosData, error: alunosError },
          { avaliacoes: avaliacoesData, error: avaliacoesError },
          { modulos: modulosData, error: modulosError },
        ] = await Promise.all([
          withTimeout(listarProgressoDosAlunosDaTurma(turmaIdSelecionada)),
          withTimeout(listarAvaliacoesDaTurma(turmaIdSelecionada)),
          withTimeout(listarModulosDaTurma(turmaIdSelecionada)),
        ]);

        if (!turmaData) {
          setMensagem("Nao conseguimos carregar esta turma agora. Tente novamente.");
          setCarregandoDados(false);
          return;
        }

        if (alunosError) {
          setMensagem("Nao conseguimos carregar o progresso dos alunos agora.");
          setCarregandoDados(false);
          return;
        }

        if (avaliacoesError) {
          setMensagem("Nao conseguimos carregar as avaliacoes desta turma agora.");
          setCarregandoDados(false);
          return;
        }

        if (modulosError) {
          setMensagem("Nao conseguimos carregar os modulos desta turma agora.");
          setCarregandoDados(false);
          return;
        }

        setTurma(turmaData);
        setAlunos(alunosData);
        setAvaliacoes(avaliacoesData);
        setModulos(modulosData);
      } catch (error) {
        setMensagem(
          error instanceof RequestTimeoutError
            ? getServiceUnavailableMessage()
            : "Nao conseguimos carregar o progresso agora. Tente novamente.",
        );
      } finally {
        setCarregandoDados(false);
      }
    }

    void carregarProgresso();
  }, [loadingPage, turmaIdSelecionada]);

  useEffect(() => {
    async function carregarNotas() {
      if (!periodoId || !moduloId) {
        setBoletins([]);
        setNotas({});
        setOfertaBoletim(null);
        setFechamentoEm("");
        return;
      }

      setCarregandoBoletim(true);
      const { oferta, error: ofertaError } = await buscarOfertaBoletim(periodoId, moduloId);

      if (ofertaError || !oferta) {
        setBoletins([]);
        setNotas({});
        setOfertaBoletim(null);
        setFechamentoEm("");
        setCarregandoBoletim(false);
        return;
      }

      setOfertaBoletim(oferta);
      setFechamentoEm(formatarDataHoraLocal(oferta.fechamento_em));

      const { boletins: boletinsData, error } = await listarBoletinsDaOferta(oferta.id);
      if (error) {
        setMensagem("Nao conseguimos carregar as notas deste boletim agora.");
        setCarregandoBoletim(false);
        return;
      }

      setBoletins(boletinsData);
      setNotas(
        Object.fromEntries(
          boletinsData.map((item) => [
            item.usuario_id,
            { p1: item.p1?.toString() ?? "", p2: item.p2?.toString() ?? "" },
          ]),
        ),
      );
      setCarregandoBoletim(false);
    }

    void carregarNotas();
  }, [moduloId, periodoId]);

  async function handleCriarPeriodo() {
    if (!/^\d{4}\/\d+$/.test(novoPeriodo.trim())) {
      setMensagem("Informe o periodo no formato 2026/2.");
      return;
    }

    const { periodo, error } = await criarPeriodoLetivo(novoPeriodo);
    if (error || !periodo) {
      setMensagem("Nao foi possivel criar o periodo. Verifique se ele ja existe.");
      return;
    }

    setPeriodos((atuais) => [periodo, ...atuais]);
    setPeriodoId(periodo.id);
    setNovoPeriodo("");
    setMensagem("");
  }

  async function handleSalvarBoletim() {
    if (!turmaIdSelecionada || !periodoId || !moduloId) {
      setMensagem("Selecione o periodo e o modulo antes de salvar.");
      return;
    }

    const payload = alunos.map((aluno) => {
      const valores = notas[aluno.usuario_id] ?? { p1: "", p2: "" };
      return {
        usuario_id: aluno.usuario_id,
        p1: valores.p1 === "" ? null : Number(valores.p1.replace(",", ".")),
        p2: valores.p2 === "" ? null : Number(valores.p2.replace(",", ".")),
      };
    });

    if (payload.some((item) => item.p1 !== null && (!Number.isFinite(item.p1) || item.p1 < 0 || item.p1 > 11))) {
      setMensagem("As notas P1 devem estar entre 0 e 11.");
      return;
    }
    if (payload.some((item) => item.p2 !== null && (!Number.isFinite(item.p2) || item.p2 < 0 || item.p2 > 6))) {
      setMensagem("As notas P2 devem estar entre 0 e 6.");
      return;
    }

    setSalvandoBoletim(true);
    setMensagem("");
    let { oferta, error } = await buscarOfertaBoletim(periodoId, moduloId);

    if (!oferta && !error) {
      const resultado = await criarOfertaBoletim(periodoId, turmaIdSelecionada, moduloId);
      oferta = resultado.oferta;
      error = resultado.error;
    }

    if (error || !oferta) {
      setMensagem("Nao foi possivel preparar este boletim agora.");
      setSalvandoBoletim(false);
      return;
    }

    setOfertaBoletim(oferta);

    const { error: notasError } = await salvarNotasBoletim(oferta.id, payload);
    if (notasError) {
      setMensagem("Nao foi possivel salvar as notas agora.");
      setSalvandoBoletim(false);
      return;
    }

    const { boletins: atualizados, error: recargaError } = await listarBoletinsDaOferta(oferta.id);
    if (!recargaError) setBoletins(atualizados);
    setMensagem("Notas salvas com sucesso.");
    setSalvandoBoletim(false);
  }

  async function recarregarBoletim(oferta: OfertaBoletim, mensagemSucesso: string) {
    setOfertaBoletim(oferta);
    setFechamentoEm(formatarDataHoraLocal(oferta.fechamento_em));
    const { boletins: atualizados, error } = await listarBoletinsDaOferta(oferta.id);
    if (!error) setBoletins(atualizados);
    setMensagem(mensagemSucesso);
    setAtualizandoFechamento(false);
  }

  function validarFechamento() {
    const completos = alunos.length > 0
      && boletins.length === alunos.length
      && boletins.every((item) => item.p1 !== null && item.p2 !== null);

    if (!ofertaBoletim) {
      setMensagem("Salve as notas antes de configurar o fechamento.");
      return false;
    }
    if (!completos) {
      setMensagem("Lance e salve P1 e P2 de todos os alunos antes de fechar o boletim.");
      return false;
    }
    return true;
  }

  async function handleAgendarFechamento() {
    if (!validarFechamento() || !ofertaBoletim) return;
    if (!fechamentoEm) {
      setMensagem("Escolha a data e a hora do fechamento.");
      return;
    }

    setAtualizandoFechamento(true);
    const { oferta, error } = await agendarFechamentoBoletim(
      ofertaBoletim.id,
      new Date(fechamentoEm).toISOString(),
    );
    if (error || !oferta) {
      setMensagem("Nao foi possivel agendar o fechamento agora.");
      setAtualizandoFechamento(false);
      return;
    }
    await recarregarBoletim(oferta, "Fechamento agendado com sucesso.");
  }

  async function handleFecharAgora() {
    if (!validarFechamento() || !ofertaBoletim) return;
    if (!window.confirm("Fechar o boletim agora? A CVA sera congelada com o progresso atual.")) return;

    setAtualizandoFechamento(true);
    const { oferta, error } = await fecharBoletimAgora(ofertaBoletim.id);
    if (error || !oferta) {
      setMensagem("Nao foi possivel fechar o boletim agora.");
      setAtualizandoFechamento(false);
      return;
    }
    await recarregarBoletim(oferta, "Boletim fechado com sucesso.");
  }

  async function handleReabrirBoletim() {
    if (!ofertaBoletim) return;
    if (!window.confirm("Reabrir este boletim? A CVA voltara a acompanhar o progresso do aluno.")) return;

    setAtualizandoFechamento(true);
    const { oferta, error } = await reabrirBoletim(ofertaBoletim.id);
    if (error || !oferta) {
      setMensagem("Nao foi possivel reabrir o boletim agora.");
      setAtualizandoFechamento(false);
      return;
    }
    await recarregarBoletim(oferta, "Boletim reaberto com sucesso.");
  }

  const boletimEncerrado = boletins.some((item) => item.encerrado);
  const fechamentoAgendado = Boolean(ofertaBoletim?.fechamento_em) && !boletimEncerrado;
  const dataEncerramento = boletins.find((item) => item.encerramento_efetivo)?.encerramento_efetivo ?? null;

  if (loading || loadingPage) {
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
      </header>

      <div className="mx-auto flex w-full max-w-md flex-col gap-5 px-4">
        <section className="space-y-5">
          <h1 className="text-[2rem] font-semibold leading-none text-[#1c6a91]">
            {turmaIdSelecionada ? "Alunos" : "Progresso"}
          </h1>

          {mensagem ? (
            <p className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
              {mensagem}
            </p>
          ) : null}

          {carregandoDados ? (
            <AppLoader fullScreen={false} />
          ) : null}

          {!carregandoDados && !turmaIdSelecionada ? (
            turmas.length === 0 ? (
              <p className="rounded-[12px] bg-slate-100 px-4 py-6 text-sm text-slate-500">
                Nenhuma turma cadastrada ainda.
              </p>
            ) : (
              <div className="space-y-4">
                {turmas.map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => router.push(`/admin/progresso?turma=${item.id}`)}
                    className="block w-full overflow-hidden rounded-[14px] bg-white text-left shadow-[0_2px_14px_rgba(15,23,42,0.08)] transition hover:shadow-[0_6px_24px_rgba(15,23,42,0.12)]"
                  >
                    <div className="relative h-36 w-full bg-slate-100">
                      {item.capa_url ? (
                        <Image
                          src={item.capa_url}
                          alt={`Capa da turma ${item.nome}`}
                          fill
                          className="object-cover"
                          unoptimized
                        />
                      ) : (
                        <div className="flex h-full items-center justify-center text-sm text-slate-400">
                          Sem capa
                        </div>
                      )}
                    </div>

                    <div className="space-y-3 px-5 py-4">
                      <div className="flex items-start justify-between gap-4">
                        <div className="space-y-2">
                          <h2 className="text-[1.05rem] font-semibold text-slate-900">{item.nome}</h2>
                          <p className="text-xs font-medium uppercase tracking-[0.22em] text-[#89a1c0]">
                            {item.categoria || "sem categoria"}
                          </p>
                        </div>
                      </div>
                    </div>
                  </button>
                ))}
              </div>
            )
          ) : null}

          {!carregandoDados && turmaIdSelecionada && turma ? (
            <>
              <article className="overflow-hidden rounded-[4px] bg-white">
                <div className="relative h-32 w-full bg-slate-100">
                  {turma.capa_url ? (
                    <Image
                      src={turma.capa_url}
                      alt={`Capa da turma ${turma.nome}`}
                      fill
                      className="object-cover"
                      unoptimized
                    />
                  ) : (
                    <div className="flex h-full items-center justify-center text-sm text-slate-400">Sem capa</div>
                  )}
                </div>
              </article>

              <button
                type="button"
                onClick={() => router.push("/admin/progresso")}
                className="text-left text-sm font-medium text-[#1c6a91]"
              >
                Ver outra turma
              </button>

              <div className="grid grid-cols-3 gap-2">
                <button
                  type="button"
                  onClick={() => setAbaSelecionada("aulas")}
                  className={`rounded-[12px] px-4 py-3 text-sm font-semibold transition ${
                    abaSelecionada === "aulas" ? "bg-[#0e5d77] text-white" : "bg-slate-100 text-slate-500"
                  }`}
                >
                  Aulas
                </button>

                <button
                  type="button"
                  onClick={() => setAbaSelecionada("avaliacoes")}
                  className={`rounded-[12px] px-4 py-3 text-sm font-semibold transition ${
                    abaSelecionada === "avaliacoes" ? "bg-[#0e5d77] text-white" : "bg-slate-100 text-slate-500"
                  }`}
                >
                  Avaliacoes
                </button>

                <button
                  type="button"
                  onClick={() => setAbaSelecionada("boletim")}
                  className={`rounded-[12px] px-3 py-3 text-sm font-semibold transition ${
                    abaSelecionada === "boletim" ? "bg-[#0e5d77] text-white" : "bg-slate-100 text-slate-500"
                  }`}
                >
                  Boletim
                </button>
              </div>

              {abaSelecionada === "aulas" ? (
                <>
                  <p className="text-[0.72rem] text-[#d8d8d8]">Todos</p>

                  {alunos.length === 0 ? (
                    <p className="rounded-[12px] bg-slate-100 px-4 py-6 text-sm text-slate-500">
                      Nenhum aluno vinculado a esta turma ainda.
                    </p>
                  ) : (
                    <div className="space-y-6 pt-1">
                      {alunos.map((aluno) => (
                        <button
                          key={aluno.usuario_id}
                          type="button"
                          onClick={() =>
                            router.push(
                              turmaIdSelecionada
                                ? `/admin/progresso/aluno/${aluno.usuario_id}?turma=${turmaIdSelecionada}`
                                : "/admin/progresso",
                            )
                          }
                          className="flex w-full items-center justify-between gap-4 text-left"
                        >
                          <div className="flex min-w-0 items-center gap-3">
                            <div className="flex h-11 w-11 items-center justify-center overflow-hidden rounded-full bg-slate-200 text-sm font-semibold text-slate-700">
                              {aluno.foto_url ? (
                                <Image
                                  src={aluno.foto_url}
                                  alt={aluno.nome || "Foto do aluno"}
                                  width={44}
                                  height={44}
                                  className="h-full w-full object-cover"
                                  unoptimized
                                />
                              ) : (
                                getIniciaisAluno(aluno)
                              )}
                            </div>

                            <p className="truncate text-[1rem] font-medium text-slate-900">
                              {aluno.nome || aluno.email}
                            </p>
                          </div>

                          <div className="shrink-0 pr-1 text-right">
                            <p className="text-[11px] text-slate-300">Progresso de</p>
                            <p className="text-[0.82rem] font-medium text-slate-300">{aluno.progresso_percentual}%</p>
                          </div>
                        </button>
                      ))}
                    </div>
                  )}
                </>
              ) : abaSelecionada === "avaliacoes" ? (
                <div className="space-y-4 pt-1">
                  <p className="text-[0.72rem] text-[#d8d8d8]">Avaliacoes da turma</p>

                  {avaliacoes.length === 0 ? (
                    <p className="rounded-[12px] bg-slate-100 px-4 py-6 text-sm text-slate-500">
                      Nenhuma aula com avaliacao ativa nesta turma ainda.
                    </p>
                  ) : (
                    avaliacoes.map((avaliacao) => (
                      <button
                        key={avaliacao.avaliacao_id}
                        type="button"
                        onClick={() =>
                          router.push(
                            turmaIdSelecionada
                              ? `/admin/progresso/avaliacao/${avaliacao.avaliacao_id}?turma=${turmaIdSelecionada}`
                              : "/admin/progresso",
                          )
                        }
                        className="w-full rounded-[16px] bg-white px-4 py-4 text-left shadow-[0_2px_14px_rgba(15,23,42,0.08)]"
                      >
                        <div className="flex items-start gap-3">
                          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-[#e7f1f6] text-[#0e5d77]">
                            <FileQuestion className="h-5 w-5" />
                          </div>

                          <div className="min-w-0 flex-1 space-y-3">
                            <div>
                              <p className="truncate text-[1rem] font-semibold text-slate-900">{avaliacao.aula_titulo}</p>
                              <p className="text-xs text-slate-400">
                                {avaliacao.modulo_titulo || "Sem modulo"} • {avaliacao.total_alunos} alunos
                              </p>
                            </div>

                            <div className="grid grid-cols-3 gap-2 text-center">
                              <div className="rounded-[10px] bg-slate-50 px-2 py-2">
                                <p className="text-[10px] uppercase tracking-[0.08em] text-slate-400">Fizeram</p>
                                <p className="text-sm font-semibold text-slate-900">{avaliacao.fizeram}</p>
                              </div>
                              <div className="rounded-[10px] bg-[#e9f7ef] px-2 py-2">
                                <p className="text-[10px] uppercase tracking-[0.08em] text-[#5b9776]">100%</p>
                                <p className="text-sm font-semibold text-[#11566C]">{avaliacao.aprovados}</p>
                              </div>
                              <div className="rounded-[10px] bg-[#fbeaea] px-2 py-2">
                                <p className="text-[10px] uppercase tracking-[0.08em] text-[#b05d5d]">Pendentes</p>
                                <p className="text-sm font-semibold text-[#990303]">{avaliacao.pendentes}</p>
                              </div>
                            </div>

                            <div className="flex items-center justify-between text-xs text-slate-400">
                              <span>
                                Media: {avaliacao.media_ultima_nota !== null ? `${avaliacao.media_ultima_nota}%` : "--"}
                              </span>
                              <span>{avaliacao.total_tentativas} tentativas</span>
                            </div>
                          </div>
                        </div>
                      </button>
                    ))
                  )}
                </div>
              ) : (
                <div className="space-y-5 pt-1">
                  <div className="space-y-3 rounded-[14px] bg-slate-50 p-4">
                    <label className="block text-xs font-medium text-slate-500">
                      Periodo
                      <select
                        value={periodoId}
                        onChange={(event) => setPeriodoId(event.target.value)}
                        className="mt-1 w-full rounded-[10px] border border-slate-200 bg-white px-3 py-3 text-sm text-slate-800"
                      >
                        <option value="">Selecione</option>
                        {periodos.map((periodo) => (
                          <option key={periodo.id} value={periodo.id}>{periodo.codigo}</option>
                        ))}
                      </select>
                    </label>

                    <div className="flex gap-2">
                      <input
                        value={novoPeriodo}
                        onChange={(event) => setNovoPeriodo(event.target.value)}
                        placeholder="Novo periodo: 2026/2"
                        className="min-w-0 flex-1 rounded-[10px] border border-slate-200 bg-white px-3 py-3 text-sm"
                      />
                      <button type="button" onClick={handleCriarPeriodo} className="rounded-[10px] bg-slate-800 px-4 text-sm font-medium text-white">
                        Criar
                      </button>
                    </div>

                    <label className="block text-xs font-medium text-slate-500">
                      Modulo
                      <select
                        value={moduloId}
                        onChange={(event) => setModuloId(event.target.value)}
                        className="mt-1 w-full rounded-[10px] border border-slate-200 bg-white px-3 py-3 text-sm text-slate-800"
                      >
                        <option value="">Selecione</option>
                        {modulos.map((modulo) => (
                          <option key={modulo.id} value={modulo.id}>
                            {modulo.codigo ? `${modulo.codigo} - ` : ""}{modulo.titulo}
                          </option>
                        ))}
                      </select>
                    </label>
                  </div>

                  {carregandoBoletim ? <AppLoader fullScreen={false} /> : null}

                  {!carregandoBoletim && periodoId && moduloId ? (
                    <section className="space-y-4 rounded-[16px] border border-slate-200 bg-white p-4 shadow-[0_4px_18px_rgba(15,23,42,0.06)]">
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <h3 className="font-semibold text-slate-900">Fechamento do boletim</h3>
                          <p className="mt-1 text-xs leading-5 text-slate-500">
                            Ao fechar, a CVA considera apenas as videoaulas concluidas ate aquele momento.
                          </p>
                        </div>
                        <span
                          className={`shrink-0 rounded-full px-3 py-1.5 text-[11px] font-semibold ${
                            boletimEncerrado
                              ? "bg-emerald-100 text-emerald-700"
                              : fechamentoAgendado
                                ? "bg-amber-100 text-amber-700"
                                : "bg-slate-100 text-slate-600"
                          }`}
                        >
                          {boletimEncerrado ? "Fechado" : fechamentoAgendado ? "Agendado" : "Em andamento"}
                        </span>
                      </div>

                      {boletimEncerrado ? (
                        <div className="space-y-3">
                          <p className="rounded-[12px] bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
                            Fechado em {dataEncerramento ? new Date(dataEncerramento).toLocaleString("pt-BR") : "data registrada"}.
                          </p>
                          <button
                            type="button"
                            onClick={handleReabrirBoletim}
                            disabled={atualizandoFechamento}
                            className="w-full rounded-[10px] border border-slate-300 px-4 py-3 text-sm font-semibold text-slate-700 disabled:opacity-60"
                          >
                            {atualizandoFechamento ? "Atualizando..." : "Reabrir boletim"}
                          </button>
                        </div>
                      ) : (
                        <div className="space-y-3">
                          <label className="block text-xs font-medium text-slate-600">
                            Data e hora do fechamento
                            <input
                              type="datetime-local"
                              value={fechamentoEm}
                              onChange={(event) => setFechamentoEm(event.target.value)}
                              className="mt-1 w-full rounded-[10px] border border-slate-200 px-3 py-3 text-sm text-slate-900 outline-none focus:border-[#0e5d77]"
                            />
                          </label>
                          <div className="grid grid-cols-2 gap-3">
                            <button
                              type="button"
                              onClick={handleAgendarFechamento}
                              disabled={atualizandoFechamento}
                              className="rounded-[10px] bg-[#dbe8ff] px-3 py-3 text-sm font-semibold text-[#4f45d1] disabled:opacity-60"
                            >
                              Agendar
                            </button>
                            <button
                              type="button"
                              onClick={handleFecharAgora}
                              disabled={atualizandoFechamento}
                              className="rounded-[10px] bg-[#0e5d77] px-3 py-3 text-sm font-semibold text-white disabled:opacity-60"
                            >
                              Fechar agora
                            </button>
                          </div>
                          {!ofertaBoletim ? (
                            <p className="text-xs text-amber-700">Salve as notas para habilitar o fechamento.</p>
                          ) : null}
                        </div>
                      )}
                    </section>
                  ) : null}

                  {!carregandoBoletim && periodoId && moduloId ? (
                    alunos.length === 0 ? (
                      <p className="rounded-[12px] bg-slate-100 px-4 py-6 text-sm text-slate-500">Nenhum aluno nesta turma.</p>
                    ) : (
                      <div className="space-y-3">
                        {alunos.map((aluno) => {
                          const boletim = boletins.find((item) => item.usuario_id === aluno.usuario_id);
                          const valores = notas[aluno.usuario_id] ?? { p1: "", p2: "" };
                          return (
                            <article key={aluno.usuario_id} className="space-y-3 rounded-[14px] border border-slate-200 p-4">
                              <p className="font-medium text-slate-900">{aluno.nome || aluno.email}</p>
                              <div className="grid grid-cols-2 gap-3">
                                <label className="text-xs text-slate-500">P1 / 11
                                  <input
                                    inputMode="decimal"
                                    value={valores.p1}
                                    onChange={(event) => setNotas((atuais) => ({ ...atuais, [aluno.usuario_id]: { ...valores, p1: event.target.value } }))}
                                    className="mt-1 w-full rounded-[8px] border border-slate-200 px-3 py-2 text-sm text-slate-900"
                                  />
                                </label>
                                <label className="text-xs text-slate-500">P2 / 6
                                  <input
                                    inputMode="decimal"
                                    value={valores.p2}
                                    onChange={(event) => setNotas((atuais) => ({ ...atuais, [aluno.usuario_id]: { ...valores, p2: event.target.value } }))}
                                    className="mt-1 w-full rounded-[8px] border border-slate-200 px-3 py-2 text-sm text-slate-900"
                                  />
                                </label>
                              </div>
                              <div className="grid grid-cols-3 gap-2 text-center text-xs">
                                <div className="rounded-[8px] bg-slate-50 p-2"><span className="text-slate-400">CVA</span><p className="font-semibold">{boletim?.cva ?? "—"}</p></div>
                                <div className="rounded-[8px] bg-slate-50 p-2"><span className="text-slate-400">Final</span><p className="font-semibold">{boletim?.final ?? "—"}</p></div>
                                <div className="rounded-[8px] bg-slate-50 p-2"><span className="text-slate-400">Resultado</span><p className="font-semibold">{boletim?.resultado ?? "Em andamento"}</p></div>
                              </div>
                            </article>
                          );
                        })}
                        <button
                          type="button"
                          onClick={handleSalvarBoletim}
                          disabled={salvandoBoletim}
                          className="w-full rounded-[10px] bg-[#0e5d77] px-4 py-3 font-medium text-white disabled:opacity-60"
                        >
                          {salvandoBoletim ? "Salvando..." : "Salvar notas"}
                        </button>
                      </div>
                    )
                  ) : null}
                </div>
              )}
            </>
          ) : null}
        </section>
      </div>

      <nav className="fixed inset-x-0 bottom-0 z-30 border-t border-slate-200 bg-white px-3 py-3">
        <div className="mx-auto flex max-w-md items-center justify-between">
          <button onClick={() => router.push("/admin")} className="flex flex-col items-center gap-1 text-slate-400">
            <House className="h-7 w-7 fill-current stroke-[1.8]" />
            <span className="text-[10px] font-medium">Inicio</span>
          </button>

          <button
            onClick={() => router.push(turmaIdSelecionada ? `/admin/encontros?turma=${turmaIdSelecionada}` : "/admin/encontros")}
            className="flex flex-col items-center gap-1 text-slate-400"
          >
            <CalendarDays className="h-7 w-7 stroke-[1.8]" />
            <span className="text-[10px] font-medium">Encontros</span>
          </button>

          <button className="flex flex-col items-center gap-1 text-black">
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

export default function AdminProgressoPage() {
  return (
    <Suspense fallback={<AppLoader />}>
      <AdminProgressoPageContent />
    </Suspense>
  );
}
