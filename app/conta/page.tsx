"use client";

import Image from "next/image";
import { ChangeEvent, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Cropper, { type Area } from "react-easy-crop";
import { CalendarDays, ChartPie, CircleUserRound, House, LogOut, Pencil } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { getTurmaDoAluno } from "@/lib/aluno-dashboard";
import { getServiceUnavailableMessage, RequestTimeoutError, withTimeout } from "@/lib/network";
import { supabase } from "@/lib/supabase";
import { atualizarContaAluno, atualizarFotoPerfil, isValidUserRole, type UsuarioProfile } from "@/lib/usuarios";

const DIAS_SEMANA = ["Domingo", "Segunda", "Terca", "Quarta", "Quinta", "Sexta", "Sabado"];
const HORAS = Array.from({ length: 24 }, (_, index) => String(index).padStart(2, "0"));

async function criarImagem(src: string) {
  return await new Promise<HTMLImageElement>((resolve, reject) => {
    const image = new window.Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error("Nao foi possivel carregar a imagem selecionada."));
    image.src = src;
  });
}

async function gerarBlobRecortado(
  imageSrc: string,
  croppedAreaPixels: Area,
  mimeType = "image/jpeg",
) {
  const image = await criarImagem(imageSrc);
  const canvas = document.createElement("canvas");
  const context = canvas.getContext("2d");

  if (!context) {
    throw new Error("Nao foi possivel preparar o recorte da imagem.");
  }

  canvas.width = croppedAreaPixels.width;
  canvas.height = croppedAreaPixels.height;

  context.drawImage(
    image,
    croppedAreaPixels.x,
    croppedAreaPixels.y,
    croppedAreaPixels.width,
    croppedAreaPixels.height,
    0,
    0,
    croppedAreaPixels.width,
    croppedAreaPixels.height,
  );

  return await new Promise<Blob>((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (!blob) {
        reject(new Error("Nao foi possivel gerar a imagem recortada."));
        return;
      }

      resolve(blob);
    }, mimeType, 0.92);
  });
}

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

export default function ContaPage() {
  const { user, profile, profileError, loading, refreshProfile } = useAuth();
  const router = useRouter();
  const [checkingAccess, setCheckingAccess] = useState(true);
  const [mensagem, setMensagem] = useState("");
  const [nome, setNome] = useState("");
  const [novaSenha, setNovaSenha] = useState("");
  const [diasSelecionados, setDiasSelecionados] = useState<string[]>([]);
  const [horaSelecionada, setHoraSelecionada] = useState("");
  const [mostrarModalHorario, setMostrarModalHorario] = useState(false);
  const [salvando, setSalvando] = useState(false);
  const [saindo, setSaindo] = useState(false);
  const [enviandoFoto, setEnviandoFoto] = useState(false);
  const [turmaNome, setTurmaNome] = useState("");
  const [codigoTurma, setCodigoTurma] = useState("");
  const [fotoPreviewUrl, setFotoPreviewUrl] = useState("");
  const [mostrarModalRecorte, setMostrarModalRecorte] = useState(false);
  const [imagemParaRecorte, setImagemParaRecorte] = useState("");
  const [crop, setCrop] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [croppedAreaPixels, setCroppedAreaPixels] = useState<Area | null>(null);
  const inputFotoRef = useRef<HTMLInputElement | null>(null);

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

      setNome(profile.nome ?? "");
      setDiasSelecionados(profile.dias_estudo ?? []);
      setHoraSelecionada(profile.horario_estudo ? profile.horario_estudo.slice(0, 5) : "");
      setFotoPreviewUrl(profile.foto_url ?? "");

      try {
        const { turma, error } = await withTimeout(getTurmaDoAluno(user.id));

        if (!error && turma) {
          setTurmaNome(turma.nome);
        }

        const { data } = await withTimeout(
          supabase.from("alunos_turma").select("turmas(codigo_entrada)").eq("usuario_id", user.id).maybeSingle(),
        );

        const turmaRelacionada = Array.isArray(data?.turmas) ? data?.turmas[0] : data?.turmas;
        setCodigoTurma(turmaRelacionada?.codigo_entrada ?? "");
      } catch {
        // sem bloquear a tela por isso
      } finally {
        setCheckingAccess(false);
      }
    }

    void verificarAcesso();
  }, [loading, profile, profileError, router, user]);

  function toggleDia(dia: string) {
    setDiasSelecionados((estadoAtual) =>
      estadoAtual.includes(dia)
        ? estadoAtual.filter((item) => item !== dia)
        : [...estadoAtual, dia],
    );
  }

  async function handleSalvar() {
    if (!user || !profile) return;

    if (!nome.trim()) {
      setMensagem("Digite seu nome para continuar.");
      return;
    }

    setSalvando(true);
    setMensagem("");

    try {
      const { error: contaError } = await withTimeout(
        atualizarContaAluno(user.id, {
          nome,
          dias_estudo: diasSelecionados,
          horario_estudo: horaSelecionada || null,
        }),
      );

      if (contaError) {
        setMensagem("Nao foi possivel salvar suas alteracoes agora. Tente novamente.");
        setSalvando(false);
        return;
      }

      if (novaSenha.trim()) {
        const { error: senhaError } = await withTimeout(
          supabase.auth.updateUser({
            password: novaSenha.trim(),
          }),
        );

        if (senhaError) {
          setMensagem("Seus dados foram salvos, mas nao foi possivel alterar a senha agora.");
          setSalvando(false);
          await refreshProfile();
          return;
        }
      }

      await refreshProfile();
      setNovaSenha("");
      setMensagem("Alteracoes salvas com sucesso.");
    } catch (error) {
      setMensagem(
        error instanceof RequestTimeoutError
          ? getServiceUnavailableMessage()
          : "Nao foi possivel salvar suas alteracoes agora. Tente novamente.",
      );
    } finally {
      setSalvando(false);
    }
  }

  async function handleSair() {
    setSaindo(true);
    await supabase.auth.signOut();
    router.push("/login");
  }

  async function handleSelecionarFoto(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];

    if (!file) {
      return;
    }

    if (!file.type.startsWith("image/")) {
      setMensagem("Selecione uma imagem valida para a foto de perfil.");
      event.target.value = "";
      return;
    }

    const limiteMb = 5;

    if (file.size > limiteMb * 1024 * 1024) {
      setMensagem(`A foto de perfil deve ter no maximo ${limiteMb} MB.`);
      event.target.value = "";
      return;
    }

    setMensagem("");
    const objectUrl = URL.createObjectURL(file);
    setImagemParaRecorte(objectUrl);
    setCrop({ x: 0, y: 0 });
    setZoom(1);
    setCroppedAreaPixels(null);
    setMostrarModalRecorte(true);
    event.target.value = "";
  }

  function fecharModalRecorte() {
    if (imagemParaRecorte) {
      URL.revokeObjectURL(imagemParaRecorte);
    }
    setImagemParaRecorte("");
    setMostrarModalRecorte(false);
    setCrop({ x: 0, y: 0 });
    setZoom(1);
    setCroppedAreaPixels(null);
  }

  async function handleConfirmarRecorte() {
    if (!user || !imagemParaRecorte || !croppedAreaPixels) {
      setMensagem("Ajuste a imagem antes de continuar.");
      return;
    }

    setEnviandoFoto(true);
    setMensagem("");

    try {
      const blobRecortado = await gerarBlobRecortado(imagemParaRecorte, croppedAreaPixels);
      const caminhoArquivo = `${user.id}/perfil-${Date.now()}.jpg`;

      const { error: uploadError } = await withTimeout(
        supabase.storage.from("avatars").upload(caminhoArquivo, blobRecortado, {
          upsert: false,
          contentType: "image/jpeg",
        }),
      );

      if (uploadError) {
        setMensagem(`Nao foi possivel enviar a foto agora: ${uploadError.message}`);
        return;
      }

      const {
        data: { publicUrl },
      } = supabase.storage.from("avatars").getPublicUrl(caminhoArquivo);

      const { error: fotoError } = await withTimeout(atualizarFotoPerfil(user.id, publicUrl));

      if (fotoError) {
        setMensagem("A foto foi enviada, mas nao foi possivel salvar no perfil agora.");
        return;
      }

      setFotoPreviewUrl(publicUrl);
      await refreshProfile();
      setMensagem("Foto de perfil atualizada com sucesso.");
      fecharModalRecorte();
    } catch (error) {
      setMensagem(
        error instanceof RequestTimeoutError
          ? getServiceUnavailableMessage()
          : error instanceof Error
            ? error.message
            : "Nao foi possivel atualizar sua foto agora. Tente novamente.",
      );
    } finally {
      setEnviandoFoto(false);
    }
  }

  if (loading || checkingAccess) {
    return <div>Carregando acesso...</div>;
  }

  return (
    <main className="min-h-screen bg-white pb-28 pt-10">
      <header className="mx-auto flex max-w-md items-center justify-center px-6">
        <Image
          src="/img/logo.svg"
          alt="Escola de Ministros"
          width={147}
          height={49}
          className="h-10 w-auto object-contain"
          priority
        />
      </header>

      <div className="mx-auto flex w-full max-w-md flex-col gap-6 px-6 pt-8">
        <section className="space-y-5">
          <h1 className="text-[2rem] font-semibold leading-none text-[#1c6a91]">Conta</h1>

          <div className="space-y-3 text-center">
            <div className="mx-auto flex h-32 w-32 items-center justify-center overflow-hidden rounded-full bg-slate-200 text-3xl font-semibold text-slate-700">
              {fotoPreviewUrl ? (
                <Image
                  src={fotoPreviewUrl}
                  alt={profile?.nome || "Foto de perfil"}
                  width={128}
                  height={128}
                  className="h-full w-full object-cover"
                  unoptimized
                />
              ) : (
                iniciaisAvatar
              )}
            </div>

            <div>
              <h2 className="text-[2rem] font-semibold text-slate-900">{profile?.nome || "Aluno"}</h2>
              <p className="text-sm text-slate-500">
                Turma: {turmaNome || "Nao vinculada"} {codigoTurma ? `  Codigo: ${codigoTurma}` : ""}
              </p>
            </div>
          </div>

          {mensagem ? (
            <p
              className={`rounded-2xl border px-4 py-3 text-sm ${
                mensagem.includes("sucesso")
                  ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                  : "border-red-200 bg-red-50 text-red-700"
              }`}
            >
              {mensagem}
            </p>
          ) : null}

          <div className="space-y-4">
            <h2 className="text-[1.3rem] font-medium text-slate-700">Meus Dados</h2>

            <label className="block space-y-2">
              <span className="text-sm font-medium text-slate-700">Nome Completo</span>
              <div className="flex items-center rounded-[10px] border border-slate-200 px-4 py-3">
                <input
                  value={nome}
                  onChange={(event) => setNome(event.target.value)}
                  className="w-full outline-none"
                />
                <Pencil className="h-4 w-4 text-black" />
              </div>
            </label>

            <label className="block space-y-2">
              <span className="text-sm font-medium text-slate-700">Email</span>
              <input
                value={profile?.email ?? ""}
                readOnly
                className="w-full rounded-[10px] border border-slate-200 bg-slate-50 px-4 py-3 text-slate-400 outline-none"
              />
            </label>

            <label className="block space-y-2">
              <span className="text-sm font-medium text-slate-700">Alterar Senha</span>
              <input
                type="password"
                value={novaSenha}
                onChange={(event) => setNovaSenha(event.target.value)}
                placeholder="Digite sua nova senha"
                className="w-full rounded-[10px] border border-slate-200 px-4 py-3 outline-none"
              />
            </label>
          </div>

          <div className="space-y-4">
            <h2 className="text-[1.3rem] font-medium text-slate-700">Minha Rotina de Estudo</h2>

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

            <button
              type="button"
              onClick={() => setMostrarModalHorario(true)}
              className="w-full rounded-[10px] border border-slate-200 bg-white px-4 py-3 text-left text-slate-700"
            >
              Horario de estudo: <strong>{horaSelecionada || "Nao definido"}</strong>
            </button>
          </div>

          <div className="flex items-center gap-3 pt-2">
            <input
              ref={inputFotoRef}
              type="file"
              accept="image/*"
              onChange={handleSelecionarFoto}
              className="hidden"
            />

            <button
              type="button"
              onClick={() => inputFotoRef.current?.click()}
              disabled={enviandoFoto}
              className="flex-1 rounded-[10px] border border-slate-300 px-4 py-3 text-sm font-medium text-slate-700 disabled:opacity-60"
            >
              {enviandoFoto ? "Enviando foto..." : "Mudar foto de Perfil"}
            </button>

            <button
              type="button"
              onClick={handleSalvar}
              disabled={salvando}
              className="flex-1 rounded-[10px] bg-[#0e5d77] px-4 py-3 text-sm font-medium text-white disabled:opacity-60"
            >
              {salvando ? "Salvando..." : "Salvar Alteracoes"}
            </button>
          </div>

          <button
            type="button"
            onClick={handleSair}
            disabled={saindo}
            className="ml-auto flex items-center gap-2 text-sm font-medium text-slate-500"
          >
            <LogOut className="h-4 w-4" />
            {saindo ? "Saindo..." : "Sair da Conta"}
          </button>
        </section>
      </div>

      <nav className="fixed inset-x-0 bottom-0 z-30 border-t border-slate-200 bg-white px-3 py-3">
        <div className="mx-auto flex max-w-md items-center justify-between">
          <button onClick={() => router.push("/dashboard")} className="flex flex-col items-center gap-1 text-slate-400">
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

          <button className="flex flex-col items-center gap-1 text-black">
            <CircleUserRound className="h-7 w-7 stroke-[1.8]" />
            <span className="text-[10px] font-medium">Conta</span>
          </button>
        </div>
      </nav>

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

      {mostrarModalRecorte ? (
        <div className="fixed inset-0 z-[60] bg-slate-950/70 px-4 py-6 sm:flex sm:items-center sm:justify-center">
          <div className="mx-auto w-full max-w-sm rounded-[24px] bg-white px-5 py-5 shadow-2xl">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-semibold text-slate-900">Ajustar foto de perfil</h3>
              <button
                type="button"
                onClick={fecharModalRecorte}
                className="text-xl leading-none text-slate-500"
                disabled={enviandoFoto}
              >
                x
              </button>
            </div>

            <div className="relative mt-5 h-72 overflow-hidden rounded-[20px] bg-slate-950">
              <Cropper
                image={imagemParaRecorte}
                crop={crop}
                zoom={zoom}
                aspect={1}
                cropShape="round"
                showGrid={false}
                onCropChange={setCrop}
                onZoomChange={setZoom}
                onCropComplete={(_, areaPixels) => setCroppedAreaPixels(areaPixels)}
              />
            </div>

            <div className="mt-5 space-y-2">
              <div className="flex items-center justify-between text-sm text-slate-600">
                <span>Ajustar zoom</span>
                <span>{zoom.toFixed(1)}x</span>
              </div>
              <input
                type="range"
                min={1}
                max={3}
                step={0.1}
                value={zoom}
                onChange={(event) => setZoom(Number(event.target.value))}
                className="w-full accent-[#0e5d77]"
              />
            </div>

            <div className="mt-5 flex gap-3">
              <button
                type="button"
                onClick={fecharModalRecorte}
                disabled={enviandoFoto}
                className="flex-1 rounded-[10px] border border-slate-200 px-4 py-3 text-sm font-medium text-slate-700 disabled:opacity-60"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleConfirmarRecorte}
                disabled={enviandoFoto}
                className="flex-1 rounded-[10px] bg-[#0e5d77] px-4 py-3 text-sm font-medium text-white disabled:opacity-60"
              >
                {enviandoFoto ? "Salvando..." : "Usar esta foto"}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </main>
  );
}
