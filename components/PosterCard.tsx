import type { MediaItem } from "@/lib/mock-data";

export function PosterCard({ item, showReason }: { item: MediaItem; showReason?: boolean }) {
  return (
    <div className="flex-shrink-0 w-32 group">
      <div
        className={`relative aspect-[2/3] rounded-xl overflow-hidden bg-gradient-to-br ${item.gradient} group-hover:scale-105 transition-transform duration-300`}
      >
        <div className="absolute inset-0 flex items-center justify-center">
          <span className="text-2xl font-bold text-white/30 select-none">
            {item.title.slice(0, 2).toUpperCase()}
          </span>
        </div>
        <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/20 to-transparent" />
        <div className="absolute top-2 right-2 bg-black/60 backdrop-blur-sm rounded-full px-2 py-0.5 text-xs font-semibold text-[#f59e0b]">
          ★ {item.rating}
        </div>
        <div className="absolute bottom-2 left-2 right-2">
          <p className="text-[11px] font-medium text-white leading-tight line-clamp-2">
            {item.title}
          </p>
        </div>
      </div>
      <p className="mt-1 text-xs text-[#9ca3af]">
        {item.year} · {item.type === "movie" ? "Movie" : item.type === "tv" ? "TV" : "Anime"}
      </p>
      {showReason && item.reason && (
        <p className="text-[10px] text-[#6366f1] mt-0.5 line-clamp-1">{item.reason}</p>
      )}
    </div>
  );
}

export function HorizontalScroll({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={`flex gap-3 overflow-x-auto px-4 pb-2 hide-scrollbar ${className ?? ""}`}>
      {children}
    </div>
  );
}
