import { useEffect, useState } from "react";
import { supabase } from "../../lib/supabase";
import { useAuthStore } from "../../store/useAuthStore";
import PageMeta from "../../components/common/PageMeta";
import { Table, TableBody, TableCell, TableHeader, TableRow } from "../../components/ui/table";
import Button from "../../components/ui/button/Button";
import CurrencyInput from "../../components/form/input/CurrencyInput";

interface CounterTarget {
  id: string;
  name: string;
  target_amount: number;
}

export default function CounterTargetsSPV() {
  const { profile } = useAuthStore();
  const [counters, setCounters] = useState<CounterTarget[]>([]);
  const [targetInputs, setTargetInputs] = useState<Record<string, string>>({});
  const [isLoading, setIsLoading] = useState(true);

  const [selectedMonth, setSelectedMonth] = useState(new Date().getMonth() + 1);
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());

  useEffect(() => {
    if (profile?.id) {
      fetchCounterTargets();
    }
  }, [profile, selectedMonth, selectedYear]);

  async function fetchCounterTargets() {
    setIsLoading(true);
    try {
      // 1. Get counters assigned to this SPV
      const { data: counterData, error: counterError } = await supabase
        .from("counters")
        .select("id, name")
        .eq("supervisor_id", profile?.id)
        .eq("is_active", true);
      
      if (counterError) throw counterError;

      if (!counterData || counterData.length === 0) {
        setCounters([]);
        return;
      }

      const counterIds = counterData.map(c => c.id);

      // 2. Get targets for these counters
      // Note: We'll reuse monthly_targets or a new counter_targets table
      // Let's assume a new table 'counter_monthly_targets' or just reuse logic
      const { data: targets } = await supabase
        .from("counter_monthly_targets")
        .select("*")
        .in("counter_id", counterIds)
        .eq("month", selectedMonth)
        .eq("year", selectedYear);
      
      const combined = counterData.map(c => {
        const t = targets?.find(target => target.counter_id === c.id);
        return {
          id: c.id,
          name: c.name,
          target_amount: t?.target_amount || 0
        };
      });

      setCounters(combined);

      const targetInputMap: Record<string, string> = {};
      combined.forEach(item => {
        targetInputMap[item.id] = item.target_amount.toString();
      });
      setTargetInputs(targetInputMap);
    } catch (error) {
      console.error("Error fetching counter targets:", error);
    } finally {
      setIsLoading(false);
    }
  }

  async function handleUpdateTarget(counterId: string) {
    const targetAmount = parseInt(targetInputs[counterId] || "0");
    try {
      const { error } = await supabase
        .from("counter_monthly_targets")
        .upsert({
          counter_id: counterId,
          month: selectedMonth,
          year: selectedYear,
          target_amount: targetAmount,
        }, { onConflict: 'counter_id,month,year' });
      
      if (error) throw error;
      alert("Target counter diperbarui!");
      fetchCounterTargets();
    } catch (error) {
      alert("Gagal update: " + (error as any).message);
    }
  }

  return (
    <>
      <PageMeta title="Target Counter | Gramedia Tracker" description="Penentuan target bulanan untuk counter brand" />
      
      <div className="flex flex-col gap-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Target Bulanan Counter</h1>
            <p className="text-sm text-gray-500 italic">Periode: {selectedMonth}/{selectedYear}</p>
          </div>

          <div className="flex items-center gap-3">
            <select
              className="h-9 px-2 border border-gray-300 rounded-lg dark:bg-gray-900 dark:border-gray-800 outline-none text-xs"
              value={selectedMonth}
              onChange={(e) => setSelectedMonth(parseInt(e.target.value))}
            >
              {Array.from({ length: 12 }, (_, i) => (
                <option key={i + 1} value={i + 1}>{new Date(0, i).toLocaleString('id-ID', { month: 'long' })}</option>
              ))}
            </select>
            <select
              className="h-9 px-2 border border-gray-300 rounded-lg dark:bg-gray-900 dark:border-gray-800 outline-none text-xs"
              value={selectedYear}
              onChange={(e) => setSelectedYear(parseInt(e.target.value))}
            >
              {[selectedYear - 1, selectedYear, selectedYear + 1].map(y => (
                <option key={y} value={y}>{y}</option>
              ))}
            </select>
          </div>
        </div>

        <div className="overflow-hidden rounded-xl border border-gray-200 bg-white dark:border-white/[0.05] dark:bg-white/[0.03]">
          <div className="max-w-full overflow-x-auto custom-scrollbar shadow-inner">
            <Table className="w-full" style={{ minWidth: '700px' }}>
              <TableHeader>
                <TableRow>
                  <TableCell isHeader className="px-5 py-4 text-start text-[10px] font-black uppercase tracking-wider text-gray-500 min-w-[250px] whitespace-nowrap">Nama Counter / Brand</TableCell>
                  <TableCell isHeader className="px-5 py-4 text-start text-[10px] font-black uppercase tracking-wider text-gray-500 min-w-[250px] whitespace-nowrap">Target Omset Bulanan</TableCell>
                  <TableCell isHeader className="px-5 py-4 text-end text-[10px] font-black uppercase tracking-wider text-gray-500 min-w-[120px] whitespace-nowrap">Aksi</TableCell>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  <TableRow>
                    <TableCell colSpan={3} className="text-center py-10 text-gray-400">Memuat data...</TableCell>
                  </TableRow>
                ) : counters.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={3} className="text-center py-10 text-gray-400 font-medium">Anda belum ditugaskan untuk mengawasi Counter manapun.</TableCell>
                  </TableRow>
                ) : (
                  counters.map((item) => (
                    <TableRow key={item.id}>
                      <TableCell className="px-5 py-4 font-bold text-gray-900 dark:text-white/90">{item.name}</TableCell>
                      <TableCell className="px-5 py-4">
                        <CurrencyInput
                          placeholder="Masukkan Target"
                          className="h-11 text-sm w-full"
                          value={Number(targetInputs[item.id] || 0)}
                          onChange={(val) => setTargetInputs({ ...targetInputs, [item.id]: val.toString() })}
                        />
                      </TableCell>
                      <TableCell className="px-5 py-4 text-end">
                        <Button size="sm" onClick={() => handleUpdateTarget(item.id)}>Simpan</Button>
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
