import { useEffect, useState } from "react";
import { supabase } from "../../lib/supabase";
import { useAuthStore } from "../../store/useAuthStore";
import PageMeta from "../../components/common/PageMeta";
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  BarChart, Bar
} from 'recharts';
import { ShootingStarIcon, AlertIcon, PieChartIcon } from "../../icons";


interface DashboardStats {
  deptRevenue: number;
  counterRevenue: number;
  totalWaqaf: number;
  totalMembers: number;
  pendingVerifications: number;
}

interface ChartData {
  date: string;
  amount: number;
}

interface DeptPerf {
  id: string;
  name: string;
  actual: number;
  target: number;
  achievement: number;
  dailyNeeded: number;
}

export default function Home() {
  const { profile } = useAuthStore();
  const [stats, setStats] = useState<DashboardStats>({
    deptRevenue: 0, counterRevenue: 0,
    totalWaqaf: 0, totalMembers: 0, pendingVerifications: 0
  });
  const [trendData, setTrendData] = useState<ChartData[]>([]);
  const [deptData, setDeptData] = useState<DeptPerf[]>([]);
  const [hasCounter, setHasCounter] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  const role = profile?.role;

  useEffect(() => {
    if (profile) fetchDashboardData();
  }, [profile]);

  async function fetchDashboardData() {
    setIsLoading(true);
    try {
      const now = new Date();
      const monthStart = `${now.getFullYear()}-${(now.getMonth() + 1).toString().padStart(2, '0')}-01`;
      const totalDaysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
      const daysPassed = now.getDate();
      const daysLeft = totalDaysInMonth - daysPassed;

      let dRev = 0, cRevVal = 0, tWaq = 0, tMem = 0, pending = 0;

      if (role === 'counter') {
        const { data } = await supabase.from('counter_weekly_revenue')
          .select('amount').eq('counter_id', profile?.counter_id)
          .eq('status', 'approved').gte('week_start', monthStart);
        cRevVal = data?.reduce((a, c) => a + Number(c.amount), 0) || 0;
        const { count } = await supabase.from('counter_weekly_revenue')
          .select('*', { count: 'exact', head: true })
          .eq('counter_id', profile?.counter_id).eq('status', 'pending');
        pending = count || 0;

      } else {
        let revQ = supabase.from('daily_revenue').select('amount').eq('status', 'approved').gte('date', monthStart);
        let waqQ = supabase.from('waqaf_member_entries').select('waqaf_amount, member_count').gte('date', monthStart);
        let pendQ = supabase.from('daily_revenue').select('id', { count: 'exact', head: true }).eq('status', 'pending');

        if (role === 'supervisor') {
          const [directDepts, assignedDepts] = await Promise.all([
            supabase.from('departments').select('id').eq('supervisor_id', profile?.id),
            supabase.from('monthly_assignments').select('department_id')
              .eq('supervisor_id', profile?.id).eq('month', now.getMonth() + 1).eq('year', now.getFullYear())
          ]);
          
          const deptIds = Array.from(new Set([
            ...(directDepts.data?.map(d => d.id) || []),
            ...(assignedDepts.data?.map(a => a.department_id) || [])
          ])).filter(Boolean);

          if (deptIds.length > 0) {
              revQ = revQ.in('department_id', deptIds);
              pendQ = pendQ.in('department_id', deptIds);

              const { data: saAssignments } = await supabase.from('monthly_assignments')
                  .select('sa_id')
                  .in('department_id', deptIds)
                  .eq('month', now.getMonth() + 1)
                  .eq('year', now.getFullYear());
              
              const saIds = saAssignments?.map(a => a.sa_id).filter(Boolean) || [];
              if (saIds.length > 0) {
                  waqQ = waqQ.in('sa_id', saIds);
              } else {
                  waqQ = waqQ.eq('id', 'dummy'); 
              }
          } else {
              revQ = revQ.eq('id', 'dummy');
              pendQ = pendQ.eq('id', 'dummy');
              waqQ = waqQ.eq('id', 'dummy');
          }
        } else if (role === 'store_associate') {
          revQ = revQ.eq('sa_id', profile?.id);
          waqQ = waqQ.eq('sa_id', profile?.id);
          pendQ = pendQ.eq('sa_id', profile?.id);
        }

        const [rRes, wRes, pRes] = await Promise.all([revQ, waqQ, pendQ]);
        dRev = rRes.data?.reduce((a, c) => a + Number(c.amount), 0) || 0;
        tWaq = wRes.data?.reduce((a, c) => a + Number(c.waqaf_amount), 0) || 0;
        tMem = wRes.data?.reduce((a, c) => a + c.member_count, 0) || 0;
        pending = pRes.count || 0;

        // Counter revenue: SM gets all, SPV only if they have counters
        if (role === 'store_manager') {
          const { data: crData } = await supabase.from('counter_weekly_revenue')
            .select('amount').eq('status', 'approved').gte('week_start', monthStart);
          cRevVal = crData?.reduce((a, c) => a + Number(c.amount), 0) || 0;
          setHasCounter(true);
        } else if (role === 'supervisor') {
          // Ambil dari dua sumber: Plotting Bulanan DAN Relasi Permanen
          const [assignmentsRes, directCountersRes] = await Promise.all([
            supabase.from('monthly_assignments').select('counter_id')
              .eq('supervisor_id', profile?.id)
              .eq('month', now.getMonth() + 1)
              .eq('year', now.getFullYear())
              .not('counter_id', 'is', null),
            supabase.from('counters').select('id').eq('supervisor_id', profile?.id)
          ]);

          const allCounterIds = Array.from(new Set([
            ...(assignmentsRes.data?.map(a => a.counter_id) || []),
            ...(directCountersRes.data?.map(c => c.id) || [])
          ])).filter(Boolean);

          if (allCounterIds.length > 0) {
            setHasCounter(true);
            const { data: crData } = await supabase.from('counter_weekly_revenue')
              .select('amount').eq('status', 'approved').gte('week_start', monthStart)
              .in('counter_id', allCounterIds);
            cRevVal = crData?.reduce((a, c) => a + Number(c.amount), 0) || 0;
          } else {
            setHasCounter(false);
          }
        }
      }

      setStats({ deptRevenue: dRev, counterRevenue: cRevVal, totalWaqaf: tWaq, totalMembers: tMem, pendingVerifications: pending });

      // Trend Data
      const sevenDaysAgo = new Date(); sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
      if (role === 'counter') {
        const { data } = await supabase.from('counter_weekly_revenue')
          .select('week_start, amount').eq('counter_id', profile?.counter_id)
          .eq('status', 'approved').order('week_start', { ascending: true });
        setTrendData(data?.map(t => ({ date: new Date(t.week_start).toLocaleDateString('id-ID', { day: '2-digit', month: 'short' }), amount: Number(t.amount) })) || []);
      } else {
        let tQ = supabase.from('daily_revenue').select('date, amount').eq('status', 'approved')
          .gte('date', sevenDaysAgo.toISOString().split('T')[0]);
        if (role === 'supervisor') {
          const { data: d } = await supabase.from('departments').select('id').eq('supervisor_id', profile?.id);
          tQ = tQ.in('department_id', d?.map(x => x.id) || []);
        } else if (role === 'store_associate') {
          tQ = tQ.eq('sa_id', profile?.id);
        }
        const { data: trend } = await tQ;
        const grouped = (trend || []).reduce((acc: any, curr) => { acc[curr.date] = (acc[curr.date] || 0) + Number(curr.amount); return acc; }, {});
        setTrendData(Object.keys(grouped).sort().map(d => ({ date: new Date(d).toLocaleDateString('id-ID', { day: '2-digit', month: 'short' }), amount: grouped[d] })));
      }

      // Department Performance (SM / SPV)
      if (role === 'store_manager' || role === 'supervisor') {
        let depts: { id: string, name: string }[] = [];
        
        if (role === 'store_manager') {
          const { data } = await supabase.from('departments').select('id, name').eq('is_active', true);
          depts = data || [];
        } else {
          // For SPV, filter by monthly assignments
          const { data: assigned } = await supabase.from('monthly_assignments')
            .select('department_id, departments(id, name)')
            .eq('supervisor_id', profile?.id)
            .eq('month', now.getMonth() + 1)
            .eq('year', now.getFullYear());
          
          depts = (assigned || [])
            .filter(a => a.departments)
            .map(a => ({ id: a.department_id as string, name: (a.departments as any).name }));
        }

        const { data: targets } = await supabase.from('monthly_targets').select('department_id, target_amount')
          .eq('year', now.getFullYear()).eq('month', now.getMonth() + 1);

        const deptChart: DeptPerf[] = await Promise.all((depts || []).map(async d => {
          const { data } = await supabase.from('daily_revenue').select('amount')
            .eq('department_id', d.id).eq('status', 'approved').gte('date', monthStart);
          const actual = data?.reduce((a, c) => a + Number(c.amount), 0) || 0;
          const target = Number(targets?.find(t => t.department_id === d.id)?.target_amount || 0);
          const achievement = target > 0 ? (actual / target) * 100 : 0;
          const remaining = Math.max(0, target - actual);
          const dailyNeeded = daysLeft > 0 ? remaining / daysLeft : 0;
          return { id: d.id, name: d.name.replace('DEP ', ''), actual, target, achievement, dailyNeeded };
        }));
        setDeptData(deptChart.sort((a, b) => b.achievement - a.achievement));
      }

      // SA: no extra fetch needed (WA button uses today's date directly)
    } catch (error) {
      console.error(error);
    } finally {
      setIsLoading(false);
    }
  }

  async function generateWAReport(targetDate?: string) {
    const date = targetDate || new Date().toISOString().split('T')[0];
    try {
      const d = new Date(date);
      const month = d.getMonth() + 1;
      const year = d.getFullYear();
      const startOfMonth = `${year}-${month.toString().padStart(2, '0')}-01`;

      // Ambil departemen dari monthly_assignments (via sa_id langsung)
      const { data: assignBySA } = await supabase
        .from('monthly_assignments')
        .select('department_id, departments(id, name)')
        .eq('sa_id', profile?.id)
        .eq('month', month).eq('year', year);

      // Fallback: cari SPV dari users, lalu ambil dept yang dia kelola
      let deptList: { id: string; name: string }[] = [];

      if (assignBySA && assignBySA.length > 0) {
        deptList = assignBySA
          .filter((a: any) => a.departments)
          .map((a: any) => ({ id: a.department_id, name: a.departments.name }));
      }

      // Jika masih kosong, tidak ada dept yang bisa ditampilkan
      if (deptList.length === 0) {
        alert('Tidak ada departemen yang ditemukan untuk akun Anda bulan ini.');
        return;
      }

      const deptIds = deptList.map(x => x.id).filter(Boolean);

      const [accRevRes, wmRes, targetRes, todayWMRes] = await Promise.all([
        supabase.from('daily_revenue').select('amount, department_id')
          .in('department_id', deptIds).in('status', ['approved', 'pending'])
          .gte('date', startOfMonth).lte('date', date),
        supabase.from('waqaf_member_entries').select('waqaf_amount, member_count')
          .eq('sa_id', profile?.id).gte('date', startOfMonth).lte('date', date),
        supabase.from('monthly_targets').select('target_amount, last_year_amount, department_id')
          .in('department_id', deptIds).eq('month', month).eq('year', year),
        supabase.from('waqaf_member_entries').select('*').eq('sa_id', profile?.id).eq('date', date).maybeSingle(),
      ]);

      const accRev = accRevRes.data?.reduce((a, c) => a + Number(c.amount), 0) || 0;
      const accMember = wmRes.data?.reduce((a, c) => a + c.member_count, 0) || 0;
      const accWaqaf = wmRes.data?.reduce((a, c) => a + Number(c.waqaf_amount), 0) || 0;
      const target = targetRes.data?.reduce((a, c) => a + Number(c.target_amount), 0) || 0;
      const ly = targetRes.data?.reduce((a, c) => a + Number(c.last_year_amount), 0) || 0;
      const achiv = target > 0 ? (accRev / target) * 100 : 0;
      const growth = ly > 0 ? ((accRev - ly) / ly) * 100 : 0;
      const todayWM = todayWMRes.data;
      const formattedDate = d.toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' });
      const monthName = d.toLocaleString('id-ID', { month: 'long' });

      // Buat rincian per departemen jika lebih dari 1
      let deptDetail = '';
      if (deptList.length > 1) {
        const deptLines = deptList.map(dept => {
          const deptRev = accRevRes.data
            ?.filter(r => r.department_id === dept.id)
            .reduce((a, c) => a + Number(c.amount), 0) || 0;
          const deptTarget = targetRes.data?.find(t => t.department_id === dept.id);
          const deptTargetAmt = Number(deptTarget?.target_amount || 0);
          const deptAch = deptTargetAmt > 0 ? ((deptRev / deptTargetAmt) * 100).toFixed(1) : '0.0';
          return `  • *${dept.name}*: Rp ${deptRev.toLocaleString('id-ID')} (${deptAch}%)`;
        }).join('\n');
        deptDetail = `\n*Rincian per Departemen:*\n${deptLines}\n\n*Total Gabungan*`;
      } else {
        deptDetail = `\n*Departement* : *${deptList[0]?.name || '-'}*`;
      }

      const msg = `*Report Harian, ${formattedDate}*

*Nama* : *${profile?.full_name}*
*My Value* : ${todayWM?.member_count || 0}
*Waqaf* : ${todayWM?.waqaf_amount ? Number(todayWM.waqaf_amount).toLocaleString('id-ID') : '-'}

*Akumulasi 1 - ${d.getDate()} ${monthName} ${year}*
*My Value* : ${accMember}
*Wakaf* : Rp ${accWaqaf.toLocaleString('id-ID')}
${deptDetail}

*Sales* : Rp ${accRev.toLocaleString('id-ID')}
*Target* : Rp ${target.toLocaleString('id-ID')}
*Achiv* : ${achiv.toFixed(1)}%
*Growth* : ${growth.toFixed(1)}%

*Semoga Hari Esok Bisa Lebih Baik lagi Terimakasih* 🙏`;

      window.open(`https://wa.me/?text=${encodeURIComponent(msg)}`, '_blank');
    } catch (e) {
      console.error(e);
      alert('Gagal membuat laporan WA.');
    }
  }

  if (isLoading) return (
    <div className="flex items-center justify-center h-64">
      <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-brand-500"></div>
    </div>
  );

  // Pareto & rankings
  const sortedByActual = [...deptData].sort((a, b) => b.actual - a.actual);
  const totalRevenue = deptData.reduce((s, d) => s + d.actual, 0);
  let cumulative = 0;
  const paretoDepts: DeptPerf[] = [];
  for (const d of sortedByActual) {
    cumulative += d.actual;
    paretoDepts.push(d);
    if (cumulative / totalRevenue >= 0.8) break;
  }
  const underDepts = deptData.filter(d => d.target > 0 && d.achievement < 80);
  const top3Depts = sortedByActual.slice(0, 3);

  return (
    <>
      <PageMeta title="Dashboard | Gramedia Tracker" description="Ringkasan performa dan capaian toko." />
      <div className="flex flex-col gap-8">

        {/* Header */}
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
          Selamat datang, {profile?.full_name?.split(' ')[0]}
          </h1>
          <p className="text-sm text-gray-500 mt-1">
            {new Date().toLocaleDateString('id-ID', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
          </p>
        </div>

        {/* === COUNTER ROLE === */}
        {role === 'counter' && (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <StatCard title="Omset Brand (Bulan Ini)" value={`Rp ${stats.counterRevenue.toLocaleString('id-ID')}`} color="blue" />
            <StatCard title="Target Bulanan" value="Rp —" color="green" />
            <StatCard title="Laporan Pending" value={`${stats.pendingVerifications} Data`} color="orange" />
          </div>
        )}

        {/* === SA ROLE === */}
        {role === 'store_associate' && (
          <>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <StatCard title="Omset Bulan Ini" value={`Rp ${stats.deptRevenue.toLocaleString('id-ID')}`} color="blue" />
              <StatCard title="Total Waqaf" value={`Rp ${stats.totalWaqaf.toLocaleString('id-ID')}`} color="purple" />
              <StatCard title="Total MyValue" value={`${stats.totalMembers} Member`} color="green" />
              <StatCard title="Pending Verif" value={`${stats.pendingVerifications} Data`} color="orange" />
            </div>

            {/* WA Report — Single Button */}
            <div className="rounded-2xl border border-green-200 bg-green-50 dark:border-green-500/20 dark:bg-green-500/5 p-5 flex items-center justify-between gap-4">
              <div>
                <h3 className="text-sm font-bold text-green-800 dark:text-green-300 flex items-center gap-2">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" className="text-green-600"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.438 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/></svg>
                  Kirim Report WA Hari Ini
                </h3>
                <p className="text-xs text-green-700 dark:text-green-400 mt-0.5">
                  Akumulasi omset, waqaf & member 1 – {new Date().getDate()} {new Date().toLocaleString('id-ID', { month: 'long', year: 'numeric' })}
                </p>
              </div>
              <button
                onClick={() => generateWAReport()}
                className="flex items-center gap-2 px-4 py-2 bg-green-500 hover:bg-green-600 text-white text-sm font-bold rounded-xl transition-colors whitespace-nowrap"
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="white"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.438 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/></svg>
                Kirim WA
              </button>
            </div>
          </>
        )}

        {/* === SM / SPV ROLE === */}
        {(role === 'store_manager' || role === 'supervisor') && (
          <>
            <div className={`grid grid-cols-1 gap-4 sm:grid-cols-2 ${hasCounter ? 'lg:grid-cols-4' : 'lg:grid-cols-3'}`}>
              <StatCard title="Omset Departemen" value={`Rp ${stats.deptRevenue.toLocaleString('id-ID')}`} color="blue" />
              {hasCounter && (
                <StatCard title="Omset Counter" value={`Rp ${stats.counterRevenue.toLocaleString('id-ID')}`} color="green" />
              )}
              <StatCard title="Total Waqaf" value={`Rp ${stats.totalWaqaf.toLocaleString('id-ID')}`} color="purple" />
              <StatCard title="Pending Verif" value={`${stats.pendingVerifications} Data`} color="orange" />
            </div>

            {/* Top 3 + Pareto + Underachieve */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {/* Top 3 Departments */}
              <div className="rounded-2xl border border-gray-200 bg-white p-6 dark:border-white/[0.05] dark:bg-white/[0.03]">
                <h3 className="text-base font-bold mb-4 dark:text-white flex items-center gap-2">
                  <span className="w-6 h-6 rounded-lg bg-yellow-100 text-yellow-600 flex items-center justify-center">
                    <ShootingStarIcon className="size-3.5" />
                  </span>
                  Top 3 Departemen
                </h3>
                <div className="space-y-3">
                  {top3Depts.length === 0 ? (
                    <p className="text-xs text-gray-400 italic">Belum ada data omset.</p>
                  ) : top3Depts.map((d, i) => (
                    <div key={d.id} className="flex items-center gap-3">
                      <span className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0 ${i === 0 ? 'bg-yellow-400 text-white' : i === 1 ? 'bg-gray-300 text-gray-700' : 'bg-orange-300 text-white'}`}>{i + 1}</span>
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-semibold text-gray-800 dark:text-white truncate">{d.name}</p>
                        <p className="text-xs text-gray-500">Rp {d.actual.toLocaleString('id-ID')}</p>
                      </div>
                      <span className={`text-xs font-bold ${d.achievement >= 100 ? 'text-success-500' : d.achievement >= 70 ? 'text-warning-500' : 'text-error-500'}`}>
                        {d.achievement.toFixed(0)}%
                      </span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Pareto 80/20 */}
              <div className="rounded-2xl border border-gray-200 bg-white p-6 dark:border-white/[0.05] dark:bg-white/[0.03]">
                <h3 className="text-base font-bold mb-4 dark:text-white flex items-center gap-2">
                  <span className="w-6 h-6 rounded-lg bg-brand-100 text-brand-600 flex items-center justify-center">
                    <PieChartIcon className="size-3.5" />
                  </span>
                  Pareto 80/20
                </h3>
                <p className="text-xs text-gray-500 mb-3">{paretoDepts.length} dept menyumbang 80% omset</p>
                <div className="space-y-2">
                  {paretoDepts.length === 0 ? (
                    <p className="text-xs text-gray-400 italic">Belum ada data.</p>
                  ) : paretoDepts.map(d => (
                    <div key={d.id} className="flex justify-between items-center">
                      <span className="text-xs text-gray-700 dark:text-gray-300 truncate flex-1 mr-2">{d.name}</span>
                      <span className="text-xs font-bold text-brand-600">Rp {(d.actual / 1_000_000).toFixed(1)}jt</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Underachieve */}
              <div className="rounded-2xl border border-gray-200 bg-white p-6 dark:border-white/[0.05] dark:bg-white/[0.03]">
                <h3 className="text-base font-bold mb-4 dark:text-white flex items-center gap-2">
                  <span className="w-6 h-6 rounded-lg bg-red-100 text-red-600 flex items-center justify-center">
                    <AlertIcon className="size-3.5" />
                  </span>
                  Perlu Perhatian
                </h3>
                <div className="space-y-3">
                  {underDepts.length === 0 ? (
                    <p className="text-xs text-success-500 font-medium">Semua departemen on track!</p>
                  ) : underDepts.map(d => (
                    <div key={d.id}>
                      <div className="flex justify-between items-center mb-1">
                        <span className="text-xs font-medium text-gray-700 dark:text-gray-300 truncate">{d.name}</span>
                        <span className="text-xs text-error-500 font-bold">{d.achievement.toFixed(0)}%</span>
                      </div>
                      <div className="h-1.5 bg-gray-100 rounded-full">
                        <div className="h-1.5 bg-error-500 rounded-full" style={{ width: `${Math.min(d.achievement, 100)}%` }}></div>
                      </div>
                      {d.dailyNeeded > 0 && (
                        <p className="text-[10px] text-gray-400 mt-1">Target harian: Rp {d.dailyNeeded.toLocaleString('id-ID', { maximumFractionDigits: 0 })}</p>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </>
        )}

        {/* Trend Chart */}
        <div className="rounded-2xl border border-gray-200 bg-white p-6 dark:border-white/[0.05] dark:bg-white/[0.03]">
          <h3 className="text-lg font-bold mb-6 dark:text-white">
            Tren Omset {role === 'counter' ? '(Mingguan)' : '(7 Hari Terakhir)'}
          </h3>
          <div className="h-[260px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={trendData}>
                <defs>
                  <linearGradient id="colorRev" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#3C50E0" stopOpacity={0.15} />
                    <stop offset="95%" stopColor="#3C50E0" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E2E8F0" />
                <XAxis dataKey="date" axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: '#64748B' }} />
                <YAxis hide />
                <Tooltip formatter={(v: any) => [`Rp ${Number(v).toLocaleString('id-ID')}`, 'Omset']} />
                <Area type="monotone" dataKey="amount" stroke="#3C50E0" strokeWidth={2.5} fillOpacity={1} fill="url(#colorRev)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Department Achievement Chart (SM/SPV) */}
        {(role === 'store_manager' || role === 'supervisor') && deptData.length > 0 && (
          <div className="rounded-2xl border border-gray-200 bg-white p-6 dark:border-white/[0.05] dark:bg-white/[0.03]">
            <h3 className="text-lg font-bold mb-6 dark:text-white">Pencapaian Seluruh Departemen</h3>
            <div className="h-[350px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={deptData} layout="vertical" margin={{ left: 10, right: 40 }}>
                  <XAxis type="number" hide />
                  <YAxis dataKey="name" type="category" width={120} axisLine={false} tickLine={false} tick={{ fontSize: 10 }} />
                  <Tooltip formatter={(v: any) => [`${Number(v).toFixed(1)}%`, 'Capaian']} />
                  <Bar dataKey="achievement" fill="#3C50E0" radius={[0, 4, 4, 0]} label={{ position: 'right', formatter: (v: any) => `${Number(v).toFixed(0)}%`, fontSize: 10 }} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        )}
      </div>
    </>
  );
}

function StatCard({ title, value, color }: { title: string; value: string; color: string }) {
  const configs: any = {
    blue: "bg-blue-50 dark:bg-blue-500/10 border-blue-100 dark:border-blue-500/20",
    green: "bg-green-50 dark:bg-green-500/10 border-green-100 dark:border-green-500/20",
    purple: "bg-purple-50 dark:bg-purple-500/10 border-purple-100 dark:border-purple-500/20",
    orange: "bg-orange-50 dark:bg-orange-500/10 border-orange-100 dark:border-orange-500/20",
  };
  return (
    <div className={`rounded-2xl border p-5 ${configs[color]}`}>
      <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">{title}</p>
      <h4 className="text-xl font-bold text-gray-900 dark:text-white">{value}</h4>
    </div>
  );
}
