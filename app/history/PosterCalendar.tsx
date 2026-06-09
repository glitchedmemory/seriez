"use client";

import { useMemo } from "react";
import PosterStack, { PosterData } from "@/components/PosterStack";
import type { DayEntry } from "./DayPopup";

interface PosterCalendarProps {
  year: number;
  month: number; // 1-12
  days: Record<string, DayEntry[]>;
  onDayClick: (date: string, entries: DayEntry[]) => void;
  onPrevMonth: () => void;
  onNextMonth: () => void;
}

const DAYS_OF_WEEK = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

export default function PosterCalendar({
  year,
  month,
  days,
  onDayClick,
  onPrevMonth,
  onNextMonth,
}: PosterCalendarProps) {
  const calendarGrid = useMemo(() => {
    const firstDay = new Date(year, month - 1, 1);
    const lastDay = new Date(year, month, 0);
    const totalDays = lastDay.getDate();
    const startDow = firstDay.getDay();

    const cells: (number | null)[] = [];
    for (let i = 0; i < startDow; i++) cells.push(null);
    for (let d = 1; d <= totalDays; d++) cells.push(d);
    while (cells.length % 7 !== 0) cells.push(null);
    return cells;
  }, [year, month]);

  const today = new Date();
  const isCurrentMonth =
    today.getFullYear() === year && today.getMonth() === month - 1;
  const todayDate = today.getDate();

  return (
    <div className="bg-[#1a1a2e] border border-[#2d2d4a] rounded-2xl p-3">
      {/* Month navigation */}
      <div className="flex items-center justify-between mb-3 px-1">
        <button
          onClick={onPrevMonth}
          className="w-8 h-8 flex items-center justify-center rounded-lg bg-[#0f0f1a] text-[#9ca3af] hover:bg-[#2d2d4a] hover:text-white transition-colors text-sm"
          aria-label="Previous month"
        >
          ◀
        </button>
        <h2 className="text-white text-base font-bold">
          {MONTHS[month - 1]} {year}
        </h2>
        <button
          onClick={onNextMonth}
          className="w-8 h-8 flex items-center justify-center rounded-lg bg-[#0f0f1a] text-[#9ca3af] hover:bg-[#2d2d4a] hover:text-white transition-colors text-sm"
          aria-label="Next month"
        >
          ▶
        </button>
      </div>

      {/* Day headers */}
      <div className="grid grid-cols-7 mb-1.5">
        {DAYS_OF_WEEK.map((d) => (
          <div
            key={d}
            className="text-center text-[11px] font-semibold text-[#6b7280] uppercase tracking-wide py-1"
          >
            {d}
          </div>
        ))}
      </div>

      {/* Calendar grid */}
      <div className="grid grid-cols-7 gap-1.5">
        {calendarGrid.map((day, i) => {
          if (day === null) {
            return <div key={`empty-${i}`} className="aspect-square" />;
          }

          const dateKey = `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
          const entries = days[dateKey] || [];
          const isEmpty = entries.length === 0;
          const isToday = isCurrentMonth && day === todayDate;

          const posterData: PosterData[] = entries.map((e) => ({
            tmdbId: e.tmdbId,
            title: e.title,
            posterPath: e.posterPath,
          }));

          return (
            <button
              key={dateKey}
              onClick={() => !isEmpty && onDayClick(dateKey, entries)}
              className={`relative aspect-square rounded-lg overflow-hidden transition-all ${
                isEmpty
                  ? "bg-[#111122] hover:bg-[#1a1a35]"
                  : "cursor-pointer hover:scale-[1.03]"
              } ${
                isToday
                  ? "ring-2 ring-indigo-400 ring-offset-1 ring-offset-[#0f0f1a]"
                  : ""
              }`}
              disabled={isEmpty}
              aria-label={`${dateKey}${!isEmpty ? ` - ${entries.length} title${entries.length > 1 ? "s" : ""}` : ""}`}
            >
              {isEmpty ? (
                <span className="absolute bottom-0.5 right-1.5 text-[11px] font-medium text-[#5a5a7a]">
                  {day}
                </span>
              ) : (
                <PosterStack
                  posters={posterData}
                  day={day}
                  count={entries.length}
                />
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}
