import {
  Award,
  BarChart3,
  BookOpen,
  ClipboardCheck,
  FileBadge,
  FileQuestion,
  FileText,
  FolderOpen,
  GraduationCap,
  Home,
  Layers,
  LayoutDashboard,
  Library,
  ListChecks,
  Megaphone,
  PlayCircle,
  ScrollText,
  Settings,
  ShieldCheck,
  Trophy,
  User,
  Users,
  UsersRound,
  type LucideIcon,
} from "lucide-react";

export interface NavItem {
  title: string;
  href: string;
  icon: LucideIcon;
  adminOnly?: boolean;
  children?: NavItem[];
  /** Mostrar na barra inferior do celular. */
  mobile?: boolean;
  exact?: boolean;
}

export const LEARNER_NAV: NavItem[] = [
  { title: "Início", href: "/inicio", icon: Home, mobile: true },
  { title: "Minha trilha", href: "/trilhas", icon: GraduationCap, mobile: true },
  { title: "Provas", href: "/provas", icon: ClipboardCheck, mobile: true },
  { title: "Conquistas", href: "/conquistas", icon: Award },
  { title: "Certificados", href: "/certificados", icon: FileBadge, exact: true },
  { title: "Comunicados", href: "/comunicados", icon: Megaphone },
  { title: "Ranking", href: "/ranking", icon: Trophy },
  { title: "Meu perfil", href: "/perfil", icon: User, mobile: true },
];

export const ADMIN_NAV: NavItem[] = [
  { title: "Dashboard", href: "/admin", icon: LayoutDashboard, exact: true },
  { title: "Colaboradores", href: "/admin/colaboradores", icon: Users },
  { title: "Grupos", href: "/admin/grupos", icon: UsersRound, adminOnly: true },
  {
    title: "Conteúdos",
    href: "/admin/conteudos",
    icon: BookOpen,
    adminOnly: true,
    children: [
      { title: "Trilhas", href: "/admin/conteudos/trilhas", icon: GraduationCap },
      { title: "Módulos", href: "/admin/conteudos/modulos", icon: Layers },
      { title: "Aulas", href: "/admin/conteudos/aulas", icon: PlayCircle },
      { title: "Materiais", href: "/admin/conteudos/materiais", icon: FileText },
      { title: "Biblioteca", href: "/admin/conteudos/biblioteca", icon: Library },
    ],
  },
  {
    title: "Avaliações",
    href: "/admin/avaliacoes",
    icon: ListChecks,
    children: [
      { title: "Provas", href: "/admin/avaliacoes/provas", icon: ClipboardCheck, adminOnly: true },
      { title: "Questões", href: "/admin/avaliacoes/questoes", icon: FileQuestion, adminOnly: true },
      { title: "Resultados", href: "/admin/avaliacoes/resultados", icon: ScrollText },
    ],
  },
  { title: "Analytics", href: "/admin/analytics", icon: BarChart3 },
  { title: "Relatórios", href: "/admin/relatorios", icon: FolderOpen },
  { title: "Comunicação", href: "/admin/comunicacao", icon: Megaphone, adminOnly: true },
  { title: "Auditoria", href: "/admin/auditoria", icon: ShieldCheck, adminOnly: true },
  { title: "Configurações", href: "/admin/configuracoes", icon: Settings, adminOnly: true },
];

export function filterNav(items: NavItem[], isAdmin: boolean): NavItem[] {
  return items
    .filter((i) => isAdmin || !i.adminOnly)
    .map((i) => (i.children ? { ...i, children: filterNav(i.children, isAdmin) } : i))
    .filter((i) => !i.children || i.children.length > 0);
}
