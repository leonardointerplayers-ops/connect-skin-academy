"use client";

import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState, useTransition } from "react";
import { ChevronLeft, ChevronRight, Loader2, Search } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

function useQueryUpdater() {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const [pending, startTransition] = useTransition();
  const set = (key: string, value: string | null) => {
    const next = new URLSearchParams(params.toString());
    if (value) next.set(key, value);
    else next.delete(key);
    if (key !== "page") next.delete("page");
    startTransition(() => router.replace(`${pathname}?${next.toString()}`, { scroll: false }));
  };
  return { params, set, pending };
}

export function SearchInput({ placeholder = "Buscar…", param = "q" }: { placeholder?: string; param?: string }) {
  const { params, set, pending } = useQueryUpdater();
  const [value, setValue] = useState(params.get(param) ?? "");
  useEffect(() => {
    const current = params.get(param) ?? "";
    if (value === current) return;
    const t = setTimeout(() => set(param, value.trim() || null), 350);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value]);
  return (
    <div className="relative w-full sm:w-72">
      {pending ? (
        <Loader2 className="absolute left-2.5 top-1/2 size-4 -translate-y-1/2 animate-spin text-muted-foreground" />
      ) : (
        <Search className="absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
      )}
      <Input value={value} onChange={(e) => setValue(e.target.value)} placeholder={placeholder} className="h-9 pl-8" />
    </div>
  );
}

export function FilterSelect({
  param,
  placeholder,
  options,
}: {
  param: string;
  placeholder: string;
  options: { value: string; label: string }[];
}) {
  const { params, set } = useQueryUpdater();
  const value = params.get(param) ?? "all";
  return (
    <Select value={value} onValueChange={(v) => set(param, v === "all" ? null : v)}>
      <SelectTrigger className="h-9 w-full sm:w-44">
        <SelectValue placeholder={placeholder} />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="all">{placeholder}</SelectItem>
        {options.map((o) => (
          <SelectItem key={o.value} value={o.value}>
            {o.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

export function Pagination({ page, pageSize, total }: { page: number; pageSize: number; total: number }) {
  const params = useSearchParams();
  const pathname = usePathname();
  const pages = Math.max(1, Math.ceil(total / pageSize));
  if (pages <= 1) return null;
  const href = (p: number) => {
    const next = new URLSearchParams(params.toString());
    next.set("page", String(p));
    return `${pathname}?${next.toString()}`;
  };
  return (
    <div className="flex items-center justify-between gap-3 pt-4 text-sm text-muted-foreground">
      <span>
        {(page - 1) * pageSize + 1}–{Math.min(total, page * pageSize)} de {total}
      </span>
      <div className="flex gap-1">
        <Button variant="outline" size="sm" asChild disabled={page <= 1} aria-disabled={page <= 1}>
          <Link href={href(Math.max(1, page - 1))} className={page <= 1 ? "pointer-events-none opacity-50" : ""}>
            <ChevronLeft /> Anterior
          </Link>
        </Button>
        <Button variant="outline" size="sm" asChild aria-disabled={page >= pages}>
          <Link href={href(Math.min(pages, page + 1))} className={page >= pages ? "pointer-events-none opacity-50" : ""}>
            Próxima <ChevronRight />
          </Link>
        </Button>
      </div>
    </div>
  );
}
