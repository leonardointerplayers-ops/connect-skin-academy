"use client";

import { useEffect } from "react";
import { trackLessonViewAction, trackStudyTimeAction } from "@/actions/learning";

const HEARTBEAT_SECONDS = 30;

/** Registra a visualização da aula e o tempo de estudo (somente com a aba visível). */
export function LessonTelemetry({ lessonId }: { lessonId: string }) {
  useEffect(() => {
    void trackLessonViewAction(lessonId);
    let elapsed = 0;
    const tick = setInterval(() => {
      if (document.visibilityState !== "visible") return;
      elapsed += 5;
      if (elapsed >= HEARTBEAT_SECONDS) {
        void trackStudyTimeAction(lessonId, elapsed);
        elapsed = 0;
      }
    }, 5000);
    const flush = () => {
      if (elapsed >= 5) {
        void trackStudyTimeAction(lessonId, elapsed);
        elapsed = 0;
      }
    };
    document.addEventListener("visibilitychange", flush);
    return () => {
      clearInterval(tick);
      document.removeEventListener("visibilitychange", flush);
      flush();
    };
  }, [lessonId]);
  return null;
}
