import Image from "next/image";

interface Props {
  src: string | null;
  alt: string;
  width?: number;
  height?: number;
  fill?: boolean;
  className?: string;
  sizes?: string;
  priority?: boolean;
}

export default function PosterImage({
  src,
  alt,
  width,
  height,
  fill = false,
  className = "",
  sizes = "(max-width: 768px) 128px, (max-width: 1200px) 160px, 200px",
  priority = false,
}: Props) {
  if (!src) {
    return (
      <div
        className={`flex items-center justify-center bg-[#1a1a2e] text-white/20 font-bold ${className}`}
        aria-label={alt}
      >
        {alt.slice(0, 2)}
      </div>
    );
  }

  if (fill) {
    return (
      <Image
        src={src}
        alt={alt}
        fill
        className={`object-cover ${className}`}
        sizes={sizes}
        priority={priority}
      />
    );
  }

  return (
    <Image
      src={src}
      alt={alt}
      width={width || 200}
      height={height || 300}
      className={`object-cover ${className}`}
      sizes={sizes}
      priority={priority}
    />
  );
}
