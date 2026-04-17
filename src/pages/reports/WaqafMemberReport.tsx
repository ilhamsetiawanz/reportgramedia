import { useEffect, useState } from "react";
import { supabase } from "../../lib/supabase";
import PageMeta from "../../components/common/PageMeta";
import { useAuthStore } from "../../store/useAuthStore";
import { Table, TableBody, TableCell, TableHeader, TableRow } from "../../components/ui/table";
import Badge from "../../components/ui/badge/Badge";
import Button from "../../components/ui/button/Button";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

interface WMReportData {
  sa_id: string;
  sa_name: string;
  spv_name: string;
  waqaf_actual: number;
  waqaf_target: number;
  member_actual: number;
  member_target: number;
}

export default function WaqafMemberReport() {
  const { profile } = useAuthStore();
  const [data, setData] = useState<WMReportData[]>([]);
  const [month, setMonth] = useState(new Date().getMonth() + 1);
  const [year, setYear] = useState(new Date().getFullYear());
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    fetchReport();
  }, [month, year, profile]);

  async function fetchReport() {
    if (!profile) return;
    setIsLoading(true);
    try {
      // 1. Fetch SAs based on role
      let saQuery = supabase.from("users").select("id, full_name, supervisor_id, supervisors:supervisor_id(full_name)").eq("role", "store_associate");
      if (profile.role === 'supervisor') {
        saQuery = saQuery.eq("supervisor_id", profile.id);
      } else if (profile.role === 'store_associate') {
        saQuery = saQuery.eq("id", profile.id);
      }
      const { data: saList } = await saQuery;
      if (!saList) return;

      const saIds = saList.map(s => s.id);

      // 2. Fetch Targets
      const { data: targets } = await supabase
        .from("waqaf_member_targets")
        .select("*")
        .in("sa_id", saIds)
        .eq("month", month)
        .eq("year", year);

      // 3. Fetch Actuals
      const startDate = `${year}-${month.toString().padStart(2, '0')}-01`;
      const endDate = new Date(year, month, 0).toISOString().split('T')[0];
      const { data: entries } = await supabase
        .from("waqaf_member_entries")
        .select("sa_id, waqaf_amount, member_count")
        .in("sa_id", saIds)
        .gte("date", startDate)
        .lte("date", endDate);

      // 4. Combine
      const report = saList.map(sa => {
        const target = targets?.find(t => t.sa_id === sa.id);
        const actuals = entries?.filter(e => e.sa_id === sa.id);
        
        return {
          sa_id: sa.id,
          sa_name: sa.full_name,
          spv_name: (sa.supervisors as any)?.full_name || "Unknown",
          waqaf_target: target?.waqaf_target || 0,
          waqaf_actual: actuals?.reduce((acc, curr) => acc + (curr.waqaf_amount || 0), 0) || 0,
          member_target: target?.member_target || 0,
          member_actual: actuals?.reduce((acc, curr) => acc + (curr.member_count || 0), 0) || 0,
        };
      });

      setData(report);
    } catch (error) {
      console.error("Error fetching WM report:", error);
    } finally {
      setIsLoading(false);
    }
  }

  const calculatePerc = (actual: number, target: number) => {
    if (target <= 0) return 0;
    return (actual / target) * 100;
  };

  const exportPDF = () => {
    const doc = new jsPDF('p', 'mm', 'a4');
    const monthName = new Date(0, month - 1).toLocaleString('id-ID', { month: 'long' });

    doc.setFontSize(16);
    doc.text(`Rekap Waqaf & Member - Gramedia Kendari`, 14, 15);
    doc.setFontSize(10);
    doc.text(`Periode: ${monthName} ${year}`, 14, 22);

    const tableColumn = ["Nama SA", "Waqaf (Target)", "Waqaf (Actual)", "Waqaf (%)", "Member (Target)", "Member (Actual)", "Member (%)"];
    const tableRows: any[] = [];

    data.forEach(item => {
      tableRows.push([
        item.sa_name,
        `Rp ${item.waqaf_target.toLocaleString()}`,
        `Rp ${item.waqaf_actual.toLocaleString()}`,
        `${calculatePerc(item.waqaf_actual, item.waqaf_target).toFixed(1)}%`,
        item.member_target,
        item.member_actual,
        `${calculatePerc(item.member_actual, item.member_target).toFixed(1)}%`
      ]);
    });

    autoTable(doc, {
      head: [tableColumn],
      body: tableRows,
      startY: 28,
      theme: 'grid',
      headStyles: { fillColor: [43, 86, 179] }
    });

    doc.save(`Rekap_WM_${monthName}_${year}.pdf`);
  };

  const totalWaqaf = data.reduce((acc, curr) => acc + curr.waqaf_actual, 0);
  const totalMember = data.reduce((acc, curr) => acc + curr.member_actual, 0);
  const avgWaqafAch = data.length > 0 ? data.reduce((acc, curr) => acc + calculatePerc(curr.waqaf_actual, curr.waqaf_target), 0) / data.length : 0;
  const avgMemAch = data.length > 0 ? data.reduce((acc, curr) => acc + calculatePerc(curr.member_actual, curr.member_target), 0) / data.length : 0;

  return (
    <>
      <PageMeta title="Laporan Waqaf & Member | Gramedia Tracker" description="Rekapitulasi pencapaian waqaf dan member" />
      
      <div className="flex flex-col gap-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Laporan Pencapaian Non-Buku</h1>
            <p className="text-sm text-gray-500">Rekapitulasi Waqaf & Member MyValue.</p>
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
             <Button variant="outline" size="sm" onClick={exportPDF} disabled={data.length === 0}>
               Export PDF
             </Button>
          </div>
        </div>

        {/* Summary Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
           <div className="rounded-2xl border border-gray-200 bg-white p-6 dark:border-white/[0.05] dark:bg-white/[0.03]">
              <div className="flex items-center gap-4">
                 <div className="w-12 h-12 rounded-xl bg-brand-500/10 flex items-center justify-center text-brand-500 text-xl">🤲</div>
                 <div>
                    <p className="text-xs font-medium text-gray-500 uppercase tracking-wider">Total Waqaf Toko</p>
                    <h4 className="text-lg font-bold text-gray-900 dark:text-white">Rp {totalWaqaf.toLocaleString()}</h4>
                 </div>
              </div>
              <div className="mt-4 flex items-center gap-2">
                 <div className="flex-1 h-1.5 bg-gray-100 dark:bg-gray-800 rounded-full">
                    <div className="h-full bg-brand-500 rounded-full" style={{ width: `${Math.min(avgWaqafAch, 100)}%` }} />
                 </div>
                 <span className="text-xs font-bold text-brand-600">{avgWaqafAch.toFixed(1)}% Ach</span>
              </div>
           </div>

           <div className="rounded-2xl border border-gray-200 bg-white p-6 dark:border-white/[0.05] dark:bg-white/[0.03]">
              <div className="flex items-center gap-4">
                 <div className="w-12 h-12 rounded-xl bg-purple-500/10 flex items-center justify-center text-purple-500 text-xl">💎</div>
                 <div>
                    <p className="text-xs font-medium text-gray-500 uppercase tracking-wider">Total Member Baru</p>
                    <h4 className="text-lg font-bold text-gray-900 dark:text-white">{totalMember} User</h4>
                 </div>
              </div>
              <div className="mt-4 flex items-center gap-2">
                 <div className="flex-1 h-1.5 bg-gray-100 dark:bg-gray-800 rounded-full">
                    <div className="h-full bg-purple-500 rounded-full" style={{ width: `${Math.min(avgMemAch, 100)}%` }} />
                 </div>
                 <span className="text-xs font-bold text-purple-600">{avgMemAch.toFixed(1)}% Ach</span>
              </div>
           </div>

           <div className="rounded-2xl border border-gray-200 bg-white p-6 dark:border-white/[0.05] dark:bg-white/[0.03] flex items-center justify-center">
              <div className="text-center">
                 <p className="text-xs font-medium text-gray-500 uppercase mb-2">Health Index Performa</p>
                 <div className={`text-3xl font-black ${((avgWaqafAch + avgMemAch)/2) >= 80 ? 'text-success-600' : 'text-amber-500'}`}>
                    {((avgWaqafAch + avgMemAch)/2).toFixed(1)}%
                 </div>
                 <p className="text-[10px] text-gray-400 mt-1 italic">Rata-rata pencapaian staff bulan ini</p>
              </div>
           </div>
        </div>

        <div className="rounded-xl border border-gray-200 bg-white p-1 dark:border-white/[0.05] dark:bg-white/[0.03]">
          <Table>
            <TableHeader className="bg-brand-500 text-white">
              <TableRow>
                <TableCell isHeader rowSpan={2} className="px-5 py-4 text-white align-middle">Store Associate</TableCell>
                {profile?.role === 'store_manager' && <TableCell isHeader rowSpan={2} className="px-5 py-4 text-white align-middle">Supervisor</TableCell>}
                <TableCell isHeader colSpan={2} className="px-5 py-2 text-center border-b border-white/20 text-white">Pencapaian Waqaf</TableCell>
                <TableCell isHeader colSpan={2} className="px-5 py-2 text-center border-b border-white/20 text-white">Pencapaian MyValue Member</TableCell>
              </TableRow>
              <TableRow>
                <TableCell isHeader className="px-5 py-2 text-[10px] text-white/80 uppercase text-center border-r border-white/10">Target & Progress</TableCell>
                <TableCell isHeader className="px-5 py-2 text-[10px] text-white/80 uppercase text-center border-r border-white/10">Status</TableCell>
                <TableCell isHeader className="px-5 py-2 text-[10px] text-white/80 uppercase text-center border-r border-white/10">Target & Progress</TableCell>
                <TableCell isHeader className="px-5 py-2 text-[10px] text-white/80 uppercase text-center">Status</TableCell>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow><TableCell colSpan={8} className="text-center py-10">Memuat data...</TableCell></TableRow>
              ) : data.length === 0 ? (
                <TableRow><TableCell colSpan={8} className="text-center py-10">Belum ada data periode ini.</TableCell></TableRow>
              ) : (
                data.map(item => {
                  const wPerc = Math.min(calculatePerc(item.waqaf_actual, item.waqaf_target), 100);
                  const mPerc = Math.min(calculatePerc(item.member_actual, item.member_target), 100);
                  const wPercRaw = calculatePerc(item.waqaf_actual, item.waqaf_target);
                  const mPercRaw = calculatePerc(item.member_actual, item.member_target);

                  return (
                    <TableRow key={item.sa_id} className="hover:bg-gray-50/50 dark:hover:bg-white/5 transition-colors">
                      <TableCell className="px-5 py-4">
                         <div className="flex items-center gap-3">
                            <div className="w-8 h-8 rounded-full bg-brand-500 flex items-center justify-center text-white text-xs font-bold">
                               {item.sa_name.charAt(0)}
                            </div>
                            <span className="font-bold text-gray-800 dark:text-gray-200">{item.sa_name}</span>
                         </div>
                      </TableCell>
                      {profile?.role === 'store_manager' && <TableCell className="px-5 py-4 text-sm text-gray-500 font-medium">{item.spv_name}</TableCell>}
                      
                      <TableCell className="px-5 py-4 min-w-[200px]">
                        <div className="flex flex-col gap-1.5">
                          <div className="flex justify-between text-xs font-semibold">
                             <span className="text-gray-900 dark:text-white">Rp {item.waqaf_actual.toLocaleString()}</span>
                             <span className="text-gray-400">Target: Rp {item.waqaf_target.toLocaleString()}</span>
                          </div>
                          <div className="w-full h-2.5 bg-gray-100 dark:bg-gray-800 rounded-full overflow-hidden border border-gray-100 dark:border-white/5">
                            <div 
                              className={`h-full rounded-full transition-all duration-1000 ${wPerc >= 100 ? 'bg-success-500 shadow-[0_0_10px_rgba(16,185,129,0.3)]' : 'bg-brand-500'}`} 
                              style={{ width: `${wPerc}%` }}
                            />
                          </div>
                        </div>
                      </TableCell>
                      <TableCell className="px-5 py-4 text-center">
                        <Badge size="sm" color={wPercRaw >= 100 ? 'success' : wPercRaw >= 50 ? 'warning' : 'error'}>
                          {wPercRaw.toFixed(1)}%
                        </Badge>
                      </TableCell>

                      <TableCell className="px-5 py-4 min-w-[200px]">
                        <div className="flex flex-col gap-1.5">
                          <div className="flex justify-between text-xs font-semibold">
                             <span className="text-gray-900 dark:text-white">{item.member_actual} Member</span>
                             <span className="text-gray-400">Target: {item.member_target}</span>
                          </div>
                          <div className="w-full h-2.5 bg-gray-100 dark:bg-gray-800 rounded-full overflow-hidden border border-gray-100 dark:border-white/5">
                            <div 
                              className={`h-full rounded-full transition-all duration-1000 ${mPerc >= 100 ? 'bg-success-500 shadow-[0_0_10px_rgba(16,185,129,0.3)]' : 'bg-purple-500'}`} 
                              style={{ width: `${mPerc}%` }}
                            />
                          </div>
                        </div>
                      </TableCell>
                      <TableCell className="px-5 py-4 text-center">
                        <Badge size="sm" color={mPercRaw >= 100 ? 'success' : mPercRaw >= 50 ? 'warning' : 'error'}>
                          {mPercRaw.toFixed(1)}%
                        </Badge>
                      </TableCell>
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
        </div>
      </div>
    </>
  );
}
