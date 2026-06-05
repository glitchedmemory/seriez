export interface MediaItem {
  id: number;
  title: string;
  rating: number;
  year: number;
  type: "movie" | "tv" | "anime";
  reason?: string;
  boxOffice?: string;
  daysUntil?: number;
  gradient: string;
}

export interface FriendActivity {
  id: string;
  username: string;
  avatar: string;
  action: "rated" | "completed" | "added" | "reviewed";
  mediaTitle: string;
  rating?: number;
  timestamp: string;
}

export const trendingAll: MediaItem[] = [
  { id: 1, title: "Obsession", gradient: "from-rose-500 to-pink-600", rating: 4.2, year: 2025, type: "movie" },
  { id: 2, title: "Backrooms", gradient: "from-amber-500 to-orange-600", rating: 3.8, year: 2026, type: "movie" },
  { id: 3, title: "Spider-Noir", gradient: "from-red-600 to-red-800", rating: 4.5, year: 2026, type: "tv" },
  { id: 4, title: "Masters of the Universe", gradient: "from-sky-500 to-blue-700", rating: 4.0, year: 2026, type: "movie" },
  { id: 5, title: "Scary Movie 6", gradient: "from-purple-600 to-violet-800", rating: 3.5, year: 2026, type: "movie" },
  { id: 6, title: "Mandalorian & Grogu", gradient: "from-emerald-500 to-teal-600", rating: 4.3, year: 2026, type: "movie" },
];

export const forYou: MediaItem[] = [
  { id: 7, title: "Dune: Part Three", gradient: "from-amber-600 to-yellow-700", rating: 4.6, year: 2027, type: "movie", reason: "You loved Dune: Part Two" },
  { id: 8, title: "The Last of Us S2", gradient: "from-green-600 to-emerald-700", rating: 4.7, year: 2026, type: "tv", reason: "Based on your sci-fi taste" },
  { id: 9, title: "Solo Leveling S2", gradient: "from-blue-600 to-indigo-700", rating: 4.8, year: 2026, type: "anime", reason: "Popular in anime community" },
  { id: 10, title: "Severance S3", gradient: "from-slate-600 to-gray-700", rating: 4.5, year: 2026, type: "tv", reason: "Similar to shows you liked" },
  { id: 11, title: "Project Hail Mary", gradient: "from-cyan-500 to-blue-600", rating: 4.4, year: 2026, type: "movie", reason: "Sci-fi fans love this" },
  { id: 12, title: "Frieren S2", gradient: "from-violet-500 to-purple-600", rating: 4.9, year: 2026, type: "anime", reason: "Based on your anime ratings" },
];

export const boxOffice: MediaItem[] = [
  { id: 101, title: "Obsession", gradient: "from-rose-500 to-pink-600", rating: 4.2, year: 2025, type: "movie", boxOffice: "$12.4M" },
  { id: 102, title: "Backrooms", gradient: "from-amber-500 to-orange-600", rating: 3.8, year: 2026, type: "movie", boxOffice: "$9.8M" },
  { id: 103, title: "Scary Movie 6", gradient: "from-purple-600 to-violet-800", rating: 3.5, year: 2026, type: "movie", boxOffice: "$7.2M" },
  { id: 104, title: "Masters of the Universe", gradient: "from-sky-500 to-blue-700", rating: 4.0, year: 2026, type: "movie", boxOffice: "$5.6M" },
  { id: 105, title: "Mandalorian & Grogu", gradient: "from-emerald-500 to-teal-600", rating: 4.3, year: 2026, type: "movie", boxOffice: "$4.1M" },
];

export const activities: FriendActivity[] = [
  { id: "1", username: "jimin", avatar: "", action: "rated", mediaTitle: "Inception", rating: 5, timestamp: "2h ago" },
  { id: "2", username: "taeho", avatar: "", action: "completed", mediaTitle: "Severance S2", timestamp: "5h ago" },
  { id: "3", username: "soohyun", avatar: "", action: "added", mediaTitle: "Dune 3", timestamp: "7h ago" },
  { id: "4", username: "yuna", avatar: "", action: "reviewed", mediaTitle: "The Batman II", timestamp: "10h ago" },
];

export const streamingTop10 = [
  { platform: "Netflix", title: "Ladies First", rank: 1 },
  { platform: "Netflix", title: "Swapped", rank: 2 },
  { platform: "Netflix", title: "Creed III", rank: 3 },
  { platform: "Max", title: "Obsession", rank: 1 },
  { platform: "Max", title: "Backrooms", rank: 2 },
  { platform: "Prime", title: "The Crash", rank: 1 },
  { platform: "Prime", title: "GOAT", rank: 2 },
];

export const upcoming: MediaItem[] = [
  { id: 201, title: "Avatar: Fire & Ash", gradient: "from-cyan-500 to-blue-700", rating: 0, year: 2026, type: "movie", daysUntil: 14 },
  { id: 202, title: "Spider-Man: Beyond", gradient: "from-red-500 to-red-700", rating: 0, year: 2027, type: "movie", daysUntil: 28 },
  { id: 203, title: "Stranger Things S5", gradient: "from-red-600 to-orange-700", rating: 0, year: 2026, type: "tv", daysUntil: 45 },
  { id: 204, title: "Attack on Titan Movie", gradient: "from-amber-600 to-yellow-800", rating: 0, year: 2026, type: "anime", daysUntil: 7 },
  { id: 205, title: "The Batman II", gradient: "from-slate-700 to-gray-900", rating: 0, year: 2027, type: "movie", daysUntil: 90 },
  { id: 206, title: "Jujutsu Kaisen S3", gradient: "from-purple-600 to-indigo-800", rating: 0, year: 2026, type: "anime", daysUntil: 21 },
];
