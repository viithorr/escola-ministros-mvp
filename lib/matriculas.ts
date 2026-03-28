import { supabase } from "@/lib/supabase";

export type Matricula = {
  turma_id: string;
  acesso_bloqueado: boolean;
};

export async function getMatriculasDoAluno(usuarioId: string) {
  const { data, error } = await supabase
    .from("alunos_turma")
    .select("turma_id, acesso_bloqueado")
    .eq("usuario_id", usuarioId)
    .limit(2);

  return { matriculas: data ?? [], error };
}
