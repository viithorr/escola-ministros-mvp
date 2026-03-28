"use client";

import Image from "next/image";
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  CalendarDays,
  CheckCircle2,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  X,
  ChartPie,
  CircleUserRound,
  House,
  Link2,
  MapPin,
} from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import AppLoader from "@/components/AppLoader";
import NotificationBell from "@/components/NotificationBell";
import MobileMonthYearPickerModal from "@/components/MobileMonthYearPickerModal";
import { getTurmaDoAluno, type TurmaAlunoDashboard } from "@/lib/aluno-dashboard";
import { listarEncontrosDaSemana, salvarPresencaDoAlunoNoEncontro, type EncontroAluno } from "@/lib/encontros";
import { getMatriculasDoAluno } from "@/lib/matriculas";
import { getServiceUnavailableMessage, RequestTimeoutError, withTimeout } from "@/lib/network";
import { isValidUserRole, type UsuarioProfile } from "@/lib/usuarios";

const weekdayFormatter = new Intl.DateTimeFormat("pt-BR", { weekday: "short" });
const dayFormatter = new Intl.DateTimeFormat("pt-BR", { day: "2-digit" });
const monthYearFormatter = new Intl.DateTimeFormat("pt-BR", { month: "short", year: "numeric" });

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

function getMentorIniciais(encontro: EncontroAluno) {
  const nome = encontro.mentor?.nome?.trim();

  if (nome) {
    const partes = nome.split(/\s+/).filter(Boolean);
    const primeira = partes[0]?.[0] ?? "";
    const ultima = partes.length > 1 ? partes[partes.length - 1]?.[0] ?? "" : "";
    return `${primeira}${ultima || primeira}`.toUpperCase();
  }

  return (encontro.mentor?.email?.slice(0, 2) || "MT").toUpperCase();
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
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function formatWeekdayLetter(date: Date) {
  return weekdayFormatter
    .format(date)
    .replace(".", "")
    .slice(0, 1)
    .toUpperCase();
}

function formatMonthYear(date: Date) {
  const label = monthYearFormatter.format(date);
  const [mes, ano] = label.split(" ");
  const mesFormatado = mes?.charAt(0).toUpperCase() + (mes?.slice(1, 3).toLowerCase() ?? "");
  return `${mesFormatado}, ${ano}`;
}

function isSameDay(a: Date, b: Date) {
  return formatDateKey(a) === formatDateKey(b);
}

export default function EncontrosPage() {
  const { user, profile, profileError, loading } = useAuth();
  const router = useRouter();
  const [checkingAccess, setCheckingAccess] = useState(true);
  const [loadingEncontros, setLoadingEncontros] = useState(true);
  const [mensagem, setMensagem] = useState("");
  const [turma, setTurma] = useState<TurmaAlunoDashboard | null>(null);
  const [encontros, setEncontros] = useState<EncontroAluno[]>([]);
  const [modalEncontroId, setModalEncontroId] = useState<string | null>(null);
  const [salvandoPresencaId, setSalvandoPresencaId] = useState<string | null>(null);
  const [monthPickerAberto, setMonthPickerAberto] = useState(false);
  const [selectedDate, setSelectedDate] = useState(() => {
    const hoje = new Date();
    hoje.setHours(0, 0, 0, 0);
    return hoje;
  });

  const iniciaisAvatar = useMemo(() => getIniciais(profile), [profile]);
  const weekStart = useMemo(() => startOfWeek(selectedDate), [selectedDate]);
  const weekDays = useMemo(() => Array.from({ length: 7 }, (_, index) => addDays(weekStart, index)), [weekStart]);
  const encontrosDoDia = useMemo(
    () => encontros.filter((item) => item.data_encontro === formatDateKey(selectedDate)),
    [encontros, selectedDate],
  );
  const encontroAberto = useMemo(
    () => encontros.find((item) => item.id === modalEncontroId) ?? null,
    [encontros, modalEncontroId],
  );
  const selectedDateKey = useMemo(() => formatDateKey(selectedDate), [selectedDate]);

  useEffect(() => {
    async function verificarAcesso() {
      if (loading) return;

      if (!user) {
        router.push("/login");
        return;
      }

      if (!profile) {
        setMensagem(profileError || "Nao conseguimos carregar sua conta agora. Tente novamente em alguns instantes.");
        setCheckingAccess(false);
        return;
      }

      if (!isValidUserRole(profile.role)) {
        setMensagem("Nao conseguimos liberar seu acesso agora. Fale com o administrador.");
        setCheckingAccess(false);
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

      try {
        const { matriculas, error: matriculaError } = await withTimeout(getMatriculasDoAluno(user.id));

        if (matriculaError) {
          setMensagem("Nao conseguimos verificar sua turma agora. Tente novamente em alguns instantes.");
          setCheckingAccess(false);
          return;
        }

        if (!matriculas[0]?.turma_id) {
          router.push("/entrar-turma?origem=sem-turma");
          return;
        }

        if (matriculas[0].acesso_bloqueado) {
          router.push("/dashboard");
          return;
        }

        const { turma: turmaData, error: turmaError } = await withTimeout(getTurmaDoAluno(user.id));

        if (turmaError || !turmaData) {
          setMensagem("Nao conseguimos carregar os dados da sua turma agora. Tente novamente.");
          setCheckingAccess(false);
          return;
        }

        if (turmaData.arquivada) {
          router.push("/dashboard");
          return;
        }

        setTurma(turmaData);
        setCheckingAccess(false);
      } catch (error) {
        setMensagem(
          error instanceof RequestTimeoutError
            ? getServiceUnavailableMessage()
            : "Nao conseguimos liberar seus encontros agora. Tente novamente.",
        );
        setCheckingAccess(false);
      }
    }

    void verificarAcesso();
  }, [loading, profile, profileError, router, user]);

  useEffect(() => {
    async function carregarEncontros() {
      if (!user || !turma || checkingAccess) return;

      setLoadingEncontros(true);
      setMensagem("");

      try {
        const { encontros: encontrosData, error } = await withTimeout(
          listarEncontrosDaSemana(
            turma.id,
            user.id,
            formatDateKey(weekStart),
            formatDateKey(addDays(weekStart, 6)),
          ),
        );

        if (error) {
          setMensagem("Nao conseguimos carregar os encontros desta semana agora.");
          setLoadingEncontros(false);
          return;
        }

        setEncontros(encontrosData);
        setModalEncontroId((current) => (encontrosData.some((item) => item.id === current) ? current : null));
      } catch (error) {
        setMensagem(
          error instanceof RequestTimeoutError
            ? getServiceUnavailableMessage()
            : "Nao conseguimos carregar os encontros desta semana agora.",
        );
      } finally {
        setLoadingEncontros(false);
      }
    }

    void carregarEncontros();
  }, [checkingAccess, selectedDateKey, turma, user, weekStart]);

  async function handleTogglePresenca(encontro: EncontroAluno) {
    if (!user) return;

    setSalvandoPresencaId(encontro.id);
    setMensagem("");

    const novoValor = !encontro.presente;
    const { error } = await salvarPresencaDoAlunoNoEncontro(
      encontro.id,
      user.id,
      novoValor,
      encontro.presenca_id,
    );

    if (error) {
      setMensagem("Nao foi possivel confirmar sua presenca agora. Tente novamente.");
      setSalvandoPresencaId(null);
      return;
    }

    setEncontros((estadoAtual) =>
      estadoAtual.map((item) =>
        item.id === encontro.id
          ? {
              ...item,
              presente: novoValor,
              confirmado_em: novoValor ? new Date().toISOString() : null,
              presenca_id: item.presenca_id ?? `temp-${item.id}`,
            }
          : item,
      ),
    );
    setSalvandoPresencaId(null);
  }

  if (loading || checkingAccess) {
    return <AppLoader />;
  }

  return (
    <main className="min-h-screen bg-white pb-28 pt-28">
      <header className="fixed inset-x-0 top-0 z-30 bg-white px-4 pb-4 pt-5">
        <div className="mx-auto flex max-w-md items-center justify-between">
          <div className="w-[94px]" />

          <Image
            src="/img/logo.svg"
            alt="Escola de Ministros"
            width={147}
            height={49}
            className="h-10 w-auto object-contain"
            priority
          />

          <div className="flex w-[94px] items-center justify-end gap-3">
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

      <div className="mx-auto flex w-full max-w-md flex-col gap-5 px-5">
        <section className="space-y-5">
          <h1 className="text-[2rem] font-semibold leading-none text-[#1c6a91]">Encontros</h1>

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

          {mensagem ? (
            <p className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{mensagem}</p>
          ) : null}

          <div className="grid grid-cols-[64px_minmax(0,1fr)] gap-3">
            <p className="text-lg font-semibold text-slate-900">Hora</p>
            <p className="text-lg font-semibold text-slate-900">Encontros Agendados</p>
          </div>

          {loadingEncontros ? (
            <AppLoader fullScreen={false} />
          ) : encontrosDoDia.length === 0 ? (
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
                      onClick={() => setModalEncontroId(encontro.id)}
                      className="rounded-[18px] bg-white px-4 py-3 text-left shadow-[0_10px_28px_rgba(15,23,42,0.09)]"
                    >
                      <div className="flex items-start justify-between gap-4">
                        <div className="min-w-0 flex-1 text-left">
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

                        <div
                          className={encontro.presente ? "text-[#18d172]" : "text-[#d5d5d5]"}
                          aria-label={encontro.presente ? "Presenca confirmada" : "Presenca nao confirmada"}
                        >
                          <CheckCircle2 className="h-7 w-7" strokeWidth={2.3} />
                        </div>
                      </div>

                      <div className="mt-3 flex w-full items-center justify-between gap-3 text-left">
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
        </section>
      </div>

      {encontroAberto ? (
        <>
          <button
            type="button"
            aria-label="Fechar detalhes do encontro"
            className="fixed inset-0 z-40 bg-slate-950/45"
            onClick={() => setModalEncontroId(null)}
          />

          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6">
            <section className="w-full max-w-[360px] rounded-[28px] bg-white px-5 pb-6 pt-4 shadow-[0_24px_70px_rgba(15,23,42,0.28)]">
              <div className="mx-auto mb-4 h-1.5 w-14 rounded-full bg-slate-200" />

              <div className="flex items-start justify-between gap-4">
                <div className="min-w-0">
                  <p
                    className={`text-[1rem] font-semibold ${
                      (encontroAberto.tipo ?? "").toLowerCase() === "online" ? "text-[#00bfd6]" : "text-slate-500"
                    }`}
                  >
                    {(encontroAberto.tipo ?? "").toLowerCase() === "online" ? "Online" : "Presencial"}
                  </p>
                  <h2 className="mt-2 text-[1.8rem] font-semibold leading-tight text-slate-950">{encontroAberto.titulo}</h2>
                </div>

                <button
                  type="button"
                  onClick={() => setModalEncontroId(null)}
                  className="rounded-full p-2 text-slate-400"
                  aria-label="Fechar"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>

              <div className="mt-5 flex items-center justify-between gap-4 rounded-[20px] bg-slate-50 px-4 py-3">
                <div>
                  <p className="text-sm font-medium text-slate-400">Confirmacao de presenca</p>
                  <p className="mt-1 text-base font-medium text-slate-900">
                    {encontroAberto.presente ? "Presenca confirmada" : "Toque para confirmar sua presenca"}
                  </p>
                </div>

                <button
                  type="button"
                  onClick={() => void handleTogglePresenca(encontroAberto)}
                  disabled={salvandoPresencaId === encontroAberto.id}
                  className={encontroAberto.presente ? "text-[#18d172]" : "text-[#d5d5d5]"}
                  aria-label={encontroAberto.presente ? "Remover presenca" : "Confirmar presenca"}
                >
                  <CheckCircle2 className="h-8 w-8" strokeWidth={2.3} />
                </button>
              </div>

              <div className="mt-5 flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center overflow-hidden rounded-full bg-slate-200 text-xs font-semibold text-slate-700">
                  {encontroAberto.mentor?.foto_url ? (
                    <Image
                      src={encontroAberto.mentor.foto_url}
                      alt={encontroAberto.mentor.nome || "Foto do mentor"}
                      width={40}
                      height={40}
                      className="h-full w-full object-cover"
                      unoptimized
                    />
                  ) : (
                    getMentorIniciais(encontroAberto)
                  )}
                </div>
                <div>
                  <p className="text-sm text-slate-400">Mentor</p>
                  <p className="text-[1.05rem] font-medium text-slate-900">{encontroAberto.mentor?.nome || "Mentor"}</p>
                </div>
              </div>

              {encontroAberto.descricao?.trim() ? (
                <div className="mt-5 rounded-[20px] bg-slate-50 px-4 py-4">
                  <p className="text-sm leading-6 text-slate-600">{encontroAberto.descricao.trim()}</p>
                </div>
              ) : null}

              {(encontroAberto.tipo ?? "").toLowerCase() === "online" ? (
                encontroAberto.link_online ? (
                  <a
                    href={encontroAberto.link_online}
                    target="_blank"
                    rel="noreferrer"
                    className="mt-5 flex w-full items-center justify-center gap-3 rounded-[16px] bg-[#eef5ff] px-4 py-4 text-base font-semibold text-[#1f5de3]"
                  >
                    <Link2 className="h-5 w-5" />
                    Entrar na aula
                  </a>
                ) : (
                  <div className="mt-5 rounded-[16px] bg-slate-50 px-4 py-4 text-sm text-slate-500">
                    O link da aula ao vivo sera informado pelo mentor.
                  </div>
                )
              ) : (
                <div className="mt-5 flex items-start gap-3 rounded-[16px] bg-slate-50 px-4 py-4 text-slate-700">
                  <MapPin className="mt-0.5 h-5 w-5 shrink-0" />
                  <div>
                    <p className="text-sm text-slate-400">Local</p>
                    <p className="mt-1 text-base font-medium">{encontroAberto.local?.trim() || "Igreja local"}</p>
                  </div>
                </div>
              )}
            </section>
          </div>
        </>
      ) : null}

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
          <button onClick={() => router.push("/dashboard")} className="flex flex-col items-center gap-1 text-slate-400">
            <House className="h-7 w-7 fill-current stroke-[1.8]" />
            <span className="text-[10px] font-medium">Inicio</span>
          </button>

          <button className="flex flex-col items-center gap-1 text-black">
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
