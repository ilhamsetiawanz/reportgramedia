import { useEffect, useState } from "react";
import { supabase } from "../../lib/supabase";
import { useAuthStore } from "../../store/useAuthStore";
import PageMeta from "../../components/common/PageMeta";
import { Table, TableBody, TableCell, TableHeader, TableRow } from "../../components/ui/table";
import Badge from "../../components/ui/badge/Badge";

export default function CounterReport() {
  const { profile } = useAuthStore();
  const [data, setData] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (profile?.counter_id) {
      fetchMyRevenue();
    }
  }, [profile]);

  async function fetchMyRevenue() {
    setIsLoading(true);
    try {
      const { data: res, error } = await supabase
        .from("counter_weekly_revenue")
        .select("*")
        .eq("counter_id", profile?.counter_id)
        .order("week_start", { ascending: false });
      
      if (error) throw error;
      setData(res || []);
    } catch (error) {
      console.error(error);
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <>
      <PageMeta title="Riwayat Omset | Gramedia Kendari" description="Riwayat performa mingguan counter Anda." />
      
      <div className="flex flex-col gap-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Riwayat Omset</h1>
          <p className="text-sm text-gray-500">Daftar laporan mingguan yang telah Anda kirimkan.</p>
        </div>

        <div className="overflow-hidden rounded-xl border border-gray-200 bg-white dark:border-white/[0.05] dark:bg-white/[0.03]">
          <div className="max-w-full overflow-x-auto">
            <Table>
              <TableHeader className="border-b border-gray-100 dark:border-white/[0.05]">
                <TableRow>
                  <TableCell isHeader className="px-5 py-3 text-start text-theme-xs uppercase">Periode</TableCell>
                  <TableCell isHeader className="px-5 py-3 text-start text-theme-xs uppercase">Nominal</TableCell>
                  <TableCell isHeader className="px-5 py-3 text-start text-theme-xs uppercase">Status</TableCell>
                  <TableCell isHeader className="px-5 py-3 text-start text-theme-xs uppercase">Verifikator</TableCell>
                  <TableCell isHeader className="px-5 py-3 text-start text-theme-xs uppercase">Tanggal Input</TableCell>
                </TableRow>
              </TableHeader>
              <TableBody className="divide-y divide-gray-100 dark:divide-white/[0.05]">
                {isLoading ? (
                  <TableRow>
                    <TableCell colSpan={5} className="text-center py-10 text-gray-400">Memuat riwayat...</TableCell>
                  </TableRow>
                ) : data.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={5} className="text-center py-10 text-gray-400 font-medium">Belum ada riwayat laporan.</TableCell>
                  </TableRow>
                ) : (
                  data.map((item) => (
                    <TableRow key={item.id}>
                      <TableCell className="px-5 py-4 text-sm font-medium">
                        {new Date(item.week_start).toLocaleDateString('id-ID')} - {new Date(item.week_end).toLocaleDateString('id-ID')}
                      </TableCell>
                      <TableCell className="px-5 py-4 font-bold text-gray-900 dark:text-white">Rp {item.amount.toLocaleString()}</TableCell>
                      <TableCell className="px-5 py-4">
                        <Badge size="xs" color={item.status === 'approved' ? 'success' : item.status === 'rejected' ? 'error' : 'warning'}>
                          {item.status.toUpperCase()}
                        </Badge>
                      </TableCell>
                      <TableCell className="px-5 py-4 text-sm text-gray-500">{item.verified_by ? 'Staff Kantor' : '-'}</TableCell>
                      <TableCell className="px-5 py-4 text-sm text-gray-500">{new Date(item.created_at).toLocaleDateString('id-ID')}</TableCell>
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
