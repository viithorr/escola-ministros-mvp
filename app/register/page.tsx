"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";

export default function RegisterPage() {
  const [email, setEmail] = useState("");
  const [senha, setSenha] = useState("");
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  async function handleRegister() {
    setLoading(true);

    const { data, error } = await supabase.auth.signUp({
      email: email.trim(),
      password: senha,
    });

    if (error) {
      alert("Erro: " + error.message);
      setLoading(false);
      return;
    }

    if (!data.session) {
      alert("Conta criada com sucesso! Agora faca login para continuar.");
      router.push("/login");
      setLoading(false);
      return;
    }

    alert("Conta criada com sucesso!");
    router.push("/dashboard");
    setLoading(false);
  }

  return (
    <main className="min-h-screen flex flex-col items-center justify-center gap-4">
      <h1 className="text-2xl font-bold">Criar conta</h1>

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
        onClick={handleRegister}
        disabled={loading}
        className="bg-black text-white px-4 py-2 rounded"
      >
        {loading ? "Criando..." : "Criar conta"}
      </button>
    </main>
  );
}
