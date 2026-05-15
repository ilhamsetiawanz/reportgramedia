import { useEffect, useState } from "react";
import { supabase } from "../../lib/supabase";
import { useAuthStore } from "../../store/useAuthStore";
import PageMeta from "../../components/common/PageMeta";

interface WeeklyData {
  weekKey: string; // "YYYY-WW" or just the week index in month
  weekLabel: string;
  total: number;
  counterValues: Record<string, number>; // counterId -> amount
}

interface CounterInfo {
  id: string;
  name: string;
}

export default function CounterWeeklyRecap() {
  const { profile } = useAuthStore();
  const [matrix, setMatrix] = useState<WeeklyData[]>([]);
  const [counters, setCounters] = useState<CounterInfo[]>([]);
  const [month, setMonth] = useState(new Date().getMonth() + 1);
  const [year, setYear] = useState(new Date().getFullYear());
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    fetchData();
  }, [month, year]);

  async function fetchData() {
    setIsLoading(true);
    try {
      // 1. Fetch counters
      let counterQ = supabase.from("counters").select("id, name").eq("is_active", true);
      if (profile?.role === "supervisor") {
        counterQ = counterQ.eq("supervisor_id", profile.id);
      } else if (profile?.role === "counter" && profile?.counter_id) {
        counterQ = counterQ.eq("id", profile.counter_id);
      }
      const { data: counterList } = await counterQ;
      setCounters(counterList || []);

      const activeCounterIds = (counterList || []).map(c => c.id);
      if (activeCounterIds.length === 0) {
        setMatrix([]);
        return;
      }

      // 2. Fetch weekly revenue
      const startDate = `${year}-${month.toString().padStart(2, '0')}-01`;
      const lastDay = new Date(year, month, 0).getDate();
      const endDate = `${year}-${month.toString().padStart(2, '0')}-${lastDay.toString().padStart(2, '0')}`;

      const { data: revenue } = await supabase
        .from("counter_weekly_revenue")
        .select("week_start, week_end, amount, counter_id")
        .eq("status", "approved")
        .in("counter_id", activeCounterIds)
        .gte("week_start", startDate)
        .lte("week_start", endDate);

      // 3. Build Matrix (Grouped by week_start)
      const weeks: Record<string, WeeklyData> = {};
      
      (revenue || []).forEach(r => {
        const key = r.week_start;
        if (!weeks[key]) {
          weeks[key] = {
            weekKey: key,
            weekLabel: `${new Date(r.week_start).toLocaleDateString('id-ID', { day: '2-digit', month: 'short' })} - ${new Date(r.week_end).toLocaleDateString('id-ID', { day: '2-digit', month: 'short' })}`,
            total: 0,
            counterValues: {}
          };
        }
        weeks[key].counterValues[r.counter_id] = (weeks[key].counterValues[r.counter_id] || 0) + r.amount;
        weeks[key].total += r.amount;
      });

      const sortedWeeks = Object.values(weeks).sort((a, b) => a.weekKey.localeCompare(b.weekKey));
      setMatrix(sortedWeeks);
    } catch (error) {
      console.error(error);
    } finally {
      setIsLoading(false);
    }
  }

  const formatIDR = (val: number) => {
    return val > 0 ? `Rp${val.toLocaleString("id-ID")}` : "Rp0";
  };

  // Totals for the bottom row
  const columnTotals = counters.reduce((acc, c) => {
    acc[c.id] = matrix.reduce((sum, row) => sum + (row.counterValues[c.id] || 0), 0);
    return acc;
  }, {} as Record<string, number>);

  const grandTotal = matrix.reduce((sum, row) => sum + row.total, 0);

  return (
    <>
      <PageMeta title="Rekap Omset Counter | Gramedia Tracker" description="Laporan mingguan per brand counter." />
      
      <div className="flex flex-col gap-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Rekap Omset Counter</h1>
            <p className="text-sm text-gray-500 italic">Rincian performa mingguan per brand (Approved Only)</p>
          </div>

          <div className="flex items-center gap-3">
             <select 
               className="h-10 px-3 border border-gray-300 rounded-lg dark:bg-gray-900 dark:border-gray-800 outline-none"
               value={month}
               onChange={(e) => setMonth(parseInt(e.target.value))}
             >
                {Array.from({ length: 12 }, (_, i) => (
                  <option key={i+1} value={i+1}>{new Date(0, i).toLocaleString('id-ID', { month: 'long' })}</option>
                ))}
             </select>
             <select 
               className="h-10 px-3 border border-gray-300 rounded-lg dark:bg-gray-900 dark:border-gray-800 outline-none"
               value={year}
               onChange={(e) => setYear(parseInt(e.target.value))}
             >
                {[2024, 2025, 2026].map(y => (
                  <option key={y} value={y}>{y}</option>
                ))}
             </select>
          </div>
        </div>

        <div className="overflow-hidden rounded-xl border border-gray-200 bg-white dark:border-white/[0.05] dark:bg-white/[0.03]">
          <div className="max-w-full overflow-x-auto shadow-sm">
            <table className="w-full text-left border-collapse border-spacing-0">
              <thead>
                <tr className="bg-[#1e293b] text-white">
                  <th colSpan={counters.length + 2} className="px-5 py-3 text-center text-sm font-bold uppercase tracking-widest border-b border-white/10">
                    Matriks Omset Counter Mingguan
                  </th>
                </tr>
                <tr className="bg-brand-600 text-white">
                  <th className="px-4 py-3 text-xs font-bold border-r border-white/20 w-48 sticky left-0 z-20 bg-brand-600">Periode</th>
                  <th className="px-5 py-3 text-xs font-bold text-center border-r border-white/20 min-w-[150px] sticky left-[192px] z-20 bg-brand-600">Total Mingguan</th>
                  {counters.map((c) => (
                    <th key={c.id} className="px-5 py-3 text-xs font-bold text-center border-r border-white/20 min-w-[150px]">
                      {c.name}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-white/5">
                {isLoading ? (
                  <tr><td colSpan={counters.length + 2} className="py-20 text-center text-gray-400 italic">Menyusun matriks data...</td></tr>
                ) : matrix.length === 0 ? (
                  <tr><td colSpan={counters.length + 2} className="py-20 text-center text-gray-400 font-medium">Data tidak ditemukan untuk periode ini.</td></tr>
                ) : (
                  <>
                    {matrix.map((row) => (
                      <tr key={row.weekKey} className="hover:bg-gray-50 dark:hover:bg-white/[0.02] transition-colors group">
                        <td className="px-4 py-3 text-xs border-r border-gray-200 dark:border-white/5 sticky left-0 z-10 bg-white dark:bg-gray-900 group-hover:bg-gray-50 dark:group-hover:bg-white/[0.02]">
                          {row.weekLabel}
                        </td>
                        <td className="px-5 py-3 text-xs font-bold text-brand-600 dark:text-brand-400 border-r border-gray-200 dark:border-white/5 text-right sticky left-[192px] z-10 bg-white dark:bg-gray-900 group-hover:bg-gray-50 dark:group-hover:bg-white/[0.02]">
                          {formatIDR(row.total)}
                        </td>
                        {counters.map((c) => (
                          <td key={c.id} className="px-5 py-3 text-xs text-right border-r border-gray-200 dark:border-white/5 text-gray-600 dark:text-gray-400">
                            {formatIDR(row.counterValues[c.id] || 0)}
                          </td>
                        ))}
                      </tr>
                    ))}
                    {/* Bottom Total Row */}
                    <tr className="bg-gray-100 dark:bg-white/5 font-bold">
                      <td className="px-4 py-3 text-xs border-r border-gray-200 dark:border-white/5 sticky left-0 z-10 bg-gray-100 dark:bg-gray-800">
                        TOTAL BULAN INI
                      </td>
                      <td className="px-5 py-3 text-xs text-right border-r border-gray-200 dark:border-white/5 sticky left-[192px] z-10 bg-gray-100 dark:bg-gray-800">
                        {formatIDR(grandTotal)}
                      </td>
                      {counters.map((c) => (
                        <td key={c.id} className="px-5 py-3 text-xs text-right border-r border-gray-200 dark:border-white/5">
                          {formatIDR(columnTotals[c.id])}
                        </td>
                      ))}
                    </tr>
                  </>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </>
  );
}
