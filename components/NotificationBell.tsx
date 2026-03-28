"use client";

import { useEffect, useState } from "react";
import { Bell } from "lucide-react";
import { useRouter } from "next/navigation";
import { contarNotificacoesNaoVisualizadas } from "@/lib/notificacoes";

type NotificationBellProps = {
  userId: string | null | undefined;
};

export default function NotificationBell({ userId }: NotificationBellProps) {
  const router = useRouter();
  const [total, setTotal] = useState(0);

  useEffect(() => {
    if (!userId) return;

    let ativo = true;

    async function carregarTotal() {
      const { total: totalNaoLidas } = await contarNotificacoesNaoVisualizadas(userId);
      if (!ativo) return;
      setTotal(totalNaoLidas);
    }

    void carregarTotal();

    return () => {
      ativo = false;
    };
  }, [userId]);

  return (
    <button
      type="button"
      onClick={() => router.push("/notificacoes")}
      className="relative flex h-11 w-11 items-center justify-center rounded-full bg-slate-100 text-slate-700"
      aria-label="Abrir notificacoes"
    >
      <Bell className="h-5 w-5" strokeWidth={2.1} />
      {userId && total > 0 ? (
        <span className="absolute -right-1 -top-1 flex min-h-5 min-w-5 items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-semibold text-white">
          {total > 9 ? "+9" : total}
        </span>
      ) : null}
    </button>
  );
}
