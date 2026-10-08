"use client";

import { useEffect } from "react";
import { reportClientError } from "@/lib/report-client-error";

export default function GlobalError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => reportClientError(error), [error]);
  return (
    <html lang="pt-BR" translate="no">
      <body style={{ fontFamily: "system-ui, sans-serif", display: "grid", placeItems: "center", minHeight: "100vh", margin: 0 }}>
        <div style={{ maxWidth: 420, padding: 24, textAlign: "center" }}>
          <h1 style={{ fontSize: 20 }}>Algo deu errado</h1>
          <p style={{ color: "#555" }}>
            Não foi possível carregar a página. Tente novamente; se continuar, informe o código ao administrador.
          </p>
          {error.digest && <p style={{ fontFamily: "monospace", fontSize: 12, color: "#777" }}>Código: {error.digest}</p>}
          <button onClick={reset} style={{ padding: "10px 18px", borderRadius: 8, border: 0, background: "#252F7E", color: "#fff", cursor: "pointer" }}>
            Tentar novamente
          </button>
        </div>
      </body>
    </html>
  );
}
