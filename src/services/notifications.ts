import "server-only";
import { createClient } from "@/lib/supabase/server";
import type { Notification } from "@/types/domain";

export async function getNotificationsSummary(limit = 8) {
  const supabase = await createClient();
  const [{ data }, { count }] = await Promise.all([
    supabase
      .from("notifications")
      .select("id, type, title, body, link, read_at, created_at")
      .order("created_at", { ascending: false })
      .limit(limit),
    supabase.from("notifications").select("id", { count: "exact", head: true }).is("read_at", null),
  ]);
  return { items: (data ?? []) as Notification[], unread: count ?? 0 };
}

export async function listNotifications(page = 1, pageSize = 30) {
  const supabase = await createClient();
  const from = (page - 1) * pageSize;
  const { data, count } = await supabase
    .from("notifications")
    .select("id, type, title, body, link, read_at, created_at", { count: "exact" })
    .order("created_at", { ascending: false })
    .range(from, from + pageSize - 1);
  return { items: (data ?? []) as Notification[], total: count ?? 0 };
}
