"use client";

import { useState, useEffect, useMemo } from "react";
import { createClient } from "@/lib/supabase/client";
import { ListSkeleton } from "@/components/Skeletons";
import ErrorBoundary from "@/components/ErrorBoundary";
import PosterImage from "@/components/PosterImage";
import EmptyState from "@/components/EmptyState";

// ─── Types ───
interface LibraryItem {
  tmdbId: number; mediaType: string; status: string; rating: number | null;
  progress: number | null; updatedAt: string; title: string; poster: string | null;
  year: number | null; tmdbRating: number;
}
interface Collection { id: string; name: string; isPublic: boolean; isPublished: boolean; itemCount: number; createdAt: string; }
interface CollectionItem { tmdbId: number; mediaType: string; title: string; poster: string | null; year: number | null; rating: number; addedAt: string; }

const TABS = [
  { key: "plan_to_watch", label: "To Watch" },
  { key: "watching", label: "Watching" },
  { key: "completed", label: "Watched" },
];

const SORT_OPTIONS = [
  { key: "recent", label: "Recent" },
  { key: "rating", label: "My Rating" },
  { key: "popularity", label: "Popular" },
  { key: "year", label: "Year" },
] as const;
type SortKey = typeof SORT_OPTIONS[number]["key"];

// ─── Tracking grid ───
function TrackingGrid({ activeTab }: { activeTab: string }) {
  const [items, setItems] = useState<LibraryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [sort, setSort] = useState<SortKey>("recent");

  useEffect(() => {
    const username = localStorage.getItem("seriez-username") || "Anonymous";
    const url = activeTab
      ? `/api/library?username=${encodeURIComponent(username)}&status=${activeTab}`
      : `/api/library?username=${encodeURIComponent(username)}`;
    setLoading(true);
    fetch(url).then(r => r.json()).then(data => { setItems(data.items || []); setLoading(false); }).catch(() => setLoading(false));
  }, [activeTab]);

  const sortedItems = useMemo(() => {
    const sorted = [...items];
    switch (sort) {
      case "rating": sorted.sort((a, b) => (b.rating ?? 0) - (a.rating ?? 0)); break;
      case "popularity": sorted.sort((a, b) => (b.tmdbRating ?? 0) - (a.tmdbRating ?? 0)); break;
      case "year": sorted.sort((a, b) => (b.year ?? 0) - (a.year ?? 0)); break;
      default: break;
    }
    return sorted;
  }, [items, sort]);

  if (loading) return <ListSkeleton rows={6} />;
  if (items.length === 0) return <EmptyState icon="📚" title={activeTab ? `No ${TABS.find(t=>t.key===activeTab)?.label || "items"} yet` : "Your library is empty"} description="Start tracking movies and shows to build your collection." action={{ label: "Discover titles", href: "/" }} />;

  return (
    <div className="px-4 mt-4">
      {/* Sort bar */}
      <div className="flex gap-1.5 mb-3">
        {SORT_OPTIONS.map(opt => (
          <button
            key={opt.key}
            onClick={() => setSort(opt.key)}
            className={`px-3 py-1 rounded-full text-[11px] font-medium transition-colors ${
              sort === opt.key
                ? "bg-accent text-white"
                : "bg-bg-card text-text-secondary hover:text-text-primary"
            }`}
          >
            {opt.label}
          </button>
        ))}
      </div>

      {/* ── AdSense ── */}
      <div className="mb-3">
        <div className="bg-bg-card border border-dashed border-border rounded-xl flex items-center justify-center" style={{ minHeight: 80 }}>
          <div className="text-center">
            <p className="text-[10px] text-text-secondary uppercase tracking-[0.15em] mb-1">Advertisement</p>
            <p className="text-xs text-text-secondary">AdSense · 320×100</p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3">
        {sortedItems.map(item => (
        <a key={`${item.mediaType}-${item.tmdbId}`} href={`/title/${item.tmdbId}${item.mediaType === "tv" ? "/season/1" : `?type=${item.mediaType}`}`} className="block group">
          <div className="relative aspect-[2/3] rounded-xl overflow-hidden bg-bg-card">
            {item.poster ? <PosterImage src={item.poster} alt={item.title} fill className="rounded-xl group-hover:scale-105 transition-transform duration-300" sizes="(max-width: 768px) 33vw, 200px" /> : <div className="w-full h-full flex items-center justify-center text-text-primary/20 text-2xl font-bold">{item.title.slice(0,2)}</div>}
            <div className="absolute top-2 left-2"><span className={`px-1.5 py-0.5 rounded text-[10px] font-semibold ${item.status==="completed"?"bg-green-500/20 text-green-400":item.status==="watching"?"bg-blue-500/20 text-blue-400":"bg-amber-500/20 text-amber-400"}`}>{item.status==="completed"?"Watched":item.status==="watching"?"Watching":"To Watch"}</span></div>
            {item.tmdbRating > 0 && <div className="absolute top-2 right-2 bg-black/60 backdrop-blur-sm rounded-full px-1.5 py-0.5 text-[10px] font-semibold text-gold">★ {item.tmdbRating}</div>}
            {item.rating && <div className="absolute bottom-2 left-2 bg-black/60 backdrop-blur-sm rounded-full px-1.5 py-0.5 text-[10px] font-semibold text-pink-400">★ {item.rating}</div>}
          </div>
          <p className="mt-1.5 text-xs font-medium text-text-primary leading-tight line-clamp-2 group-hover:text-accent transition-colors">{item.title}</p>
          <p className="text-[10px] text-text-secondary">{item.year || "—"} · {item.mediaType==="movie"?"Movie":"TV"}</p>
        </a>
      ))}
      </div>
    </div>
  );
}

// ─── Collections view ───
function CollectionsView() {
  const [collections, setCollections] = useState<Collection[]>([]);
  const [loading, setLoading] = useState(true);
  const [newName, setNewName] = useState("");
  const [creating, setCreating] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [items, setItems] = useState<CollectionItem[]>([]);
  const [itemsLoading, setItemsLoading] = useState(false);
  const [authUser, setAuthUser] = useState<{ email?: string; user_metadata?: { username?: string } } | null>(null);
  const [isPremium, setIsPremium] = useState(false);
  const supabase = createClient();
  const username = typeof window !== "undefined" ? localStorage.getItem("seriez-username") || "" : "";

  const fetchCollections = () => {
    setLoading(true);
    Promise.all([
      fetch(`/api/collections?username=${encodeURIComponent(username)}`).then(r => r.json()),
      fetch(`/api/profile?username=${encodeURIComponent(username)}`).then(r => r.json()),
    ])
      .then(([collData, profileData]) => {
        setCollections(collData.collections || []);
        setIsPremium(profileData.is_premium || false);
        setLoading(false);
      }).catch(() => setLoading(false));
  };

  useEffect(() => { fetchCollections(); supabase.auth.getSession().then(({ data: { session } }) => setAuthUser(session?.user ?? null)).catch(() => {}); }, []);

  const fetchItems = (listId: string) => {
    setItemsLoading(true);
    fetch(`/api/collections/${listId}/items?username=${encodeURIComponent(username)}`)
      .then(r => r.json()).then(d => { setItems(d.items || []); setItemsLoading(false); }).catch(() => setItemsLoading(false));
  };

  const createCollection = async () => {
    if (!newName.trim() || creating || !authUser) return;
    setCreating(true);
    setErrorMsg(null);
    try {
      const res = await fetch("/api/collections", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ username, name: newName.trim() }) });
      if (res.ok) { setNewName(""); fetchCollections(); }
      else { const data = await res.json().catch(() => ({})); setErrorMsg(data.error || "Failed to create collection"); }
    } catch {
      setErrorMsg("Network error — please try again");
    }
    setCreating(false);
  };

  const deleteCollection = async (id: string) => {
    await fetch("/api/collections", { method: "DELETE", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ username, listId: id }) });
    if (selectedId === id) setSelectedId(null);
    fetchCollections();
  };

  const removeItem = async (listId: string, tmdbId: number, mediaType: string) => {
    await fetch(`/api/collections/${listId}/items`, { method: "DELETE", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ username, tmdbId, mediaType }) });
    fetchItems(listId); fetchCollections();
  };

  const togglePublish = async (listId: string) => {
    await fetch(`/api/collections/${listId}/publish`, { method: "POST" });
    fetchCollections();
  };

  if (selectedId) {
    const collection = collections.find(c => c.id === selectedId);
    return (
      <div className="px-4 mt-4">
        <div className="flex items-center gap-3 mb-4">
          <button onClick={() => setSelectedId(null)} className="text-text-secondary hover:text-text-primary text-sm">← Back</button>
          <h2 className="text-lg font-semibold text-text-primary">{collection?.name}</h2>
          <span className="text-xs text-text-secondary">{items.length} items</span>
        </div>
        {itemsLoading ? <div className="flex justify-center py-10"><div className="w-6 h-6 border-2 border-accent border-t-transparent rounded-full animate-spin" /></div>
        : items.length === 0 ? <EmptyState icon="🎞️" title="No items yet" description="Add movies and shows to this collection." action={{ label: "Browse titles", href: "/" }} />
        : <div className="grid grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3">
          {items.map(item => (
            <div key={`${item.mediaType}-${item.tmdbId}`} className="relative group">
              <a href={`/title/${item.tmdbId}${item.mediaType==="tv"?"/season/1":`?type=${item.mediaType}`}`} className="block">
                <div className="relative aspect-[2/3] rounded-xl overflow-hidden bg-bg-card">
                  {item.poster ? <PosterImage src={item.poster} alt={item.title} fill className="rounded-xl group-hover:scale-105 transition-transform duration-300" sizes="(max-width: 768px) 33vw, 200px" /> : <div className="w-full h-full flex items-center justify-center text-text-primary/20 text-2xl font-bold">{item.title.slice(0,2)}</div>}
                  {item.rating > 0 && <div className="absolute top-2 right-2 bg-black/60 backdrop-blur-sm rounded-full px-1.5 py-0.5 text-[10px] font-semibold text-gold">★ {item.rating}</div>}
                  <button onClick={(e) => { e.preventDefault(); removeItem(selectedId, item.tmdbId, item.mediaType); }} className="absolute top-2 left-2 bg-red-500/80 hover:bg-red-500 rounded-full w-5 h-5 flex items-center justify-center text-text-primary text-[10px] opacity-0 group-hover:opacity-100 transition-opacity">✕</button>
                </div>
                <p className="mt-1.5 text-xs font-medium text-text-primary leading-tight line-clamp-2">{item.title}</p>
                <p className="text-[10px] text-text-secondary">{item.year||"—"} · {item.mediaType==="movie"?"Movie":"TV"}</p>
              </a>
            </div>
          ))}
        </div>}
      </div>
    );
  }

  return (
    <div className="px-4 mt-4">
      {!authUser ? (
        <EmptyState icon="🔐" title="Sign in to create collections" description="Create an account to make custom collections and share them." action={{ label: "Create account", href: "/signup" }} />
      ) : (
      <>
      {(() => {
        const atLimit = !isPremium && collections.length >= 3;
        return (
          <div className="mb-4">
            <div className="flex gap-2">
              <input value={newName} onChange={e => setNewName(e.target.value)} onKeyDown={e => e.key==="Enter" && createCollection()}
                placeholder={atLimit ? "Collection limit reached" : "New collection name..."}
                disabled={atLimit}
                className="flex-1 bg-bg-card text-text-primary text-sm rounded-xl px-3 py-2 outline-none border border-border focus:border-accent placeholder:text-text-secondary disabled:opacity-40 disabled:cursor-not-allowed" maxLength={50} />
              <button onClick={createCollection} disabled={creating || !newName.trim() || atLimit}
                className="px-4 py-2 rounded-xl bg-accent text-white text-sm font-medium disabled:opacity-40 hover:bg-[#5558e7] transition-colors">Create</button>
            </div>
            {atLimit && (
              <p className="mt-2 text-xs text-amber-400">Free plan limited to 3 collections. <a href="/profile/settings" className="underline hover:text-amber-300">Upgrade to Golden Ticket</a> for unlimited.</p>
            )}
            {errorMsg && (
              <p className="mt-2 text-xs text-red-400">{errorMsg}</p>
            )}
          </div>
        );
      })()}
      {loading ? <div className="flex justify-center py-10"><div className="w-6 h-6 border-2 border-accent border-t-transparent rounded-full animate-spin" /></div>
      : collections.length === 0 ? <EmptyState icon="🗂️" title="No collections yet" description="Create your first collection to organize your favorite titles." />
      : <div className="space-y-2">
        {collections.map(c => (
          <div key={c.id} className="flex items-center gap-3 bg-bg-card rounded-xl p-3 hover:bg-bg-surface transition-colors cursor-pointer group" onClick={() => { setSelectedId(c.id); fetchItems(c.id); }}>
            <div className="flex-1 min-w-0"><p className="text-sm font-medium text-text-primary truncate">{c.name}</p><p className="text-xs text-text-secondary">{c.itemCount} item{c.itemCount !== 1 ? "s" : ""}</p></div>
            <button onClick={e => { e.stopPropagation(); togglePublish(c.id); }} className={`text-[10px] font-medium px-2 py-1 rounded-lg transition-colors ${c.isPublished ? "bg-[#374151]/50 text-text-secondary hover:bg-[#374151]" : "bg-accent/10 text-[#818cf8] hover:bg-accent/20"}`}>{c.isPublished ? "혼자보기" : "발행하기"}</button>
            <button onClick={e => { e.stopPropagation(); deleteCollection(c.id); }} className="text-text-secondary hover:text-red-400 text-lg opacity-0 group-hover:opacity-100 transition-opacity">🗑</button>
          </div>
        ))}
      </div>}
      </>
      )}
    </div>
  );
}

// ─── Main Library ───
export default function LibraryClient() {
  const [activeFilter, setActiveFilter] = useState<"completed" | "watching" | "plan_to_watch" | "collections" | null>("completed");
  const [stats, setStats] = useState({ plan_to_watch: 0, watching: 0, completed: 0, collections: 0 });
  const [statsLoaded, setStatsLoaded] = useState(false);

  useEffect(() => {
    const username = typeof window !== "undefined" ? localStorage.getItem("seriez-username") || "Anonymous" : "Anonymous";
    Promise.all([
      fetch(`/api/library?username=${encodeURIComponent(username)}`).then(r => r.json()),
      fetch(`/api/collections?username=${encodeURIComponent(username)}`).then(r => r.json()),
    ])
      .then(([libData, collData]) => {
        const items = libData.items || [];
        setStats({
          completed: items.filter((i: LibraryItem) => i.status === "completed").length,
          watching: items.filter((i: LibraryItem) => i.status === "watching").length,
          plan_to_watch: items.filter((i: LibraryItem) => i.status === "plan_to_watch").length,
          collections: (collData.collections || []).length,
        });
        setStatsLoaded(true);
      })
      .catch(() => setStatsLoaded(true));
  }, []);

  return (
    <div className="max-w-lg md:max-w-4xl mx-auto min-h-screen pb-24">
      <header className="sticky top-0 z-40 bg-bg-primary/95 backdrop-blur-md px-4 py-3 border-b border-border">
        <h1 className="text-xl font-bold bg-gradient-to-r from-[#6366f1] to-[#a855f7] bg-clip-text text-transparent">My List</h1>
      </header>

      {/* Stats bar */}
      {statsLoaded && (
        <div className="flex gap-3 px-4 py-3 border-b border-border">
          <button onClick={() => setActiveFilter(activeFilter === "completed" ? null : "completed")}
            className={`flex-1 text-center py-2 rounded-xl text-xs font-medium transition-all ${
              activeFilter === "completed"
                ? "bg-[#10b981]/10 text-[#10b981] border border-[#10b981]/30"
                : "bg-bg-card text-text-secondary hover:text-[#10b981]"
            }`}>
            <span className="block text-lg font-bold">{stats.completed}</span>WATCHED
          </button>
          <button onClick={() => setActiveFilter(activeFilter === "watching" ? null : "watching")}
            className={`flex-1 text-center py-2 rounded-xl text-xs font-medium transition-all ${
              activeFilter === "watching"
                ? "bg-[#3b82f6]/10 text-[#3b82f6] border border-[#3b82f6]/30"
                : "bg-bg-card text-text-secondary hover:text-[#3b82f6]"
            }`}>
            <span className="block text-lg font-bold">{stats.watching}</span>WATCHING
          </button>
          <button onClick={() => setActiveFilter(activeFilter === "plan_to_watch" ? null : "plan_to_watch")}
            className={`flex-1 text-center py-2 rounded-xl text-xs font-medium transition-all ${
              activeFilter === "plan_to_watch"
                ? "bg-gold/10 text-gold border border-gold/30"
                : "bg-bg-card text-text-secondary hover:text-gold"
            }`}>
            <span className="block text-lg font-bold">{stats.plan_to_watch}</span>TO WATCH
          </button>
          <button onClick={() => setActiveFilter(activeFilter === "collections" ? null : "collections")}
            className={`flex-1 text-center py-2 rounded-xl text-xs font-medium transition-all ${
              activeFilter === "collections"
                ? "bg-accent-light/10 text-accent-light border border-[#a855f7]/30"
                : "bg-bg-card text-text-secondary hover:text-accent-light"
            }`}>
            <span className="block text-lg font-bold">{stats.collections}</span>COLLECTIONS
          </button>
        </div>
      )}

      {/* Content */}
      {!activeFilter ? (
        <div className="px-4 mt-4">
          <EmptyState icon="📚" title="Your list is empty" description="Start tracking movies and shows to build your collection." action={{ label: "Discover titles", href: "/" }} />
        </div>
      ) : activeFilter === "collections" ? (
        <CollectionsView />
      ) : (
        <TrackingGrid activeTab={activeFilter} />
      )}
    </div>
  );
}
