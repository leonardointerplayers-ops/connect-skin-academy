"use client";

import { useTransition } from "react";
import { toast } from "sonner";
import { Loader2, PlayCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { startExamAction } from "@/actions/exams";

export function StartExamButton({ examId, label, disabled }: { examId: string; label: string; disabled?: boolean }) {
  const [pending, startTransition] = useTransition();
  return (
    <Button
      size="lg"
      disabled={disabled || pending}
      onClick={() =>
        startTransition(async () => {
          const res = await startExamAction(examId);
          if (res && !res.ok) toast.error(res.error);
        })
      }
    >
      {pending ? <Loader2 className="animate-spin" /> : <PlayCircle />} {label}
    </Button>
  );
}
