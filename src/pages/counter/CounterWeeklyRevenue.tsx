import React, { useEffect, useState } from "react";
import { supabase } from "../../lib/supabase";
import { useAuthStore } from "../../store/useAuthStore";
import PageMeta from "../../components/common/PageMeta";
import InputField from "../../components/form/input/InputField";
import Button from "../../components/ui/button/Button";
import CurrencyInput from "../../components/form/input/CurrencyInput";
import { Table, TableBody, TableCell, TableHeader, TableRow } from "../../components/ui/table";
import Badge from "../../components/ui/badge/Badge";
import { PencilIcon } from "../../icons";

export default function CounterWeeklyRevenue() {
  const { profile } = useAuthStore();
  const [revenue, setRevenue] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitLoading, setIsSubmitLoading] = useState(false);

  // Form State
  const [editingId, setEditingId] = useState<string | null>(null);
  const [month, setMonth] = useState(new Date().getMonth() + 1);
  const [year, setYear] = useState(new Date().getFullYear());
  const [weekNum, setWeekNum] = useState(1);
  const [amount, setAmount] = useState(0);
  const [notes, setNotes] = useState("");

  useEffect(() => {
    if (profile?.counter_id) {
      fetchRevenue();
    }
  }, [profile]);

  async function fetchRevenue() {
    setIsLoading(true);
    try {
      const { data, error } = await supabase
        .from("counter_weekly_revenue")
        .select("*, users:created_by(full_name)")
        .eq("counter_id", profile?.counter_id)
        .order("week_start", { ascending: false });
      
      if (error) throw error;
      setRevenue(data || []);
    } catch (error) {
      console.error("Error fetching revenue:", error);
    } finally {
      setIsLoading(false);
    }
  }

  const calculateWeekRange = (m: number, y: number, w: number) => {
    const lastDay = new Date(y, m, 0).getDate();
    const ranges = [
      { s: 1, e: 7 },
      { s: 8, e: 14 },
      { s: 15, e: 21 },
      { s: 22, e: 28 },
      { s: 29, e: lastDay }
    ];
    
    const selected = ranges[w - 1];
    if (selected.s > lastDay) return null; // No 5th week for Feb etc
    
    // Adjust 4th week if no 5th week
    if (w === 4 && lastDay === 28) {
        selected.e = 28;
    } else if (w === 4 && lastDay > 28) {
        selected.e = 28;
    }

    return {
      start: `${y}-${m.toString().padStart(2, '0')}-${selected.s.toString().padStart(2, '0')}`,
      end: `${y}-${m.toString().padStart(2, '0')}-${selected.e.toString().padStart(2, '0')}`
    };
  };

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!profile?.counter_id) return alert("Akun Anda belum dihubungkan ke Counter manapun.");
    
    const range = calculateWeekRange(month, year, weekNum);
    if (!range) return alert("Minggu ke-5 tidak tersedia di bulan ini.");
    if (amount <= 0) return alert("Harap isi nominal omset.");

    setIsSubmitLoading(true);
    try {
      const payload: any = {
        counter_id: profile.counter_id,
        amount,
        week_start: range.start,
        week_end: range.end,
        year: year,
        notes,
        created_by: profile.id,
        status: 'pending' // Re-verify on edit
      };

      if (editingId) {
        const { error } = await supabase.from("counter_weekly_revenue").update(payload).eq("id", editingId);
        if (error) throw error;
        alert("Laporan omset diperbarui!");
      } else {
        const { error } = await supabase.from("counter_weekly_revenue").insert([payload]);
        if (error) {
          if (error.code === "23505") return alert("Laporan untuk periode minggu ini sudah ada. Gunakan fitur edit untuk revisi.");
          throw error;
        }
        alert("Omset mingguan berhasil disimpan!");
      }

      setEditingId(null);
      setAmount(0);
      setNotes("");
      fetchRevenue();
    } catch (error) {
      alert("Gagal menyimpan: " + (error as any).message);
    } finally {
      setIsSubmitLoading(false);
    }
  }

  const handleEdit = (item: any) => {
    setEditingId(item.id);
    const d = new Date(item.week_start);
    setMonth(d.getMonth() + 1);
    setYear(d.getFullYear());
    
    const day = d.getDate();
    if (day <= 7) setWeekNum(1);
    else if (day <= 14) setWeekNum(2);
    else if (day <= 21) setWeekNum(3);
    else if (day <= 28) setWeekNum(4);
    else setWeekNum(5);

    setAmount(item.amount);
    setNotes(item.notes || "");
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  return (
    <>
      <PageMeta title="Omset Mingguan Counter | Gramedia Tracker" description="Input omset mingguan untuk counter" />
      
      <div className="flex flex-col gap-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Omset Mingguan Counter</h1>
          <p className="text-sm text-gray-500">Pilih periode minggu dan masukkan total pencapaian omset Anda.</p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Form */}
          <div className="lg:col-span-1">
            <div className="rounded-2xl border border-gray-200 bg-white p-6 dark:border-white/[0.05] dark:bg-white/[0.03]">
              <h2 className="mb-6 text-lg font-bold text-gray-900 dark:text-white">
                {editingId ? "Revisi Laporan" : "Input Omset"}
              </h2>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-2">
                    <label className="text-sm font-medium">Bulan</label>
                    <select 
                       className="w-full h-11 px-3 border border-gray-300 rounded-lg dark:bg-gray-900 dark:border-gray-800 outline-none focus:border-brand-500"
                       value={month}
                       onChange={(e) => setMonth(parseInt(e.target.value))}
                    >
                        {Array.from({ length: 12 }, (_, i) => (
                          <option key={i+1} value={i+1}>{new Date(0, i).toLocaleString('id-ID', { month: 'long' })}</option>
                        ))}
                    </select>
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-medium">Tahun</label>
                    <select 
                       className="w-full h-11 px-3 border border-gray-300 rounded-lg dark:bg-gray-900 dark:border-gray-800 outline-none focus:border-brand-500"
                       value={year}
                       onChange={(e) => setYear(parseInt(e.target.value))}
                    >
                        {[2024, 2025, 2026].map(y => <option key={y} value={y}>{y}</option>)}
                    </select>
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-medium">Pilih Minggu</label>
                  <select 
                     className="w-full h-11 px-4 border border-gray-300 rounded-lg dark:bg-gray-900 dark:border-gray-800 outline-none focus:border-brand-500"
                     value={weekNum}
                     onChange={(e) => setWeekNum(parseInt(e.target.value))}
                  >
                      <option value={1}>Minggu 1 (Tanggal 1 - 7)</option>
                      <option value={2}>Minggu 2 (Tanggal 8 - 14)</option>
                      <option value={3}>Minggu 3 (Tanggal 15 - 21)</option>
                      <option value={4}>Minggu 4 (Tanggal 22 - 28)</option>
                      <option value={5}>Minggu 5 (Tanggal 29 - Selesai)</option>
                  </select>
                </div>

                <CurrencyInput
                  label="Total Omset Mingguan"
                  value={amount}
                  onChange={(val) => setAmount(val)}
                  required
                />

                <InputField
                  label="Catatan (Opsional)"
                  placeholder="Keterangan..."
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                />

                <div className="pt-2 flex flex-col gap-2">
                  <Button type="submit" className="w-full" disabled={isSubmitLoading}>
                    {isSubmitLoading ? "Menyimpan..." : editingId ? "Simpan Perubahan" : "Simpan Omset"}
                  </Button>
                  {editingId && (
                    <Button variant="outline" onClick={() => { setEditingId(null); setAmount(0); }} className="w-full">
                      Batalkan
                    </Button>
                  )}
                </div>
              </form>
            </div>
          </div>

          {/* History */}
          <div className="lg:col-span-2">
            <div className="rounded-2xl border border-gray-200 bg-white dark:border-white/[0.05] dark:bg-white/[0.03]">
              <div className="p-6 border-b border-gray-100 dark:border-white/[0.05]">
                 <h2 className="text-lg font-bold text-gray-900 dark:text-white">Riwayat Laporan</h2>
              </div>
              <div className="max-w-full overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableCell isHeader className="px-5 py-3 text-theme-xs uppercase">Periode</TableCell>
                      <TableCell isHeader className="px-5 py-3 text-theme-xs uppercase">Nominal</TableCell>
                      <TableCell isHeader className="px-5 py-3 text-theme-xs uppercase">Oleh</TableCell>
                      <TableCell isHeader className="px-5 py-3 text-theme-xs uppercase text-center">Status</TableCell>
                      <TableCell isHeader className="px-5 py-3 text-end text-theme-xs uppercase">Aksi</TableCell>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {isLoading ? (
                      <TableRow><TableCell colSpan={5} className="text-center py-10 text-gray-400">Memuat...</TableCell></TableRow>
                    ) : revenue.length === 0 ? (
                      <TableRow><TableCell colSpan={5} className="text-center py-10 text-gray-400 font-medium">Belum ada data.</TableCell></TableRow>
                    ) : (
                      revenue.map((item) => (
                        <TableRow key={item.id}>
                          <TableCell className="px-5 py-4 text-sm">
                            <span className="font-medium">{new Date(item.week_start).toLocaleDateString('id-ID', { month: 'long', year: 'numeric' })}</span>
                            <div className="text-xs text-gray-400">{new Date(item.week_start).getDate()} - {new Date(item.week_end).getDate()}</div>
                          </TableCell>
                          <TableCell className="px-5 py-4 font-bold text-gray-900 dark:text-white">
                            Rp {item.amount.toLocaleString()}
                          </TableCell>
                          <TableCell className="px-5 py-4 text-xs text-gray-500">
                            {item.users?.full_name || "Counter"}
                          </TableCell>
                          <TableCell className="px-5 py-4 text-center">
                            <Badge size="xs" color={item.status === 'approved' ? 'success' : item.status === 'rejected' ? 'error' : 'warning'}>
                              {item.status.toUpperCase()}
                            </Badge>
                          </TableCell>
                          <TableCell className="px-5 py-4 text-end">
                            <button onClick={() => handleEdit(item)} className="p-2 text-gray-400 hover:text-brand-500 transition-colors">
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
          </div>
        </div>
      </div>
    </>
  );
}
