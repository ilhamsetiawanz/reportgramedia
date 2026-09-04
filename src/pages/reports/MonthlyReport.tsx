import { useEffect, useState } from "react";
import { supabase } from "../../lib/supabase";
import PageMeta from "../../components/common/PageMeta";
import Button from "../../components/ui/button/Button";
import { useAuthStore } from "../../store/useAuthStore";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend
} from 'recharts';
import { ChevronDownIcon, AngleRightIcon } from "../../icons";

interface MonthlyData {
  dept_id: string;
  dept_name: string;
  actual: number;
  target: number;
  last_year: number;
  spv_id?: string;
}

interface DeptInSpv {
  dept_id: string;
  dept_name: string;
  actual: number;
  target: number;
  last_year: number;
  sa_name?: string;
}

interface SpvMonthlyData {
  spv_id: string;
  spv_name: string;
  actual: number;
  target: number;
  last_year: number;
  departments: DeptInSpv[];
}

export default function MonthlyReport() {
  const [data, setData] = useState<MonthlyData[]>([]);
  const [spvData, setSpvData] = useState<SpvMonthlyData[]>([]);
  const [expandedSpv, setExpandedSpv] = useState<Set<string>>(new Set());
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

      // 4. Get SPV Assignments
      const { data: assignments } = await supabase
        .from('monthly_assignments')
        .select('department_id, supervisor_id, sa_id')
        .eq('month', month)
        .eq('year', year);

      // 5. Get Users (SPVs and SAs)
      const { data: usersData } = await supabase
        .from('users')
        .select('id, full_name, role')
        .in('role', ['supervisor', 'store_associate']);

      const supervisors = usersData?.filter(u => u.role === 'supervisor') || [];
      const storeAssociates = usersData?.filter(u => u.role === 'store_associate') || [];

      // Process Data
      const processed: MonthlyData[] = (depts || []).map(dept => {
        const targetObj = targets?.find(t => t.department_id === dept.id);
        const actualAmount = actuals?.filter(a => a.department_id === dept.id).reduce((acc, curr) => acc + curr.amount, 0) || 0;
        const spvAssignment = assignments?.find(a => a.department_id === dept.id);

        return {
          dept_id: dept.id,
          dept_name: dept.name,
          actual: actualAmount,
          target: targetObj?.target_amount || 0,
          last_year: targetObj?.last_year_amount || 0,
          spv_id: spvAssignment?.supervisor_id
        };
      });

      setData(processed);

      // Process SPV Data for SM
      if (profile.role === 'store_manager') {
        const spvMap: Record<string, SpvMonthlyData> = {};

        processed.forEach(d => {
          const sId = d.spv_id || "UNASSIGNED";
          if (!spvMap[sId]) {
            const spvInfo = supervisors?.find(s => s.id === sId);
            spvMap[sId] = {
              spv_id: sId,
              spv_name: spvInfo ? spvInfo.full_name : "Belum Diplot (Unassigned)",
              actual: 0,
              target: 0,
              last_year: 0,
              departments: []
            };
          }
          spvMap[sId].actual += d.actual;
          spvMap[sId].target += d.target;
          spvMap[sId].last_year += d.last_year;
          spvMap[sId].departments.push({
            dept_id: d.dept_id,
            dept_name: d.dept_name,
            actual: d.actual,
            target: d.target,
            last_year: d.last_year,
            sa_name: (() => {
              const assignment = assignments?.find(a => a.department_id === d.dept_id);
              if (assignment?.sa_id) {
                const sa = storeAssociates.find(u => u.id === assignment.sa_id);
                return sa ? sa.full_name : "-";
              }
              return "-";
            })()
          });
        });

        // Filter out Unassigned if everything is 0
        const finalSpvData = Object.values(spvMap).filter(s => s.actual > 0 || s.target > 0 || s.last_year > 0);
        // Sort departments within each SPV by actual descending
        finalSpvData.forEach(s => s.departments.sort((a, b) => b.actual - a.actual));
        setSpvData(finalSpvData.sort((a, b) => b.actual - a.actual));
        // Auto-expand all SPVs by default
        setExpandedSpv(new Set(finalSpvData.map(s => s.spv_id)));
      }

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

    const tableColumn = ["Departemen", `Omset ${year - 1}`, `Omset ${year}`, "Growth (Nom)", "Growth (%)", `Target ${year}`, "Ach (Nom)", "Ach (%)"];
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

  const exportSpvPDF = () => {
    const doc = new jsPDF('l', 'mm', 'a4');
    const monthName = new Date(0, month - 1).toLocaleString('id-ID', { month: 'long' });

    doc.setFontSize(16);
    doc.text(`Laporan Bulanan Per Supervisor - Gramedia Kendari`, 14, 15);
    doc.setFontSize(12);
    doc.text(`Periode: ${monthName} ${year}`, 14, 22);

    const tableColumn = ["SS / Departemen", "SOA", `Omset ${year - 1}`, `Omset ${year}`, "Growth (Nom)", "Growth (%)", `Target ${year}`, "Ach (Nom)", "Ach (%)"];
    const tableRows: any[] = [];
    const rowTypes: ('spv_header' | 'dept' | 'spv_total' | 'grand_total')[] = [];

    spvData.forEach(spv => {
      // 1. SPV Header Row
      tableRows.push([
        spv.spv_name,
        "",
        "",
        "",
        "",
        "",
        "",
        "",
        ""
      ]);
      rowTypes.push('spv_header');

      // 2. Department Rows
      spv.departments.forEach(dept => {
        const dGrowthNom = dept.actual - dept.last_year;
        const dGrowthPerc = calculatePerc(dGrowthNom, dept.last_year);
        const dAchNom = dept.actual - dept.target;
        const dAchPerc = calculatePerc(dept.actual, dept.target);

        tableRows.push([
          `   ${dept.dept_name}`,
          dept.sa_name || "-",
          formatIDR(dept.last_year),
          formatIDR(dept.actual),
          formatIDR(dGrowthNom),
          `${dGrowthPerc.toFixed(2)}%`,
          formatIDR(dept.target),
          formatIDR(dAchNom),
          `${dAchPerc.toFixed(2)}%`
        ]);
        rowTypes.push('dept');
      });

      // 3. SPV Total / Accumulation Row
      const spvGrowthNom = spv.actual - spv.last_year;
      const spvGrowthPerc = calculatePerc(spvGrowthNom, spv.last_year);
      const spvAchNom = spv.actual - spv.target;
      const spvAchPerc = calculatePerc(spv.actual, spv.target);

      tableRows.push([
        `Akumulasi - ${spv.spv_name}`,
        "",
        formatIDR(spv.last_year),
        formatIDR(spv.actual),
        formatIDR(spvGrowthNom),
        `${spvGrowthPerc.toFixed(2)}%`,
        formatIDR(spv.target),
        formatIDR(spvAchNom),
        `${spvAchPerc.toFixed(2)}%`
      ]);
      rowTypes.push('spv_total');
    });

    // 4. Grand Total Row
    const grandGrowthNom = totals.actual - totals.ly;
    const grandGrowthPerc = calculatePerc(grandGrowthNom, totals.ly);
    const grandAchNom = totals.actual - totals.target;
    const grandAchPerc = calculatePerc(totals.actual, totals.target);

    tableRows.push([
      "GRAND TOTAL",
      "",
      formatIDR(totals.ly),
      formatIDR(totals.actual),
      formatIDR(grandGrowthNom),
      `${grandGrowthPerc.toFixed(2)}%`,
      formatIDR(totals.target),
      formatIDR(grandAchNom),
      `${grandAchPerc.toFixed(2)}%`
    ]);
    rowTypes.push('grand_total');

    autoTable(doc, {
      head: [tableColumn],
      body: tableRows,
      startY: 28,
      theme: 'grid',
      headStyles: { fillColor: [43, 86, 179] },
      didParseCell: (data: any) => {
        const rowIndex = data.row.index;
        const type = rowTypes[rowIndex];

        if (type === 'spv_header') {
          data.cell.styles.fontStyle = 'bold';
          data.cell.styles.fillColor = [224, 231, 255];
          data.cell.styles.textColor = [30, 58, 138];
        } else if (type === 'spv_total') {
          data.cell.styles.fontStyle = 'bold';
          data.cell.styles.fillColor = [243, 244, 246];
        } else if (type === 'grand_total') {
          data.cell.styles.fontStyle = 'bold';
          data.cell.styles.fillColor = [43, 86, 179];
          data.cell.styles.textColor = [255, 255, 255];
        }
      }
    });

    doc.save(`Laporan_Bulanan_SPV_${monthName}_${year}.pdf`);
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
                <option key={i + 1} value={i + 1}>{new Date(0, i).toLocaleString('id-ID', { month: 'long' })}</option>
              ))}
            </select>
            <select
              className="h-10 px-3 border border-gray-300 rounded-lg dark:bg-gray-900 dark:border-gray-800 outline-none"
              value={year}
              onChange={(e) => setYear(parseInt(e.target.value))}
            >
              {[year - 1, year, year + 1].map(y => (
                <option key={y} value={y}>{y}</option>
              ))}
            </select>
            {profile?.role === 'store_manager' ? (
              <div className="flex gap-2">
                <Button variant="outline" size="sm" onClick={exportPDF} disabled={data.length === 0}>
                  Export Summary PDF
                </Button>
                <Button variant="outline" size="sm" onClick={exportSpvPDF} disabled={spvData.length === 0}>
                  Export SPV & SOA PDF
                </Button>
              </div>
            ) : (
              <Button variant="outline" size="sm" onClick={exportPDF} disabled={data.length === 0}>
                Export PDF
              </Button>
            )}
          </div>
        </div>

        {/* Charts Section */}
        {/* Charts Section */}
        {!isLoading && data.length > 0 && (
          <div className="grid grid-cols-1 gap-8">
            {/* Chart 1: YoY Growth Comparison */}
            <div className="rounded-2xl border border-gray-200 bg-white p-6 dark:border-white/[0.05] dark:bg-white/[0.03]">
              <h3 className="text-lg font-bold mb-6 dark:text-white flex items-center justify-between">
                <span>Perbandingan Omset YoY per Departemen</span>
                <span className="text-xs font-normal text-gray-500">Mencakup {data.length} Departemen</span>
              </h3>
              <div className="h-[450px] w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart
                    data={data.map(d => ({
                      name: d.dept_name.replace("DEP ", ""),
                      current: d.actual,
                      previous: d.last_year
                    }))}
                    margin={{ top: 20, right: 30, left: 20, bottom: 60 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                    <XAxis
                      dataKey="name"
                      angle={-45}
                      textAnchor="end"
                      interval={0}
                      tick={{ fontSize: 9, fill: '#64748B' }}
                      height={80}
                    />
                    <YAxis
                      tick={{ fontSize: 10, fill: '#64748B' }}
                      tickFormatter={(val) => `Rp ${(val / 1000000).toFixed(0)}jt`}
                    />
                    <Tooltip
                      formatter={(val: number) => `Rp ${val.toLocaleString('id-ID')}`}
                      contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)', fontSize: '11px' }}
                    />
                    <Legend verticalAlign="top" height={36} />
                    <Bar name={`Tahun ${year - 1}`} dataKey="previous" fill="#CBD5E1" radius={[4, 4, 0, 0]} barSize={12} />
                    <Bar name={`Tahun ${year}`} dataKey="current" fill="#3C50E0" radius={[4, 4, 0, 0]} barSize={12} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* Chart 2: Market Share (Horizontal Bar for better readability) */}
            <div className="rounded-2xl border border-gray-200 bg-white p-6 dark:border-white/[0.05] dark:bg-white/[0.03]">
              <h3 className="text-lg font-bold mb-6 dark:text-white">Kontribusi Omset Toko (%)</h3>
              <div className="h-[500px] w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart
                    layout="vertical"
                    data={data
                      .filter(d => d.actual > 0)
                      .map(d => ({
                        name: d.dept_name.replace("DEP ", ""),
                        value: d.actual,
                        share: (d.actual / totals.actual) * 100
                      }))
                      .sort((a, b) => b.value - a.value)
                    }
                    margin={{ left: 40, right: 60 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#f1f5f9" />
                    <XAxis type="number" hide />
                    <YAxis
                      dataKey="name"
                      type="category"
                      width={140}
                      axisLine={false}
                      tickLine={false}
                      tick={{ fontSize: 10, fill: '#64748B' }}
                    />
                    <Tooltip
                      formatter={(val: any, name: any) => name === 'share' ? [`${val.toFixed(1)}%`, 'Share'] : [`Rp ${val.toLocaleString('id-ID')}`, 'Omset']}
                      contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)', fontSize: '11px' }}
                    />
                    <Bar
                      dataKey="value"
                      fill="#10B981"
                      radius={[0, 4, 4, 0]}
                      barSize={15}
                      label={{
                        position: 'right',
                        formatter: (val: any) => `${((val / totals.actual) * 100).toFixed(1)}%`,
                        fontSize: 10,
                        fill: '#64748B',
                        fontWeight: 'bold'
                      }}
                    />
                  </BarChart>
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

        {/* SPV Table Section for SM */}
        {profile?.role === 'store_manager' && spvData.length > 0 && !isLoading && (
          <div className="mt-8 overflow-hidden rounded-xl border border-gray-200 bg-white dark:border-white/[0.05] dark:bg-white/[0.03]">
            <div className="px-6 py-4 border-b border-gray-200 dark:border-white/[0.05] flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <h3 className="text-lg font-bold text-gray-900 dark:text-white">Rekap Omset per Supervisor & Departemen</h3>
                <p className="text-xs text-gray-500 mt-0.5">Klik baris supervisor untuk melihat/menyembunyikan detail departemen</p>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setExpandedSpv(new Set(spvData.map(s => s.spv_id)))}
                  className="text-xs px-3 py-1.5 rounded-lg bg-brand-50 text-brand-600 dark:bg-brand-500/10 dark:text-brand-400 font-medium hover:bg-brand-100 transition-colors"
                >
                  Buka Semua
                </button>
                <button
                  onClick={() => setExpandedSpv(new Set())}
                  className="text-xs px-3 py-1.5 rounded-lg bg-gray-100 text-gray-600 dark:bg-white/5 dark:text-gray-400 font-medium hover:bg-gray-200 transition-colors"
                >
                  Tutup Semua
                </button>
                <Button variant="outline" size="sm" onClick={exportSpvPDF} disabled={spvData.length === 0}>
                  Export PDF SPV
                </Button>
              </div>
            </div>
            <div className="max-w-full overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-brand-600 text-white">
                    <th rowSpan={2} className="px-5 py-4 text-sm font-bold border-r border-white/20 min-w-[220px]">Supervisor / Departemen</th>
                    <th colSpan={2} className="px-5 py-2 text-sm font-bold text-center border-b border-white/20 border-r border-white/20">Omset</th>
                    <th colSpan={2} className="px-5 py-2 text-sm font-bold text-center border-b border-white/20 border-r border-white/20">Growth</th>
                    <th rowSpan={2} className="px-5 py-4 text-sm font-bold text-center border-r border-white/20">Target {year}</th>
                    <th colSpan={2} className="px-5 py-2 text-sm font-bold text-center border-b border-white/20">Achievement</th>
                  </tr>
                  <tr className="bg-brand-600 text-white">
                    <th className="px-5 py-2 text-xs font-bold text-right border-r border-white/20">{year - 1}</th>
                    <th className="px-5 py-2 text-xs font-bold text-right border-r border-white/20">{year}</th>
                    <th className="px-5 py-2 text-xs font-bold text-right border-r border-white/20">Selisih</th>
                    <th className="px-5 py-2 text-xs font-bold text-center border-r border-white/20">%</th>
                    <th className="px-5 py-2 text-xs font-bold text-right border-r border-white/20">Selisih</th>
                    <th className="px-5 py-2 text-xs font-bold text-center">%</th>
                  </tr>
                </thead>
                <tbody>
                  {spvData.map((spv) => {
                    const isExpanded = expandedSpv.has(spv.spv_id);
                    const growthNom = spv.actual - spv.last_year;
                    const growthPerc = calculatePerc(growthNom, spv.last_year);
                    const achNom = spv.actual - spv.target;
                    const achPerc = calculatePerc(spv.actual, spv.target);

                    return (
                      <>
                        {/* SPV Summary Row (Only displays Name/Chevron, totals are empty) */}
                        <tr
                          key={`spv-${spv.spv_id}`}
                          onClick={() => {
                            setExpandedSpv(prev => {
                              const next = new Set(prev);
                              if (next.has(spv.spv_id)) next.delete(spv.spv_id);
                              else next.add(spv.spv_id);
                              return next;
                            });
                          }}
                          className="cursor-pointer bg-brand-50/70 dark:bg-brand-500/5 border-t-2 border-brand-200 dark:border-brand-500/30 hover:bg-brand-100/70 dark:hover:bg-brand-500/10 transition-colors"
                        >
                          <td className="px-4 py-3 border-r border-gray-200 dark:border-white/5">
                            <div className="flex items-center gap-2">
                              <span className="text-brand-600 dark:text-brand-400 flex-shrink-0">
                                {isExpanded
                                  ? <ChevronDownIcon className="w-4 h-4" />
                                  : <AngleRightIcon className="w-4 h-4" />}
                              </span>
                              <div>
                                <p className="text-sm font-bold text-brand-700 dark:text-brand-300">{spv.spv_name}</p>
                                <p className="text-xs text-brand-500 dark:text-brand-400">{spv.departments.length} departemen</p>
                              </div>
                            </div>
                          </td>
                          <td className="px-5 py-3 border-r border-gray-200 dark:border-white/5"></td>
                          <td className="px-5 py-3 border-r border-gray-200 dark:border-white/5"></td>
                          <td className="px-5 py-3 border-r border-gray-200 dark:border-white/5"></td>
                          <td className="px-5 py-3 border-r border-gray-200 dark:border-white/5"></td>
                          <td className="px-5 py-3 border-r border-gray-200 dark:border-white/5"></td>
                          <td className="px-5 py-3 border-r border-gray-200 dark:border-white/5"></td>
                          <td className="px-5 py-3"></td>
                        </tr>

                        {/* Department Sub-rows */}
                        {isExpanded && spv.departments.map((dept) => {
                          const dGrowthNom = dept.actual - dept.last_year;
                          const dGrowthPerc = calculatePerc(dGrowthNom, dept.last_year);
                          const dAchNom = dept.actual - dept.target;
                          const dAchPerc = calculatePerc(dept.actual, dept.target);

                          return (
                            <tr
                              key={`dept-${dept.dept_id}`}
                              className="bg-white dark:bg-white/[0.01] hover:bg-gray-50 dark:hover:bg-white/[0.03] border-b border-gray-100 dark:border-white/5"
                            >
                              <td className="pl-12 pr-5 py-2.5 border-r border-gray-100 dark:border-white/5">
                                <div className="flex items-center gap-2">
                                  <span className="w-1 h-4 rounded-full bg-brand-300 dark:bg-brand-600 flex-shrink-0"></span>
                                  <span className="text-xs text-gray-700 dark:text-gray-300 font-medium">{dept.dept_name}</span>
                                </div>
                              </td>
                              <td className="px-5 py-2.5 text-xs text-right border-r border-gray-100 dark:border-white/5 text-gray-500">{formatIDR(dept.last_year)}</td>
                              <td className="px-5 py-2.5 text-xs text-right border-r border-gray-100 dark:border-white/5 font-semibold text-gray-800 dark:text-gray-200">{formatIDR(dept.actual)}</td>
                              <td className={`px-5 py-2.5 text-xs text-right border-r border-gray-100 dark:border-white/5 ${dGrowthNom < 0 ? 'text-error-500' : 'text-success-500'}`}>{formatIDR(dGrowthNom)}</td>
                              <td className={`px-5 py-2.5 text-xs text-center border-r border-gray-100 dark:border-white/5 font-semibold ${dGrowthPerc < 0 ? 'text-error-500' : 'text-success-500'}`}>
                                {dGrowthPerc.toFixed(2)}%
                              </td>
                              <td className="px-5 py-2.5 text-xs text-right border-r border-gray-100 dark:border-white/5 text-gray-500">{formatIDR(dept.target)}</td>
                              <td className={`px-5 py-2.5 text-xs text-right border-r border-gray-100 dark:border-white/5 ${dAchNom < 0 ? 'text-error-500' : 'text-success-500'}`}>{formatIDR(dAchNom)}</td>
                              <td className={`px-5 py-2.5 text-xs text-center font-semibold ${dAchPerc >= 100 ? 'text-success-500' : dAchPerc >= 80 ? 'text-amber-500' : 'text-error-500'
                                }`}>
                                {dAchPerc.toFixed(2)}%
                              </td>
                            </tr>
                          );
                        })}

                        {/* SPV Accumulation Row (Placed below the departments) */}
                        {isExpanded && (
                          <tr className="bg-gray-50 dark:bg-white/[0.02] border-b-2 border-brand-200 dark:border-brand-500/30 font-bold">
                            <td className="pl-8 pr-5 py-3 text-sm border-r border-gray-100 dark:border-white/5 text-brand-700 dark:text-brand-300">
                              Akumulasi - {spv.spv_name}
                            </td>
                            <td className="px-5 py-3 text-sm text-right border-r border-gray-100 dark:border-white/5 text-gray-600 dark:text-gray-400">{formatIDR(spv.last_year)}</td>
                            <td className="px-5 py-3 text-sm text-right border-r border-gray-100 dark:border-white/5 text-brand-600 dark:text-brand-400">{formatIDR(spv.actual)}</td>
                            <td className={`px-5 py-3 text-sm text-right border-r border-gray-100 dark:border-white/5 ${growthNom < 0 ? 'text-error-600' : 'text-success-600'}`}>{formatIDR(growthNom)}</td>
                            <td className={`px-5 py-3 text-sm text-center border-r border-gray-100 dark:border-white/5 font-bold ${growthPerc < 0 ? 'text-error-600' : 'text-success-600'}`}>
                              {growthPerc.toFixed(2)}%
                            </td>
                            <td className="px-5 py-3 text-sm text-right border-r border-gray-100 dark:border-white/5 text-gray-600 dark:text-gray-400">{formatIDR(spv.target)}</td>
                            <td className={`px-5 py-3 text-sm text-right border-r border-gray-100 dark:border-white/5 font-bold ${achNom < 0 ? 'text-error-600' : 'text-success-600'}`}>{formatIDR(achNom)}</td>
                            <td className={`px-5 py-3 text-sm text-center font-bold ${achPerc >= 100 ? 'text-success-600' : achPerc >= 80 ? 'text-amber-500' : 'text-error-600'}`}>
                              {achPerc.toFixed(2)}%
                            </td>
                          </tr>
                        )}
                      </>
                    );
                  })}

                  {/* Grand Total Row */}
                  <tr className="bg-brand-600 text-white font-bold">
                    <td className="px-5 py-3.5 text-sm border-r border-white/20 uppercase tracking-wide">Total Keseluruhan</td>
                    <td className="px-5 py-3.5 text-sm text-right border-r border-white/20">{formatIDR(totals.ly)}</td>
                    <td className="px-5 py-3.5 text-sm text-right border-r border-white/20">{formatIDR(totals.actual)}</td>
                    <td className="px-5 py-3.5 text-sm text-right border-r border-white/20">{formatIDR(totals.actual - totals.ly)}</td>
                    <td className={`px-5 py-3.5 text-sm text-center border-r border-white/20 font-bold ${(totals.actual - totals.ly) < 0 ? 'text-red-200' : 'text-green-200'}`}>
                      {calculatePerc(totals.actual - totals.ly, totals.ly).toFixed(2)}%
                    </td>
                    <td className="px-5 py-3.5 text-sm text-right border-r border-white/20">{formatIDR(totals.target)}</td>
                    <td className="px-5 py-3.5 text-sm text-right border-r border-white/20">{formatIDR(totals.actual - totals.target)}</td>
                    <td className={`px-5 py-3.5 text-sm text-center font-black ${calculatePerc(totals.actual, totals.target) >= 100 ? 'text-green-200' : 'text-red-200'}`}>
                      {calculatePerc(totals.actual, totals.target).toFixed(2)}%
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </>
  );
}

