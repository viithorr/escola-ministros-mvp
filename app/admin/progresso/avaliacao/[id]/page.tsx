"use client";

import Image from "next/image";
import { Suspense, useEffect, useMemo, useState } from "react";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { CalendarDays, ChartPie, CircleUserRound, FileQuestion, House } from "lucide-react";
import AppLoader from "@/components/AppLoader";
import { useAuth } from "@/contexts/AuthContext";
import { getDetalheDaAvaliacaoNaTurma, type AvaliacaoDetalheTurma } from "@/lib/avaliacoes-admin";
import { getServiceUnavailableMessage, RequestTimeoutError, withTimeout } from "@/lib/network";
import { isValidUserRole, type UsuarioProfile } from "@/lib/usuarios";

function getIniciais(profile: { nome: string | null; email: string } | UsuarioProfile | null) {
  const nome = profile?.nome?.trim();

  if (nome) {
    const partes = nome.split(/\s+/).filter(Boolean);
    const primeira = partes[0]?.[0] ?? "";
    const ultima = partes.length > 1 ? partes[partes.length - 1]?.[0] ?? "" : "";
    return `${primeira}${ultima || primeira}`.toUpperCase();
  }

  return (profile?.email?.slice(0, 2) || "AL").toUpperCase();
}

function AdminProgressoAvaliacaoPageContent() {
  const { user, profile, profileError, loading } = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();
  const params = useParams<{ id: string }>();
  const avaliacaoId = Array.isArray(params?.id) ? params.id[0] : params?.id;
  const turmaId = searchParams.get("turma");
  const [loadingPage, setLoadingPage] = useState(true);
  const [carregandoDados, setCarregandoDados] = useState(true);
  const [mensagem, setMensagem] = useState("");
  const [detalhe, setDetalhe] = useState<AvaliacaoDetalheTurma | null>(null);

  const iniciaisAdmin = useMemo(() => getIniciais(profile), [profile]);

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

    if (!avaliacaoId || !turmaId) {
      setMensagem("Nao conseguimos identificar esta avaliacao agora.");
      setCarregandoDados(false);
      return;
    }

    const avaliacaoIdAtual = avaliacaoId;
    const turmaIdAtual = turmaId;

    async function carregarDetalhe() {
      setCarregandoDados(true);
      setMensagem("");

      try {
        const { detalhe: detalheData, error } = await withTimeout(
          getDetalheDaAvaliacaoNaTurma(turmaIdAtual, avaliacaoIdAtual),
        );

        if (error || !detalheData) {
          setMensagem("Nao conseguimos carregar esta avaliacao agora. Tente novamente.");
          setCarregandoDados(false);
          return;
        }

        setDetalhe(detalheData);
      } catch (error) {
        setMensagem(
          error instanceof RequestTimeoutError
            ? getServiceUnavailableMessage()
            : "Nao conseguimos carregar esta avaliacao agora. Tente novamente.",
        );
      } finally {
        setCarregandoDados(false);
      }
    }

    void carregarDetalhe();
  }, [avaliacaoId, loadingPage, turmaId]);

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
              iniciaisAdmin
            )}
          </button>
        </div>
      </header>

      <div className="mx-auto flex w-full max-w-md flex-col gap-5 px-4">
        <section className="space-y-5">
          <h1 className="text-[2rem] font-semibold leading-none text-[#1c6a91]">Avaliacoes</h1>

          {mensagem ? (
            <p className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{mensagem}</p>
          ) : null}

          {carregandoDados ? <AppLoader fullScreen={false} /> : null}

          {!carregandoDados && detalhe ? (
            <>
              <button
                type="button"
                onClick={() => router.push(turmaId ? `/admin/progresso?turma=${turmaId}` : "/admin/progresso")}
                className="text-left text-sm font-medium text-[#1c6a91]"
              >
                Voltar para Progresso
              </button>

              <div className="rounded-[18px] border border-slate-200 bg-white px-4 py-4 shadow-[0_2px_14px_rgba(15,23,42,0.08)]">
                <div className="flex items-start gap-3">
                  <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-[#e7f1f6] text-[#0e5d77]">
                    <FileQuestion className="h-5 w-5" />
                  </div>

                  <div className="space-y-1">
                    <p className="text-lg font-semibold text-slate-900">{detalhe.aula_titulo}</p>
                    <p className="text-xs text-slate-400">{detalhe.modulo_titulo || "Sem modulo"}</p>
                  </div>
                </div>

                <div className="mt-4 grid grid-cols-2 gap-3">
                  <div className="rounded-[12px] bg-[#e9f7ef] px-4 py-3">
                    <p className="text-[10px] uppercase tracking-[0.08em] text-[#5b9776]">Aprovados</p>
                    <p className="text-lg font-semibold text-[#11566C]">{detalhe.aprovados}</p>
                  </div>

                  <div className="rounded-[12px] bg-[#fbeaea] px-4 py-3">
                    <p className="text-[10px] uppercase tracking-[0.08em] text-[#b05d5d]">Pendentes</p>
                    <p className="text-lg font-semibold text-[#990303]">{detalhe.pendentes}</p>
                  </div>

                  <div className="rounded-[12px] bg-slate-50 px-4 py-3">
                    <p className="text-[10px] uppercase tracking-[0.08em] text-slate-400">Fizeram</p>
                    <p className="text-lg font-semibold text-slate-900">{detalhe.fizeram}</p>
                  </div>

                  <div className="rounded-[12px] bg-slate-50 px-4 py-3">
                    <p className="text-[10px] uppercase tracking-[0.08em] text-slate-400">Media</p>
                    <p className="text-lg font-semibold text-slate-900">
                      {detalhe.media_ultima_nota !== null ? `${detalhe.media_ultima_nota}%` : "--"}
                    </p>
                  </div>
                </div>
              </div>

              {detalhe.alunos.length === 0 ? (
                <p className="rounded-[12px] bg-slate-100 px-4 py-6 text-sm text-slate-500">
                  Nenhum aluno vinculado a esta turma ainda.
                </p>
              ) : (
                <div className="space-y-4">
                  {detalhe.alunos.map((aluno) => (
                    <div
                      key={aluno.usuario_id}
                      className="rounded-[16px] bg-white px-4 py-4 shadow-[0_2px_14px_rgba(15,23,42,0.08)]"
                    >
                      <div className="flex items-center justify-between gap-3">
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
                              getIniciais(aluno)
                            )}
                          </div>

                          <div className="min-w-0">
                            <p className="truncate text-sm font-semibold text-slate-900">{aluno.nome || aluno.email}</p>
                            <p className="text-xs text-slate-400">
                              {aluno.fez
                                ? aluno.finalizada_em
                                  ? new Date(aluno.finalizada_em).toLocaleString("pt-BR")
                                  : "Avaliacao realizada"
                                : "Ainda nao respondeu"}
                            </p>
                          </div>
                        </div>

                        <div
                          className={`rounded-full px-3 py-1 text-xs font-semibold ${
                            aluno.aprovou
                              ? "bg-[#e9f7ef] text-[#11566C]"
                              : aluno.fez
                                ? "bg-[#fbeaea] text-[#990303]"
                                : "bg-slate-100 text-slate-500"
                          }`}
                        >
                          {aluno.aprovou ? "100%" : aluno.fez ? `${aluno.ultima_nota ?? 0}%` : "Pendente"}
                        </div>
                      </div>

                      <div className="mt-3 flex items-center justify-between text-xs text-slate-400">
                        <span>{aluno.tentativas} {aluno.tentativas === 1 ? "tentativa" : "tentativas"}</span>
                        <span>{aluno.aprovou ? "Aprovado" : aluno.fez ? "Ainda nao passou" : "Nao fez"}</span>
                      </div>
                    </div>
                  ))}
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
            onClick={() => router.push(turmaId ? `/admin/encontros?turma=${turmaId}` : "/admin/encontros")}
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

export default function AdminProgressoAvaliacaoPage() {
  return (
    <Suspense fallback={<AppLoader />}>
      <AdminProgressoAvaliacaoPageContent />
    </Suspense>
  );
}
