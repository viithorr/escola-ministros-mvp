"use client";

import { Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import AppLoader from "@/components/AppLoader";
import { useAuth } from "@/contexts/AuthContext";
import { getServiceUnavailableMessage, RequestTimeoutError, withTimeout } from "@/lib/network";
import { supabase } from "@/lib/supabase";
import { isValidUserRole } from "@/lib/usuarios";
import { getMatriculasDoAluno } from "@/lib/matriculas";

function EntrarTurmaContent() {
  const { user, profile, profileError, loading: authLoading } = useAuth();
  const [codigo, setCodigo] = useState("");
  const [mensagem, setMensagem] = useState("");
  const [loading, setLoading] = useState(false);
  const [checkingAccess, setCheckingAccess] = useState(true);
  const router = useRouter();
  const searchParams = useSearchParams();

  useEffect(() => {
    async function verificarAcesso() {
      if (authLoading) return;

      if (!user) {
        router.push("/login");
        return;
      }

      if (!profile) {
        setMensagem(profileError || "Nao conseguimos carregar sua conta agora. Tente novamente em alguns instantes.");
        setCheckingAccess(false);
        return;
      }

      if (!isValidUserRole(profile.role)) {
        setMensagem("Nao conseguimos liberar seu acesso agora. Fale com o administrador.");
        setCheckingAccess(false);
        return;
      }

      if (profile.role === "admin") {
        router.push("/admin");
        return;
      }

      try {
        const { matriculas, error: matriculaError } = await withTimeout(getMatriculasDoAluno(user.id));

        if (matriculaError) {
          setMensagem("Nao conseguimos verificar sua turma agora. Tente novamente em alguns instantes.");
          setCheckingAccess(false);
          return;
        }

        if (matriculas.length > 1) {
          setMensagem("Encontramos mais de uma turma vinculada ao seu acesso. Fale com o administrador.");
          setCheckingAccess(false);
          return;
        }

        if (matriculas[0]?.turma_id) {
          if (matriculas[0].acesso_bloqueado) {
            router.push("/dashboard");
            return;
          }

          if (profile.onboarding_concluido) {
            router.push("/dashboard");
            return;
          }

          router.push("/boas-vindas");
          return;
        }

        setCheckingAccess(false);
      } catch (error) {
        if (error instanceof RequestTimeoutError) {
          setMensagem(getServiceUnavailableMessage());
        } else {
          setMensagem(getServiceUnavailableMessage());
        }
        setCheckingAccess(false);
      }
    }

    void verificarAcesso();
  }, [user, profile, profileError, authLoading, router]);

  async function entrarNaTurma() {
    if (!user) {
      setMensagem("Usuario nao autenticado.");
      return;
    }

    setLoading(true);
    setMensagem("");

    if (!codigo.trim()) {
      setMensagem("Digite o codigo da sua turma.");
      setLoading(false);
      return;
    }

    try {
      const { data: turma, error } = await withTimeout(
        supabase
          .from("turmas")
          .select("*")
          .eq("codigo_entrada", codigo.trim().toUpperCase())
          .single(),
      );

      if (error || !turma) {
        setMensagem("Codigo invalido. Confira e tente novamente.");
        setLoading(false);
        return;
      }

      if (turma.arquivada) {
        setMensagem("Esta turma esta arquivada no momento e nao aceita novos acessos.");
        setLoading(false);
        return;
      }

      const { matriculas, error: matriculaError } = await withTimeout(getMatriculasDoAluno(user.id));

      if (matriculaError) {
        setMensagem("Nao conseguimos verificar sua turma agora. Tente novamente em alguns instantes.");
        setLoading(false);
        return;
      }

      if (matriculas.length > 1) {
        setMensagem("Encontramos mais de uma turma vinculada ao seu acesso. Fale com o administrador.");
        setLoading(false);
        return;
      }

      const matriculaAtual = matriculas[0];

      if (matriculaAtual?.turma_id === turma.id) {
        setLoading(false);
        router.push("/dashboard");
        return;
      }

      if (matriculaAtual?.turma_id) {
        setMensagem("Voce ja esta matriculado em uma turma.");
        setLoading(false);
        return;
      }

      const { error: erroInsert } = await withTimeout(
        supabase.from("alunos_turma").insert({
          usuario_id: user.id,
          turma_id: turma.id,
          data_entrada: new Date().toISOString(),
        }),
      );

      if (erroInsert) {
        setMensagem("Nao foi possivel entrar na turma agora. Tente novamente.");
        console.error(erroInsert);
        setLoading(false);
        return;
      }

      if (profile?.onboarding_concluido) {
        router.push("/dashboard");
        return;
      }

      router.push("/boas-vindas");
    } catch (error) {
      if (error instanceof RequestTimeoutError) {
        setMensagem(getServiceUnavailableMessage());
      } else {
        setMensagem(getServiceUnavailableMessage());
      }
      setLoading(false);
    }
  }

  if (authLoading || checkingAccess) {
    return <AppLoader />;
  }

  const veioSemTurma = searchParams.get("origem") === "sem-turma";

  return (
    <main className="min-h-screen flex items-center justify-center px-6">
      <div className="w-full max-w-sm flex flex-col gap-4">
        <div className="text-center space-y-2">
          <h1 className="text-2xl font-bold">Liberar acesso</h1>
          <p className="text-sm text-gray-600">
            Para continuar, informe o codigo da sua turma enviado pelo administrador.
          </p>
          {veioSemTurma ? (
            <p className="text-sm text-amber-700">
              Seu acesso sera liberado apos a confirmacao do codigo da turma.
            </p>
          ) : null}
        </div>

        <input
          value={codigo}
          onChange={(e) => setCodigo(e.target.value.toUpperCase())}
          placeholder="Codigo da turma"
          className="border p-2 rounded"
          maxLength={12}
        />

        <button
          onClick={entrarNaTurma}
          disabled={loading}
          className="bg-black text-white p-2 rounded"
        >
          {loading ? "Confirmando..." : "Liberar meu acesso"}
        </button>

        {mensagem ? <p className="text-sm text-center text-red-600">{mensagem}</p> : null}
      </div>
    </main>
  );
}

export default function EntrarTurmaPage() {
  return (
    <Suspense fallback={<AppLoader />}>
      <EntrarTurmaContent />
    </Suspense>
  );
}
