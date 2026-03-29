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
  MessageSquare,
  Pencil,
  PlaySquare,
  SquarePen,
  Trash2,
} from "lucide-react";
import AppLoader from "@/components/AppLoader";
import MobileDatePickerModal from "@/components/MobileDatePickerModal";
import MobileTimePickerModal from "@/components/MobileTimePickerModal";
import { notificarTurma } from "@/lib/admin-notificacoes";
import { getAvaliacaoDaAula, salvarAvaliacaoManualDaAula } from "@/lib/avaliacoes";
import { useAuth } from "@/contexts/AuthContext";
import { YouTubePlayer } from "@/components/YouTubePlayer";
import { contarComentariosDaAula } from "@/lib/comentarios";
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

type ModoPublicacao = "agora" | "agendada";
type ModoPrazo = "automatico" | "manual";
type AlternativaRascunho = {
  id: string;
  texto: string;
  correta: boolean;
};
type QuestaoRascunho = {
  id: string;
  pergunta: string;
  explicacao: string;
  alternativas: AlternativaRascunho[];
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

function formatarDataParaInput(dataIso: string | null) {
  if (!dataIso) return "";

  const data = new Date(dataIso);
  const ano = data.getFullYear();
  const mes = String(data.getMonth() + 1).padStart(2, "0");
  const dia = String(data.getDate()).padStart(2, "0");
  return `${ano}-${mes}-${dia}`;
}

function formatDateObjectToInput(data: Date) {
  const ano = data.getFullYear();
  const mes = String(data.getMonth() + 1).padStart(2, "0");
  const dia = String(data.getDate()).padStart(2, "0");
  return `${ano}-${mes}-${dia}`;
}

function formatarHoraParaInput(dataIso: string | null) {
  if (!dataIso) return "";

  const data = new Date(dataIso);
  const hora = String(data.getHours()).padStart(2, "0");
  const minuto = String(data.getMinutes()).padStart(2, "0");
  return `${hora}:${minuto}`;
}

function combinarDataHora(data: string, hora: string) {
  return `${data}T${hora}:00`;
}

function parseDateInput(value: string) {
  const [year, month, day] = value.split("-").map(Number);
  return new Date(year, (month || 1) - 1, day || 1);
}

function formatarDataLabel(value: string) {
  if (!value) return "Selecionar data";
  return parseDateInput(value).toLocaleDateString("pt-BR", {
    day: "2-digit",
    month: "long",
    year: "numeric",
  });
}

function getFimDaSemana(dataBase: string) {
  const data = new Date(dataBase);
  const dia = data.getDay();
  const diasAteSabado = dia === 6 ? 0 : 6 - dia;
  const fim = new Date(data);
  fim.setDate(data.getDate() + diasAteSabado);
  fim.setHours(23, 59, 59, 999);
  return fim.toISOString();
}

function getMaximoPrazo(dataBase: string) {
  const data = new Date(dataBase);
  const maximo = new Date(data);
  maximo.setDate(data.getDate() + 7);
  return maximo.toISOString();
}

function formatarResumoPublicacao(aula: AulaModulo | null) {
  if (!aula) return null;

  if (aula.publicado) {
    if (aula.publicado_em) {
      return `Publicada em ${new Date(aula.publicado_em).toLocaleString("pt-BR")}`;
    }

    return "Publicada imediatamente";
  }

  if (aula.data_publicacao) {
    return `Agendada para ${new Date(aula.data_publicacao).toLocaleString("pt-BR")}`;
  }

  return "Publicacao pendente";
}

function formatarResumoPrazo(aula: AulaModulo | null) {
  if (!aula) return null;

  if (!aula.conta_no_progresso) {
    return "Aula de revisao: nao entra no progresso semanal.";
  }

  if (!aula.data_fechamento) {
    return "Sem prazo de fechamento definido.";
  }

  return `Conta no progresso ate ${new Date(aula.data_fechamento).toLocaleString("pt-BR")}`;
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
  const [modoPublicacao, setModoPublicacao] = useState<ModoPublicacao>("agora");
  const [dataPublicacao, setDataPublicacao] = useState("");
  const [horaPublicacao, setHoraPublicacao] = useState("");
  const [contaNoProgresso, setContaNoProgresso] = useState(true);
  const [modoPrazo, setModoPrazo] = useState<ModoPrazo>("automatico");
  const [dataFechamento, setDataFechamento] = useState("");
  const [horaFechamento, setHoraFechamento] = useState("");
  const [pickerAberto, setPickerAberto] = useState<null | "data-publicacao" | "hora-publicacao" | "data-fechamento" | "hora-fechamento">(null);
  const [statusPlayer, setStatusPlayer] = useState<"idle" | "playing" | "paused" | "ended">("idle");
  const [progressoPlayer, setProgressoPlayer] = useState<{ currentTime: number; duration: number } | null>(null);
  const [comentariosCount, setComentariosCount] = useState(0);
  const [avaliacaoAtiva, setAvaliacaoAtiva] = useState(false);
  const [questoesAvaliacao, setQuestoesAvaliacao] = useState<QuestaoRascunho[]>([]);
  const [transcricaoAvaliacao, setTranscricaoAvaliacao] = useState("");
  const [gerandoQuestoes, setGerandoQuestoes] = useState(false);
  const [avaliacaoGeradaPorTranscricao, setAvaliacaoGeradaPorTranscricao] = useState(false);
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
          setModoPublicacao(aula.publicado ? "agora" : "agendada");
          setDataPublicacao(formatarDataParaInput(aula.data_publicacao));
          setHoraPublicacao(formatarHoraParaInput(aula.data_publicacao));
          setContaNoProgresso(aula.conta_no_progresso);
          setModoPrazo(aula.data_fechamento ? "manual" : "automatico");
          setDataFechamento(formatarDataParaInput(aula.data_fechamento));
          setHoraFechamento(formatarHoraParaInput(aula.data_fechamento));
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
          const { total } = await contarComentariosDaAula(aula.id);
          setComentariosCount(total);
          const { avaliacao, error: avaliacaoError } = await getAvaliacaoDaAula(aula.id);

          if (!avaliacaoError && avaliacao) {
            setAvaliacaoAtiva(avaliacao.ativa);
            setTranscricaoAvaliacao(avaliacao.transcricao_base ?? "");
            setAvaliacaoGeradaPorTranscricao(avaliacao.gerada_por_transcricao);
            setQuestoesAvaliacao(
              avaliacao.questoes.map((questao) => ({
                id: questao.id,
                pergunta: questao.pergunta,
                explicacao: questao.explicacao ?? "",
                alternativas: questao.alternativas.map((alternativa) => ({
                  id: alternativa.id,
                  texto: alternativa.texto,
                  correta: alternativa.correta,
                })),
              })),
            );
          }
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

  function criarQuestaoVazia(): QuestaoRascunho {
    return {
      id: crypto.randomUUID(),
      pergunta: "",
      explicacao: "",
      alternativas: Array.from({ length: 4 }, (_, index) => ({
        id: crypto.randomUUID(),
        texto: "",
        correta: index === 0,
      })),
    };
  }

  function handleAdicionarQuestao() {
    setQuestoesAvaliacao((estadoAtual) => [...estadoAtual, criarQuestaoVazia()]);
  }

  function handleAtualizarQuestao(id: string, campo: "pergunta" | "explicacao", valor: string) {
    setQuestoesAvaliacao((estadoAtual) =>
      estadoAtual.map((questao) => (questao.id === id ? { ...questao, [campo]: valor } : questao)),
    );
  }

  function handleAtualizarAlternativa(questaoId: string, alternativaId: string, valor: string) {
    setQuestoesAvaliacao((estadoAtual) =>
      estadoAtual.map((questao) =>
        questao.id === questaoId
          ? {
              ...questao,
              alternativas: questao.alternativas.map((alternativa) =>
                alternativa.id === alternativaId ? { ...alternativa, texto: valor } : alternativa,
              ),
            }
          : questao,
      ),
    );
  }

  function handleDefinirCorreta(questaoId: string, alternativaId: string) {
    setQuestoesAvaliacao((estadoAtual) =>
      estadoAtual.map((questao) =>
        questao.id === questaoId
          ? {
              ...questao,
              alternativas: questao.alternativas.map((alternativa) => ({
                ...alternativa,
                correta: alternativa.id === alternativaId,
              })),
            }
          : questao,
      ),
    );
  }

  function handleRemoverQuestao(id: string) {
    setQuestoesAvaliacao((estadoAtual) => estadoAtual.filter((questao) => questao.id !== id));
  }

  async function handleArquivoTranscricao(event: ChangeEvent<HTMLInputElement>) {
    const arquivo = event.target.files?.[0];
    event.target.value = "";

    if (!arquivo) return;

    try {
      const conteudo = await arquivo.text();
      setTranscricaoAvaliacao(conteudo);
      setMensagem("");
    } catch {
      setMensagem("Nao conseguimos ler o arquivo da transcricao agora.");
    }
  }

  async function handleGerarQuestoesPorTranscricao() {
    if (!transcricaoAvaliacao.trim()) {
      setMensagem("Cole ou envie a transcricao antes de gerar as questoes.");
      return;
    }

    setGerandoQuestoes(true);
    setMensagem("");

    try {
      const response = await fetch("/api/avaliacoes/gerar", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          transcricao: transcricaoAvaliacao,
          tituloAula,
        }),
      });

      const payload = (await response.json()) as {
        error?: string;
        questoes?: Array<{
          pergunta: string;
          explicacao?: string;
          alternativas: Array<{
            texto: string;
            correta: boolean;
          }>;
        }>;
      };

      if (!response.ok || !payload.questoes) {
        setMensagem(payload.error || "Nao conseguimos gerar as questoes agora.");
        setGerandoQuestoes(false);
        return;
      }

      setQuestoesAvaliacao(
        payload.questoes.map((questao) => ({
          id: crypto.randomUUID(),
          pergunta: questao.pergunta,
          explicacao: questao.explicacao ?? "",
          alternativas: questao.alternativas.map((alternativa) => ({
            id: crypto.randomUUID(),
            texto: alternativa.texto,
            correta: alternativa.correta,
          })),
        })),
      );
      setAvaliacaoAtiva(true);
      setAvaliacaoGeradaPorTranscricao(true);
    } catch {
      setMensagem("Nao conseguimos gerar as questoes agora.");
    } finally {
      setGerandoQuestoes(false);
    }
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
    const dataHoraAgendada =
      modoPublicacao === "agendada" && dataPublicacao && horaPublicacao
        ? combinarDataHora(dataPublicacao, horaPublicacao)
        : null;
    const dataBasePublicacao =
      modoPublicacao === "agendada" ? dataHoraAgendada : new Date().toISOString();

    if (modoPublicacao === "agendada" && (!dataPublicacao || !horaPublicacao || !dataHoraAgendada)) {
      setMensagem("Escolha a data e a hora para agendar a publicacao da aula.");
      setPublicandoAula(false);
      return;
    }

    if (dataHoraAgendada && new Date(dataHoraAgendada).getTime() <= Date.now()) {
      setMensagem("Escolha uma data e hora futuras para agendar a publicacao da aula.");
      setPublicandoAula(false);
      return;
    }

    const dataHoraFechamentoManual =
      contaNoProgresso && modoPrazo === "manual" && dataFechamento && horaFechamento
        ? combinarDataHora(dataFechamento, horaFechamento)
        : null;

    if (contaNoProgresso && modoPrazo === "manual" && (!dataFechamento || !horaFechamento || !dataHoraFechamentoManual)) {
      setMensagem("Escolha a data e a hora de fechamento da aula.");
      setPublicandoAula(false);
      return;
    }

    if (contaNoProgresso && dataBasePublicacao) {
      const prazoAutomatico = getFimDaSemana(dataBasePublicacao);
      const prazoMaximo = getMaximoPrazo(dataBasePublicacao);
      const dataFinal = modoPrazo === "manual" ? dataHoraFechamentoManual : prazoAutomatico;

      if (!dataFinal) {
        setMensagem("Nao foi possivel definir o prazo final desta aula.");
        setPublicandoAula(false);
        return;
      }

      if (new Date(dataFinal).getTime() <= new Date(dataBasePublicacao).getTime()) {
        setMensagem("O prazo final precisa ser depois da data de publicacao da aula.");
        setPublicandoAula(false);
        return;
      }

      if (new Date(dataFinal).getTime() > new Date(prazoMaximo).getTime()) {
        setMensagem("O prazo final nao pode ultrapassar 7 dias apos a publicacao da aula.");
        setPublicandoAula(false);
        return;
      }
    }

    const dataFechamentoFinal =
      !contaNoProgresso || !dataBasePublicacao
        ? null
        : modoPrazo === "manual"
          ? dataHoraFechamentoManual
          : getFimDaSemana(dataBasePublicacao);

    const publicacaoPayload =
      modoPublicacao === "agendada"
        ? {
            data_publicacao: dataHoraAgendada,
            data_fechamento: dataFechamentoFinal,
            publicado: false,
            publicado_em: null,
            conta_no_progresso: contaNoProgresso,
          }
        : {
            data_publicacao: null,
            data_fechamento: dataFechamentoFinal,
            publicado: true,
            publicado_em: new Date().toISOString(),
            conta_no_progresso: contaNoProgresso,
          };

    const deveNotificarNovaAula =
      publicacaoPayload.publicado === true && (!modoEdicao || !aulaAtual?.publicado);

    const { aula, error } = modoEdicao && aulaId
      ? await atualizarAula(aulaId, {
          titulo: tituloAula,
          video_url: videoUrl.trim(),
          duracao_texto: duracaoFinal,
          ...publicacaoPayload,
        })
      : await criarAula(moduloId, tituloAula, videoUrl.trim(), duracaoFinal, publicacaoPayload);

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

    if (avaliacaoAtiva || questoesAvaliacao.length > 0) {
      const questoesValidas = questoesAvaliacao.filter((questao) => questao.pergunta.trim());

      if (avaliacaoAtiva && questoesValidas.length === 0) {
        setMensagem("Adicione pelo menos uma questao para ativar a avaliacao.");
        setPublicandoAula(false);
        return;
      }

      for (const questao of questoesValidas) {
        const alternativasPreenchidas = questao.alternativas.filter((alternativa) => alternativa.texto.trim());

        if (alternativasPreenchidas.length !== 4) {
          setMensagem("Cada questao da avaliacao precisa ter 4 alternativas preenchidas.");
          setPublicandoAula(false);
          return;
        }

        if (questao.alternativas.filter((alternativa) => alternativa.correta).length !== 1) {
          setMensagem("Cada questao precisa ter exatamente 1 alternativa correta.");
          setPublicandoAula(false);
          return;
        }
      }

      const { error: avaliacaoError } = await salvarAvaliacaoManualDaAula(aula.id, {
        ativa: avaliacaoAtiva,
        geradaPorTranscricao: avaliacaoGeradaPorTranscricao,
        transcricaoBase: transcricaoAvaliacao.trim() || null,
        questoes: questoesValidas.map((questao, questaoIndex) => ({
          ordem: questaoIndex + 1,
          pergunta: questao.pergunta,
          explicacao: questao.explicacao || null,
          alternativas: questao.alternativas.map((alternativa, alternativaIndex) => ({
            ordem: alternativaIndex + 1,
            texto: alternativa.texto,
            correta: alternativa.correta,
          })),
        })),
      });

      if (avaliacaoError) {
        setMensagem("A aula foi salva, mas nao conseguimos salvar a avaliacao agora.");
        setPublicandoAula(false);
        return;
      }
    }

    if (deveNotificarNovaAula && modulo?.turma_id) {
      await notificarTurma({
        turmaId: modulo.turma_id,
        tipo: "nova_aula",
        titulo: "Nova aula disponivel",
        mensagem: `Nova aula disponivel: ${aula.titulo}`,
        acao_tipo: "abrir_aula",
        acao_payload: { aula_id: aula.id },
      });
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
    return <AppLoader />;
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
            <AppLoader fullScreen={false} />
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

              <div className="space-y-3 rounded-[18px] border border-slate-200 bg-slate-50 px-4 py-4">
                <div className="space-y-1">
                  <span className="text-sm font-medium text-slate-800">Publicacao da Aula</span>
                  <p className="text-xs text-slate-500">
                    Escolha se a aula deve sair agora ou em uma data e horario especificos.
                  </p>
                  {modoEdicao && aulaAtual ? (
                    <div className="space-y-1">
                      <p className="text-xs font-medium text-slate-600">{formatarResumoPublicacao(aulaAtual)}</p>
                      <p className="text-xs font-medium text-slate-500">{formatarResumoPrazo(aulaAtual)}</p>
                    </div>
                  ) : null}
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <button
                    type="button"
                    onClick={() => setModoPublicacao("agora")}
                    className={`rounded-[12px] border px-4 py-3 text-sm font-medium transition ${
                      modoPublicacao === "agora"
                        ? "border-[#0e5d77] bg-[#0e5d77] text-white"
                        : "border-slate-200 bg-white text-slate-700"
                    }`}
                  >
                    Publicar agora
                  </button>

                  <button
                    type="button"
                    onClick={() => setModoPublicacao("agendada")}
                    className={`rounded-[12px] border px-4 py-3 text-sm font-medium transition ${
                      modoPublicacao === "agendada"
                        ? "border-[#0e5d77] bg-[#0e5d77] text-white"
                        : "border-slate-200 bg-white text-slate-700"
                    }`}
                  >
                    Agendar publicacao
                  </button>
                </div>

                {modoPublicacao === "agendada" ? (
                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                    <label className="block space-y-2">
                      <span className="text-xs font-medium uppercase tracking-[0.08em] text-slate-500">
                        Data
                      </span>
                      <button
                        type="button"
                        onClick={() => setPickerAberto("data-publicacao")}
                        className="w-full rounded-[12px] border border-slate-200 bg-white px-4 py-3 text-left text-sm outline-none"
                      >
                        {formatarDataLabel(dataPublicacao)}
                      </button>
                    </label>

                    <label className="block space-y-2">
                      <span className="text-xs font-medium uppercase tracking-[0.08em] text-slate-500">
                        Hora
                      </span>
                      <button
                        type="button"
                        onClick={() => setPickerAberto("hora-publicacao")}
                        className="w-full rounded-[12px] border border-slate-200 bg-white px-4 py-3 text-left text-sm outline-none"
                      >
                        {horaPublicacao || "Selecionar hora"}
                      </button>
                    </label>
                  </div>
                ) : null}
              </div>

              <div className="space-y-3 rounded-[18px] border border-slate-200 bg-white px-4 py-4">
                <div className="space-y-1">
                  <span className="text-sm font-medium text-slate-800">Participacao no Progresso</span>
                  <p className="text-xs text-slate-500">
                    Aulas da semana contam no progresso. Aulas de revisao ficam disponiveis sem pesar na meta semanal.
                  </p>
                </div>

                <div className="flex items-center justify-between rounded-[12px] border border-slate-200 px-4 py-3">
                  <div>
                    <p className="text-sm font-medium text-slate-800">Conta no progresso semanal</p>
                    <p className="text-xs text-slate-500">
                      Desligue para liberar a aula como revisao, sem prazo e sem entrar no progresso.
                    </p>
                  </div>

                  <button
                    type="button"
                    onClick={() => setContaNoProgresso((atual) => !atual)}
                    className={`flex h-7 w-12 items-center rounded-full p-1 transition ${
                      contaNoProgresso ? "bg-[#0e5d77]" : "bg-slate-300"
                    }`}
                    aria-label="Alternar participacao no progresso"
                  >
                    <span
                      className={`h-5 w-5 rounded-full bg-white transition ${contaNoProgresso ? "translate-x-5" : ""}`}
                    />
                  </button>
                </div>

                {contaNoProgresso ? (
                  <div className="space-y-3">
                    <div className="grid grid-cols-2 gap-3">
                      <button
                        type="button"
                        onClick={() => setModoPrazo("automatico")}
                        className={`rounded-[12px] border px-4 py-3 text-sm font-medium transition ${
                          modoPrazo === "automatico"
                            ? "border-[#0e5d77] bg-[#0e5d77] text-white"
                            : "border-slate-200 bg-white text-slate-700"
                        }`}
                      >
                        Ate o fim da semana
                      </button>

                      <button
                        type="button"
                        onClick={() => setModoPrazo("manual")}
                        className={`rounded-[12px] border px-4 py-3 text-sm font-medium transition ${
                          modoPrazo === "manual"
                            ? "border-[#0e5d77] bg-[#0e5d77] text-white"
                            : "border-slate-200 bg-white text-slate-700"
                        }`}
                      >
                        Definir prazo manual
                      </button>
                    </div>

                    <p className="text-xs text-slate-500">
                      O prazo manual nao pode ultrapassar 7 dias apos a publicacao da aula.
                    </p>

                    {modoPrazo === "manual" ? (
                      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                        <label className="block space-y-2">
                          <span className="text-xs font-medium uppercase tracking-[0.08em] text-slate-500">
                            Data limite
                          </span>
                          <button
                            type="button"
                            onClick={() => setPickerAberto("data-fechamento")}
                            className="w-full rounded-[12px] border border-slate-200 bg-white px-4 py-3 text-left text-sm outline-none"
                          >
                            {formatarDataLabel(dataFechamento)}
                          </button>
                        </label>

                        <label className="block space-y-2">
                          <span className="text-xs font-medium uppercase tracking-[0.08em] text-slate-500">
                            Hora limite
                          </span>
                          <button
                            type="button"
                            onClick={() => setPickerAberto("hora-fechamento")}
                            className="w-full rounded-[12px] border border-slate-200 bg-white px-4 py-3 text-left text-sm outline-none"
                          >
                            {horaFechamento || "Selecionar hora"}
                          </button>
                        </label>
                      </div>
                    ) : null}
                  </div>
                ) : null}
              </div>

              <div className="space-y-4 rounded-[18px] border border-slate-200 bg-white px-4 py-4">
                <div className="space-y-1">
                  <span className="text-sm font-medium text-slate-800">Avaliacao da Aula</span>
                  <p className="text-xs text-slate-500">
                    Configure uma miniavaliacao objetiva ao final da aula. O aluno so avanca quando acertar 100%.
                  </p>
                </div>

                <div className="flex items-center justify-between rounded-[12px] border border-slate-200 px-4 py-3">
                  <div>
                    <p className="text-sm font-medium text-slate-800">Ativar avaliacao</p>
                    <p className="text-xs text-slate-500">Use apenas em aulas-chave ou no fechamento de um bloco.</p>
                  </div>

                  <button
                    type="button"
                    onClick={() => setAvaliacaoAtiva((atual) => !atual)}
                    className={`flex h-7 w-12 items-center rounded-full p-1 transition ${
                      avaliacaoAtiva ? "bg-[#0e5d77]" : "bg-slate-300"
                    }`}
                    aria-label="Alternar avaliacao da aula"
                  >
                    <span
                      className={`h-5 w-5 rounded-full bg-white transition ${avaliacaoAtiva ? "translate-x-5" : ""}`}
                    />
                  </button>
                </div>

                {avaliacaoAtiva ? (
                  <div className="space-y-4">
                    <div className="space-y-3 rounded-[16px] border border-slate-200 bg-slate-50 px-4 py-4">
                      <div className="space-y-1">
                        <p className="text-sm font-semibold text-slate-900">Gerar por transcricao</p>
                        <p className="text-xs text-slate-500">
                          Cole a transcricao da aula ou envie um arquivo de texto. As questoes geradas continuam
                          totalmente editaveis antes de publicar.
                        </p>
                      </div>

                      <textarea
                        value={transcricaoAvaliacao}
                        onChange={(event) => {
                          setTranscricaoAvaliacao(event.target.value);
                          setAvaliacaoGeradaPorTranscricao(false);
                        }}
                        rows={8}
                        placeholder="Cole aqui a transcricao completa da aula"
                        className="w-full rounded-[12px] border border-slate-200 bg-white px-4 py-3 text-sm outline-none"
                      />

                      <div className="flex flex-wrap items-center gap-3">
                        <label className="inline-flex cursor-pointer items-center gap-2 rounded-[12px] border border-slate-200 bg-white px-4 py-3 text-sm font-medium text-slate-700">
                          <input type="file" accept=".txt,.md,.text" className="hidden" onChange={handleArquivoTranscricao} />
                          Enviar arquivo
                        </label>

                        <button
                          type="button"
                          onClick={() => void handleGerarQuestoesPorTranscricao()}
                          disabled={gerandoQuestoes}
                          className="rounded-[12px] bg-[#0e5d77] px-4 py-3 text-sm font-semibold text-white disabled:opacity-60"
                        >
                          {gerandoQuestoes ? "Gerando questoes..." : "Gerar questoes"}
                        </button>
                      </div>

                      {avaliacaoGeradaPorTranscricao ? (
                        <p className="text-xs font-medium text-[#0e5d77]">
                          Questoes geradas a partir da transcricao. Revise e ajuste antes de publicar.
                        </p>
                      ) : null}
                    </div>

                    {questoesAvaliacao.length === 0 ? (
                      <p className="rounded-[12px] border border-dashed border-slate-200 px-4 py-4 text-sm text-slate-500">
                        Nenhuma questao criada ainda.
                      </p>
                    ) : null}

                    {questoesAvaliacao.map((questao, index) => (
                      <div key={questao.id} className="space-y-3 rounded-[16px] border border-slate-200 bg-slate-50 px-4 py-4">
                        <div className="flex items-center justify-between gap-3">
                          <p className="text-sm font-semibold text-slate-900">Questao {index + 1}</p>
                          <button
                            type="button"
                            onClick={() => handleRemoverQuestao(questao.id)}
                            className="text-sm font-medium text-[#b42318]"
                          >
                            Remover
                          </button>
                        </div>

                        <label className="block space-y-2">
                          <span className="text-xs font-medium uppercase tracking-[0.08em] text-slate-500">Pergunta</span>
                          <textarea
                            value={questao.pergunta}
                            onChange={(event) => handleAtualizarQuestao(questao.id, "pergunta", event.target.value)}
                            rows={3}
                            placeholder="Digite uma pergunta objetiva e sem ambiguidade"
                            className="w-full rounded-[12px] border border-slate-200 bg-white px-4 py-3 text-sm outline-none"
                          />
                        </label>

                        <label className="block space-y-2">
                          <span className="text-xs font-medium uppercase tracking-[0.08em] text-slate-500">Observacao opcional</span>
                          <input
                            value={questao.explicacao}
                            onChange={(event) => handleAtualizarQuestao(questao.id, "explicacao", event.target.value)}
                            placeholder="Observacao interna opcional"
                            className="w-full rounded-[12px] border border-slate-200 bg-white px-4 py-3 text-sm outline-none"
                          />
                        </label>

                        <div className="space-y-2">
                          <p className="text-xs font-medium uppercase tracking-[0.08em] text-slate-500">Alternativas</p>
                          {questao.alternativas.map((alternativa, alternativaIndex) => (
                            <div key={alternativa.id} className="flex items-center gap-3 rounded-[12px] border border-slate-200 bg-white px-3 py-3">
                              <button
                                type="button"
                                onClick={() => handleDefinirCorreta(questao.id, alternativa.id)}
                                className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full border ${
                                  alternativa.correta ? "border-[#0e5d77] bg-[#0e5d77]" : "border-slate-300 bg-white"
                                }`}
                                aria-label={`Definir alternativa ${alternativaIndex + 1} como correta`}
                              >
                                {alternativa.correta ? <span className="h-2 w-2 rounded-full bg-white" /> : null}
                              </button>

                              <input
                                value={alternativa.texto}
                                onChange={(event) =>
                                  handleAtualizarAlternativa(questao.id, alternativa.id, event.target.value)
                                }
                                placeholder={`Alternativa ${alternativaIndex + 1}`}
                                className="w-full bg-transparent text-sm outline-none"
                              />
                            </div>
                          ))}
                        </div>
                      </div>
                    ))}

                    <button
                      type="button"
                      onClick={handleAdicionarQuestao}
                      className="flex items-center gap-2 text-sm font-medium text-[#0e5d77]"
                    >
                      <SquarePen className="h-4 w-4" />
                      Adicionar questao
                    </button>
                  </div>
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

              {modoEdicao && aulaId ? (
                <button
                  type="button"
                  disabled={comentariosCount === 0}
                  onClick={() => router.push(`/admin/comentarios/aula/${aulaId}?modulo=${moduloId}`)}
                  className={`mx-auto flex items-center gap-2 text-sm font-medium ${
                    comentariosCount === 0 ? "text-slate-300" : "text-[#0e5d77]"
                  }`}
                >
                  <MessageSquare className="h-4 w-4" />
                  Ver Comentarios
                  {comentariosCount > 0 ? ` (${comentariosCount})` : ""}
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

          <button
            onClick={() => router.push(modulo?.turma_id ? `/admin/encontros?turma=${modulo.turma_id}` : "/admin/encontros")}
            className="flex flex-col items-center gap-1 text-slate-400"
          >
            <CalendarDays className="h-7 w-7 stroke-[1.8]" />
            <span className="text-[10px] font-medium">Encontros</span>
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

      <MobileDatePickerModal
        open={pickerAberto === "data-publicacao"}
        value={dataPublicacao ? parseDateInput(dataPublicacao) : new Date()}
        minDate={new Date()}
        onClose={() => setPickerAberto(null)}
        onConfirm={(value) => setDataPublicacao(formatDateObjectToInput(value))}
      />

      <MobileTimePickerModal
        open={pickerAberto === "hora-publicacao"}
        hour={horaPublicacao.slice(0, 2) || "21"}
        minute={horaPublicacao.slice(3, 5) || "00"}
        onClose={() => setPickerAberto(null)}
        onConfirm={(hour, minute) => setHoraPublicacao(`${hour}:${minute}`)}
      />

      <MobileDatePickerModal
        open={pickerAberto === "data-fechamento"}
        value={dataFechamento ? parseDateInput(dataFechamento) : (dataPublicacao ? parseDateInput(dataPublicacao) : new Date())}
        minDate={dataPublicacao ? parseDateInput(dataPublicacao) : new Date()}
        onClose={() => setPickerAberto(null)}
        onConfirm={(value) => setDataFechamento(formatDateObjectToInput(value))}
      />

      <MobileTimePickerModal
        open={pickerAberto === "hora-fechamento"}
        hour={horaFechamento.slice(0, 2) || "21"}
        minute={horaFechamento.slice(3, 5) || "00"}
        onClose={() => setPickerAberto(null)}
        onConfirm={(hour, minute) => setHoraFechamento(`${hour}:${minute}`)}
      />
    </main>
  );
}
