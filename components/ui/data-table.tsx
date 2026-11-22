"use client";

import React, { useState, useMemo } from "react";
import { ArrowUpDown, ArrowUp, ArrowDown, Search } from "lucide-react";
import { Input } from "@/components/ui/input";
import { EmptyState } from "@/components/ui/empty-state";

export interface Column<T> {
  key: string;
  header: string;
  render?: (item: T) => React.ReactNode;
  sortable?: boolean;
  className?: string;
}

export interface DataTableProps<T> {
  data: T[];
  columns: Column<T>[];
  keyExtractor: (item: T) => string;
  searchPlaceholder?: string;
  searchFilter?: (item: T, query: string) => boolean;
  emptyTitle?: string;
  emptyDescription?: string;
  actions?: React.ReactNode;
  pageSize?: number;
}

export function DataTable<T>({
  data,
  columns,
  keyExtractor,
  searchPlaceholder,
  searchFilter,
  emptyTitle = "Aucun enregistrement trouvé",
  emptyDescription = "Aucune donnée ne correspond à vos critères de recherche.",
  actions,
  pageSize = 10,
}: DataTableProps<T>) {
  const [search, setSearch] = useState("");
  const [sortKey, setSortKey] = useState<string | null>(null);
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("asc");
  const [currentPage, setCurrentPage] = useState(1);

  const filteredData = useMemo(() => {
    let list = [...data];
    if (search.trim() && searchFilter) {
      list = list.filter((item) => searchFilter(item, search.trim().toLowerCase()));
    }
    if (sortKey) {
      list.sort((a: any, b: any) => {
        const valA = a[sortKey];
        const valB = b[sortKey];
        if (valA === valB) return 0;
        if (valA == null) return 1;
        if (valB == null) return -1;
        const res = valA > valB ? 1 : -1;
        return sortOrder === "asc" ? res : -res;
      });
    }
    return list;
  }, [data, search, searchFilter, sortKey, sortOrder]);

  const totalPages = Math.ceil(filteredData.length / pageSize) || 1;
  const paginatedData = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return filteredData.slice(start, start + pageSize);
  }, [filteredData, currentPage, pageSize]);

  const handleSort = (key: string) => {
    if (sortKey === key) {
      if (sortOrder === "asc") setSortOrder("desc");
      else {
        setSortKey(null);
        setSortOrder("asc");
      }
    } else {
      setSortKey(key);
      setSortOrder("asc");
    }
  };

  return (
    <div className="space-y-4">
      {/* Controls toolbar */}
      {(searchFilter || actions) && (
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
          {searchFilter && (
            <div className="w-full sm:w-72">
              <Input
                value={search}
                onChange={(e) => {
                  setSearch(e.target.value);
                  setCurrentPage(1);
                }}
                placeholder={searchPlaceholder || "Rechercher..."}
                icon={<Search size={15} />}
              />
            </div>
          )}
          {actions && <div className="flex items-center gap-2 self-end">{actions}</div>}
        </div>
      )}

      {/* Table Surface */}
      <div className="rounded-2xl border border-[#1F2937] bg-[#111827]/70 backdrop-blur-md overflow-hidden shadow-xl shadow-black/40">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs text-slate-300">
            <thead className="bg-[#0B1020]/90 text-[11px] font-semibold uppercase tracking-wider text-slate-400 border-b border-[#1F2937]">
              <tr>
                {columns.map((col) => (
                  <th
                    key={col.key}
                    scope="col"
                    className={`py-3.5 px-4 ${col.className || ""}`}
                  >
                    {col.sortable ? (
                      <button
                        onClick={() => handleSort(col.key)}
                        className="inline-flex items-center gap-1 hover:text-white transition-colors focus:outline-none"
                      >
                        <span>{col.header}</span>
                        {sortKey === col.key ? (
                          sortOrder === "asc" ? (
                            <ArrowUp size={12} className="text-uec-cyan" />
                          ) : (
                            <ArrowDown size={12} className="text-uec-cyan" />
                          )
                        ) : (
                          <ArrowUpDown size={12} className="text-slate-600" />
                        )}
                      </button>
                    ) : (
                      <span>{col.header}</span>
                    )}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-[#1F2937]/50">
              {paginatedData.length > 0 ? (
                paginatedData.map((item) => (
                  <tr
                    key={keyExtractor(item)}
                    className="hover:bg-white/[0.02] transition-colors"
                  >
                    {columns.map((col) => (
                      <td key={col.key} className={`py-3.5 px-4 ${col.className || ""}`}>
                        {col.render ? col.render(item) : (item as any)[col.key]}
                      </td>
                    ))}
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={columns.length} className="py-12 text-center">
                    <EmptyState
                      title={emptyTitle}
                      description={emptyDescription}
                    />
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination footer */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between px-4 py-3 border-t border-[#1F2937] bg-[#0B1020]/40 text-xs text-slate-400">
            <span>
              Page <strong className="text-white">{currentPage}</strong> sur{" "}
              <strong className="text-white">{totalPages}</strong> ({filteredData.length} éléments)
            </span>
            <div className="flex items-center gap-1.5">
              <button
                disabled={currentPage === 1}
                onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                className="px-2.5 py-1 rounded-md bg-[#111827] border border-[#1F2937] hover:bg-white/5 text-slate-300 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
              >
                Précédent
              </button>
              <button
                disabled={currentPage === totalPages}
                onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                className="px-2.5 py-1 rounded-md bg-[#111827] border border-[#1F2937] hover:bg-white/5 text-slate-300 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
              >
                Suivant
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
