import React, { useEffect, useState } from "react";
import { supabase } from "../../lib/supabase";
import { useAuthStore } from "../../store/useAuthStore";
import PageMeta from "../../components/common/PageMeta";
import InputField from "../../components/form/input/InputField";
import Button from "../../components/ui/button/Button";
import CurrencyInput from "../../components/form/input/CurrencyInput";

interface SAProfile {
  id: string;
  full_name: string;
}

interface Department {
  id: string;
  name: string;
}

export default function SARevenueInput() {
  const { profile } = useAuthStore();
  
  const [saList, setSaList] = useState<SAProfile[]>([]);
  const [deptList, setDeptList] = useState<Department[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isDataLoading, setIsDataLoading] = useState(true);
  
  const [formData, setFormData] = useState(() => {
    const saved = localStorage.getItem('saRevenueDraft');
    if (saved) return JSON.parse(saved);
    return {
      date: new Date().toISOString().split("T")[0],
      sa_id: "",
      department_id: "",
      amount: 0,
      notes: ""
    };
  });

  useEffect(() => {
    localStorage.setItem('saRevenueDraft', JSON.stringify(formData));
  }, [formData]);

  useEffect(() => {
    if (profile?.id && formData.date) {
      fetchMySA();
    }
  }, [profile, formData.date]);

  useEffect(() => {
    if (formData.sa_id && formData.date) {
      fetchSADepartments(formData.sa_id);
    } else {
      setDeptList([]);
      setFormData((prev: any) => ({ ...prev, department_id: "" }));
    }
  }, [formData.sa_id, formData.date]);

  async function fetchMySA() {
    try {
      const d = new Date(formData.date);
      const selMonth = d.getMonth() + 1;
      const selYear = d.getFullYear();

      // Get SAs assigned to THIS SPV for SELECTED month
      const { data: assignments, error } = await supabase
        .from("monthly_assignments")
        .select("sa_id, users!monthly_assignments_sa_id_fkey(id, full_name)")
        .eq("supervisor_id", profile?.id)
        .eq("month", selMonth)
        .eq("year", selYear);
      
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
      const d = new Date(formData.date);
      const selMonth = d.getMonth() + 1;
      const selYear = d.getFullYear();

      const { data, error } = await supabase
        .from("monthly_assignments")
        .select("department_id, departments(id, name)")
        .eq("sa_id", saId)
        .eq("supervisor_id", profile?.id)
        .eq("month", selMonth)
        .eq("year", selYear);
      
      if (error) throw error;

      const depts = (data || []).map(a => ({
        id: a.department_id,
        name: (a.departments as any)?.name || "Unknown"
      }));

      setDeptList(depts);
      if (depts.length > 0) {
        setFormData((prev: any) => ({ ...prev, department_id: depts[0].id }));
      }
    } catch (error) {
      console.error("Error fetching depts:", error);
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
      
      // Keep date and SA selected for faster input, but clear amount and notes
      setFormData((prev: any) => ({
        ...prev,
        amount: 0,
        notes: ""
      }));
      localStorage.removeItem('saRevenueDraft');
    } catch (error) {
      alert("Gagal menyimpan omset: " + (error as any).message);
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <>
      <PageMeta title="Input Omset SA | Gramedia Tracker" description="Input omset harian untuk tim SA" />
      
      <div className="max-w-4xl mx-auto">
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
      </div>
    </>
  );
}
