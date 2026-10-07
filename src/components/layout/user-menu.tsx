"use client";

import Link from "next/link";
import { GraduationCap, LayoutDashboard, LogOut, User } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import { UserAvatarClient } from "./user-avatar-client";
import { ROLE_LABELS } from "@/config/app";

export function UserMenu({
  name,
  email,
  role,
  avatarUrl,
  isStaff,
}: {
  name: string;
  email: string;
  role: string;
  avatarUrl: string | null;
  isStaff: boolean;
}) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" className="h-10 gap-2 px-1.5 sm:px-2" aria-label="Menu do usuário">
          <UserAvatarClient name={name} src={avatarUrl} />
          <span className="hidden max-w-36 truncate text-sm font-medium sm:inline">{name.split(" ")[0]}</span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-60">
        <DropdownMenuLabel className="font-normal">
          <p className="truncate text-sm font-semibold">{name}</p>
          <p className="truncate text-xs text-muted-foreground">{email}</p>
          <p className="mt-1 text-[11px] font-medium uppercase tracking-wide text-primary">{ROLE_LABELS[role]}</p>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem asChild>
          <Link href="/perfil">
            <User /> Meu perfil
          </Link>
        </DropdownMenuItem>
        {isStaff && (
          <>
            <DropdownMenuItem asChild>
              <Link href="/admin">
                <LayoutDashboard /> Painel de gestão
              </Link>
            </DropdownMenuItem>
            <DropdownMenuItem asChild>
              <Link href="/inicio">
                <GraduationCap /> Área do colaborador
              </Link>
            </DropdownMenuItem>
          </>
        )}
        <DropdownMenuSeparator />
        <form action="/auth/signout" method="post">
          <DropdownMenuItem asChild variant="destructive">
            <button type="submit" className="w-full">
              <LogOut /> Sair
            </button>
          </DropdownMenuItem>
        </form>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
