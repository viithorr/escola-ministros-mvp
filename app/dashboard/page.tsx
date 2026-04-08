"use client";

import Image from "next/image";
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  CalendarDays,
  ChartPie,
  CheckCircle2,
  ChevronDown,
  CircleUserRound,
  Clock3,
  House,
  Lock,
  PlaySquare,
} from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { getMatriculasDoAluno } from "@/lib/matriculas";
import { getServiceUnavailableMessage, RequestTimeoutError, withTimeout } from "@/lib/network";
import { sincronizarPublicacoesAgendadas } from "@/lib/publicacoes";
import { isValidUserRole, type UsuarioProfile } from "@/lib/usuarios";
import {
  getTurmaDoAluno,
  listarConteudoDaTurmaParaAluno,
  type ModuloAlunoDashboard,
  type TurmaAlunoDashboard,
} from "@/lib/aluno-dashboard";
import AppLoader from "@/components/AppLoader";
import NotificationBell from "@/components/NotificationBell";

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

export default function Dashboard() {
  const { user, profile, profileError, loading } = useAuth();
  const router = useRouter();
  const [turma, setTurma] = useState<TurmaAlunoDashboard | null>(null);
  const [modulos, setModulos] = useState<ModuloAlunoDashboard[]>([]);
  const [loadingTurma, setLoadingTurma] = useState(true);
  const [mensagem, setMensagem] = useState("");
  const [moduloExpandido, setModuloExpandido] = useState<string | null>(null);

  const iniciaisAvatar = useMemo(() => getIniciais(profile), [profile]);

  useEffect(() => {
    async function verificarUsuario() {
      if (loading) return;

      if (!user) {
        router.push("/login");
        return;
      }

      if (!profile) {
        setMensagem(profileError || "Nao conseguimos carregar sua conta agora. Tente novamente em alguns instantes.");
        setLoadingTurma(false);
        return;
      }

      if (!isValidUserRole(profile.role)) {
        setMensagem("Nao conseguimos liberar seu acesso agora. Fale com o administrador.");
        setLoadingTurma(false);
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
          setLoadingTurma(false);
          return;
        }

        if (matriculas.length > 1) {
          setMensagem("Encontramos mais de uma turma vinculada ao seu acesso. Fale com o administrador.");
          setLoadingTurma(false);
          return;
        }

        const matriculaAtual = matriculas[0];

        if (!matriculaAtual?.turma_id) {
          router.push("/entrar-turma?origem=sem-turma");
          return;
        }

        if (matriculaAtual.acesso_bloqueado) {
          setMensagem("Seu acesso a esta turma esta bloqueado no momento. Fale com o administrador.");
          setLoadingTurma(false);
          return;
        }

        const [{ turma: turmaData, turmaId, error: turmaError }, { modulos: modulosData, error: modulosError }] =
          await Promise.all([
            withTimeout(getTurmaDoAluno(user.id)),
            withTimeout(listarConteudoDaTurmaParaAluno(matriculaAtual.turma_id, user.id)),
          ]);

        if (turmaError || !turmaData || !turmaId) {
          setMensagem("Nao conseguimos carregar os dados da sua turma agora. Tente novamente em alguns instantes.");
          setLoadingTurma(false);
          return;
        }

        if (turmaData.arquivada) {
          setMensagem("Esta turma esta arquivada no momento. O conteudo e as interacoes estao indisponiveis.");
          setLoadingTurma(false);
          return;
        }

        if (modulosError) {
          setMensagem("Nao conseguimos carregar suas aulas agora. Tente novamente em alguns instantes.");
          setLoadingTurma(false);
          return;
        }

        setTurma(turmaData);
        setModulos(modulosData);
        setModuloExpandido(modulosData[0]?.id ?? null);
        setLoadingTurma(false);
      } catch (error) {
        if (error instanceof RequestTimeoutError) {
          setMensagem(getServiceUnavailableMessage());
        } else {
          setMensagem(getServiceUnavailableMessage());
        }
        setLoadingTurma(false);
      }
    }

    void verificarUsuario();
  }, [user, profile, profileError, loading, router]);

  if (loading || loadingTurma) {
    return <AppLoader />;
  }

  if (mensagem) {
    return (
      <div className="min-h-screen flex items-center justify-center px-6">
        <p className="text-center max-w-md text-red-600">{mensagem}</p>
      </div>
    );
  }

  if (!turma) {
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

      <div className="mx-auto flex w-full max-w-md flex-col gap-5 px-4">
        <section className="space-y-5">
          <h1 className="text-[2rem] font-semibold leading-none text-[#1c6a91]">Minhas Aulas</h1>

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
                <div className="flex h-full items-center justify-center text-sm text-slate-400">Sem capa</div>
              )}
            </div>

            <div className="space-y-2 px-5 py-4">
              <p className="text-2xl font-semibold text-slate-900">{turma.nome}</p>
              <p className="text-xs uppercase tracking-[0.25em] text-[#97abd8]">
                {turma.categoria ? turma.categoria : "Sem categoria"}
              </p>
            </div>
          </article>

          <p className="text-xs text-[#d8d8d8]">{turma.nome} Iniciante</p>

          {modulos.length === 0 ? (
            <p className="rounded-[18px] bg-slate-100 px-4 py-8 text-center text-slate-500">
              Nenhuma aula liberada ainda.
            </p>
          ) : (
            <div className="space-y-4">
              {modulos.map((modulo) => {
                const expandido = moduloExpandido === modulo.id;

                return (
                  <article key={modulo.id} className="rounded-[3px] bg-[#e9e9e9] px-5 py-4">
                    <div className="flex items-center justify-between gap-3">
                      <h2 className="text-[1.05rem] font-semibold text-slate-900">{modulo.titulo}</h2>

                      <button
                        type="button"
                        onClick={() => setModuloExpandido((atual) => (atual === modulo.id ? null : modulo.id))}
                        className="text-slate-700"
                        aria-label={expandido ? "Recolher modulo" : "Expandir modulo"}
                      >
                        <ChevronDown
                          className={`h-5 w-5 transition-transform ${expandido ? "rotate-180" : ""}`}
                        />
                      </button>
                    </div>

                    {expandido ? (
                      <div className="space-y-3 pt-5">
                        {modulo.aulas.map((aula, index) => (
                          <button
                            key={aula.id}
                            type="button"
                            onClick={() => {
                              if (aula.bloqueado || aula.bloqueado_por_prazo || aula.bloqueado_por_avaliacao) return;
                              router.push(`/aluno/aula/${aula.id}`);
                            }}
                            className="flex w-full items-start gap-3 rounded-[4px] bg-white px-4 py-3 text-left shadow-[0_1px_6px_rgba(15,23,42,0.06)]"
                          >
                            <span className="pt-1 text-lg text-slate-700">{index + 1}</span>

                            <div className="min-w-0 flex-1">
                              <div className="flex items-center gap-2">
                                <p className="truncate text-[0.98rem] font-semibold text-slate-900">
                                  {aula.titulo}
                                </p>
                                {aula.concluido ? (
                                  <CheckCircle2 className="h-5 w-5 shrink-0 text-[#11a6db]" strokeWidth={2.4} />
                                ) : null}
                              </div>
                              <div className="mt-1 flex items-center gap-1 text-[11px] text-slate-400">
                                <Clock3 className="h-3 w-3" />
                                <span>{aula.duracao_texto || "--:--"}</span>
                              </div>
                            </div>

                            <div className="pt-1">
                              {aula.bloqueado || aula.bloqueado_por_prazo || aula.bloqueado_por_avaliacao ? (
                                <Lock className="h-5 w-5 text-[#c7c7c7]" strokeWidth={2.2} />
                              ) : (
                                <PlaySquare className="h-5 w-5 text-black" strokeWidth={2.2} />
                              )}
                            </div>
                          </button>
                        ))}
                      </div>
                    ) : null}
                  </article>
                );
              })}
            </div>
          )}
        </section>
      </div>

      <nav className="fixed inset-x-0 bottom-0 z-30 border-t border-slate-200 bg-white px-3 py-3">
        <div className="mx-auto flex max-w-md items-center justify-between">
          <button className="flex flex-col items-center gap-1 text-black">
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
