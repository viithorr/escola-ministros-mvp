"use client";

import Image from "next/image";
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/contexts/AuthContext";
import { getMatriculasDoAluno } from "@/lib/matriculas";
import { getServiceUnavailableMessage, RequestTimeoutError, withTimeout } from "@/lib/network";
import { atualizarOnboardingAluno, isValidUserRole, type UsuarioProfile } from "@/lib/usuarios";

const DIAS_SEMANA = ["Domingo", "Segunda", "Terca", "Quarta", "Quinta", "Sexta", "Sabado"];
const HORAS = Array.from({ length: 24 }, (_, index) => String(index).padStart(2, "0"));

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

export default function BoasVindasPage() {
  const { user, profile, profileError, loading, refreshProfile } = useAuth();
  const router = useRouter();
  const [checkingAccess, setCheckingAccess] = useState(true);
  const [mensagem, setMensagem] = useState("");
  const [diasSelecionados, setDiasSelecionados] = useState<string[]>([]);
  const [horaSelecionada, setHoraSelecionada] = useState("");
  const [mostrarModalHorario, setMostrarModalHorario] = useState(false);
  const [salvando, setSalvando] = useState(false);

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

      try {
        const { matriculas, error } = await withTimeout(getMatriculasDoAluno(user.id));

        if (error) {
          setMensagem("Nao conseguimos verificar sua turma agora. Tente novamente em alguns instantes.");
          setCheckingAccess(false);
          return;
        }

        if (!matriculas[0]?.turma_id) {
          router.push("/entrar-turma?origem=sem-turma");
          return;
        }

        if (profile.onboarding_concluido) {
          router.push("/dashboard");
          return;
        }

        setDiasSelecionados(profile.dias_estudo ?? []);
        setHoraSelecionada(profile.horario_estudo ? profile.horario_estudo.slice(0, 5) : "");
        setCheckingAccess(false);
      } catch (error) {
        setMensagem(
          error instanceof RequestTimeoutError
            ? getServiceUnavailableMessage()
            : getServiceUnavailableMessage(),
        );
        setCheckingAccess(false);
      }
    }

    void verificarAcesso();
  }, [loading, profile, profileError, router, user]);

  function toggleDia(dia: string) {
    setMensagem("");
    setDiasSelecionados((estadoAtual) =>
      estadoAtual.includes(dia)
        ? estadoAtual.filter((item) => item !== dia)
        : [...estadoAtual, dia],
    );
  }

  async function handleFinalizar() {
    if (!user) return;

    if (diasSelecionados.length < 2) {
      setMensagem("Selecione pelo menos 2 dias da semana para continuar.");
      return;
    }

    setSalvando(true);
    setMensagem("");

    try {
      const { error } = await withTimeout(
        atualizarOnboardingAluno(user.id, {
          dias_estudo: diasSelecionados,
          horario_estudo: horaSelecionada || null,
        }),
      );

      if (error) {
        setMensagem("Nao foi possivel salvar sua rotina agora. Tente novamente.");
        setSalvando(false);
        return;
      }

      await refreshProfile();
      router.push("/dashboard");
    } catch (error) {
      setMensagem(
        error instanceof RequestTimeoutError
          ? getServiceUnavailableMessage()
          : "Nao foi possivel salvar sua rotina agora. Tente novamente.",
      );
      setSalvando(false);
    }
  }

  if (loading || checkingAccess) {
    return <div>Carregando acesso...</div>;
  }

  return (
    <main className="min-h-screen bg-white pb-12 pt-8">
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
            iniciaisAvatar
          )}
        </button>
      </header>

      <section className="mx-auto max-w-md px-6 pt-10">
        <div className="space-y-5">
          <h1 className="max-w-[12rem] text-[3rem] font-semibold leading-[0.95] text-[#0f5d78]">
            Seja muito bem vindo!
          </h1>

          <p className="max-w-[20rem] text-sm font-medium leading-5 text-slate-900">
            Selecione abaixo no minimo 2 dias da semana e o horario (opcional) reservado para seus estudos.
          </p>

          {mensagem ? (
            <p className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
              {mensagem}
            </p>
          ) : null}

          <div className="space-y-4 pt-5">
            <h2 className="text-[1.3rem] font-medium text-[#2b7999]">
              Meus dias de estudo <span className="text-[#d7d7d7]">(obrigatorio)</span>
            </h2>

            <div className="grid grid-cols-3 gap-3">
              {DIAS_SEMANA.map((dia) => {
                const selecionado = diasSelecionados.includes(dia);

                return (
                  <button
                    key={dia}
                    type="button"
                    onClick={() => toggleDia(dia)}
                    className={`rounded-[12px] px-3 py-3 text-sm font-medium transition ${
                      selecionado
                        ? "bg-[#cbd8ff] text-[#4b46c3]"
                        : "bg-[#edf3ff] text-[#cfd7ea]"
                    }`}
                  >
                    {dia}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="space-y-4 pt-6">
            <h2 className="text-[1.3rem] font-medium text-[#2b7999]">
              Meus horarios <span className="text-[#d7d7d7]">(opcional)</span>
            </h2>

            <button
              type="button"
              onClick={() => setMostrarModalHorario(true)}
              className="w-full rounded-[12px] bg-[#2948c9] px-4 py-4 text-white"
            >
              <div className="flex items-center justify-between text-[11px] uppercase tracking-[0.08em] text-white/70">
                <span>Data</span>
                <span>Hora</span>
              </div>
              <div className="mt-2 text-center text-[2rem] font-medium leading-none">
                {horaSelecionada || "--:--"}
              </div>
            </button>
          </div>

          <button
            type="button"
            onClick={handleFinalizar}
            disabled={salvando}
            className="mx-auto mt-10 block rounded-[10px] bg-[#0e5d77] px-10 py-3 text-base font-medium text-white disabled:opacity-60"
          >
            {salvando ? "Finalizando..." : "Finalizar"}
          </button>
        </div>
      </section>

      {mostrarModalHorario ? (
        <div className="fixed inset-0 z-50 bg-slate-950/45 px-4 py-6 sm:flex sm:items-center sm:justify-center">
          <div className="mx-auto w-full max-w-sm rounded-[24px] bg-white px-5 py-5 shadow-2xl">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-semibold text-slate-900">Selecionar horario</h3>
              <button
                type="button"
                onClick={() => setMostrarModalHorario(false)}
                className="text-xl leading-none text-slate-500"
              >
                x
              </button>
            </div>

            <div className="mt-5 grid grid-cols-4 gap-3">
              {HORAS.map((hora) => {
                const valor = `${hora}:00`;
                const selecionado = horaSelecionada === valor;

                return (
                  <button
                    key={valor}
                    type="button"
                    onClick={() => setHoraSelecionada(valor)}
                    className={`rounded-[10px] px-3 py-3 text-sm font-medium ${
                      selecionado
                        ? "bg-[#2948c9] text-white"
                        : "bg-[#edf3ff] text-slate-600"
                    }`}
                  >
                    {valor}
                  </button>
                );
              })}
            </div>

            <div className="mt-5 flex gap-3">
              <button
                type="button"
                onClick={() => {
                  setHoraSelecionada("");
                  setMostrarModalHorario(false);
                }}
                className="flex-1 rounded-[10px] border border-slate-200 px-4 py-3 text-sm font-medium text-slate-700"
              >
                Limpar
              </button>
              <button
                type="button"
                onClick={() => setMostrarModalHorario(false)}
                className="flex-1 rounded-[10px] bg-[#0e5d77] px-4 py-3 text-sm font-medium text-white"
              >
                Confirmar
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </main>
  );
}
