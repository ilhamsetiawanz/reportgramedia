import { useEffect, useState } from "react";
import { supabase } from "../../lib/supabase";
import { useAuthStore } from "../../store/useAuthStore";
import PageMeta from "../../components/common/PageMeta";

interface DailyData {
  day: number;
  dayName: string;
  total: number;
  deptValues: Record<string, number>; // deptId -> amount
}

interface DeptInfo {
  id: string;
  name: string;
}

export default function DailyRecap() {
  const { profile } = useAuthStore();
  const [matrix, setMatrix] = useState<DailyData[]>([]);
  const [depts, setDepts] = useState<DeptInfo[]>([]);
  const [month, setMonth] = useState(new Date().getMonth() + 1);
  const [year, setYear] = useState(new Date().getFullYear());
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (profile?.id) {
      fetchData();
    }
  }, [month, year, profile]);

  const getIndonesianDay = (date: Date) => {
    const days = ["Minggu", "Senin", "Selasa", "Rabu", "Kamis", "Jumat", "Sabtu"];
    return days[date.getDay()];
  };

  async function fetchData() {
    setIsLoading(true);
    try {
      if (!profile) return;

      // 1. Determine which departments to show
      let targetDeptIds: string[] | null = null;
      if (profile.role !== "store_manager") {
         const { data: assignments } = await supabase
           .from("monthly_assignments")
           .select("department_id")
           .eq(profile.role === 'supervisor' ? 'supervisor_id' : 'sa_id', profile.id)
           .eq("month", month)
           .eq("year", year);
         
         targetDeptIds = assignments?.map(a => a.department_id) || [];
      }

      const deptQuery = supabase.from("departments").select("id, name").eq("is_active", true);
      if (targetDeptIds) {
        deptQuery.in("id", targetDeptIds);
      }
      const { data: deptList } = await deptQuery;
      setDepts(deptList || []);

      const activeDeptIds = (deptList || []).map(d => d.id);
      if (activeDeptIds.length === 0) {
        setMatrix([]);
        return;
      }

      // 2. Fetch all revenue for the month
      const startDate = `${year}-${month.toString().padStart(2, '0')}-01`;
      const lastDay = new Date(year, month, 0).getDate();
      const endDate = `${year}-${month.toString().padStart(2, '0')}-${lastDay.toString().padStart(2, '0')}`;

      const { data: revenue } = await supabase
        .from("daily_revenue")
        .select("date, amount, department_id")
        .eq("status", "approved")
        .in("department_id", activeDeptIds)
        .gte("date", startDate)
        .lte("date", endDate);

      // 3. Build the Matrix
      const newMatrix: DailyData[] = [];
      for (let i = 1; i <= lastDay; i++) {
        const dateStr = `${year}-${month.toString().padStart(2, '0')}-${i.toString().padStart(2, '0')}`;
        const dayDate = new Date(year, month - 1, i);
        
        const rowData: DailyData = {
          day: i,
          dayName: getIndonesianDay(dayDate),
          total: 0,
          deptValues: {}
        };

        let rowTotal = 0;
        activeDeptIds.forEach(deptId => {
          const amount = revenue?.filter(r => r.date === dateStr && r.department_id === deptId)
                                .reduce((acc, curr) => acc + curr.amount, 0) || 0;
          rowData.deptValues[deptId] = amount;
          rowTotal += amount;
        });
        rowData.total = rowTotal;
        if (rowTotal > 0) {
          newMatrix.push(rowData);
        }
      }

      setMatrix(newMatrix);
    } catch (error) {
      console.error("Error fetching daily recap:", error);
    } finally {
      setIsLoading(false);
    }
  }

  const formatIDR = (val: number) => {
    return val > 0 ? `Rp${val.toLocaleString("id-ID")}` : "Rp0";
  };

  return (
    <>
      <PageMeta title="Rekap Omset Harian | Gramedia Kendari" description="Tabel rincian omset harian per departemen" />
      
      <div className="flex flex-col gap-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Rekap Omset Harian</h1>
            <p className="text-sm text-gray-500 italic">Rincian performa harian per departemen (Approved Only)</p>
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
               {[year-1, year, year+1].map(y => (
                 <option key={y} value={y}>{y}</option>
               ))}
             </select>
          </div>
        </div>

        <div className="overflow-hidden rounded-xl border border-gray-200 bg-white dark:border-white/[0.05] dark:bg-white/[0.03]">
          <div className="max-w-full overflow-x-auto shadow-sm">
            <table className="w-full text-left border-collapse border-spacing-0">
              <thead>
                <tr className="bg-[#2B56B3] text-white">
                  <th colSpan={depts.length + 3} className="px-5 py-3 text-center text-sm font-bold uppercase tracking-widest border-b border-white/10">
                    Omset Harian
                  </th>
                </tr>
                <tr className="bg-brand-500 text-white">
                  <th className="px-3 py-3 text-xs font-bold text-center border-r border-white/20 w-12 sticky left-0 z-20 bg-brand-500">Tgl</th>
                  <th className="px-4 py-3 text-xs font-bold border-r border-white/20 w-24 sticky left-[48px] z-20 bg-brand-500">Hari</th>
                  <th className="px-5 py-3 text-xs font-bold text-center border-r border-white/20 min-w-[140px] sticky left-[144px] z-20 bg-brand-500">Omset Total</th>
                  {depts.map((d) => (
                    <th key={d.id} className="px-5 py-3 text-xs font-bold text-center border-r border-white/20 min-w-[140px]">
                      {d.name.replace("DEP ", "")}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-white/5">
                {isLoading ? (
                  <tr><td colSpan={depts.length + 3} className="py-20 text-center text-gray-400 italic">Menyusun matriks data...</td></tr>
                ) : matrix.length === 0 ? (
                  <tr><td colSpan={depts.length + 3} className="py-20 text-center text-gray-400 font-medium">Data tidak ditemukan untuk periode ini.</td></tr>
                ) : (
                  matrix.map((row) => (
                    <tr key={row.day} className="hover:bg-gray-50 dark:hover:bg-white/[0.02] transition-colors group">
                      <td className="px-3 py-2 text-xs text-center border-r border-gray-200 dark:border-white/5 sticky left-0 z-10 bg-white dark:bg-gray-900 group-hover:bg-gray-50 dark:group-hover:bg-white/[0.02]">
                        {row.day}
                      </td>
                      <td className="px-4 py-2 text-xs border-r border-gray-200 dark:border-white/5 sticky left-[48px] z-10 bg-white dark:bg-gray-900 group-hover:bg-gray-50 dark:group-hover:bg-white/[0.02]">
                        {row.dayName}
                      </td>
                      <td className="px-5 py-2 text-xs font-bold text-gray-900 dark:text-white border-r border-gray-200 dark:border-white/5 text-right sticky left-[144px] z-10 bg-white dark:bg-gray-900 group-hover:bg-gray-50 dark:group-hover:bg-white/[0.02]">
                        {formatIDR(row.total)}
                      </td>
                      {depts.map((d) => (
                        <td key={d.id} className="px-5 py-2 text-xs text-right border-r border-gray-200 dark:border-white/5 text-gray-600 dark:text-gray-400">
                          {formatIDR(row.deptValues[d.id] || 0)}
                        </td>
                      ))}
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </>
  );
}
