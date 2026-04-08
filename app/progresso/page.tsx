"use client";

import Image from "next/image";
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { CalendarDays, ChartPie, CircleUserRound, House, Pencil } from "lucide-react";
import AppLoader from "@/components/AppLoader";
import NotificationBell from "@/components/NotificationBell";
import { useAuth } from "@/contexts/AuthContext";
import { getTurmaDoAluno, listarConteudoDaTurmaParaAluno } from "@/lib/aluno-dashboard";
import { getMatriculasDoAluno } from "@/lib/matriculas";
import { getServiceUnavailableMessage, RequestTimeoutError, withTimeout } from "@/lib/network";
import { sincronizarPublicacoesAgendadas } from "@/lib/publicacoes";
import { isValidUserRole, type UsuarioProfile } from "@/lib/usuarios";

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

function getPrimeiroNome(profile: UsuarioProfile | null) {
  const nome = profile?.nome?.trim();
  if (!nome) return "Aluno";
  return nome.split(/\s+/)[0] ?? nome;
}

export default function ProgressoPage() {
  const { user, profile, profileError, loading } = useAuth();
  const router = useRouter();
  const [checkingAccess, setCheckingAccess] = useState(true);
  const [loadingResumo, setLoadingResumo] = useState(true);
  const [mensagem, setMensagem] = useState("");
  const [totalAulas, setTotalAulas] = useState(0);
  const [aulasConcluidas, setAulasConcluidas] = useState(0);

  const iniciaisAvatar = useMemo(() => getIniciais(profile), [profile]);
  const primeiroNome = useMemo(() => getPrimeiroNome(profile), [profile]);
  const aulasFaltantes = Math.max(totalAulas - aulasConcluidas, 0);
  const percentualAssistido = totalAulas > 0 ? Math.round((aulasConcluidas / totalAulas) * 100) : 0;
  const percentualFaltante = Math.max(100 - percentualAssistido, 0);
  const progressoCompleto = totalAulas > 0 && aulasConcluidas === totalAulas;
  const semProgresso = aulasConcluidas === 0;

  const corPrincipal = progressoCompleto ? "#3B82F6" : semProgresso ? "#D1D5DB" : "#F59E0B";
  const corRestante = "#E5E7EB";

  const circuloStyle = useMemo(() => {
    if (progressoCompleto || semProgresso) {
      return { background: `conic-gradient(${corPrincipal} 0 100%)` };
    }

    return {
      background: `conic-gradient(${corPrincipal} 0 ${percentualAssistido}%, ${corRestante} ${percentualAssistido}% 100%)`,
    };
  }, [corPrincipal, corRestante, percentualAssistido, progressoCompleto, semProgresso]);

  useEffect(() => {
    async function carregarResumo() {
      if (loading) return;

      if (!user) {
        router.push("/login");
        return;
      }

      if (!profile) {
        setMensagem(profileError || "Nao conseguimos carregar sua conta agora. Tente novamente em alguns instantes.");
        setCheckingAccess(false);
        setLoadingResumo(false);
        return;
      }

      if (!isValidUserRole(profile.role)) {
        setMensagem("Nao conseguimos liberar seu acesso agora. Fale com o administrador.");
        setCheckingAccess(false);
        setLoadingResumo(false);
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
        await sincronizarPublicacoesAgendadas();

        const { matriculas, error: matriculaError } = await withTimeout(getMatriculasDoAluno(user.id));

        if (matriculaError) {
          setMensagem("Nao conseguimos verificar sua turma agora. Tente novamente em alguns instantes.");
          setCheckingAccess(false);
          setLoadingResumo(false);
          return;
        }

        const turmaId = matriculas[0]?.turma_id;

        if (!turmaId) {
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
          setLoadingResumo(false);
          return;
        }

        if (turmaData.arquivada) {
          router.push("/dashboard");
          return;
        }

        const { modulos, error: conteudoError } = await withTimeout(listarConteudoDaTurmaParaAluno(turmaId, user.id));

        if (conteudoError) {
          setMensagem("Nao conseguimos carregar seu progresso agora. Tente novamente.");
          setCheckingAccess(false);
          setLoadingResumo(false);
          return;
        }

        const aulas = modulos.flatMap((modulo) => modulo.aulas).filter((aula) => aula.conta_no_progresso);
        const concluidas = aulas.filter((aula) => aula.concluido).length;

        setTotalAulas(aulas.length);
        setAulasConcluidas(concluidas);
        setCheckingAccess(false);
      } catch (error) {
        setMensagem(
          error instanceof RequestTimeoutError
            ? getServiceUnavailableMessage()
            : "Nao conseguimos carregar seu progresso agora. Tente novamente.",
        );
        setCheckingAccess(false);
      } finally {
        setLoadingResumo(false);
      }
    }

    void carregarResumo();
  }, [loading, profile, profileError, router, user]);

  if (loading || checkingAccess || loadingResumo) {
    return <AppLoader />;
  }

  return (
    <main className="min-h-screen bg-white pb-28 pt-10">
      <header className="mx-auto flex max-w-md items-center justify-between px-6">
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
      </header>

      <section className="mx-auto flex max-w-md flex-col gap-8 px-5 pt-10">
        <h1 className="text-[2rem] font-semibold leading-none text-[#0f5d78]">Progresso</h1>

        {mensagem ? (
          <p className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{mensagem}</p>
        ) : null}

        <div className="flex flex-col items-center gap-5">
          <div
            className="relative flex h-[196px] w-[196px] items-center justify-center rounded-full p-[7px]"
            style={circuloStyle}
          >
            <div className="absolute inset-[10px] rounded-full bg-white" />
            <div className="relative z-10 flex h-[142px] w-[142px] items-center justify-center overflow-hidden rounded-full bg-slate-200">
              {profile?.foto_url ? (
                <Image
                  src={profile.foto_url}
                  alt={profile.nome || "Foto de perfil"}
                  width={142}
                  height={142}
                  className="h-full w-full object-cover"
                  unoptimized
                />
              ) : (
                <span className="text-4xl font-semibold text-slate-700">{iniciaisAvatar}</span>
              )}
            </div>
          </div>

          <h2 className="text-[2.1rem] font-semibold leading-none text-black">{primeiroNome}</h2>
        </div>

        <div className="space-y-4">
          <p className="text-xs font-medium text-[#d0d0d0]">Seu progresso geral</p>

          <div className="flex items-center gap-3">
            <div
              className={`flex min-h-[52px] flex-1 items-center justify-between rounded-[4px] px-4 text-sm font-medium ${
                semProgresso ? "bg-slate-50 text-slate-300" : "text-white"
              }`}
              style={semProgresso ? undefined : { backgroundColor: "#3B82F6" }}
            >
              <span>Voce assistiu</span>
              <span>
                {aulasConcluidas} {aulasConcluidas === 1 ? "aula" : "aulas"}
              </span>
            </div>
            <span className="min-w-[40px] text-right text-lg font-semibold text-slate-900">{percentualAssistido}%</span>
          </div>

          <div className="flex items-center gap-3">
            <div
              className={`flex min-h-[52px] flex-1 items-center justify-between rounded-[4px] px-4 text-sm font-medium ${
                progressoCompleto ? "bg-slate-50 text-slate-300" : "text-white"
              }`}
              style={progressoCompleto ? undefined : { backgroundColor: "#990303" }}
            >
              <span>Ainda falta</span>
              <span>
                {aulasFaltantes} {aulasFaltantes === 1 ? "aula" : "aulas"}
              </span>
            </div>
            <span className="min-w-[40px] text-right text-lg font-semibold text-slate-900">{percentualFaltante}%</span>
          </div>
        </div>

        {progressoCompleto ? (
          <p className="text-center text-[1.05rem] font-semibold leading-8 text-slate-900">
            Parabens, voce assistiu
            <br />
            todas as aulas disponiveis ate agora!
          </p>
        ) : semProgresso ? (
          <p className="text-center text-[1.05rem] font-semibold leading-8 text-slate-900">
            Nao acumule aulas ... Separe um
            <br />
            tempinho para fazer as que faltam!
          </p>
        ) : null}

        <div className="pt-2">
          <button
            type="button"
            onClick={() => router.push("/conta")}
            className="ml-auto flex items-center gap-3 rounded-[12px] bg-[#dbe8ff] px-5 py-3 text-sm font-medium text-[#4f45d1]"
          >
            Alterar Dias de Estudo
            <Pencil className="h-4 w-4 text-black" />
          </button>
        </div>
      </section>

      <nav className="fixed inset-x-0 bottom-0 z-30 border-t border-slate-200 bg-white px-3 py-3">
        <div className="mx-auto flex max-w-md items-center justify-between">
          <button onClick={() => router.push("/dashboard")} className="flex flex-col items-center gap-1 text-slate-400">
            <House className="h-7 w-7 fill-current stroke-[1.8]" />
            <span className="text-[10px] font-medium">Inicio</span>
          </button>

          <button onClick={() => router.push("/encontros")} className="flex flex-col items-center gap-1 text-slate-400">
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
