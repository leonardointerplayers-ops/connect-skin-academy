"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { CheckCircle2, Gauge, Maximize, Minimize, Pause, Play, RotateCcw, Volume2, VolumeX } from "lucide-react";
import { trackVideoAction } from "@/actions/learning";
import { APP_CONFIG } from "@/config/app";
import { formatClock } from "@/lib/format";
import { cn } from "@/lib/utils";

type Source =
  | { kind: "file"; src: string; poster: string | null; mime: string | null }
  | { kind: "youtube"; videoId: string; poster: string | null };

interface Props {
  lessonId: string;
  source: Source;
  initialPosition: number;
  initialPercent: number;
  minPercent: number;
  alreadyCompleted: boolean;
}

const SPEEDS = [0.75, 1, 1.25, 1.5, 1.75, 2];

/** Envia sinais de progresso ao servidor (que valida a plausibilidade). */
function useProgressReporter(lessonId: string, initialPercent: number, alreadyCompleted: boolean) {
  const router = useRouter();
  const [percent, setPercent] = useState(initialPercent);
  const [completed, setCompleted] = useState(alreadyCompleted);
  const lastSent = useRef(0);
  const inFlight = useRef(false);

  const report = useCallback(
    async (position: number, duration: number | null, force = false) => {
      const now = Date.now();
      if (inFlight.current || (!force && now - lastSent.current < APP_CONFIG.trackingIntervalSeconds * 1000)) return;
      inFlight.current = true;
      lastSent.current = now;
      try {
        const res = await trackVideoAction(lessonId, position, duration);
        if (res.ok && res.data) {
          setPercent((p) => Math.max(p, res.data!.percent));
          if (res.data.lessonCompleted && !completed) {
            setCompleted(true);
            toast.success(res.data.courseCompleted ? "🎓 Trilha concluída! Seu certificado está disponível." : "Aula concluída! ✓");
            router.refresh();
          }
        }
      } finally {
        inFlight.current = false;
      }
    },
    [lessonId, completed, router],
  );
  return { percent, report, completed };
}

function ProgressNote({ percent, minPercent, completed }: { percent: number; minPercent: number; completed: boolean }) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-2 px-1 pt-2 text-xs text-muted-foreground">
      <span className="tabular-nums">{Math.round(percent)}% assistido</span>
      {completed || percent >= minPercent ? (
        <span className="inline-flex items-center gap-1 font-medium text-success">
          <CheckCircle2 className="size-3.5" /> Requisito de vídeo cumprido
        </span>
      ) : (
        <span>Assista pelo menos {minPercent}% para concluir</span>
      )}
    </div>
  );
}

function FileVideoPlayer({ lessonId, source, initialPosition, initialPercent, minPercent, alreadyCompleted }: Props & { source: Extract<Source, { kind: "file" }> }) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const wrapRef = useRef<HTMLDivElement>(null);
  const [playing, setPlaying] = useState(false);
  const [time, setTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [buffered, setBuffered] = useState(0);
  const [volume, setVolume] = useState(1);
  const [muted, setMuted] = useState(false);
  const [speed, setSpeed] = useState(1);
  const [fullscreen, setFullscreen] = useState(false);
  const [showSpeeds, setShowSpeeds] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const resumed = useRef(false);
  const { percent, report, completed } = useProgressReporter(lessonId, initialPercent, alreadyCompleted);

  useEffect(() => {
    const onFs = () => setFullscreen(Boolean(document.fullscreenElement));
    document.addEventListener("fullscreenchange", onFs);
    return () => document.removeEventListener("fullscreenchange", onFs);
  }, []);

  useEffect(() => {
    const v = videoRef.current;
    return () => {
      if (v && v.currentTime > 0) void report(v.currentTime, v.duration || null, true);
    };
  }, [report]);

  const toggle = () => {
    const v = videoRef.current;
    if (!v) return;
    if (v.paused) void v.play();
    else v.pause();
  };

  const seek = (t: number) => {
    const v = videoRef.current;
    if (v) v.currentTime = Math.max(0, Math.min(t, v.duration || t));
  };

  const toggleFullscreen = async () => {
    const el = wrapRef.current;
    const video = videoRef.current as (HTMLVideoElement & { webkitEnterFullscreen?: () => void }) | null;
    if (!el) return;
    if (document.fullscreenElement) await document.exitFullscreen();
    else if (el.requestFullscreen) await el.requestFullscreen();
    else video?.webkitEnterFullscreen?.(); // iOS Safari
  };

  return (
    <div>
      <div
        ref={wrapRef}
        className={cn("group relative overflow-hidden rounded-xl bg-black", fullscreen ? "flex items-center" : "aspect-video")}
        onKeyDown={(e) => {
          if (e.key === " " || e.key === "k") {
            e.preventDefault();
            toggle();
          }
          if (e.key === "ArrowRight") seek(time + 10);
          if (e.key === "ArrowLeft") seek(time - 10);
          if (e.key === "f") void toggleFullscreen();
        }}
        tabIndex={0}
      >
        <video
          ref={videoRef}
          className="size-full"
          src={source.src}
          poster={source.poster ?? undefined}
          preload="metadata"
          playsInline
          controlsList="nodownload"
          onContextMenu={(e) => e.preventDefault()}
          onClick={toggle}
          onLoadedMetadata={(e) => {
            const v = e.currentTarget;
            setDuration(v.duration);
            if (!resumed.current && initialPosition > 5 && initialPosition < v.duration - 5) {
              v.currentTime = initialPosition;
              resumed.current = true;
            }
          }}
          onTimeUpdate={(e) => {
            const v = e.currentTarget;
            setTime(v.currentTime);
            if (!v.paused) void report(v.currentTime, v.duration || null);
          }}
          onProgress={(e) => {
            const v = e.currentTarget;
            if (v.buffered.length) setBuffered(v.buffered.end(v.buffered.length - 1));
          }}
          onPlay={(e) => {
            setPlaying(true);
            void report(e.currentTarget.currentTime, e.currentTarget.duration || null, true);
          }}
          onPause={(e) => {
            setPlaying(false);
            void report(e.currentTarget.currentTime, e.currentTarget.duration || null, true);
          }}
          onEnded={(e) => {
            setPlaying(false);
            void report(e.currentTarget.duration, e.currentTarget.duration || null, true);
          }}
          onError={() => setError("Não foi possível carregar o vídeo. Recarregue a página (o link é temporário).")}
        />

        {!playing && !error && (
          <button
            type="button"
            onClick={toggle}
            aria-label="Reproduzir"
            className="absolute inset-0 m-auto flex size-16 items-center justify-center rounded-full bg-white/90 text-primary shadow-lg transition-transform hover:scale-105"
          >
            <Play className="ml-1 size-7 fill-current" />
          </button>
        )}
        {error && <div className="absolute inset-0 flex items-center justify-center p-6 text-center text-sm text-white">{error}</div>}

        <div
          className={cn(
            "absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/80 to-transparent px-3 pb-2 pt-8 text-white transition-opacity",
            playing ? "opacity-0 group-hover:opacity-100 group-focus-within:opacity-100" : "opacity-100",
          )}
        >
          <div className="relative mb-2 h-1.5 w-full rounded-full bg-white/25">
            <div className="absolute inset-y-0 left-0 rounded-full bg-white/35" style={{ width: `${duration ? (buffered / duration) * 100 : 0}%` }} />
            <div className="absolute inset-y-0 left-0 rounded-full bg-white" style={{ width: `${duration ? (time / duration) * 100 : 0}%` }} />
            <input
              type="range"
              min={0}
              max={duration || 0}
              step={0.1}
              value={time}
              onChange={(e) => seek(Number(e.target.value))}
              aria-label="Linha do tempo"
              className="absolute inset-0 h-full w-full cursor-pointer opacity-0"
            />
          </div>
          <div className="flex items-center gap-1 sm:gap-2">
            <button type="button" onClick={toggle} className="rounded p-1.5 hover:bg-white/15" aria-label={playing ? "Pausar" : "Reproduzir"}>
              {playing ? <Pause className="size-5" /> : <Play className="size-5" />}
            </button>
            <button type="button" onClick={() => seek(time - 10)} className="rounded p-1.5 hover:bg-white/15" aria-label="Voltar 10 segundos">
              <RotateCcw className="size-4.5" />
            </button>
            <div className="group/vol flex items-center">
              <button
                type="button"
                className="rounded p-1.5 hover:bg-white/15"
                aria-label={muted ? "Ativar som" : "Silenciar"}
                onClick={() => {
                  const v = videoRef.current;
                  if (!v) return;
                  v.muted = !v.muted;
                  setMuted(v.muted);
                }}
              >
                {muted || volume === 0 ? <VolumeX className="size-5" /> : <Volume2 className="size-5" />}
              </button>
              <input
                type="range"
                min={0}
                max={1}
                step={0.05}
                value={muted ? 0 : volume}
                aria-label="Volume"
                onChange={(e) => {
                  const v = videoRef.current;
                  if (!v) return;
                  v.volume = Number(e.target.value);
                  v.muted = v.volume === 0;
                  setVolume(v.volume);
                  setMuted(v.muted);
                }}
                className="hidden w-20 accent-white sm:block"
              />
            </div>
            <span className="ml-1 text-xs tabular-nums">
              {formatClock(time)} / {formatClock(duration)}
            </span>
            <div className="relative ml-auto">
              <button type="button" onClick={() => setShowSpeeds((s) => !s)} className="flex items-center gap-1 rounded px-1.5 py-1 text-xs hover:bg-white/15" aria-label="Velocidade">
                <Gauge className="size-4" /> {speed}x
              </button>
              {showSpeeds && (
                <ul className="absolute bottom-9 right-0 rounded-lg bg-black/90 py-1 text-xs shadow-lg">
                  {SPEEDS.map((s) => (
                    <li key={s}>
                      <button
                        type="button"
                        className={cn("block w-full px-4 py-1.5 text-left hover:bg-white/15", s === speed && "font-semibold")}
                        onClick={() => {
                          if (videoRef.current) videoRef.current.playbackRate = s;
                          setSpeed(s);
                          setShowSpeeds(false);
                        }}
                      >
                        {s}x
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
            <button type="button" onClick={() => void toggleFullscreen()} className="rounded p-1.5 hover:bg-white/15" aria-label="Tela cheia">
              {fullscreen ? <Minimize className="size-5" /> : <Maximize className="size-5" />}
            </button>
          </div>
        </div>
      </div>
      <ProgressNote percent={percent} minPercent={minPercent} completed={completed} />
    </div>
  );
}

// ---------------------------------------------------------------------------
// YouTube (IFrame Player API)
// ---------------------------------------------------------------------------

interface YTPlayer {
  getCurrentTime(): number;
  getDuration(): number;
  getPlayerState(): number;
  seekTo(seconds: number, allowSeekAhead: boolean): void;
  destroy(): void;
}
declare global {
  interface Window {
    YT?: { Player: new (el: HTMLElement, opts: unknown) => YTPlayer; PlayerState: { PLAYING: number; PAUSED: number; ENDED: number } };
    onYouTubeIframeAPIReady?: () => void;
  }
}

let ytApiPromise: Promise<void> | null = null;
function loadYouTubeApi() {
  if (window.YT?.Player) return Promise.resolve();
  ytApiPromise ??= new Promise<void>((resolve) => {
    const prev = window.onYouTubeIframeAPIReady;
    window.onYouTubeIframeAPIReady = () => {
      prev?.();
      resolve();
    };
    const s = document.createElement("script");
    s.src = "https://www.youtube.com/iframe_api";
    s.async = true;
    document.head.appendChild(s);
  });
  return ytApiPromise;
}

function YouTubeVideoPlayer({ lessonId, source, initialPosition, initialPercent, minPercent, alreadyCompleted }: Props & { source: Extract<Source, { kind: "youtube" }> }) {
  const hostRef = useRef<HTMLDivElement>(null);
  const playerRef = useRef<YTPlayer | null>(null);
  const { percent, report, completed } = useProgressReporter(lessonId, initialPercent, alreadyCompleted);
  const reportRef = useRef(report);
  useEffect(() => {
    reportRef.current = report;
  }, [report]);

  useEffect(() => {
    let interval: ReturnType<typeof setInterval> | undefined;
    let disposed = false;
    void loadYouTubeApi().then(() => {
      if (disposed || !hostRef.current || !window.YT) return;
      const YT = window.YT;
      playerRef.current = new YT.Player(hostRef.current, {
        videoId: source.videoId,
        host: "https://www.youtube-nocookie.com",
        playerVars: { rel: 0, modestbranding: 1, playsinline: 1, start: initialPosition > 5 ? Math.floor(initialPosition) : 0 },
        events: {
          onStateChange: (e: { data: number }) => {
            const p = playerRef.current;
            if (!p) return;
            if (e.data === YT.PlayerState.PLAYING) {
              void reportRef.current(p.getCurrentTime(), p.getDuration() || null, true);
              clearInterval(interval);
              interval = setInterval(() => void reportRef.current(p.getCurrentTime(), p.getDuration() || null), 5000);
            } else if (e.data === YT.PlayerState.PAUSED || e.data === YT.PlayerState.ENDED) {
              clearInterval(interval);
              const t = e.data === YT.PlayerState.ENDED ? p.getDuration() : p.getCurrentTime();
              void reportRef.current(t, p.getDuration() || null, true);
            }
          },
        },
      });
    });
    return () => {
      disposed = true;
      clearInterval(interval);
      playerRef.current?.destroy();
      playerRef.current = null;
    };
  }, [source.videoId, initialPosition]);

  return (
    <div>
      <div className="aspect-video overflow-hidden rounded-xl bg-black [&>iframe]:size-full">
        <div ref={hostRef} className="size-full" />
      </div>
      <ProgressNote percent={percent} minPercent={minPercent} completed={completed} />
    </div>
  );
}

export function VideoPlayer(props: Props) {
  return props.source.kind === "youtube" ? (
    <YouTubeVideoPlayer {...props} source={props.source} />
  ) : (
    <FileVideoPlayer {...props} source={props.source} />
  );
}
