"use client";

import { useTransition } from "react";
import { CheckCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { markNotificationsReadAction } from "@/actions/notifications";

export function MarkAllRead() {
  const [pending, startTransition] = useTransition();
  return (
    <Button variant="outline" size="sm" disabled={pending} onClick={() => startTransition(async () => void (await markNotificationsReadAction()))}>
      <CheckCheck /> Marcar todas como lidas
    </Button>
  );
}
