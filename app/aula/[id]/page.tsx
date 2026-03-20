"use client";

import { ChangeEvent, useEffect, useMemo, useRef, useState } from "react";
import Image from "next/image";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import {
  CalendarDays,
  ChartPie,
  ChevronDown,
  CirclePlus,
  CircleUserRound,
  ExternalLink,
  FileText,
  House,
  Link as LinkIcon,
  Lock,
  Pencil,
  PlaySquare,
  Trash2,
} from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { YouTubePlayer } from "@/components/YouTubePlayer";
import {
  alternarBloqueioAula,
  AulaModulo,
  criarAula,
  excluirAula,
  getAulaById,
  listarMateriaisDaAula,
  MaterialAula,
  substituirMateriaisDaAula,
  atualizarAula,
  uploadMaterialAula,
} from "@/lib/aulas";
import { getModuloComTurma, ModuloTurma } from "@/lib/modulos";
import { TurmaAdmin } from "@/lib/turmas";
import { getServiceUnavailableMessage, RequestTimeoutError, withTimeout } from "@/lib/network";
import { isValidUserRole, UsuarioProfile } from "@/lib/usuarios";

type TipoAula = "gravada" | "presencial";
type MaterialRascunho = {
  id: string;
  titulo: string;
  arquivo_url: string;
  tipo: "arquivo" | "link";
};

function extrairYouTubeEmbedUrl(url: string) {
  try {
    const parsedUrl = new URL(url);

    if (parsedUrl.hostname.includes("youtu.be")) {
      const videoId = parsedUrl.pathname.replace("/", "").trim();
      return videoId ? `https://www.youtube.com/embed/${videoId}` : null;
    }

    if (parsedUrl.hostname.includes("youtube.com")) {
      const videoId = parsedUrl.searchParams.get("v");
      if (videoId) {
        return `https://www.youtube.com/embed/${videoId}`;
      }

      const shortsMatch = parsedUrl.pathname.match(/\/shorts\/([^/?]+)/);
      if (shortsMatch?.[1]) {
        return `https://www.youtube.com/embed/${shortsMatch[1]}`;
      }

      const embedMatch = parsedUrl.pathname.match(/\/embed\/([^/?]+)/);
      if (embedMatch?.[1]) {
        return `https://www.youtube.com/embed/${embedMatch[1]}`;
      }
    }
  } catch {
    return null;
  }

  return null;
}

function formatarDuracaoLivre(valor: string) {
  const numeros = valor.replace(/\D/g, "").slice(0, 4);

  if (numeros.length <= 2) {
    return numeros;
  }

  return `${numeros.slice(0, 2)}:${numeros.slice(2)}`;
}

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

export default function NovaAulaPage() {
  const { user, profile, profileError, loading } = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();
  const params = useParams<{ id: string }>();
  const moduloId = Array.isArray(params?.id) ? params.id[0] : params?.id;
  const aulaId = searchParams.get("aula");
  const modoEdicao = Boolean(aulaId);
  const [loadingPage, setLoadingPage] = useState(true);
  const [carregandoDados, setCarregandoDados] = useState(true);
  const [mensagem, setMensagem] = useState("");
  const [modulo, setModulo] = useState<ModuloTurma | null>(null);
  const [turma, setTurma] = useState<TurmaAdmin | null>(null);
  const [tituloAula, setTituloAula] = useState("");
  const [tipoAula, setTipoAula] = useState<TipoAula>("gravada");
  const [publicandoAula, setPublicandoAula] = useState(false);
  const [videoUrl, setVideoUrl] = useState("");
  const [materiaisAbertos, setMateriaisAbertos] = useState(true);
  const [materiais, setMateriais] = useState<MaterialRascunho[]>([]);
  const [duracaoTexto, setDuracaoTexto] = useState("");
  const [linkMaterial, setLinkMaterial] = useState("");
  const [tituloMaterial, setTituloMaterial] = useState("");
  const [enviandoMaterial, setEnviandoMaterial] = useState(false);
  const [confirmarExclusao, setConfirmarExclusao] = useState(false);
  const [excluindoAula, setExcluindoAula] = useState(false);
  const [aulaAtual, setAulaAtual] = useState<AulaModulo | null>(null);
  const [salvandoDisponibilidade, setSalvandoDisponibilidade] = useState(false);
  const [statusPlayer, setStatusPlayer] = useState<"idle" | "playing" | "paused" | "ended">("idle");
  const [progressoPlayer, setProgressoPlayer] = useState<{ currentTime: number; duration: number } | null>(null);
  const inputMaterialRef = useRef<HTMLInputElement | null>(null);

  const iniciaisAvatar = useMemo(() => getIniciais(profile), [profile]);
  const videoEmbedUrl = useMemo(() => extrairYouTubeEmbedUrl(videoUrl), [videoUrl]);
  const tituloTela = tituloAula.trim() || "Adicionar Novo Conteudo";

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
    if (loadingPage || !moduloId) return;

    async function carregarTela() {
      setCarregandoDados(true);
      setMensagem("");

      try {
        const [{ modulo: moduloComTurma, error: moduloError }, aulaPayload] = await Promise.all([
          withTimeout(getModuloComTurma(moduloId)),
          aulaId
            ? Promise.all([withTimeout(getAulaById(aulaId)), withTimeout(listarMateriaisDaAula(aulaId))])
            : Promise.resolve(null),
        ]);

        if (moduloError || !moduloComTurma) {
          setMensagem("Nao conseguimos carregar este modulo agora. Tente novamente.");
          setCarregandoDados(false);
          return;
        }

        if (!moduloComTurma.turmas) {
          setMensagem("Nao conseguimos carregar a turma deste modulo agora.");
          setCarregandoDados(false);
          return;
        }

        if (aulaPayload) {
          const [{ aula, error: aulaError }, { materiais: materiaisExistentes, error: materiaisError }] = aulaPayload;

          if (aulaError || !aula) {
            setMensagem("Nao conseguimos carregar esta aula agora.");
            setCarregandoDados(false);
            return;
          }

          if (materiaisError) {
            setMensagem("Nao conseguimos carregar os materiais desta aula agora.");
            setCarregandoDados(false);
            return;
          }

          setTituloAula(aula.titulo);
          setDuracaoTexto(aula.duracao_texto ?? "");
          setVideoUrl(aula.video_url ?? "");
          setAulaAtual(aula);
          setMateriais(
            materiaisExistentes.map((material: MaterialAula) => ({
              id: material.id,
              titulo: material.titulo,
              arquivo_url: material.arquivo_url,
              tipo:
                material.arquivo_url.startsWith("http") && !material.arquivo_url.endsWith(".pdf")
                  ? "link"
                  : "arquivo",
            })),
          );
        }

        setModulo({
          id: moduloComTurma.id,
          turma_id: moduloComTurma.turma_id,
          titulo: moduloComTurma.titulo,
          ordem: moduloComTurma.ordem,
          created_at: moduloComTurma.created_at,
        });
        setTurma(moduloComTurma.turmas as TurmaAdmin);
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
  }, [aulaId, loadingPage, moduloId]);

  async function handleSelecionarMaterial(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];

    if (!file) return;

    if (file.type !== "application/pdf") {
      setMensagem("Selecione um arquivo PDF valido.");
      event.target.value = "";
      return;
    }

    setEnviandoMaterial(true);
    setMensagem("");

    const { arquivoUrl, error } = await uploadMaterialAula(file);

    if (error || !arquivoUrl) {
      setMensagem("Nao foi possivel enviar o PDF agora. Tente novamente.");
      setEnviandoMaterial(false);
      event.target.value = "";
      return;
    }

    setMateriais((estadoAtual) => [
      ...estadoAtual,
      {
        id: crypto.randomUUID(),
        titulo: file.name.replace(/\.pdf$/i, ""),
        arquivo_url: arquivoUrl,
        tipo: "arquivo",
      },
    ]);
    setEnviandoMaterial(false);
    event.target.value = "";
  }

  function handleAdicionarLinkMaterial() {
    if (!linkMaterial.trim()) {
      setMensagem("Cole um link para adicionar aos materiais.");
      return;
    }

    try {
      new URL(linkMaterial);
    } catch {
      setMensagem("Digite um link valido para o material.");
      return;
    }

    setMateriais((estadoAtual) => [
      ...estadoAtual,
      {
        id: crypto.randomUUID(),
        titulo: tituloMaterial.trim() || "Link complementar",
        arquivo_url: linkMaterial.trim(),
        tipo: "link",
      },
    ]);
    setTituloMaterial("");
    setLinkMaterial("");
    setMensagem("");
  }

  function removerMaterial(id: string) {
    setMateriais((estadoAtual) => estadoAtual.filter((material) => material.id !== id));
  }

  async function handlePublicarAula() {
    if (!moduloId) return;

    if (!tituloAula.trim()) {
      setMensagem("Digite o titulo da aula para continuar.");
      return;
    }

    if (!videoUrl.trim()) {
      setMensagem("Cole a URL do video do YouTube para continuar.");
      return;
    }

    if (!videoEmbedUrl) {
      setMensagem("Use um link valido do YouTube para carregar o video dentro da plataforma.");
      return;
    }

    setPublicandoAula(true);
    setMensagem("");
    const duracaoFinal = duracaoTexto.trim() || null;

    const { aula, error } = modoEdicao && aulaId
      ? await atualizarAula(aulaId, {
          titulo: tituloAula,
          video_url: videoUrl.trim(),
          duracao_texto: duracaoFinal,
        })
      : await criarAula(moduloId, tituloAula, videoUrl.trim(), duracaoFinal);

    if (error || !aula) {
      setMensagem("Nao foi possivel publicar a aula agora. Tente novamente.");
      setPublicandoAula(false);
      return;
    }

    setAulaAtual(aula);

    const { error: materiaisError } = await (modoEdicao && aulaId
      ? substituirMateriaisDaAula(
          aulaId,
          materiais.map((material) => ({
            titulo: material.titulo,
            arquivo_url: material.arquivo_url,
          })),
        )
      : substituirMateriaisDaAula(
          aula.id,
          materiais.map((material) => ({
            titulo: material.titulo,
            arquivo_url: material.arquivo_url,
          })),
        ));

    if (materiaisError) {
      setMensagem("A aula foi criada, mas os materiais nao puderam ser salvos.");
      setPublicandoAula(false);
      return;
    }

    if (modulo?.turma_id) {
      router.push(`/turma/${modulo.turma_id}?modulo=${moduloId}`);
      return;
    }

    setPublicandoAula(false);
  }

  async function handleDefinirBloqueio(bloqueado: boolean) {
    if (!aulaId) return;
    if (aulaAtual?.bloqueado === bloqueado) return;

    setSalvandoDisponibilidade(true);
    setMensagem("");

    const { aula, error } = await alternarBloqueioAula(aulaId, bloqueado);

    if (error || !aula) {
      setMensagem("Nao foi possivel atualizar a disponibilidade da aula agora.");
      setSalvandoDisponibilidade(false);
      return;
    }

    setAulaAtual(aula);
    setSalvandoDisponibilidade(false);
  }

  async function handleExcluirAula() {
    if (!aulaId || !modulo?.turma_id) return;

    setExcluindoAula(true);
    setMensagem("");

    const { error } = await excluirAula(aulaId);

    if (error) {
      setMensagem("Nao foi possivel excluir a aula agora. Tente novamente.");
      setExcluindoAula(false);
      setConfirmarExclusao(false);
      return;
    }

    router.push(`/turma/${modulo.turma_id}?modulo=${moduloId}`);
  }

  if (loading || loadingPage) {
    return <div>Carregando acesso...</div>;
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
            {iniciaisAvatar}
          </button>
        </div>
      </header>

      <div className="mx-auto flex w-full max-w-md flex-col gap-6 px-4">
        <section className="space-y-5">
          <h1 className="text-[2rem] font-semibold leading-none text-[#1c6a91]">{tituloTela}</h1>

          {mensagem ? (
            <p className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
              {mensagem}
            </p>
          ) : null}

          {carregandoDados ? (
            <div className="rounded-[18px] bg-slate-100 px-4 py-12 text-center text-slate-500">
              Carregando modulo...
            </div>
          ) : null}

          {!carregandoDados && modulo && turma ? (
            <div className="space-y-6">
              <label className="block space-y-2">
                <span className="text-sm font-medium text-slate-700">Titulo da Aula</span>
                <div className="flex items-center rounded-[10px] border border-slate-200 px-4 py-3">
                  <input
                    value={tituloAula}
                    onChange={(event) => setTituloAula(event.target.value)}
                    placeholder="Apresentacao"
                    className="w-full outline-none"
                  />
                  <Pencil className="h-4 w-4 text-black" />
                </div>
              </label>

              <div className="space-y-2">
                <span className="text-sm font-medium text-slate-700">Video</span>
                <div className="space-y-3 rounded-[10px] bg-[#d9d9d9] px-5 py-4">
                  <div className="flex items-center gap-3 text-sm font-medium text-slate-800">
                    <LinkIcon className="h-4 w-4 stroke-[2]" />
                    URL do video do YouTube
                  </div>

                  <input
                    value={videoUrl}
                    onChange={(event) => setVideoUrl(event.target.value)}
                    placeholder="Cole aqui a URL do video nao listado"
                    className="w-full rounded-[8px] border border-slate-200 bg-white px-4 py-3 text-sm outline-none"
                  />

                  <p className="text-xs text-slate-600">
                    Use um link do YouTube para que o video fique carregado dentro da plataforma.
                  </p>
                </div>

                {videoEmbedUrl ? (
                  <>
                    <YouTubePlayer
                      url={videoUrl}
                      title="Preview do video da aula"
                      className="overflow-hidden rounded-[10px] bg-black"
                      onPlay={(payload) => {
                        setStatusPlayer("playing");
                        setProgressoPlayer(payload);
                      }}
                      onPause={(payload) => {
                        setStatusPlayer("paused");
                        setProgressoPlayer(payload);
                      }}
                      onEnded={(payload) => {
                        setStatusPlayer("ended");
                        setProgressoPlayer(payload);
                      }}
                      onProgress={(payload) => {
                        setProgressoPlayer(payload);
                      }}
                    />

                    {modoEdicao ? (
                      <div className="flex items-center justify-end gap-5 pt-1">
                        <button
                          type="button"
                          onClick={() => handleDefinirBloqueio(false)}
                          disabled={salvandoDisponibilidade}
                          className={aulaAtual?.bloqueado ? "text-[#c7c7c7]" : "text-[#11a6db]"}
                          aria-label="Liberar aula para os alunos"
                        >
                          <PlaySquare className="h-5 w-5" strokeWidth={2.2} />
                        </button>

                        <button
                          type="button"
                          onClick={() => handleDefinirBloqueio(true)}
                          disabled={salvandoDisponibilidade}
                          className={aulaAtual?.bloqueado ? "text-[#11a6db]" : "text-[#c7c7c7]"}
                          aria-label="Bloquear aula para os alunos"
                        >
                          <Lock className="h-5 w-5" strokeWidth={2.2} />
                        </button>
                      </div>
                    ) : null}
                  </>
                ) : null}

                {videoUrl && !videoEmbedUrl ? (
                  <a
                    href={videoUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-2 text-sm text-[#0e5d77]"
                  >
                    <ExternalLink className="h-4 w-4" />
                    Abrir link informado
                  </a>
                ) : null}
              </div>

              <label className="block space-y-2">
                <span className="text-sm font-medium text-slate-700">Duracao do Video</span>
                <input
                  value={duracaoTexto}
                  onChange={(event) => setDuracaoTexto(formatarDuracaoLivre(event.target.value))}
                  placeholder="Ex.: 07:53"
                  maxLength={5}
                  className="w-full rounded-[10px] border border-slate-200 px-4 py-3 outline-none"
                />
              </label>

              <div className="space-y-2">
                <span className="text-sm font-medium text-slate-700">Tipo</span>
                <div className="flex items-center gap-6">
                  <label className="flex items-center gap-2 text-xs text-slate-700">
                    <input
                      type="radio"
                      name="tipo-aula"
                      checked={tipoAula === "gravada"}
                      onChange={() => setTipoAula("gravada")}
                    />
                    Gravada
                  </label>

                  <label className="flex items-center gap-2 text-xs text-slate-700">
                    <input
                      type="radio"
                      name="tipo-aula"
                      checked={tipoAula === "presencial"}
                      onChange={() => setTipoAula("presencial")}
                    />
                    Presencial
                  </label>
                </div>
              </div>

              <div className="bg-[#555555] px-5 py-4 text-white">
                <div className="flex items-center justify-between gap-3">
                  <span className="text-base font-medium">Materiais Complementares</span>
                  <button type="button" onClick={() => setMateriaisAbertos((estadoAtual) => !estadoAtual)}>
                    <ChevronDown className={`h-4 w-4 transition-transform ${materiaisAbertos ? "rotate-180" : ""}`} />
                  </button>
                </div>

                {materiaisAbertos ? (
                  <div className="mt-5 space-y-4">
                    {materiais.length > 0 ? (
                      <div className="space-y-2">
                        {materiais.map((material) => (
                          <div key={material.id} className="flex items-center justify-between gap-3 text-sm">
                            <div className="flex items-center gap-2">
                              {material.tipo === "arquivo" ? (
                                <FileText className="h-4 w-4" />
                              ) : (
                                <LinkIcon className="h-4 w-4" />
                              )}
                              <span>{material.titulo}</span>
                            </div>

                            <button type="button" onClick={() => removerMaterial(material.id)} className="text-xs">
                              Remover
                            </button>
                          </div>
                        ))}
                      </div>
                    ) : null}

                    <input
                      ref={inputMaterialRef}
                      type="file"
                      accept="application/pdf"
                      className="hidden"
                      onChange={handleSelecionarMaterial}
                    />

                    <button
                      type="button"
                      onClick={() => inputMaterialRef.current?.click()}
                      className="flex items-center gap-2 text-sm"
                    >
                      <CirclePlus className="h-4 w-4 stroke-[2]" />
                      {enviandoMaterial ? "Enviando PDF..." : "Adicionar PDF"}
                    </button>

                    <div className="space-y-3 rounded-[8px] border border-white/20 p-3">
                      <input
                        value={tituloMaterial}
                        onChange={(event) => setTituloMaterial(event.target.value)}
                        placeholder="Titulo do link (opcional)"
                        className="w-full rounded-[6px] border border-white/20 bg-white/10 px-3 py-2 text-sm text-white placeholder:text-white/70 outline-none"
                      />

                      <input
                        value={linkMaterial}
                        onChange={(event) => setLinkMaterial(event.target.value)}
                        placeholder="Cole um link aqui"
                        className="w-full rounded-[6px] border border-white/20 bg-white/10 px-3 py-2 text-sm text-white placeholder:text-white/70 outline-none"
                      />

                      <button
                        type="button"
                        onClick={handleAdicionarLinkMaterial}
                        className="flex items-center gap-2 text-sm"
                      >
                        <CirclePlus className="h-4 w-4 stroke-[2]" />
                        Adicionar Link
                      </button>
                    </div>
                  </div>
                ) : null}
              </div>

              <button
                onClick={handlePublicarAula}
                disabled={publicandoAula || enviandoMaterial}
                className="mx-auto block rounded-[8px] bg-[#0e5d77] px-12 py-3 text-sm font-medium text-white disabled:opacity-60"
              >
                {publicandoAula ? "Salvando aula..." : modoEdicao ? "Salvar Aula" : "Publicar Aula"}
              </button>

              {modoEdicao ? (
                <button
                  type="button"
                  onClick={() => setConfirmarExclusao(true)}
                  className="mx-auto flex items-center gap-2 text-sm font-medium text-[#b42318]"
                >
                  <Trash2 className="h-4 w-4" />
                  Excluir Aula
                </button>
              ) : null}

              <p className="text-xs text-[#d8d8d8]">
                Modulo: {modulo.titulo} | Turma: {turma.nome} | Tipo selecionado: {tipoAula}
              </p>

              {duracaoTexto ? <p className="text-xs text-[#d8d8d8]">Duracao detectada: {duracaoTexto}</p> : null}

              {progressoPlayer ? (
                <p className="text-xs text-[#d8d8d8]">
                  Player: {statusPlayer} | Tempo atual: {Math.floor(progressoPlayer.currentTime)}s | Duracao do player:{" "}
                  {Math.floor(progressoPlayer.duration)}s
                </p>
              ) : null}
            </div>
          ) : null}
        </section>
      </div>

      <nav className="fixed inset-x-0 bottom-0 z-30 border-t border-slate-200 bg-white px-3 py-3">
        <div className="mx-auto flex max-w-md items-center justify-between">
          <button
            onClick={() => router.push(modulo?.turma_id ? `/turma/${modulo.turma_id}` : "/admin")}
            className="flex flex-col items-center gap-1 text-black"
          >
            <House className="h-7 w-7 fill-current stroke-[1.8]" />
            <span className="text-[10px] font-medium">Inicio</span>
          </button>

          <button className="flex flex-col items-center gap-1 text-slate-400">
            <CalendarDays className="h-7 w-7 stroke-[1.8]" />
            <span className="text-[10px] font-medium">Agenda</span>
          </button>

          <button
            onClick={() => router.push(modulo?.turma_id ? `/admin/progresso?turma=${modulo.turma_id}` : "/admin/progresso")}
            className="flex flex-col items-center gap-1 text-slate-400"
          >
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

      {confirmarExclusao ? (
        <div className="fixed inset-0 z-[60] bg-slate-950/45 px-4 py-6 sm:flex sm:items-center sm:justify-center">
          <div className="mx-auto w-full max-w-sm rounded-[22px] bg-white px-5 py-5 shadow-2xl">
            <div className="space-y-3">
              <h2 className="text-lg font-semibold text-slate-900">Excluir aula</h2>
              <p className="text-sm leading-6 text-slate-600">
                Esta exclusao e permanente. A aula sera removida definitivamente. Deseja continuar?
              </p>

              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setConfirmarExclusao(false)}
                  disabled={excluindoAula}
                  className="flex-1 rounded-[10px] border border-slate-200 px-4 py-3 text-sm font-medium text-slate-700"
                >
                  Cancelar
                </button>

                <button
                  type="button"
                  onClick={handleExcluirAula}
                  disabled={excluindoAula}
                  className="flex-1 rounded-[10px] bg-[#b42318] px-4 py-3 text-sm font-medium text-white disabled:opacity-60"
                >
                  {excluindoAula ? "Excluindo..." : "Confirmar"}
                </button>
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </main>
  );
}
