import { supabase } from "@/lib/supabase";

export type AutorComentario = {
  id: string;
  nome: string | null;
  email: string;
  foto_url: string | null;
};

export type ComentarioAula = {
  id: string;
  aula_id: string;
  usuario_id: string;
  comentario: string;
  comentario_pai_id: string | null;
  criado_em: string;
  excluido: boolean;
  autor: AutorComentario | null;
  respostas: ComentarioAula[];
};

type ComentarioAulaRow = {
  id: string;
  aula_id: string;
  usuario_id: string;
  comentario: string;
  comentario_pai_id: string | null;
  criado_em: string;
  excluido: boolean;
  usuarios:
    | {
        id: string;
        nome: string | null;
        email: string;
        foto_url: string | null;
      }
    | {
        id: string;
        nome: string | null;
        email: string;
        foto_url: string | null;
      }[]
    | null;
};

function normalizarAutor(usuario: ComentarioAulaRow["usuarios"]): AutorComentario | null {
  const autor = Array.isArray(usuario) ? usuario[0] ?? null : usuario;

  if (!autor) {
    return null;
  }

  return {
    id: autor.id,
    nome: autor.nome,
    email: autor.email,
    foto_url: autor.foto_url,
  };
}

function montarArvoreComentarios(rows: ComentarioAulaRow[]) {
  const map = new Map<string, ComentarioAula>();

  rows.forEach((row) => {
    map.set(row.id, {
      id: row.id,
      aula_id: row.aula_id,
      usuario_id: row.usuario_id,
      comentario: row.comentario,
      comentario_pai_id: row.comentario_pai_id,
      criado_em: row.criado_em,
      excluido: row.excluido,
      autor: normalizarAutor(row.usuarios),
      respostas: [],
    });
  });

  const comentariosRaiz: ComentarioAula[] = [];

  map.forEach((comentario) => {
    if (comentario.comentario_pai_id) {
      const pai = map.get(comentario.comentario_pai_id);
      if (pai) {
        pai.respostas.push(comentario);
        return;
      }
    }

    comentariosRaiz.push(comentario);
  });

  return comentariosRaiz;
}

export async function listarComentariosDaAula(aulaId: string) {
  const { data, error } = await supabase
    .from("comentarios_aula")
    .select(
      `
      id,
      aula_id,
      usuario_id,
      comentario,
      comentario_pai_id,
      criado_em,
      excluido,
      usuarios:usuario_id (
        id,
        nome,
        email,
        foto_url
      )
    `,
    )
    .eq("aula_id", aulaId)
    .eq("excluido", false)
    .order("criado_em", { ascending: true });

  if (error) {
    return { comentarios: [] as ComentarioAula[], error };
  }

  return { comentarios: montarArvoreComentarios((data as ComentarioAulaRow[] | null) ?? []), error: null };
}

export async function contarComentariosDaAula(aulaId: string) {
  const { count, error } = await supabase
    .from("comentarios_aula")
    .select("id", { count: "exact", head: true })
    .eq("aula_id", aulaId)
    .eq("excluido", false)
    .is("comentario_pai_id", null);

  return { total: count ?? 0, error };
}

export async function criarComentarioDaAula(
  aulaId: string,
  usuarioId: string,
  comentario: string,
  comentarioPaiId?: string | null,
) {
  const { data, error } = await supabase
    .from("comentarios_aula")
    .insert({
      aula_id: aulaId,
      usuario_id: usuarioId,
      comentario: comentario.trim(),
      comentario_pai_id: comentarioPaiId ?? null,
    })
    .select("id")
    .maybeSingle<{ id: string }>();

  return { comentarioId: data?.id ?? null, error };
}

export async function excluirComentarioDaAula(comentarioId: string) {
  const { error } = await supabase
    .from("comentarios_aula")
    .update({
      excluido: true,
    })
    .or(`id.eq.${comentarioId},comentario_pai_id.eq.${comentarioId}`);

  return { error };
}
