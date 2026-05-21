import { useEffect, useState, useCallback, useRef } from "react";
import { supabase } from "../../lib/supabase";
import PageMeta from "../../components/common/PageMeta";
import { Table, TableBody, TableCell, TableHeader, TableRow } from "../../components/ui/table";
import Badge from "../../components/ui/badge/Badge";
import Button from "../../components/ui/button/Button";
import { Modal } from "../../components/ui/modal";
import CurrencyInput from "../../components/form/input/CurrencyInput";
import InputField from "../../components/form/input/InputField";
import { useAuthStore } from "../../store/useAuthStore";
import { PencilIcon, TrashBinIcon } from "../../icons";
import jsPDF from "jspdf";
import "jspdf-autotable";

const statusColor = (s: string) =>
  s === "approved" ? "success" : s === "rejected" ? "error" : "warning";

const formatIDR = (val: number) => `Rp ${Number(val).toLocaleString("id-ID")}`;

// ─── Multi-Select Dropdown Component ─────────────────────────────────────────
interface MultiSelectDropdownProps {
  label: string;
  options: { id: string; name: string }[];
  selected: string[];
  onChange: (ids: string[]) => void;
}

function MultiSelectDropdown({ label, options, selected, onChange }: MultiSelectDropdownProps) {
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
    if (id === "all") {
      onChange([]);
      return;
    }
    onChange(
      selected.includes(id) ? selected.filter((s) => s !== id) : [...selected, id]
    );
  };

  const displayLabel =
    selected.length === 0
      ? "Semua Departemen"
      : selected.length === 1
      ? options.find((o) => o.id === selected[0])?.name ?? "1 Dept"
      : `${selected.length} Departemen dipilih`;

  return (
    <div className="relative flex flex-col gap-1 flex-1 min-w-[200px]" ref={ref}>
      <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider">{label}</label>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="h-10 px-3 text-sm text-left border border-gray-300 rounded-lg outline-none focus:border-brand-500 dark:bg-gray-900 dark:border-gray-800 dark:text-gray-300 flex items-center justify-between gap-2 bg-white"
      >
        <span className={selected.length === 0 ? "text-gray-400" : "text-gray-800 dark:text-gray-100"}>
          {displayLabel}
        </span>
        <svg
          className={`w-4 h-4 text-gray-400 transition-transform ${open ? "rotate-180" : ""}`}
          fill="none" viewBox="0 0 24 24" stroke="currentColor"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {open && (
        <div className="absolute top-full left-0 z-50 mt-1 w-full min-w-[220px] max-h-64 overflow-y-auto rounded-xl border border-gray-200 bg-white shadow-lg dark:border-white/10 dark:bg-gray-900">
          {/* All option */}
          <button
            type="button"
            onClick={() => toggle("all")}
            className={`w-full flex items-center gap-3 px-4 py-2.5 text-sm hover:bg-gray-50 dark:hover:bg-white/5 transition-colors border-b border-gray-100 dark:border-white/5 ${
              selected.length === 0 ? "text-brand-600 font-semibold" : "text-gray-600 dark:text-gray-300"
            }`}
          >
            <span className={`w-4 h-4 rounded border-2 flex items-center justify-center flex-shrink-0 ${
              selected.length === 0 ? "border-brand-500 bg-brand-500" : "border-gray-300 dark:border-gray-600"
            }`}>
              {selected.length === 0 && (
                <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                </svg>
              )}
            </span>
            Semua Departemen
          </button>
          {options.map((opt) => {
            const checked = selected.includes(opt.id);
            return (
              <button
                key={opt.id}
                type="button"
                onClick={() => toggle(opt.id)}
                className="w-full flex items-center gap-3 px-4 py-2.5 text-sm hover:bg-gray-50 dark:hover:bg-white/5 transition-colors"
              >
                <span className={`w-4 h-4 rounded border-2 flex items-center justify-center flex-shrink-0 transition-colors ${
                  checked ? "border-brand-500 bg-brand-500" : "border-gray-300 dark:border-gray-600"
                }`}>
                  {checked && (
                    <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                    </svg>
                  )}
                </span>
                <span className={checked ? "text-gray-900 dark:text-white font-medium" : "text-gray-600 dark:text-gray-300"}>
                  {opt.name}
                </span>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────
export default function DailyReport() {
  const { profile } = useAuthStore();

  // ── Filters ──────────────────────────────────────────────────
  const [filterDateFrom, setFilterDateFrom] = useState(
    new Date().toISOString().split("T")[0]
  );
  const [filterDateTo, setFilterDateTo] = useState(
    new Date().toISOString().split("T")[0]
  );
  const [filterDeptIds, setFilterDeptIds] = useState<string[]>([]); // empty = all
  const [filterStatus, setFilterStatus] = useState("all");
  const [filterSaId, setFilterSaId] = useState("all"); // SM only
  const [filterSpvId, setFilterSpvId] = useState("all"); // SM only

  // ── Data ─────────────────────────────────────────────────────
  const [data, setData] = useState<any[]>([]);
  const [departments, setDepartments] = useState<{ id: string; name: string }[]>([]);
  const [saList, setSaList] = useState<{ id: string; name: string }[]>([]); // SM only
  const [spvList, setSpvList] = useState<{ id: string; name: string }[]>([]); // SM only
  const [isLoading, setIsLoading] = useState(false);

  // ── Edit Modal ───────────────────────────────────────────────
  const [editingItem, setEditingItem] = useState<any>(null);
  const [editAmount, setEditAmount] = useState(0);
  const [editNote, setEditNote] = useState("");
  const [editDate, setEditDate] = useState("");
  const [editStatus, setEditStatus] = useState<"pending" | "approved" | "rejected">("approved");
  const [isSaving, setIsSaving] = useState(false);

  // ── Load departments for filter ───────────────────────────────
  const fetchDepartments = useCallback(async () => {
    try {
      let q = supabase.from("departments").select("id, name").eq("is_active", true).order("name");
      if (profile?.role === "supervisor") {
        // Load ALL months so SPV sees all historically assigned departments
        const { data: assigns } = await supabase
          .from("monthly_assignments")
          .select("department_id")
          .eq("supervisor_id", profile.id);
        const ids = [...new Set(assigns?.map((a) => a.department_id) || [])];
        if (ids.length > 0) q = q.in("id", ids);
        else { setDepartments([]); return; }
      }
      const { data: depts } = await q;
      setDepartments(depts || []);
    } catch (err) {
      console.error("Fetch depts error:", err);
    }
  }, [profile]);

  useEffect(() => { fetchDepartments(); }, [fetchDepartments]);

  // ── Load SA & SPV lists (SM only) ────────────────────────────
  useEffect(() => {
    if (profile?.role !== "store_manager") return;
    (async () => {
      const [saRes, spvRes] = await Promise.all([
        supabase.from("users").select("id, full_name").eq("role", "store_associate").eq("is_active", true).order("full_name"),
        supabase.from("users").select("id, full_name").eq("role", "supervisor").eq("is_active", true).order("full_name"),
      ]);
      setSaList((saRes.data || []).map((u: any) => ({ id: u.id, name: u.full_name })));
      setSpvList((spvRes.data || []).map((u: any) => ({ id: u.id, name: u.full_name })));
    })();
  }, [profile]);

  // ── Fetch revenue data ────────────────────────────────────────
  const fetchReport = useCallback(async () => {
    setIsLoading(true);
    try {
      let query = supabase
        .from("daily_revenue")
        .select("*, departments(id, name, code), users!daily_revenue_sa_id_fkey(full_name)")
        .gte("date", filterDateFrom)
        .lte("date", filterDateTo)
        .order("date", { ascending: false })
        .order("amount", { ascending: false });

      if (filterStatus !== "all") query = query.eq("status", filterStatus);

      if (profile?.role === "supervisor") {
        // Get all dept IDs assigned to this SPV across the date range
        const fromDate = new Date(filterDateFrom);
        const toDate = new Date(filterDateTo);
        const monthsSet = new Set<string>();
        const cursor = new Date(fromDate);
        while (cursor <= toDate) {
          monthsSet.add(`${cursor.getFullYear()}-${cursor.getMonth() + 1}`);
          cursor.setMonth(cursor.getMonth() + 1);
        }
        const spvDeptIds = new Set<string>();
        for (const ym of monthsSet) {
          const [y, m] = ym.split("-").map(Number);
          const { data: assigns } = await supabase
            .from("monthly_assignments")
            .select("department_id")
            .eq("supervisor_id", profile.id)
            .eq("month", m)
            .eq("year", y);
          assigns?.forEach((a) => spvDeptIds.add(a.department_id));
        }
        if (spvDeptIds.size === 0) { setData([]); setIsLoading(false); return; }
        // If user selected specific depts, intersect; otherwise use all SPV depts
        const effectiveDepts =
          filterDeptIds.length > 0
            ? filterDeptIds.filter((id) => spvDeptIds.has(id))
            : Array.from(spvDeptIds);
        if (effectiveDepts.length === 0) { setData([]); setIsLoading(false); return; }
        query = query.in("department_id", effectiveDepts);
      } else {
        // SM: apply dept filter directly
        if (filterDeptIds.length > 0) {
          query = query.in("department_id", filterDeptIds);
        }
        // SM: filter by SA directly
        if (filterSaId !== "all") {
          query = query.eq("sa_id", filterSaId);
        }
        // SM: filter by SPV — resolve their departments first
        if (filterSpvId !== "all") {
          const fromDate = new Date(filterDateFrom);
          const toDate = new Date(filterDateTo);
          const monthsSet = new Set<string>();
          const cursor = new Date(fromDate);
          while (cursor <= toDate) {
            monthsSet.add(`${cursor.getFullYear()}-${cursor.getMonth() + 1}`);
            cursor.setMonth(cursor.getMonth() + 1);
          }
          const spvDeptIds = new Set<string>();
          for (const ym of monthsSet) {
            const [y, m] = ym.split("-").map(Number);
            const { data: assigns } = await supabase
              .from("monthly_assignments")
              .select("department_id")
              .eq("supervisor_id", filterSpvId)
              .eq("month", m)
              .eq("year", y);
            assigns?.forEach((a: any) => spvDeptIds.add(a.department_id));
          }
          if (spvDeptIds.size === 0) { setData([]); setIsLoading(false); return; }
          // Intersect with dept filter if both are active
          const effectiveDepts =
            filterDeptIds.length > 0
              ? filterDeptIds.filter((id) => spvDeptIds.has(id))
              : Array.from(spvDeptIds);
          if (effectiveDepts.length === 0) { setData([]); setIsLoading(false); return; }
          query = query.in("department_id", effectiveDepts);
        }
      }

      const { data: revData, error } = await query;
      if (error) throw error;
      setData(revData || []);
    } catch (error) {
      console.error("Error fetching report:", error);
    } finally {
      setIsLoading(false);
    }
  }, [profile, filterDateFrom, filterDateTo, filterDeptIds, filterStatus, filterSaId, filterSpvId]);

  useEffect(() => { fetchReport(); }, [fetchReport]);

  // ── PDF Export ───────────────────────────────────────────────
  const exportPDF = () => {
    const doc = new jsPDF();
    doc.setFontSize(16);
    doc.text("Laporan Omset Harian - Gramedia Kendari", 14, 15);
    doc.setFontSize(10);
    doc.text(`Periode: ${filterDateFrom} s/d ${filterDateTo}`, 14, 22);
    // @ts-ignore
    doc.autoTable({
      head: [["Tanggal", "Departemen", "SA", "Nominal", "Status", "Catatan"]],
      body: data.map((i) => [
        new Date(i.date).toLocaleDateString("id-ID"),
        i.departments?.name,
        i.users?.full_name,
        `Rp ${Number(i.amount).toLocaleString("id-ID")}`,
        i.status.toUpperCase(),
        i.notes || "-",
      ]),
      startY: 28,
      theme: "grid",
      headStyles: { fillColor: [43, 86, 179] },
    });
    doc.save(`Laporan_Harian_${filterDateFrom}_${filterDateTo}.pdf`);
  };

  // ── Edit & Delete ────────────────────────────────────────────
  const openEdit = (item: any) => {
    setEditingItem(item);
    setEditAmount(item.amount);
    setEditNote(item.notes || "");
    setEditDate(item.date);
    setEditStatus("approved");
  };

  const handleSave = async () => {
    if (!editingItem) return;
    setIsSaving(true);
    try {
      const { error } = await supabase
        .from("daily_revenue")
        .update({
          amount: editAmount,
          notes: editNote
            ? `${editNote} (Diedit oleh ${profile?.full_name})`
            : `Diedit oleh ${profile?.full_name}`,
          status: editStatus,
          date: editDate,
          verified_by: editStatus === "approved" ? profile?.id : null,
          verified_at: editStatus === "approved" ? new Date().toISOString() : null,
          updated_at: new Date().toISOString(),
          updated_by: profile?.id,
        })
        .eq("id", editingItem.id);

      if (error) throw error;
      setData((prev) =>
        prev.map((d) =>
          d.id === editingItem.id
            ? { ...d, amount: editAmount, notes: editNote, status: editStatus, date: editDate }
            : d
        )
      );
      setEditingItem(null);
    } catch (err) {
      alert("Gagal menyimpan: " + (err as any).message);
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async (id: string, deptName: string) => {
    if (!confirm(`Hapus data omset untuk ${deptName}? Tindakan ini tidak dapat dibatalkan.`)) return;
    try {
      const { error } = await supabase.from("daily_revenue").delete().eq("id", id);
      if (error) throw error;
      setData((prev) => prev.filter((d) => d.id !== id));
    } catch (err) {
      alert("Gagal menghapus: " + (err as any).message);
    }
  };

  // ── WA Message ───────────────────────────────────────────────
  const generateWAMessage = async (item: any) => {
    try {
      const date = item.date;
      const startOfMonth = `${new Date(date).getFullYear()}-${(new Date(date).getMonth() + 1).toString().padStart(2, "0")}-01`;
      const currentMonthVal = new Date(date).getMonth() + 1;
      const currentYearVal = new Date(date).getFullYear();

      const { data: assignments } = await supabase
        .from("monthly_assignments")
        .select("department_id")
        .eq("sa_id", item.sa_id)
        .eq("month", currentMonthVal)
        .eq("year", currentYearVal);

      const targetDeptIds =
        assignments && assignments.length > 0
          ? assignments.map((a: any) => a.department_id)
          : [item.department_id];
      const deptLabel =
        assignments && assignments.length > 1 ? "GABUNGAN DEPT" : item.departments?.name;

      const [monthlyRevRes, monthlyWMRes, targetRes, dailyWMRes] = await Promise.all([
        supabase.from("daily_revenue").select("amount").in("department_id", targetDeptIds).eq("sa_id", item.sa_id).eq("status", "approved").gte("date", startOfMonth).lte("date", date),
        supabase.from("waqaf_member_entries").select("waqaf_amount, member_count").eq("sa_id", item.sa_id).gte("date", startOfMonth).lte("date", date),
        supabase.from("monthly_targets").select("target_amount, last_year_amount").in("department_id", targetDeptIds).eq("month", currentMonthVal).eq("year", currentYearVal),
        supabase.from("waqaf_member_entries").select("*").eq("sa_id", item.sa_id).eq("date", date).single(),
      ]);

      const dailyRevToday = await supabase.from("daily_revenue").select("amount").in("department_id", targetDeptIds).eq("sa_id", item.sa_id).eq("date", date).eq("status", "approved");

      const dailySales = dailyRevToday.data?.reduce((acc: number, curr: any) => acc + curr.amount, 0) || 0;
      const accRev = monthlyRevRes.data?.reduce((acc: number, curr: any) => acc + curr.amount, 0) || 0;
      const accMember = monthlyWMRes.data?.reduce((acc: number, curr: any) => acc + curr.member_count, 0) || 0;
      const accWaqaf = monthlyWMRes.data?.reduce((acc: number, curr: any) => acc + curr.waqaf_amount, 0) || 0;
      const targetAmt = targetRes.data?.reduce((acc: number, curr: any) => acc + curr.target_amount, 0) || 0;
      const lyAmt = targetRes.data?.reduce((acc: number, curr: any) => acc + curr.last_year_amount, 0) || 0;
      const achPerc = targetAmt > 0 ? (accRev / targetAmt) * 100 : 0;
      const growthAmt = accRev - lyAmt;
      const growthPerc = lyAmt > 0 ? (growthAmt / lyAmt) * 100 : 0;

      const formattedDate = new Date(date).toLocaleDateString("id-ID", { day: "numeric", month: "long", year: "numeric" });
      const currentMonthName = new Date(date).toLocaleString("id-ID", { month: "long" });

      const message = `*Report Harian, ${formattedDate}*
Nama : ${item.users?.full_name}
My Value : ${dailyWMRes.data?.member_count || 0}
Waqaf : ${dailyWMRes.data?.waqaf_amount > 0 ? "Rp " + dailyWMRes.data.waqaf_amount.toLocaleString("id-ID") : "-"}

*Akumulasi 1 - ${new Date(date).getDate()} ${currentMonthName} ${new Date(date).getFullYear()}*
My Value : ${accMember}
Wakaf : Rp ${accWaqaf.toLocaleString("id-ID")}

Departement : *${deptLabel}*
Sales : Rp ${dailySales.toLocaleString("id-ID")}
Target : Rp ${targetAmt.toLocaleString("id-ID")}
Achiv : ${achPerc.toFixed(1)}%
Growth : ${growthPerc.toFixed(1)}%

Semoga Hari Esok Bisa Lebih Baik lagi Terimakasih 🙏`;

      window.open(`https://api.whatsapp.com/send?text=${encodeURIComponent(message)}`, "_blank");
    } catch (err) {
      console.error("WA error:", err);
      alert("Gagal membuat laporan WA.");
    }
  };

  // ── Summary totals ───────────────────────────────────────────
  const totalApproved = data.filter((i) => i.status === "approved").reduce((acc, i) => acc + i.amount, 0);
  const totalPending = data.filter((i) => i.status === "pending").reduce((acc, i) => acc + i.amount, 0);

  return (
    <>
      <PageMeta title="Laporan Omset Harian | Gramedia Tracker" description="Riwayat dan manajemen omset harian per departemen" />

      <div className="flex flex-col gap-6">
        {/* ── Header ── */}
        <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Laporan Omset Harian</h1>
            <p className="text-sm text-gray-500 mt-1">
              Riwayat lengkap input omset harian. Anda dapat mengedit, mengubah status, dan menghapus data.
            </p>
          </div>
          <Button variant="outline" size="sm" onClick={exportPDF} disabled={data.length === 0}>
            Export PDF
          </Button>
        </div>

        {/* ── Filters ── */}
        <div className="rounded-2xl border border-gray-200 bg-white p-4 dark:border-white/[0.05] dark:bg-white/[0.03]">
          <div className="flex flex-col sm:flex-row gap-3 sm:items-end flex-wrap">
            <div className="flex flex-col gap-1 w-full sm:flex-1 sm:min-w-[145px]">
              <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Dari Tanggal</label>
              <input
                type="date"
                value={filterDateFrom}
                onChange={(e) => setFilterDateFrom(e.target.value)}
                className="w-full h-10 px-3 text-sm border border-gray-300 rounded-lg outline-none focus:border-brand-500 dark:bg-gray-900 dark:border-gray-800 dark:text-gray-300"
              />
            </div>
            <div className="flex flex-col gap-1 w-full sm:flex-1 sm:min-w-[145px]">
              <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Hingga Tanggal</label>
              <input
                type="date"
                value={filterDateTo}
                onChange={(e) => setFilterDateTo(e.target.value)}
                className="w-full h-10 px-3 text-sm border border-gray-300 rounded-lg outline-none focus:border-brand-500 dark:bg-gray-900 dark:border-gray-800 dark:text-gray-300"
              />
            </div>

            {/* Multi-select department dropdown */}
            <div className="w-full sm:flex-1 sm:min-w-[200px]">
              <MultiSelectDropdown
                label="Departemen"
                options={departments}
                selected={filterDeptIds}
                onChange={setFilterDeptIds}
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

            {/* SM-only: filter by SA */}
            {profile?.role === "store_manager" && (
              <div className="flex flex-col gap-1 w-full sm:flex-1 sm:min-w-[160px]">
                <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider">SA / Penginput</label>
                <select
                  value={filterSaId}
                  onChange={(e) => setFilterSaId(e.target.value)}
                  className="w-full h-10 px-3 text-sm border border-gray-300 rounded-lg outline-none focus:border-brand-500 dark:bg-gray-900 dark:border-gray-800 dark:text-gray-300"
                >
                  <option value="all">Semua SA</option>
                  {saList.map((sa) => (
                    <option key={sa.id} value={sa.id}>{sa.name}</option>
                  ))}
                </select>
              </div>
            )}

            {/* SM-only: filter by SPV */}
            {profile?.role === "store_manager" && (
              <div className="flex flex-col gap-1 w-full sm:flex-1 sm:min-w-[160px]">
                <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider">SPV / Supervisor</label>
                <select
                  value={filterSpvId}
                  onChange={(e) => setFilterSpvId(e.target.value)}
                  className="w-full h-10 px-3 text-sm border border-gray-300 rounded-lg outline-none focus:border-brand-500 dark:bg-gray-900 dark:border-gray-800 dark:text-gray-300"
                >
                  <option value="all">Semua SPV</option>
                  {spvList.map((spv) => (
                    <option key={spv.id} value={spv.id}>{spv.name}</option>
                  ))}
                </select>
              </div>
            )}

            <button
              onClick={() => { setFilterDeptIds([]); setFilterStatus("all"); setFilterSaId("all"); setFilterSpvId("all"); }}
              className="w-full sm:w-auto h-10 px-4 text-sm rounded-lg border border-gray-300 text-gray-600 hover:bg-gray-50 dark:border-gray-700 dark:text-gray-400 dark:hover:bg-white/5 transition-colors"
            >
              Reset Filter
            </button>
          </div>

          {/* Active dept filter tags */}
          {filterDeptIds.length > 0 && (
            <div className="flex flex-wrap gap-2 mt-3 pt-3 border-t border-gray-100 dark:border-white/5">
              <span className="text-xs text-gray-400 self-center">Filter aktif:</span>
              {filterDeptIds.map((id) => {
                const dept = departments.find((d) => d.id === id);
                return (
                  <span
                    key={id}
                    className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-brand-50 text-brand-700 dark:bg-brand-500/10 dark:text-brand-400"
                  >
                    {dept?.name ?? id}
                    <button
                      onClick={() => setFilterDeptIds((prev) => prev.filter((d) => d !== id))}
                      className="hover:text-brand-900 dark:hover:text-brand-200 transition-colors"
                    >
                      ×
                    </button>
                  </span>
                );
              })}
            </div>
          )}
        </div>

        {/* ── Summary Cards ── */}
        {data.length > 0 && (
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
            <div className="rounded-xl border border-gray-200 bg-white p-4 dark:border-white/[0.05] dark:bg-white/[0.03]">
              <p className="text-xs text-gray-400 uppercase tracking-wider font-semibold">Total Entri</p>
              <p className="text-2xl font-bold text-gray-900 dark:text-white mt-1">{data.length}</p>
            </div>
            <div className="rounded-xl border border-success-200 bg-success-50 p-4 dark:border-success-500/20 dark:bg-success-500/5">
              <p className="text-xs text-success-600 dark:text-success-400 uppercase tracking-wider font-semibold">Total Approved</p>
              <p className="text-xl font-bold text-success-700 dark:text-success-400 mt-1">{formatIDR(totalApproved)}</p>
            </div>
            <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 dark:border-amber-500/20 dark:bg-amber-500/5">
              <p className="text-xs text-amber-600 dark:text-amber-400 uppercase tracking-wider font-semibold">Total Pending</p>
              <p className="text-xl font-bold text-amber-700 dark:text-amber-400 mt-1">{formatIDR(totalPending)}</p>
            </div>
          </div>
        )}

        {/* ── Table ── */}
        <div className="rounded-2xl border border-gray-200 bg-white dark:border-white/[0.05] dark:bg-white/[0.03] overflow-hidden">
          <div className="p-5 border-b border-gray-100 dark:border-white/[0.05] flex items-center justify-between">
            <div>
              <h2 className="font-bold text-gray-900 dark:text-white">Data Omset Harian</h2>
              <p className="text-xs text-gray-400 mt-0.5">{data.length} entri ditemukan</p>
            </div>
          </div>
          <div className="max-w-full overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="bg-[#2B56B3]">
                  <TableCell isHeader className="px-5 py-3 text-white font-bold uppercase text-[11px] tracking-widest border-none">Tanggal</TableCell>
                  <TableCell isHeader className="px-5 py-3 text-white font-bold uppercase text-[11px] tracking-widest border-none">Departemen</TableCell>
                  <TableCell isHeader className="px-5 py-3 text-white font-bold uppercase text-[11px] tracking-widest border-none">Penginput (SA)</TableCell>
                  <TableCell isHeader className="px-5 py-3 text-white font-bold uppercase text-[11px] tracking-widest border-none text-right">Nominal</TableCell>
                  <TableCell isHeader className="px-5 py-3 text-white font-bold uppercase text-[11px] tracking-widest border-none text-center">Status</TableCell>
                  <TableCell isHeader className="px-5 py-3 text-white font-bold uppercase text-[11px] tracking-widest border-none">Catatan</TableCell>
                  <TableCell isHeader className="px-5 py-3 text-white font-bold uppercase text-[11px] tracking-widest border-none text-center">Aksi</TableCell>
                </TableRow>
              </TableHeader>
              <TableBody className="divide-y divide-gray-100 dark:divide-white/[0.05]">
                {isLoading ? (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center py-16 text-gray-400">
                      <div className="flex flex-col items-center gap-2">
                        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-brand-500" />
                        <span className="text-sm">Memuat data...</span>
                      </div>
                    </TableCell>
                  </TableRow>
                ) : data.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center py-20">
                      <div className="flex flex-col items-center gap-2 text-gray-400">
                        <svg className="w-12 h-12 opacity-30" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                        </svg>
                        <span className="font-medium">Tidak ada data untuk filter ini</span>
                        <span className="text-xs">Coba ubah rentang tanggal atau filter lainnya</span>
                      </div>
                    </TableCell>
                  </TableRow>
                ) : (
                  data.map((item) => (
                    <TableRow key={item.id} className="hover:bg-gray-50/50 dark:hover:bg-white/[0.02] transition-colors">
                      <TableCell className="px-5 py-4 text-sm whitespace-nowrap text-gray-700 dark:text-gray-300">
                        {new Date(item.date).toLocaleDateString("id-ID", { weekday: "short", day: "numeric", month: "short", year: "numeric" })}
                      </TableCell>
                      <TableCell className="px-5 py-4">
                        <div className="flex flex-col">
                          <span className="font-bold text-gray-900 dark:text-white text-sm">{item.departments?.name}</span>
                          <span className="text-[10px] text-brand-600 font-bold uppercase tracking-tighter">Kode: {item.departments?.code}</span>
                        </div>
                      </TableCell>
                      <TableCell className="px-5 py-4 text-sm text-gray-700 dark:text-gray-400 font-medium">
                        {item.users?.full_name ?? "—"}
                      </TableCell>
                      <TableCell className="px-5 py-4 font-bold text-gray-900 dark:text-white text-right whitespace-nowrap">
                        {formatIDR(item.amount)}
                      </TableCell>
                      <TableCell className="px-5 py-4 text-center">
                        <Badge size="xs" color={statusColor(item.status)}>
                          {item.status.toUpperCase()}
                        </Badge>
                      </TableCell>
                      <TableCell className="px-5 py-4 text-xs text-gray-400 max-w-[160px]">
                        <span className="line-clamp-2 italic">{item.notes || "—"}</span>
                      </TableCell>
                      <TableCell className="px-5 py-4">
                        <div className="flex items-center justify-center gap-1.5">
                          {/* WA Button */}
                          <button
                            onClick={() => generateWAMessage(item)}
                            title="Kirim laporan ke WhatsApp"
                            className="inline-flex items-center justify-center w-8 h-8 rounded-lg bg-success-50 text-success-600 hover:bg-success-100 dark:bg-success-500/10 dark:text-success-400 dark:hover:bg-success-500/20 transition-all"
                          >
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
                              <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.438 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" />
                            </svg>
                          </button>
                          <button
                            onClick={() => openEdit(item)}
                            title="Edit omset"
                            className="inline-flex items-center justify-center w-8 h-8 rounded-lg text-gray-400 hover:text-brand-500 hover:bg-brand-50 dark:hover:bg-brand-500/10 transition-all"
                          >
                            <PencilIcon className="size-4" />
                          </button>
                          <button
                            onClick={() => handleDelete(item.id, item.departments?.name ?? "data ini")}
                            title="Hapus omset"
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

          {data.length > 0 && (
            <div className="border-t border-gray-100 dark:border-white/[0.05] px-5 py-3 flex items-center justify-between bg-gray-50/50 dark:bg-white/[0.01]">
              <span className="text-xs font-semibold text-gray-500 uppercase tracking-wider">
                Total Approved ({data.filter((i) => i.status === "approved").length} entri)
              </span>
              <span className="text-lg font-bold text-brand-600">{formatIDR(totalApproved)}</span>
            </div>
          )}
        </div>
      </div>

      {/* ── Edit Modal ── */}
      <Modal isOpen={!!editingItem} onClose={() => setEditingItem(null)} className="max-w-md mx-4 p-6">
        {editingItem && (
          <div className="space-y-5">
            <div>
              <h3 className="text-lg font-bold text-gray-900 dark:text-white">Koreksi Data Omset</h3>
              <p className="text-xs text-gray-400 mt-1">
                Sebagai {profile?.role === "store_manager" ? "SM" : "SPV"}, Anda dapat langsung mengatur status verifikasi.
              </p>
            </div>
            <div className="grid grid-cols-2 gap-3 p-4 rounded-xl bg-gray-50 dark:bg-white/5 text-sm">
              <div>
                <span className="text-xs text-gray-400 block mb-0.5">Departemen</span>
                <span className="font-medium text-gray-800 dark:text-white">{editingItem.departments?.name}</span>
              </div>
              <div>
                <span className="text-xs text-gray-400 block mb-0.5">Penginput (SA)</span>
                <span className="font-medium text-gray-800 dark:text-white">{editingItem.users?.full_name ?? "—"}</span>
              </div>
              <div>
                <span className="text-xs text-gray-400 block mb-0.5">Status Saat Ini</span>
                <Badge size="xs" color={statusColor(editingItem.status)}>
                  {editingItem.status.toUpperCase()}
                </Badge>
              </div>
            </div>
            <div className="space-y-1">
              <label className="text-sm font-medium text-gray-700 dark:text-gray-400">Tanggal Omset</label>
              <input
                type="date"
                value={editDate}
                onChange={(e) => setEditDate(e.target.value)}
                className="w-full h-11 px-3 border border-gray-300 rounded-lg dark:bg-gray-900 dark:border-gray-800 outline-none focus:border-brand-500 text-sm text-gray-800 dark:text-gray-100"
              />
            </div>
            <CurrencyInput label="Nominal Omset" value={editAmount} onChange={(val) => setEditAmount(val)} />
            <InputField
              label="Alasan Perubahan (Opsional)"
              placeholder="Contoh: Salah input nominal..."
              value={editNote}
              onChange={(e) => setEditNote(e.target.value)}
            />
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
              <Button variant="outline" onClick={() => setEditingItem(null)} className="flex-1">Batalkan</Button>
            </div>
          </div>
        )}
      </Modal>
    </>
  );
}
