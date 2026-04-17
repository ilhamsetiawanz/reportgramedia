import React, { useEffect, useState } from "react";
import { supabase } from "../../lib/supabase";
import { useAuthStore } from "../../store/useAuthStore";
import PageMeta from "../../components/common/PageMeta";
import InputField from "../../components/form/input/InputField";
import Button from "../../components/ui/button/Button";
import CurrencyInput from "../../components/form/input/CurrencyInput";
import { Table, TableBody, TableCell, TableHeader, TableRow } from "../../components/ui/table";
import Badge from "../../components/ui/badge/Badge";
import { PencilIcon, TrashBinIcon } from "../../icons";

interface Department {
  id: string;
  name: string;
}

interface RevenueEntry {
  id: string;
  date: string;
  amount: number;
  status: string;
  departments: { name: string } | null;
}

export default function DailyRevenueInput() {
  const { profile } = useAuthStore();
  const [departments, setDepartments] = useState<Department[]>([]);
  const [history, setHistory] = useState<RevenueEntry[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  
  // Form State
  const [formData, setFormData] = useState({
    date: new Date().toISOString().split("T")[0],
    department_id: "",
    amount: 0,
    notes: ""
  });

  const [editingId, setEditingId] = useState<string | null>(null);

  useEffect(() => {
    if (profile) {
      fetchDepartments();
      fetchHistory();
    }
  }, [profile]);

  async function fetchDepartments() {
    try {
      if (profile?.id) {
        // Fetch from monthly_assignments for the current month/year
        const currentM = new Date().getMonth() + 1;
        const currentY = new Date().getFullYear();

        const { data: assignData, error: assignError } = await supabase
          .from("monthly_assignments")
          .select("department_id, departments(id, name)")
          .eq("sa_id", profile.id)
          .eq("month", currentM)
          .eq("year", currentY);
        
        if (assignError) throw assignError;

        const deptList = (assignData || []).map(a => ({
          id: a.department_id,
          name: (a.departments as any)?.name || "Unknown"
        }));

        setDepartments(deptList);
        if (deptList.length > 0) {
          setFormData(prev => ({ ...prev, department_id: deptList[0].id }));
        }
      }
    } catch (error) {
      console.error("Error fetching depts:", error);
    }
  }

  async function fetchHistory() {
    try {
      const { data, error } = await supabase
        .from("daily_revenue")
        .select("id, date, amount, status, notes, department_id, departments(name)")
        .eq("sa_id", profile?.id)
        .order("date", { ascending: false })
        .limit(10);
      
      if (error) throw error;
      setHistory(data as any || []);
    } catch (error) {
      console.error("Error fetching history:", error);
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setIsLoading(true);
    try {
      if (editingId) {
        // Update existing pending entry
        const { error } = await supabase
          .from("daily_revenue")
          .update({
            date: formData.date,
            department_id: formData.department_id,
            amount: formData.amount,
            notes: formData.notes,
          })
          .eq("id", editingId);
        
        if (error) throw error;
        alert("Omset diperbarui!");
        setEditingId(null);
      } else {
        // Insert new entry
        const { error } = await supabase.from("daily_revenue").insert([{
          date: formData.date,
          department_id: formData.department_id,
          amount: formData.amount,
          notes: formData.notes,
          sa_id: profile?.id,
          status: "pending"
        }]);

        if (error) {
          if (error.code === "23505") {
            return alert("Anda sudah menginput omset untuk departemen ini pada tanggal tersebut.");
          }
          throw error;
        }
        alert("Omset berhasil diinput! Menunggu verifikasi SPV.");
      }

      setFormData({
        date: new Date().toISOString().split("T")[0],
        department_id: departments[0]?.id || "",
        amount: 0,
        notes: ""
      });
      fetchHistory();
    } catch (error) {
      alert("Gagal menyimpan omset: " + (error as any).message);
    } finally {
      setIsLoading(false);
    }
  }

  async function generateWAMessage(item: any) {
    try {
      const date = item.date;
      const startOfMonth = `${new Date(date).getFullYear()}-${(new Date(date).getMonth() + 1).toString().padStart(2, '0')}-01`;
      const currentMonthVal = new Date(date).getMonth() + 1;
      const currentYearVal = new Date(date).getFullYear();

      // Ambil semua assignment departemen SA bulan ini
      const { data: assignments } = await supabase
        .from('monthly_assignments')
        .select('department_id, departments(id, name)')
        .eq('sa_id', profile?.id)
        .eq('month', currentMonthVal)
        .eq('year', currentYearVal);

      // Fallback ke dept dari item jika tidak ada assignment
      const deptList: { id: string; name: string }[] = (assignments && assignments.length > 0)
        ? assignments.map((a: any) => ({ id: a.department_id, name: a.departments?.name || 'Unknown' }))
        : [{ id: item.department_id, name: item.departments?.name || 'Unknown' }];
      
      const targetDeptIds = deptList.map(d => d.id);
      const deptLabel = deptList.length > 1 ? "GABUNGAN DEPT" : deptList[0]?.name;

      // Fetch semua data secara paralel
      // Note: .maybeSingle() digunakan agar tidak crash jika waqaf kosong
      const [monthlyRevRes, monthlyWMRes, targetRes, dailyWMRes, dailyRevRes, deptRevTodayRes] = await Promise.all([
        // Akumulasi omset bulan ini (approved)
        supabase.from('daily_revenue').select('amount, department_id').in('department_id', targetDeptIds).eq('sa_id', profile?.id).eq('status', 'approved').gte('date', startOfMonth).lte('date', date),
        // Akumulasi waqaf member bulan ini
        supabase.from('waqaf_member_entries').select('waqaf_amount, member_count').eq('sa_id', profile?.id).gte('date', startOfMonth).lte('date', date),
        // Target bulanan per departemen
        supabase.from('monthly_targets').select('target_amount, last_year_amount, department_id').in('department_id', targetDeptIds).eq('month', currentMonthVal).eq('year', currentYearVal),
        // Data waqaf hari ini — maybeSingle() agar tidak crash jika kosong
        supabase.from('waqaf_member_entries').select('*').eq('sa_id', profile?.id).eq('date', date).maybeSingle(),
        // Omset hari ini per departemen (approved)
        supabase.from('daily_revenue').select('amount, department_id').in('department_id', targetDeptIds).eq('sa_id', profile?.id).eq('date', date).eq('status', 'approved'),
        // Semua omset hari ini (termasuk pending — agar tetap tampil meski belum approved)
        supabase.from('daily_revenue').select('amount, department_id').in('department_id', targetDeptIds).eq('sa_id', profile?.id).eq('date', date)
      ]);

      // Hitung total omset hari ini: prioritas approved, fallback ke semua status
      const dailySalesApproved = dailyRevRes.data?.reduce((acc, curr) => acc + curr.amount, 0) || 0;
      const dailySalesAll = deptRevTodayRes.data?.reduce((acc, curr) => acc + curr.amount, 0) || 0;
      const dailySales = dailySalesApproved > 0 ? dailySalesApproved : dailySalesAll;

      // Akumulasi bulan
      const accRev = monthlyRevRes.data?.reduce((acc, curr) => acc + curr.amount, 0) || 0;
      const accMember = monthlyWMRes.data?.reduce((acc, curr) => acc + curr.member_count, 0) || 0;
      const accWaqaf = monthlyWMRes.data?.reduce((acc, curr) => acc + curr.waqaf_amount, 0) || 0;

      // Target
      const targetAmt = targetRes.data?.reduce((acc, curr) => acc + curr.target_amount, 0) || 0;
      const lyAmt = targetRes.data?.reduce((acc, curr) => acc + curr.last_year_amount, 0) || 0;
      const achPerc = targetAmt > 0 ? (accRev / targetAmt) * 100 : 0;
      const growthAmt = accRev - lyAmt;
      const growthPerc = lyAmt > 0 ? (growthAmt / lyAmt) * 100 : 0;

      const formattedDate = new Date(date).toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' });
      const currentMonthName = new Date(date).toLocaleString('id-ID', { month: 'long' });
      const waqafToday = dailyWMRes.data;

      // Buat baris omset per departemen
      let deptOmsetLines = '';
      if (deptList.length > 1) {
        for (const dept of deptList) {
          const deptSalesToday = deptRevTodayRes.data?.filter(r => r.department_id === dept.id).reduce((acc, curr) => acc + curr.amount, 0) || 0;
          deptOmsetLines += `\n- ${dept.name} : Rp ${deptSalesToday.toLocaleString('id-ID')}`;
        }
      }

      const message = `*Report Harian, ${formattedDate}*
Nama : ${profile?.full_name}
My Value : ${waqafToday?.member_count || 0}
Waqaf : ${(waqafToday?.waqaf_amount || 0) > 0 ? 'Rp ' + (waqafToday?.waqaf_amount || 0).toLocaleString('id-ID') : '-'}

*Akumulasi 1 - ${new Date(date).getDate()} ${currentMonthName} ${new Date(date).getFullYear()}*
My Value : ${accMember}
Wakaf : Rp ${accWaqaf.toLocaleString('id-ID')}

Departement : *${deptLabel}*
Sales : Rp ${dailySales.toLocaleString('id-ID')}${deptOmsetLines}
Target : Rp ${targetAmt.toLocaleString('id-ID')}
Achiv : ${achPerc.toFixed(1)}%
Growth : ${growthPerc.toFixed(1)}%

Semoga Hari Esok Bisa Lebih Baik lagi Terimakasih 🙏`;

      const encodedMessage = encodeURIComponent(message);
      window.open(`https://wa.me/?text=${encodedMessage}`, '_blank');
    } catch (error) {
       console.error("Error generating WA message:", error);
       alert("Gagal membuat laporan WA. Pastikan data target and waqaf sudah tersedia.");
    }
  }

  const handleEdit = (entry: RevenueEntry) => {
    setEditingId(entry.id);
    setFormData({
      date: entry.date,
      department_id: (entry as any).department_id,
      amount: entry.amount,
      notes: (entry as any).notes || ""
    });
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  async function handleDelete(id: string) {
    if (!confirm("Hapus input omset ini?")) return;
    try {
      const { error } = await supabase.from("daily_revenue").delete().eq("id", id);
      if (error) throw error;
      fetchHistory();
    } catch (error) {
      alert("Gagal hapus: " + (error as any).message);
    }
  }

  const cancelEdit = () => {
    setEditingId(null);
    setFormData({
      date: new Date().toISOString().split("T")[0],
      department_id: departments[0]?.id || "",
      amount: 0,
      notes: ""
    });
  };

  return (
    <>
      <PageMeta title="Input Omset | Gramedia Tracker" description="Input omset harian toko" />
      
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* Input Form */}
        <div className="rounded-2xl border border-gray-200 bg-white p-6 dark:border-white/[0.05] dark:bg-white/[0.03]">
          <h2 className="mb-6 text-lg font-bold text-gray-900 dark:text-white">
            {editingId ? "Edit Omset (Pending)" : "Input Omset Harian"}
          </h2>
          <form onSubmit={handleSubmit} className="space-y-4">
            <InputField
              label="Tanggal"
              type="date"
              value={formData.date}
              onChange={(e) => setFormData({ ...formData, date: e.target.value })}
              required
            />
            
            <div className="space-y-2">
              <label className="text-sm font-medium text-gray-700 dark:text-gray-400">Departemen</label>
              <select
                className="w-full h-11 px-4 text-sm border border-gray-300 rounded-lg outline-none focus:border-brand-500 dark:bg-gray-900 dark:border-gray-800 dark:text-gray-400"
                value={formData.department_id}
                onChange={(e) => setFormData({ ...formData, department_id: e.target.value })}
                required
              >
                <option value="">Pilih Departemen...</option>
                {departments.map(dept => (
                  <option key={dept.id} value={dept.id}>{dept.name}</option>
                ))}
              </select>
            </div>

            <CurrencyInput
              label="Nominal Omset"
              value={formData.amount}
              onChange={(val) => setFormData({ ...formData, amount: val })}
              required
            />

            <InputField
              label="Catatan (Opsional)"
              placeholder="Keterangan tambahan..."
              value={formData.notes}
              onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
            />

            <div className="flex flex-col gap-3">
              <Button type="submit" disabled={isLoading} className="w-full">
                {isLoading ? "Mengirim..." : editingId ? "Update Omset" : "Simpan Omset"}
              </Button>
              {editingId && (
                <Button variant="outline" onClick={cancelEdit} className="w-full text-gray-400 border-gray-200 hover:bg-gray-50">
                  Batalkan Edit
                </Button>
              )}
            </div>
          </form>
        </div>

        {/* Recent History */}
        <div className="rounded-2xl border border-gray-200 bg-white p-6 dark:border-white/[0.05] dark:bg-white/[0.03]">
          <h2 className="mb-6 text-lg font-bold text-gray-900 dark:text-white">10 Input Terakhir</h2>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableCell isHeader className="px-4 py-3 text-theme-xs">Tanggal</TableCell>
                  <TableCell isHeader className="px-4 py-3 text-theme-xs">Dept</TableCell>
                  <TableCell isHeader className="px-4 py-3 text-theme-xs">Nominal</TableCell>
                  <TableCell isHeader className="px-4 py-3 text-theme-xs text-center">Status</TableCell>
                  <TableCell isHeader className="px-4 py-3 text-end text-theme-xs">Aksi</TableCell>
                </TableRow>
              </TableHeader>
              <TableBody>
                {history.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={5} className="text-center py-4 text-gray-500 text-sm">Belum ada data.</TableCell>
                  </TableRow>
                ) : (
                  history.map((item) => (
                    <TableRow key={item.id}>
                      <TableCell className="px-4 py-3 text-sm">{item.date}</TableCell>
                      <TableCell className="px-4 py-3 text-sm font-medium">{item.departments?.name || "-"}</TableCell>
                      <TableCell className="px-4 py-3 text-sm">Rp {item.amount.toLocaleString()}</TableCell>
                      <TableCell className="px-4 py-3 text-center">
                        <Badge size="xs" color={
                          item.status === 'approved' ? 'success' : 
                          item.status === 'rejected' ? 'error' : 'warning'
                        }>
                          {item.status.toUpperCase()}
                        </Badge>
                      </TableCell>
                      <TableCell className="px-4 py-3 text-end">
                        <div className="flex justify-end gap-2 items-center">
                          {item.status === 'approved' && (
                            <button 
                              onClick={() => generateWAMessage(item)} 
                              className="p-1.5 rounded-lg bg-success-50 text-success-600 hover:bg-success-100 transition-colors"
                              title="Share to WhatsApp"
                            >
                              <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.438 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/></svg>
                            </button>
                          )}
                          {item.status === 'pending' && (
                            <>
                              <button onClick={() => handleEdit(item)} className="text-gray-400 hover:text-brand-500 transition-colors">
                                <PencilIcon className="size-4" />
                              </button>
                              <button onClick={() => handleDelete(item.id)} className="text-gray-400 hover:text-error-500 transition-colors">
                                <TrashBinIcon className="size-4" />
                              </button>
                            </>
                          )}
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
