"use client";

import Image from "next/image";
import { Suspense, useCallback, useEffect, useMemo, useState } from "react";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { MessageSquarePlus, Send, Trash2 } from "lucide-react";
import AppLoader from "@/components/AppLoader";
import { useAuth } from "@/contexts/AuthContext";
import {
  ComentarioAula,
  criarComentarioDaAula,
  excluirComentarioDaAula,
  listarComentariosDaAula,
} from "@/lib/comentarios";
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

  return (profile?.email?.slice(0, 2) || "US").toUpperCase();
}

function formatarComentarioData(data: string) {
  return new Date(data).toLocaleString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function ComentariosAulaAdminPageContent() {
  const { user, profile, profileError, loading } = useAuth();
  const router = useRouter();
  const params = useParams<{ id: string }>();
  const searchParams = useSearchParams();
  const aulaId = Array.isArray(params?.id) ? params.id[0] : params?.id;
  const moduloId = searchParams.get("modulo");
  const [loadingPage, setLoadingPage] = useState(true);
  const [carregandoDados, setCarregandoDados] = useState(true);
  const [mensagem, setMensagem] = useState("");
  const [tituloAula, setTituloAula] = useState("");
  const [comentarios, setComentarios] = useState<ComentarioAula[]>([]);
  const [respostas, setRespostas] = useState<Record<string, string>>({});
  const [salvandoResposta, setSalvandoResposta] = useState<string | null>(null);
  const [excluindoComentario, setExcluindoComentario] = useState<string | null>(null);

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

  const carregarComentarios = useCallback(async () => {
    if (!aulaId) return;

    setCarregandoDados(true);
    setMensagem("");

    try {
      const [{ aula, error: aulaError }, { comentarios: comentariosData, error: comentariosError }] = await Promise.all([
        withTimeout(getAulaComModuloTurma(aulaId)),
        withTimeout(listarComentariosDaAula(aulaId)),
      ]);

      if (aulaError || !aula) {
        setMensagem("Nao conseguimos carregar esta aula agora.");
        setCarregandoDados(false);
        return;
      }

      if (comentariosError) {
        setMensagem("Nao conseguimos carregar os comentarios agora.");
        setCarregandoDados(false);
        return;
      }

      setTituloAula(aula.titulo);
      setComentarios(comentariosData);
    } catch (error) {
      setMensagem(
        error instanceof RequestTimeoutError
          ? getServiceUnavailableMessage()
          : "Nao conseguimos carregar os comentarios agora. Tente novamente.",
      );
    } finally {
      setCarregandoDados(false);
    }
  }, [aulaId]);

  useEffect(() => {
    if (loadingPage || !aulaId) return;
    void carregarComentarios();
  }, [aulaId, carregarComentarios, loadingPage]);

  async function handleResponder(comentarioPaiId: string) {
    if (!user || !aulaId) return;

    const texto = respostas[comentarioPaiId]?.trim();

    if (!texto) {
      setMensagem("Escreva uma resposta para continuar.");
      return;
    }

    setSalvandoResposta(comentarioPaiId);
    setMensagem("");

    const { error } = await criarComentarioDaAula(aulaId, user.id, texto, comentarioPaiId);

    if (error) {
      setMensagem("Nao foi possivel responder o comentario agora.");
      setSalvandoResposta(null);
      return;
    }

    setRespostas((estadoAtual) => ({
      ...estadoAtual,
      [comentarioPaiId]: "",
    }));
    setSalvandoResposta(null);
    await carregarComentarios();
  }

  async function handleExcluir(comentarioId: string) {
    setExcluindoComentario(comentarioId);
    setMensagem("");

    const { error } = await excluirComentarioDaAula(comentarioId);

    if (error) {
      setMensagem("Nao foi possivel excluir o comentario agora.");
      setExcluindoComentario(null);
      return;
    }

    setExcluindoComentario(null);
    await carregarComentarios();
  }

  if (loading || loadingPage) {
    return <AppLoader />;
  }

  return (
    <main className="min-h-screen bg-white pb-20 pt-10">
      <header className="mx-auto flex max-w-md items-center justify-between px-5">
        <button
          type="button"
          onClick={() => {
            if (moduloId) {
              router.push(`/aula/${moduloId}?aula=${aulaId}`);
              return;
            }

            router.back();
          }}
          className="text-sm text-slate-600"
        >
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
            iniciaisAdmin
          )}
        </button>
      </header>

      <section className="mx-auto flex max-w-md flex-col gap-5 px-5 pt-10">
        <div className="space-y-2">
          <h1 className="text-[2rem] font-semibold leading-none text-[#0f5d78]">Comentarios</h1>
          {tituloAula ? <p className="text-sm text-slate-400">{tituloAula}</p> : null}
        </div>

        {mensagem ? (
          <p className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{mensagem}</p>
        ) : null}

        {carregandoDados ? (
          <AppLoader fullScreen={false} />
        ) : comentarios.length === 0 ? (
          <div className="rounded-[20px] border border-slate-200 bg-slate-50 px-5 py-6 text-sm text-slate-500">
            Nenhum comentario nesta aula ainda.
          </div>
        ) : (
          <div className="space-y-4">
            {comentarios.map((item) => (
              <div key={item.id} className="space-y-4 rounded-[22px] border border-slate-200 bg-white px-4 py-4 shadow-[0_18px_45px_rgba(15,93,120,0.07)]">
                <div className="flex items-start gap-3">
                  <div className="flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-full bg-slate-200 text-xs font-semibold text-slate-700">
                    {item.autor?.foto_url ? (
                      <Image
                        src={item.autor.foto_url}
                        alt={item.autor.nome || item.autor.email}
                        width={48}
                        height={48}
                        className="h-full w-full object-cover"
                        unoptimized
                      />
                    ) : (
                      getIniciais(item.autor)
                    )}
                  </div>

                  <div className="min-w-0 flex-1 space-y-1">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <p className="text-sm font-semibold text-slate-900">{item.autor?.nome?.trim() || item.autor?.email || "Usuario"}</p>
                      <p className="text-xs text-slate-400">{formatarComentarioData(item.criado_em)}</p>
                    </div>
                    <p className="text-sm leading-6 text-slate-700">{item.comentario}</p>
                  </div>
                </div>

                {item.respostas.length > 0 ? (
                  <div className="space-y-3 border-l-2 border-slate-100 pl-4">
                    {item.respostas.map((resposta) => (
                      <div key={resposta.id} className="flex items-start gap-3">
                        <div className="flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-full bg-slate-200 text-[11px] font-semibold text-slate-700">
                          {resposta.autor?.foto_url ? (
                            <Image
                              src={resposta.autor.foto_url}
                              alt={resposta.autor.nome || resposta.autor.email}
                              width={40}
                              height={40}
                              className="h-full w-full object-cover"
                              unoptimized
                            />
                          ) : (
                            getIniciais(resposta.autor)
                          )}
                        </div>

                        <div className="min-w-0 flex-1 space-y-1">
                          <div className="flex flex-wrap items-center justify-between gap-2">
                            <p className="text-sm font-semibold text-slate-900">
                              {resposta.autor?.nome?.trim() || resposta.autor?.email || "Administrador"}
                            </p>
                            <p className="text-xs text-slate-400">{formatarComentarioData(resposta.criado_em)}</p>
                          </div>
                          <p className="text-sm leading-6 text-slate-700">{resposta.comentario}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : null}

                <div className="space-y-3 rounded-[16px] bg-slate-50 px-3 py-3">
                  <div className="flex items-center justify-between gap-3">
                    <div className="flex items-center gap-2 text-sm font-medium text-[#0e5d77]">
                      <MessageSquarePlus className="h-4 w-4" />
                      Responder comentario
                    </div>

                    <button
                      type="button"
                      onClick={() => void handleExcluir(item.id)}
                      disabled={excluindoComentario === item.id}
                      className="text-[#b42318] disabled:opacity-60"
                      aria-label="Excluir comentario"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>

                  <textarea
                    value={respostas[item.id] ?? ""}
                    onChange={(event) =>
                      setRespostas((estadoAtual) => ({
                        ...estadoAtual,
                        [item.id]: event.target.value,
                      }))
                    }
                    placeholder="Escreva uma resposta publica"
                    className="min-h-[90px] w-full rounded-[12px] border border-slate-200 bg-white px-4 py-3 text-sm outline-none"
                  />

                  <button
                    type="button"
                    onClick={() => void handleResponder(item.id)}
                    disabled={salvandoResposta === item.id}
                    className="ml-auto flex items-center gap-2 rounded-[10px] bg-[#0e5d77] px-4 py-3 text-sm font-medium text-white disabled:opacity-60"
                  >
                    {salvandoResposta === item.id ? "Respondendo..." : "Responder"}
                    <Send className="h-4 w-4" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>
    </main>
  );
}

export default function ComentariosAulaAdminPage() {
  return (
    <Suspense fallback={<AppLoader />}>
      <ComentariosAulaAdminPageContent />
    </Suspense>
  );
}
