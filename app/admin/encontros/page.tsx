"use client";

import Image from "next/image";
import { Suspense, useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  CalendarDays,
  ChartPie,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  CheckCircle2,
  CirclePlus,
  CircleUserRound,
  House,
} from "lucide-react";
import AppLoader from "@/components/AppLoader";
import MobileMonthYearPickerModal from "@/components/MobileMonthYearPickerModal";
import { useAuth } from "@/contexts/AuthContext";
import { listarEncontrosDaSemanaAdmin, type EncontroAdmin } from "@/lib/encontros";
import { getServiceUnavailableMessage, RequestTimeoutError, withTimeout } from "@/lib/network";
import { getTurmaById, listarTurmas, type TurmaAdmin } from "@/lib/turmas";
import { isValidUserRole, type UsuarioProfile } from "@/lib/usuarios";

const weekdayFormatter = new Intl.DateTimeFormat("pt-BR", { weekday: "short" });
const dayFormatter = new Intl.DateTimeFormat("pt-BR", { day: "2-digit" });
const shortMonthNames = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"];

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

function startOfWeek(date: Date) {
  const copy = new Date(date);
  copy.setHours(0, 0, 0, 0);
  copy.setDate(copy.getDate() - copy.getDay());
  return copy;
}

function addDays(date: Date, amount: number) {
  const copy = new Date(date);
  copy.setDate(copy.getDate() + amount);
  return copy;
}

function formatDateKey(date: Date) {
  return date.toISOString().slice(0, 10);
}

function isSameDay(a: Date, b: Date) {
  return formatDateKey(a) === formatDateKey(b);
}

function formatWeekdayLetter(date: Date) {
  return weekdayFormatter
    .format(date)
    .replace(".", "")
    .slice(0, 1)
    .toUpperCase();
}

function formatMonthYear(date: Date) {
  return `${shortMonthNames[date.getMonth()]}, ${date.getFullYear()}`;
}

function getMentorIniciais(encontro: EncontroAdmin) {
  const nome = encontro.mentor?.nome?.trim();

  if (nome) {
    const partes = nome.split(/\s+/).filter(Boolean);
    const primeira = partes[0]?.[0] ?? "";
    const ultima = partes.length > 1 ? partes[partes.length - 1]?.[0] ?? "" : "";
    return `${primeira}${ultima || primeira}`.toUpperCase();
  }

  return (encontro.mentor?.email?.slice(0, 2) || "MT").toUpperCase();
}

function AdminEncontrosPageContent() {
  const { user, profile, profileError, loading } = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();
  const turmaIdSelecionada = searchParams.get("turma");
  const dataSelecionada = searchParams.get("data");
  const [loadingPage, setLoadingPage] = useState(true);
  const [carregandoDados, setCarregandoDados] = useState(true);
  const [mensagem, setMensagem] = useState("");
  const [turma, setTurma] = useState<TurmaAdmin | null>(null);
  const [turmas, setTurmas] = useState<TurmaAdmin[]>([]);
  const [encontros, setEncontros] = useState<EncontroAdmin[]>([]);
  const [monthPickerAberto, setMonthPickerAberto] = useState(false);
  const [selectedDate, setSelectedDate] = useState(() => {
    const base = dataSelecionada ? new Date(`${dataSelecionada}T00:00:00`) : new Date();
    base.setHours(0, 0, 0, 0);
    return base;
  });

  const iniciaisAvatar = useMemo(() => getIniciais(profile), [profile]);
  const weekStart = useMemo(() => startOfWeek(selectedDate), [selectedDate]);
  const weekDays = useMemo(() => Array.from({ length: 7 }, (_, index) => addDays(weekStart, index)), [weekStart]);
  const encontrosDoDia = useMemo(
    () => encontros.filter((item) => item.data_encontro === formatDateKey(selectedDate)),
    [encontros, selectedDate],
  );

  useEffect(() => {
    if (!dataSelecionada) return;

    const proximaData = new Date(`${dataSelecionada}T00:00:00`);

    if (Number.isNaN(proximaData.getTime())) return;

    proximaData.setHours(0, 0, 0, 0);
    setSelectedDate(proximaData);
  }, [dataSelecionada]);

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

    async function carregarTela() {
      setCarregandoDados(true);
      setMensagem("");

      try {
        const { turmas: turmasData, error: turmasError } = await withTimeout(listarTurmas());

        if (turmasError) {
          setMensagem("Nao conseguimos carregar suas turmas agora. Tente novamente.");
          setCarregandoDados(false);
          return;
        }

        setTurmas(turmasData);

        if (!turmaIdSelecionada) {
          setTurma(null);
          setEncontros([]);
          setCarregandoDados(false);
          return;
        }

        const [{ turma: turmaData, error: turmaError }, { encontros: encontrosData, error: encontrosError }] = await Promise.all([
          withTimeout(getTurmaById(turmaIdSelecionada)),
          withTimeout(
            listarEncontrosDaSemanaAdmin(
              turmaIdSelecionada,
              formatDateKey(weekStart),
              formatDateKey(addDays(weekStart, 6)),
            ),
          ),
        ]);

        if (turmaError || !turmaData) {
          setMensagem("Nao conseguimos carregar esta turma agora. Tente novamente.");
          setCarregandoDados(false);
          return;
        }

        if (encontrosError) {
          setMensagem("Nao conseguimos carregar os encontros desta semana agora.");
          setCarregandoDados(false);
          return;
        }

        setTurma(turmaData);
        setEncontros(encontrosData);
      } catch (error) {
        setMensagem(
          error instanceof RequestTimeoutError
            ? getServiceUnavailableMessage()
            : "Nao conseguimos carregar os encontros agora. Tente novamente.",
        );
      } finally {
        setCarregandoDados(false);
      }
    }

    void carregarTela();
  }, [loadingPage, turmaIdSelecionada, weekStart]);

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

      <div className="mx-auto flex w-full max-w-md flex-col gap-5 px-5">
        <section className="space-y-5">
          <h1 className="text-[2rem] font-semibold leading-none text-[#1c6a91]">Encontros</h1>

          {mensagem ? (
            <p className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{mensagem}</p>
          ) : null}

          {carregandoDados ? (
            <AppLoader fullScreen={false} />
          ) : null}

          {!carregandoDados && !turmaIdSelecionada ? (
            turmas.length === 0 ? (
              <p className="rounded-[12px] bg-slate-100 px-4 py-6 text-sm text-slate-500">Nenhuma turma cadastrada ainda.</p>
            ) : (
              <div className="space-y-4">
                {turmas.map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => router.push(`/admin/encontros?turma=${item.id}`)}
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
                        <div className="flex h-full items-center justify-center text-sm text-slate-400">Sem capa</div>
                      )}
                    </div>

                    <div className="space-y-2 px-5 py-4">
                      <h2 className="text-[1.05rem] font-semibold text-slate-900">{item.nome}</h2>
                      <p className="text-xs font-medium uppercase tracking-[0.22em] text-[#89a1c0]">
                        {item.categoria || "sem categoria"}
                      </p>
                    </div>
                  </button>
                ))}
              </div>
            )
          ) : null}

          {!carregandoDados && turmaIdSelecionada && turma ? (
            <div className="space-y-5">
              <div className="flex items-center justify-between">
                <button
                  type="button"
                  onClick={() => setSelectedDate((atual) => addDays(atual, -7))}
                  className="rounded-full p-2 text-[#1f5de3]"
                  aria-label="Semana anterior"
                >
                  <ChevronLeft className="h-5 w-5" />
                </button>

                <button
                  type="button"
                  onClick={() => setMonthPickerAberto(true)}
                  className="flex items-center gap-2 text-[2rem] font-semibold text-[#1f5de3]"
                >
                  <span>{formatMonthYear(selectedDate)}</span>
                  <ChevronDown className="h-5 w-5" />
                </button>

                <button
                  type="button"
                  onClick={() => setSelectedDate((atual) => addDays(atual, 7))}
                  className="rounded-full p-2 text-[#1f5de3]"
                  aria-label="Proxima semana"
                >
                  <ChevronRight className="h-5 w-5" />
                </button>
              </div>

              <div className="grid grid-cols-7 gap-2">
                {weekDays.map((day) => {
                  const ativo = isSameDay(day, selectedDate);

                  return (
                    <button
                      key={formatDateKey(day)}
                      type="button"
                      onClick={() => setSelectedDate(day)}
                      className={`flex flex-col items-center gap-2 rounded-[16px] px-1 py-3 transition ${
                        ativo ? "bg-[#348df6] text-white" : "text-[#2c69c5]"
                      }`}
                    >
                      <span className={`text-sm ${ativo ? "text-white/85" : "text-[#b9cbe8]"}`}>
                        {formatWeekdayLetter(day)}
                      </span>
                      <span className="text-[1.65rem] font-semibold leading-none">{dayFormatter.format(day)}</span>
                    </button>
                  );
                })}
              </div>

              <button
                type="button"
                onClick={() =>
                  router.push(`/admin/encontros/novo?turma=${turma.id}&data=${formatDateKey(selectedDate)}`)
                }
                className="flex w-full items-center justify-center gap-3 rounded-[12px] bg-[#348df6] px-5 py-4 text-lg font-medium text-white"
              >
                <CirclePlus className="h-5 w-5 stroke-[2.4]" />
                Criar novo Encontro
              </button>

              <button
                type="button"
                onClick={() => router.push("/admin/encontros")}
                className="text-left text-sm font-medium text-[#1c6a91]"
              >
                Ver outra turma
              </button>

              <div className="grid grid-cols-[64px_minmax(0,1fr)] gap-3">
                <p className="text-lg font-semibold text-slate-900">Hora</p>
                <p className="text-lg font-semibold text-slate-900">Encontros Agendados</p>
              </div>

              {encontrosDoDia.length === 0 ? (
                <div className="rounded-[18px] bg-slate-100 px-4 py-10 text-center text-slate-500">
                  Nenhum encontro agendado para este dia.
                </div>
              ) : (
                <div className="space-y-5">
                  {encontrosDoDia.map((encontro) => {
                    const mentorIniciais = getMentorIniciais(encontro);
                    const tipoNormalizado = (encontro.tipo ?? "").toLowerCase();
                    const tipoLabel = tipoNormalizado === "online" ? "Online" : "Presencial";

                    return (
                      <div key={encontro.id} className="grid grid-cols-[64px_minmax(0,1fr)] gap-3">
                        <div className="pt-3 text-left">
                          <p className="text-[1.7rem] font-semibold leading-none text-slate-900">
                            {encontro.hora_inicio.slice(0, 5)}
                          </p>
                          {encontro.hora_fim ? (
                            <p className="mt-1 text-[1.1rem] leading-none text-slate-300">
                              {encontro.hora_fim.slice(0, 5)}
                            </p>
                          ) : null}
                        </div>

                        <button
                          type="button"
                          onClick={() => router.push(`/admin/encontros/${encontro.id}?turma=${turma.id}`)}
                          className="rounded-[18px] bg-white px-4 py-3 text-left shadow-[0_10px_28px_rgba(15,23,42,0.09)]"
                        >
                          <div className="flex items-start justify-between gap-4">
                            <div className="min-w-0 flex-1">
                              <p
                                className={`text-[1.15rem] font-semibold leading-none ${
                                  tipoNormalizado === "online" ? "text-[#00bfd6]" : "text-slate-900"
                                }`}
                              >
                                {tipoLabel}
                              </p>
                              <p className="mt-2 text-[1.55rem] font-semibold leading-tight text-slate-900">
                                {encontro.titulo}
                              </p>
                            </div>

                            <div className={encontro.confirmados_count > 0 ? "text-[#18d172]" : "text-[#d5d5d5]"}>
                              <CheckCircle2 className="h-6 w-6" strokeWidth={2.3} />
                            </div>
                          </div>

                          <div className="mt-3 flex items-center justify-between gap-3">
                            <div className="flex items-center gap-3">
                              <div className="flex h-8 w-8 items-center justify-center overflow-hidden rounded-full bg-slate-200 text-[10px] font-semibold text-slate-700">
                                {encontro.mentor?.foto_url ? (
                                  <Image
                                    src={encontro.mentor.foto_url}
                                    alt={encontro.mentor.nome || "Foto do mentor"}
                                    width={32}
                                    height={32}
                                    className="h-full w-full object-cover"
                                    unoptimized
                                  />
                                ) : (
                                  mentorIniciais
                                )}
                              </div>
                              <span className="text-[1.05rem] text-slate-900">{encontro.mentor?.nome || "Mentor"}</span>
                            </div>

                            <span className="text-xs text-slate-300">{encontro.confirmados_count} confirmados</span>
                          </div>
                        </button>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          ) : null}
        </section>
      </div>

      <MobileMonthYearPickerModal
        open={monthPickerAberto}
        month={selectedDate.getMonth() + 1}
        year={selectedDate.getFullYear()}
        onClose={() => setMonthPickerAberto(false)}
        onConfirm={(month, year) => {
          const updated = new Date(selectedDate);
          updated.setFullYear(year, month - 1, 1);
          setSelectedDate(updated);
        }}
      />

      <nav className="fixed inset-x-0 bottom-0 z-30 border-t border-slate-200 bg-white px-3 py-3">
        <div className="mx-auto flex max-w-md items-center justify-between">
          <button onClick={() => router.push("/admin")} className="flex flex-col items-center gap-1 text-slate-400">
            <House className="h-7 w-7 fill-current stroke-[1.8]" />
            <span className="text-[10px] font-medium">Inicio</span>
          </button>

          <button className="flex flex-col items-center gap-1 text-black">
            <CalendarDays className="h-7 w-7 stroke-[1.8]" />
            <span className="text-[10px] font-medium">Encontros</span>
          </button>

          <button
            onClick={() => router.push(turmaIdSelecionada ? `/admin/progresso?turma=${turmaIdSelecionada}` : "/admin/progresso")}
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
    </main>
  );
}

export default function AdminEncontrosPage() {
  return (
    <Suspense fallback={<AppLoader />}>
      <AdminEncontrosPageContent />
    </Suspense>
  );
}
