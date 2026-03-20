"use client";

import Image from "next/image";
import { useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { CalendarDays, ChartPie, CircleUserRound, House } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { listarAtividadeDosAlunosDaAula, salvarPresencaManualDaAula, type AlunoAtividadeAula } from "@/lib/atividade-aula";
import { getAulaComModuloTurma } from "@/lib/aulas";
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

export default function AlunosDaAulaPage() {
  const { user, profile, profileError, loading } = useAuth();
  const router = useRouter();
  const params = useParams<{ id: string }>();
  const aulaId = Array.isArray(params?.id) ? params.id[0] : params?.id;
  const [loadingPage, setLoadingPage] = useState(true);
  const [carregandoDados, setCarregandoDados] = useState(true);
  const [mensagem, setMensagem] = useState("");
  const [tituloAula, setTituloAula] = useState("");
  const [alunos, setAlunos] = useState<AlunoAtividadeAula[]>([]);
  const [alterandoAlunoId, setAlterandoAlunoId] = useState<string | null>(null);

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
    if (loadingPage || !aulaId) return;

    async function carregarTela() {
      setCarregandoDados(true);
      setMensagem("");

      try {
        const { aula, error } = await withTimeout(getAulaComModuloTurma(aulaId));

        if (error || !aula?.modulos?.turmas) {
          setMensagem("Nao conseguimos carregar esta aula agora. Tente novamente.");
          setCarregandoDados(false);
          return;
        }

        setTituloAula(aula.titulo);

        const { alunos: alunosData, error: alunosError } = await withTimeout(
          listarAtividadeDosAlunosDaAula(aula.modulos.turmas.id, aula.id),
        );

        if (alunosError) {
          setMensagem("Nao conseguimos carregar a atividade dos alunos agora.");
          setCarregandoDados(false);
          return;
        }

        setAlunos(alunosData);
      } catch (error) {
        setMensagem(
          error instanceof RequestTimeoutError
            ? getServiceUnavailableMessage()
            : "Nao conseguimos carregar a atividade dos alunos agora.",
        );
      } finally {
        setCarregandoDados(false);
      }
    }

    void carregarTela();
  }, [aulaId, loadingPage]);

  async function handleMarcarPresenca(usuarioId: string, presente: boolean) {
    if (!aulaId) return;

    setAlterandoAlunoId(usuarioId);
    setMensagem("");

    const { error } = await salvarPresencaManualDaAula(aulaId, usuarioId, presente);

    if (error) {
      setMensagem("Nao foi possivel atualizar a presenca agora. Tente novamente.");
      setAlterandoAlunoId(null);
      return;
    }

    setAlunos((estadoAtual) =>
      estadoAtual.map((aluno) =>
        aluno.usuario_id === usuarioId
          ? {
              ...aluno,
              presente,
              confirmado_em: new Date().toISOString(),
            }
          : aluno,
      ),
    );
    setAlterandoAlunoId(null);
  }

  if (loading || loadingPage) {
    return <div>Carregando acesso...</div>;
  }

  return (
    <main className="min-h-screen bg-white pb-28 pt-28">
      <header className="fixed inset-x-0 top-0 z-30 bg-white px-4 pb-4 pt-5">
        <div className="mx-auto flex max-w-md items-center justify-between">
          <button onClick={() => router.back()} className="w-12 text-left text-sm text-slate-600">
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
            {iniciaisAdmin}
          </button>
        </div>
      </header>

      <div className="mx-auto flex w-full max-w-md flex-col gap-5 px-4">
        <section className="space-y-4">
          <h1 className="text-[2rem] font-semibold leading-none text-slate-900">Atividade dos Alunos</h1>

          {tituloAula ? <p className="text-sm text-slate-400">{tituloAula}</p> : null}

          {mensagem ? (
            <p className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
              {mensagem}
            </p>
          ) : null}

          {carregandoDados ? (
            <div className="rounded-[18px] bg-slate-100 px-4 py-12 text-center text-slate-500">
              Carregando atividade...
            </div>
          ) : null}

          {!carregandoDados && (
            <div className="space-y-4 rounded-[3px] bg-[#f2f2f2] px-4 py-5">
              <div className="flex items-center justify-between px-1 text-xs text-slate-400">
                <span />
                <div className="flex items-center gap-7 pr-1">
                  <span>Presente</span>
                  <span>Ausente</span>
                </div>
              </div>

              {alunos.length === 0 ? (
                <p className="px-1 py-4 text-sm text-slate-500">Nenhum aluno vinculado a esta turma.</p>
              ) : null}

              {alunos.map((aluno) => {
                const presente = aluno.presente;
                const statusTexto = aluno.concluido ? "Aula Concluida" : "Aula Nao Concluida";

                return (
                  <article key={aluno.usuario_id} className="flex items-center justify-between gap-4">
                    <div className="flex min-w-0 items-center gap-4">
                      <div className="flex h-14 w-14 items-center justify-center rounded-full bg-slate-300 text-sm font-semibold text-slate-700">
                        {getIniciais({ nome: aluno.nome, email: aluno.email })}
                      </div>

                      <div className="min-w-0">
                        <p className="truncate text-[1.1rem] font-medium text-slate-900">
                          {aluno.nome?.trim() || aluno.email}
                        </p>
                        <p className="text-sm text-slate-400">{statusTexto}</p>
                      </div>
                    </div>

                    <div className="flex items-center gap-7 pr-1">
                      <button
                        type="button"
                        onClick={() => handleMarcarPresenca(aluno.usuario_id, true)}
                        disabled={alterandoAlunoId === aluno.usuario_id}
                        className={`flex h-8 w-8 items-center justify-center rounded-full border-[3px] ${
                          presente ? "border-black" : "border-black"
                        }`}
                        aria-label={`Marcar ${aluno.nome || aluno.email} como presente`}
                      >
                        <span
                          className={`h-4 w-4 rounded-full ${presente ? "bg-[#2457ff]" : "bg-transparent"}`}
                        />
                      </button>

                      <button
                        type="button"
                        onClick={() => handleMarcarPresenca(aluno.usuario_id, false)}
                        disabled={alterandoAlunoId === aluno.usuario_id}
                        className="flex h-8 w-8 items-center justify-center rounded-full border-[3px] border-black"
                        aria-label={`Marcar ${aluno.nome || aluno.email} como ausente`}
                      >
                        <span
                          className={`h-4 w-4 rounded-full ${presente ? "bg-transparent" : "bg-[#2457ff]"}`}
                        />
                      </button>
                    </div>
                  </article>
                );
              })}
            </div>
          )}
        </section>
      </div>

      <nav className="fixed inset-x-0 bottom-0 z-30 border-t border-slate-200 bg-white px-3 py-3">
        <div className="mx-auto flex max-w-md items-center justify-between">
          <button onClick={() => router.push("/admin")} className="flex flex-col items-center gap-1 text-black">
            <House className="h-7 w-7 fill-current stroke-[1.8]" />
            <span className="text-[10px] font-medium">Inicio</span>
          </button>

          <button className="flex flex-col items-center gap-1 text-slate-400">
            <CalendarDays className="h-7 w-7 stroke-[1.8]" />
            <span className="text-[10px] font-medium">Agenda</span>
          </button>

          <button className="flex flex-col items-center gap-1 text-slate-400">
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
    </main>
  );
}
