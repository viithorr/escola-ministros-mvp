"use client";

import { useEffect, useRef, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { BellRing, X } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import {
  buscarCampanhaAtivaAluno,
  registrarEventoCampanha,
  type CampanhaAtivaAluno,
} from "@/lib/campanhas-notificacao";

const temaClasses = {
  informacao: { detalhe: "bg-sky-500", icone: "bg-sky-50 text-sky-700", botao: "bg-[#0e5d77]" },
  aviso: { detalhe: "bg-amber-400", icone: "bg-amber-50 text-amber-700", botao: "bg-[#0e5d77]" },
  urgente: { detalhe: "bg-red-500", icone: "bg-red-50 text-red-700", botao: "bg-red-600" },
};

export default function NotificationCampaignOverlay() {
  const { user, profile, loading } = useAuth();
  const pathname = usePathname();
  const router = useRouter();
  const [campanha, setCampanha] = useState<CampanhaAtivaAluno | null>(null);
  const [visivel, setVisivel] = useState(false);
  const registradaRef = useRef<string | null>(null);

  useEffect(() => {
    if (loading || !user || profile?.role !== "aluno" || pathname.startsWith("/admin")) return;

    let ativo = true;

    async function carregar() {
      try {
        const { campanha: campanhaAtiva } = await buscarCampanhaAtivaAluno();
        if (!ativo || !campanhaAtiva) return;
        setCampanha(campanhaAtiva);
        setVisivel(true);
      } catch {
        // O aviso nao deve impedir o aluno de usar a plataforma.
      }
    }

    void carregar();
    return () => {
      ativo = false;
    };
  }, [loading, pathname, profile?.role, user]);

  useEffect(() => {
    if (!visivel || !campanha || registradaRef.current === campanha.notificacao_id) return;
    registradaRef.current = campanha.notificacao_id;
    void registrarEventoCampanha(campanha.notificacao_id, "exibir").catch(() => undefined);
  }, [campanha, visivel]);

  if (!campanha || !visivel) return null;

  const classes = temaClasses[campanha.tema];

  function fechar() {
    setVisivel(false);
    void registrarEventoCampanha(campanha!.notificacao_id, "dispensar").catch(() => undefined);
  }

  function abrirAcao() {
    const rota = campanha?.acao_rota;
    fechar();
    if (rota) router.push(rota);
  }

  return (
    <aside className="fixed inset-x-0 top-3 z-[70] px-3 sm:top-5" role="dialog" aria-label={campanha.titulo}>
      <div className="relative mx-auto w-full max-w-md overflow-hidden rounded-[20px] border border-slate-200/80 bg-white shadow-[0_18px_55px_rgba(15,23,42,0.20)]">
        <div className={`absolute inset-y-0 left-0 w-1.5 ${classes.detalhe}`} />
        <div className="flex items-start gap-3 px-4 py-4 pl-5">
          <div className={`mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-full ${classes.icone}`}>
            <BellRing className="h-5 w-5" />
          </div>

          <div className="min-w-0 flex-1 pr-7">
            <h2 className="text-[0.95rem] font-semibold leading-5 text-slate-900">{campanha.titulo}</h2>
            <p className="mt-1 text-[0.82rem] leading-5 text-slate-600">{campanha.mensagem}</p>

            {campanha.acao_rota ? (
              <button
                type="button"
                onClick={abrirAcao}
                className={`mt-3 rounded-xl px-4 py-2.5 text-xs font-semibold text-white shadow-sm ${classes.botao}`}
              >
                {campanha.acao_rotulo || "Abrir"}
              </button>
            ) : null}
          </div>

          <button
            type="button"
            onClick={fechar}
            className="absolute right-3 top-3 flex h-8 w-8 items-center justify-center rounded-full text-slate-400 transition hover:bg-slate-100 hover:text-slate-700"
            aria-label="Fechar aviso"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      </div>
    </aside>
  );
}
