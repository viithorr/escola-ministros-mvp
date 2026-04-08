"use client";

import Image from "next/image";
import { Suspense, useEffect, useMemo, useState } from "react";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { CalendarDays, ChartPie, CircleUserRound, House } from "lucide-react";
import AppLoader from "@/components/AppLoader";
import MobileMonthYearPickerModal from "@/components/MobileMonthYearPickerModal";
import { useAuth } from "@/contexts/AuthContext";
import { atualizarBloqueioDoAlunoNaTurma, excluirAlunoDaTurma } from "@/lib/admin-alunos";
import { getDetalheDoAlunoNaTurma, type AlunoDetalheProgressoAdmin } from "@/lib/atividade-aula";
import { getServiceUnavailableMessage, RequestTimeoutError, withTimeout } from "@/lib/network";
import { isValidUserRole, type UsuarioProfile } from "@/lib/usuarios";

const MESES = [
  { value: 1, label: "Jan" },
  { value: 2, label: "Fev" },
  { value: 3, label: "Mar" },
  { value: 4, label: "Abr" },
  { value: 5, label: "Mai" },
  { value: 6, label: "Jun" },
  { value: 7, label: "Jul" },
  { value: 8, label: "Ago" },
  { value: 9, label: "Set" },
  { value: 10, label: "Out" },
  { value: 11, label: "Nov" },
  { value: 12, label: "Dez" },
];

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

function AdminProgressoAlunoPageContent() {
  const { user, profile, profileError, loading } = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();
  const params = useParams<{ id: string }>();
  const alunoId = Array.isArray(params?.id) ? params.id[0] : params?.id;
  const turmaId = searchParams.get("turma");
  const mesAtual = new Date().getMonth() + 1;
  const anoAtual = new Date().getFullYear();
  const [mesSelecionado, setMesSelecionado] = useState(mesAtual);
  const [anoSelecionado, setAnoSelecionado] = useState(anoAtual);
  const [loadingPage, setLoadingPage] = useState(true);
  const [carregandoDados, setCarregandoDados] = useState(true);
  const [salvandoAcao, setSalvandoAcao] = useState<"bloqueio" | "exclusao" | null>(null);
  const [periodoPickerAberto, setPeriodoPickerAberto] = useState(false);
  const [mensagem, setMensagem] = useState("");
  const [detalhe, setDetalhe] = useState<AlunoDetalheProgressoAdmin | null>(null);

  const iniciaisAdmin = useMemo(() => getIniciais(profile), [profile]);
  const iniciaisAluno = useMemo(() => getIniciais(detalhe), [detalhe]);
  const anosDisponiveis = useMemo(
    () => Array.from({ length: 5 }, (_, index) => anoAtual - 2 + index),
    [anoAtual],
  );

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

    if (!alunoId || !turmaId) {
      setMensagem("Nao conseguimos identificar este aluno agora.");
      setCarregandoDados(false);
      return;
    }

    const alunoIdAtual = alunoId;
    const turmaIdAtual = turmaId;

    async function carregarDetalhe() {
      setCarregandoDados(true);
      setMensagem("");

      try {
        const { detalhe: detalheData, error } = await withTimeout(
          getDetalheDoAlunoNaTurma(turmaIdAtual, alunoIdAtual, mesSelecionado, anoSelecionado),
        );

        if (error || !detalheData) {
          setMensagem("Nao conseguimos carregar este aluno agora. Tente novamente.");
          setCarregandoDados(false);
          return;
        }

        setDetalhe(detalheData);
      } catch (error) {
        setMensagem(
          error instanceof RequestTimeoutError
            ? getServiceUnavailableMessage()
            : "Nao conseguimos carregar este aluno agora. Tente novamente.",
        );
      } finally {
        setCarregandoDados(false);
      }
    }

    void carregarDetalhe();
  }, [alunoId, anoSelecionado, loadingPage, mesSelecionado, turmaId]);

  function handleBloquearAcesso() {
    if (!detalhe || !turmaId || salvandoAcao) return;

    const proximoValor = !detalhe.acesso_bloqueado;
    setSalvandoAcao("bloqueio");
    setMensagem("");

    void atualizarBloqueioDoAlunoNaTurma(detalhe.usuario_id, turmaId, proximoValor).then(({ error }) => {
      if (error) {
        setMensagem(error);
        setSalvandoAcao(null);
        return;
      }

      setDetalhe((estadoAtual) =>
        estadoAtual
          ? {
              ...estadoAtual,
              acesso_bloqueado: proximoValor,
            }
          : estadoAtual,
      );
      setSalvandoAcao(null);
    });
  }

  function handleExcluirAluno() {
    if (!detalhe || !turmaId || salvandoAcao) return;

    setSalvandoAcao("exclusao");
    setMensagem("");

    void excluirAlunoDaTurma(detalhe.usuario_id, turmaId).then(({ error }) => {
      if (error) {
        setMensagem(error);
        setSalvandoAcao(null);
        return;
      }

      router.push(`/admin/progresso?turma=${turmaId}`);
    });
  }

  if (loading || loadingPage) {
    return <AppLoader />;
  }

  return (
    <main className="min-h-screen bg-white pb-28 pt-10">
      <header className="mx-auto flex max-w-md items-center justify-between px-6">
        <div className="w-10" />

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
      </header>

      <section className="mx-auto flex max-w-md flex-col gap-8 px-5 pt-10">
        <h1 className="text-[2rem] font-semibold leading-none text-[#0f5d78]">Alunos</h1>

        {mensagem ? (
          <p className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{mensagem}</p>
        ) : null}

        {carregandoDados ? (
          <AppLoader fullScreen={false} />
        ) : detalhe ? (
          <>
            <div className="flex flex-col items-center gap-5">
              <div className="flex h-[176px] w-[176px] items-center justify-center overflow-hidden rounded-full bg-slate-200">
                {detalhe.foto_url ? (
                  <Image
                    src={detalhe.foto_url}
                    alt={detalhe.nome || "Foto do aluno"}
                    width={176}
                    height={176}
                    className="h-full w-full object-cover"
                    unoptimized
                  />
                ) : (
                  <span className="text-4xl font-semibold text-slate-700">{iniciaisAluno}</span>
                )}
              </div>

              <h2 className="text-[2rem] font-medium leading-none text-black">
                {detalhe.nome?.trim() || detalhe.email}
              </h2>
            </div>

            <div className="space-y-4">
              <div
                className={`flex min-h-[54px] items-center justify-between rounded-[4px] px-4 text-sm font-medium ${
                  detalhe.aulas_concluidas === 0 ? "bg-slate-50 text-slate-300" : "bg-[#3B82F6] text-white"
                }`}
              >
                <span>Aulas Conclu&iacute;das</span>
                <span>
                  {detalhe.aulas_concluidas} {detalhe.aulas_concluidas === 1 ? "aula" : "aulas"}
                </span>
              </div>

              <div
                className={`flex min-h-[54px] items-center justify-between rounded-[4px] px-4 text-sm font-medium ${
                  detalhe.aulas_nao_feitas === 0 ? "bg-slate-50 text-slate-300" : "bg-[#990303] text-white"
                }`}
              >
                <span>Aulas n&atilde;o feitas</span>
                <span>
                  {detalhe.aulas_nao_feitas} {detalhe.aulas_nao_feitas === 1 ? "aula" : "aulas"}
                </span>
              </div>
            </div>

            <div className="rounded-[6px] border border-[#c7daf8] bg-white px-4 py-4">
              <div className="mb-2 text-right text-[10px] text-slate-300">Selecione o M&ecirc;s do Dia</div>

              <div className="flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-sm text-slate-500">Total de</p>
                </div>

                <div className="flex-1 text-center text-base font-semibold text-slate-900">
                  {detalhe.faltas_periodo} {detalhe.faltas_periodo === 1 ? "falta" : "faltas"}
                </div>

                <button
                  type="button"
                  onClick={() => setPeriodoPickerAberto(true)}
                  className="text-sm font-medium text-[#3776d8]"
                >
                  {MESES.find((mes) => mes.value === mesSelecionado)?.label}, {anoSelecionado}
                </button>
              </div>
            </div>

            <div className="flex items-center justify-center gap-4 pt-2">
              <button
                type="button"
                onClick={handleBloquearAcesso}
                disabled={salvandoAcao !== null}
                className="rounded-[8px] bg-black px-7 py-3 text-sm font-medium text-white disabled:opacity-60"
              >
                {detalhe.acesso_bloqueado ? "Desbloquear Acesso" : "Bloquear Acesso"}
              </button>

              <button
                type="button"
                onClick={handleExcluirAluno}
                disabled={salvandoAcao !== null}
                className="px-3 py-3 text-sm font-medium text-black disabled:opacity-60"
              >
                Excluir Aluno
              </button>
            </div>
          </>
        ) : null}
      </section>

      <MobileMonthYearPickerModal
        open={periodoPickerAberto}
        month={mesSelecionado}
        year={anoSelecionado}
        minYear={Math.min(...anosDisponiveis)}
        maxYear={Math.max(...anosDisponiveis)}
        onClose={() => setPeriodoPickerAberto(false)}
        onConfirm={(month, year) => {
          setMesSelecionado(month);
          setAnoSelecionado(year);
        }}
      />

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

          <button
            onClick={() => router.push(turmaId ? `/admin/progresso?turma=${turmaId}` : "/admin/progresso")}
            className="flex flex-col items-center gap-1 text-black"
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

export default function AdminProgressoAlunoPage() {
  return (
    <Suspense fallback={<AppLoader />}>
      <AdminProgressoAlunoPageContent />
    </Suspense>
  );
}
