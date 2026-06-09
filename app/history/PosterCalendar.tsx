"use client";

import { useMemo } from "react";
import Image from "next/image";
import type { DayEntry } from "./DayPopup";

const TMDB_IMAGE = "https://image.tmdb.org/t/p/w185";

interface PosterCalendarProps {
  year: number;
  month: number;
  days: Record<string, DayEntry[]>;
  onDayClick: (date: string, entries: DayEntry[]) => void;
  onPrevMonth: () => void;
  onNextMonth: () => void;
  fetching: boolean;
}

const DAYS_OF_WEEK = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

export default function PosterCalendar({
  year, month, days, onDayClick, onPrevMonth, onNextMonth, fetching,
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
  const isCurrentMonth = today.getFullYear() === year && today.getMonth() === month - 1;
  const todayDate = today.getDate();

  return (
    <div className={`transition-opacity ${fetching ? "opacity-50" : ""}`}>
      {/* Month header */}
      <div className="flex items-center justify-center gap-5 py-2 mb-1">
        <button onClick={onPrevMonth} className="text-[#6366f1] text-lg font-light px-1 hover:text-[#818cf8] transition-colors" aria-label="Previous month">
          ‹
        </button>
        <h2 className="text-lg font-bold text-white tracking-tight">
          {MONTHS[month - 1]} {year}
        </h2>
        <button onClick={onNextMonth} className="text-[#6366f1] text-lg font-light px-1 hover:text-[#818cf8] transition-colors" aria-label="Next month">
          ›
        </button>
      </div>

      {/* Day headers */}
      <div className="grid grid-cols-7 text-center border-b border-[#1a1a2e] pb-2 mb-1.5">
        {DAYS_OF_WEEK.map((d, i) => (
          <div
            key={d}
            className={`text-xs font-semibold py-1 tracking-wide ${
              i === 0 ? "text-[#ef4444]" : i === 6 ? "text-[#6366f1]" : "text-[#6b7280]"
            }`}
          >
            {d}
          </div>
        ))}
      </div>

      {/* Calendar grid */}
      <div className="grid grid-cols-7 gap-px">
        {calendarGrid.map((day, i) => {
          if (day === null) {
            return <div key={`empty-${i}`} className="min-h-[52px]" />;
          }

          const pad = String(day).padStart(2, "0");
          const dateKey = `${year}-${String(month).padStart(2, "0")}-${pad}`;
          const entries = days[dateKey] || [];
          const isEmpty = entries.length === 0;
          const isToday = isCurrentMonth && day === todayDate;

          // Use first entry's poster for the thumbnail
          const firstEntry = entries[0];
          const posterUrl = firstEntry?.posterPath
            ? `${TMDB_IMAGE}${firstEntry.posterPath}`
            : null;

          return (
            <div
              key={dateKey}
              className={`relative flex flex-col items-center pt-0.5 ${entries.length > 0 ? "min-h-[88px]" : "min-h-[52px]"}`}
            >
              {/* Day number */}
              <button
                onClick={() => !isEmpty && onDayClick(dateKey, entries)}
                disabled={isEmpty}
                className={`w-6 h-6 flex items-center justify-center rounded-full text-xs font-medium transition-colors ${
                  isToday
                    ? "bg-[#6366f1] text-white font-bold"
                    : i % 7 === 0
                    ? "text-[#ef4444]"
                    : i % 7 === 6
                    ? "text-[#6366f1]"
                    : "text-[#d1d5db]"
                } ${!isEmpty ? "cursor-pointer hover:bg-[#1a1a2e]" : ""}`}
              >
                {day}
              </button>

              {/* Poster thumbnail */}
              {!isEmpty && (
                <button
                  onClick={() => onDayClick(dateKey, entries)}
                  className="w-full flex-1 mt-0.5 rounded-md overflow-hidden relative cursor-pointer hover:opacity-90 transition-opacity"
                >
                  {posterUrl ? (
                    <Image
                      src={posterUrl}
                      alt={firstEntry.title}
                      fill
                      className="object-cover"
                      unoptimized
                    />
                  ) : (
                    <div className="w-full h-full bg-gradient-to-br from-indigo-600 to-purple-800 flex items-center justify-center min-h-[56px]">
                      <span className="text-white/60 text-[10px] font-semibold text-center px-1 leading-tight">
                        {firstEntry.title.slice(0, 10)}
                      </span>
                    </div>
                  )}
                  {/* Title overlay */}
                  <div className="absolute bottom-0 left-0 right-0 bg-black/60 px-1 py-0.5">
                    <p className="text-[7px] font-bold text-white truncate leading-tight text-center">
                      {firstEntry.title.length > 10
                        ? firstEntry.title.slice(0, 10) + "…"
                        : firstEntry.title}
                    </p>
                  </div>
                </button>
              )}
            </div>
          );
        })}
      </div>

      {/* View full calendar link */}
      <div className="text-center mt-3 pb-1">
        <button
          onClick={() => onDayClick("", [])}
          className="text-[13px] font-semibold text-[#6366f1] hover:text-[#818cf8] transition-colors"
        >
          View Full Calendar ›
        </button>
      </div>
    </div>
  );
}
