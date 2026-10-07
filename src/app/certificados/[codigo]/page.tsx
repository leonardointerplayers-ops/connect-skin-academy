import type { Metadata } from "next";
import { ShieldCheck, ShieldX } from "lucide-react";
import { BrandLogo } from "@/components/shared/brand";
import { PrintButton } from "./print-button";
import { createClient } from "@/lib/supabase/server";
import { formatDate } from "@/lib/format";
import { APP_CONFIG } from "@/config/app";
import { isSupabaseConfigured, publicEnv } from "@/lib/env";

export const metadata: Metadata = { title: "Validação de certificado" };

interface Cert {
  code: string;
  recipient_name: string;
  course_title: string;
  workload_hours: number | null;
  issued_at: string;
}

/** Página pública: valida a autenticidade e exibe o certificado para impressão. */
export default async function CertificatePage({ params }: PageProps<"/certificados/[codigo]">) {
  const { codigo } = await params;
  const code = decodeURIComponent(codigo).toUpperCase().slice(0, 40);
  let cert: Cert | null = null;
  if (isSupabaseConfigured() && /^[A-Z0-9-]{6,40}$/.test(code)) {
    const supabase = await createClient();
    const { data } = await supabase.rpc("fn_verify_certificate", { p_code: code });
    cert = (data as Cert | null) ?? null;
  }

  if (!cert) {
    return (
      <main className="flex min-h-dvh items-center justify-center p-6">
        <div className="max-w-md space-y-4 text-center">
          <ShieldX className="mx-auto size-12 text-destructive" />
          <h1 className="text-xl font-semibold">Certificado não encontrado</h1>
          <p className="text-sm text-muted-foreground">
            O código <span className="font-mono">{code}</span> não corresponde a nenhum certificado emitido pela {APP_CONFIG.name}.
          </p>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-dvh bg-muted/40 px-4 py-8 print:bg-white print:p-0">
      <div className="no-print mx-auto mb-4 flex max-w-4xl flex-wrap items-center justify-between gap-3">
        <p className="inline-flex items-center gap-2 rounded-full bg-success/10 px-3 py-1.5 text-sm font-medium text-success">
          <ShieldCheck className="size-4" /> Certificado autêntico emitido pela {APP_CONFIG.name}
        </p>
        <PrintButton />
      </div>

      <article className="relative mx-auto aspect-[1.414/1] w-full max-w-4xl overflow-hidden rounded-xl border bg-white text-[#1b1f3b] shadow-sm print:max-w-none print:rounded-none print:border-0 print:shadow-none">
        <div aria-hidden className="absolute -right-24 -top-24 size-80 rounded-full border-[26px] border-[#A3263F]/25" />
        <div aria-hidden className="absolute -bottom-32 -left-20 size-80 rounded-full bg-[#252F7E]/5" />
        <div className="absolute inset-3 rounded-lg border-2 border-[#252F7E]/15 sm:inset-5" />
        <div className="relative flex h-full flex-col items-center justify-between px-6 py-6 text-center sm:px-16 sm:py-12">
          <BrandLogo className="h-10 sm:h-16" />
          <div className="space-y-2 sm:space-y-4">
            <p className="text-[10px] font-semibold uppercase tracking-[0.3em] text-[#A3263F] sm:text-sm">Certificado de conclusão</p>
            <p className="text-xs text-[#4b5068] sm:text-base">Certificamos que</p>
            <h1 className="font-serif text-xl font-bold text-[#252F7E] sm:text-4xl">{cert.recipient_name}</h1>
            <p className="mx-auto max-w-xl text-xs leading-relaxed text-[#4b5068] sm:text-base">
              concluiu com êxito o programa <strong className="text-[#1b1f3b]">{cert.course_title}</strong>
              {cert.workload_hours ? `, com carga horária de ${Number(cert.workload_hours)} horas` : ""}, da Universidade Corporativa {APP_CONFIG.company}.
            </p>
          </div>
          <div className="grid w-full grid-cols-2 items-end gap-4 text-[10px] text-[#4b5068] sm:text-xs">
            <div className="text-left">
              <p className="font-semibold text-[#1b1f3b]">{formatDate(cert.issued_at, "dd 'de' MMMM 'de' yyyy")}</p>
              <p>Data de emissão</p>
            </div>
            <div className="text-right">
              <p className="font-mono font-semibold text-[#1b1f3b]">{cert.code}</p>
              <p className="break-all">Valide em {publicEnv.appUrl.replace(/^https?:\/\//, "")}/certificados/{cert.code}</p>
            </div>
          </div>
        </div>
      </article>
    </main>
  );
}
