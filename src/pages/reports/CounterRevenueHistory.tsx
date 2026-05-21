import { useEffect, useState, useCallback, useRef } from "react";
import { supabase } from "../../lib/supabase";
import { useAuthStore } from "../../store/useAuthStore";
import PageMeta from "../../components/common/PageMeta";
import { Table, TableBody, TableCell, TableHeader, TableRow } from "../../components/ui/table";
import Badge from "../../components/ui/badge/Badge";
import { Modal } from "../../components/ui/modal";
import CurrencyInput from "../../components/form/input/CurrencyInput";
import InputField from "../../components/form/input/InputField";
import Button from "../../components/ui/button/Button";
import { PencilIcon, TrashBinIcon } from "../../icons";

const statusColor = (s: string) =>
  s === "approved" ? "success" : s === "rejected" ? "error" : "warning";

const formatIDR = (val: number) => `Rp ${Number(val).toLocaleString("id-ID")}`;

const formatPeriod = (e: { week_start: string; week_end: string; year: number }) => {
  const start = new Date(e.week_start);
  const end = new Date(e.week_end);
  return `${start.toLocaleDateString("id-ID", { month: "long", year: "numeric" })} — Tgl ${start.getDate()} s/d ${end.getDate()}`;
};

// ─── Multi-Select Counter Dropdown ────────────────────────────────────────────
interface MultiSelectDropdownProps {
  label: string;
  options: { id: string; name: string }[];
  selected: string[];
  onChange: (ids: string[]) => void;
  allLabel?: string;
}

function MultiSelectDropdown({ label, options, selected, onChange, allLabel = "Semua Counter" }: MultiSelectDropdownProps) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const toggle = (id: string) => {
    if (id === "all") { onChange([]); return; }
    onChange(selected.includes(id) ? selected.filter((s) => s !== id) : [...selected, id]);
  };

  const displayLabel =
    selected.length === 0
      ? allLabel
      : selected.length === 1
      ? options.find((o) => o.id === selected[0])?.name ?? "1 Counter"
      : `${selected.length} Counter dipilih`;

  return (
    <div className="relative flex flex-col gap-1 flex-1 min-w-[180px]" ref={ref}>
      <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider">{label}</label>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="h-10 px-3 text-sm text-left border border-gray-300 rounded-lg outline-none focus:border-brand-500 dark:bg-gray-900 dark:border-gray-800 dark:text-gray-300 flex items-center justify-between gap-2 bg-white"
      >
        <span className={selected.length === 0 ? "text-gray-400" : "text-gray-800 dark:text-gray-100"}>
          {displayLabel}
        </span>
        <svg className={`w-4 h-4 text-gray-400 transition-transform ${open ? "rotate-180" : ""}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>
      {open && (
        <div className="absolute top-full left-0 z-50 mt-1 w-full min-w-[200px] max-h-60 overflow-y-auto rounded-xl border border-gray-200 bg-white shadow-lg dark:border-white/10 dark:bg-gray-900">
          <button
            type="button"
            onClick={() => toggle("all")}
            className={`w-full flex items-center gap-3 px-4 py-2.5 text-sm hover:bg-gray-50 dark:hover:bg-white/5 transition-colors border-b border-gray-100 dark:border-white/5 ${selected.length === 0 ? "text-brand-600 font-semibold" : "text-gray-600 dark:text-gray-300"}`}
          >
            <span className={`w-4 h-4 rounded border-2 flex items-center justify-center flex-shrink-0 ${selected.length === 0 ? "border-brand-500 bg-brand-500" : "border-gray-300 dark:border-gray-600"}`}>
              {selected.length === 0 && <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" /></svg>}
            </span>
            {allLabel}
          </button>
          {options.map((opt) => {
            const checked = selected.includes(opt.id);
            return (
              <button key={opt.id} type="button" onClick={() => toggle(opt.id)} className="w-full flex items-center gap-3 px-4 py-2.5 text-sm hover:bg-gray-50 dark:hover:bg-white/5 transition-colors">
                <span className={`w-4 h-4 rounded border-2 flex items-center justify-center flex-shrink-0 transition-colors ${checked ? "border-brand-500 bg-brand-500" : "border-gray-300 dark:border-gray-600"}`}>
                  {checked && <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" /></svg>}
                </span>
                <span className={checked ? "text-gray-900 dark:text-white font-medium" : "text-gray-600 dark:text-gray-300"}>{opt.name}</span>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────
export default function CounterRevenueHistory() {
  const { profile } = useAuthStore();

  // ── Filters ──────────────────────────────────────────────────
  const [filterDateFrom, setFilterDateFrom] = useState("");
  const [filterDateTo, setFilterDateTo] = useState("");
  const [filterCounterIds, setFilterCounterIds] = useState<string[]>([]);
  const [filterStatus, setFilterStatus] = useState("all");

  // ── Data ─────────────────────────────────────────────────────
  const [entries, setEntries] = useState<any[]>([]);
  const [counters, setCounters] = useState<{ id: string; name: string }[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  // ── Edit Modal ───────────────────────────────────────────────
  const [editingEntry, setEditingEntry] = useState<any>(null);
  const [editAmount, setEditAmount] = useState(0);
  const [editNotes, setEditNotes] = useState("");
  const [editMonth, setEditMonth] = useState(1);
  const [editYear, setEditYear] = useState(2026);
  const [editWeekNum, setEditWeekNum] = useState(1);
  const [editStatus, setEditStatus] = useState<"pending" | "approved" | "rejected">("approved");
  const [isSaving, setIsSaving] = useState(false);

  // ── Load supervised counters ──────────────────────────────────
  const fetchCounters = useCallback(async () => {
    try {
      if (profile?.role === "supervisor") {
        const [assignRes, directRes] = await Promise.all([
          supabase.from("monthly_assignments").select("counter_id").eq("supervisor_id", profile.id).not("counter_id", "is", null),
          supabase.from("counters").select("id, name").eq("supervisor_id", profile.id).eq("is_active", true),
        ]);
        const ids = Array.from(new Set([
          ...(assignRes.data?.map((a) => a.counter_id).filter(Boolean) || []),
          ...(directRes.data?.map((c) => c.id) || []),
        ]));
        if (ids.length > 0) {
          const { data } = await supabase.from("counters").select("id, name").in("id", ids).eq("is_active", true).order("name");
          setCounters(data || []);
        } else {
          setCounters(directRes.data || []);
        }
      } else {
        // SM sees all counters
        const { data } = await supabase.from("counters").select("id, name").eq("is_active", true).order("name");
        setCounters(data || []);
      }
    } catch (err) {
      console.error("Fetch counters error:", err);
    }
  }, [profile]);

  useEffect(() => { fetchCounters(); }, [fetchCounters]);

  // ── Fetch entries ─────────────────────────────────────────────
  const fetchEntries = useCallback(async () => {
    setIsLoading(true);
    try {
      let query = supabase
        .from("counter_weekly_revenue")
        .select("*, counters(id, name), users:created_by(full_name)")
        .order("week_start", { ascending: false });

      if (filterDateFrom) query = query.gte("week_start", filterDateFrom);
      if (filterDateTo) query = query.lte("week_start", filterDateTo);
      if (filterStatus !== "all") query = query.eq("status", filterStatus);

      if (profile?.role === "supervisor") {
        // Limit to supervised counters
        const [assignRes, directRes] = await Promise.all([
          supabase.from("monthly_assignments").select("counter_id").eq("supervisor_id", profile.id).not("counter_id", "is", null),
          supabase.from("counters").select("id").eq("supervisor_id", profile.id),
        ]);
        const allSupervisedIds = Array.from(new Set([
          ...(assignRes.data?.map((a) => a.counter_id).filter(Boolean) || []),
          ...(directRes.data?.map((c) => c.id) || []),
        ]));
        if (allSupervisedIds.length === 0) { setEntries([]); setIsLoading(false); return; }
        const effectiveIds =
          filterCounterIds.length > 0
            ? filterCounterIds.filter((id) => allSupervisedIds.includes(id))
            : allSupervisedIds;
        if (effectiveIds.length === 0) { setEntries([]); setIsLoading(false); return; }
        query = query.in("counter_id", effectiveIds);
      } else {
        // SM: apply counter filter directly
        if (filterCounterIds.length > 0) query = query.in("counter_id", filterCounterIds);
      }

      const { data, error } = await query;
      if (error) throw error;
      setEntries(data || []);
    } catch (err) {
      console.error("Fetch counter revenue error:", err);
    } finally {
      setIsLoading(false);
    }
  }, [profile, filterDateFrom, filterDateTo, filterCounterIds, filterStatus]);

  useEffect(() => { fetchEntries(); }, [fetchEntries]);

  // ── Edit & Delete ─────────────────────────────────────────────
  const openEdit = (entry: any) => {
    setEditingEntry(entry);
    setEditAmount(entry.amount);
    setEditNotes(entry.notes || "");
    setEditStatus("approved");
    const d = new Date(entry.week_start);
    setEditMonth(d.getMonth() + 1);
    setEditYear(d.getFullYear());
    
    const day = d.getDate();
    if (day <= 7) setEditWeekNum(1);
    else if (day <= 14) setEditWeekNum(2);
    else if (day <= 21) setEditWeekNum(3);
    else if (day <= 28) setEditWeekNum(4);
    else setEditWeekNum(5);
  };

  const handleSave = async () => {
    if (!editingEntry) return;

    // Calculate week range
    const lastDay = new Date(editYear, editMonth, 0).getDate();
    const ranges = [
      { s: 1, e: 7 },
      { s: 8, e: 14 },
      { s: 15, e: 21 },
      { s: 22, e: 28 },
      { s: 29, e: lastDay }
    ];
    const selected = ranges[editWeekNum - 1];
    if (selected.s > lastDay) {
      alert("Minggu ke-5 tidak tersedia di bulan ini.");
      return;
    }

    const startStr = `${editYear}-${editMonth.toString().padStart(2, '0')}-${selected.s.toString().padStart(2, '0')}`;
    const endStr = `${editYear}-${editMonth.toString().padStart(2, '0')}-${selected.e.toString().padStart(2, '0')}`;

    setIsSaving(true);
    try {
      const { error } = await supabase
        .from("counter_weekly_revenue")
        .update({
          amount: editAmount,
          notes: editNotes
            ? `${editNotes} (Diedit oleh ${profile?.full_name})`
            : `Diedit oleh ${profile?.full_name}`,
          status: editStatus,
          week_start: startStr,
          week_end: endStr,
          year: editYear
        })
        .eq("id", editingEntry.id);

      if (error) throw error;
      setEntries((prev) =>
        prev.map((e) =>
          e.id === editingEntry.id
            ? {
                ...e,
                amount: editAmount,
                notes: editNotes,
                status: editStatus,
                week_start: startStr,
                week_end: endStr,
                year: editYear
              }
            : e
        )
      );
      setEditingEntry(null);
    } catch (err) {
      alert("Gagal menyimpan: " + (err as any).message);
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async (id: string, counterName: string) => {
    if (!confirm(`Hapus data omset mingguan untuk counter ${counterName}? Tindakan ini tidak dapat dibatalkan.`)) return;
    try {
      const { error } = await supabase.from("counter_weekly_revenue").delete().eq("id", id);
      if (error) throw error;
      setEntries((prev) => prev.filter((e) => e.id !== id));
    } catch (err) {
      alert("Gagal menghapus: " + (err as any).message);
    }
  };

  return (
    <>
      <PageMeta
        title="Riwayat Omset Counter | Gramedia Tracker"
        description="Riwayat dan manajemen omset mingguan seluruh counter"
      />

      <div className="flex flex-col gap-6">

        {/* ── Header (same style as RevenueHistory) ── */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
              Riwayat &amp; Edit Omset Counter
            </h1>
            <p className="text-sm text-gray-500 mt-1">
              Riwayat lengkap omset mingguan seluruh counter. Anda dapat mengedit nominal, mengubah status verifikasi, dan menghapus data.
            </p>
          </div>
          {/* Info badge */}
          <div className="inline-flex items-center gap-2 px-3 py-2 rounded-xl bg-brand-50 dark:bg-brand-500/10 border border-brand-200 dark:border-brand-500/20 text-brand-700 dark:text-brand-400 text-xs font-medium flex-shrink-0">
            <svg className="w-4 h-4 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            {profile?.role === "store_manager" ? "SM — Akses Penuh" : "SPV — Counter Anda"}
          </div>
        </div>

        {/* ── Filters (same style as RevenueHistory) ── */}
        <div className="rounded-2xl border border-gray-200 bg-white p-4 dark:border-white/[0.05] dark:bg-white/[0.03]">
          <div className="flex flex-col sm:flex-row gap-3 sm:items-end flex-wrap">
            <div className="flex flex-col gap-1 w-full sm:flex-1 sm:min-w-[145px]">
              <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Dari Awal Minggu</label>
              <input
                type="date"
                value={filterDateFrom}
                onChange={(e) => setFilterDateFrom(e.target.value)}
                className="w-full h-10 px-3 text-sm border border-gray-300 rounded-lg outline-none focus:border-brand-500 dark:bg-gray-900 dark:border-gray-800 dark:text-gray-300"
              />
            </div>
            <div className="flex flex-col gap-1 w-full sm:flex-1 sm:min-w-[145px]">
              <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Hingga Awal Minggu</label>
              <input
                type="date"
                value={filterDateTo}
                onChange={(e) => setFilterDateTo(e.target.value)}
                className="w-full h-10 px-3 text-sm border border-gray-300 rounded-lg outline-none focus:border-brand-500 dark:bg-gray-900 dark:border-gray-800 dark:text-gray-300"
              />
            </div>

            <div className="w-full sm:flex-1 sm:min-w-[180px]">
              <MultiSelectDropdown
                label="Counter"
                options={counters}
                selected={filterCounterIds}
                onChange={setFilterCounterIds}
                allLabel="Semua Counter"
              />
            </div>

            <div className="flex flex-col gap-1 w-full sm:flex-1 sm:min-w-[130px]">
              <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Status</label>
              <select
                value={filterStatus}
                onChange={(e) => setFilterStatus(e.target.value)}
                className="w-full h-10 px-3 text-sm border border-gray-300 rounded-lg outline-none focus:border-brand-500 dark:bg-gray-900 dark:border-gray-800 dark:text-gray-300"
              >
                <option value="all">Semua Status</option>
                <option value="pending">Pending</option>
                <option value="approved">Approved</option>
                <option value="rejected">Rejected</option>
              </select>
            </div>

            <button
              onClick={() => { setFilterDateFrom(""); setFilterDateTo(""); setFilterCounterIds([]); setFilterStatus("all"); }}
              className="w-full sm:w-auto h-10 px-4 text-sm rounded-lg border border-gray-300 text-gray-600 hover:bg-gray-50 dark:border-gray-700 dark:text-gray-400 dark:hover:bg-white/5 transition-colors"
            >
              Reset Filter
            </button>
          </div>

          {/* Active counter filter tags */}
          {filterCounterIds.length > 0 && (
            <div className="flex flex-wrap gap-2 mt-3 pt-3 border-t border-gray-100 dark:border-white/5">
              <span className="text-xs text-gray-400 self-center">Filter aktif:</span>
              {filterCounterIds.map((id) => {
                const counter = counters.find((c) => c.id === id);
                return (
                  <span key={id} className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-brand-50 text-brand-700 dark:bg-brand-500/10 dark:text-brand-400">
                    {counter?.name ?? id}
                    <button onClick={() => setFilterCounterIds((prev) => prev.filter((c) => c !== id))} className="hover:text-brand-900 dark:hover:text-brand-200 transition-colors">×</button>
                  </span>
                );
              })}
            </div>
          )}
        </div>

        {/* ── Table (same style as RevenueHistory) ── */}
        <div className="rounded-2xl border border-gray-200 bg-white dark:border-white/[0.05] dark:bg-white/[0.03] overflow-hidden">
          <div className="p-5 border-b border-gray-100 dark:border-white/[0.05] flex items-center justify-between">
            <div>
              <h2 className="font-bold text-gray-900 dark:text-white">Riwayat Omset Mingguan Counter</h2>
              <p className="text-xs text-gray-400 mt-0.5">{entries.length} entri ditemukan</p>
            </div>
          </div>
          <div className="max-w-full overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableCell isHeader className="px-5 py-3 text-xs uppercase">Periode</TableCell>
                  <TableCell isHeader className="px-5 py-3 text-xs uppercase">Counter</TableCell>
                  <TableCell isHeader className="px-5 py-3 text-xs uppercase text-right">Nominal</TableCell>
                  <TableCell isHeader className="px-5 py-3 text-xs uppercase">Catatan</TableCell>
                  <TableCell isHeader className="px-5 py-3 text-xs uppercase">Diinput Oleh</TableCell>
                  <TableCell isHeader className="px-5 py-3 text-xs uppercase text-center">Status</TableCell>
                  <TableCell isHeader className="px-5 py-3 text-xs uppercase text-center">Aksi</TableCell>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center py-16 text-gray-400">
                      <div className="flex flex-col items-center gap-2">
                        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-brand-500" />
                        <span className="text-sm">Memuat riwayat...</span>
                      </div>
                    </TableCell>
                  </TableRow>
                ) : entries.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center py-16">
                      <div className="flex flex-col items-center gap-2 text-gray-400">
                        <svg className="w-12 h-12 opacity-30" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                        </svg>
                        <span className="font-medium">Belum ada data omset counter</span>
                        <span className="text-xs">Coba ubah filter untuk melihat data lain</span>
                      </div>
                    </TableCell>
                  </TableRow>
                ) : (
                  entries.map((entry) => (
                    <TableRow key={entry.id} className="hover:bg-gray-50/50 dark:hover:bg-white/[0.02] transition-colors">
                      <TableCell className="px-5 py-4 text-sm">
                        <span className="font-medium text-gray-900 dark:text-white block">{formatPeriod(entry)}</span>
                        <span className="text-xs text-gray-400">Tahun {entry.year}</span>
                      </TableCell>
                      <TableCell className="px-5 py-4 text-sm font-bold text-gray-900 dark:text-white">
                        {entry.counters?.name ?? "—"}
                      </TableCell>
                      <TableCell className="px-5 py-4 text-sm font-bold text-gray-900 dark:text-white text-right whitespace-nowrap">
                        {formatIDR(entry.amount)}
                      </TableCell>
                      <TableCell className="px-5 py-4 text-sm text-gray-500 dark:text-gray-400 max-w-[160px]">
                        <span className="line-clamp-2 italic">{entry.notes || <span className="opacity-50">—</span>}</span>
                      </TableCell>
                      <TableCell className="px-5 py-4 text-sm text-gray-500 dark:text-gray-400">
                        {entry.users?.full_name ?? "Counter"}
                      </TableCell>
                      <TableCell className="px-5 py-4 text-center">
                        <Badge size="xs" color={statusColor(entry.status)}>
                          {entry.status.toUpperCase()}
                        </Badge>
                      </TableCell>
                      <TableCell className="px-5 py-4 text-center">
                        <div className="flex items-center justify-center gap-1.5">
                          <button
                            onClick={() => openEdit(entry)}
                            title="Edit omset counter"
                            className="inline-flex items-center justify-center w-8 h-8 rounded-lg text-gray-400 hover:text-brand-500 hover:bg-brand-50 dark:hover:bg-brand-500/10 transition-all"
                          >
                            <PencilIcon className="size-4" />
                          </button>
                          <button
                            onClick={() => handleDelete(entry.id, entry.counters?.name ?? "counter ini")}
                            title="Hapus omset counter"
                            className="inline-flex items-center justify-center w-8 h-8 rounded-lg text-gray-400 hover:text-error-500 hover:bg-error-50 dark:hover:bg-error-500/10 transition-all"
                          >
                            <TrashBinIcon className="size-4" />
                          </button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>

          {/* Footer total */}
          {entries.length > 0 && (
            <div className="border-t border-gray-100 dark:border-white/[0.05] px-5 py-3 flex items-center justify-between bg-gray-50/50 dark:bg-white/[0.01]">
              <span className="text-xs font-semibold text-gray-500 uppercase tracking-wider">
                Total Approved ({entries.filter((e) => e.status === "approved").length} entri)
              </span>
              <span className="text-lg font-bold text-brand-600">
                {formatIDR(entries.filter((e) => e.status === "approved").reduce((acc, e) => acc + Number(e.amount), 0))}
              </span>
            </div>
          )}
        </div>
      </div>

      {/* ── Edit Modal (same style as RevenueHistory) ── */}
      <Modal isOpen={!!editingEntry} onClose={() => setEditingEntry(null)} className="max-w-md mx-4 p-6">
        {editingEntry && (
          <div className="space-y-5">
            <div>
              <h3 className="text-lg font-bold text-gray-900 dark:text-white">Koreksi Omset Counter</h3>
              <p className="text-xs text-gray-400 mt-1">
                Sebagai {profile?.role === "store_manager" ? "SM" : "SPV"}, Anda dapat langsung mengatur status verifikasi.
              </p>
            </div>

            {/* Read-only info */}
            <div className="grid grid-cols-2 gap-3 p-4 rounded-xl bg-gray-50 dark:bg-white/5 text-sm">
              <div>
                <span className="text-xs text-gray-400 block mb-0.5">Counter</span>
                <span className="font-medium text-gray-800 dark:text-white">{editingEntry.counters?.name}</span>
              </div>
              <div>
                <span className="text-xs text-gray-400 block mb-0.5">Periode Lama</span>
                <span className="font-medium text-gray-800 dark:text-white text-xs">{formatPeriod(editingEntry)}</span>
              </div>
              <div>
                <span className="text-xs text-gray-400 block mb-0.5">Diinput Oleh</span>
                <span className="font-medium text-gray-800 dark:text-white">{editingEntry.users?.full_name ?? "Counter"}</span>
              </div>
              <div>
                <span className="text-xs text-gray-400 block mb-0.5">Status Saat Ini</span>
                <Badge size="xs" color={statusColor(editingEntry.status)}>
                  {editingEntry.status.toUpperCase()}
                </Badge>
              </div>
            </div>

            {/* Editable fields */}
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Bulan</label>
                <select 
                   className="w-full h-10 px-3 border border-gray-300 rounded-lg dark:bg-gray-900 dark:border-gray-800 outline-none focus:border-brand-500 text-sm text-gray-800 dark:text-gray-100"
                   value={editMonth}
                   onChange={(e) => setEditMonth(parseInt(e.target.value))}
                >
                    {Array.from({ length: 12 }, (_, i) => (
                      <option key={i+1} value={i+1}>{new Date(0, i).toLocaleString('id-ID', { month: 'long' })}</option>
                    ))}
                </select>
              </div>
              <div className="space-y-1">
                <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Tahun</label>
                <select 
                   className="w-full h-10 px-3 border border-gray-300 rounded-lg dark:bg-gray-900 dark:border-gray-800 outline-none focus:border-brand-500 text-sm text-gray-800 dark:text-gray-100"
                   value={editYear}
                   onChange={(e) => setEditYear(parseInt(e.target.value))}
                >
                    {[2024, 2025, 2026, 2027].map(y => <option key={y} value={y}>{y}</option>)}
                </select>
              </div>
            </div>

            <div className="space-y-1">
              <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Pilih Minggu</label>
              <select 
                 className="w-full h-10 px-3 border border-gray-300 rounded-lg dark:bg-gray-900 dark:border-gray-800 outline-none focus:border-brand-500 text-sm text-gray-800 dark:text-gray-100"
                 value={editWeekNum}
                 onChange={(e) => setEditWeekNum(parseInt(e.target.value))}
              >
                  <option value={1}>Minggu 1 (Tanggal 1 - 7)</option>
                  <option value={2}>Minggu 2 (Tanggal 8 - 14)</option>
                  <option value={3}>Minggu 3 (Tanggal 15 - 21)</option>
                  <option value={4}>Minggu 4 (Tanggal 22 - 28)</option>
                  <option value={5}>Minggu 5 (Tanggal 29 - Selesai)</option>
              </select>
            </div>

            <CurrencyInput label="Nominal Omset" value={editAmount} onChange={(val) => setEditAmount(val)} />
            <InputField
              label="Alasan Perubahan (Opsional)"
              placeholder="Contoh: Koreksi nominal oleh SPV..."
              value={editNotes}
              onChange={(e) => setEditNotes(e.target.value)}
            />

            {/* Status selector — same 3-button style as RevenueHistory for SA/Counter */}
            <div className="space-y-2">
              <label className="text-sm font-medium text-gray-700 dark:text-gray-400">Set Status Verifikasi</label>
              <div className="grid grid-cols-3 gap-2">
                {(["approved", "pending", "rejected"] as const).map((s) => (
                  <button
                    key={s}
                    onClick={() => setEditStatus(s)}
                    className={`px-3 py-2 rounded-lg text-xs font-bold uppercase tracking-wide border-2 transition-all ${
                      editStatus === s
                        ? s === "approved"
                          ? "border-success-500 bg-success-50 text-success-700 dark:bg-success-500/20 dark:text-success-400"
                          : s === "rejected"
                          ? "border-error-500 bg-error-50 text-error-700 dark:bg-error-500/20 dark:text-error-400"
                          : "border-amber-500 bg-amber-50 text-amber-700 dark:bg-amber-500/20 dark:text-amber-400"
                        : "border-gray-200 text-gray-500 hover:border-gray-300 dark:border-white/10 dark:hover:border-white/20"
                    }`}
                  >
                    {s}
                  </button>
                ))}
              </div>
            </div>

            <div className="flex gap-3 pt-2">
              <Button onClick={handleSave} disabled={isSaving} className="flex-1">
                {isSaving ? "Menyimpan..." : "Simpan Perubahan"}
              </Button>
              <Button variant="outline" onClick={() => setEditingEntry(null)} className="flex-1">
                Batalkan
              </Button>
            </div>
          </div>
        )}
      </Modal>
    </>
  );
}
