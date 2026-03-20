import Link from "next/link";

export default function Home() {
  return (
    <main className="min-h-screen flex flex-col items-center justify-center gap-6">
      
      <h1 className="text-3xl font-bold">
        Escola de Ministros
      </h1>

      <p className="text-gray-500 text-center max-w-sm">
        Plataforma de ensino para formação de ministros
      </p>

      <div className="flex flex-col gap-4 w-64">
        
        <Link
          href="/login"
          className="bg-black text-white py-2 rounded text-center hover:opacity-90 transition"
        >
          Entrar
        </Link>

        <Link
          href="/register"
          className="border border-black py-2 rounded text-center hover:bg-gray-100 transition"
        >
          Criar conta
        </Link>

      </div>

    </main>
  );
}