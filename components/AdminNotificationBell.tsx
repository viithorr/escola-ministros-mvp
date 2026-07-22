"use client";

import { Bell } from "lucide-react";
import { useRouter } from "next/navigation";

export default function AdminNotificationBell() {
  const router = useRouter();

  return (
    <button
      type="button"
      onClick={() => router.push("/admin/notificacoes")}
      className="relative flex h-11 w-11 items-center justify-center rounded-full bg-[#eef6fb] text-[#1c6a91] transition hover:bg-[#dfedf6]"
      aria-label="Gerenciar notificacoes"
    >
      <Bell className="h-5 w-5" strokeWidth={2.1} />
      <span className="absolute right-1.5 top-1.5 h-2 w-2 rounded-full bg-[#f59e0b] ring-2 ring-[#eef6fb]" />
    </button>
  );
}
