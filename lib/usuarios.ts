import { User } from "@supabase/supabase-js";
import { supabase } from "@/lib/supabase";

export type UserRole = "admin" | "aluno";

export type UsuarioProfile = {
  id: string;
  nome: string | null;
  email: string;
  role: string | null;
  foto_url: string | null;
  dias_estudo: string[] | null;
  horario_estudo: string | null;
  onboarding_concluido: boolean;
};

export function isValidUserRole(role: string | null): role is UserRole {
  return role === "admin" || role === "aluno";
}

export async function getUsuarioProfile(user: User) {
  const { data: profile, error } = await supabase
    .from("usuarios")
    .select("id, nome, email, role, foto_url, dias_estudo, horario_estudo, onboarding_concluido")
    .eq("id", user.id)
    .maybeSingle<UsuarioProfile>();

  return { profile, error };
}

export async function atualizarOnboardingAluno(
  usuarioId: string,
  payload: {
    dias_estudo: string[];
    horario_estudo: string | null;
  },
) {
  const { data, error } = await supabase
    .from("usuarios")
    .update({
      dias_estudo: payload.dias_estudo,
      horario_estudo: payload.horario_estudo,
      onboarding_concluido: true,
    })
    .eq("id", usuarioId)
    .select("id, nome, email, role, foto_url, dias_estudo, horario_estudo, onboarding_concluido")
    .single<UsuarioProfile>();

  return { profile: data, error };
}

export async function atualizarContaAluno(
  usuarioId: string,
  payload: {
    nome: string;
    dias_estudo: string[];
    horario_estudo: string | null;
  },
) {
  const { data, error } = await supabase
    .from("usuarios")
    .update({
      nome: payload.nome.trim(),
      dias_estudo: payload.dias_estudo,
      horario_estudo: payload.horario_estudo,
    })
    .eq("id", usuarioId)
    .select("id, nome, email, role, foto_url, dias_estudo, horario_estudo, onboarding_concluido")
    .single<UsuarioProfile>();

  return { profile: data, error };
}

export async function atualizarFotoPerfil(usuarioId: string, fotoUrl: string | null) {
  const { data, error } = await supabase
    .from("usuarios")
    .update({
      foto_url: fotoUrl,
    })
    .eq("id", usuarioId)
    .select("id, nome, email, role, foto_url, dias_estudo, horario_estudo, onboarding_concluido")
    .single<UsuarioProfile>();

  return { profile: data, error };
}
