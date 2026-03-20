"use client";

import { createContext, useContext, useEffect, useState, ReactNode } from "react";
import { supabase } from "../lib/supabase";
import { User } from "@supabase/supabase-js";
import { getServiceUnavailableMessage, RequestTimeoutError, withTimeout } from "@/lib/network";
import { getUsuarioProfile, UsuarioProfile } from "@/lib/usuarios";

type AuthContextType = {
  user: User | null;
  profile: UsuarioProfile | null;
  profileError: string;
  loading: boolean;
  refreshProfile: () => Promise<void>;
};

const AuthContext = createContext<AuthContextType>({
  user: null,
  profile: null,
  profileError: "",
  loading: true,
  refreshProfile: async () => {},
});

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<UsuarioProfile | null>(null);
  const [profileError, setProfileError] = useState("");
  const [loading, setLoading] = useState(true);

  async function carregarProfile(usuarioAtual: User | null) {
    if (!usuarioAtual) {
      setProfile(null);
      setProfileError("");
      return;
    }

    try {
      const { profile: profileData, error } = await withTimeout(getUsuarioProfile(usuarioAtual));

      if (error || !profileData) {
        setProfile(null);
        setProfileError("Nao conseguimos carregar sua conta agora. Tente novamente em alguns instantes.");
        return;
      }

      setProfile(profileData);
      setProfileError("");
    } catch (error) {
      setProfile(null);
      setProfileError(
        error instanceof RequestTimeoutError
          ? getServiceUnavailableMessage()
          : getServiceUnavailableMessage(),
      );
    }
  }

  useEffect(() => {
    let ativo = true;

    async function sincronizarUsuario(usuarioAtual: User | null) {
      if (!ativo) return;

      setUser(usuarioAtual);

      if (!usuarioAtual) {
        setProfile(null);
        setProfileError("");
        return;
      }

      await carregarProfile(usuarioAtual);
    }

    async function getSession() {
      try {
        const { data } = await withTimeout(supabase.auth.getSession());
        await sincronizarUsuario(data.session?.user ?? null);
      } catch (error) {
        if (!ativo) return;

        setUser(null);
        setProfile(null);
        setProfileError(
          error instanceof RequestTimeoutError
            ? getServiceUnavailableMessage()
            : getServiceUnavailableMessage(),
        );
      } finally {
        if (ativo) {
          setLoading(false);
        }
      }
    }

    void getSession();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      void sincronizarUsuario(session?.user ?? null);
    });

    return () => {
      ativo = false;
      subscription.unsubscribe();
    };
  }, []);

  return (
    <AuthContext.Provider
      value={{
        user,
        profile,
        profileError,
        loading,
        refreshProfile: async () => {
          await carregarProfile(user);
        },
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
