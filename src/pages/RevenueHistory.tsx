import { useEffect, useState, useCallback } from "react";
import { supabase } from "../lib/supabase";
import { useAuthStore } from "../store/useAuthStore";
import PageMeta from "../components/common/PageMeta";
import { Table, TableBody, TableCell, TableHeader, TableRow } from "../components/ui/table";
import Badge from "../components/ui/badge/Badge";
import { Modal } from "../components/ui/modal";
import CurrencyInput from "../components/form/input/CurrencyInput";
import InputField from "../components/form/input/InputField";
import Button from "../components/ui/button/Button";
import { PencilIcon } from "../icons";

// ─── Types ──────────────────────────────────────────────────────────────────

interface DailyRevenueEntry {
  id: string;
  date: string;
  department_id: string;
  amount: number;
  notes: string | null;
  status: "pending" | "approved" | "rejected";
  departments: { name: string } | null;
}

interface WeeklyRevenueEntry {
  id: string;
  week_start: string;
  week_end: string;
  year: number;
  amount: number;
  notes: string | null;
  status: "pending" | "approved" | "rejected";
  users: { full_name: string } | null;
}

interface Department {
  id: string;
  name: string;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

const statusColor = (s: string) =>
  s === "approved" ? "success" : s === "rejected" ? "error" : "warning";

const formatIDR = (val: number) =>
  `Rp ${Number(val).toLocaleString("id-ID")}`;

const formatDate = (d: string) =>
  new Date(d).toLocaleDateString("id-ID", {
    weekday: "short",
    day: "numeric",
    month: "long",
    year: "numeric",
  });

// ─── SA History View ─────────────────────────────────────────────────────────

function SARevenueHistory() {
  const { profile } = useAuthStore();

  // Filters
  const [filterDateFrom, setFilterDateFrom] = useState("");
  const [filterDateTo, setFilterDateTo] = useState("");
  const [filterDeptId, setFilterDeptId] = useState("all");

  // Data
  const [entries, setEntries] = useState<DailyRevenueEntry[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Edit Modal
  const [editingEntry, setEditingEntry] = useState<DailyRevenueEntry | null>(null);
  const [editAmount, setEditAmount] = useState(0);
  const [editNotes, setEditNotes] = useState("");
  const [editDate, setEditDate] = useState("");
  const [isSaving, setIsSaving] = useState(false);

  const fetchEntries = useCallback(async () => {
    if (!profile?.id) return;
    setIsLoading(true);
    try {
      let query = supabase
        .from("daily_revenue")
        .select("id, date, department_id, amount, notes, status, departments(name)")
        .eq("sa_id", profile.id)
        .order("date", { ascending: false });

      if (filterDateFrom) query = query.gte("date", filterDateFrom);
      if (filterDateTo) query = query.lte("date", filterDateTo);
      if (filterDeptId !== "all") query = query.eq("department_id", filterDeptId);

      const { data, error } = await query;
      if (error) throw error;
      const formatted = (data as any[] || []).map((item) => ({
        ...item,
        departments: Array.isArray(item.departments)
          ? item.departments[0] || null
          : item.departments || null,
      }));
      setEntries(formatted as DailyRevenueEntry[]);
    } catch (err) {
      console.error("Gagal memuat riwayat omset SA:", err);
    } finally {
      setIsLoading(false);
    }
  }, [profile, filterDateFrom, filterDateTo, filterDeptId]);

  // Load all SA departments for filter dropdown (all-time assignments)
  const fetchDepartments = useCallback(async () => {
    if (!profile?.id) return;
    try {
      const { data } = await supabase
        .from("monthly_assignments")
        .select("department_id, departments(id, name)")
        .eq("sa_id", profile.id);

      const seen = new Set<string>();
      const deptList: Department[] = [];
      (data || []).forEach((a: any) => {
        if (a.departments && !seen.has(a.department_id)) {
          seen.add(a.department_id);
          deptList.push({ id: a.department_id, name: a.departments.name });
        }
      });
      setDepartments(deptList);
    } catch (err) {
      console.error("Gagal memuat departemen:", err);
    }
  }, [profile]);

  useEffect(() => {
    fetchDepartments();
  }, [fetchDepartments]);

  useEffect(() => {
    fetchEntries();
  }, [fetchEntries]);

  const openEdit = (entry: DailyRevenueEntry) => {
    setEditingEntry(entry);
    setEditAmount(entry.amount);
    setEditNotes(entry.notes || "");
    setEditDate(entry.date);
  };

  const handleSave = async () => {
    if (!editingEntry) return;
    setIsSaving(true);
    try {
      const { error } = await supabase
        .from("daily_revenue")
        .update({ amount: editAmount, notes: editNotes, status: "pending", date: editDate })
        .eq("id", editingEntry.id);

      if (error) throw error;

      // Update local state immediately
      setEntries((prev) =>
        prev.map((e) =>
          e.id === editingEntry.id
            ? { ...e, amount: editAmount, notes: editNotes, status: "pending", date: editDate }
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

  return (
    <>
      {/* ── Filters ── */}
      <div className="rounded-2xl border border-gray-200 bg-white p-4 dark:border-white/[0.05] dark:bg-white/[0.03]">
        <div className="flex flex-col sm:flex-row gap-3 sm:items-end flex-wrap">
          <div className="flex flex-col gap-1 w-full sm:flex-1 sm:min-w-[150px]">
            <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider">
              Dari Tanggal
            </label>
            <input
              type="date"
              value={filterDateFrom}
              onChange={(e) => setFilterDateFrom(e.target.value)}
              className="w-full h-10 px-3 text-sm border border-gray-300 rounded-lg outline-none focus:border-brand-500 dark:bg-gray-900 dark:border-gray-800 dark:text-gray-300"
            />
          </div>
          <div className="flex flex-col gap-1 w-full sm:flex-1 sm:min-w-[150px]">
            <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider">
              Hingga Tanggal
            </label>
            <input
              type="date"
              value={filterDateTo}
              onChange={(e) => setFilterDateTo(e.target.value)}
              className="w-full h-10 px-3 text-sm border border-gray-300 rounded-lg outline-none focus:border-brand-500 dark:bg-gray-900 dark:border-gray-800 dark:text-gray-300"
            />
          </div>
          <div className="flex flex-col gap-1 w-full sm:flex-1 sm:min-w-[180px]">
            <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider">
              Departemen
            </label>
            <select
              value={filterDeptId}
              onChange={(e) => setFilterDeptId(e.target.value)}
              className="w-full h-10 px-3 text-sm border border-gray-300 rounded-lg outline-none focus:border-brand-500 dark:bg-gray-900 dark:border-gray-800 dark:text-gray-300"
            >
              <option value="all">Semua Departemen</option>
              {departments.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.name}
                </option>
              ))}
            </select>
          </div>
          <button
            onClick={() => {
              setFilterDateFrom("");
              setFilterDateTo("");
              setFilterDeptId("all");
            }}
            className="w-full sm:w-auto h-10 px-4 text-sm rounded-lg border border-gray-300 text-gray-600 hover:bg-gray-50 dark:border-gray-700 dark:text-gray-400 dark:hover:bg-white/5 transition-colors"
          >
            Reset Filter
          </button>
        </div>
      </div>

      {/* ── Table ── */}
      <div className="rounded-2xl border border-gray-200 bg-white dark:border-white/[0.05] dark:bg-white/[0.03] overflow-hidden">
        <div className="p-5 border-b border-gray-100 dark:border-white/[0.05] flex items-center justify-between">
          <div>
            <h2 className="font-bold text-gray-900 dark:text-white">Riwayat Omset Harian</h2>
            <p className="text-xs text-gray-400 mt-0.5">
              {entries.length} entri ditemukan
            </p>
          </div>
        </div>
        <div className="max-w-full overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableCell isHeader className="px-5 py-3 text-xs uppercase">Tanggal</TableCell>
                <TableCell isHeader className="px-5 py-3 text-xs uppercase">Departemen</TableCell>
                <TableCell isHeader className="px-5 py-3 text-xs uppercase text-right">Nominal</TableCell>
                <TableCell isHeader className="px-5 py-3 text-xs uppercase">Catatan</TableCell>
                <TableCell isHeader className="px-5 py-3 text-xs uppercase text-center">Status</TableCell>
                <TableCell isHeader className="px-5 py-3 text-xs uppercase text-center">Aksi</TableCell>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center py-16 text-gray-400">
                    <div className="flex flex-col items-center gap-2">
                      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-brand-500" />
                      <span className="text-sm">Memuat riwayat...</span>
                    </div>
                  </TableCell>
                </TableRow>
              ) : entries.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center py-16">
                    <div className="flex flex-col items-center gap-2 text-gray-400">
                      <svg className="w-12 h-12 opacity-30" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                      </svg>
                      <span className="font-medium">Belum ada data omset</span>
                      <span className="text-xs">Coba ubah filter untuk melihat data lain</span>
                    </div>
                  </TableCell>
                </TableRow>
              ) : (
                entries.map((entry) => (
                  <TableRow key={entry.id} className="hover:bg-gray-50/50 dark:hover:bg-white/[0.02] transition-colors">
                    <TableCell className="px-5 py-4 text-sm font-medium text-gray-900 dark:text-white whitespace-nowrap">
                      {formatDate(entry.date)}
                    </TableCell>
                    <TableCell className="px-5 py-4 text-sm text-gray-600 dark:text-gray-400">
                      {entry.departments?.name ?? "—"}
                    </TableCell>
                    <TableCell className="px-5 py-4 text-sm font-bold text-gray-900 dark:text-white text-right whitespace-nowrap">
                      {formatIDR(entry.amount)}
                    </TableCell>
                    <TableCell className="px-5 py-4 text-sm text-gray-500 dark:text-gray-400 max-w-[200px]">
                      <span className="line-clamp-2">{entry.notes || <span className="italic opacity-50">—</span>}</span>
                    </TableCell>
                    <TableCell className="px-5 py-4 text-center">
                      <Badge size="xs" color={statusColor(entry.status)}>
                        {entry.status.toUpperCase()}
                      </Badge>
                    </TableCell>
                    <TableCell className="px-5 py-4 text-center">
                      <button
                        onClick={() => openEdit(entry)}
                        title="Edit nominal omset"
                        className="inline-flex items-center justify-center w-8 h-8 rounded-lg text-gray-400 hover:text-brand-500 hover:bg-brand-50 dark:hover:bg-brand-500/10 transition-all"
                      >
                        <PencilIcon className="size-4" />
                      </button>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      </div>

      {/* ── Edit Modal ── */}
      <Modal
        isOpen={!!editingEntry}
        onClose={() => setEditingEntry(null)}
        className="max-w-md mx-4 p-6"
      >
        {editingEntry && (
          <div className="space-y-5">
            <div>
              <h3 className="text-lg font-bold text-gray-900 dark:text-white">Edit Omset Harian</h3>
              <p className="text-xs text-gray-400 mt-1">
                Mengubah nominal akan mengubah status kembali ke{" "}
                <span className="font-semibold text-amber-500">PENDING</span> untuk diverifikasi ulang.
              </p>
            </div>

            {/* Read-only info */}
            <div className="grid grid-cols-2 gap-3 p-4 rounded-xl bg-gray-50 dark:bg-white/5 text-sm">
              <div>
                <span className="text-xs text-gray-400 block mb-0.5">Departemen</span>
                <span className="font-medium text-gray-800 dark:text-white">{editingEntry.departments?.name ?? "—"}</span>
              </div>
              <div>
                <span className="text-xs text-gray-400 block mb-0.5">Status Lama</span>
                <Badge size="xs" color={statusColor(editingEntry.status)}>
                  {editingEntry.status.toUpperCase()}
                </Badge>
              </div>
            </div>

            {/* Editable fields */}
            <div className="space-y-1">
              <label className="text-sm font-medium text-gray-700 dark:text-gray-400">Tanggal Omset</label>
              <input
                type="date"
                value={editDate}
                onChange={(e) => setEditDate(e.target.value)}
                className="w-full h-11 px-3 border border-gray-300 rounded-lg dark:bg-gray-900 dark:border-gray-800 outline-none focus:border-brand-500 text-sm text-gray-800 dark:text-gray-100"
              />
            </div>

            <CurrencyInput
              label="Nominal Omset Baru"
              value={editAmount}
              onChange={(val) => setEditAmount(val)}
            />
            <InputField
              label="Catatan (Opsional)"
              placeholder="Keterangan tambahan..."
              value={editNotes}
              onChange={(e) => setEditNotes(e.target.value)}
            />

            <div className="flex gap-3 pt-2">
              <Button
                onClick={handleSave}
                disabled={isSaving}
                className="flex-1"
              >
                {isSaving ? "Menyimpan..." : "Simpan Perubahan"}
              </Button>
              <Button
                variant="outline"
                onClick={() => setEditingEntry(null)}
                className="flex-1"
              >
                Batalkan
              </Button>
            </div>
          </div>
        )}
      </Modal>
    </>
  );
}

// ─── Counter History View ─────────────────────────────────────────────────────

function CounterRevenueHistory() {
  const { profile } = useAuthStore();

  // Filters
  const [filterDateFrom, setFilterDateFrom] = useState("");
  const [filterDateTo, setFilterDateTo] = useState("");

  // Data
  const [entries, setEntries] = useState<WeeklyRevenueEntry[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Edit Modal
  const [editingEntry, setEditingEntry] = useState<WeeklyRevenueEntry | null>(null);
  const [editAmount, setEditAmount] = useState(0);
  const [editNotes, setEditNotes] = useState("");
  const [editMonth, setEditMonth] = useState(1);
  const [editYear, setEditYear] = useState(2026);
  const [editWeekNum, setEditWeekNum] = useState(1);
  const [isSaving, setIsSaving] = useState(false);

  const fetchEntries = useCallback(async () => {
    if (!profile?.counter_id) return;
    setIsLoading(true);
    try {
      let query = supabase
        .from("counter_weekly_revenue")
        .select("id, week_start, week_end, year, amount, notes, status, users:created_by(full_name)")
        .eq("counter_id", profile.counter_id)
        .order("week_start", { ascending: false });

      if (filterDateFrom) query = query.gte("week_start", filterDateFrom);
      if (filterDateTo) query = query.lte("week_start", filterDateTo);

      const { data, error } = await query;
      if (error) throw error;
      const formatted = (data as any[] || []).map((item) => ({
        ...item,
        users: Array.isArray(item.users)
          ? item.users[0] || null
          : item.users || null,
      }));
      setEntries(formatted as WeeklyRevenueEntry[]);
    } catch (err) {
      console.error("Gagal memuat riwayat omset Counter:", err);
    } finally {
      setIsLoading(false);
    }
  }, [profile, filterDateFrom, filterDateTo]);

  useEffect(() => {
    fetchEntries();
  }, [fetchEntries]);

  const openEdit = (entry: WeeklyRevenueEntry) => {
    setEditingEntry(entry);
    setEditAmount(entry.amount);
    setEditNotes(entry.notes || "");
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
          notes: editNotes,
          status: "pending",
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
                status: "pending",
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

  const formatPeriod = (entry: WeeklyRevenueEntry) => {
    const start = new Date(entry.week_start);
    const end = new Date(entry.week_end);
    return `${start.toLocaleDateString("id-ID", { month: "long", year: "numeric" })} — ${start.getDate()} s/d ${end.getDate()}`;
  };

  return (
    <>
      {/* ── Filters ── */}
      <div className="rounded-2xl border border-gray-200 bg-white p-4 dark:border-white/[0.05] dark:bg-white/[0.03]">
        <div className="flex flex-col sm:flex-row gap-3 sm:items-end flex-wrap">
          <div className="flex flex-col gap-1 w-full sm:flex-1 sm:min-w-[150px]">
            <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider">
              Dari Awal Minggu
            </label>
            <input
              type="date"
              value={filterDateFrom}
              onChange={(e) => setFilterDateFrom(e.target.value)}
              className="w-full h-10 px-3 text-sm border border-gray-300 rounded-lg outline-none focus:border-brand-500 dark:bg-gray-900 dark:border-gray-800 dark:text-gray-300"
            />
          </div>
          <div className="flex flex-col gap-1 w-full sm:flex-1 sm:min-w-[150px]">
            <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider">
              Hingga Awal Minggu
            </label>
            <input
              type="date"
              value={filterDateTo}
              onChange={(e) => setFilterDateTo(e.target.value)}
              className="w-full h-10 px-3 text-sm border border-gray-300 rounded-lg outline-none focus:border-brand-500 dark:bg-gray-900 dark:border-gray-800 dark:text-gray-300"
            />
          </div>
          <button
            onClick={() => {
              setFilterDateFrom("");
              setFilterDateTo("");
            }}
            className="w-full sm:w-auto h-10 px-4 text-sm rounded-lg border border-gray-300 text-gray-600 hover:bg-gray-50 dark:border-gray-700 dark:text-gray-400 dark:hover:bg-white/5 transition-colors"
          >
            Reset Filter
          </button>
        </div>
      </div>

      {/* ── Table ── */}
      <div className="rounded-2xl border border-gray-200 bg-white dark:border-white/[0.05] dark:bg-white/[0.03] overflow-hidden">
        <div className="p-5 border-b border-gray-100 dark:border-white/[0.05]">
          <h2 className="font-bold text-gray-900 dark:text-white">Riwayat Omset Mingguan</h2>
          <p className="text-xs text-gray-400 mt-0.5">{entries.length} entri ditemukan</p>
        </div>
        <div className="max-w-full overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableCell isHeader className="px-5 py-3 text-xs uppercase">Periode</TableCell>
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
                  <TableCell colSpan={6} className="text-center py-16 text-gray-400">
                    <div className="flex flex-col items-center gap-2">
                      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-brand-500" />
                      <span className="text-sm">Memuat riwayat...</span>
                    </div>
                  </TableCell>
                </TableRow>
              ) : entries.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center py-16">
                    <div className="flex flex-col items-center gap-2 text-gray-400">
                      <svg className="w-12 h-12 opacity-30" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                      </svg>
                      <span className="font-medium">Belum ada data omset</span>
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
                    <TableCell className="px-5 py-4 text-sm font-bold text-gray-900 dark:text-white text-right whitespace-nowrap">
                      {formatIDR(entry.amount)}
                    </TableCell>
                    <TableCell className="px-5 py-4 text-sm text-gray-500 dark:text-gray-400 max-w-[200px]">
                      <span className="line-clamp-2">{entry.notes || <span className="italic opacity-50">—</span>}</span>
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
                      <button
                        onClick={() => openEdit(entry)}
                        title="Edit nominal omset"
                        className="inline-flex items-center justify-center w-8 h-8 rounded-lg text-gray-400 hover:text-brand-500 hover:bg-brand-50 dark:hover:bg-brand-500/10 transition-all"
                      >
                        <PencilIcon className="size-4" />
                      </button>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      </div>

      {/* ── Edit Modal ── */}
      <Modal
        isOpen={!!editingEntry}
        onClose={() => setEditingEntry(null)}
        className="max-w-md mx-4 p-6"
      >
        {editingEntry && (
          <div className="space-y-5">
            <div>
              <h3 className="text-lg font-bold text-gray-900 dark:text-white">Edit Omset Mingguan</h3>
              <p className="text-xs text-gray-400 mt-1">
                Mengubah nominal akan mengubah status kembali ke{" "}
                <span className="font-semibold text-amber-500">PENDING</span> untuk diverifikasi ulang.
              </p>
            </div>

            {/* Read-only info */}
            <div className="p-4 rounded-xl bg-gray-50 dark:bg-white/5 text-sm space-y-2">
              <div>
                <span className="text-xs text-gray-400 block mb-0.5">Periode Lama</span>
                <span className="font-medium text-gray-800 dark:text-white">{formatPeriod(editingEntry)}</span>
              </div>
              <div>
                <span className="text-xs text-gray-400 block mb-0.5">Status Lama</span>
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

            <CurrencyInput
              label="Nominal Omset Baru"
              value={editAmount}
              onChange={(val) => setEditAmount(val)}
            />
            <InputField
              label="Catatan (Opsional)"
              placeholder="Keterangan tambahan..."
              value={editNotes}
              onChange={(e) => setEditNotes(e.target.value)}
            />

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

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function RevenueHistory() {
  const { profile } = useAuthStore();
  const isSA = profile?.role === "store_associate";
  const isCounter = profile?.role === "counter";

  return (
    <>
      <PageMeta
        title="Riwayat Omset | Gramedia Tracker"
        description="Lihat dan edit riwayat omset yang telah Anda input"
      />

      <div className="flex flex-col gap-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
              Riwayat &amp; Edit Omset
            </h1>
            <p className="text-sm text-gray-500 mt-1">
              {isSA
                ? "Lihat seluruh omset harian yang Anda input. Anda dapat mengedit nominal — status akan kembali ke PENDING untuk diverifikasi ulang."
                : "Lihat seluruh omset mingguan yang Anda input. Anda dapat mengedit nominal — status akan kembali ke PENDING untuk diverifikasi ulang."}
            </p>
          </div>

          {/* Info badge */}
          <div className="inline-flex items-center gap-2 px-3 py-2 rounded-xl bg-amber-50 dark:bg-amber-500/10 border border-amber-200 dark:border-amber-500/20 text-amber-700 dark:text-amber-400 text-xs font-medium flex-shrink-0">
            <svg className="w-4 h-4 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            Edit mengubah status ke PENDING
          </div>
        </div>

        {/* Role-specific view */}
        {isSA && <SARevenueHistory />}
        {isCounter && <CounterRevenueHistory />}
        {!isSA && !isCounter && (
          <div className="rounded-2xl border border-gray-200 bg-white p-12 text-center dark:border-white/[0.05] dark:bg-white/[0.03]">
            <p className="text-gray-400">Halaman ini hanya dapat diakses oleh SA dan Counter.</p>
          </div>
        )}
      </div>
    </>
  );
}
