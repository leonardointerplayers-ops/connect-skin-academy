import type { Metadata } from "next";
import { BrandLogo } from "@/components/shared/brand";
import { SubmitButton } from "@/components/shared/form-bits";
import { confirmLinkAction } from "./actions";

export const metadata: Metadata = { title: "Acessar plataforma" };

const str = (v: string | string[] | undefined) => (typeof v === "string" ? v : "");

export default async function ConfirmPage({ searchParams }: PageProps<"/auth/confirm">) {
  const sp = await searchParams;
  const type = str(sp.type);
  const isRecovery = type === "recovery";
  const valid = Boolean(str(sp.token_hash) || str(sp.code));

  return (
    <main className="flex min-h-dvh items-center justify-center bg-muted/40 px-5">
      <div className="w-full max-w-sm space-y-6 rounded-2xl border bg-card p-8 text-center shadow-sm">
        <div className="flex justify-center">
          <BrandLogo priority className="h-14" />
        </div>
        {valid ? (
          <>
            <div className="space-y-1.5">
              <h1 className="text-xl font-semibold">{isRecovery ? "Criar nova senha" : "Bem-vindo(a) à Academy 👋"}</h1>
              <p className="text-sm text-muted-foreground">
                {isRecovery ? "Clique em continuar para definir sua nova senha." : "Clique em continuar para criar sua senha e acessar a plataforma."}
              </p>
            </div>
            <form action={confirmLinkAction}>
              <input type="hidden" name="token_hash" value={str(sp.token_hash)} />
              <input type="hidden" name="type" value={type} />
              <input type="hidden" name="code" value={str(sp.code)} />
              <input type="hidden" name="next" value={str(sp.next)} />
              <SubmitButton className="h-11 w-full" pendingText="Validando…">
                Continuar
              </SubmitButton>
            </form>
          </>
        ) : (
          <p className="text-sm text-muted-foreground">Link incompleto. Solicite um novo ao administrador.</p>
        )}
      </div>
    </main>
  );
}
