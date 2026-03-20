"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { getServiceUnavailableMessage, RequestTimeoutError, withTimeout } from "@/lib/network";
import { getUsuarioProfile, isValidUserRole } from "@/lib/usuarios";

const accessErrorMessage =
  "Nao conseguimos carregar sua conta agora. Tente novamente em alguns instantes.";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [senha, setSenha] = useState("");
  const [mensagem, setMensagem] = useState("");
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  async function handleLogin() {
    setLoading(true);
    setMensagem("");

    try {
      const { data, error } = await withTimeout(
        supabase.auth.signInWithPassword({
          email: email.trim(),
          password: senha,
        }),
      );

      if (error) {
        setMensagem("Email ou senha invalidos.");
        return;
      }

      const user = data.user;

      if (!user) {
        setMensagem(accessErrorMessage);
        return;
      }

      const { profile, error: profileError } = await withTimeout(getUsuarioProfile(user));

      if (profileError || !profile) {
        setMensagem(`${accessErrorMessage} Se o problema continuar, fale com o administrador.`);
        return;
      }

      if (!isValidUserRole(profile.role)) {
        setMensagem("Nao conseguimos liberar seu acesso agora. Fale com o administrador.");
        return;
      }

      if (profile.role === "admin") {
        router.push("/admin");
        return;
      }

      router.push("/dashboard");
    } catch (error) {
      if (error instanceof RequestTimeoutError) {
        setMensagem(getServiceUnavailableMessage());
        return;
      }

      setMensagem(getServiceUnavailableMessage());
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="min-h-screen flex flex-col items-center justify-center gap-4">
      <h1 className="text-2xl font-bold">Login</h1>

      <input
        type="email"
        placeholder="Email"
        className="border p-2 rounded w-64"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
      />

      <input
        type="password"
        placeholder="Senha"
        className="border p-2 rounded w-64"
        value={senha}
        onChange={(e) => setSenha(e.target.value)}
      />

      <button
        onClick={handleLogin}
        disabled={loading}
        className="bg-black text-white px-4 py-2 rounded"
      >
        {loading ? "Entrando..." : "Entrar"}
      </button>

      {mensagem ? <p className="text-sm text-red-600 text-center max-w-xs">{mensagem}</p> : null}
    </main>
  );
}
