"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Eye, EyeOff } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { getServiceUnavailableMessage, RequestTimeoutError, withTimeout } from "@/lib/network";

export default function NovaSenhaPage() {
  const [senha, setSenha] = useState("");
  const [confirmarSenha, setConfirmarSenha] = useState("");
  const [mostrarSenha, setMostrarSenha] = useState(false);
  const [mostrarConfirmacao, setMostrarConfirmacao] = useState(false);
  const [mensagem, setMensagem] = useState("");
  const [erro, setErro] = useState("");
  const [preparandoSessao, setPreparandoSessao] = useState(true);
  const [sessaoValida, setSessaoValida] = useState(false);
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  useEffect(() => {
    let ativo = true;

    async function prepararSessao() {
      setErro("");

      try {
        const params = new URLSearchParams(window.location.search);
        const code = params.get("code");

        if (code) {
          const { error } = await withTimeout(supabase.auth.exchangeCodeForSession(code));

          if (error) {
            if (!ativo) return;
            setSessaoValida(false);
            setErro("Este link de redefinicao expirou ou ja foi usado. Solicite um novo link.");
            return;
          }

          window.history.replaceState({}, document.title, window.location.pathname);
        }

        const { data } = await withTimeout(supabase.auth.getSession());

        if (!ativo) return;

        if (!data.session) {
          setSessaoValida(false);
          setErro("Nao encontramos uma sessao valida de redefinicao. Solicite um novo link.");
          return;
        }

        setSessaoValida(true);
      } catch (error) {
        if (!ativo) return;
        setSessaoValida(false);
        setErro(error instanceof RequestTimeoutError ? getServiceUnavailableMessage() : getServiceUnavailableMessage());
      } finally {
        if (ativo) {
          setPreparandoSessao(false);
        }
      }
    }

    void prepararSessao();

    return () => {
      ativo = false;
    };
  }, []);

  async function salvarSenha() {
    setMensagem("");
    setErro("");

    if (senha.length < 6) {
      setErro("A nova senha precisa ter pelo menos 6 caracteres.");
      return;
    }

    if (senha !== confirmarSenha) {
      setErro("As senhas nao conferem.");
      return;
    }

    setLoading(true);

    try {
      const { error } = await withTimeout(
        supabase.auth.updateUser({
          password: senha,
        }),
      );

      if (error) {
        setErro("Nao conseguimos atualizar sua senha agora. Solicite um novo link e tente novamente.");
        return;
      }

      setMensagem("Senha redefinida com sucesso. Voce sera direcionado para o login.");
      await withTimeout(supabase.auth.signOut());

      window.setTimeout(() => {
        router.push("/login");
      }, 1200);
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
            <h1 className="text-2xl font-bold text-[#111827]">Criar nova senha</h1>
            <p className="mt-2 text-sm text-[#5F6673]">Digite uma nova senha para acessar sua conta.</p>
          </div>

          {preparandoSessao ? (
            <div className="mt-8 rounded-2xl bg-white px-4 py-6 text-center text-sm text-[#5F6673] shadow-sm">
              Carregando...
            </div>
          ) : null}

          {!preparandoSessao && sessaoValida ? (
            <>
              <div className="mt-8 space-y-4">
                <label className="block text-sm font-semibold text-[#1F2937]">
                  Nova senha
                  <div className="relative mt-2">
                    <input
                      type={mostrarSenha ? "text" : "password"}
                      placeholder="digite sua nova senha"
                      className="h-12 w-full rounded-xl border border-[#D8DCE3] bg-white px-4 pr-12 text-[16px] text-[#303030] outline-none transition focus:border-[#194F68]"
                      value={senha}
                      onChange={(event) => setSenha(event.target.value)}
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

                <label className="block text-sm font-semibold text-[#1F2937]">
                  Confirmar senha
                  <div className="relative mt-2">
                    <input
                      type={mostrarConfirmacao ? "text" : "password"}
                      placeholder="confirme sua nova senha"
                      className="h-12 w-full rounded-xl border border-[#D8DCE3] bg-white px-4 pr-12 text-[16px] text-[#303030] outline-none transition focus:border-[#194F68]"
                      value={confirmarSenha}
                      onChange={(event) => setConfirmarSenha(event.target.value)}
                    />
                    <button
                      type="button"
                      onClick={() => setMostrarConfirmacao((valor) => !valor)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-[#5f5f5f]"
                      aria-label={mostrarConfirmacao ? "Ocultar senha" : "Mostrar senha"}
                    >
                      {mostrarConfirmacao ? <EyeOff size={20} /> : <Eye size={20} />}
                    </button>
                  </div>
                </label>
              </div>

              <button
                type="button"
                onClick={salvarSenha}
                disabled={loading}
                className="mt-8 w-full rounded-xl bg-[#194F68] py-3 text-[16px] font-semibold text-white transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-70"
              >
                {loading ? "Salvando..." : "Salvar nova senha"}
              </button>
            </>
          ) : null}

          {!preparandoSessao && !sessaoValida ? (
            <Link
              href="/redefinir-senha"
              className="mt-8 block rounded-xl bg-[#194F68] py-3 text-center text-[16px] font-semibold text-white transition hover:opacity-90"
            >
              Solicitar novo link
            </Link>
          ) : null}

          {mensagem ? (
            <p className="mt-5 rounded-xl bg-emerald-50 px-4 py-3 text-sm text-emerald-700">{mensagem}</p>
          ) : null}

          {erro ? <p className="mt-5 rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700">{erro}</p> : null}
        </div>
      </section>
    </main>
  );
}
