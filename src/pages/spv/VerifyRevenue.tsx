import { useEffect, useState } from "react";
import { supabase } from "../../lib/supabase";
import { useAuthStore } from "../../store/useAuthStore";
import PageMeta from "../../components/common/PageMeta";
import { Table, TableBody, TableCell, TableHeader, TableRow } from "../../components/ui/table";
import Button from "../../components/ui/button/Button";

export default function VerifyRevenue() {
  const { profile } = useAuthStore();
  const [activeTab, setActiveTab] = useState<"SA" | "Counter">("SA");
  const [data, setData] = useState<any[]>([]);
  const [counterData, setCounterData] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (activeTab === "SA") {
      fetchPendingRevenue();
    } else {
      fetchPendingCounterRevenue();
    }
  }, [activeTab]);

  async function fetchPendingRevenue() {
    setIsLoading(true);
    try {
      if (!profile) return;
      const currentM = new Date().getMonth() + 1;
      const currentY = new Date().getFullYear();

      const { data: assignments } = await supabase
        .from("monthly_assignments")
        .select("department_id")
        .eq("supervisor_id", profile.id)
        .eq("month", currentM)
        .eq("year", currentY);

      const ids = assignments?.map(d => d.department_id) || [];
      if (ids.length === 0) {
        setData([]);
        return;
      }

      const { data: revenueData, error } = await supabase
        .from("daily_revenue")
        .select("*, users!daily_revenue_sa_id_fkey(full_name), departments(name)")
        .eq("status", "pending")
        .in("department_id", ids)
        .order("date", { ascending: false });

      if (error) throw error;
      setData(revenueData || []);
    } catch (error) {
      console.error("Error fetching revenue:", error);
    } finally {
      setIsLoading(false);
    }
  }

  async function fetchPendingCounterRevenue() {
    setIsLoading(true);
    try {
      if (!profile) return;
      const currentM = new Date().getMonth() + 1;
      const currentY = new Date().getFullYear();

      // Ambil dari dua sumber: Plotting Bulanan DAN Relasi Permanen
      const [assignmentsRes, directCountersRes] = await Promise.all([
        supabase.from("monthly_assignments").select("counter_id")
          .eq("supervisor_id", profile.id)
          .eq("month", currentM)
          .eq("year", currentY)
          .not("counter_id", "is", null),
        supabase.from("counters").select("id").eq("supervisor_id", profile.id)
      ]);

      const counterIds = Array.from(new Set([
        ...(assignmentsRes.data?.map(a => a.counter_id) || []),
        ...(directCountersRes.data?.map(c => c.id) || [])
      ])).filter(Boolean);

      if (counterIds.length === 0) {
        setCounterData([]);
        return;
      }

      const { data, error } = await supabase
        .from("counter_weekly_revenue")
        .select("*, counters(name), users:created_by(full_name)")
        .eq("status", "pending")
        .in("counter_id", counterIds)
        .order("created_at", { ascending: false });

      if (error) throw error;
      setCounterData(data || []);
    } catch (error) {
      console.error("Error fetching counter revenue:", error);
    } finally {
      setIsLoading(false);
    }
  }

  async function handleVerify(id: string, isApproved: boolean) {
    try {
      const table = activeTab === "SA" ? "daily_revenue" : "counter_weekly_revenue";
      const { error } = await supabase
        .from(table)
        .update({
          status: isApproved ? "approved" : "rejected",
          verified_by: profile?.id,
          verified_at: new Date().toISOString()
        })
        .eq("id", id);

      if (error) throw error;
      alert(isApproved ? "Input disetujui!" : "Input ditolak!");
      activeTab === "SA" ? fetchPendingRevenue() : fetchPendingCounterRevenue();
    } catch (error) {
      alert("Gagal verifikasi: " + (error as any).message);
    }
  }

  return (
    <>
      <PageMeta title="Verifikasi Omset | Gramedia Tracker" description="Verifikasi omset harian dari SA dan Counter" />

      <div className="flex flex-col gap-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Verifikasi Omset (Pending)</h1>

          <div className="flex bg-gray-100 dark:bg-gray-800 p-1 rounded-lg">
            <button
              onClick={() => setActiveTab("SA")}
              className={`px-4 py-1.5 text-sm font-medium rounded-md transition-all ${activeTab === "SA" ? "bg-white dark:bg-gray-700 shadow-sm text-brand-600" : "text-gray-500 hover:text-gray-700"}`}
            >
              Omset SA
            </button>
            <button
              onClick={() => setActiveTab("Counter")}
              className={`px-4 py-1.5 text-sm font-medium rounded-md transition-all ${activeTab === "Counter" ? "bg-white dark:bg-gray-700 shadow-sm text-brand-600" : "text-gray-500 hover:text-gray-700"}`}
            >
              Omset Counter
            </button>
          </div>
        </div>

        <div className="overflow-hidden rounded-xl border border-gray-200 bg-white dark:border-white/[0.05] dark:bg-white/[0.03]">
          <div className="max-w-full overflow-x-auto">
            <Table>
              <TableHeader className="border-b border-gray-100 dark:border-white/[0.05]">
                <TableRow>
                  <TableCell isHeader className="px-5 py-3 text-start text-theme-xs uppercase">{activeTab === "SA" ? "Tanggal" : "Periode"}</TableCell>
                  <TableCell isHeader className="px-5 py-3 text-start text-theme-xs uppercase">{activeTab === "SA" ? "SA / Departemen" : "Counter / Brand"}</TableCell>
                  <TableCell isHeader className="px-5 py-3 text-start text-theme-xs uppercase">Nominal</TableCell>
                  <TableCell isHeader className="px-5 py-3 text-start text-theme-xs uppercase">Keterangan</TableCell>
                  <TableCell isHeader className="px-5 py-3 text-end text-theme-xs uppercase">Aksi</TableCell>
                </TableRow>
              </TableHeader>
              <TableBody className="divide-y divide-gray-100 dark:divide-white/[0.05]">
                {isLoading ? (
                  <TableRow>
                    <TableCell colSpan={5} className="text-center py-10 text-gray-400">Memuat data...</TableCell>
                  </TableRow>
                ) : (activeTab === "SA" ? data : counterData).length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={5} className="text-center py-10 text-gray-400 font-medium">Tidak ada pengajuan omset pending.</TableCell>
                  </TableRow>
                ) : (
                  (activeTab === "SA" ? data : counterData).map((item) => (
                    <TableRow key={item.id}>
                      <TableCell className="px-5 py-4 text-sm">
                        {activeTab === "SA" ? item.date : `${new Date(item.week_start).toLocaleDateString()} - ${new Date(item.week_end).toLocaleDateString()}`}
                      </TableCell>
                      <TableCell className="px-5 py-4">
                        <div className="flex flex-col">
                          <span className="font-medium text-gray-800 dark:text-white/90">
                            {activeTab === "SA" ? item.users?.full_name : item.counters?.name}
                          </span>
                          <span className="text-xs text-brand-600 font-bold uppercase">
                            {activeTab === "SA" ? item.departments?.name : `Oleh: ${item.users?.full_name || 'Counter'}`}
                          </span>
                        </div>
                      </TableCell>
                      <TableCell className="px-5 py-4 font-bold text-gray-900 dark:text-white">Rp {item.amount.toLocaleString()}</TableCell>
                      <TableCell className="px-5 py-4 text-sm text-gray-500 max-w-[200px] truncate">{item.notes || "-"}</TableCell>
                      <TableCell className="px-5 py-4 text-end">
                        <div className="flex justify-end gap-2">
                          <Button size="sm" variant="outline" className="text-error-500 border-error-500 hover:bg-error-50" onClick={() => handleVerify(item.id, false)}>
                            Tolak
                          </Button>
                          <Button size="sm" onClick={() => handleVerify(item.id, true)}>
                            Setujui
                          </Button>
                        </div>
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
