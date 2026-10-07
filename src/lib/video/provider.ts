import "server-only";
import { APP_CONFIG } from "@/config/app";
import { signedUrl } from "@/lib/storage/server";
import type { Video, VideoProviderId } from "@/types/domain";

export type PlaybackSource =
  | { kind: "file"; src: string; poster: string | null; mime: string | null }
  | { kind: "youtube"; videoId: string; poster: string | null };

/**
 * Abstração de provedor de vídeo. A aplicação nunca acessa o Storage
 * diretamente para vídeo: pede ao provedor uma fonte de reprodução.
 * Para migrar para Cloudflare Stream / Mux / Vimeo, implemente um novo
 * VideoProvider e registre-o abaixo — telas e banco não mudam.
 */
export interface VideoProvider {
  readonly id: VideoProviderId;
  getPlayback(video: Video): Promise<PlaybackSource | null>;
}

async function signedPoster(video: Video) {
  return video.thumbnail_path ? signedUrl("video-assets", video.thumbnail_path, APP_CONFIG.signedUrlTtl.video) : null;
}

export class SupabaseVideoProvider implements VideoProvider {
  readonly id = "supabase" as const;
  async getPlayback(video: Video): Promise<PlaybackSource | null> {
    if (!video.storage_path) return null;
    const src = await signedUrl(video.storage_bucket ?? "video-assets", video.storage_path, APP_CONFIG.signedUrlTtl.video);
    if (!src) return null;
    return { kind: "file", src, poster: await signedPoster(video), mime: video.mime_type };
  }
}

export class ExternalUrlVideoProvider implements VideoProvider {
  readonly id = "external" as const;
  async getPlayback(video: Video): Promise<PlaybackSource | null> {
    if (!video.external_url) return null;
    return { kind: "file", src: video.external_url, poster: await signedPoster(video), mime: null };
  }
}

export class YouTubeVideoProvider implements VideoProvider {
  readonly id = "youtube" as const;
  async getPlayback(video: Video): Promise<PlaybackSource | null> {
    if (!video.provider_asset_id) return null;
    return {
      kind: "youtube",
      videoId: video.provider_asset_id,
      poster: `https://i.ytimg.com/vi/${encodeURIComponent(video.provider_asset_id)}/hqdefault.jpg`,
    };
  }
}

const registry: Partial<Record<VideoProviderId, VideoProvider>> = {
  supabase: new SupabaseVideoProvider(),
  external: new ExternalUrlVideoProvider(),
  youtube: new YouTubeVideoProvider(),
  // vimeo / cloudflare / mux: preparados no schema; implementar quando contratados.
};

export function getVideoProvider(id: VideoProviderId): VideoProvider | null {
  return registry[id] ?? null;
}

export async function getPlayback(video: Video | null): Promise<PlaybackSource | null> {
  if (!video) return null;
  const provider = getVideoProvider(video.provider);
  return provider ? provider.getPlayback(video) : null;
}
