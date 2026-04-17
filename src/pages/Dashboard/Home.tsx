import { useEffect, useState } from "react";
import { supabase } from "../../lib/supabase";
import { useAuthStore } from "../../store/useAuthStore";
import PageMeta from "../../components/common/PageMeta";
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  BarChart, Bar, Cell,
  Legend
} from 'recharts';

interface DashboardStats {
  totalRevenue: number;
  totalWaqaf: number;
  totalMembers: number;
  pendingVerifications: number;
}

interface ChartData {
  date: string;
  amount: number;
}

interface DeptChartData {
  name: string;
  actual: number;
  target: number;
  achievement: number;
  dailyNeeded: number;
  id: string;
}

export default function Home() {
  const { profile } = useAuthStore();
  const [stats, setStats] = useState<DashboardStats>({
    totalRevenue: 0,
    totalWaqaf: 0,
    totalMembers: 0,
    pendingVerifications: 0
  });
  const [trendData, setTrendData] = useState<ChartData[]>([]);
  const [deptData, setDeptData] = useState<DeptChartData[]>([]);
  const [yearlyData, setYearlyData] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const role = profile?.role;

  useEffect(() => {
    if (profile) {
      fetchDashboardData();
    }
  }, [profile]);

  async function fetchDashboardData() {
    setIsLoading(true);
    try {
      const monthStart = `${new Date().getFullYear()}-${(new Date().getMonth() + 1).toString().padStart(2, '0')}-01`;

      let revenueQuery = supabase.from('daily_revenue').select('amount', { count: 'exact' }).eq('status', 'approved');
      let waqafQuery = supabase.from('waqaf_member_entries').select('waqaf_amount, member_count');
      let pendingQuery = supabase.from('daily_revenue').select('id', { count: 'exact' }).eq('status', 'pending');

      // Role based filters
      if (role === 'supervisor') {
        const { data: myDepts } = await supabase.from('departments').select('id').eq('supervisor_id', profile?.id);
        const deptIds = myDepts?.map(d => d.id) || [];
        revenueQuery = revenueQuery.in('department_id', deptIds);
        pendingQuery = pendingQuery.in('department_id', deptIds);
      } else if (role === 'store_associate') {
        revenueQuery = revenueQuery.eq('sa_id', profile?.id);
        waqafQuery = waqafQuery.eq('sa_id', profile?.id);
        pendingQuery = pendingQuery.eq('sa_id', profile?.id);
      }

      const [revRes, waqafRes, pendingRes] = await Promise.all([
        revenueQuery.gte('date', monthStart),
        waqafQuery.gte('date', monthStart),
        pendingQuery
      ]);

      const totalRev = revRes.data?.reduce((acc, curr) => acc + curr.amount, 0) || 0;
      const totalWaqafVal = waqafRes.data?.reduce((acc, curr) => acc + curr.waqaf_amount, 0) || 0;
      const totalMem = waqafRes.data?.reduce((acc, curr) => acc + curr.member_count, 0) || 0;

      setStats({
        totalRevenue: totalRev,
        totalWaqaf: totalWaqafVal,
        totalMembers: totalMem,
        pendingVerifications: pendingRes.count || 0
      });

      // Fetch Trend Data (Last 7 Days)
      const sevenDaysAgo = new Date();
      sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
      let trendQuery = supabase
        .from('daily_revenue')
        .select('date, amount')
        .eq('status', 'approved')
        .gte('date', sevenDaysAgo.toISOString().split('T')[0]);
      
      if (role === 'supervisor') {
        const { data: myDepts } = await supabase.from('departments').select('id').eq('supervisor_id', profile?.id);
        const deptIds = myDepts?.map(d => d.id) || [];
        trendQuery = trendQuery.in('department_id', deptIds);
      } else if (role === 'store_associate') {
        trendQuery = trendQuery.eq('sa_id', profile?.id);
      }

      const { data: trend } = await trendQuery.order('date', { ascending: true });

      // Group by date
      const groupedTrend = (trend || []).reduce((acc: any, curr) => {
        const d = curr.date;
        acc[d] = (acc[d] || 0) + curr.amount;
        return acc;
      }, {});

      const chartFormatted = Object.keys(groupedTrend).map(date => ({
        date: new Date(date).toLocaleDateString('id-ID', { day: '2-digit', month: 'short' }),
        amount: groupedTrend[date]
      }));
      setTrendData(chartFormatted);

      // Fetch Dept Data for All Roles (SM sees all, SPV/SA sees their assigned ones)
      const currentYearVal = new Date().getFullYear();
      const currentMonthVal = new Date().getMonth() + 1;
      const totalDays = new Date(currentYearVal, currentMonthVal, 0).getDate();
      const remainingDays = Math.max(1, totalDays - new Date().getDate() + 1);

      let deptsQuery = supabase.from('departments').select('id, name').eq('is_active', true);
      if (role === 'supervisor') {
        const { data: myDepts } = await supabase.from('departments').select('id').eq('supervisor_id', profile?.id);
        const deptIds = myDepts?.map(d => d.id) || [];
        deptsQuery = deptsQuery.in('id', deptIds);
      } else if (role === 'store_associate') {
        const { data: assignments } = await supabase.from('monthly_assignments').select('department_id').eq('sa_id', profile?.id).eq('month', currentMonthVal).eq('year', currentYearVal);
        const deptIds = assignments?.map(a => a.department_id) || [];
        deptsQuery = deptsQuery.in('id', deptIds);
      }

      const { data: depts } = await deptsQuery;
      if (depts && depts.length > 0) {
        const { data: targets } = await supabase.from('monthly_targets').select('*').eq('year', currentYearVal).eq('month', currentMonthVal);

        const deptChart = await Promise.all(depts.map(async d => {
          let revQ = supabase.from('daily_revenue').select('amount').eq('department_id', d.id).eq('status', 'approved').gte('date', monthStart);
          if (role === 'store_associate') {
            revQ = revQ.eq('sa_id', profile?.id);
          }
          const { data } = await revQ;
          const actual = data?.reduce((acc, curr) => acc + curr.amount, 0) || 0;
          const targetObj = targets?.find(t => t.department_id === d.id);
          const target = targetObj?.target_amount || 0;
          const achievement = target > 0 ? (actual / target) * 100 : 0;
          const dailyNeeded = (target - actual) / remainingDays;

          return {
            id: d.id,
            name: d.name,
            actual,
            target,
            achievement,
            dailyNeeded: dailyNeeded > 0 ? dailyNeeded : 0
          };
        }));
        setDeptData(deptChart.sort((a, b) => b.achievement - a.achievement));
      }

      // Fetch Yearly Comparison (Current Year vs Previous Year)
      const currentYear = new Date().getFullYear();
      const lastYear = currentYear - 1;

      let currentYearQuery = supabase.from('daily_revenue').select('date, amount').eq('status', 'approved').gte('date', `${currentYear}-01-01`).lte('date', `${currentYear}-12-31`);
      let lastYearQuery = supabase.from('daily_revenue').select('date, amount').eq('status', 'approved').gte('date', `${lastYear}-01-01`).lte('date', `${lastYear}-12-31`);

      if (role === 'supervisor') {
        const { data: myDepts } = await supabase.from('departments').select('id').eq('supervisor_id', profile?.id);
        const deptIds = myDepts?.map(d => d.id) || [];
        currentYearQuery = currentYearQuery.in('department_id', deptIds);
        lastYearQuery = lastYearQuery.in('department_id', deptIds);
      } else if (role === 'store_associate') {
        currentYearQuery = currentYearQuery.eq('sa_id', profile?.id);
        lastYearQuery = lastYearQuery.eq('sa_id', profile?.id);
      }

      const [{ data: currentYearRev }, { data: lastYearRev }] = await Promise.all([
        currentYearQuery,
        lastYearQuery
      ]);

      const months = ["Jan", "Feb", "Mar", "Apr", "Mei", "Jun", "Jul", "Ags", "Sep", "Okt", "Nov", "Des"];
      const yearlyFormatted = months.map((m, i) => {
        const monthNum = i + 1;
        const currentSum = currentYearRev?.filter(r => new Date(r.date).getMonth() + 1 === monthNum).reduce((acc, curr) => acc + curr.amount, 0) || 0;
        const lastSum = lastYearRev?.filter(r => new Date(r.date).getMonth() + 1 === monthNum).reduce((acc, curr) => acc + curr.amount, 0) || 0;
        return {
          month: m,
          [currentYear.toString()]: currentSum,
          [lastYear.toString()]: lastSum
        };
      });
      setYearlyData(yearlyFormatted);

    } catch (error) {
      console.error("Dashboard error:", error);
    } finally {
      setIsLoading(false);
    }
  }

  async function generateWAMessage(dept: any) {
    try {
      const today = new Date().toISOString().split('T')[0];
      const monthStart = `${new Date().getFullYear()}-${(new Date().getMonth() + 1).toString().padStart(2, '0')}-01`;
      const currentMonthVal = new Date().getMonth() + 1;
      const currentYearVal = new Date().getFullYear();
      const isSA = profile?.role === 'store_associate';

      let targetDeptIds = dept ? [dept.id] : [];
      let deptLabel = dept ? `*${dept.name}*` : "";

      if (isSA) {
        // Fetch ALL assignments for this SA to aggregate
        const { data: assignments } = await supabase
          .from('monthly_assignments')
          .select('department_id, departments(name)')
          .eq('sa_id', profile?.id)
          .eq('month', currentMonthVal)
          .eq('year', currentYearVal);
        
        if (assignments && assignments.length > 0) {
          targetDeptIds = assignments.map(a => a.department_id);
          // Format vertical list for departments with significant indentation
          if (assignments.length > 1) {
             deptLabel = "\n" + assignments.map(a => `                                *${(a.departments as any)?.name}*`).join("\n");
          } else {
             deptLabel = `*${(assignments[0].departments as any)?.name}*`;
          }
        }
      }
      
      const [dailyRevRes, dailyWMRes, monthlyRevRes, monthlyWMRes, targetRes] = await Promise.all([
        supabase.from('daily_revenue').select('amount').in('department_id', targetDeptIds).eq('sa_id', profile?.id).eq('date', today).eq('status', 'approved'),
        supabase.from('waqaf_member_entries').select('waqaf_amount, member_count').eq('sa_id', profile?.id).eq('date', today).single(),
        supabase.from('daily_revenue').select('amount').in('department_id', targetDeptIds).eq('sa_id', profile?.id).eq('status', 'approved').gte('date', monthStart).lte('date', today),
        supabase.from('waqaf_member_entries').select('waqaf_amount, member_count').eq('sa_id', profile?.id).gte('date', monthStart).lte('date', today),
        supabase.from('monthly_targets').select('target_amount, last_year_amount').in('department_id', targetDeptIds).eq('month', currentMonthVal).eq('year', currentYearVal),
      ]);

      const dailySales = dailyRevRes.data?.reduce((acc, curr) => acc + curr.amount, 0) || 0;
      const dailyMember = dailyWMRes.data?.member_count || 0;
      const dailyWaqaf = dailyWMRes.data?.waqaf_amount || 0;

      const accRev = monthlyRevRes.data?.reduce((acc, curr) => acc + curr.amount, 0) || 0;
      const accMember = monthlyWMRes.data?.reduce((acc, curr) => acc + curr.member_count, 0) || 0;
      const accWaqaf = monthlyWMRes.data?.reduce((acc, curr) => acc + curr.waqaf_amount, 0) || 0;

      const targetAmt = targetRes.data?.reduce((acc, curr) => acc + curr.target_amount, 0) || 0;
      const lyAmt = targetRes.data?.reduce((acc, curr) => acc + curr.last_year_amount, 0) || 0;
      const achPerc = targetAmt > 0 ? (accRev / targetAmt) * 100 : 0;
      const growthAmt = accRev - lyAmt;
      const growthPerc = lyAmt > 0 ? (growthAmt / lyAmt) * 100 : 0;

      const formattedDate = new Date().toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' });
      const currentMonthName = new Date().toLocaleString('id-ID', { month: 'long' });

      const message = `*Report Harian, ${formattedDate}*

*Nama* : *${profile?.full_name}*
*My Value* : ${dailyMember}
*Waqaf* : ${dailyWaqaf > 0 ? 'Rp ' + dailyWaqaf.toLocaleString() : '-'}

*Akumulasi 1 - ${new Date().getDate()} ${currentMonthName} ${new Date().getFullYear()}*
*My Value* : ${accMember}
*Wakaf* : Rp ${accWaqaf.toLocaleString()}

*Departement* : ${deptLabel}

*Sales* : Rp ${dailySales.toLocaleString()}
*Target* : Rp ${targetAmt.toLocaleString()}
*Achiv* : ${achPerc.toFixed(1)}%
*Growth* : ${growthPerc.toFixed(1)}%

*Semoga Hari Esok Bisa Lebih Baik lagi Terimakasih* 🙏`;

      const encodedMessage = encodeURIComponent(message);
      window.open(`https://wa.me/?text=${encodedMessage}`, '_blank');
    } catch (error) {
       console.error("Error generating Dashboard WA message:", error);
       alert("Gagal membuat laporan WA. Pastikan data omset & waqaf hari ini sudah diinput and diverifikasi.");
    }
  }

  return (
    <>
      <PageMeta title="Dashboard | Gramedia Kendari Tracker" description="Visualisasi real-time performa toko dan staff" />

      <div className="flex flex-col gap-8">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Dashboard {(role || "Pengguna").replace("_", " ").toUpperCase()}</h1>
          <p className="text-sm text-gray-500">Ringkasan performa dan target bulan ini.</p>
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4 lg:gap-6">
          <StatCard title="Omset Bulan Ini" value={`Rp ${stats.totalRevenue.toLocaleString()}`} icon="" color="blue" />
          <StatCard title="Total Waqaf" value={`Rp ${stats.totalWaqaf.toLocaleString()}`} icon="" color="green" />
          <StatCard title="MyValue Member" value={`${stats.totalMembers} Member`} icon="" color="purple" />
          <StatCard title="Pending Verif" value={`${stats.pendingVerifications} Tiket`} icon="" color="orange" />
        </div>

        {/* Charts Section */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Trend Chart */}
          <div className="rounded-2xl border border-gray-200 bg-white p-6 dark:border-white/[0.05] dark:bg-white/[0.03]">
            <h3 className="text-lg font-bold mb-6 dark:text-white">Tren Omset (7 Hari Terakhir)</h3>
            <div className="h-[300px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={trendData}>
                  <defs>
                    <linearGradient id="colorRev" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#3C50E0" stopOpacity={0.1} />
                      <stop offset="95%" stopColor="#3C50E0" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E2E8F0" />
                  <XAxis dataKey="date" axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: '#64748B' }} />
                  <YAxis hide />
                  <Tooltip
                    contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)' }}
                    formatter={(val: number) => [`Rp ${val.toLocaleString()}`, 'Omset']}
                  />
                  <Area type="monotone" dataKey="amount" stroke="#3C50E0" strokeWidth={3} fillOpacity={1} fill="url(#colorRev)" />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Dept Chart */}
          <div className="rounded-2xl border border-gray-200 bg-white p-6 dark:border-white/[0.05] dark:bg-white/[0.03]">
            <h3 className="text-lg font-bold mb-6 dark:text-white">Pencapaian Per Departemen (%)</h3>
            <div className="h-[300px] w-full">
              {isLoading ? (
                <div className="flex items-center justify-center h-full text-gray-400">Memuat data...</div>
              ) : deptData.length > 0 ? (
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={deptData} layout="vertical">
                    <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#E2E8F0" />
                    <XAxis type="number" domain={[0, 100]} hide />
                    <YAxis dataKey="name" type="category" width={100} axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: '#64748B' }} />
                    <Tooltip
                      cursor={{ fill: 'transparent' }}
                      contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)' }}
                      formatter={(val: number) => [`${val.toFixed(2)}%`, 'Achievement']}
                    />
                    <Bar dataKey="achievement" radius={[0, 4, 4, 0]}>
                      {deptData.map((d, index) => (
                        <Cell key={`cell-${index}`} fill={d.achievement >= 100 ? '#10B981' : d.achievement >= 70 ? '#3C50E0' : '#FF4D4D'} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <div className="flex flex-col items-center justify-center h-full text-gray-400">
                  <span className="text-4xl mb-2 text-gray-200">📈</span>
                  <p className="text-sm">Data grafik akan muncul setelah ada target & omset.</p>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Reporting Section for SA/SPV */}
        {(role === 'store_associate' || role === 'supervisor') && deptData.length > 0 && (
          <div className="rounded-2xl border border-gray-200 bg-white p-6 dark:border-white/[0.05] dark:bg-white/[0.03]">
             <div className="flex items-center justify-between mb-6">
                <div>
                   <h3 className="text-lg font-bold dark:text-white">Lapor WhatsApp Hari Ini</h3>
                   <p className="text-xs text-gray-500 italic">
                     {role === 'store_associate' ? 'Kirim laporan harian gabungan seluruh departemen tugas Anda.' : 'Pilih departemen untuk mengirim laporan harian ke grup.'}
                   </p>
                </div>
                <div className="flex -space-x-2">
                   {[1,2,3].map(i => (
                     <div key={i} className="w-8 h-8 rounded-full border-2 border-white bg-brand-500 flex items-center justify-center text-[10px] text-white font-bold">WA</div>
                   ))}
                </div>
             </div>

             {role === 'store_associate' ? (
                <div className="max-w-md">
                   <button 
                     onClick={() => generateWAMessage(null)}
                     className="w-full flex items-center justify-center gap-3 p-5 rounded-xl border border-success-200 bg-success-50/30 dark:bg-success-500/5 text-success-700 dark:text-success-400 font-bold hover:bg-success-500 hover:text-white transition-all group shadow-sm shadow-success-100 dark:shadow-none"
                   >
                     <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.438 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/></svg>
                     <span>Kirim Laporan Harian (WA)</span>
                   </button>
                </div>
             ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                  {deptData.map((d) => (
                    <button 
                      key={d.name} 
                      onClick={() => generateWAMessage(d)}
                      className="flex items-center justify-between p-4 rounded-xl border border-gray-100 dark:border-white/5 hover:border-success-500 hover:bg-success-50/10 transition-all group"
                    >
                      <div className="flex flex-col items-start translate-x-0 group-hover:translate-x-1 transition-transform">
                         <span className="text-xs text-gray-400 font-medium uppercase tracking-wider">{d.name}</span>
                         <span className="text-sm font-bold text-gray-900 dark:text-white">Achievement: {d.achievement.toFixed(1)}%</span>
                      </div>
                      <div className="w-10 h-10 rounded-lg bg-success-50 text-success-600 flex items-center justify-center group-hover:bg-success-500 group-hover:text-white transition-colors">
                         <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.438 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/></svg>
                      </div>
                    </button>
                  ))}
                </div>
             )}
          </div>
        )}

        {/* Store Manager Insight Center */}
        {role === 'store_manager' && deptData.length > 0 && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Leaderboard */}
            <div className="rounded-2xl border border-gray-200 bg-white p-6 dark:border-white/[0.05] dark:bg-white/[0.03]">
              <h3 className="text-md font-bold mb-4 flex items-center gap-2">
                <span className="text-yellow-500">🏆</span> Top 3 Departments
              </h3>
              <div className="space-y-4">
                {deptData.slice(0, 3).map((d, i) => (
                  <div key={d.name} className="flex items-center justify-between p-3 rounded-xl bg-gray-50 dark:bg-white/5">
                    <div className="flex items-center gap-3">
                      <span className="w-6 h-6 flex items-center justify-center rounded-full bg-brand-500 text-white text-[10px] font-bold">{i + 1}</span>
                      <span className="text-sm font-medium">{d.name}</span>
                    </div>
                    <span className="text-sm font-bold text-success-600">{d.achievement.toFixed(1)}%</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Alerts */}
            <div className="rounded-2xl border border-gray-200 bg-white p-6 dark:border-white/[0.05] dark:bg-white/[0.03]">
              <h3 className="text-md font-bold mb-4 flex items-center gap-2">
                <span className="text-red-500">⚠️</span> Underachievers ({"<"}70%)
              </h3>
              <div className="space-y-4">
                {deptData.filter(d => d.achievement < 70 && d.target > 0).length === 0 ? (
                  <p className="text-sm text-gray-400 italic py-4 text-center">Seluruh departemen dalam kondisi aman.</p>
                ) : (
                  deptData.filter(d => d.achievement < 70 && d.target > 0).slice(0, 3).map((d) => (
                    <div key={d.name} className="flex items-center justify-between p-3 rounded-xl bg-error-50 dark:bg-error-500/5">
                      <span className="text-sm font-medium">{d.name}</span>
                      <span className="text-sm font-bold text-error-600">{d.achievement.toFixed(1)}%</span>
                    </div>
                  ))
                )}
              </div>
            </div>

            {/* Daily Action */}
            <div className="rounded-2xl border border-gray-200 bg-white p-6 dark:border-white/[0.05] dark:bg-white/[0.03]">
              <h3 className="text-md font-bold mb-4 flex items-center gap-2">
                <span className="text-blue-500">📍</span> Target Harian Dibutuhkan
              </h3>
              <div className="space-y-4">
                {deptData.filter(d => d.dailyNeeded > 0).slice(0, 3).map((d) => (
                  <div key={d.name} className="flex flex-col gap-1 p-3 rounded-xl bg-blue-50 dark:bg-blue-500/5">
                    <span className="text-xs text-gray-500">{d.name}</span>
                    <span className="text-sm font-bold text-blue-600">Rp {Math.round(d.dailyNeeded).toLocaleString()} <span className="text-[10px] text-gray-400 italic">/ hari</span></span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Yearly Trend Section */}
        <div className="rounded-2xl border border-gray-200 bg-white p-6 dark:border-white/[0.05] dark:bg-white/[0.03]">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h3 className="text-lg font-bold dark:text-white">Trend Omset Tahunan</h3>
              <p className="text-xs text-gray-500 italic">Perbandingan Performa {new Date().getFullYear()} vs {new Date().getFullYear() - 1}</p>
            </div>
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-1.5"><span className="w-3 h-3 rounded-full bg-brand-500"></span><span className="text-[10px] font-bold text-gray-500 uppercase">{new Date().getFullYear()}</span></div>
              <div className="flex items-center gap-1.5"><span className="w-3 h-3 rounded-full bg-gray-300"></span><span className="text-[10px] font-bold text-gray-500 uppercase">{new Date().getFullYear() - 1}</span></div>
            </div>
          </div>

          <div className="h-[350px] w-full mt-4">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={yearlyData} margin={{ top: 10, right: 10, left: 10, bottom: 10 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E2E8F0" />
                <XAxis dataKey="month" axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: '#64748B' }} />
                <YAxis hide />
                <Tooltip
                  cursor={{ fill: 'transparent' }}
                  contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)' }}
                  formatter={(val: number) => [`Rp ${val.toLocaleString()}`, 'Omset']}
                />
                <Legend iconType="circle" />
                <Bar dataKey={new Date().getFullYear().toString()} fill="#3C50E0" radius={[4, 4, 0, 0]} />
                <Bar dataKey={(new Date().getFullYear() - 1).toString()} fill="#E2E8F0" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>
    </>
  );
}


function StatCard({ title, value, icon, color }: { title: string; value: string; icon: string; color: string }) {
  const bgColors: any = {
    blue: "bg-blue-50 text-blue-600 dark:bg-blue-500/10",
    green: "bg-green-50 text-green-600 dark:bg-green-500/10",
    purple: "bg-purple-50 text-purple-600 dark:bg-purple-500/10",
    orange: "bg-orange-50 text-orange-600 dark:bg-orange-500/10",
  };

  return (
    <div className="rounded-2xl border border-gray-200 bg-white p-6 transition-all hover:shadow-lg dark:border-white/[0.05] dark:bg-white/[0.03]">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm font-medium text-gray-500 dark:text-gray-400">{title}</p>
          <h4 className="mt-2 text-xl font-bold text-gray-900 dark:text-white">{value}</h4>
        </div>
        <div className={`flex h-12 w-12 items-center justify-center rounded-xl text-2xl ${bgColors[color]}`}>
          {icon}
        </div>
      </div>
    </div>
  );
}
