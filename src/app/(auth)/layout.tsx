import { BrandLogo } from "@/components/shared/brand";
import { APP_CONFIG } from "@/config/app";

export default function AuthLayout({ children }: LayoutProps<"/">) {
  return (
    <div className="grid min-h-dvh lg:grid-cols-[1.1fr_1fr]">
      <aside className="relative hidden overflow-hidden bg-primary text-primary-foreground lg:flex lg:flex-col lg:justify-between lg:p-12">
        <div
          aria-hidden
          className="pointer-events-none absolute -right-40 -top-40 size-[520px] rounded-full border-[28px] border-brand-accent/40"
        />
        <div aria-hidden className="pointer-events-none absolute -bottom-24 -left-24 size-72 rounded-full bg-white/5" />
        <p className="relative text-sm font-medium tracking-wide text-primary-foreground/70">Universidade Corporativa</p>
        <div className="relative max-w-md space-y-5">
          <h1 className="text-4xl font-semibold leading-tight tracking-tight">
            Desenvolvimento que gera resultado no campo.
          </h1>
          <p className="text-base leading-relaxed text-primary-foreground/75">
            Trilhas, aulas, materiais e avaliações para o time Connect Skin — com acompanhamento da sua evolução em
            tempo real.
          </p>
        </div>
        <p className="relative text-xs text-primary-foreground/60">{APP_CONFIG.tagline}</p>
      </aside>
      <main className="flex flex-col items-center justify-center px-5 py-10 sm:px-10">
        <div className="w-full max-w-sm">
          <div className="mb-8 flex justify-center lg:justify-start">
            <BrandLogo priority className="h-14" />
          </div>
          {children}
        </div>
      </main>
    </div>
  );
}
