"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Link2, Plus, Search, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { FileUploader } from "@/components/shared/file-uploader";
import { MaterialIcon } from "@/components/shared/material-icon";
import { SortableList } from "./sortable-list";
import {
  attachMaterialAction,
  createLinkMaterialAction,
  detachMaterialAction,
  registerMaterialAction,
  searchMaterialsAction,
} from "@/actions/materials";
import { MATERIAL_KIND_LABELS, formatBytes, type MaterialKind } from "@/config/uploads";
import type { Material } from "@/types/domain";

type Found = Awaited<ReturnType<typeof searchMaterialsAction>>[number];

function AddMaterialDialog({ lessonId, attachedIds }: { lessonId: string; attachedIds: string[] }) {
  const [open, setOpen] = useState(false);
  const [term, setTerm] = useState("");
  const [results, setResults] = useState<Found[] | null>(null);
  const [link, setLink] = useState({ title: "", url: "" });
  const [pending, startTransition] = useTransition();

  const search = () =>
    startTransition(async () => {
      setResults(await searchMaterialsAction(term, attachedIds));
    });

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        setOpen(o);
        if (o && !results) search();
      }}
    >
      <DialogTrigger asChild>
        <Button variant="outline" size="sm">
          <Plus /> Adicionar material
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Adicionar material à aula</DialogTitle>
        </DialogHeader>
        <Tabs defaultValue="upload">
          <TabsList className="w-full">
            <TabsTrigger value="upload">Enviar arquivo</TabsTrigger>
            <TabsTrigger value="library">Da biblioteca</TabsTrigger>
            <TabsTrigger value="link">Link</TabsTrigger>
          </TabsList>
          <TabsContent value="upload" className="pt-3">
            <FileUploader
              profile="material"
              multiple
              onUploaded={async (f) => {
                const res = await registerMaterialAction({ bucket: "lesson-materials", path: f.path, fileName: f.fileName, size: f.size, mime: f.mime }, lessonId);
                if (!res.ok) throw new Error(res.error);
              }}
            />
          </TabsContent>
          <TabsContent value="library" className="space-y-3 pt-3">
            <form
              className="flex gap-2"
              onSubmit={(e) => {
                e.preventDefault();
                search();
              }}
            >
              <Input value={term} onChange={(e) => setTerm(e.target.value)} placeholder="Buscar na biblioteca" />
              <Button type="submit" variant="outline" size="icon" aria-label="Buscar" disabled={pending}>
                <Search />
              </Button>
            </form>
            <ul className="max-h-72 space-y-1 overflow-y-auto">
              {results?.length === 0 && <li className="py-6 text-center text-sm text-muted-foreground">Nada encontrado.</li>}
              {results?.map((m) => (
                <li key={m.id} className="flex items-center gap-3 rounded-lg border p-2">
                  <MaterialIcon kind={m.kind} />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">{m.title}</p>
                    <p className="text-xs text-muted-foreground">
                      {MATERIAL_KIND_LABELS[m.kind as MaterialKind]} · {m.external_url ? "link" : formatBytes(m.size_bytes)}
                    </p>
                  </div>
                  <Button
                    size="sm"
                    disabled={pending}
                    onClick={() =>
                      startTransition(async () => {
                        const res = await attachMaterialAction(lessonId, m.id);
                        if (res.ok) {
                          toast.success(res.message);
                          setResults((r) => r?.filter((x) => x.id !== m.id) ?? null);
                        } else toast.error(res.error);
                      })
                    }
                  >
                    Anexar
                  </Button>
                </li>
              ))}
            </ul>
          </TabsContent>
          <TabsContent value="link" className="space-y-3 pt-3">
            <Input placeholder="Título" value={link.title} onChange={(e) => setLink({ ...link, title: e.target.value })} />
            <Input placeholder="https://…" value={link.url} onChange={(e) => setLink({ ...link, url: e.target.value })} />
            <Button
              disabled={pending || !link.title || !link.url}
              onClick={() =>
                startTransition(async () => {
                  const res = await createLinkMaterialAction(link, lessonId);
                  if (res.ok) {
                    toast.success(res.message);
                    setLink({ title: "", url: "" });
                  } else toast.error(res.error);
                })
              }
            >
              <Link2 /> Adicionar link
            </Button>
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}

export function LessonMaterials({ lessonId, materials }: { lessonId: string; materials: Material[] }) {
  const [pending, startTransition] = useTransition();
  return (
    <div className="space-y-3">
      {materials.length === 0 ? (
        <p className="text-sm text-muted-foreground">Nenhum material anexado (PDF, planilhas, documentos, links…).</p>
      ) : (
        <SortableList
          items={materials}
          kind="lesson_materials"
          parentId={lessonId}
          render={(m) => (
            <div className="flex items-center gap-3 py-2 pr-2">
              <MaterialIcon kind={m.kind} className="size-8" />
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium">{m.title}</p>
                <p className="truncate text-xs text-muted-foreground">
                  {MATERIAL_KIND_LABELS[m.kind as MaterialKind]} · {m.external_url ?? formatBytes(m.size_bytes)}
                  {m.status === "archived" && " · arquivado (oculto)"}
                </p>
              </div>
              <Button
                variant="ghost"
                size="icon-sm"
                aria-label="Remover da aula"
                disabled={pending}
                onClick={() =>
                  startTransition(async () => {
                    const res = await detachMaterialAction(lessonId, m.id);
                    if (res.ok) toast.success(res.message);
                    else toast.error(res.error);
                  })
                }
              >
                <X />
              </Button>
            </div>
          )}
        />
      )}
      <AddMaterialDialog lessonId={lessonId} attachedIds={materials.map((m) => m.id)} />
    </div>
  );
}
