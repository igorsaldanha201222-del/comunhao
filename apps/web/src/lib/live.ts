import { youtubeId } from "@/lib/format";

/** Endereço do player embutido para o link da live: vídeo/live do YouTube ou canal (/channel/UC…). */
export function liveEmbed(url: string | null | undefined) {
  if (!url) return null;
  const id = youtubeId(url);
  if (id) return `https://www.youtube.com/embed/${id}?autoplay=1&rel=0`;
  const ch = url.match(/youtube\.com\/channel\/(UC[\w-]{20,})/)?.[1];
  if (ch) return `https://www.youtube.com/embed/live_stream?channel=${ch}&autoplay=1`;
  return null;
}
