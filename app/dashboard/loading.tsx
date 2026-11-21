import React from "react";
import { Loader2 } from "lucide-react";

export default function DashboardLoading() {
  return (
    <div className="space-y-6 animate-pulse">
      {/* Header Skeleton */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2 border-b border-[#1F2937]/50">
        <div className="space-y-2">
          <div className="h-7 w-64 bg-slate-800/80 rounded-lg" />
          <div className="h-4 w-96 bg-slate-800/40 rounded-md" />
        </div>
        <div className="h-9 w-32 bg-slate-800/60 rounded-xl" />
      </div>

      {/* Stat Cards Skeleton */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {[1, 2, 3, 4].map((i) => (
          <div
            key={i}
            className="h-28 bg-[#111827]/70 border border-[#1F2937] rounded-2xl p-5 space-y-3"
          >
            <div className="flex items-center justify-between">
              <div className="h-4 w-24 bg-slate-800 rounded" />
              <div className="h-8 w-8 bg-slate-800 rounded-xl" />
            </div>
            <div className="h-7 w-16 bg-slate-800 rounded" />
          </div>
        ))}
      </div>

      {/* Main Content Skeleton */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 h-96 bg-[#111827]/60 border border-[#1F2937] rounded-2xl p-6 space-y-4">
          <div className="h-5 w-40 bg-slate-800 rounded" />
          <div className="space-y-3 pt-2">
            {[1, 2, 3].map((j) => (
              <div key={j} className="h-16 bg-slate-800/40 rounded-xl" />
            ))}
          </div>
        </div>
        <div className="h-96 bg-[#111827]/60 border border-[#1F2937] rounded-2xl p-6 space-y-4">
          <div className="h-5 w-32 bg-slate-800 rounded" />
          <div className="space-y-3 pt-2">
            {[1, 2, 3].map((k) => (
              <div key={k} className="h-12 bg-slate-800/30 rounded-xl" />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
