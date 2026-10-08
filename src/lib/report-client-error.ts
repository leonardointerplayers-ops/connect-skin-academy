/** Envia um erro capturado no navegador para /api/client-error (melhor esforço). */
export function reportClientError(error: Error & { digest?: string }) {
  try {
    void fetch("/api/client-error", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ message: error.message, digest: error.digest, stack: error.stack, path: window.location.pathname }),
      keepalive: true,
    });
  } catch {}
}
