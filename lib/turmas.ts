import { supabase } from "@/lib/supabase";

export type CategoriaTurma = "instrumental" | "vocal";

export type TurmaAdmin = {
  id: string;
  nome: string;
  categoria: CategoriaTurma | null;
  capa_url: string | null;
  codigo_entrada: string;
  arquivada: boolean;
  arquivada_em: string | null;
  created_at: string;
};

function gerarCodigoTurma() {
  const letras = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
  const numeros = "0123456789";

  let codigo = "";

  for (let index = 0; index < 3; index += 1) {
    codigo += letras[Math.floor(Math.random() * letras.length)];
  }

  for (let index = 0; index < 3; index += 1) {
    codigo += numeros[Math.floor(Math.random() * numeros.length)];
  }

  return codigo;
}

export async function gerarCodigoTurmaUnico() {
  for (let tentativa = 0; tentativa < 10; tentativa += 1) {
    const codigo = gerarCodigoTurma();

    const { data, error } = await supabase
      .from("turmas")
      .select("id")
      .eq("codigo_entrada", codigo)
      .maybeSingle<{ id: string }>();

    if (error) {
      return { codigo: null, error };
    }

    if (!data) {
      return { codigo, error: null };
    }
  }

  return {
    codigo: null,
    error: new Error("Nao foi possivel gerar um codigo unico para a turma."),
  };
}

export async function uploadCapaTurma(file: File) {
  const extensao = file.name.split(".").pop()?.toLowerCase() || "jpg";
  const nomeArquivo = `${Date.now()}-${crypto.randomUUID()}.${extensao}`;
  const caminho = `turmas/${nomeArquivo}`;

  const { error } = await supabase.storage.from("class-covers").upload(caminho, file, {
    upsert: false,
  });

  if (error) {
    return { capaUrl: null, error };
  }

  const { data } = supabase.storage.from("class-covers").getPublicUrl(caminho);

  return { capaUrl: data.publicUrl, error: null };
}

export async function listarTurmas() {
  const { data, error } = await supabase
    .from("turmas")
    .select("id, nome, categoria, capa_url, codigo_entrada, arquivada, arquivada_em, created_at")
    .order("created_at", { ascending: false });

  return { turmas: (data as TurmaAdmin[] | null) ?? [], error };
}

export async function getTurmaById(turmaId: string) {
  const { data, error } = await supabase
    .from("turmas")
    .select("id, nome, categoria, capa_url, codigo_entrada, arquivada, arquivada_em, created_at")
    .eq("id", turmaId)
    .maybeSingle<TurmaAdmin>();

  return { turma: data, error };
}

export async function atualizarNomeTurma(turmaId: string, nome: string) {
  const { data, error } = await supabase
    .from("turmas")
    .update({
      nome: nome.trim(),
    })
    .eq("id", turmaId)
    .select("id, nome, categoria, capa_url, codigo_entrada, arquivada, arquivada_em, created_at")
    .single<TurmaAdmin>();

  return { turma: data, error };
}

export async function atualizarCapaTurma(turmaId: string, file: File) {
  const { capaUrl, error: uploadError } = await uploadCapaTurma(file);

  if (uploadError || !capaUrl) {
    return { turma: null, error: uploadError ?? new Error("Nao foi possivel enviar a capa.") };
  }

  const { data, error } = await supabase
    .from("turmas")
    .update({
      capa_url: capaUrl,
    })
    .eq("id", turmaId)
    .select("id, nome, categoria, capa_url, codigo_entrada, arquivada, arquivada_em, created_at")
    .single<TurmaAdmin>();

  return { turma: data, error };
}
