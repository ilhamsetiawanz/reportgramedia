import { useEffect, useState } from "react";
import { supabase } from "../../lib/supabase";
import { useAuthStore } from "../../store/useAuthStore";
import PageMeta from "../../components/common/PageMeta";
import { Table, TableBody, TableCell, TableHeader, TableRow } from "../../components/ui/table";
import Button from "../../components/ui/button/Button";
import CurrencyInput from "../../components/form/input/CurrencyInput";

interface TargetData {
  department_id: string;
  name: string;
  target_amount: number;
  last_year_amount: number;
}

export default function MonthlyTargetsSPV() {
  const { profile } = useAuthStore();
  const [data, setData] = useState<TargetData[]>([]);
  const [lyInputs, setLyInputs] = useState<Record<string, string>>({});
  const [targetInputs, setTargetInputs] = useState<Record<string, string>>({});
  const [isLoading, setIsLoading] = useState(true);

  const [selectedMonth, setSelectedMonth] = useState(new Date().getMonth() + 1);
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());

  useEffect(() => {
    fetchTargetData();
  }, [selectedMonth, selectedYear]);

  async function fetchTargetData() {
    setIsLoading(true);
    try {
      if (!profile) return;

      // 1. Get departments for this SPV from monthly_assignments
      const { data: assignments } = await supabase
        .from("monthly_assignments")
        .select("department_id, departments(id, name)")
        .eq("supervisor_id", profile.id)
        .eq("month", selectedMonth)
        .eq("year", selectedYear);

      const depts = (assignments || []).map(a => ({
        id: a.department_id,
        name: (a.departments as any)?.name || "Unknown"
      }));

      if (!depts || depts.length === 0) {
        setData([]);
        return;
      }

      const deptIds = depts.map(d => d.id);

      const { data: targets } = await supabase
        .from("monthly_targets")
        .select("*")
        .in("department_id", deptIds)
        .eq("year", selectedYear)
        .eq("month", selectedMonth);

      const combined = depts.map(dept => {
        const t = targets?.find(target => target.department_id === dept.id);
        return {
          department_id: dept.id,
          name: dept.name,
          target_amount: t?.target_amount || 0,
          last_year_amount: t?.last_year_amount || 0
        };
      });

      setData(combined);

      const lyInputMap: Record<string, string> = {};
      const targetInputMap: Record<string, string> = {};
      combined.forEach(item => {
        lyInputMap[item.department_id] = item.last_year_amount.toString();
        targetInputMap[item.department_id] = item.target_amount.toString();
      });
      setLyInputs(lyInputMap);
      setTargetInputs(targetInputMap);
    } catch (error) {
      console.error("Error fetching targets:", error);
    } finally {
      setIsLoading(false);
    }
  }

  async function handleUpdateData(deptId: string) {
    const lyAmount = parseInt(lyInputs[deptId] || "0");
    const targetAmount = parseInt(targetInputs[deptId] || "0");
    try {
      const { error } = await supabase
        .from("monthly_targets")
        .upsert({
          department_id: deptId,
          year: selectedYear,
          month: selectedMonth,
          last_year_amount: lyAmount,
          target_amount: targetAmount,
        }, { onConflict: 'department_id,year,month' });

      if (error) throw error;
      alert("Target & LY diperbarui!");
      fetchTargetData();
    } catch (error) {
      alert("Gagal update data: " + (error as any).message);
    }
  }

  return (
    <>
      <PageMeta title="Target SPV | Gramedia Tracker" description="Input data pembanding Last Year" />

      <div className="flex flex-col gap-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Input Omset Tahun Lalu (LY)</h1>
            <p className="text-gray-500 text-sm italic">Periode: {selectedMonth}/{selectedYear}</p>
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
          <div className="max-w-full overflow-x-auto">
            <Table>
              <TableHeader className="border-b border-gray-100 dark:border-white/[0.05]">
                <TableRow>
                  <TableCell isHeader className="px-5 py-3 text-start text-theme-xs">Departemen</TableCell>
                  <TableCell isHeader className="px-5 py-3 text-start text-theme-xs">Target Omset (Bulan Ini)</TableCell>
                  <TableCell isHeader className="px-5 py-3 text-start text-theme-xs">Omset LY (Tahun Lalu)</TableCell>
                  <TableCell isHeader className="px-5 py-3 text-end text-theme-xs">Aksi</TableCell>
                </TableRow>
              </TableHeader>
              <TableBody className="divide-y divide-gray-100 dark:divide-white/[0.05]">
                {isLoading ? (
                  <TableRow>
                    <TableCell colSpan={4} className="text-center py-10 text-gray-400">Memuat data...</TableCell>
                  </TableRow>
                ) : data.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={4} className="text-center py-10 text-gray-400 font-medium">Anda belum ditunjuk sebagai Supervisor departemen manapun.</TableCell>
                  </TableRow>
                ) : (
                  data.map((item) => (
                    <TableRow key={item.department_id}>
                      <TableCell className="px-5 py-4 font-medium text-gray-800 dark:text-white/90">{item.name}</TableCell>
                      <TableCell className="px-5 py-4">
                        <CurrencyInput
                          placeholder="Nilai Target"
                          className="h-10 text-sm max-w-[180px]"
                          value={Number(targetInputs[item.department_id] || 0)}
                          onChange={(val) => setTargetInputs({ ...targetInputs, [item.department_id]: val.toString() })}
                        />
                      </TableCell>
                      <TableCell className="px-5 py-4">
                        <CurrencyInput
                          placeholder="Nilai LY"
                          className="h-10 text-sm max-w-[180px]"
                          value={Number(lyInputs[item.department_id] || 0)}
                          onChange={(val) => setLyInputs({ ...lyInputs, [item.department_id]: val.toString() })}
                        />
                      </TableCell>
                      <TableCell className="px-5 py-4 text-end">
                        <Button size="sm" onClick={() => handleUpdateData(item.department_id)}>
                          Simpan
                        </Button>
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
