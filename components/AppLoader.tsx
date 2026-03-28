import Image from "next/image";

type AppLoaderProps = {
  message?: string;
  fullScreen?: boolean;
};

export default function AppLoader({
  message = "carregando...",
  fullScreen = true,
}: AppLoaderProps) {
  const wrapperClass = fullScreen
    ? "min-h-screen bg-white px-6"
    : "w-full rounded-[18px] bg-slate-100 px-4 py-12";
  const contentClass = fullScreen
    ? "flex min-h-screen flex-col items-center justify-center gap-5 text-center"
    : "flex flex-col items-center justify-center gap-5 text-center";

  return (
    <div className={wrapperClass}>
      <div className={contentClass}>
        <Image
          src="/img/logo.svg"
          alt="Escola de Ministros"
          width={170}
          height={56}
          className="h-12 w-auto object-contain"
          priority
        />
        <p className="text-sm font-medium tracking-[0.08em] text-black">{message}</p>
      </div>
    </div>
  );
}
