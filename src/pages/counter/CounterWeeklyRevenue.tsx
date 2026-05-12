import { useEffect, useState } from "react";
import { supabase } from "../../lib/supabase";
import { useAuthStore } from "../../store/useAuthStore";
import PageMeta from "../../components/common/PageMeta";
import InputField from "../../components/form/input/InputField";
import CurrencyInput from "../../components/form/input/CurrencyInput";
import Button from "../../components/ui/button/Button";
import { Table, TableBody, TableCell, TableHeader, TableRow } from "../../components/ui/table";

export default function CounterWeeklyRevenue() {
  const { profile } = useAuthStore();
  const [counterInfo, setCounterInfo] = useState<any>(null);
  const [history, setHistory] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isSubmitLoading, setIsSubmitLoading] = useState(false);

  const [formData, setFormData] = useState({
    startDate: "",
    endDate: "",
    amount: 0,
    notes: ""
  });

  useEffect(() => {
    if (profile) {
      fetchCounterInfo();
    }
  }, [profile]);

  useEffect(() => {
    if (counterInfo) {
      fetchHistory();
    }
  }, [counterInfo]);

  async function fetchCounterInfo() {
    setIsLoading(true);
    try {
      const { data, error } = await supabase
        .from("users")
        .select("counter_id, counters(id, name)")
        .eq("id", profile?.id)
        .single();
      
      if (error) throw error;
      setCounterInfo(data.counters);
    } catch (error) {
      console.error("Error fetching counter info:", error);
    } finally {
      setIsLoading(false);
    }
  }

  async function fetchHistory() {
    if (!counterInfo) return;
    try {
      const { data, error } = await supabase
        .from("counter_weekly_revenue")
        .select("*")
        .eq("counter_id", counterInfo.id)
        .order("start_date", { ascending: false });
      
      if (error) throw error;
      setHistory(data || []);
    } catch (error) {
      console.error("Error fetching history:", error);
    }
  }

  const handleDateChange = (type: 'start' | 'end', value: string) => {
    setFormData(prev => ({
      ...prev,
      [type === 'start' ? 'startDate' : 'endDate']: value
    }));
  };

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!counterInfo) return;
    if (!formData.startDate || !formData.endDate) {
      alert("Pilih rentang tanggal minggu ini.");
      return;
    }

    setIsSubmitLoading(true);
    try {
      const { error } = await supabase
        .from("counter_weekly_revenue")
        .insert([{
          counter_id: counterInfo.id,
          start_date: formData.startDate,
          end_date: formData.endDate,
          amount: formData.amount,
          notes: formData.notes,
          created_by: profile?.id
        }]);
      
      if (error) {
        if (error.code === "23505") {
          return alert("Omset untuk periode tanggal ini sudah diinput.");
        }
        throw error;
      }

      alert("Omset mingguan berhasil disimpan!");
      setFormData({
        startDate: "",
        endDate: "",
        amount: 0,
        notes: ""
      });
      fetchHistory();
    } catch (error) {
      alert("Gagal simpan omset: " + (error as any).message);
    } finally {
      setIsSubmitLoading(false);
    }
  }

  return (
    <>
      <PageMeta title="Omset Mingguan Counter | Gramedia Tracker" description="Input omset mingguan untuk brand counter" />
      
      <div className="flex flex-col gap-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Omset Mingguan Counter</h1>
          <p className="text-sm text-gray-500">Input pencapaian omset per minggu untuk brand: <span className="font-bold text-brand-600">{counterInfo?.name || "Memuat..."}</span></p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-1">
             <div className="rounded-2xl border border-gray-200 bg-white p-6 dark:border-white/[0.05] dark:bg-white/[0.03]">
                <h3 className="text-lg font-bold mb-6 dark:text-white">Form Input Omset</h3>
                <form onSubmit={handleSubmit} className="space-y-4">
                  <div className="grid grid-cols-2 gap-3">
                    <InputField
                      label="Mulai Tanggal"
                      type="date"
                      value={formData.startDate}
                      onChange={(e) => handleDateChange('start', e.target.value)}
                      required
                    />
                    <InputField
                      label="Sampai Tanggal"
                      type="date"
                      value={formData.endDate}
                      onChange={(e) => handleDateChange('end', e.target.value)}
                      required
                    />
                  </div>
                  
                  <CurrencyInput
                    label="Total Omset Minggu Ini"
                    value={formData.amount}
                    onChange={(val) => setFormData({ ...formData, amount: val })}
                  />

                  <InputField
                    label="Catatan"
                    placeholder="Contoh: Periode Minggu ke-1"
                    value={formData.notes}
                    onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                  />

                  <Button type="submit" className="w-full" disabled={isSubmitLoading || !counterInfo}>
                    {isSubmitLoading ? "Menyimpan..." : "Simpan Omset Mingguan"}
                  </Button>
                </form>
             </div>
          </div>

          <div className="lg:col-span-2">
            <div className="rounded-2xl border border-gray-200 bg-white dark:border-white/[0.05] dark:bg-white/[0.03]">
              <div className="p-5 border-b border-gray-100 dark:border-white/[0.05]">
                <h3 className="font-bold text-gray-900 dark:text-white">Riwayat Omset Mingguan</h3>
              </div>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableCell isHeader className="px-5 py-3">Periode</TableCell>
                    <TableCell isHeader className="px-5 py-3">Nominal</TableCell>
                    <TableCell isHeader className="px-5 py-3">Catatan</TableCell>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {isLoading ? (
                    <TableRow><TableCell colSpan={3} className="text-center py-10">Memuat data...</TableCell></TableRow>
                  ) : history.length === 0 ? (
                    <TableRow><TableCell colSpan={3} className="text-center py-10 text-gray-400 italic">Belum ada riwayat input.</TableCell></TableRow>
                  ) : (
                    history.map(item => (
                      <TableRow key={item.id}>
                        <TableCell className="px-5 py-4 text-sm font-medium">
                          {new Date(item.start_date).toLocaleDateString('id-ID')} - {new Date(item.end_date).toLocaleDateString('id-ID')}
                        </TableCell>
                        <TableCell className="px-5 py-4 font-bold text-gray-900 dark:text-white">
                          Rp {item.amount.toLocaleString()}
                        </TableCell>
                        <TableCell className="px-5 py-4 text-sm text-gray-500">
                          {item.notes || "-"}
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
    </>
  );
}
