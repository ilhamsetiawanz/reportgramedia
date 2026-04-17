import { useEffect, useState } from "react";
import { supabase } from "../../lib/supabase";
import PageMeta from "../../components/common/PageMeta";
import { Table, TableBody, TableCell, TableHeader, TableRow } from "../../components/ui/table";
import Badge from "../../components/ui/badge/Badge";
import InputField from "../../components/form/input/InputField";
import Button from "../../components/ui/button/Button";
import jsPDF from "jspdf";
import "jspdf-autotable";
import { Modal } from "../../components/ui/modal";
import CurrencyInput from "../../components/form/input/CurrencyInput";
import { useAuthStore } from "../../store/useAuthStore";
import { PencilIcon } from "../../icons";

export default function DailyReport() {
  const [data, setData] = useState<any[]>([]);
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [isLoading, setIsLoading] = useState(false);
  const { profile } = useAuthStore();

  // Edit Modal State
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<any>(null);
  const [editAmount, setEditAmount] = useState(0);
  const [editNote, setEditNote] = useState("");

  useEffect(() => {
    fetchReport();
  }, [date]);

  async function fetchReport() {
    setIsLoading(true);
    try {
      const { data: revData, error } = await supabase
        .from('daily_revenue')
        .select('*, departments(name, code), users!daily_revenue_sa_id_fkey(full_name)')
        .eq('date', date)
        .order('amount', { ascending: false });
      
      if (error) throw error;
      setData(revData || []);
    } catch (error) {
      console.error("Error fetching report:", error);
    } finally {
      setIsLoading(false);
    }
  }

  const exportPDF = () => {
    const doc = new jsPDF();
    const tableColumn = ["Departemen", "Kode", "Penginput (SA)", "Nominal", "Status"];
    const tableRows: any[] = [];

    data.forEach(item => {
      const itemData = [
        item.departments?.name,
        item.departments?.code,
        item.users?.full_name,
        `Rp ${item.amount.toLocaleString()}`,
        item.status.toUpperCase()
      ];
      tableRows.push(itemData);
    });

    // Header
    doc.setFontSize(16);
    doc.text("Laporan Omset Harian - Gramedia Kendari", 14, 15);
    doc.setFontSize(10);
    doc.text(`Tanggal: ${date}`, 14, 22);
    
    // @ts-ignore
    doc.autoTable({
      head: [tableColumn],
      body: tableRows,
      startY: 28,
      theme: 'grid',
      headStyles: { fillColor: [43, 86, 179] } // Biru Brand
    });

    doc.save(`Laporan_Harian_${date}.pdf`);
  };

  const openEditModal = (item: any) => {
    if (profile?.role === 'store_associate') return;
    setEditingItem(item);
    setEditAmount(item.amount);
    setEditNote(item.notes || "");
    setIsEditModalOpen(true);
  };

  async function handleUpdateRevenue() {
    if (!editingItem) return;
    try {
      const { error } = await supabase
        .from('daily_revenue')
        .update({ 
          amount: editAmount, 
          notes: `${editNote} (Edited by ${profile?.full_name})` 
        })
        .eq('id', editingItem.id);
      
      if (error) throw error;
      alert("Data diperbarui!");
      setIsEditModalOpen(false);
      fetchReport();
    } catch (error) {
      alert("Gagal update: " + (error as any).message);
    }
  }

  async function generateWAMessage(item: any) {
    try {
      // 1. Get Monthly Accumulation for SA
      const startOfMonth = `${new Date(date).getFullYear()}-${(new Date(date).getMonth() + 1).toString().padStart(2, '0')}-01`;
      const currentMonthVal = new Date(date).getMonth() + 1;
      const currentYearVal = new Date(date).getFullYear();

      // Check if user is SA to use aggregation
      const isSA = profile?.role === 'store_associate' || item.sa_id === profile?.id;
      let targetDeptIds = [item.department_id];
      let deptLabel = item.departments?.name;

      if (isSA) {
        const { data: assignments } = await supabase
          .from('monthly_assignments')
          .select('department_id')
          .eq('sa_id', item.sa_id)
          .eq('month', currentMonthVal)
          .eq('year', currentYearVal);
        
        if (assignments && assignments.length > 0) {
          targetDeptIds = assignments.map(a => a.department_id);
          deptLabel = assignments.length > 1 ? "GABUNGAN DEPT" : item.departments?.name;
        }
      }
      
      const [monthlyRevRes, monthlyWMRes, targetRes, dailyWMRes] = await Promise.all([
        supabase.from('daily_revenue').select('amount').in('department_id', targetDeptIds).eq('sa_id', profile?.id).eq('status', 'approved').gte('date', startOfMonth).lte('date', date),
        supabase.from('waqaf_member_entries').select('waqaf_amount, member_count').eq('sa_id', profile?.id).gte('date', startOfMonth).lte('date', date),
        supabase.from('monthly_targets').select('target_amount, last_year_amount').in('department_id', targetDeptIds).eq('month', currentMonthVal).eq('year', currentYearVal),
        supabase.from('waqaf_member_entries').select('*').eq('sa_id', profile?.id).eq('date', date).single()
      ]);

      const dailyRevToday = await supabase
        .from('daily_revenue')
        .select('amount')
        .in('department_id', targetDeptIds)
        .eq('sa_id', profile?.id)
        .eq('date', date)
        .eq('status', 'approved');

      const dailySales = dailyRevToday.data?.reduce((acc, curr) => acc + curr.amount, 0) || 0;
      const accRev = monthlyRevRes.data?.reduce((acc, curr) => acc + curr.amount, 0) || 0;
      const accMember = monthlyWMRes.data?.reduce((acc, curr) => acc + curr.member_count, 0) || 0;
      const accWaqaf = monthlyWMRes.data?.reduce((acc, curr) => acc + curr.waqaf_amount, 0) || 0;

      const targetAmt = targetRes.data?.reduce((acc, curr) => acc + curr.target_amount, 0) || 0;
      const lyAmt = targetRes.data?.reduce((acc, curr) => acc + curr.last_year_amount, 0) || 0;
      const achPerc = targetAmt > 0 ? (accRev / targetAmt) * 100 : 0;
      const growthAmt = accRev - lyAmt;
      const growthPerc = lyAmt > 0 ? (growthAmt / lyAmt) * 100 : 0;

      const formattedDate = new Date(date).toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' });
      const currentMonthName = new Date(date).toLocaleString('id-ID', { month: 'long' });

      const message = `*Report Harian, ${formattedDate}*
Nama : ${profile?.full_name}
My Value : ${dailyWMRes.data?.member_count || 0}
Waqaf : ${dailyWMRes.data?.waqaf_amount > 0 ? 'Rp ' + dailyWMRes.data.waqaf_amount.toLocaleString() : '-'}

*Akumulasi 1 - ${new Date(date).getDate()} ${currentMonthName} ${new Date(date).getFullYear()}*
My Value : ${accMember}
Wakaf : Rp ${accWaqaf.toLocaleString()}

Departement : *${deptLabel}*
Sales : Rp ${dailySales.toLocaleString()}
Target : Rp ${targetAmt.toLocaleString()}
Achiv : ${achPerc.toFixed(1)}%
Growth : ${growthPerc.toFixed(1)}%

Semoga Hari Esok Bisa Lebih Baik lagi Terimakasih 🙏`;

      const encodedMessage = encodeURIComponent(message);
      window.open(`https://wa.me/?text=${encodedMessage}`, '_blank');
    } catch (error) {
       console.error("Error generating WA message:", error);
       alert("Gagal membuat laporan WA. Pastikan data target sudah diinput.");
    }
  }

  return (
    <>
      <PageMeta title="Laporan Harian | Gramedia Tracker" description="Rincian omset harian per departemen" />
      <div className="flex flex-col gap-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
           <div>
             <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Daily Revenue Report</h1>
             <p className="text-sm text-gray-500">Rekapitulasi omset harian seluruh departemen.</p>
           </div>
           
           <div className="flex items-center gap-3">
             <div className="flex items-center gap-2">
               <span className="text-xs font-medium text-gray-500 uppercase tracking-wider">Pilih Tanggal:</span>
               <InputField 
                 type="date"
                 className="h-10 text-xs w-[160px]" 
                 value={date} 
                 onChange={(e) => setDate(e.target.value)} 
               />
             </div>
             <Button variant="outline" size="sm" onClick={exportPDF} disabled={data.length === 0}>
               Export PDF
             </Button>
           </div>
        </div>

        <div className="overflow-hidden rounded-xl border border-gray-200 bg-white dark:border-white/[0.05] dark:bg-white/[0.03]">
          <div className="max-w-full overflow-x-auto">
            <Table>
              <TableHeader className="bg-[#2B56B3] border-none">
                <TableRow>
                  <TableCell isHeader className="px-5 py-3 text-white font-bold uppercase text-[11px] tracking-widest border-none">Departemen</TableCell>
                  <TableCell isHeader className="px-5 py-3 text-white font-bold uppercase text-[11px] tracking-widest border-none">Penginput (SA)</TableCell>
                  <TableCell isHeader className="px-5 py-3 text-white font-bold uppercase text-[11px] tracking-widest border-none">Nominal</TableCell>
                  <TableCell isHeader className="px-5 py-3 text-white font-bold uppercase text-[11px] tracking-widest border-none">Status</TableCell>
                  <TableCell isHeader className="px-5 py-3 text-white font-bold uppercase text-[11px] tracking-widest border-none">Catatan / Aksi</TableCell>
                </TableRow>
              </TableHeader>
              <TableBody className="divide-y divide-gray-100 dark:divide-white/[0.05]">
                {isLoading ? (
                  <TableRow>
                    <TableCell colSpan={5} className="text-center py-12 text-gray-400">Memuat data...</TableCell>
                  </TableRow>
                ) : data.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={5} className="text-center py-20">
                      <p className="text-gray-400 font-medium text-sm italic">Tidak ada data untuk tanggal ini.</p>
                    </TableCell>
                  </TableRow>
                ) : (
                  <>
                    {data.map((item) => (
                      <TableRow key={item.id} className="hover:bg-gray-50/50 dark:hover:bg-white/[0.02]">
                        <TableCell className="px-5 py-4">
                           <div className="flex flex-col">
                             <span className="font-bold text-gray-900 dark:text-white">{item.departments?.name}</span>
                             <span className="text-[10px] text-brand-600 font-bold uppercase tracking-tighter">Dept Code: {item.departments?.code}</span>
                           </div>
                        </TableCell>
                        <TableCell className="px-5 py-4 text-sm text-gray-700 dark:text-gray-400 font-medium">{item.users?.full_name}</TableCell>
                        <TableCell className="px-5 py-4 font-bold text-gray-900 dark:text-white">Rp {item.amount.toLocaleString()}</TableCell>
                        <TableCell className="px-5 py-4">
                          <Badge size="xs" color={item.status === 'approved' ? 'success' : item.status === 'rejected' ? 'error' : 'warning'}>
                            {item.status.toUpperCase()}
                          </Badge>
                        </TableCell>
                         <TableCell className="px-5 py-4">
                            <div className="flex items-center justify-between gap-2">
                              <div className="flex items-center gap-2">
                                <span className="text-xs text-gray-400 italic max-w-[80px] truncate">{item.notes || "-"}</span>
                                <button 
                                  onClick={() => generateWAMessage(item)} 
                                  className="p-1.5 rounded-lg bg-success-50 text-success-600 hover:bg-success-100 transition-colors"
                                  title="Share to WhatsApp"
                                >
                                  <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.438 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/></svg>
                                </button>
                              </div>
                              {(profile?.role === 'store_manager' || profile?.role === 'supervisor') && (
                                <button onClick={() => openEditModal(item)} className="text-gray-400 hover:text-brand-500 transition-colors">
                                  <PencilIcon className="size-4" />
                                </button>
                              )}
                            </div>
                         </TableCell>
                      </TableRow>
                    ))}
                    {/* Total Row */}
                    <TableRow className="bg-gray-50/50 dark:bg-white/[0.01]">
                       <TableCell colSpan={2} className="px-5 py-4 text-end font-bold text-gray-900 dark:text-white">TOTAL OMSET HARIAN</TableCell>
                       <TableCell className="px-5 py-4 font-bold text-brand-600 text-lg">
                         Rp {data.filter(i => i.status === 'approved').reduce((acc, curr) => acc + curr.amount, 0).toLocaleString()}
                       </TableCell>
                       <TableCell colSpan={2} className="px-5 py-4 text-xs text-gray-400 italic font-medium">*(Hanya approved revenue)</TableCell>
                    </TableRow>
                  </>
                )}
              </TableBody>
            </Table>
          </div>
        </div>
      </div>

      <Modal isOpen={isEditModalOpen} onClose={() => setIsEditModalOpen(false)} className="max-w-[400px] p-8">
        <h2 className="mb-6 text-lg font-bold text-gray-900 dark:text-white">Koreksi Data Omset</h2>
        <div className="space-y-4">
          <p className="text-sm text-gray-500">Departemen: <span className="font-bold text-gray-900 dark:text-white">{editingItem?.departments?.name}</span></p>
          <CurrencyInput
            label="Nominal Baru"
            value={editAmount}
            onChange={(val) => setEditAmount(val)}
          />
          <InputField
            label="Alasan Perubahan"
            placeholder="Contoh: Salah input nominal..."
            value={editNote}
            onChange={(e) => setEditNote(e.target.value)}
          />
          <div className="flex justify-end gap-3 mt-6">
            <Button variant="outline" onClick={() => setIsEditModalOpen(false)}>Batal</Button>
            <Button onClick={handleUpdateRevenue}>Simpan Perubahan</Button>
          </div>
        </div>
      </Modal>
    </>
  );
}
