"use client";

import Image from "next/image";
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, BellRing, CalendarClock, Pencil, Plus, Users, X } from "lucide-react";
import AppLoader from "@/components/AppLoader";
import { useAuth } from "@/contexts/AuthContext";
import {
  atualizarCampanhaAdmin,
  criarCampanhaAdmin,
  listarCampanhasAdmin,
  type CampanhaNotificacao,
  type NovaCampanhaPayload,
  type PublicoCampanha,
  type TemaCampanha,
} from "@/lib/campanhas-notificacao";
import { listarTurmas, type TurmaAdmin } from "@/lib/turmas";

function paraInputDataHora(data: Date | string) {
  const valor = typeof data === "string" ? new Date(data) : data;
  const local = new Date(valor.getTime() - valor.getTimezoneOffset() * 60_000);
  return local.toISOString().slice(0, 16);
}
function getValoresIniciais() {
  const inicio = new Date();
  const fim = new Date(inicio.getTime() + 7 * 24 * 60 * 60 * 1000);
  fim.setHours(23, 59, 0, 0);

  return {
    titulo: "",
    mensagem: "",
    tema: "aviso" as TemaCampanha,
    publico: "progresso_incompleto" as PublicoCampanha,
    turmaId: "",
    inicio: paraInputDataHora(inicio),
    fim: paraInputDataHora(fim),
    frequencia: 1,
    sobreTela: true,
    acaoRotulo: "Ver aulas agora",
    acaoRota: "/dashboard",
  };
}

function formatarData(valor: string) {
  return new Date(valor).toLocaleString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function getStatus(campanha: CampanhaNotificacao) {
  if (!campanha.ativa) return { label: "Pausada", classe: "bg-slate-100 text-slate-600" };
  const agora = Date.now();
  if (new Date(campanha.inicio_em).getTime() > agora) return { label: "Agendada", classe: "bg-sky-50 text-sky-700" };
  if (new Date(campanha.fim_em).getTime() < agora) return { label: "Encerrada", classe: "bg-slate-100 text-slate-500" };
  return { label: "Ativa", classe: "bg-emerald-50 text-emerald-700" };
}

export default function AdminNotificacoesPage() {
  const { user, profile, loading } = useAuth();
  const router = useRouter();
  const [carregando, setCarregando] = useState(true);
  const [salvando, setSalvando] = useState(false);
  const [mensagemStatus, setMensagemStatus] = useState("");
  const [campanhas, setCampanhas] = useState<CampanhaNotificacao[]>([]);
  const [turmas, setTurmas] = useState<TurmaAdmin[]>([]);
  const [formAberto, setFormAberto] = useState(false);
  const [editandoId, setEditandoId] = useState<string | null>(null);
  const [form, setForm] = useState(getValoresIniciais);

  const turmaSelecionada = useMemo(
    () => turmas.find((turma) => turma.id === form.turmaId)?.nome ?? "Todas as turmas",
    [form.turmaId, turmas],
  );

  useEffect(() => {
    if (loading) return;
    if (!user) {
      router.push("/login");
      return;
    }
    if (profile?.role !== "admin") {
      router.push("/dashboard");
      return;
    }

    let ativo = true;

    async function carregar() {
      try {
        const [campanhasResponse, turmasResponse] = await Promise.all([listarCampanhasAdmin(), listarTurmas()]);
        if (!ativo) return;
        setCampanhas(campanhasResponse.campanhas);
        setTurmas(turmasResponse.turmas);
        if (turmasResponse.error) setMensagemStatus("As campanhas foram carregadas, mas as turmas estão indisponíveis.");
      } catch (error) {
        if (ativo) setMensagemStatus(error instanceof Error ? error.message : "Não foi possível carregar as campanhas.");
      } finally {
        if (ativo) setCarregando(false);
      }
    }

    void carregar();
    return () => {
      ativo = false;
    };
  }, [loading, profile?.role, router, user]);

  function abrirNovaCampanha() {
    setForm(getValoresIniciais());
    setEditandoId(null);
    setMensagemStatus("");
    setFormAberto(true);
  }

  function editarCampanha(campanha: CampanhaNotificacao) {
    setForm({
      titulo: campanha.titulo,
      mensagem: campanha.mensagem,
      tema: campanha.tema,
      publico: campanha.publico_tipo,
      turmaId: campanha.turma_id ?? "",
      inicio: paraInputDataHora(campanha.inicio_em),
      fim: paraInputDataHora(campanha.fim_em),
      frequencia: campanha.frequencia_dia,
      sobreTela: campanha.exibir_sobre_tela,
      acaoRotulo: campanha.acao_rotulo ?? "",
      acaoRota: campanha.acao_rota ?? "",
    });
    setEditandoId(campanha.id);
    setMensagemStatus("");
    setFormAberto(true);
  }

  async function salvarCampanha() {
    if (!form.titulo.trim() || !form.mensagem.trim()) {
      setMensagemStatus("Preencha o título e a mensagem.");
      return;
    }

    if (form.publico === "turma" && !form.turmaId) {
      setMensagemStatus("Selecione a turma que receberá a notificação.");
      return;
    }

    const inicio = new Date(form.inicio);
    const fim = new Date(form.fim);
    if (!form.inicio || !form.fim || fim <= inicio) {
      setMensagemStatus("A data final deve ser posterior à data inicial.");
      return;
    }

    setSalvando(true);
    setMensagemStatus("");

    const payload: NovaCampanhaPayload = {
      titulo: form.titulo.trim(),
      mensagem: form.mensagem.trim(),
      tema: form.tema,
      publico_tipo: form.publico,
      turma_id: form.turmaId || null,
      inicio_em: inicio.toISOString(),
      fim_em: fim.toISOString(),
      frequencia_dia: form.frequencia,
      exibir_sobre_tela: form.sobreTela,
      acao_rotulo: form.acaoRotulo.trim() || null,
      acao_rota: form.acaoRota.trim() || null,
      ativa: true,
    };

    try {
      if (editandoId) {
        const { campanha } = await atualizarCampanhaAdmin(editandoId, payload);
        setCampanhas((atuais) => atuais.map((item) => (item.id === campanha.id ? campanha : item)));
      } else {
        const { campanha } = await criarCampanhaAdmin(payload);
        setCampanhas((atuais) => [campanha, ...atuais]);
      }
      setFormAberto(false);
      setMensagemStatus(editandoId ? "Campanha atualizada com sucesso." : "Campanha criada com sucesso.");
    } catch (error) {
      setMensagemStatus(error instanceof Error ? error.message : "Não foi possível salvar a campanha.");
    } finally {
      setSalvando(false);
    }
  }

  async function alternarCampanha(campanha: CampanhaNotificacao) {
    try {
      const { campanha: atualizada } = await atualizarCampanhaAdmin(campanha.id, { ativa: !campanha.ativa });
      setCampanhas((atuais) => atuais.map((item) => (item.id === atualizada.id ? atualizada : item)));
    } catch (error) {
      setMensagemStatus(error instanceof Error ? error.message : "Não foi possível alterar a campanha.");
    }
  }

  if (loading || carregando) return <AppLoader />;

  return (
    <main className="min-h-screen bg-[#f7fafc] pb-16 pt-8">
      <header className="mx-auto flex max-w-md items-center justify-between px-5">
        <button onClick={() => router.push("/admin")} className="flex h-11 w-11 items-center justify-center rounded-full bg-white text-slate-700 shadow-sm" aria-label="Voltar">
          <ArrowLeft className="h-5 w-5" />
        </button>
        <Image src="/img/logo.svg" alt="Escola de Ministros" width={147} height={49} className="h-10 w-auto" priority />
        <div className="flex h-11 w-11 items-center justify-center rounded-full bg-[#e9f3f8] text-[#1c6a91]">
          <BellRing className="h-5 w-5" />
        </div>
      </header>

      <section className="mx-auto max-w-md px-4 pt-9">
        <div className="flex items-end justify-between gap-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[#85a2b4]">Comunicação</p>
            <h1 className="mt-1 text-[2rem] font-semibold leading-none text-[#1c6a91]">Notificações</h1>
          </div>
          <button onClick={abrirNovaCampanha} className="flex items-center gap-2 rounded-xl bg-[#0e5d77] px-4 py-3 text-sm font-semibold text-white shadow-sm">
            <Plus className="h-4 w-4" /> Nova
          </button>
        </div>

        <p className="mt-4 text-sm leading-6 text-slate-500">Crie avisos segmentados e controle quando e quantas vezes serão exibidos aos alunos.</p>

        {mensagemStatus ? <p className="mt-4 rounded-2xl border border-sky-100 bg-white px-4 py-3 text-sm text-slate-600 shadow-sm">{mensagemStatus}</p> : null}

        <div className="mt-6 space-y-4">
          {campanhas.length === 0 ? (
            <div className="rounded-[24px] border border-dashed border-slate-200 bg-white px-6 py-10 text-center">
              <BellRing className="mx-auto h-9 w-9 text-slate-300" />
              <p className="mt-3 text-sm text-slate-500">Nenhuma campanha criada ainda.</p>
            </div>
          ) : campanhas.map((campanha) => {
            const status = getStatus(campanha);
            const nomeTurma = campanha.turma_id ? turmas.find((turma) => turma.id === campanha.turma_id)?.nome : null;
            return (
              <article key={campanha.id} className="rounded-[22px] bg-white p-5 shadow-[0_8px_28px_rgba(15,23,42,0.07)]">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <h2 className="font-semibold leading-5 text-slate-900">{campanha.titulo}</h2>
                    <p className="mt-2 line-clamp-2 text-sm leading-5 text-slate-500">{campanha.mensagem}</p>
                  </div>
                  <span className={`shrink-0 rounded-full px-2.5 py-1 text-[10px] font-semibold ${status.classe}`}>{status.label}</span>
                </div>

                <div className="mt-4 grid grid-cols-2 gap-2 text-xs text-slate-500">
                  <div className="flex items-center gap-2 rounded-xl bg-slate-50 px-3 py-2.5"><Users className="h-4 w-4 text-[#7da0b4]" /><span>{campanha.publico_tipo === "progresso_incompleto" ? "Progresso incompleto" : campanha.publico_tipo === "turma" ? nomeTurma || "Turma" : "Todos os alunos"}</span></div>
                  <div className="flex items-center gap-2 rounded-xl bg-slate-50 px-3 py-2.5"><CalendarClock className="h-4 w-4 text-[#7da0b4]" /><span>{campanha.frequencia_dia}x ao dia</span></div>
                </div>
                <p className="mt-3 text-[11px] text-slate-400">{formatarData(campanha.inicio_em)} até {formatarData(campanha.fim_em)}</p>

                <div className="mt-4 flex gap-2 border-t border-slate-100 pt-4">
                  <button onClick={() => editarCampanha(campanha)} className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-[#eef6fb] px-3 py-2.5 text-xs font-semibold text-[#1c6a91]"><Pencil className="h-3.5 w-3.5" /> Editar</button>
                  <button onClick={() => void alternarCampanha(campanha)} className="flex-1 rounded-xl bg-slate-100 px-3 py-2.5 text-xs font-semibold text-slate-600">{campanha.ativa ? "Pausar" : "Ativar"}</button>
                </div>
              </article>
            );
          })}
        </div>
      </section>

      {formAberto ? (
        <div className="fixed inset-0 z-50 bg-slate-950/45 px-3 py-4 sm:flex sm:items-center sm:justify-center">
          <div className="mx-auto flex max-h-[calc(100dvh-2rem)] w-full max-w-md flex-col overflow-hidden rounded-[26px] bg-white shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4">
              <div><p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#85a2b4]">Campanha</p><h2 className="text-xl font-semibold text-slate-900">{editandoId ? "Editar notificação" : "Nova notificação"}</h2></div>
              <button onClick={() => setFormAberto(false)} className="flex h-9 w-9 items-center justify-center rounded-full bg-slate-100 text-slate-500" aria-label="Fechar"><X className="h-4 w-4" /></button>
            </div>

            <div className="overflow-y-auto px-5 py-5">
              <div className="space-y-4">
                <label className="block space-y-1.5"><span className="text-sm font-medium text-slate-700">Título</span><input value={form.titulo} onChange={(e) => setForm({ ...form, titulo: e.target.value })} maxLength={80} placeholder="Ex.: Conclua suas aulas" className="w-full rounded-xl border border-slate-200 px-4 py-3 text-sm outline-none focus:border-[#1c6a91]" /></label>
                <label className="block space-y-1.5"><span className="text-sm font-medium text-slate-700">Mensagem</span><textarea value={form.mensagem} onChange={(e) => setForm({ ...form, mensagem: e.target.value })} rows={4} maxLength={320} placeholder="Escreva uma mensagem curta e objetiva." className="w-full resize-none rounded-xl border border-slate-200 px-4 py-3 text-sm leading-5 outline-none focus:border-[#1c6a91]" /></label>

                <div className="grid grid-cols-2 gap-3">
                  <label className="space-y-1.5"><span className="text-sm font-medium text-slate-700">Estilo</span><select value={form.tema} onChange={(e) => setForm({ ...form, tema: e.target.value as TemaCampanha })} className="w-full rounded-xl border border-slate-200 bg-white px-3 py-3 text-sm"><option value="informacao">Informação</option><option value="aviso">Aviso</option><option value="urgente">Urgente</option></select></label>
                  <label className="space-y-1.5"><span className="text-sm font-medium text-slate-700">Vezes por dia</span><select value={form.frequencia} onChange={(e) => setForm({ ...form, frequencia: Number(e.target.value) })} className="w-full rounded-xl border border-slate-200 bg-white px-3 py-3 text-sm">{[1,2,3,4,5,6].map((numero) => <option key={numero} value={numero}>{numero}x</option>)}</select></label>
                </div>

                <label className="block space-y-1.5"><span className="text-sm font-medium text-slate-700">Público</span><select value={form.publico} onChange={(e) => setForm({ ...form, publico: e.target.value as PublicoCampanha })} className="w-full rounded-xl border border-slate-200 bg-white px-3 py-3 text-sm"><option value="progresso_incompleto">Alunos abaixo de 100%</option><option value="turma">Uma turma específica</option><option value="todos">Todos os alunos</option></select></label>

                {form.publico !== "todos" ? <label className="block space-y-1.5"><span className="text-sm font-medium text-slate-700">Turma {form.publico === "progresso_incompleto" ? "(opcional)" : ""}</span><select value={form.turmaId} onChange={(e) => setForm({ ...form, turmaId: e.target.value })} className="w-full rounded-xl border border-slate-200 bg-white px-3 py-3 text-sm"><option value="">{form.publico === "progresso_incompleto" ? "Todas as turmas" : "Selecione"}</option>{turmas.map((turma) => <option key={turma.id} value={turma.id}>{turma.nome}</option>)}</select></label> : null}

                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2"><label className="space-y-1.5"><span className="text-sm font-medium text-slate-700">Começa em</span><input type="datetime-local" value={form.inicio} onChange={(e) => setForm({ ...form, inicio: e.target.value })} className="w-full rounded-xl border border-slate-200 px-3 py-3 text-sm" /></label><label className="space-y-1.5"><span className="text-sm font-medium text-slate-700">Termina em</span><input type="datetime-local" value={form.fim} onChange={(e) => setForm({ ...form, fim: e.target.value })} className="w-full rounded-xl border border-slate-200 px-3 py-3 text-sm" /></label></div>

                <label className="flex items-center justify-between rounded-xl bg-slate-50 px-4 py-3"><span><span className="block text-sm font-medium text-slate-700">Exibir sobre a tela</span><span className="text-xs text-slate-400">Também ficará disponível no sino.</span></span><input type="checkbox" checked={form.sobreTela} onChange={(e) => setForm({ ...form, sobreTela: e.target.checked })} className="h-5 w-5 accent-[#0e5d77]" /></label>

                <div className="grid grid-cols-2 gap-3"><label className="space-y-1.5"><span className="text-sm font-medium text-slate-700">Texto do botão</span><input value={form.acaoRotulo} onChange={(e) => setForm({ ...form, acaoRotulo: e.target.value })} className="w-full rounded-xl border border-slate-200 px-3 py-3 text-sm" /></label><label className="space-y-1.5"><span className="text-sm font-medium text-slate-700">Destino</span><input value={form.acaoRota} onChange={(e) => setForm({ ...form, acaoRota: e.target.value })} placeholder="/dashboard" className="w-full rounded-xl border border-slate-200 px-3 py-3 text-sm" /></label></div>

                <div className="rounded-[18px] border border-slate-200 bg-white p-4 shadow-[0_10px_30px_rgba(15,23,42,0.08)]"><p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-400">Prévia para {turmaSelecionada}</p><h3 className="mt-2 text-sm font-semibold text-slate-900">{form.titulo || "Título da notificação"}</h3><p className="mt-1 text-xs leading-5 text-slate-500">{form.mensagem || "A mensagem aparecerá aqui para o aluno."}</p>{form.acaoRotulo ? <span className="mt-3 inline-block rounded-lg bg-[#0e5d77] px-3 py-2 text-[11px] font-semibold text-white">{form.acaoRotulo}</span> : null}</div>

                {mensagemStatus && formAberto ? <p className="rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700">{mensagemStatus}</p> : null}
                <button onClick={() => void salvarCampanha()} disabled={salvando} className="w-full rounded-xl bg-[#0e5d77] px-5 py-3.5 text-sm font-semibold text-white disabled:opacity-60">{salvando ? "Salvando..." : editandoId ? "Salvar alterações" : "Programar notificação"}</button>
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </main>
  );
}
