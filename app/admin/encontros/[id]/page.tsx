"use client";

import Image from "next/image";
import { Suspense, useEffect, useMemo, useState } from "react";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import {
  CalendarDays,
  ChartPie,
  CircleUserRound,
  House,
  Link2,
  MapPin,
} from "lucide-react";
import AppLoader from "@/components/AppLoader";
import MobileDatePickerModal from "@/components/MobileDatePickerModal";
import MobileTimePickerModal from "@/components/MobileTimePickerModal";
import { useAuth } from "@/contexts/AuthContext";
import { notificarTurma } from "@/lib/admin-notificacoes";
import {
  criarEncontro,
  excluirEncontro,
  getEncontroByIdAdmin,
  limparPresencasDoEncontro,
  listarPresencasDoEncontro,
  type PresencaAlunoEncontro,
  atualizarEncontro,
} from "@/lib/encontros";
import { getServiceUnavailableMessage, RequestTimeoutError, withTimeout } from "@/lib/network";
import { getTurmaById, type TurmaAdmin } from "@/lib/turmas";
import { isValidUserRole, type UsuarioProfile } from "@/lib/usuarios";

const durationOptions = [30, 60, 90, 120];

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

function getAlunoIniciais(aluno: PresencaAlunoEncontro) {
  const nome = aluno.nome?.trim();

  if (nome) {
    const partes = nome.split(/\s+/).filter(Boolean);
    const primeira = partes[0]?.[0] ?? "";
    const ultima = partes.length > 1 ? partes[partes.length - 1]?.[0] ?? "" : "";
    return `${primeira}${ultima || primeira}`.toUpperCase();
  }

  return (aluno.email.slice(0, 2) || "AL").toUpperCase();
}

function formatDateKey(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function formatFullDate(date: Date) {
  return new Intl.DateTimeFormat("pt-BR", {
    weekday: "short",
    day: "2-digit",
    month: "long",
    year: "numeric",
  }).format(date);
}

function formatarDataNotificacao(data: string) {
  return new Date(`${data}T00:00:00`).toLocaleDateString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}

function combineTime(hour: string, minute: string) {
  return `${hour}:${minute}:00`;
}

function parseTimeParts(value: string | null) {
  if (!value) return { hour: "21", minute: "00" };
  const [hour = "21", minute = "00"] = value.slice(0, 5).split(":");
  return { hour, minute };
}

function addMinutesToTime(value: string, amount: number) {
  const [hour, minute] = value.slice(0, 5).split(":").map(Number);
  const total = hour * 60 + minute + amount;
  const safeTotal = ((total % (24 * 60)) + 24 * 60) % (24 * 60);
  const nextHour = String(Math.floor(safeTotal / 60)).padStart(2, "0");
  const nextMinute = String(safeTotal % 60).padStart(2, "0");
  return `${nextHour}:${nextMinute}:00`;
}

function AdminEncontroEditorPageContent() {
  const { user, profile, profileError, loading } = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();
  const params = useParams<{ id: string }>();
  const encontroId = Array.isArray(params?.id) ? params.id[0] : params?.id;
  const turmaId = searchParams.get("turma");
  const dataInicial = searchParams.get("data");
  const criandoNovo = encontroId === "novo";

  const [loadingPage, setLoadingPage] = useState(true);
  const [carregandoDados, setCarregandoDados] = useState(true);
  const [salvando, setSalvando] = useState(false);
  const [excluindo, setExcluindo] = useState(false);
  const [mensagem, setMensagem] = useState("");
  const [confirmarExclusao, setConfirmarExclusao] = useState(false);
  const [turma, setTurma] = useState<TurmaAdmin | null>(null);
  const [presencas, setPresencas] = useState<PresencaAlunoEncontro[]>([]);
  const [titulo, setTitulo] = useState("");
  const [descricao, setDescricao] = useState("");
  const [tipo, setTipo] = useState<"online" | "presencial">("online");
  const [linkOnline, setLinkOnline] = useState("");
  const [local, setLocal] = useState("");
  const [selectedDate, setSelectedDate] = useState(() => {
    const base = dataInicial ? new Date(`${dataInicial}T00:00:00`) : new Date();
    base.setHours(0, 0, 0, 0);
    return base;
  });
  const [hora, setHora] = useState("21");
  const [minuto, setMinuto] = useState("00");
  const [duracaoMinutos, setDuracaoMinutos] = useState(60);
  const [pickerAberto, setPickerAberto] = useState<null | "data" | "hora">(null);
  const [originalAgenda, setOriginalAgenda] = useState<{ data: string; inicio: string; fim: string | null } | null>(null);
  const horaInicio = useMemo(() => combineTime(hora, minuto), [hora, minuto]);
  const horaFim = useMemo(() => addMinutesToTime(horaInicio, duracaoMinutos), [horaInicio, duracaoMinutos]);

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
    if (loadingPage || !turmaId || !encontroId) return;

    async function carregarTela() {
      setCarregandoDados(true);
      setMensagem("");

      try {
        const { turma: turmaData, error: turmaError } = await withTimeout(getTurmaById(turmaId));

        if (turmaError || !turmaData) {
          setMensagem("Nao conseguimos carregar esta turma agora. Tente novamente.");
          setCarregandoDados(false);
          return;
        }

        setTurma(turmaData);

        if (criandoNovo) {
          setCarregandoDados(false);
          return;
        }

        const [{ encontro, error: encontroError }, { alunos, error: presencasError }] = await Promise.all([
          withTimeout(getEncontroByIdAdmin(encontroId)),
          withTimeout(listarPresencasDoEncontro(turmaId, encontroId)),
        ]);

        if (encontroError || !encontro) {
          setMensagem("Nao conseguimos carregar este encontro agora.");
          setCarregandoDados(false);
          return;
        }

        if (presencasError) {
          setMensagem("Nao conseguimos carregar as confirmacoes deste encontro agora.");
          setCarregandoDados(false);
          return;
        }

        const partesHora = parseTimeParts(encontro.hora_inicio);
        const fimMinutos = encontro.hora_fim
          ? (() => {
              const inicio = parseTimeParts(encontro.hora_inicio);
              const fim = parseTimeParts(encontro.hora_fim);
              const inicioTotal = Number(inicio.hour) * 60 + Number(inicio.minute);
              const fimTotal = Number(fim.hour) * 60 + Number(fim.minute);
              const diff = fimTotal - inicioTotal;
              return diff > 0 ? diff : 60;
            })()
          : 60;
        const data = new Date(`${encontro.data_encontro}T00:00:00`);

        setTitulo(encontro.titulo);
        setDescricao(encontro.descricao ?? "");
        setTipo((encontro.tipo?.toLowerCase() === "presencial" ? "presencial" : "online") as "online" | "presencial");
        setLinkOnline(encontro.link_online ?? "");
        setLocal(encontro.local ?? "");
        setSelectedDate(data);
        setHora(partesHora.hour);
        setMinuto(partesHora.minute);
        setDuracaoMinutos(durationOptions.includes(fimMinutos) ? fimMinutos : 60);
        setPresencas(alunos);
        setOriginalAgenda({
          data: encontro.data_encontro,
          inicio: encontro.hora_inicio,
          fim: encontro.hora_fim,
        });
      } catch (error) {
        setMensagem(
          error instanceof RequestTimeoutError
            ? getServiceUnavailableMessage()
            : "Nao conseguimos carregar este encontro agora. Tente novamente.",
        );
      } finally {
        setCarregandoDados(false);
      }
    }

    void carregarTela();
  }, [criandoNovo, encontroId, loadingPage, turmaId]);

  async function handleSalvar() {
    if (!user || !turmaId || !encontroId) return;

    if (!titulo.trim()) {
      setMensagem("Digite o titulo do encontro para continuar.");
      return;
    }

    if (tipo === "online" && !linkOnline.trim()) {
      setMensagem("Cole o link da aula online para continuar.");
      return;
    }

    setSalvando(true);
    setMensagem("");

    const payload = {
      titulo: titulo.trim(),
      descricao: descricao.trim() || null,
      data_encontro: formatDateKey(selectedDate),
      hora_inicio: horaInicio,
      hora_fim: horaFim,
      tipo,
      local: tipo === "presencial" ? local.trim() || null : null,
      link_online: tipo === "online" ? linkOnline.trim() || null : null,
    };

    if (criandoNovo) {
      const { encontroId: novoEncontroId, error } = await criarEncontro({
        ...payload,
        turma_id: turmaId,
        mentor_id: user.id,
      });

      if (error) {
        setMensagem("Nao foi possivel salvar o encontro agora. Tente novamente.");
        setSalvando(false);
        return;
      }

      await notificarTurma({
        turmaId: turmaId,
        tipo: "encontro_agendado",
        titulo: "Encontro agendado",
        mensagem:
          tipo === "online"
            ? `Encontro agendado para o dia ${formatarDataNotificacao(payload.data_encontro)}, as ${payload.hora_inicio.slice(0, 5)}. Online.`
            : `Encontro agendado para o dia ${formatarDataNotificacao(payload.data_encontro)}, as ${payload.hora_inicio.slice(0, 5)}. Local: ${payload.local || "Igreja local"}.`,
        acao_tipo: "abrir_encontro",
        acao_payload: novoEncontroId ? { encontro_id: novoEncontroId } : { rota: "/encontros" },
      });

      router.push(`/admin/encontros?turma=${turmaId}&data=${payload.data_encontro}`);
      return;
    }

    const precisaResetarPresencas =
      originalAgenda?.data !== payload.data_encontro ||
      originalAgenda?.inicio !== payload.hora_inicio ||
      originalAgenda?.fim !== payload.hora_fim;

    const { error } = await atualizarEncontro(encontroId, payload);

    if (error) {
      setMensagem("Nao foi possivel salvar o encontro agora. Tente novamente.");
      setSalvando(false);
      return;
    }

    if (precisaResetarPresencas) {
      const { error: limparError } = await limparPresencasDoEncontro(encontroId);

      if (limparError) {
        setMensagem("O encontro foi salvo, mas nao conseguimos limpar as confirmacoes antigas.");
        setSalvando(false);
        return;
      }

      setPresencas((estadoAtual) =>
        estadoAtual.map((item) => ({
          ...item,
          presente: false,
          confirmado_em: null,
        })),
      );
    }

    setOriginalAgenda({
      data: payload.data_encontro,
      inicio: payload.hora_inicio,
      fim: payload.hora_fim,
    });
    setSalvando(false);
    router.push(`/admin/encontros?turma=${turmaId}&data=${payload.data_encontro}`);
  }

  async function handleExcluir() {
    if (criandoNovo || !encontroId || !turmaId) return;

    setExcluindo(true);
    setMensagem("");

    const { error } = await excluirEncontro(encontroId);

    if (error) {
      setMensagem("Nao foi possivel excluir o encontro agora. Tente novamente.");
      setExcluindo(false);
      return;
    }

    router.push(`/admin/encontros?turma=${turmaId}`);
  }

  if (loading || loadingPage) {
    return <AppLoader />;
  }

  return (
    <main className="min-h-screen bg-white pb-28 pt-28">
      <header className="fixed inset-x-0 top-0 z-30 bg-white px-4 pb-4 pt-5">
        <div className="mx-auto flex max-w-md items-center justify-between">
          <button onClick={() => router.push(turmaId ? `/admin/encontros?turma=${turmaId}` : "/admin/encontros")} className="w-12 text-left text-sm text-slate-600">
            Voltar
          </button>

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
              getIniciais(profile)
            )}
          </button>
        </div>
      </header>

      <div className="mx-auto flex w-full max-w-md flex-col gap-6 px-5">
        <section className="space-y-5">
          <h1 className="text-[2rem] font-semibold leading-none text-[#1c6a91]">
            {criandoNovo ? "Criar Encontro" : "Editar Encontro"}
          </h1>

          {mensagem ? (
            <p className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{mensagem}</p>
          ) : null}

          {carregandoDados ? (
            <AppLoader fullScreen={false} />
          ) : null}

          {!carregandoDados && turma ? (
            <div className="space-y-6">
              <label className="block space-y-2">
                <span className="text-sm font-semibold text-slate-900">Titulo</span>
                <input
                  value={titulo}
                  onChange={(event) => setTitulo(event.target.value)}
                  placeholder="Coloque o titulo"
                  className="w-full rounded-[14px] border border-slate-200 px-4 py-3 outline-none transition focus:border-[#348df6]"
                />
              </label>

              <div className="space-y-4 rounded-[24px] bg-[#f5f8ff] p-5">
                <p className="text-xs font-semibold uppercase tracking-[0.24em] text-[#7f8fb6]">Data</p>
                <button
                  type="button"
                  onClick={() => setPickerAberto("data")}
                  className="w-full rounded-[18px] bg-white px-4 py-5 text-left shadow-sm"
                >
                  <p className="text-[1.35rem] font-semibold text-[#244fb4]">{formatFullDate(selectedDate)}</p>
                  <p className="mt-1 text-sm text-slate-500">Toque para alterar a data do encontro</p>
                </button>
              </div>

              <div className="space-y-4 rounded-[24px] bg-[#f5f8ff] p-5">
                <div className="rounded-[18px] bg-[#244fb4] px-4 py-4 text-white shadow-[0_14px_30px_rgba(36,79,180,0.25)]">
                  <p className="text-xs font-semibold uppercase tracking-[0.26em] text-white/70">Horario</p>
                  <p className="mt-2 text-[2rem] font-semibold leading-none">
                    {hora}:{minuto}
                  </p>
                  <p className="mt-2 text-sm text-white/70">Termina as {horaFim.slice(0, 5)}</p>
                </div>

                <button
                  type="button"
                  onClick={() => setPickerAberto("hora")}
                  className="w-full rounded-[18px] bg-white px-4 py-5 text-left shadow-sm"
                >
                  <p className="text-[1.35rem] font-semibold text-[#244fb4]">{hora}:{minuto}</p>
                  <p className="mt-1 text-sm text-slate-500">Toque para alterar o horario</p>
                </button>

                <div className="space-y-3">
                  <p className="text-sm font-semibold text-slate-900">Duracao</p>
                  <div className="grid grid-cols-4 gap-2">
                    {durationOptions.map((value) => (
                      <button
                        key={value}
                        type="button"
                        onClick={() => setDuracaoMinutos(value)}
                        className={`rounded-[12px] px-3 py-3 text-sm font-medium transition ${
                          duracaoMinutos === value ? "bg-[#194F68] text-white" : "bg-white text-slate-600"
                        }`}
                      >
                        {value} min
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              <div className="space-y-3">
                <p className="text-sm font-semibold text-slate-900">Tipo</p>
                <div className="grid grid-cols-2 gap-3">
                  <button
                    type="button"
                    onClick={() => setTipo("online")}
                    className={`rounded-[14px] border px-4 py-3 text-sm font-medium transition ${
                      tipo === "online"
                        ? "border-[#348df6] bg-[#eef5ff] text-[#1f5de3]"
                        : "border-slate-200 bg-white text-slate-500"
                    }`}
                  >
                    Online
                  </button>
                  <button
                    type="button"
                    onClick={() => setTipo("presencial")}
                    className={`rounded-[14px] border px-4 py-3 text-sm font-medium transition ${
                      tipo === "presencial"
                        ? "border-[#348df6] bg-[#eef5ff] text-[#1f5de3]"
                        : "border-slate-200 bg-white text-slate-500"
                    }`}
                  >
                    Presencial
                  </button>
                </div>
              </div>

              {tipo === "online" ? (
                <label className="block space-y-2">
                  <span className="flex items-center gap-2 text-sm font-semibold text-slate-900">
                    <Link2 className="h-4 w-4 text-[#1f5de3]" />
                    Link da aula online
                  </span>
                  <input
                    value={linkOnline}
                    onChange={(event) => setLinkOnline(event.target.value)}
                    placeholder="Cole o link do Meet"
                    className="w-full rounded-[14px] border border-slate-200 px-4 py-3 outline-none transition focus:border-[#348df6]"
                  />
                </label>
              ) : (
                <label className="block space-y-2">
                  <span className="flex items-center gap-2 text-sm font-semibold text-slate-900">
                    <MapPin className="h-4 w-4 text-[#1f5de3]" />
                    Local do encontro
                  </span>
                  <input
                    value={local}
                    onChange={(event) => setLocal(event.target.value)}
                    placeholder="Ex.: Igreja local"
                    className="w-full rounded-[14px] border border-slate-200 px-4 py-3 outline-none transition focus:border-[#348df6]"
                  />
                </label>
              )}

              <label className="block space-y-2">
                <span className="text-sm font-semibold text-slate-900">Descricao</span>
                <textarea
                  value={descricao}
                  onChange={(event) => setDescricao(event.target.value)}
                  placeholder="Observacoes, orientacoes ou detalhes extras do encontro."
                  rows={4}
                  className="w-full rounded-[14px] border border-slate-200 px-4 py-3 outline-none transition focus:border-[#348df6]"
                />
              </label>

              {!criandoNovo ? (
                <div className="space-y-4 rounded-[24px] bg-[#fafafa] p-5">
                  <div className="flex items-center justify-between gap-3">
                    <h2 className="text-xl font-semibold text-slate-900">Presenca de Alunos</h2>
                    <span className="text-sm text-slate-400">
                      {presencas.filter((item) => item.presente).length} confirmados
                    </span>
                  </div>

                  {presencas.length === 0 ? (
                    <p className="text-sm text-slate-500">Nenhum aluno vinculado a esta turma ainda.</p>
                  ) : (
                    <div className="space-y-5">
                      {presencas.map((aluno) => (
                        <div key={aluno.usuario_id} className="flex items-center justify-between gap-4">
                          <div className="flex min-w-0 items-center gap-4">
                            <div className="flex h-12 w-12 items-center justify-center overflow-hidden rounded-full bg-slate-200 text-sm font-semibold text-slate-700">
                              {aluno.foto_url ? (
                                <Image
                                  src={aluno.foto_url}
                                  alt={aluno.nome || "Foto do aluno"}
                                  width={48}
                                  height={48}
                                  className="h-full w-full object-cover"
                                  unoptimized
                                />
                              ) : (
                                getAlunoIniciais(aluno)
                              )}
                            </div>
                            <div className="min-w-0">
                              <p className="truncate text-[1rem] font-medium text-slate-900">{aluno.nome || aluno.email}</p>
                              <p className="text-sm text-slate-400">
                                {aluno.presente ? "Presenca confirmada" : "Ainda nao confirmou"}
                              </p>
                            </div>
                          </div>

                          <div className={aluno.presente ? "text-[#18d172]" : "text-[#d5d5d5]"}>
                            <CalendarDays className="h-6 w-6 stroke-[2.2]" />
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              ) : null}

              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => void handleSalvar()}
                  disabled={salvando}
                  className="flex-1 rounded-[12px] bg-[#0e5d77] px-4 py-4 text-base font-medium text-white disabled:opacity-60"
                >
                  {salvando ? "Salvando..." : "Salvar"}
                </button>

                {!criandoNovo ? (
                  <button
                    type="button"
                    onClick={() => setConfirmarExclusao(true)}
                    disabled={excluindo}
                    className="flex-1 rounded-[12px] bg-[#ff4343] px-4 py-4 text-base font-medium text-white disabled:opacity-60"
                  >
                    Excluir Encontro
                  </button>
                ) : null}
              </div>
            </div>
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
            onClick={() => router.push(turmaId ? `/admin/encontros?turma=${turmaId}` : "/admin/encontros")}
            className="flex flex-col items-center gap-1 text-black"
          >
            <CalendarDays className="h-7 w-7 stroke-[1.8]" />
            <span className="text-[10px] font-medium">Encontros</span>
          </button>

          <button
            onClick={() => router.push(turmaId ? `/admin/progresso?turma=${turmaId}` : "/admin/progresso")}
            className="flex flex-col items-center gap-1 text-slate-400"
          >
            <ChartPie className="h-7 w-7 stroke-[1.8]" />
            <span className="text-[10px] font-medium">Progresso</span>
          </button>

          <button onClick={() => router.push("/conta")} className="flex flex-col items-center gap-1 text-slate-400">
            <CircleUserRound className="h-7 w-7 stroke-[1.8]" />
            <span className="text-[10px] font-medium">Conta</span>
          </button>
        </div>
      </nav>

      <MobileDatePickerModal
        open={pickerAberto === "data"}
        value={selectedDate}
        minDate={new Date()}
        onClose={() => setPickerAberto(null)}
        onConfirm={(value) => {
          setSelectedDate(value);
          setPickerAberto(null);
        }}
      />

      <MobileTimePickerModal
        open={pickerAberto === "hora"}
        hour={hora}
        minute={minuto}
        onClose={() => setPickerAberto(null)}
        onConfirm={(nextHour, nextMinute) => {
          setHora(nextHour);
          setMinuto(nextMinute);
          setPickerAberto(null);
        }}
      />

      {confirmarExclusao ? (
        <div className="fixed inset-0 z-[60] bg-slate-950/45 px-4 py-6 sm:flex sm:items-center sm:justify-center">
          <div className="mx-auto w-full max-w-sm rounded-[22px] bg-white px-5 py-5 shadow-2xl">
            <div className="space-y-3">
              <h2 className="text-lg font-semibold text-slate-900">Excluir encontro</h2>
              <p className="text-sm leading-6 text-slate-600">
                Esta exclusao e permanente. O encontro sera removido definitivamente. Deseja continuar?
              </p>

              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setConfirmarExclusao(false)}
                  disabled={excluindo}
                  className="flex-1 rounded-[10px] border border-slate-200 px-4 py-3 text-sm font-medium text-slate-700"
                >
                  Cancelar
                </button>

                <button
                  type="button"
                  onClick={() => void handleExcluir()}
                  disabled={excluindo}
                  className="flex-1 rounded-[10px] bg-[#b42318] px-4 py-3 text-sm font-medium text-white disabled:opacity-60"
                >
                  {excluindo ? "Excluindo..." : "Confirmar"}
                </button>
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </main>
  );
}

export default function AdminEncontroEditorPage() {
  return (
    <Suspense fallback={<AppLoader />}>
      <AdminEncontroEditorPageContent />
    </Suspense>
  );
}
