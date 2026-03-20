import { supabase } from "@/lib/supabase";

export type Matricula = {
  turma_id: string;
};

export async function getMatriculasDoAluno(usuarioId: string) {
  const { data, error } = await supabase
    .from("alunos_turma")
    .select("turma_id")
    .eq("usuario_id", usuarioId)
    .limit(2);

  return { matriculas: data ?? [], error };
}
