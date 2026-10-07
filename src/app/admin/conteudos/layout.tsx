import { requireAdmin } from "@/lib/auth/dal";

export default async function ContentLayout({ children }: LayoutProps<"/admin/conteudos">) {
  await requireAdmin();
  return children;
}
