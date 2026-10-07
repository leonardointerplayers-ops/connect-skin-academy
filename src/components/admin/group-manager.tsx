"use client";

import { useActionState, useMemo, useState, useTransition } from "react";
import { toast } from "sonner";
import { Pencil, Plus, Trash2, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { ScrollArea } from "@/components/ui/scroll-area";
import { FormMessage, SubmitButton } from "@/components/shared/form-bits";
import { deleteGroupAction, saveGroupAction, setGroupMembersAction } from "@/actions/users";

interface Group {
  id: string;
  name: string;
  description: string | null;
  members: number;
  memberIds: string[];
}
interface Person {
  id: string;
  full_name: string;
  email: string;
}

function GroupFormDialog({ group, trigger }: { group?: Group; trigger: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  const [state, action] = useActionState(async (prev: Awaited<ReturnType<typeof saveGroupAction>> | null, fd: FormData) => {
    const res = await saveGroupAction(group?.id ?? null, prev, fd);
    if (res.ok) {
      toast.success(res.message);
      setOpen(false);
    }
    return res;
  }, null);
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{group ? "Editar grupo" : "Novo grupo"}</DialogTitle>
        </DialogHeader>
        <form action={action} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="g-name">Nome</Label>
            <Input id="g-name" name="name" defaultValue={group?.name} required />
          </div>
          <div className="space-y-2">
            <Label htmlFor="g-desc">Descrição</Label>
            <Textarea id="g-desc" name="description" defaultValue={group?.description ?? ""} rows={3} />
          </div>
          <FormMessage state={state && !state.ok ? state : null} />
          <DialogFooter>
            <SubmitButton>Salvar</SubmitButton>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function MembersDialog({ group, people }: { group: Group; people: Person[] }) {
  const [open, setOpen] = useState(false);
  const [selected, setSelected] = useState(new Set(group.memberIds));
  const [filter, setFilter] = useState("");
  const [pending, startTransition] = useTransition();
  const visible = useMemo(
    () => people.filter((p) => `${p.full_name} ${p.email}`.toLowerCase().includes(filter.toLowerCase())),
    [people, filter],
  );
  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        setOpen(o);
        if (o) setSelected(new Set(group.memberIds));
      }}
    >
      <DialogTrigger asChild>
        <Button variant="outline" size="sm">
          <Users /> Membros
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Membros — {group.name}</DialogTitle>
          <DialogDescription>{selected.size} selecionado(s)</DialogDescription>
        </DialogHeader>
        <Input placeholder="Filtrar pessoas" value={filter} onChange={(e) => setFilter(e.target.value)} />
        <ScrollArea className="h-72 rounded-md border">
          <ul className="divide-y">
            {visible.map((p) => (
              <li key={p.id}>
                <label className="flex cursor-pointer items-center gap-3 px-3 py-2 hover:bg-muted/50">
                  <Checkbox
                    checked={selected.has(p.id)}
                    onCheckedChange={(c) =>
                      setSelected((prev) => {
                        const next = new Set(prev);
                        if (c) next.add(p.id);
                        else next.delete(p.id);
                        return next;
                      })
                    }
                  />
                  <span className="min-w-0">
                    <span className="block truncate text-sm font-medium">{p.full_name}</span>
                    <span className="block truncate text-xs text-muted-foreground">{p.email}</span>
                  </span>
                </label>
              </li>
            ))}
          </ul>
        </ScrollArea>
        <DialogFooter>
          <Button
            disabled={pending}
            onClick={() =>
              startTransition(async () => {
                const res = await setGroupMembersAction(group.id, [...selected]);
                if (res.ok) {
                  toast.success(res.message);
                  setOpen(false);
                } else toast.error(res.error);
              })
            }
          >
            Salvar membros
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export function GroupManager({ groups, people, canEdit }: { groups: Group[]; people: Person[]; canEdit: boolean }) {
  const [pending, startTransition] = useTransition();
  return (
    <div className="space-y-4">
      {canEdit && (
        <GroupFormDialog
          trigger={
            <Button>
              <Plus /> Novo grupo
            </Button>
          }
        />
      )}
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {groups.map((g) => (
          <Card key={g.id} className="py-0">
            <CardContent className="flex h-full flex-col gap-3 p-4">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <p className="font-semibold">{g.name}</p>
                  <p className="text-xs text-muted-foreground">{g.members} membro(s)</p>
                </div>
                {canEdit && (
                  <div className="flex gap-1">
                    <GroupFormDialog
                      group={g}
                      trigger={
                        <Button variant="ghost" size="icon-sm" aria-label="Editar grupo">
                          <Pencil />
                        </Button>
                      }
                    />
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      aria-label="Excluir grupo"
                      disabled={pending}
                      onClick={() => {
                        if (!confirm(`Excluir o grupo "${g.name}"? Os colaboradores não são afetados.`)) return;
                        startTransition(async () => {
                          const res = await deleteGroupAction(g.id);
                          if (res.ok) toast.success(res.message);
                          else toast.error(res.error);
                        });
                      }}
                    >
                      <Trash2 />
                    </Button>
                  </div>
                )}
              </div>
              {g.description && <p className="text-sm text-muted-foreground">{g.description}</p>}
              {canEdit && (
                <div className="mt-auto">
                  <MembersDialog group={g} people={people} />
                </div>
              )}
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
