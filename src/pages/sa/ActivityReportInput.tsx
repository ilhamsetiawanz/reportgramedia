import React, { useEffect, useState } from "react";
import { supabase } from "../../lib/supabase";
import { useAuthStore } from "../../store/useAuthStore";
import PageMeta from "../../components/common/PageMeta";
import Button from "../../components/ui/button/Button";
import Badge from "../../components/ui/badge/Badge";

export default function ActivityReportInput() {
  const { profile } = useAuthStore();
  const [note, setNote] = useState("");
  const [date, setDate] = useState(new Date().toISOString().split("T")[0]);
  const [isLoading, setIsLoading] = useState(false);
  const [isLocked, setIsLocked] = useState(false);
  const [history, setHistory] = useState<{ date: string; notes: string; is_locked: boolean }[]>([]);

  useEffect(() => {
    if (profile) {
      fetchHistory();
      checkLockStatus();
    }
  }, [profile, date]);

  async function checkLockStatus() {
    // 1. Check if date is in the past
    // Note: In a real app, this should compare against server time
    const today = new Date().toISOString().split("T")[0];
    const isPastDate = date < today;

    if (isPastDate) {
      // Check if it's already in DB and what is the lock status
      const { data } = await supabase
        .from("daily_activity_reports")
        .select("is_locked, unlocked_by_spv")
        .eq("sa_id", profile?.id)
        .eq("report_date", date)
        .single();
      
      // If no data yet in past date, it's locked by default
      // If skip_lock is false, it's locked
      if (!data) {
        setIsLocked(true);
      } else {
        setIsLocked(data.is_locked && !data.unlocked_by_spv);
      }
    } else {
      setIsLocked(false);
    }
  }

  async function fetchHistory() {
    const { data } = await supabase
      .from("daily_activity_reports")
      .select("report_date, activity_notes, is_locked")
      .eq("sa_id", profile?.id)
      .order("report_date", { ascending: false })
      .limit(5);
    
    if (data) setHistory(data.map(d => ({ date: d.report_date, notes: d.activity_notes, is_locked: d.is_locked })));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (isLocked) {
      alert("Laporan untuk tanggal ini sudah terkunci. Hubungi SPV untuk membuka kunci.");
      return;
    }

    setIsLoading(true);
    try {
      // Auto-lock logic for future: if person inserts today, is_locked = false
      // But if it's past, stay as is.
      const { error } = await supabase.from("daily_activity_reports").upsert([{
        report_date: date,
        activity_notes: note,
        sa_id: profile?.id,
        is_locked: false // When saving/updating while unlocked, keep it false
      }], { onConflict: 'sa_id,report_date' });

      if (error) throw error;
      alert("Laporan disimpan!");
      fetchHistory();
    } catch (error) {
      alert("Gagal simpan: " + (error as any).message);
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <>
      <PageMeta title="Laporan Kegiatan | Gramedia Tracker" description="Catatan kegiatan harian SA" />
      
      <div className="max-w-3xl space-y-6">
        <div className="rounded-2xl border border-gray-200 bg-white p-6 dark:border-white/[0.05] dark:bg-white/[0.03]">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-lg font-bold text-gray-900 dark:text-white">Catatan Kegiatan Harian</h2>
            {isLocked && (
              <Badge color="error" size="sm">Terkunci</Badge>
            )}
          </div>
          
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium mb-1 text-gray-700 dark:text-gray-400">Tanggal</label>
              <input 
                type="date" 
                className={`w-full h-11 px-4 border border-gray-300 rounded-lg outline-none focus:border-brand-500 dark:bg-gray-900 dark:border-gray-800 dark:text-gray-400 ${isLocked ? 'bg-gray-100 opacity-60' : ''}`}
                value={date}
                onChange={(e) => setDate(e.target.value)}
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1 text-gray-700 dark:text-gray-400">Catatan Kegiatan</label>
              <textarea 
                className={`w-full p-4 border border-gray-300 rounded-lg min-h-[150px] outline-none focus:border-brand-500 dark:bg-gray-900 dark:border-gray-800 dark:text-gray-400 ${isLocked ? 'bg-gray-100 opacity-60' : ''}`}
                placeholder={isLocked ? "Laporan telah terkunci..." : "Tuliskan apa saja yang Anda kerjakan hari ini..."}
                value={note}
                onChange={(e) => setNote(e.target.value)}
                required
                disabled={isLocked}
              />
            </div>
            
            {isLocked ? (
               <div className="p-4 bg-orange-50 border border-orange-100 rounded-lg text-orange-700 text-sm italic">
                  Laporan untuk tanggal ini telah terkunci otomatis. Jika Anda ingin mengedit atau menginput ulang, silakan minta Supervisor untuk **Membuka Kunci** laporan ini.
               </div>
            ) : (
              <Button type="submit" disabled={isLoading} className="w-full">
                {isLoading ? "Menyimpan..." : "Simpan Laporan"}
              </Button>
            )}
          </form>
        </div>

        <div className="space-y-4">
          <h3 className="font-bold text-gray-900 dark:text-white">Laporan Terakhir</h3>
          {history.length === 0 ? (
            <p className="text-gray-500 text-sm">Belum ada laporan kegiatan.</p>
          ) : (
            history.map((h, i) => (
              <div key={i} className="p-4 bg-gray-50 dark:bg-gray-900 rounded-xl border border-gray-100 dark:border-gray-800">
                <div className="flex justify-between items-center mb-1">
                   <div className="text-xs font-bold text-brand-600">{h.date}</div>
                   {h.is_locked && <span className="text-[10px] text-gray-400 italic">Terkunci</span>}
                </div>
                <div className="text-sm text-gray-600 dark:text-gray-400 whitespace-pre-wrap">{h.notes}</div>
              </div>
            ))
          )}
        </div>
      </div>
    </>
  );
}
