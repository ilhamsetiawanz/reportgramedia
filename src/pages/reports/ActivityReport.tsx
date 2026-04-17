import { useEffect, useState } from "react";
import { supabase } from "../../lib/supabase";
import PageMeta from "../../components/common/PageMeta";
import { Table, TableBody, TableCell, TableHeader, TableRow } from "../../components/ui/table";
import InputField from "../../components/form/input/InputField";
import Button from "../../components/ui/button/Button";
import { useAuthStore } from "../../store/useAuthStore";

export default function ActivityReport() {
  const { profile } = useAuthStore();
  const [data, setData] = useState<any[]>([]);
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    fetchActivities();
  }, [date]);

  async function fetchActivities() {
    setIsLoading(true);
    try {
      const { data: activityData, error } = await supabase
        .from('daily_activity_reports')
        .select('*, users!daily_activity_reports_sa_id_fkey(full_name)')
        .eq('report_date', date)
        .order('created_at', { ascending: false });
      
      if (error) throw error;
      setData(activityData || []);
    } catch (error) {
      console.error("Error fetching activity report:", error);
    } finally {
      setIsLoading(false);
    }
  }

  async function handleUnlock(id: string) {
    if (!profile) return;
    try {
      const { error } = await supabase
        .from('daily_activity_reports')
        .update({ 
          is_locked: false, 
          unlocked_by_spv: true,
          unlocked_by: profile.id,
          unlocked_at: new Date().toISOString()
        })
        .eq('id', id);
      
      if (error) throw error;
      alert("Laporan berhasil dibuka kuncinya!");
      fetchActivities();
    } catch (error) {
      alert("Gagal unlock: " + (error as any).message);
    }
  }

  return (
    <>
      <PageMeta title="Laporan Kegiatan | Gramedia Tracker" description="Rekap harian aktivitas seluruh staff SA" />
      <div className="flex flex-col gap-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
           <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Rekap Kegiatan Staff</h1>
           <div className="flex items-center gap-2">
             <span className="text-sm font-medium text-gray-500">Tanggal:</span>
             <InputField 
               type="date"
               className="max-w-[180px]" 
               value={date} 
               onChange={(e) => setDate(e.target.value)} 
             />
           </div>
        </div>

        <div className="overflow-hidden rounded-xl border border-gray-200 bg-white dark:border-white/[0.05] dark:bg-white/[0.03]">
          <div className="max-w-full overflow-x-auto">
            <Table>
              <TableHeader className="border-b border-gray-100 dark:border-white/[0.05]">
                <TableRow>
                  <TableCell isHeader className="px-5 py-3 text-start text-theme-xs uppercase">Nama Staff (SA)</TableCell>
                  <TableCell isHeader className="px-5 py-3 text-start text-theme-xs uppercase">Catatan Kegiatan</TableCell>
                  <TableCell isHeader className="px-5 py-3 text-end text-theme-xs uppercase">Waktu Input</TableCell>
                  <TableCell isHeader className="px-5 py-3 text-end text-theme-xs uppercase">Aksi</TableCell>
                </TableRow>
              </TableHeader>
              <TableBody className="divide-y divide-gray-100 dark:divide-white/[0.05]">
                {isLoading ? (
                  <TableRow>
                    <TableCell colSpan={4} className="text-center py-10 text-gray-400">Memuat rincian...</TableCell>
                  </TableRow>
                ) : data.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={4} className="text-center py-10 text-gray-400 font-medium italic">Belum ada laporan kegiatan untuk tanggal ini.</TableCell>
                  </TableRow>
                ) : (
                  data.map((item) => (
                    <TableRow key={item.id}>
                      <TableCell className="px-5 py-4">
                        <span className="font-bold text-gray-900 dark:text-white">{item.users?.full_name}</span>
                        {item.unlocked_by_spv && (
                          <div className="text-[10px] text-brand-500 font-bold mt-1 uppercase">★ Pernah Unlock</div>
                        )}
                      </TableCell>
                      <TableCell className="px-5 py-4 max-w-[400px]">
                        <div className="text-sm text-gray-600 dark:text-gray-400 whitespace-pre-wrap">
                          {item.activity_notes}
                        </div>
                      </TableCell>
                      <TableCell className="px-5 py-4 text-end text-xs text-gray-500">
                        {new Date(item.created_at).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })} WIB
                      </TableCell>
                      <TableCell className="px-5 py-4 text-end">
                        {item.is_locked ? (
                          <Button size="sm" variant="outline" onClick={() => handleUnlock(item.id)}>Buka Kunci</Button>
                        ) : (
                           <span className="text-xs text-success-500 font-medium italic">Terbuka</span>
                        )}
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
