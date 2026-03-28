"use client";

import Image from "next/image";
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, Bell } from "lucide-react";
import AppLoader from "@/components/AppLoader";
import { useAuth } from "@/contexts/AuthContext";
import {
  getRotuloDaAcao,
  getRotaDaNotificacao,
  listarNotificacoesDoUsuario,
  marcarNotificacoesComoVisualizadas,
  type Notificacao,
} from "@/lib/notificacoes";
import { getServiceUnavailableMessage, RequestTimeoutError, withTimeout } from "@/lib/network";
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

function formatarDataHora(valor: string) {
  return new Date(valor).toLocaleString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default function NotificacoesPage() {
  const { user, profile, profileError, loading } = useAuth();
  const router = useRouter();
  const [loadingPage, setLoadingPage] = useState(true);
  const [mensagem, setMensagem] = useState("");
  const [notificacoes, setNotificacoes] = useState<Notificacao[]>([]);

  const iniciaisAvatar = useMemo(() => getIniciais(profile), [profile]);

  useEffect(() => {
    async function carregarTela() {
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
        setMensagem("Nao conseguimos liberar suas notificacoes agora.");
        setLoadingPage(false);
        return;
      }

      try {
        const { notificacoes: notificacoesData, error } = await withTimeout(listarNotificacoesDoUsuario(user.id));

        if (error) {
          setMensagem("Nao conseguimos carregar suas notificacoes agora.");
          setLoadingPage(false);
          return;
        }

        setNotificacoes(notificacoesData);
        await marcarNotificacoesComoVisualizadas(user.id);
      } catch (error) {
        setMensagem(
          error instanceof RequestTimeoutError
            ? getServiceUnavailableMessage()
            : "Nao conseguimos carregar suas notificacoes agora.",
        );
      } finally {
        setLoadingPage(false);
      }
    }

    void carregarTela();
  }, [loading, profile, profileError, router, user]);

  if (loading || loadingPage) {
    return <AppLoader />;
  }

  return (
    <main className="min-h-screen bg-white pb-16 pt-10">
      <header className="mx-auto flex max-w-md items-center justify-between px-6">
        <button
          type="button"
          onClick={() => router.back()}
          className="flex h-11 w-11 items-center justify-center rounded-full bg-slate-100 text-slate-700"
        >
          <ArrowLeft className="h-5 w-5" />
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
      </header>

      <section className="mx-auto flex max-w-md flex-col gap-6 px-5 pt-10">
        <h1 className="text-[2rem] font-semibold leading-none text-[#1c6a91]">Notificacoes</h1>

        {mensagem ? (
          <p className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{mensagem}</p>
        ) : null}

        {notificacoes.length === 0 ? (
          <div className="rounded-[22px] bg-slate-50 px-5 py-10 text-center">
            <Bell className="mx-auto mb-3 h-8 w-8 text-slate-300" />
            <p className="text-sm text-slate-500">Voce ainda nao recebeu notificacoes.</p>
          </div>
        ) : (
          <div className="space-y-4">
            {notificacoes.map((notificacao) => {
              const rota = getRotaDaNotificacao(notificacao);

              return (
                <article key={notificacao.id} className="rounded-[22px] bg-white p-5 shadow-[0_8px_28px_rgba(15,23,42,0.08)]">
                  <div className="space-y-2">
                    <h2 className="text-base font-semibold text-slate-900">{notificacao.titulo}</h2>
                    <p className="text-sm leading-6 text-slate-600">{notificacao.mensagem}</p>
                    <p className="text-xs font-medium text-slate-400">{formatarDataHora(notificacao.criado_em)}</p>
                  </div>

                  {rota ? (
                    <button
                      type="button"
                      onClick={() => router.push(rota)}
                      className="mt-4 rounded-[12px] bg-[#0e5d77] px-4 py-3 text-sm font-medium text-white"
                    >
                      {getRotuloDaAcao(notificacao)}
                    </button>
                  ) : null}
                </article>
              );
            })}
          </div>
        )}
      </section>
    </main>
  );
}
