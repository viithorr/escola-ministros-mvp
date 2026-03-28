"use client";

import Image from "next/image";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Eye, EyeOff } from "lucide-react";
import { supabase } from "@/lib/supabase";

const buttonColor = "#194F68";
const backgroundColor = "#FFFEF4";
const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export default function RegisterPage() {
  const [nome, setNome] = useState("");
  const [email, setEmail] = useState("");
  const [senha, setSenha] = useState("");
  const [confirmarSenha, setConfirmarSenha] = useState("");
  const [mostrarSenha, setMostrarSenha] = useState(false);
  const [mostrarConfirmacao, setMostrarConfirmacao] = useState(false);
  const [mensagem, setMensagem] = useState("");
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  async function handleRegister() {
    setLoading(true);
    setMensagem("");

    const nomeLimpo = nome.trim();
    const emailLimpo = email.trim();

    if (!nomeLimpo) {
      setMensagem("Digite seu nome completo para continuar.");
      setLoading(false);
      return;
    }

    if (!emailLimpo) {
      setMensagem("Digite seu email para continuar.");
      setLoading(false);
      return;
    }

    if (!emailPattern.test(emailLimpo)) {
      setMensagem("Digite um email valido, como nome@dominio.com.");
      setLoading(false);
      return;
    }

    if (!senha) {
      setMensagem("Digite uma senha para continuar.");
      setLoading(false);
      return;
    }

    if (senha !== confirmarSenha) {
      setMensagem("As senhas nao coincidem.");
      setLoading(false);
      return;
    }

    const { data, error } = await supabase.auth.signUp({
      email: emailLimpo,
      password: senha,
    });

    if (error) {
      const mensagemErro =
        error.message.toLowerCase().includes("already registered") ||
        error.message.toLowerCase().includes("already been registered") ||
        error.message.toLowerCase().includes("user already registered")
          ? "Este email ja esta cadastrado. Tente entrar ou use outro email."
          : `Erro: ${error.message}`;

      setMensagem(mensagemErro);
      setLoading(false);
      return;
    }

    const user = data.user;

    if (user) {
      const { error: profileError } = await supabase.from("usuarios").upsert(
        {
          id: user.id,
          nome: nomeLimpo,
          email: user.email ?? emailLimpo,
          role: "aluno",
        },
        {
          onConflict: "id",
        },
      );

      if (profileError) {
        setMensagem("Conta criada, mas nao foi possivel salvar seu perfil agora. Tente entrar novamente.");
        setLoading(false);
        return;
      }
    }

    if (!data.session) {
      setMensagem("Conta criada com sucesso! Agora faca login para continuar.");
      setTimeout(() => {
        router.push("/login");
      }, 1200);
      setLoading(false);
      return;
    }

    router.push("/entrar-turma");
    setLoading(false);
  }

  return (
    <main
      className="flex min-h-screen items-center justify-center px-5 py-12"
      style={{ backgroundColor }}
    >
      <div className="flex w-full max-w-sm flex-col items-center text-center">
        <Image
          src="/img/logo.svg"
          alt="Escola de Ministros"
          width={240}
          height={74}
          priority
          className="mx-auto mb-14 h-auto w-[240px]"
        />

        <h1 className="mb-2 text-[2rem] font-semibold leading-none text-[#1f1f1f]">Criar uma conta</h1>
        <p className="mb-10 text-sm text-[#4d4d4d]">Crie sua conta para acessar as aulas.</p>

        <div className="w-full space-y-4 text-left">
          <label className="block text-sm font-medium text-[#303030]">
            Nome Completo
            <input
              type="text"
              placeholder="Digite seu nome"
              className="mt-2 h-12 w-full rounded-[10px] border border-[#e7e3d8] bg-white px-4 text-[16px] text-[#303030] outline-none"
              value={nome}
              onChange={(e) => setNome(e.target.value)}
            />
          </label>

          <label className="block text-sm font-medium text-[#303030]">
            Email
            <input
              type="email"
              placeholder="email@dominio.com"
              className="mt-2 h-12 w-full rounded-[10px] border border-[#e7e3d8] bg-white px-4 text-[16px] text-[#303030] outline-none"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </label>

          <label className="block text-sm font-medium text-[#303030]">
            Senha
            <div className="relative mt-2">
              <input
                type={mostrarSenha ? "text" : "password"}
                placeholder="digite sua senha"
                className="h-12 w-full rounded-[10px] border border-[#e7e3d8] bg-white px-4 pr-12 text-[16px] text-[#303030] outline-none"
                value={senha}
                onChange={(e) => setSenha(e.target.value)}
              />
              <button
                type="button"
                onClick={() => setMostrarSenha((valor) => !valor)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-[#5f5f5f]"
                aria-label={mostrarSenha ? "Ocultar senha" : "Mostrar senha"}
              >
                {mostrarSenha ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            </div>
          </label>

          <label className="block text-sm font-medium text-[#303030]">
            Confirmar sua Senha
            <div className="relative mt-2">
              <input
                type={mostrarConfirmacao ? "text" : "password"}
                placeholder="digite sua senha"
                className="h-12 w-full rounded-[10px] border border-[#e7e3d8] bg-white px-4 pr-12 text-[16px] text-[#303030] outline-none"
                value={confirmarSenha}
                onChange={(e) => setConfirmarSenha(e.target.value)}
              />
              <button
                type="button"
                onClick={() => setMostrarConfirmacao((valor) => !valor)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-[#5f5f5f]"
                aria-label={mostrarConfirmacao ? "Ocultar confirmacao de senha" : "Mostrar confirmacao de senha"}
              >
                {mostrarConfirmacao ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            </div>
          </label>
        </div>

        <button
          onClick={handleRegister}
          disabled={loading}
          className="mt-8 w-full rounded-[10px] py-3 text-[17px] font-medium text-white transition hover:opacity-90"
          style={{ backgroundColor: buttonColor }}
        >
          {loading ? "Continuando..." : "Continuar"}
        </button>

        {mensagem ? <p className="mt-4 w-full text-left text-sm text-[#a63b32]">{mensagem}</p> : null}
      </div>
    </main>
  );
}
