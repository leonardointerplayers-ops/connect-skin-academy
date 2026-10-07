"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { assertUser } from "@/lib/auth/dal";
import { createClient } from "@/lib/supabase/server";
import { ensure, toActionError, type ActionResult } from "@/lib/actions";

export async function markNotificationsReadAction(ids?: string[]): Promise<ActionResult> {
  try {
    await assertUser();
    const parsed = ids ? z.array(z.uuid()).max(200).parse(ids) : null;
    const supabase = await createClient();
    ensure(await supabase.rpc("fn_mark_notifications_read", { p_ids: parsed }));
    revalidatePath("/", "layout");
    return { ok: true };
  } catch (err) {
    return toActionError(err);
  }
}
