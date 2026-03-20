"use client";

import { ChangeEvent, useEffect, useMemo, useRef, useState } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { CalendarDays, ChartPie, CircleUserRound, House } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { getServiceUnavailableMessage, RequestTimeoutError, withTimeout } from "@/lib/network";
import { supabase } from "@/lib/supabase";
import { isValidUserRole, UsuarioProfile } from "@/lib/usuarios";
import {
  CategoriaTurma,
  gerarCodigoTurmaUnico,
  listarTurmas,
  TurmaAdmin,
  uploadCapaTurma,
} from "@/lib/turmas";

const categorias: Array<{ label: string; value: CategoriaTurma }> = [
  { label: "Instrumental", value: "instrumental" },
  { label: "Vocal", value: "vocal" },
];

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

export default function AdminPage() {
  const { user, profile, profileError, loading } = useAuth();
  const router = useRouter();
  const inputCapaRef = useRef<HTMLInputElement | null>(null);
  const [loadingAdmin, setLoadingAdmin] = useState(true);
  const [loadingTurmas, setLoadingTurmas] = useState(true);
  const [mensagem, setMensagem] = useState("");
  const [turmas, setTurmas] = useState<TurmaAdmin[]>([]);
  const [mostrarFormulario, setMostrarFormulario] = useState(false);
  const [nomeTurma, setNomeTurma] = useState("");
  const [categoriaTurma, setCategoriaTurma] = useState<CategoriaTurma>("instrumental");
  const [codigoTurma, setCodigoTurma] = useState("");
  const [arquivoCapa, setArquivoCapa] = useState<File | null>(null);
  const [previewCapa, setPreviewCapa] = useState("");
  const [carregandoCodigo, setCarregandoCodigo] = useState(false);
  const [salvandoTurma, setSalvandoTurma] = useState(false);

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
        setLoadingAdmin(false);
        return;
      }

      if (!isValidUserRole(profile.role)) {
        setMensagem("Nao conseguimos liberar seu acesso agora. Fale com o administrador.");
        setLoadingAdmin(false);
        return;
      }

      if (profile.role !== "admin") {
        router.push("/dashboard");
        return;
      }

      setLoadingAdmin(false);
    }

    void verificarAcesso();
  }, [user, profile, profileError, loading, router]);

  useEffect(() => {
    if (loadingAdmin) return;

    async function carregarTurmas() {
      setLoadingTurmas(true);

      try {
        const { turmas: turmasData, error } = await withTimeout(listarTurmas());

        if (error) {
          setMensagem("Nao conseguimos carregar suas turmas agora. Tente novamente em alguns instantes.");
          setLoadingTurmas(false);
          return;
        }

        setTurmas(turmasData);
        setLoadingTurmas(false);
      } catch (error) {
        if (error instanceof RequestTimeoutError) {
          setMensagem(getServiceUnavailableMessage());
        } else {
          setMensagem(getServiceUnavailableMessage());
        }
        setLoadingTurmas(false);
      }
    }

    carregarTurmas();
  }, [loadingAdmin]);

  useEffect(() => {
    return () => {
      if (previewCapa.startsWith("blob:")) {
        URL.revokeObjectURL(previewCapa);
      }
    };
  }, [previewCapa]);

  async function prepararNovaTurma() {
    setMensagem("");
    setNomeTurma("");
    setCategoriaTurma("instrumental");
    setCodigoTurma("");
    setArquivoCapa(null);
    setPreviewCapa("");
    setMostrarFormulario(true);
    setCarregandoCodigo(true);

    const { codigo, error } = await gerarCodigoTurmaUnico();

    if (error || !codigo) {
      setMensagem("Nao conseguimos gerar o codigo da turma agora. Tente novamente.");
      setMostrarFormulario(false);
      setCarregandoCodigo(false);
      return;
    }

    setCodigoTurma(codigo);
    setCarregandoCodigo(false);
  }

  function fecharFormulario() {
    if (salvandoTurma) return;

    if (previewCapa.startsWith("blob:")) {
      URL.revokeObjectURL(previewCapa);
    }

    setMostrarFormulario(false);
    setNomeTurma("");
    setCategoriaTurma("instrumental");
    setCodigoTurma("");
    setArquivoCapa(null);
    setPreviewCapa("");
    setCarregandoCodigo(false);
  }

  function handleSelecionarCapa(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];

    if (!file) return;

    if (!file.type.startsWith("image/")) {
      setMensagem("Selecione uma imagem valida para a capa.");
      event.target.value = "";
      return;
    }

    if (previewCapa.startsWith("blob:")) {
      URL.revokeObjectURL(previewCapa);
    }

    setMensagem("");
    setArquivoCapa(file);
    setPreviewCapa(URL.createObjectURL(file));
  }

  async function handleCriarTurma() {
    if (!nomeTurma.trim()) {
      setMensagem("Digite o nome da turma para continuar.");
      return;
    }

    if (!arquivoCapa) {
      setMensagem("Selecione uma imagem para a capa da turma.");
      return;
    }

    setSalvandoTurma(true);
    setMensagem("");

    let codigoFinal = codigoTurma;

    if (!codigoFinal) {
      const { codigo, error } = await gerarCodigoTurmaUnico();

      if (error || !codigo) {
        setMensagem("Nao conseguimos gerar o codigo da turma agora. Tente novamente.");
        setSalvandoTurma(false);
        return;
      }

      codigoFinal = codigo;
      setCodigoTurma(codigo);
    }

    const { capaUrl, error: capaError } = await uploadCapaTurma(arquivoCapa);

    if (capaError || !capaUrl) {
      setMensagem("Nao foi possivel enviar a capa agora. Tente novamente.");
      setSalvandoTurma(false);
      return;
    }

    const { error } = await supabase.from("turmas").insert({
      nome: nomeTurma.trim(),
      categoria: categoriaTurma,
      capa_url: capaUrl,
      codigo_entrada: codigoFinal,
    });

    if (error) {
      setMensagem("Nao foi possivel criar a turma agora. Tente novamente.");
      setSalvandoTurma(false);
      return;
    }

    const { turmas: turmasAtualizadas, error: erroListagem } = await listarTurmas();

    if (erroListagem) {
      setMensagem("Turma criada, mas nao conseguimos atualizar a lista agora.");
      setSalvandoTurma(false);
      setMostrarFormulario(false);
      return;
    }

    if (previewCapa.startsWith("blob:")) {
      URL.revokeObjectURL(previewCapa);
    }

    setTurmas(turmasAtualizadas);
    setSalvandoTurma(false);
    setMostrarFormulario(false);
    setNomeTurma("");
    setCategoriaTurma("instrumental");
    setCodigoTurma("");
    setArquivoCapa(null);
    setPreviewCapa("");
  }

  if (loading || loadingAdmin) {
    return <div>Carregando...</div>;
  }

  if (mensagem && !mostrarFormulario && turmas.length === 0 && !loadingTurmas) {
    return (
      <div className="min-h-screen flex items-center justify-center px-6">
        <p className="text-center max-w-md text-red-600">{mensagem}</p>
      </div>
    );
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

      <div className="mx-auto flex w-full max-w-md flex-col gap-5 px-4">
        <section className="space-y-5">
          <h1 className="pl-0.5 text-[2rem] font-semibold leading-none text-slate-900">Minhas Turmas</h1>

          {mensagem && !mostrarFormulario ? (
            <p className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
              {mensagem}
            </p>
          ) : null}

          {loadingTurmas ? (
            <div className="rounded-[22px] bg-slate-100 px-4 py-12 text-center text-slate-500">
              Carregando turmas...
            </div>
          ) : null}

          {!loadingTurmas && turmas.length === 0 ? (
            <>
              <button
                onClick={prepararNovaTurma}
                className="flex min-h-[132px] w-full items-center justify-center rounded-[12px] border border-[#2d6f86] bg-[#b7b7b7] px-6 text-lg font-medium text-white"
              >
                Crie sua Primeira Turma
              </button>

              <p className="px-6 text-center text-base leading-6 text-[#d9d9d9]">
                Voce ainda nao tem turmas criadas. Crie sua turma
              </p>
            </>
          ) : null}

          {!loadingTurmas && turmas.length > 0 ? (
            <>
              <div className="space-y-4">
                {turmas.map((turma) => (
                  <button
                    key={turma.id}
                    type="button"
                    onClick={() => router.push(`/turma/${turma.id}`)}
                    className="block w-full overflow-hidden rounded-[14px] bg-white text-left shadow-[0_2px_14px_rgba(15,23,42,0.08)] transition hover:shadow-[0_6px_24px_rgba(15,23,42,0.12)]"
                  >
                    <div className="relative h-36 w-full bg-slate-100">
                      {turma.capa_url ? (
                        <Image
                          src={turma.capa_url}
                          alt={`Capa da turma ${turma.nome}`}
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
                          <h2 className="text-[1.05rem] font-semibold text-slate-900">{turma.nome}</h2>
                          <p className="text-xs font-medium uppercase tracking-[0.22em] text-[#89a1c0]">
                            {turma.categoria || "sem categoria"}
                          </p>
                        </div>

                        <span className="rounded-full bg-[#eef7ff] px-3 py-1 text-xs font-semibold tracking-[0.18em] text-[#1c6a91]">
                          {turma.codigo_entrada}
                        </span>
                      </div>
                    </div>
                  </button>
                ))}
              </div>

              <button
                onClick={prepararNovaTurma}
                className="w-full rounded-[10px] bg-[#d9d9d9] px-4 py-3 text-sm font-medium text-white"
              >
                Criar Nova Turma
              </button>
            </>
          ) : null}
        </section>
      </div>

      <nav className="fixed inset-x-0 bottom-0 z-30 border-t border-slate-200 bg-white px-3 py-3">
        <div className="mx-auto flex max-w-md items-center justify-between">
          <button className="flex flex-col items-center gap-1 text-black">
            <House className="h-7 w-7 fill-current stroke-[1.8]" />
            <span className="text-[10px] font-medium">Inicio</span>
          </button>

          <button className="flex flex-col items-center gap-1 text-slate-400">
            <CalendarDays className="h-7 w-7 stroke-[1.8]" />
            <span className="text-[10px] font-medium">Agenda</span>
          </button>

          <button onClick={() => router.push("/admin/progresso")} className="flex flex-col items-center gap-1 text-slate-400">
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

      {mostrarFormulario ? (
        <div className="fixed inset-0 z-50 bg-slate-950/45 px-4 py-6 sm:flex sm:items-center sm:justify-center sm:px-6 sm:py-8">
          <div className="mx-auto flex max-h-[calc(100dvh-8.5rem)] w-full max-w-md flex-col overflow-hidden rounded-[24px] bg-white shadow-2xl sm:max-h-[calc(100dvh-6rem)]">
            <div className="flex items-start justify-between gap-4 px-5 pb-3 pt-5">
              <div className="space-y-1">
                <h2 className="text-2xl font-semibold text-slate-900">Criar turma</h2>
              </div>

              <button onClick={fecharFormulario} className="text-xl leading-none text-slate-500">
                x
              </button>
            </div>

            <div className="overflow-y-auto px-5 pb-5 pt-2">
              <div className="space-y-5">
                <label className="block space-y-2">
                  <span className="text-sm font-medium text-slate-700">Nome da Turma</span>
                  <input
                    value={nomeTurma}
                    onChange={(event) => setNomeTurma(event.target.value)}
                    placeholder="Digite o nome da Turma"
                    className="w-full rounded-2xl border border-slate-200 px-4 py-3 outline-none transition focus:border-sky-700"
                  />
                </label>

                <div className="space-y-2">
                  <span className="text-sm font-medium text-slate-700">Categoria</span>
                  <div className="grid grid-cols-2 gap-3">
                    {categorias.map((categoria) => {
                      const ativa = categoriaTurma === categoria.value;

                      return (
                        <button
                          key={categoria.value}
                          type="button"
                          onClick={() => setCategoriaTurma(categoria.value)}
                          className={`rounded-2xl px-4 py-3 text-sm font-medium transition ${
                            ativa
                              ? "bg-[#cfe8ff] text-[#1c6a91]"
                              : "bg-[#eaf1fa] text-[#9aabc1]"
                          }`}
                        >
                          {categoria.label}
                        </button>
                      );
                    })}
                  </div>
                </div>

                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium text-slate-700">Capa</span>
                    <span className="text-xs font-medium text-red-500">Tamanho 1284x508 (recomendado)</span>
                  </div>

                  <input
                    ref={inputCapaRef}
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={handleSelecionarCapa}
                  />

                  <button
                    type="button"
                    onClick={() => inputCapaRef.current?.click()}
                    className="flex w-full items-center justify-center rounded-[8px] bg-[#d9d9d9] px-4 py-4 text-sm font-medium text-slate-700"
                  >
                    {arquivoCapa ? "Trocar imagem" : "Exportar Imagem JPG"}
                  </button>

                  {previewCapa ? (
                    <div className="relative h-40 overflow-hidden rounded-2xl border border-slate-200">
                      <Image
                        src={previewCapa}
                        alt="Preview da capa"
                        fill
                        className="object-cover"
                        unoptimized
                      />
                    </div>
                  ) : null}
                </div>

                <label className="block space-y-2">
                  <span className="text-sm font-medium text-slate-700">Codigo da Turma</span>
                  <input
                    value={carregandoCodigo ? "Gerando..." : codigoTurma}
                    readOnly
                    className="w-full rounded-2xl border border-slate-200 bg-slate-100 px-4 py-3 text-slate-500 outline-none"
                  />
                </label>

                {mensagem && mostrarFormulario ? (
                  <p className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                    {mensagem}
                  </p>
                ) : null}

                <button
                  onClick={handleCriarTurma}
                  disabled={salvandoTurma || carregandoCodigo}
                  className="mx-auto block rounded-[10px] bg-[#0e5d77] px-10 py-3 font-medium text-white transition hover:bg-[#0b4d63] disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {salvandoTurma ? "Criando turma..." : "Criar Turma"}
                </button>
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </main>
  );
}
