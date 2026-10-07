import "server-only";
import { cache } from "react";
import { createClient } from "@/lib/supabase/server";
import type { AppSettings } from "@/types/domain";

const DEFAULTS: AppSettings = {
  platform_name: "Connect Skin Academy",
  company_name: "Connect Skin",
  ranking_enabled: false,
  ranking_criteria: "points",
  inactivity_alert_days: 7,
  default_video_completion_percent: 90,
  reminder_emails_enabled: true,
  updated_at: new Date(0).toISOString(),
};

export const getSettings = cache(async (): Promise<AppSettings> => {
  const supabase = await createClient();
  const { data } = await supabase.from("app_settings").select("*").maybeSingle();
  return { ...DEFAULTS, ...(data ?? {}) } as AppSettings;
});
