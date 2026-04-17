"use client";

import Image from "next/image";
import Link from "next/link";
import { useState } from "react";
import { supabase } from "@/lib/supabase";
import { getServiceUnavailableMessage, RequestTimeoutError, withTimeout } from "@/lib/network";

export default function RedefinirSenhaPage() {
  const [email, setEmail] = useState("");
  const [mensagem, setMensagem] = useState("");
  const [erro, setErro] = useState("");
  const [loading, setLoading] = useState(false);

  async function enviarLink() {
    const emailLimpo = email.trim().toLowerCase();

    setMensagem("");
    setErro("");

    if (!emailLimpo) {
      setErro("Digite seu email para receber o link de redefinicao.");
      return;
    }

    setLoading(true);

    try {
      const redirectTo =
        typeof window !== "undefined" ? `${window.location.origin}/redefinir-senha/nova` : undefined;

      const { error } = await withTimeout(
        supabase.auth.resetPasswordForEmail(emailLimpo, {
          redirectTo,
        }),
      );

      if (error) {
        setErro("Nao conseguimos enviar o link agora. Confira o email e tente novamente.");
        return;
      }

      setMensagem("Enviamos um link para redefinir sua senha. Confira sua caixa de entrada.");
    } catch (error) {
      setErro(error instanceof RequestTimeoutError ? getServiceUnavailableMessage() : getServiceUnavailableMessage());
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="min-h-screen bg-[#FFFEF4]">
      <section className="flex min-h-screen items-center justify-center px-5 py-12">
        <div className="w-full max-w-md">
          <Image
            src="/img/logo.svg"
            alt="Escola de Ministros"
            width={230}
            height={78}
            priority
            className="mx-auto mb-14 h-auto w-[210px] md:w-[230px]"
          />

          <div className="text-center">
            <h1 className="text-2xl font-bold text-[#111827]">Redefinir senha</h1>
            <p className="mt-2 text-sm text-[#5F6673]">
              Informe seu email e enviaremos um link para criar uma nova senha.
            </p>
          </div>

          <div className="mt-8">
            <label className="block text-sm font-semibold text-[#1F2937]">
              Email
              <input
                type="email"
                placeholder="email@dominio.com"
                className="mt-2 h-12 w-full rounded-xl border border-[#D8DCE3] bg-white px-4 text-[16px] text-[#303030] outline-none transition focus:border-[#194F68]"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
              />
            </label>
          </div>

          <button
            type="button"
            onClick={enviarLink}
            disabled={loading}
            className="mt-8 w-full rounded-xl bg-[#194F68] py-3 text-[16px] font-semibold text-white transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-70"
          >
            {loading ? "Enviando..." : "Enviar link"}
          </button>

          <Link
            href="/login"
            className="mt-5 block text-center text-sm font-semibold text-[#194F68] underline-offset-4 hover:underline"
          >
            Voltar para o login
          </Link>

          {mensagem ? (
            <p className="mt-5 rounded-xl bg-emerald-50 px-4 py-3 text-sm text-emerald-700">{mensagem}</p>
          ) : null}

          {erro ? <p className="mt-5 rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700">{erro}</p> : null}
        </div>
      </section>
    </main>
  );
}
