"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Archive, ArchiveRestore, Download, ExternalLink, MoreHorizontal, Pencil, RefreshCcw, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { FileUploader } from "@/components/shared/file-uploader";
import {
  deleteMaterialAction,
  getMaterialUrlAction,
  registerMaterialAction,
  renameMaterialAction,
  replaceMaterialFileAction,
  setMaterialStatusAction,
} from "@/actions/materials";

export function LibraryUpload() {
  return (
    <FileUploader
      profile="document"
      multiple
      buttonLabel="Arraste arquivos ou clique para enviar à biblioteca"
      onUploaded={async (f) => {
        const res = await registerMaterialAction({ bucket: "documents", path: f.path, fileName: f.fileName, size: f.size, mime: f.mime });
        if (!res.ok) throw new Error(res.error);
      }}
    />
  );
}

export function LibraryRowActions({
  material,
}: {
  material: { id: string; title: string; description: string | null; status: string; external_url: string | null; usages: number };
}) {
  const [pending, startTransition] = useTransition();
  const [dialog, setDialog] = useState<null | "rename" | "replace">(null);
  const [title, setTitle] = useState(material.title);
  const [description, setDescription] = useState(material.description ?? "");

  const open = (download: boolean) =>
    startTransition(async () => {
      const res = await getMaterialUrlAction(material.id, download);
      if (res.ok && res.data) window.open(res.data.url, "_blank", "noopener");
      else if (!res.ok) toast.error(res.error);
    });

  const run = (fn: () => Promise<{ ok: boolean; message?: string; error?: string }>) =>
    startTransition(async () => {
      const res = await fn();
      if (res.ok) toast.success(res.message);
      else toast.error(res.error);
    });

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="icon-sm" aria-label="Ações" disabled={pending}>
            <MoreHorizontal />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem onSelect={() => open(false)}>
            <ExternalLink /> Visualizar
          </DropdownMenuItem>
          {!material.external_url && (
            <DropdownMenuItem onSelect={() => open(true)}>
              <Download /> Baixar
            </DropdownMenuItem>
          )}
          <DropdownMenuItem onSelect={() => setDialog("rename")}>
            <Pencil /> Renomear
          </DropdownMenuItem>
          <DropdownMenuItem onSelect={() => setDialog("replace")}>
            <RefreshCcw /> Substituir arquivo
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          {material.status === "active" ? (
            <DropdownMenuItem onSelect={() => run(() => setMaterialStatusAction(material.id, "archived"))}>
              <Archive /> Arquivar
            </DropdownMenuItem>
          ) : (
            <DropdownMenuItem onSelect={() => run(() => setMaterialStatusAction(material.id, "active"))}>
              <ArchiveRestore /> Reativar
            </DropdownMenuItem>
          )}
          <DropdownMenuItem
            variant="destructive"
            onSelect={() => {
              const msg = material.usages
                ? `Este material está em ${material.usages} aula(s) e será removido delas. Excluir definitivamente?`
                : "Excluir definitivamente este material?";
              if (confirm(msg)) run(() => deleteMaterialAction(material.id));
            }}
          >
            <Trash2 /> Excluir
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <Dialog open={dialog === "rename"} onOpenChange={(o) => !o && setDialog(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Renomear material</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-2">
              <Label htmlFor="m-title">Nome</Label>
              <Input id="m-title" value={title} onChange={(e) => setTitle(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="m-desc">Descrição</Label>
              <Textarea id="m-desc" value={description} onChange={(e) => setDescription(e.target.value)} rows={3} />
            </div>
          </div>
          <DialogFooter>
            <Button
              disabled={pending || !title.trim()}
              onClick={() =>
                run(async () => {
                  const res = await renameMaterialAction(material.id, title, description);
                  if (res.ok) setDialog(null);
                  return res;
                })
              }
            >
              Salvar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={dialog === "replace"} onOpenChange={(o) => !o && setDialog(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Substituir arquivo</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            O novo arquivo assume o lugar do atual em todas as aulas que usam “{material.title}”.
          </p>
          <FileUploader
            profile="document"
            onUploaded={async (f) => {
              const res = await replaceMaterialFileAction(material.id, { bucket: "documents", path: f.path, fileName: f.fileName, size: f.size, mime: f.mime });
              if (!res.ok) throw new Error(res.error);
              toast.success(res.message);
              setDialog(null);
            }}
          />
        </DialogContent>
      </Dialog>
    </>
  );
}
