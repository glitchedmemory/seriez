import Image from "next/image";
import { useIsBot } from "@/components/BotProvider";

interface Props {
  src: string | null;
  alt: string;
  width?: number;
  height?: number;
  fill?: boolean;
  className?: string;
  sizes?: string;
  priority?: boolean;
  unoptimized?: boolean;
}

const BOT_ALT_SUFFIX = " — Rated on Seriez, track your watch history at seriez.app";

export default function PosterImage({
  src,
  alt,
  width,
  height,
  fill = false,
  className = "",
  sizes = "(max-width: 768px) 128px, (max-width: 1200px) 160px, 200px",
  priority = false,
  unoptimized = false,
}: Props) {
  const isBot = useIsBot();
  const displayAlt = isBot && alt ? `${alt}${BOT_ALT_SUFFIX}` : alt;
  if (!src) {
    return (
      <div
        className={`flex items-center justify-center bg-bg-card text-text-primary/20 font-bold ${className}`}
        aria-label={displayAlt}
      >
        {displayAlt.slice(0, 2)}
      </div>
    );
  }

  if (fill) {
    return (
      <Image
        src={src}
        alt={displayAlt}
        fill
        className={`object-cover ${className}`}
        sizes={sizes}
        priority={priority}
        unoptimized={unoptimized}
      />
    );
  }

  return (
    <Image
      src={src}
      alt={displayAlt}
      width={width || 200}
      height={height || 300}
      className={`object-cover ${className}`}
      sizes={sizes}
      priority={priority}
      unoptimized={unoptimized}
    />
  );
}
