import { NextRequest } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase-admin";

export async function autenticarRequest(request: NextRequest) {
  const authorization = request.headers.get("authorization");
  const token = authorization?.startsWith("Bearer ") ? authorization.slice(7) : null;

  if (!token) {
    return { usuario: null, role: null, error: "Sessao nao informada." };
  }

  const supabaseAdmin = getSupabaseAdmin();
  const { data, error } = await supabaseAdmin.auth.getUser(token);

  if (error || !data.user) {
    return { usuario: null, role: null, error: "Sessao invalida ou expirada." };
  }

  const { data: profile, error: profileError } = await supabaseAdmin
    .from("usuarios")
    .select("role")
    .eq("id", data.user.id)
    .maybeSingle<{ role: string | null }>();

  if (profileError || !profile) {
    return { usuario: null, role: null, error: "Perfil nao encontrado." };
  }

  return { usuario: data.user, role: profile.role, error: null };
}
export async function autenticarAdmin(request: NextRequest) {
  const autenticacao = await autenticarRequest(request);

  if (autenticacao.error) return autenticacao;

  if (autenticacao.role !== "admin") {
    return { ...autenticacao, error: "Acesso permitido apenas para administradores." };
  }

  return autenticacao;
}
