"use client";

import Image from "next/image";
import { Suspense, useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { CalendarDays, ChartPie, CircleUserRound, FileQuestion, House } from "lucide-react";
import AppLoader from "@/components/AppLoader";
import { useAuth } from "@/contexts/AuthContext";
import { listarProgressoDosAlunosDaTurma, type AlunoProgressoTurma } from "@/lib/atividade-aula";
import { listarAvaliacoesDaTurma, type AvaliacaoResumoTurma } from "@/lib/avaliacoes-admin";
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
  const [abaSelecionada, setAbaSelecionada] = useState<"aulas" | "avaliacoes">("aulas");

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
        const { turmas: turmasData, error: turmasError } = await withTimeout(listarTurmas());

        if (turmasError) {
          setMensagem("Nao conseguimos carregar suas turmas agora. Tente novamente em alguns instantes.");
          setCarregandoDados(false);
          return;
        }

        setTurmas(turmasData);

        if (!turmaIdSelecionada) {
          setTurma(null);
          setAlunos([]);
          setCarregandoDados(false);
          return;
        }

        const turmaData = turmasData.find((item) => item.id === turmaIdSelecionada) ?? null;

        const [{ alunos: alunosData, error: alunosError }, { avaliacoes: avaliacoesData, error: avaliacoesError }] = await Promise.all([
          withTimeout(listarProgressoDosAlunosDaTurma(turmaIdSelecionada)),
          withTimeout(listarAvaliacoesDaTurma(turmaIdSelecionada)),
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

        setTurma(turmaData);
        setAlunos(alunosData);
        setAvaliacoes(avaliacoesData);
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

              <div className="grid grid-cols-2 gap-3">
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
              ) : (
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
