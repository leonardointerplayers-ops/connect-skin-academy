"use client";

import { useTransition } from "react";
import { toast } from "sonner";
import { MailCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { sendTestEmailAction } from "@/actions/communication";

export function TestEmailButton() {
  const [pending, startTransition] = useTransition();
  return (
    <Button
      variant="outline"
      size="sm"
      disabled={pending}
      onClick={() =>
        startTransition(async () => {
          const res = await sendTestEmailAction();
          if (res.ok) toast.success(res.message);
          else toast.error(res.error);
        })
      }
    >
      <MailCheck /> Enviar e-mail de teste para mim
    </Button>
  );
}
