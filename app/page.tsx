import Image from "next/image";
import Link from "next/link";

export default function Home() {
  return (
    <main className="min-h-screen">
      <section className="relative flex min-h-screen flex-col items-center justify-center overflow-hidden px-5 md:hidden">
        <Image
          src="/img/backgroud-login-mobile.svg"
          alt=""
          fill
          priority
          className="object-cover"
        />

        <div className="relative z-10 flex w-full max-w-xs flex-col items-center">
          <p className="mb-8 text-center text-[18px] font-semibold text-white">
            Seja Bem Vindo a
          </p>

          <Image
            src="/img/logo-colorida.svg"
            alt="Escola de Ministros"
            width={260}
            height={88}
            priority
            className="mb-16 h-auto w-[260px]"
          />

          <div className="flex w-full flex-col gap-4">
            <Link
              href="/login"
              className="rounded-[10px] bg-black py-3 text-center text-[17px] font-medium text-white transition hover:opacity-90"
            >
              Entrar
            </Link>

            <Link
              href="/register"
              className="rounded-[10px] bg-white py-3 text-center text-[17px] font-medium text-[#303030] transition hover:bg-white/90"
            >
              Fazer Cadastro
            </Link>
          </div>
        </div>
      </section>

      <section className="hidden min-h-screen flex-col items-center justify-center gap-6 md:flex">
        <h1 className="text-3xl font-bold">Escola de Ministros</h1>

        <p className="max-w-sm text-center text-gray-500">
          Plataforma de ensino para formacao de ministros
        </p>

        <div className="flex w-64 flex-col gap-4">
          <Link
            href="/login"
            className="rounded bg-black py-2 text-center text-white transition hover:opacity-90"
          >
            Entrar
          </Link>

          <Link
            href="/register"
            className="rounded border border-black py-2 text-center transition hover:bg-gray-100"
          >
            Criar conta
          </Link>
        </div>
      </section>
    </main>
  );
}
