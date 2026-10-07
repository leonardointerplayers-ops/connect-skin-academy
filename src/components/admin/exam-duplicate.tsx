"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Copy } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { duplicateExamAction } from "@/actions/exams";

export function ExamDuplicate({ examId, modules }: { examId: string; modules: { id: string; label: string }[] }) {
  const router = useRouter();
  const [target, setTarget] = useState<string>("");
  const [pending, startTransition] = useTransition();
  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm">
          <Copy /> Duplicar
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Duplicar prova para outro módulo</DialogTitle>
        </DialogHeader>
        {modules.length === 0 ? (
          <p className="text-sm text-muted-foreground">Todos os módulos já possuem prova.</p>
        ) : (
          <Select value={target} onValueChange={setTarget}>
            <SelectTrigger className="w-full">
              <SelectValue placeholder="Módulo de destino" />
            </SelectTrigger>
            <SelectContent>
              {modules.map((m) => (
                <SelectItem key={m.id} value={m.id}>
                  {m.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
        <DialogFooter>
          <Button
            disabled={!target || pending}
            onClick={() =>
              startTransition(async () => {
                const res = await duplicateExamAction(examId, target);
                if (res.ok && res.data) {
                  toast.success(res.message);
                  router.push(`/admin/avaliacoes/provas/${res.data.id}`);
                } else if (!res.ok) toast.error(res.error);
              })
            }
          >
            Duplicar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
