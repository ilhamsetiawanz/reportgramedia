import React, { useEffect, useState } from "react";
import { supabase } from "../../lib/supabase";
import { useAuthStore } from "../../store/useAuthStore";
import PageMeta from "../../components/common/PageMeta";
import InputField from "../../components/form/input/InputField";
import Button from "../../components/ui/button/Button";
import CurrencyInput from "../../components/form/input/CurrencyInput";
import Badge from "../../components/ui/badge/Badge";
import { PencilIcon } from "../../icons";

interface Department {
  id: string;
  name: string;
}

export default function DailyRevenueInput() {
  const { profile } = useAuthStore();
  const [departments, setDepartments] = useState<Department[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  
  // Form State
  const [formData, setFormData] = useState(() => {
    const saved = localStorage.getItem('saDailyRevDraft');
    if (saved) return JSON.parse(saved);
    return {
      date: new Date().toISOString().split("T")[0],
      department_id: "",
      amount: 0,
      notes: ""
    };
  });

  useEffect(() => {
    localStorage.setItem('saDailyRevDraft', JSON.stringify(formData));
  }, [formData]);

  useEffect(() => {
    if (profile && formData.date) {
      fetchDepartments();
    }
  }, [profile, formData.date]);

  async function fetchDepartments() {
    try {
      if (profile?.id && formData.date) {
        const d = new Date(formData.date);
        const selMonth = d.getMonth() + 1;
        const selYear = d.getFullYear();

        // 1. Fetch assignments for this SA for selected date
        const { data: assignData, error: assignError } = await supabase
          .from("monthly_assignments")
          .select("department_id, departments(id, name)")
          .eq("sa_id", profile.id)
          .eq("month", selMonth)
          .eq("year", selYear);
        
        if (assignError) throw assignError;

        // 2. Map results ensuring we handle missing joins gracefully
        const deptList = (assignData || [])
          .filter(a => a.departments)
          .map(a => ({
            id: a.department_id,
            name: (a.departments as any).name
          }));

        setDepartments(deptList);
        if (deptList.length > 0) {
          setFormData((prev: any) => ({ ...prev, department_id: deptList[0].id }));
        }
      }
    } catch (error) {
      console.error("Error fetching depts:", error);
    }
  }


  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    // Validasi eksplisit: amount boleh 0, tapi harus angka valid
    if (formData.amount == null || isNaN(formData.amount)) {
      return alert("Nominal omset tidak valid.");
    }
    if (!formData.department_id) {
      return alert("Pilih departemen terlebih dahulu.");
    }
    setIsLoading(true);
    try {
      // Insert new entry
      const { error } = await supabase.from("daily_revenue").insert([{
        date: formData.date,
        department_id: formData.department_id,
        amount: formData.amount,
        notes: formData.notes,
        sa_id: profile?.id,
        status: "pending"
      }]);

      if (error) {
        if (error.code === "23505") {
          return alert("Anda sudah menginput omset untuk departemen ini pada tanggal tersebut.");
        }
        throw error;
      }
      alert("Omset berhasil diinput! Menunggu verifikasi SPV.");

      setFormData((prev: any) => ({
        ...prev,
        amount: 0,
        notes: ""
      }));
      localStorage.removeItem('saDailyRevDraft');
    } catch (error) {
      alert("Gagal menyimpan omset: " + (error as any).message);
    } finally {
      setIsLoading(false);
    }
  }


  return (
    <>
      <PageMeta title="Input Omset | Gramedia Tracker" description="Input omset harian toko" />
      
      <div className="max-w-4xl mx-auto">
        {/* Input Form */}
        <div className="rounded-2xl border border-gray-200 bg-white p-6 dark:border-white/[0.05] dark:bg-white/[0.03]">
          <h2 className="mb-6 text-lg font-bold text-gray-900 dark:text-white">
            Input Omset Harian
          </h2>
          <form onSubmit={handleSubmit} className="space-y-4">
            <InputField
              label="Tanggal"
              type="date"
              value={formData.date}
              onChange={(e) => setFormData({ ...formData, date: e.target.value })}
              required
            />
            
            <div className="space-y-2">
              <label className="text-sm font-medium text-gray-700 dark:text-gray-400">Departemen</label>
              <select
                className="w-full h-11 px-4 text-sm border border-gray-300 rounded-lg outline-none focus:border-brand-500 dark:bg-gray-900 dark:border-gray-800 dark:text-gray-400"
                value={formData.department_id}
                onChange={(e) => setFormData({ ...formData, department_id: e.target.value })}
                required
              >
                <option value="">Pilih Departemen...</option>
                {departments.map(dept => (
                  <option key={dept.id} value={dept.id}>{dept.name}</option>
                ))}
              </select>
            </div>

            <CurrencyInput
              label="Nominal Omset"
              value={formData.amount}
              onChange={(val) => setFormData({ ...formData, amount: val })}
            />

            <InputField
              label="Catatan (Opsional)"
              placeholder="Keterangan tambahan..."
              value={formData.notes}
              onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
            />

            <div className="flex flex-col gap-3">
              <Button type="submit" disabled={isLoading} className="w-full">
                {isLoading ? "Mengirim..." : "Simpan Omset"}
              </Button>
            </div>
          </form>
        </div>
      </div>
    </>
  );
}
