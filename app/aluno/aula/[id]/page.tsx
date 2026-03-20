"use client";

import Image from "next/image";
import { useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import {
  CalendarDays,
  ChartPie,
  CheckCircle2,
  ChevronDown,
  CircleUserRound,
  Clock3,
  House,
  Send,
} from "lucide-react";
import { YouTubePlayer } from "@/components/YouTubePlayer";
import { useAuth } from "@/contexts/AuthContext";
import { getAulaComModuloTurma, listarMateriaisDaAula, type MaterialAula } from "@/lib/aulas";
import { getMatriculasDoAluno } from "@/lib/matriculas";
import { getServiceUnavailableMessage, RequestTimeoutError, withTimeout } from "@/lib/network";
import { getProgressoDoAlunoNaAula, salvarConclusaoDaAula } from "@/lib/atividade-aula";
import { isValidUserRole, type UsuarioProfile } from "@/lib/usuarios";

type AulaAlunoCache = {
  tituloAula: string;
  videoUrl: string;
  duracaoTexto: string;
  concluida: boolean;
  materiais: MaterialAula[];
  dicaModulo: string;
};

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

export default function AulaAlunoPage() {
  const { user, profile, profileError, loading } = useAuth();
  const router = useRouter();
  const params = useParams<{ id: string }>();
  const aulaId = Array.isArray(params?.id) ? params.id[0] : params?.id;
  const [loadingPage, setLoadingPage] = useState(true);
  const [carregandoDados, setCarregandoDados] = useState(true);
  const [mensagem, setMensagem] = useState("");
  const [tituloAula, setTituloAula] = useState("");
  const [videoUrl, setVideoUrl] = useState("");
  const [duracaoTexto, setDuracaoTexto] = useState("");
  const [concluida, setConcluida] = useState(false);
  const [materiais, setMateriais] = useState<MaterialAula[]>([]);
  const [materiaisAbertos, setMateriaisAbertos] = useState(true);
  const [dicaModulo, setDicaModulo] = useState("");
  const [salvandoConclusao, setSalvandoConclusao] = useState(false);
  const [duvida, setDuvida] = useState("");

  const iniciaisAvatar = useMemo(() => getIniciais(profile), [profile]);
  const storageKey = useMemo(() => (aulaId ? `aula-aluno-cache:${aulaId}` : null), [aulaId]);

  useEffect(() => {
    if (!storageKey || typeof window === "undefined") return;

    const cached = window.sessionStorage.getItem(storageKey);
    if (!cached) return;

    try {
      const payload = JSON.parse(cached) as AulaAlunoCache;
      setTituloAula(payload.tituloAula);
      setVideoUrl(payload.videoUrl);
      setDuracaoTexto(payload.duracaoTexto);
      setConcluida(payload.concluida);
      setMateriais(payload.materiais);
      setDicaModulo(payload.dicaModulo);
      setCarregandoDados(false);
    } catch {
      window.sessionStorage.removeItem(storageKey);
    }
  }, [storageKey]);

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

      if (profile.role === "admin") {
        router.push("/admin");
        return;
      }

      if (!profile.onboarding_concluido) {
        router.push("/boas-vindas");
        return;
      }

      setLoadingPage(false);
    }

    void verificarAcesso();
  }, [loading, profile, profileError, router, user]);

  useEffect(() => {
    if (loadingPage || !aulaId || !user) return;

    async function carregarTela() {
      const temCache =
        typeof window !== "undefined" && storageKey ? Boolean(window.sessionStorage.getItem(storageKey)) : false;

      if (!temCache) {
        setCarregandoDados(true);
      }
      setMensagem("");

      try {
        const [{ aula, error: aulaError }, { progresso, error: progressoError }] = await Promise.all([
          withTimeout(getAulaComModuloTurma(aulaId)),
          withTimeout(getProgressoDoAlunoNaAula(aulaId, user.id)),
        ]);

        if (aulaError || !aula || !aula.modulos?.turmas) {
          setMensagem("Nao conseguimos carregar esta aula agora. Tente novamente.");
          setCarregandoDados(false);
          return;
        }

        if (progressoError) {
          setMensagem("Nao conseguimos carregar seu progresso nesta aula agora.");
          setCarregandoDados(false);
          return;
        }

        const { matriculas, error: matriculaError } = await withTimeout(getMatriculasDoAluno(user.id));

        if (matriculaError) {
          setMensagem("Nao conseguimos verificar sua turma agora. Tente novamente em alguns instantes.");
          setCarregandoDados(false);
          return;
        }

        const turmaDoAluno = matriculas[0]?.turma_id;

        if (!turmaDoAluno || turmaDoAluno !== aula.modulos.turmas.id) {
          setMensagem("Esta aula nao esta disponivel para o seu acesso.");
          setCarregandoDados(false);
          return;
        }

        if (aula.bloqueado) {
          setMensagem("Esta aula esta bloqueada no momento.");
          setCarregandoDados(false);
          return;
        }

        const { materiais: materiaisData, error: materiaisError } = await withTimeout(listarMateriaisDaAula(aulaId));

        if (materiaisError) {
          setMensagem("Nao conseguimos carregar os materiais desta aula agora.");
          setCarregandoDados(false);
          return;
        }

        setTituloAula(aula.titulo);
        setVideoUrl(aula.video_url ?? "");
        setDuracaoTexto(aula.duracao_texto ?? "");
        setConcluida(progresso?.concluido ?? false);
        setMateriais(materiaisData);
        setDicaModulo(aula.modulos.titulo);

        if (storageKey && typeof window !== "undefined") {
          const payload: AulaAlunoCache = {
            tituloAula: aula.titulo,
            videoUrl: aula.video_url ?? "",
            duracaoTexto: aula.duracao_texto ?? "",
            concluida: progresso?.concluido ?? false,
            materiais: materiaisData,
            dicaModulo: aula.modulos.titulo,
          };
          window.sessionStorage.setItem(storageKey, JSON.stringify(payload));
        }
      } catch (error) {
        setMensagem(
          error instanceof RequestTimeoutError
            ? getServiceUnavailableMessage()
            : "Nao conseguimos carregar esta aula agora. Tente novamente.",
        );
      } finally {
        setCarregandoDados(false);
      }
    }

    void carregarTela();
  }, [aulaId, loadingPage, storageKey, user]);

  async function handleMarcarConcluida(valor: boolean) {
    if (!user || !aulaId) return;

    setSalvandoConclusao(true);
    setMensagem("");

    const { error } = await salvarConclusaoDaAula(aulaId, user.id, valor);

    if (error) {
      setMensagem("Nao foi possivel atualizar a conclusao da aula agora. Tente novamente.");
      setSalvandoConclusao(false);
      return;
    }

    setConcluida(valor);
    if (storageKey && typeof window !== "undefined") {
      const cached = window.sessionStorage.getItem(storageKey);
      if (cached) {
        try {
          const payload = JSON.parse(cached) as AulaAlunoCache;
          payload.concluida = valor;
          window.sessionStorage.setItem(storageKey, JSON.stringify(payload));
        } catch {
          window.sessionStorage.removeItem(storageKey);
        }
      }
    }
    setSalvandoConclusao(false);
  }

  if (loading || loadingPage) {
    return <div>Carregando acesso...</div>;
  }

  return (
    <main className="min-h-screen bg-white pb-28 pt-28">
      <header className="fixed inset-x-0 top-0 z-30 bg-white px-4 pb-4 pt-5">
        <div className="mx-auto flex max-w-md items-center justify-between">
          <button onClick={() => router.push("/dashboard")} className="w-12 text-left text-sm text-slate-600">
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
              iniciaisAvatar
            )}
          </button>
        </div>
      </header>

      <div className="mx-auto flex w-full max-w-md flex-col gap-6 px-4">
        {carregandoDados ? (
          <div className="rounded-[18px] bg-slate-100 px-4 py-12 text-center text-slate-500">
            Carregando aula...
          </div>
        ) : (
          <section className="space-y-5">
            <h1 className="text-[2rem] font-semibold leading-none text-[#1c6a91]">{tituloAula}</h1>

            {dicaModulo ? <p className="text-xs text-[#d8d8d8]">{dicaModulo}</p> : null}

            {mensagem ? (
              <p className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                {mensagem}
              </p>
            ) : null}

            {videoUrl ? (
              <YouTubePlayer
                url={videoUrl}
                title={tituloAula}
                className="overflow-hidden rounded-[4px] bg-black"
                onEnded={() => {
                  if (!concluida) {
                    void handleMarcarConcluida(true);
                  }
                }}
              />
            ) : null}

            <button
              type="button"
              onClick={() => handleMarcarConcluida(!concluida)}
              disabled={salvandoConclusao}
              className={`flex items-center gap-2 text-base font-medium ${
                concluida ? "text-[#11a6db]" : "text-[#c8c8c8]"
              }`}
            >
              <span>Marcar aula como Concluida</span>
              <CheckCircle2 className="h-5 w-5" strokeWidth={2.4} />
            </button>

            {duracaoTexto ? (
              <div className="flex items-center gap-1 text-xs text-slate-400">
                <Clock3 className="h-3 w-3" />
                <span>{duracaoTexto}</span>
              </div>
            ) : null}

            <div className="bg-[#555555] px-5 py-4 text-white">
              <div className="flex items-center justify-between gap-3">
                <span className="text-base font-medium">Materiais Complementares</span>
                <button type="button" onClick={() => setMateriaisAbertos((estadoAtual) => !estadoAtual)}>
                  <ChevronDown className={`h-4 w-4 transition-transform ${materiaisAbertos ? "rotate-180" : ""}`} />
                </button>
              </div>

              {materiaisAbertos ? (
                <div className="mt-5 space-y-3">
                  {materiais.length === 0 ? (
                    <p className="text-sm text-white/75">Nenhum material complementar nesta aula.</p>
                  ) : (
                    materiais.map((material) => (
                      <a
                        key={material.id}
                        href={material.arquivo_url}
                        target="_blank"
                        rel="noreferrer"
                        className="block text-sm underline underline-offset-4"
                      >
                        {material.titulo}
                      </a>
                    ))
                  )}
                </div>
              ) : null}
            </div>

            <div className="space-y-3">
              <h2 className="text-[1.3rem] font-medium text-slate-900">Envie sua Dúvida</h2>
              <textarea
                value={duvida}
                onChange={(event) => setDuvida(event.target.value)}
                placeholder="Digite sua dúvida sobre esta aula"
                className="min-h-[120px] w-full rounded-[10px] border border-slate-200 bg-slate-50 px-4 py-3 text-sm outline-none"
              />
              <button
                type="button"
                onClick={() => setMensagem("O envio de duvidas sera liberado em breve.")}
                className="ml-auto flex items-center gap-2 rounded-[8px] bg-[#0e5d77] px-5 py-3 text-sm font-medium text-white"
              >
                Enviar
                <Send className="h-4 w-4" />
              </button>
            </div>
          </section>
        )}
      </div>

      <nav className="fixed inset-x-0 bottom-0 z-30 border-t border-slate-200 bg-white px-3 py-3">
        <div className="mx-auto flex max-w-md items-center justify-between">
          <button onClick={() => router.push("/dashboard")} className="flex flex-col items-center gap-1 text-black">
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

          <button onClick={() => router.push("/conta")} className="flex flex-col items-center gap-1 text-slate-400">
            <CircleUserRound className="h-7 w-7 stroke-[1.8]" />
            <span className="text-[10px] font-medium">Conta</span>
          </button>
        </div>
      </nav>
    </main>
  );
}
