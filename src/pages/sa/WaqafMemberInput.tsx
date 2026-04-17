import React, { useEffect, useState } from "react";
import { supabase } from "../../lib/supabase";
import { useAuthStore } from "../../store/useAuthStore";
import PageMeta from "../../components/common/PageMeta";
import InputField from "../../components/form/input/InputField";
import Button from "../../components/ui/button/Button";
import CurrencyInput from "../../components/form/input/CurrencyInput";
import { Table, TableBody, TableCell, TableHeader, TableRow } from "../../components/ui/table";
import { TrashBinIcon } from "../../icons";

interface WaqafEntry {
  id: string;
  date: string;
  waqaf_amount: number;
  member_count: number;
}

export default function WaqafMemberInput() {
  const { profile } = useAuthStore();
  const [history, setHistory] = useState<WaqafEntry[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  
  const [formData, setFormData] = useState({
    date: new Date().toISOString().split("T")[0],
    waqaf: 0,
    member: ""
  });

  useEffect(() => {
    if (profile) fetchHistory();
  }, [profile]);

  async function fetchHistory() {
    const { data, error } = await supabase
      .from("waqaf_member_entries")
      .select("*")
      .eq("sa_id", profile?.id)
      .order("date", { ascending: false })
      .limit(10);
    
    if (!error) setHistory(data || []);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setIsLoading(true);
    try {
      const { error } = await supabase.from("waqaf_member_entries").upsert([{
        date: formData.date,
        waqaf_amount: formData.waqaf,
        member_count: parseInt(formData.member || "0"),
        sa_id: profile?.id
      }], { onConflict: 'sa_id,date' });

      if (error) throw error;
      
      alert("Data berhasil disimpan!");
      setFormData(prev => ({ ...prev, waqaf: 0, member: "" }));
      fetchHistory();
    } catch (error) {
      alert("Gagal simpan data: " + (error as any).message);
    } finally {
      setIsLoading(false);
    }
  }

  async function handleDelete(id: string) {
    if (!confirm("Hapus data ini?")) return;
    try {
      const { error } = await supabase.from("waqaf_member_entries").delete().eq("id", id);
      if (error) throw error;
      fetchHistory();
    } catch (error) {
      alert("Gagal hapus: " + (error as any).message);
    }
  }

  return (
    <>
      <PageMeta title="Waqaf & Member | Gramedia Tracker" description="Input harian waqaf dan member baru" />
      
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <div className="rounded-2xl border border-gray-200 bg-white p-6 dark:border-white/[0.05] dark:bg-white/[0.03]">
          <h2 className="mb-6 text-lg font-bold text-gray-900 dark:text-white">Input Waqaf & Member</h2>
          <form onSubmit={handleSubmit} className="space-y-4">
            <InputField
              label="Tanggal"
              type="date"
              value={formData.date}
              onChange={(e) => setFormData({ ...formData, date: e.target.value })}
              required
            />
            <CurrencyInput
              label="Nominal Waqaf"
              value={formData.waqaf}
              onChange={(val) => setFormData({ ...formData, waqaf: val })}
              required
            />
            <InputField
              label="Jumlah Member Baru"
              type="number"
              value={formData.member}
              onChange={(e) => setFormData({ ...formData, member: e.target.value })}
              required
            />
            <Button type="submit" disabled={isLoading} className="w-full">
              {isLoading ? "Menyimpan..." : "Simpan Data"}
            </Button>
          </form>
        </div>

        <div className="rounded-2xl border border-gray-200 bg-white p-6 dark:border-white/[0.05] dark:bg-white/[0.03]">
          <h2 className="mb-6 text-lg font-bold text-gray-900 dark:text-white">Riwayat Terakhir</h2>
          <Table>
            <TableHeader>
              <TableRow>
                <TableCell isHeader className="px-4 py-3 text-theme-xs">Tanggal</TableCell>
                <TableCell isHeader className="px-4 py-3 text-theme-xs">Waqaf</TableCell>
                <TableCell isHeader className="px-4 py-3 text-theme-xs">Member</TableCell>
                <TableCell isHeader className="px-4 py-3 text-end text-theme-xs">Aksi</TableCell>
              </TableRow>
            </TableHeader>
            <TableBody>
              {history.map(item => (
                <TableRow key={item.id}>
                  <TableCell className="px-4 py-3 text-sm">{item.date}</TableCell>
                  <TableCell className="px-4 py-3 text-sm">Rp {item.waqaf_amount.toLocaleString()}</TableCell>
                  <TableCell className="px-4 py-3 text-sm">{item.member_count}</TableCell>
                  <TableCell className="px-4 py-3 text-end">
                    <button 
                      onClick={() => handleDelete(item.id)}
                      className="text-gray-400 hover:text-error-500 transition-colors"
                    >
                      <TrashBinIcon className="size-4" />
                    </button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </div>
    </>
  );
}
