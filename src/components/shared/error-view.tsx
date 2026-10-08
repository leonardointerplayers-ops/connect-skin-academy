"use client";

import Link from "next/link";
import { useEffect } from "react";
import { AlertTriangle, RotateCcw } from "lucide-react";
import { reportClientError } from "@/lib/report-client-error";
import { Button } from "@/components/ui/button";

export function ErrorView({ error, reset, home = "/" }: { error: Error & { digest?: string }; reset: () => void; home?: string }) {
  useEffect(() => reportClientError(error), [error]);
  return (
    <div className="flex min-h-[50vh] flex-col items-center justify-center gap-4 text-center">
      <div className="flex size-12 items-center justify-center rounded-full bg-destructive/10">
        <AlertTriangle className="size-6 text-destructive" />
      </div>
      <div className="space-y-1">
        <h2 className="text-lg font-semibold">Algo deu errado</h2>
        <p className="max-w-md text-sm text-muted-foreground">
          Não foi possível carregar esta página. Tente novamente; se o problema continuar, avise o administrador
          {error.digest ? ` informando o código ${error.digest}` : ""}.
        </p>
      </div>
      <div className="flex gap-2">
        <Button onClick={reset}>
          <RotateCcw /> Tentar novamente
        </Button>
        <Button variant="outline" asChild>
          <Link href={home}>Ir para o início</Link>
        </Button>
      </div>
    </div>
  );
}
