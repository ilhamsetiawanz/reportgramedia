import { useEffect, useState } from "react";
import { supabase } from "../../lib/supabase";
import PageMeta from "../../components/common/PageMeta";
import Button from "../../components/ui/button/Button";
import { useAuthStore } from "../../store/useAuthStore";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend,
  PieChart, Pie, Cell 
} from 'recharts';

interface MonthlyData {
  dept_id: string;
  dept_name: string;
  actual: number;
  target: number;
  last_year: number;
}

export default function MonthlyReport() {
  const [data, setData] = useState<MonthlyData[]>([]);
  const [month, setMonth] = useState(new Date().getMonth() + 1);
  const [year, setYear] = useState(new Date().getFullYear());
  const [isLoading, setIsLoading] = useState(false);
  const { profile } = useAuthStore();

  useEffect(() => {
    if (profile?.id) {
      fetchMonthlyReport();
    }
  }, [month, year, profile]);

  async function fetchMonthlyReport() {
    setIsLoading(true);
    try {
      if (!profile) return;
      let targetDeptIds: string[] | null = null;

      // Filter by role assignments
      if (profile.role !== 'store_manager') {
        const { data: assignments } = await supabase
          .from('monthly_assignments')
          .select('department_id')
          .eq(profile.role === 'supervisor' ? 'supervisor_id' : 'sa_id', profile.id)
          .eq('month', month)
          .eq('year', year);
        
        targetDeptIds = assignments?.map(a => a.department_id) || [];
      }

      // 1. Get departments
      let deptQuery = supabase.from('departments').select('id, name').eq('is_active', true);
      if (targetDeptIds) {
        deptQuery = deptQuery.in('id', targetDeptIds);
      }
      const { data: depts } = await deptQuery;
      
      if (!depts || depts.length === 0) {
        setData([]);
        return;
      }

      const activeDeptIds = depts.map(d => d.id);
      // 2. Get targets
      const { data: targets } = await supabase
        .from('monthly_targets')
        .select('*')
        .in('department_id', activeDeptIds)
        .eq('month', month)
        .eq('year', year);
      
      // 3. Get actual revenue
      const startDate = `${year}-${month.toString().padStart(2, '0')}-01`;
      const endDate = new Date(year, month, 0).toISOString().split('T')[0];
      
      const { data: actuals } = await supabase
        .from('daily_revenue')
        .select('department_id, amount')
        .eq('status', 'approved')
        .in('department_id', activeDeptIds)
        .gte('date', startDate)
        .lte('date', endDate);
      
      // Process Data
      const processed: MonthlyData[] = (depts || []).map(dept => {
        const targetObj = targets?.find(t => t.department_id === dept.id);
        const actualAmount = actuals?.filter(a => a.department_id === dept.id).reduce((acc, curr) => acc + curr.amount, 0) || 0;
        
        return {
          dept_id: dept.id,
          dept_name: dept.name,
          actual: actualAmount,
          target: targetObj?.target_amount || 0,
          last_year: targetObj?.last_year_amount || 0
        };
      });

      setData(processed);
    } catch (error) {
      console.error("Error fetching monthly report:", error);
    } finally {
      setIsLoading(false);
    }
  }

  const formatIDR = (val: number) => {
    return new Intl.NumberFormat("id-ID", {
      style: "currency",
      currency: "IDR",
      minimumFractionDigits: 0,
    }).format(val).replace(/,/g, ".");
  };

  const calculatePerc = (val: number, base: number) => {
    if (base === 0) return 0;
    return (val / base) * 100;
  };

  const totals = data.reduce((acc, curr) => ({
    actual: acc.actual + curr.actual,
    target: acc.target + curr.target,
    ly: acc.ly + curr.last_year
  }), { actual: 0, target: 0, ly: 0 });

  const exportPDF = () => {
    const doc = new jsPDF('l', 'mm', 'a4'); 
    const monthName = new Date(0, month - 1).toLocaleString('id-ID', { month: 'long' });

    doc.setFontSize(16);
    doc.text(`Analisa Performa Bulanan - Gramedia Kendari`, 14, 15);
    doc.setFontSize(12);
    doc.text(`Periode: ${monthName} ${year}`, 14, 22);

    const tableColumn = ["Departemen", `Omset ${year-1}`, `Omset ${year}`, "Growth (Nom)", "Growth (%)", `Target ${year}`, "Ach (Nom)", "Ach (%)"];
    const tableRows: any[] = [];

    data.forEach(item => {
      const growthNom = item.actual - item.last_year;
      const growthPerc = calculatePerc(growthNom, item.last_year);
      const achNom = item.actual - item.target;
      const achPerc = calculatePerc(item.actual, item.target);

      tableRows.push([
        item.dept_name,
        formatIDR(item.last_year),
        formatIDR(item.actual),
        formatIDR(growthNom),
        `${growthPerc.toFixed(2)}%`,
        formatIDR(item.target),
        formatIDR(achNom),
        `${achPerc.toFixed(2)}%`
      ]);
    });

    const totalGrowthNom = totals.actual - totals.ly;
    const totalAchNom = totals.actual - totals.target;
    tableRows.push([
      "GRAND TOTAL",
      formatIDR(totals.ly),
      formatIDR(totals.actual),
      formatIDR(totalGrowthNom),
      `${calculatePerc(totalGrowthNom, totals.ly).toFixed(2)}%`,
      formatIDR(totals.target),
      formatIDR(totalAchNom),
      `${calculatePerc(totals.actual, totals.target).toFixed(2)}%`
    ]);

    autoTable(doc, {
      head: [tableColumn],
      body: tableRows,
      startY: 28,
      theme: 'grid',
      headStyles: { fillColor: [43, 86, 179] },
      didParseCell: (data: any) => {
        if (data.row.index === tableRows.length - 1) {
          data.cell.styles.fontStyle = 'bold';
          data.cell.styles.fillColor = [240, 240, 240];
        }
      }
    });

    doc.save(`Laporan_Bulanan_${monthName}_${year}.pdf`);
  };

  return (
    <>
      <PageMeta title="Laporan Bulanan | Gramedia Kendari Tracker" description="Analisa performa bulanan sesuai standar report Gramedia" />
      
      <div className="flex flex-col gap-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
           <div>
             <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Analisa Performa Bulanan</h1>
             <p className="text-sm text-gray-500">Perbandingan Pencapaian Tahun Ini vs Tahun Lalu.</p>
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

        {/* Charts Section */}
        {!isLoading && data.length > 0 && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="rounded-2xl border border-gray-200 bg-white p-6 dark:border-white/[0.05] dark:bg-white/[0.03]">
              <h3 className="text-lg font-bold mb-6 dark:text-white">Pertumbuhan Per Departemen (YoY)</h3>
              <div className="h-[300px] w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={data.map(d => ({ name: d.dept_name, current: d.actual, previous: d.last_year }))}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                    <XAxis dataKey="name" hide />
                    <YAxis hide />
                    <Tooltip 
                      formatter={(val: number) => `Rp ${val.toLocaleString()}`}
                      contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)' }}
                    />
                    <Legend />
                    <Bar name={`Tahun ${year-1}`} dataKey="previous" fill="#94a3b8" radius={[4, 4, 0, 0]} />
                    <Bar name={`Tahun ${year}`} dataKey="current" fill="#3C50E0" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>

            <div className="rounded-2xl border border-gray-200 bg-white p-6 dark:border-white/[0.05] dark:bg-white/[0.03]">
              <h3 className="text-lg font-bold mb-6 dark:text-white">Share Toko Per Departemen (%)</h3>
              <div className="h-[300px] w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={data.filter(d => d.actual > 0).map(d => ({ name: d.dept_name, value: d.actual }))}
                      cx="50%"
                      cy="50%"
                      innerRadius={60}
                      outerRadius={100}
                      paddingAngle={5}
                      dataKey="value"
                    >
                      {data.map((_, index) => (
                        <Cell key={`cell-${index}`} fill={CHART_COLORS[index % CHART_COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip formatter={(val: number) => `Rp ${val.toLocaleString()}`} />
                    <Legend layout="vertical" align="right" verticalAlign="middle" />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>
        )}

        {/* Custom Styled Table (Based on Image Reference) */}
        <div className="overflow-hidden rounded-xl border border-gray-200 bg-white dark:border-white/[0.05] dark:bg-white/[0.03]">
          <div className="max-w-full overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-brand-500 text-white">
                  <th rowSpan={2} className="px-5 py-4 text-sm font-bold border-r border-white/20 min-w-[180px]">Departement</th>
                  <th colSpan={2} className="px-5 py-2 text-sm font-bold text-center border-b border-white/20 border-r border-white/20">Omset</th>
                  <th colSpan={2} className="px-5 py-2 text-sm font-bold text-center border-b border-white/20 border-r border-white/20">Growth</th>
                  <th rowSpan={2} className="px-5 py-4 text-sm font-bold text-center border-r border-white/20">Target {year}</th>
                  <th colSpan={2} className="px-5 py-2 text-sm font-bold text-center border-b border-white/20">Achievement</th>
                </tr>
                <tr className="bg-brand-500 text-white">
                  <th className="px-5 py-2 text-xs font-bold text-right border-r border-white/20">{year - 1}</th>
                  <th className="px-5 py-2 text-xs font-bold text-right border-r border-white/20">{year}</th>
                  <th className="px-5 py-2 text-xs font-bold text-right border-r border-white/20">Selisih</th>
                  <th className="px-5 py-2 text-xs font-bold text-center border-r border-white/20">%</th>
                  <th className="px-5 py-2 text-xs font-bold text-right border-r border-white/20">Selisih</th>
                  <th className="px-5 py-2 text-xs font-bold text-center">%</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-white/5">
                {isLoading ? (
                  <tr><td colSpan={8} className="py-20 text-center text-gray-400 italic">Sedang menyusun laporan...</td></tr>
                ) : data.length === 0 ? (
                  <tr><td colSpan={8} className="py-20 text-center text-gray-400 font-medium">Data transaksi belum tersedia.</td></tr>
                ) : (
                  <>
                    {data.map((item) => {
                      const growthNom = item.actual - item.last_year;
                      const growthPerc = calculatePerc(growthNom, item.last_year);
                      const achNom = item.actual - item.target;
                      const achPerc = calculatePerc(item.actual, item.target);

                      return (
                        <tr key={item.dept_id} className="hover:bg-gray-50 dark:hover:bg-white/[0.02]">
                          <td className="px-5 py-3 text-sm font-medium text-gray-900 dark:text-white border-r border-gray-100 dark:border-white/5">{item.dept_name}</td>
                          <td className="px-5 py-3 text-sm text-right border-r border-gray-100 dark:border-white/5">{formatIDR(item.last_year)}</td>
                          <td className="px-5 py-3 text-sm text-right border-r border-gray-100 dark:border-white/5">{formatIDR(item.actual)}</td>
                          <td className={`px-5 py-3 text-sm text-right border-r border-gray-100 dark:border-white/5 ${growthNom < 0 ? 'text-red-600' : 'text-success-600'}`}>{formatIDR(growthNom)}</td>
                          <td className={`px-5 py-3 text-sm text-center border-r border-gray-100 dark:border-white/5 font-bold ${growthPerc < 0 ? 'text-error-600' : 'text-success-600'}`}>
                            {growthPerc.toFixed(2)}%
                          </td>
                          <td className="px-5 py-3 text-sm text-right border-r border-gray-100 dark:border-white/5">{formatIDR(item.target)}</td>
                          <td className={`px-5 py-3 text-sm text-right border-r border-gray-100 dark:border-white/5 font-bold ${achNom < 0 ? 'text-error-600' : 'text-success-600'}`}>{formatIDR(achNom)}</td>
                          <td className={`px-5 py-3 text-sm text-center font-bold ${achPerc >= 100 ? 'text-success-600' : achPerc >= 80 ? 'text-amber-500' : 'text-error-600'}`}>
                            {achPerc.toFixed(2)}%
                          </td>
                        </tr>
                      );
                    })}
                    {/* Grand Total Footer */}
                    <tr className="bg-brand-500 text-white font-bold">
                       <td className="px-5 py-3 text-sm border-r border-white/20 uppercase">Grand Total</td>
                       <td className="px-5 py-3 text-sm text-right border-r border-white/20">{formatIDR(totals.ly)}</td>
                       <td className="px-5 py-3 text-sm text-right border-r border-white/20">{formatIDR(totals.actual)}</td>
                       <td className="px-5 py-3 text-sm text-right border-r border-white/20">{formatIDR(totals.actual - totals.ly)}</td>
                       <td className={`px-5 py-3 text-sm text-center border-r border-white/20 font-bold ${(totals.actual - totals.ly) < 0 ? 'text-red-200' : 'text-green-200'}`}>
                          {calculatePerc(totals.actual - totals.ly, totals.ly).toFixed(2)}%
                       </td>
                       <td className="px-5 py-3 text-sm text-right border-r border-white/20">{formatIDR(totals.target)}</td>
                       <td className="px-5 py-3 text-sm text-right border-r border-white/20">{formatIDR(totals.actual - totals.target)}</td>
                       <td className={`px-5 py-3 text-sm text-center font-black ${calculatePerc(totals.actual, totals.target) >= 100 ? 'text-green-200' : 'text-red-200'}`}>
                          {calculatePerc(totals.actual, totals.target).toFixed(2)}%
                       </td>
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

const CHART_COLORS = ['#3C50E0', '#10B981', '#FFB819', '#FF4D4D', '#8B5CF6', '#22D3EE', '#F472B6'];
