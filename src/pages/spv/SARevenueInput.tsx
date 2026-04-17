import React, { useEffect, useState } from "react";
import { supabase } from "../../lib/supabase";
import { useAuthStore } from "../../store/useAuthStore";
import PageMeta from "../../components/common/PageMeta";
import InputField from "../../components/form/input/InputField";
import Button from "../../components/ui/button/Button";
import CurrencyInput from "../../components/form/input/CurrencyInput";
import { Table, TableBody, TableCell, TableHeader, TableRow } from "../../components/ui/table";
import { TrashBinIcon } from "../../icons";

interface SAProfile {
  id: string;
  full_name: string;
}

interface Department {
  id: string;
  name: string;
}

interface RevenueEntry {
  id: string;
  date: string;
  amount: number;
  status: string;
  sa: { full_name: string } | null;
  departments: { name: string } | null;
}

export default function SARevenueInput() {
  const { profile } = useAuthStore();
  
  // Lists
  const [saList, setSaList] = useState<SAProfile[]>([]);
  const [deptList, setDeptList] = useState<Department[]>([]);
  const [history, setHistory] = useState<RevenueEntry[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isDataLoading, setIsDataLoading] = useState(true);

  // Form State
  const [formData, setFormData] = useState({
    date: new Date().toISOString().split("T")[0],
    sa_id: "",
    department_id: "",
    amount: 0,
    notes: ""
  });

  useEffect(() => {
    if (profile?.id) {
      fetchMySA();
      fetchHistory();
    }
  }, [profile]);

  useEffect(() => {
    if (formData.sa_id) {
      fetchSADepartments(formData.sa_id);
    } else {
      setDeptList([]);
      setFormData(prev => ({ ...prev, department_id: "" }));
    }
  }, [formData.sa_id]);

  async function fetchMySA() {
    try {
      const currentMonth = new Date().getMonth() + 1;
      const currentYear = new Date().getFullYear();

      // Get SAs assigned to THIS SPV for CURRENT month
      const { data: assignments, error } = await supabase
        .from("monthly_assignments")
        .select("sa_id, users!monthly_assignments_sa_id_fkey(id, full_name)")
        .eq("supervisor_id", profile?.id)
        .eq("month", currentMonth)
        .eq("year", currentYear);
      
      if (error) throw error;

      // Extract unique SAs
      const sas: SAProfile[] = [];
      const seen = new Set();
      (assignments || []).forEach(a => {
        const user = a.users as any;
        if (user && !seen.has(user.id)) {
          sas.push({ id: user.id, full_name: user.full_name });
          seen.add(user.id);
        }
      });

      setSaList(sas);
    } catch (error) {
      console.error("Error fetching SA list:", error);
    } finally {
      setIsDataLoading(false);
    }
  }

  async function fetchSADepartments(saId: string) {
    try {
      const currentMonth = new Date().getMonth() + 1;
      const currentYear = new Date().getFullYear();

      const { data, error } = await supabase
        .from("monthly_assignments")
        .select("department_id, departments(id, name)")
        .eq("sa_id", saId)
        .eq("supervisor_id", profile?.id) // Extra safety
        .eq("month", currentMonth)
        .eq("year", currentYear);
      
      if (error) throw error;

      const depts = (data || []).map(a => ({
        id: a.department_id,
        name: (a.departments as any)?.name || "Unknown"
      }));

      setDeptList(depts);
      if (depts.length > 0) {
        setFormData(prev => ({ ...prev, department_id: depts[0].id }));
      }
    } catch (error) {
      console.error("Error fetching depts:", error);
    }
  }

  async function fetchHistory() {
    try {
      const { data, error } = await supabase
        .from("daily_revenue")
        .select("id, date, amount, status, sa_id, users!daily_revenue_sa_id_fkey(full_name), departments(name)")
        .eq("verified_by", profile?.id) // entries created/verified by this SPV
        .order("date", { ascending: false })
        .limit(10);
      
      if (error) throw error;
      
      const formattedData = (data || []).map(item => ({
        ...item,
        sa: item.users as any
      }));
      setHistory(formattedData as any);
    } catch (error) {
      console.error("Error fetching history:", error);
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!formData.sa_id || !formData.department_id) {
      return alert("Harap pilih SA dan Departemen.");
    }

    setIsLoading(true);
    try {
      const { error } = await supabase.from("daily_revenue").insert([{
        date: formData.date,
        department_id: formData.department_id,
        amount: formData.amount,
        notes: formData.notes,
        sa_id: formData.sa_id,
        status: "approved",
        verified_by: profile?.id,
        verified_at: new Date().toISOString()
      }]);

      if (error) {
        if (error.code === "23505") {
          return alert("Data omset untuk SA di departemen ini pada tanggal tersebut sudah ada.");
        }
        throw error;
      }

      alert("Omset SA berhasil disimpan!");
      
      // Keep date and SA selected for faster input
      setFormData(prev => ({
        ...prev,
        amount: 0,
        notes: ""
      }));
      fetchHistory();
    } catch (error) {
      alert("Gagal menyimpan omset: " + (error as any).message);
    } finally {
      setIsLoading(false);
    }
  }

  async function handleDelete(id: string) {
    if (!confirm("Hapus input omset ini?")) return;
    try {
      const { error } = await supabase.from("daily_revenue").delete().eq("id", id);
      if (error) throw error;
      fetchHistory();
    } catch (error) {
      alert("Gagal hapus: " + (error as any).message);
    }
  }

  return (
    <>
      <PageMeta title="Input Omset SA | Gramedia Tracker" description="Input omset harian untuk tim SA" />
      
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* Input Form */}
        <div className="rounded-2xl border border-gray-200 bg-white p-6 dark:border-white/[0.05] dark:bg-white/[0.03]">
          <h2 className="mb-6 text-lg font-bold text-gray-900 dark:text-white">Input Omset Tim SA</h2>
          <form onSubmit={handleSubmit} className="space-y-4">
            <InputField
              label="Tanggal"
              type="date"
              value={formData.date}
              onChange={(e) => setFormData({ ...formData, date: e.target.value })}
              required
            />
            
            <div className="space-y-2">
              <label className="text-sm font-medium text-gray-700 dark:text-gray-400">Pilih Store Associate</label>
              <select
                className="w-full h-11 px-4 text-sm border border-gray-300 rounded-lg outline-none focus:border-brand-500 dark:bg-gray-900 dark:border-gray-800 dark:text-gray-400"
                value={formData.sa_id}
                onChange={(e) => setFormData({ ...formData, sa_id: e.target.value })}
                required
              >
                <option value="">Pilih SA...</option>
                {saList.map(sa => (
                  <option key={sa.id} value={sa.id}>{sa.full_name}</option>
                ))}
              </select>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium text-gray-700 dark:text-gray-400">Departemen</label>
              <select
                className="w-full h-11 px-4 text-sm border border-gray-300 rounded-lg outline-none focus:border-brand-500 dark:bg-gray-900 dark:border-gray-800 dark:text-gray-400"
                value={formData.department_id}
                onChange={(e) => setFormData({ ...formData, department_id: e.target.value })}
                disabled={!formData.sa_id || deptList.length === 0}
                required
              >
                {deptList.length === 0 ? (
                  <option value="">{formData.sa_id ? "Tidak ada dept ditugaskan" : "Pilih SA dahulu..."}</option>
                ) : (
                  <>
                    <option value="">Pilih Departemen...</option>
                    {deptList.map(dept => (
                      <option key={dept.id} value={dept.id}>{dept.name}</option>
                    ))}
                  </>
                )}
              </select>
            </div>

            <CurrencyInput
              label="Nominal Omset"
              value={formData.amount}
              onChange={(val) => setFormData({ ...formData, amount: val })}
              required
            />

            <InputField
              label="Catatan (Opsional)"
              placeholder="Keterangan tambahan..."
              value={formData.notes}
              onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
            />

            <Button type="submit" disabled={isLoading || isDataLoading} className="w-full">
              {isLoading ? "Mengirim..." : "Simpan Omset"}
            </Button>
          </form>
        </div>

        {/* History */}
        <div className="rounded-2xl border border-gray-200 bg-white p-6 dark:border-white/[0.05] dark:bg-white/[0.03]">
          <h2 className="mb-6 text-lg font-bold text-gray-900 dark:text-white">10 Input Terakhir Anda</h2>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableCell isHeader className="px-4 py-3 text-theme-xs">Tanggal</TableCell>
                  <TableCell isHeader className="px-4 py-3 text-theme-xs">SA / Dept</TableCell>
                  <TableCell isHeader className="px-4 py-3 text-theme-xs">Nominal</TableCell>
                  <TableCell isHeader className="px-4 py-3 text-end text-theme-xs">Aksi</TableCell>
                </TableRow>
              </TableHeader>
              <TableBody>
                {history.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={4} className="text-center py-4 text-gray-500 text-sm">Belum ada data yang diinput oleh Anda.</TableCell>
                  </TableRow>
                ) : (
                  history.map((item) => (
                    <TableRow key={item.id}>
                      <TableCell className="px-4 py-3 text-sm">{item.date}</TableCell>
                      <TableCell className="px-4 py-3">
                        <div className="flex flex-col">
                          <span className="text-sm font-medium">{item.sa?.full_name || "-"}</span>
                          <span className="text-xs text-gray-500">{item.departments?.name || "-"}</span>
                        </div>
                      </TableCell>
                      <TableCell className="px-4 py-3 text-sm font-bold">Rp {item.amount.toLocaleString()}</TableCell>
                      <TableCell className="px-4 py-3 text-end">
                        <button onClick={() => handleDelete(item.id)} className="text-gray-400 hover:text-error-500 transition-colors">
                          <TrashBinIcon className="size-4" />
                        </button>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </div>
      </div>
    </>
  );
}
