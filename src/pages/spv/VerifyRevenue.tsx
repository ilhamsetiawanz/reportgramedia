import { useEffect, useState } from "react";
import { supabase } from "../../lib/supabase";
import { useAuthStore } from "../../store/useAuthStore";
import PageMeta from "../../components/common/PageMeta";
import { Table, TableBody, TableCell, TableHeader, TableRow } from "../../components/ui/table";
import Button from "../../components/ui/button/Button";

interface RevenuePending {
  id: string;
  date: string;
  amount: number;
  notes: string;
  sa_id: string;
  department_id: string;
  users: { full_name: string } | null;
  departments: { name: string } | null;
}

export default function VerifyRevenue() {
  const { profile } = useAuthStore();
  const [data, setData] = useState<RevenuePending[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    fetchPendingRevenue();
  }, []);

    async function fetchPendingRevenue() {
    setIsLoading(true);
    try {
      if (!profile) return;
      
      const currentM = new Date().getMonth() + 1;
      const currentY = new Date().getFullYear();

      // Get departments assigned to THIS SPV for CURRENT month
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
      setData(revenueData as any || []);
    } catch (error) {
      console.error("Error fetching revenue:", error);
    } finally {
      setIsLoading(false);
    }
  }

  async function handleVerify(id: string, isApproved: boolean) {
    try {
      const { error } = await supabase
        .from("daily_revenue")
        .update({ 
          status: isApproved ? "approved" : "rejected",
          verified_by: profile?.id,
          verified_at: new Date().toISOString()
        })
        .eq("id", id);
      
      if (error) throw error;
      alert(isApproved ? "Input disetujui!" : "Input ditolak!");
      fetchPendingRevenue();
    } catch (error) {
      alert("Gagal verifikasi: " + (error as any).message);
    }
  }

  return (
    <>
      <PageMeta title="Verifikasi Omset | Gramedia Tracker" description="Verifikasi omset harian dari SA" />
      
      <div className="flex flex-col gap-6">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Verifikasi Omset (Pending)</h1>

        <div className="overflow-hidden rounded-xl border border-gray-200 bg-white dark:border-white/[0.05] dark:bg-white/[0.03]">
          <div className="max-w-full overflow-x-auto">
            <Table>
              <TableHeader className="border-b border-gray-100 dark:border-white/[0.05]">
                <TableRow>
                  <TableCell isHeader className="px-5 py-3 text-start text-theme-xs">Tanggal</TableCell>
                  <TableCell isHeader className="px-5 py-3 text-start text-theme-xs">SA / Departemen</TableCell>
                  <TableCell isHeader className="px-5 py-3 text-start text-theme-xs">Nominal</TableCell>
                  <TableCell isHeader className="px-5 py-3 text-start text-theme-xs">Catatan SA</TableCell>
                  <TableCell isHeader className="px-5 py-3 text-end text-theme-xs">Aksi</TableCell>
                </TableRow>
              </TableHeader>
              <TableBody className="divide-y divide-gray-100 dark:divide-white/[0.05]">
                {isLoading ? (
                  <TableRow>
                    <TableCell colSpan={5} className="text-center py-10 text-gray-400">Memuat data...</TableCell>
                  </TableRow>
                ) : data.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={5} className="text-center py-10 text-gray-400 font-medium">Tidak ada pengajuan omset pending.</TableCell>
                  </TableRow>
                ) : (
                  data.map((item) => (
                    <TableRow key={item.id}>
                      <TableCell className="px-5 py-4 text-sm">{item.date}</TableCell>
                      <TableCell className="px-5 py-4">
                        <div className="flex flex-col">
                          <span className="font-medium text-gray-800 dark:text-white/90">{item.users?.full_name}</span>
                          <span className="text-xs text-brand-600 font-bold uppercase">{item.departments?.name}</span>
                        </div>
                      </TableCell>
                      <TableCell className="px-5 py-4 font-bold text-gray-900">Rp {item.amount.toLocaleString()}</TableCell>
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
