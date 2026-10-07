"use client";

import { useState } from "react";
import { EditorContent, useEditor, useEditorState, type Editor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Link from "@tiptap/extension-link";
import Image from "@tiptap/extension-image";
import Placeholder from "@tiptap/extension-placeholder";
import { Table } from "@tiptap/extension-table";
import TableRow from "@tiptap/extension-table-row";
import TableCell from "@tiptap/extension-table-cell";
import TableHeader from "@tiptap/extension-table-header";
import {
  Bold,
  Heading2,
  Heading3,
  ImagePlus,
  Italic,
  Link2,
  List,
  ListOrdered,
  Minus,
  Quote,
  Redo2,
  Strikethrough,
  Table2,
  Undo2,
} from "lucide-react";
import { Toggle } from "./toggle-button";
import { FileUploader } from "@/components/shared/file-uploader";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Button } from "@/components/ui/button";

function publicUrl(bucket: string, path: string) {
  const base = process.env.NEXT_PUBLIC_SUPABASE_URL?.replace(/\/$/, "");
  return `${base}/storage/v1/object/public/${bucket}/${path}`;
}

function Toolbar({ editor }: { editor: Editor }) {
  const s = useEditorState({
    editor,
    selector: ({ editor: e }) => ({
      bold: e.isActive("bold"),
      italic: e.isActive("italic"),
      strike: e.isActive("strike"),
      h2: e.isActive("heading", { level: 2 }),
      h3: e.isActive("heading", { level: 3 }),
      bullet: e.isActive("bulletList"),
      ordered: e.isActive("orderedList"),
      quote: e.isActive("blockquote"),
      link: e.isActive("link"),
      table: e.isActive("table"),
      canUndo: e.can().undo(),
      canRedo: e.can().redo(),
    }),
  });

  const setLink = () => {
    const previous = editor.getAttributes("link").href as string | undefined;
    const url = window.prompt("Endereço do link (https://…)", previous ?? "https://");
    if (url === null) return;
    if (url === "" || url === "https://") return void editor.chain().focus().extendMarkRange("link").unsetLink().run();
    editor.chain().focus().extendMarkRange("link").setLink({ href: url }).run();
  };

  return (
    <div className="sticky top-14 z-10 flex flex-wrap items-center gap-0.5 border-b bg-card/95 p-1.5 backdrop-blur">
      <Toggle label="Título" pressed={s.h2} onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}><Heading2 /></Toggle>
      <Toggle label="Subtítulo" pressed={s.h3} onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()}><Heading3 /></Toggle>
      <span className="mx-1 h-5 w-px bg-border" />
      <Toggle label="Negrito" pressed={s.bold} onClick={() => editor.chain().focus().toggleBold().run()}><Bold /></Toggle>
      <Toggle label="Itálico" pressed={s.italic} onClick={() => editor.chain().focus().toggleItalic().run()}><Italic /></Toggle>
      <Toggle label="Tachado" pressed={s.strike} onClick={() => editor.chain().focus().toggleStrike().run()}><Strikethrough /></Toggle>
      <span className="mx-1 h-5 w-px bg-border" />
      <Toggle label="Lista" pressed={s.bullet} onClick={() => editor.chain().focus().toggleBulletList().run()}><List /></Toggle>
      <Toggle label="Lista numerada" pressed={s.ordered} onClick={() => editor.chain().focus().toggleOrderedList().run()}><ListOrdered /></Toggle>
      <Toggle label="Destaque" pressed={s.quote} onClick={() => editor.chain().focus().toggleBlockquote().run()}><Quote /></Toggle>
      <Toggle label="Linha divisória" onClick={() => editor.chain().focus().setHorizontalRule().run()}><Minus /></Toggle>
      <span className="mx-1 h-5 w-px bg-border" />
      <Toggle label="Link" pressed={s.link} onClick={setLink}><Link2 /></Toggle>
      <Popover>
        <PopoverTrigger asChild>
          <Button type="button" variant="ghost" size="icon-sm" aria-label="Imagem" title="Imagem">
            <ImagePlus />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-80">
          <p className="mb-2 text-sm font-medium">Inserir imagem</p>
          <FileUploader
            profile="courseCover"
            onUploaded={(f) => {
              editor.chain().focus().setImage({ src: publicUrl(f.bucket, f.path), alt: f.fileName }).run();
            }}
          />
        </PopoverContent>
      </Popover>
      <Toggle
        label={s.table ? "Remover tabela" : "Tabela"}
        pressed={s.table}
        onClick={() =>
          s.table
            ? editor.chain().focus().deleteTable().run()
            : editor.chain().focus().insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run()
        }
      >
        <Table2 />
      </Toggle>
      {s.table && (
        <>
          <Button type="button" variant="ghost" size="xs" onClick={() => editor.chain().focus().addRowAfter().run()}>+ linha</Button>
          <Button type="button" variant="ghost" size="xs" onClick={() => editor.chain().focus().addColumnAfter().run()}>+ coluna</Button>
          <Button type="button" variant="ghost" size="xs" onClick={() => editor.chain().focus().deleteRow().run()}>− linha</Button>
          <Button type="button" variant="ghost" size="xs" onClick={() => editor.chain().focus().deleteColumn().run()}>− coluna</Button>
        </>
      )}
      <span className="ml-auto flex">
        <Toggle label="Desfazer" disabled={!s.canUndo} onClick={() => editor.chain().focus().undo().run()}><Undo2 /></Toggle>
        <Toggle label="Refazer" disabled={!s.canRedo} onClick={() => editor.chain().focus().redo().run()}><Redo2 /></Toggle>
      </span>
    </div>
  );
}

export function RichTextEditor({ name, defaultValue }: { name: string; defaultValue?: string | null }) {
  const [html, setHtml] = useState(defaultValue ?? "");
  const editor = useEditor({
    immediatelyRender: false,
    extensions: [
      StarterKit.configure({ heading: { levels: [2, 3, 4] }, link: false }),
      Link.configure({ openOnClick: false, autolink: true, HTMLAttributes: { rel: "noopener noreferrer", target: "_blank" } }),
      Image,
      Placeholder.configure({ placeholder: "Escreva o conteúdo da aula…" }),
      Table.configure({ resizable: false }),
      TableRow,
      TableHeader,
      TableCell,
    ],
    content: defaultValue ?? "",
    editorProps: {
      attributes: { class: "lesson-content min-h-72 px-4 py-4 focus:outline-none" },
    },
    onUpdate: ({ editor: e }) => setHtml(e.isEmpty ? "" : e.getHTML()),
  });

  return (
    <div className="overflow-hidden rounded-lg border bg-card focus-within:ring-3 focus-within:ring-ring/30">
      <input type="hidden" name={name} value={html} />
      {editor ? <Toolbar editor={editor} /> : <div className="h-11 border-b" />}
      <EditorContent editor={editor} />
    </div>
  );
}
