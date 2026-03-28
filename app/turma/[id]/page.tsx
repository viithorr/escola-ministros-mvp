"use client";

import Image from "next/image";
import { useEffect, useMemo, useState } from "react";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import {
  CalendarDays,
  ChartPie,
  ChevronDown,
  Check,
  Copy,
  CirclePlus,
  CircleUserRound,
  House,
  Pencil,
  Clock3,
  Trash2,
  UserRound,
} from "lucide-react";
import AppLoader from "@/components/AppLoader";
import { useAuth } from "@/contexts/AuthContext";
import { arquivarTurma, excluirTurma } from "@/lib/admin-turmas";
import { AulaModulo } from "@/lib/aulas";
import {
  atualizarModulo,
  criarModulo,
  excluirModulo,
  listarModulosComAulasDaTurma,
  ModuloTurma,
} from "@/lib/modulos";
import { getServiceUnavailableMessage, RequestTimeoutError, withTimeout } from "@/lib/network";
import { supabase } from "@/lib/supabase";
import { atualizarNomeTurma, getTurmaById, TurmaAdmin } from "@/lib/turmas";
import { isValidUserRole, UsuarioProfile } from "@/lib/usuarios";

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

export default function TurmaPage() {
  const { user, profile, profileError, loading } = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();
  const params = useParams<{ id: string }>();
  const turmaId = Array.isArray(params?.id) ? params.id[0] : params?.id;
  const moduloEmFoco = searchParams.get("modulo");
  const [loadingPage, setLoadingPage] = useState(true);
  const [carregandoDados, setCarregandoDados] = useState(true);
  const [mensagem, setMensagem] = useState("");
  const [turma, setTurma] = useState<TurmaAdmin | null>(null);
  const [modulos, setModulos] = useState<ModuloTurma[]>([]);
  const [aulasPorModulo, setAulasPorModulo] = useState<Record<string, AulaModulo[]>>({});
  const [mostrarModal, setMostrarModal] = useState(false);
  const [mostrarModalTurma, setMostrarModalTurma] = useState(false);
  const [modoModal, setModoModal] = useState<"criar" | "editar">("criar");
  const [nomeModulo, setNomeModulo] = useState("");
  const [nomeTurmaEdicao, setNomeTurmaEdicao] = useState("");
  const [moduloEmEdicao, setModuloEmEdicao] = useState<string | null>(null);
  const [salvandoModulo, setSalvandoModulo] = useState(false);
  const [salvandoTurma, setSalvandoTurma] = useState(false);
  const [moduloExpandido, setModuloExpandido] = useState<string | null>(null);
  const [moduloParaExcluir, setModuloParaExcluir] = useState<ModuloTurma | null>(null);
  const [excluindoModulo, setExcluindoModulo] = useState(false);
  const [copiado, setCopiado] = useState(false);
  const [acaoTurma, setAcaoTurma] = useState<"arquivar" | "excluir" | null>(null);
  const [senhaConfirmacao, setSenhaConfirmacao] = useState("");
  const [executandoAcaoTurma, setExecutandoAcaoTurma] = useState(false);

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
    if (loadingPage || !turmaId) return;

    async function carregarTela() {
      setCarregandoDados(true);
      setMensagem("");

      try {
        const [{ turma: turmaData, error: turmaError }, { modulos: modulosData, error: modulosError }] = await Promise.all([
          withTimeout(getTurmaById(turmaId)),
          withTimeout(listarModulosComAulasDaTurma(turmaId)),
        ]);

        if (turmaError || !turmaData) {
          setMensagem("Nao conseguimos carregar esta turma agora. Tente novamente.");
          setCarregandoDados(false);
          return;
        }

        if (modulosError) {
          setMensagem("Nao conseguimos carregar os modulos desta turma agora.");
          setCarregandoDados(false);
          return;
        }

        const agrupadas = modulosData.reduce<Record<string, AulaModulo[]>>((acc, modulo) => {
          acc[modulo.id] = modulo.aulas ?? [];
          return acc;
        }, {});

        setTurma(turmaData);
        setModulos(modulosData);
        setAulasPorModulo(agrupadas);
        setModuloExpandido((atual) => atual ?? moduloEmFoco ?? modulosData[0]?.id ?? null);
      } catch (error) {
        setMensagem(
          error instanceof RequestTimeoutError
            ? getServiceUnavailableMessage()
            : "Nao conseguimos carregar esta turma agora. Tente novamente.",
        );
      } finally {
        setCarregandoDados(false);
      }
    }

    void carregarTela();
  }, [loadingPage, moduloEmFoco, turmaId]);

  async function handleSalvarModulo() {
    if (!turmaId) return;

    if (!nomeModulo.trim()) {
      setMensagem("Digite o nome do modulo para continuar.");
      return;
    }

    setSalvandoModulo(true);
    setMensagem("");

    if (modoModal === "editar" && moduloEmEdicao) {
      const { modulo, error } = await atualizarModulo(moduloEmEdicao, nomeModulo);

      if (error || !modulo) {
        setMensagem("Nao foi possivel salvar o modulo agora. Tente novamente.");
        setSalvandoModulo(false);
        return;
      }

      setModulos((estadoAtual) =>
        estadoAtual.map((item) => (item.id === modulo.id ? { ...item, titulo: modulo.titulo } : item)),
      );
      setNomeModulo("");
      setModuloEmEdicao(null);
      setMostrarModal(false);
      setSalvandoModulo(false);
      return;
    }

    const { modulo, error } = await criarModulo(turmaId, nomeModulo);

    if (error || !modulo) {
      setMensagem("Nao foi possivel criar o modulo agora. Tente novamente.");
      setSalvandoModulo(false);
      return;
    }

    setModulos((estadoAtual) => [...estadoAtual, modulo].sort((a, b) => (a.ordem ?? 0) - (b.ordem ?? 0)));
    setAulasPorModulo((estadoAtual) => ({
      ...estadoAtual,
      [modulo.id]: [],
    }));
    setModuloExpandido(modulo.id);
    setNomeModulo("");
    setMostrarModal(false);
    setSalvandoModulo(false);
  }

  async function handleExcluirModulo() {
    if (!moduloParaExcluir) return;

    setExcluindoModulo(true);
    setMensagem("");

    const { error } = await excluirModulo(moduloParaExcluir.id);

    if (error) {
      setMensagem("Nao foi possivel excluir o modulo agora. Tente novamente.");
      setExcluindoModulo(false);
      return;
    }

    const modulosAtualizados = modulos.filter((item) => item.id !== moduloParaExcluir.id);

    setModulos(modulosAtualizados);
    setAulasPorModulo((estadoAtual) => {
      const proximoEstado = { ...estadoAtual };
      delete proximoEstado[moduloParaExcluir.id];
      return proximoEstado;
    });
    setModuloExpandido((atual) => {
      if (atual !== moduloParaExcluir.id) return atual;
      return modulosAtualizados[0]?.id ?? null;
    });
    setModuloParaExcluir(null);
    setExcluindoModulo(false);
  }

  async function handleCopiarCodigo() {
    if (!turma?.codigo_entrada) return;

    try {
      await navigator.clipboard.writeText(turma.codigo_entrada);
      setCopiado(true);
      window.setTimeout(() => setCopiado(false), 1800);
    } catch {
      setMensagem("Nao foi possivel copiar o codigo da turma agora.");
    }
  }

  async function handleSalvarNomeTurma() {
    if (!turma) return;

    if (!nomeTurmaEdicao.trim()) {
      setMensagem("Digite o nome da turma para continuar.");
      return;
    }

    setSalvandoTurma(true);
    setMensagem("");

    const { turma: turmaAtualizada, error } = await atualizarNomeTurma(turma.id, nomeTurmaEdicao);

    if (error || !turmaAtualizada) {
      setMensagem("Nao foi possivel salvar o nome da turma agora. Tente novamente.");
      setSalvandoTurma(false);
      return;
    }

    setTurma(turmaAtualizada);
    setNomeTurmaEdicao(turmaAtualizada.nome);
    setMostrarModalTurma(false);
    setSalvandoTurma(false);
  }

  async function validarSenhaAdmin() {
    if (!profile?.email || !senhaConfirmacao.trim()) {
      setMensagem("Digite a senha do administrador para continuar.");
      return false;
    }

    const { error } = await supabase.auth.signInWithPassword({
      email: profile.email,
      password: senhaConfirmacao,
    });

    if (error) {
      setMensagem("Senha invalida. Confira e tente novamente.");
      return false;
    }

    return true;
  }

  async function handleConfirmarAcaoTurma() {
    if (!turma || !acaoTurma) return;

    setExecutandoAcaoTurma(true);
    setMensagem("");

    const senhaValida = await validarSenhaAdmin();

    if (!senhaValida) {
      setExecutandoAcaoTurma(false);
      return;
    }

    if (acaoTurma === "arquivar") {
      const { error } = await arquivarTurma(turma.id, !turma.arquivada);

      if (error) {
        setMensagem(error);
        setExecutandoAcaoTurma(false);
        return;
      }

      setTurma((estadoAtual) =>
        estadoAtual
          ? {
              ...estadoAtual,
              arquivada: !estadoAtual.arquivada,
              arquivada_em: !estadoAtual.arquivada ? new Date().toISOString() : null,
            }
          : estadoAtual,
      );
      setSenhaConfirmacao("");
      setAcaoTurma(null);
      setExecutandoAcaoTurma(false);
      return;
    }

    const { error } = await excluirTurma(turma.id);

    if (error) {
      setMensagem(error);
      setExecutandoAcaoTurma(false);
      return;
    }

    router.push("/admin");
  }

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
            {iniciaisAvatar}
          </button>
        </div>
      </header>

      <div className="mx-auto flex w-full max-w-md flex-col gap-5 px-4">
        <section className="space-y-5">
          {mensagem && !mostrarModal ? (
            <p className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
              {mensagem}
            </p>
          ) : null}

          {carregandoDados ? (
            <AppLoader fullScreen={false} />
          ) : null}

          {!carregandoDados && turma ? (
            <>
              <div className="flex items-start justify-between gap-6">
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="truncate text-[1.15rem] font-semibold text-slate-900">{turma.nome}</p>
                    <button
                      type="button"
                      onClick={() => {
                        setNomeTurmaEdicao(turma.nome);
                        setMensagem("");
                        setMostrarModalTurma(true);
                      }}
                      className="shrink-0 text-slate-900"
                      aria-label="Editar nome da turma"
                    >
                      <Pencil className="h-4 w-4 stroke-[2]" />
                    </button>
                  </div>
                  <p className="mt-2 text-xs uppercase tracking-[0.25em] text-[#97abd8]">
                    {turma.categoria ? turma.categoria : "Sem categoria"}
                  </p>
                </div>

                <div className="shrink-0 text-right">
                  <p className="text-xs text-slate-400">Codigo da Turma</p>
                  <button
                    type="button"
                    onClick={handleCopiarCodigo}
                    className="mt-2 inline-flex items-center gap-2 rounded-full bg-[#eef6ff] px-3 py-1.5 text-[0.9rem] font-medium tracking-[0.2em] text-[#2b66a1]"
                  >
                    <span>{turma.codigo_entrada}</span>
                    {copiado ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                  </button>
                </div>
              </div>

              <article className="overflow-hidden rounded-[12px] bg-white shadow-[0_2px_14px_rgba(15,23,42,0.08)]">
                <div className="relative h-36 w-full bg-slate-100">
                  {turma.capa_url ? (
                    <Image
                      src={turma.capa_url}
                      alt={`Capa da turma ${turma.nome}`}
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
              </article>

              <h1 className="text-[2rem] font-semibold leading-none text-[#1c6a91]">Gerenciar Conteudos</h1>

              <p className="text-xs text-[#d8d8d8]">{turma.nome} Iniciante</p>

              {modulos.length === 0 ? (
                <button
                  onClick={() => {
                    setModoModal("criar");
                    setModuloEmEdicao(null);
                    setNomeModulo("");
                    setMensagem("");
                    setMostrarModal(true);
                  }}
                  className="flex w-full items-center justify-center gap-2 rounded-[8px] bg-black px-4 py-3 text-sm font-medium text-white"
                >
                  <CirclePlus className="h-4 w-4 stroke-[2]" />
                  Adicionar Novo Modulo
                </button>
              ) : null}

              {modulos.length === 0 ? (
                <p className="text-sm text-[#d9d9d9]">Nenhum modulo criado ainda.</p>
              ) : null}

              {modulos.length > 0 ? (
                <div className="space-y-4">
                  {modulos.map((modulo) => {
                    const expandido = moduloExpandido === modulo.id;

                    return (
                      <article key={modulo.id} className="rounded-[3px] bg-[#e9e9e9] px-5 py-4">
                        <div className="flex items-center justify-between gap-3">
                          <div className="flex items-center gap-3">
                            <h2 className="text-[1.05rem] font-semibold text-slate-900">{modulo.titulo}</h2>

                            <button
                              type="button"
                              onClick={() => {
                                setModoModal("editar");
                                setModuloEmEdicao(modulo.id);
                                setNomeModulo(modulo.titulo);
                                setMensagem("");
                                setMostrarModal(true);
                              }}
                              className="text-slate-900"
                              aria-label={`Editar modulo ${modulo.titulo}`}
                            >
                              <Pencil className="h-4 w-4 stroke-[2]" />
                            </button>

                            <button
                              type="button"
                              onClick={() => {
                                setMensagem("");
                                setModuloParaExcluir(modulo);
                              }}
                              className="text-slate-900"
                              aria-label={`Excluir modulo ${modulo.titulo}`}
                            >
                              <Trash2 className="h-4 w-4 stroke-[2]" />
                            </button>
                          </div>

                          <button
                            type="button"
                            onClick={() =>
                              setModuloExpandido((atual) => (atual === modulo.id ? null : modulo.id))
                            }
                            className="text-slate-700"
                            aria-label={expandido ? "Recolher modulo" : "Expandir modulo"}
                          >
                            <ChevronDown
                              className={`h-5 w-5 transition-transform ${expandido ? "rotate-180" : ""}`}
                            />
                          </button>
                        </div>

                        <div className="my-4 h-px bg-slate-700/70" />

                        {expandido ? (
                          <div className="space-y-3">
                            {aulasPorModulo[modulo.id]?.length ? (
                              <div className="space-y-2 pt-1">
                                {aulasPorModulo[modulo.id].map((aula, index) => (
                                  <div
                                    key={aula.id}
                                    className="flex items-start gap-3 rounded-[8px] px-1 py-2"
                                  >
                                    <span className="pt-1 text-lg text-slate-700">{index + 1}</span>

                                    <button
                                      type="button"
                                      onClick={() => router.push(`/aula/${modulo.id}?aula=${aula.id}`)}
                                      className="min-w-0 flex-1 text-left"
                                    >
                                      <p className="truncate text-[0.98rem] font-semibold text-slate-900">
                                        {aula.titulo}
                                      </p>
                                      <div className="mt-1 flex items-center gap-1 text-[11px] text-slate-400">
                                        <Clock3 className="h-3 w-3" />
                                        <span>{aula.duracao_texto || "--:--"}</span>
                                      </div>
                                    </button>

                                    <div className="flex items-center gap-3 pt-1">
                                      <button
                                        type="button"
                                        onClick={() => router.push(`/alunos/${aula.id}`)}
                                        className="text-black"
                                        aria-label={`Ver alunos da aula ${aula.titulo}`}
                                      >
                                        <UserRound className="h-5 w-5 fill-current stroke-[1.8]" />
                                      </button>
                                    </div>
                                  </div>
                                ))}
                              </div>
                            ) : null}

                            <button
                              type="button"
                              onClick={() => router.push(`/aula/${modulo.id}`)}
                              className="mx-auto flex w-full max-w-[270px] items-center justify-center gap-3 whitespace-nowrap rounded-[10px] bg-black px-5 py-3 text-base font-medium text-white"
                            >
                              <CirclePlus className="h-5 w-5 stroke-[2.4]" />
                              Adicionar Novo Conteudo
                            </button>
                          </div>
                        ) : null}
                      </article>
                    );
                  })}
                </div>
              ) : null}

              <button
                onClick={() => {
                  setModoModal("criar");
                  setModuloEmEdicao(null);
                  setNomeModulo("");
                  setMensagem("");
                  setMostrarModal(true);
                }}
                className={`flex w-full items-center justify-center gap-2 rounded-[8px] px-4 py-3 text-sm font-medium text-white ${
                  modulos.length > 0 ? "bg-[#A1A1A1]" : "hidden"
                }`}
              >
                <CirclePlus className="h-4 w-4 stroke-[2]" />
                Adicionar Novo Modulo
              </button>

              <section className="space-y-4 rounded-[16px] border border-slate-200 bg-slate-50 px-4 py-5">
                <div className="space-y-1">
                  <h3 className="text-base font-semibold text-slate-900">Acoes da Turma</h3>
                  <p className="text-sm leading-6 text-slate-500">
                    Voc&ecirc; pode arquivar esta turma para bloquear acessos sem perder o conte&uacute;do, ou excluir a turma por completo.
                  </p>
                </div>

                {turma.arquivada ? (
                  <p className="rounded-[10px] bg-amber-50 px-3 py-2 text-sm text-amber-700">
                    Esta turma est&aacute; arquivada. Os alunos permanecem vinculados, mas sem acesso ao conte&uacute;do.
                  </p>
                ) : null}

                <div className="flex flex-col gap-3">
                  <button
                    type="button"
                    onClick={() => {
                      setMensagem("");
                      setSenhaConfirmacao("");
                      setAcaoTurma("arquivar");
                    }}
                    className="rounded-[10px] bg-black px-4 py-3 text-sm font-medium text-white"
                  >
                    {turma.arquivada ? "Desarquivar Turma" : "Arquivar Turma"}
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setMensagem("");
                      setSenhaConfirmacao("");
                      setAcaoTurma("excluir");
                    }}
                    className="rounded-[10px] bg-[#b42318] px-4 py-3 text-sm font-medium text-white"
                  >
                    Excluir Turma
                  </button>
                </div>
              </section>

            </>
          ) : null}
        </section>
      </div>

      <nav className="fixed inset-x-0 bottom-0 z-30 border-t border-slate-200 bg-white px-3 py-3">
        <div className="mx-auto flex max-w-md items-center justify-between">
          <button onClick={() => router.push("/admin")} className="flex flex-col items-center gap-1 text-black">
            <House className="h-7 w-7 fill-current stroke-[1.8]" />
            <span className="text-[10px] font-medium">Inicio</span>
          </button>

          <button
            onClick={() => router.push(`/admin/encontros?turma=${turmaId}`)}
            className="flex flex-col items-center gap-1 text-slate-400"
          >
            <CalendarDays className="h-7 w-7 stroke-[1.8]" />
            <span className="text-[10px] font-medium">Encontros</span>
          </button>

          <button
            onClick={() => router.push(`/admin/progresso?turma=${turmaId}`)}
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

      {mostrarModal ? (
        <div className="fixed inset-0 z-50 bg-slate-950/45 px-4 py-6 sm:flex sm:items-center sm:justify-center sm:px-6 sm:py-8">
          <div className="mx-auto flex max-h-[calc(100dvh-8.5rem)] w-full max-w-md flex-col overflow-hidden rounded-[24px] bg-white shadow-2xl sm:max-h-[calc(100dvh-6rem)]">
            <div className="flex items-start justify-between gap-4 px-5 pb-3 pt-5">
              <h2 className="text-base font-semibold text-slate-900">Nome do Modulo</h2>

              <button
                onClick={() => {
                  if (salvandoModulo) return;
                  setMostrarModal(false);
                  setNomeModulo("");
                  setModuloEmEdicao(null);
                  setMensagem("");
                }}
                className="text-xl leading-none text-slate-500"
              >
                x
              </button>
            </div>

            <div className="overflow-y-auto px-5 pb-5 pt-2">
              <div className="space-y-5">
                <input
                  value={nomeModulo}
                  onChange={(event) => setNomeModulo(event.target.value)}
                  placeholder="Digite o nome do modulo"
                  className="w-full rounded-2xl border border-slate-200 px-4 py-3 outline-none transition focus:border-sky-700"
                />

                {mensagem && mostrarModal ? (
                  <p className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                    {mensagem}
                  </p>
                ) : null}

                <button
                  onClick={handleSalvarModulo}
                  disabled={salvandoModulo}
                  className="mx-auto block rounded-[10px] bg-[#0e5d77] px-10 py-3 font-medium text-white transition hover:bg-[#0b4d63] disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {salvandoModulo ? "Salvando..." : "Salvar"}
                </button>
              </div>
            </div>
          </div>
        </div>
      ) : null}

      {mostrarModalTurma ? (
        <div className="fixed inset-0 z-[55] bg-slate-950/45 px-4 py-6 sm:flex sm:items-center sm:justify-center sm:px-6 sm:py-8">
          <div className="mx-auto flex max-h-[calc(100dvh-8.5rem)] w-full max-w-md flex-col overflow-hidden rounded-[24px] bg-white shadow-2xl sm:max-h-[calc(100dvh-6rem)]">
            <div className="flex items-start justify-between gap-4 px-5 pb-3 pt-5">
              <h2 className="text-base font-semibold text-slate-900">Nome da Turma</h2>

              <button
                onClick={() => {
                  if (salvandoTurma) return;
                  setMostrarModalTurma(false);
                  setMensagem("");
                }}
                className="text-xl leading-none text-slate-500"
              >
                x
              </button>
            </div>

            <div className="overflow-y-auto px-5 pb-5 pt-2">
              <div className="space-y-5">
                <input
                  value={nomeTurmaEdicao}
                  onChange={(event) => setNomeTurmaEdicao(event.target.value)}
                  placeholder="Digite o nome da turma"
                  className="w-full rounded-2xl border border-slate-200 px-4 py-3 outline-none transition focus:border-sky-700"
                />

                {mensagem && mostrarModalTurma ? (
                  <p className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                    {mensagem}
                  </p>
                ) : null}

                <button
                  onClick={handleSalvarNomeTurma}
                  disabled={salvandoTurma}
                  className="mx-auto block rounded-[10px] bg-[#0e5d77] px-10 py-3 font-medium text-white transition hover:bg-[#0b4d63] disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {salvandoTurma ? "Salvando..." : "Salvar"}
                </button>
              </div>
            </div>
          </div>
        </div>
      ) : null}

      {moduloParaExcluir ? (
        <div className="fixed inset-0 z-[60] bg-slate-950/45 px-4 py-6 sm:flex sm:items-center sm:justify-center">
          <div className="mx-auto w-full max-w-sm rounded-[22px] bg-white px-5 py-5 shadow-2xl">
            <div className="space-y-3">
              <h2 className="text-lg font-semibold text-slate-900">Excluir modulo</h2>
              <p className="text-sm leading-6 text-slate-600">
                Esta exclusao e permanente. O modulo <strong>{moduloParaExcluir.titulo}</strong> sera removido
                definitivamente. Deseja continuar?
              </p>

              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setModuloParaExcluir(null)}
                  disabled={excluindoModulo}
                  className="flex-1 rounded-[10px] border border-slate-200 px-4 py-3 text-sm font-medium text-slate-700"
                >
                  Cancelar
                </button>

                <button
                  type="button"
                  onClick={handleExcluirModulo}
                  disabled={excluindoModulo}
                  className="flex-1 rounded-[10px] bg-[#b42318] px-4 py-3 text-sm font-medium text-white disabled:opacity-60"
                >
                  {excluindoModulo ? "Excluindo..." : "Confirmar"}
                </button>
              </div>
            </div>
          </div>
        </div>
      ) : null}

      {acaoTurma && turma ? (
        <div className="fixed inset-0 z-[70] bg-slate-950/45 px-4 py-6 sm:flex sm:items-center sm:justify-center">
          <div className="mx-auto w-full max-w-sm rounded-[22px] bg-white px-5 py-5 shadow-2xl">
            <div className="space-y-4">
              <div className="space-y-2">
                <h2 className="text-lg font-semibold text-slate-900">
                  {acaoTurma === "arquivar"
                    ? turma.arquivada
                      ? "Desarquivar turma"
                      : "Arquivar turma"
                    : "Excluir turma"}
                </h2>
                <p className="text-sm leading-6 text-slate-600">
                  {acaoTurma === "arquivar"
                    ? turma.arquivada
                      ? "Os alunos voltarao a acessar aulas, encontros e interacoes desta turma."
                      : "Os alunos permanecerao vinculados, mas sem acesso a aulas, encontros e interacoes."
                    : "A turma e todo o conteudo dela serao excluidos. Os alunos manterao suas contas, mas ficarao sem turma e voltarao para a tela de ativar codigo."}
                </p>
              </div>

              <label className="block space-y-2">
                <span className="text-sm font-medium text-slate-800">Senha do administrador</span>
                <input
                  type="password"
                  value={senhaConfirmacao}
                  onChange={(event) => setSenhaConfirmacao(event.target.value)}
                  placeholder="Digite sua senha"
                  className="w-full rounded-2xl border border-slate-200 px-4 py-3 outline-none transition focus:border-sky-700"
                />
              </label>

              {mensagem ? (
                <p className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                  {mensagem}
                </p>
              ) : null}

              <div className="flex gap-3 pt-1">
                <button
                  type="button"
                  onClick={() => {
                    if (executandoAcaoTurma) return;
                    setAcaoTurma(null);
                    setSenhaConfirmacao("");
                  }}
                  disabled={executandoAcaoTurma}
                  className="flex-1 rounded-[10px] border border-slate-200 px-4 py-3 text-sm font-medium text-slate-700"
                >
                  Cancelar
                </button>

                <button
                  type="button"
                  onClick={handleConfirmarAcaoTurma}
                  disabled={executandoAcaoTurma}
                  className={`flex-1 rounded-[10px] px-4 py-3 text-sm font-medium text-white disabled:opacity-60 ${
                    acaoTurma === "arquivar" ? "bg-black" : "bg-[#b42318]"
                  }`}
                >
                  {executandoAcaoTurma ? "Confirmando..." : "Confirmar"}
                </button>
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </main>
  );
}
