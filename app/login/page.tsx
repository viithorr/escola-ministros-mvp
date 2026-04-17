"use client";

import Image from "next/image";
import Link from "next/link";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Eye, EyeOff } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { getServiceUnavailableMessage, RequestTimeoutError, withTimeout } from "@/lib/network";
import { getUsuarioProfile, isValidUserRole } from "@/lib/usuarios";

const accessErrorMessage =
  "Nao conseguimos carregar sua conta agora. Tente novamente em alguns instantes.";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [senha, setSenha] = useState("");
  const [mostrarSenha, setMostrarSenha] = useState(false);
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
    <main className="min-h-screen">
      <section className="relative flex min-h-screen flex-col justify-center overflow-hidden px-5 py-16 md:hidden">
        <Image
          src="/img/backgroud-login-mobile.svg"
          alt=""
          fill
          priority
          className="object-cover"
        />

        <div className="relative z-10 mx-auto flex w-full max-w-sm flex-col">
          <Image
            src="/img/logo-colorida.svg"
            alt="Escola de Ministros"
            width={250}
            height={84}
            priority
            className="mx-auto mb-12 h-auto w-[250px]"
          />

          <div className="space-y-4">
            <label className="block text-sm font-medium text-white">
              Email
              <input
                type="email"
                placeholder="email@dominio.com"
                className="mt-2 h-12 w-full rounded-[10px] border-0 bg-white px-4 text-[17px] text-[#303030] outline-none"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </label>

            <label className="block text-sm font-medium text-white">
              Senha
              <div className="relative mt-2">
                <input
                  type={mostrarSenha ? "text" : "password"}
                  placeholder="digite sua senha"
                  className="h-12 w-full rounded-[10px] border-0 bg-white px-4 pr-12 text-[17px] text-[#303030] outline-none"
                  value={senha}
                  onChange={(e) => setSenha(e.target.value)}
                />
                <button
                  type="button"
                  onClick={() => setMostrarSenha((valor) => !valor)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-[#5f5f5f]"
                  aria-label={mostrarSenha ? "Ocultar senha" : "Mostrar senha"}
                >
                  {mostrarSenha ? <EyeOff size={20} /> : <Eye size={20} />}
                </button>
              </div>
            </label>
          </div>

          <button
            onClick={handleLogin}
            disabled={loading}
            className="mt-8 rounded-[10px] bg-black py-3 text-[17px] font-medium text-white transition hover:opacity-90"
          >
            {loading ? "Entrando..." : "Entrar"}
          </button>

          <Link
            href="/redefinir-senha"
            className="mt-4 text-center text-sm font-medium text-white/90 underline-offset-4 hover:underline"
          >
            Redefinir senha
          </Link>

          {mensagem ? <p className="mt-4 text-sm text-red-200">{mensagem}</p> : null}
        </div>
      </section>

      <section className="hidden min-h-screen items-center justify-center bg-slate-100 px-6 md:flex">
        <div className="w-full max-w-md rounded-3xl bg-white p-10 shadow-sm">
          <Image
            src="/img/logo.svg"
            alt="Escola de Ministros"
            width={260}
            height={88}
            className="mx-auto mb-8 h-auto w-[260px]"
          />

          <div className="space-y-4">
            <label className="block text-sm font-medium text-slate-700">
              Email
              <input
                type="email"
                placeholder="email@dominio.com"
                className="mt-2 h-12 w-full rounded-xl border border-slate-200 px-4 text-[16px] text-[#303030] outline-none transition focus:border-slate-400"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </label>

            <label className="block text-sm font-medium text-slate-700">
              Senha
              <div className="relative mt-2">
                <input
                  type={mostrarSenha ? "text" : "password"}
                  placeholder="digite sua senha"
                  className="h-12 w-full rounded-xl border border-slate-200 px-4 pr-12 text-[16px] text-[#303030] outline-none transition focus:border-slate-400"
                  value={senha}
                  onChange={(e) => setSenha(e.target.value)}
                />
                <button
                  type="button"
                  onClick={() => setMostrarSenha((valor) => !valor)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-[#5f5f5f]"
                  aria-label={mostrarSenha ? "Ocultar senha" : "Mostrar senha"}
                >
                  {mostrarSenha ? <EyeOff size={20} /> : <Eye size={20} />}
                </button>
              </div>
            </label>
          </div>

          <button
            onClick={handleLogin}
            disabled={loading}
            className="mt-8 w-full rounded-xl bg-black py-3 text-[17px] font-medium text-white transition hover:opacity-90"
          >
            {loading ? "Entrando..." : "Entrar"}
          </button>

          <Link
            href="/redefinir-senha"
            className="mt-4 block text-center text-sm font-medium text-slate-600 underline-offset-4 hover:text-slate-950 hover:underline"
          >
            Redefinir senha
          </Link>

          {mensagem ? <p className="mt-4 text-sm text-red-600">{mensagem}</p> : null}
        </div>
      </section>
    </main>
  );
}
