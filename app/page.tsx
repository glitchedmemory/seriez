import { PosterCard, HorizontalScroll } from "@/components/PosterCard";
import { trendingAll, forYou, activities, streamingTop10, boxOffice } from "@/lib/mock-data";

function StarRating({ rating }: { rating: number }) {
  const full = Math.floor(rating);
  const half = rating - full >= 0.5;
  const empty = 5 - full - (half ? 1 : 0);

  return (
    <span className="text-[#f59e0b] text-sm">
      {"★".repeat(full)}
      {half && "½"}
      {"☆".repeat(empty)}
    </span>
  );
}

export default function Home() {
  return (
    <div className="max-w-lg mx-auto min-h-screen">
      {/* Header */}
      <header className="sticky top-0 z-40 bg-[#0f0f1a]/95 backdrop-blur-md px-4 py-3 flex items-center justify-between border-b border-[#1a1a2e]">
        <h1 className="text-xl font-bold bg-gradient-to-r from-[#6366f1] to-[#a855f7] bg-clip-text text-transparent">
          Bingr
        </h1>
        <a href="/search" className="text-[#9ca3af] hover:text-white transition-colors">
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-5 h-5">
            <path fillRule="evenodd" d="M9 3.5a5.5 5.5 0 100 11 5.5 5.5 0 000-11zM2 9a7 7 0 1112.452 4.391l3.328 3.329a.75.75 0 11-1.06 1.06l-3.329-3.328A7 7 0 012 9z" clipRule="evenodd" />
          </svg>
        </a>
      </header>

      {/* For You */}
      <section className="pt-4">
        <div className="px-4 mb-3">
          <h2 className="text-lg font-semibold">🎯 For You</h2>
          <p className="text-xs text-[#9ca3af]">Personalized picks based on your taste</p>
        </div>
        <HorizontalScroll>
          {forYou.map((item) => (
            <PosterCard key={item.id} item={item} showReason />
          ))}
        </HorizontalScroll>
      </section>

      {/* Trending */}
      <section className="pt-5">
        <div className="px-4 mb-3 flex items-center justify-between">
          <div>
            <h2 className="text-lg font-semibold">🔥 Trending This Week</h2>
            <p className="text-xs text-[#9ca3af]">Most tracked worldwide</p>
          </div>
        </div>
        <HorizontalScroll>
          {trendingAll.map((item) => (
            <PosterCard key={item.id} item={item} />
          ))}
        </HorizontalScroll>
      </section>

      {/* Box Office */}
      <section className="pt-5">
        <div className="px-4 mb-3">
          <h2 className="text-lg font-semibold">🎬 Box Office · Your Country</h2>
          <p className="text-xs text-[#9ca3af]">Top 5 in theaters near you</p>
        </div>
        <div className="px-4 space-y-2">
          {boxOffice.map((movie, i) => (
            <div key={movie.id} className="flex items-center gap-3 bg-[#1a1a2e] rounded-xl p-3">
              <span className={`text-lg font-bold w-6 text-center ${
                i === 0 ? "text-[#f59e0b]" :
                i === 1 ? "text-[#9ca3af]" :
                i === 2 ? "text-amber-700" : "text-[#6b7280]"
              }`}>
                {i + 1}
              </span>
              <div className="flex-1 min-w-0">
                <h3 className="text-sm font-medium text-white truncate">{movie.title}</h3>
                <p className="text-xs text-[#9ca3af]">{movie.year} · ⭐ {movie.rating}</p>
              </div>
              <span className="text-sm font-semibold text-[#a855f7]">{movie.boxOffice}</span>
            </div>
          ))}
        </div>
      </section>

      {/* Streaming Top 10 */}
      <section className="pt-5">
        <div className="px-4 mb-3">
          <h2 className="text-lg font-semibold">📺 Streaming Top 10</h2>
          <p className="text-xs text-[#9ca3af]">Daily rankings on major platforms</p>
        </div>
        <div className="px-4 space-y-2">
          {(["Netflix", "Max", "Prime"] as const).map((platform) => {
            const platformColor =
              platform === "Netflix" ? "text-red-500" :
              platform === "Max" ? "text-blue-400" : "text-sky-400";

            return (
              <div key={platform} className="bg-[#1a1a2e] rounded-xl p-3">
                <h3 className={`text-xs font-bold mb-2 ${platformColor}`}>{platform}</h3>
                <div className="space-y-1">
                  {streamingTop10
                    .filter((s) => s.platform === platform)
                    .map((show, i) => (
                      <div key={i} className="flex items-center gap-2 text-sm">
                        <span className="text-[#9ca3af] w-5 text-right font-mono text-xs">
                          {show.rank}
                        </span>
                        <span className="text-white truncate">{show.title}</span>
                      </div>
                    ))}
                </div>
              </div>
            );
          })}
        </div>
      </section>

      {/* Friends Activity */}
      <section className="pt-5 pb-4">
        <div className="px-4 mb-3">
          <h2 className="text-lg font-semibold">👥 Friends Activity</h2>
        </div>
        <div className="px-4 space-y-3">
          {activities.map((activity) => (
            <div key={activity.id} className="flex items-start gap-3">
              <div className="w-8 h-8 rounded-full bg-gradient-to-br from-[#6366f1] to-[#a855f7] flex items-center justify-center flex-shrink-0">
                <span className="text-xs font-bold text-white">
                  {activity.username[0].toUpperCase()}
                </span>
              </div>
              <div>
                <p className="text-sm text-white">
                  <span className="font-semibold">{activity.username}</span>{" "}
                  {activity.action === "rated" && (
                    <>
                      rated <StarRating rating={activity.rating!} />{" "}
                    </>
                  )}
                  {activity.action === "completed" && "completed "}
                  {activity.action === "added" && "added to Watchlist: "}
                  {activity.action === "reviewed" && "reviewed "}
                  <span className="text-[#a855f7]">{activity.mediaTitle}</span>
                </p>
                <p className="text-xs text-[#9ca3af] mt-0.5">{activity.timestamp}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Bottom padding */}
      <div className="h-4" />
    </div>
  );
}
