export default function Loading() {
  return (
    <div className="max-w-lg md:max-w-4xl mx-auto min-h-screen pb-24 animate-pulse">
      <div className="w-full h-64 md:h-96 bg-white/5 rounded-b-2xl" />
      <div className="px-4 md:px-0 mt-6 space-y-4">
        <div className="h-8 w-1/3 bg-white/5 rounded" />
        <div className="h-4 w-2/3 bg-white/5 rounded" />
        <div className="flex gap-2">
          {[1,2,3].map(i => <div key={i} className="h-6 w-16 bg-white/5 rounded-full" />)}
        </div>
      </div>
    </div>
  );
}
