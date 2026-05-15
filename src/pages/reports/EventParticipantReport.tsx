import { useEffect, useState } from "react";
import { supabase } from "../../lib/supabase";
import PageMeta from "../../components/common/PageMeta";
import { Table, TableBody, TableCell, TableHeader, TableRow } from "../../components/ui/table";
import Button from "../../components/ui/button/Button";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

interface Event {
  id: string;
  name: string;
  description?: string;
  max_participants?: number;
}

interface RegistrationRecord {
  id: string;
  full_name: string;
  gender: string;
  dob: string;
  phone_number: string;
  category_selected: string;
  payment_amount: number;
  created_at: string;
  registered_by_name: string;
}

interface TargetRealization {
  user_id: string;
  name: string;
  role: string;
  target_type: 'peserta' | 'nominal';
  target: number;
  realization: number;
}

export default function EventParticipantReport() {
  const [events, setEvents] = useState<Event[]>([]);
  const [selectedEventId, setSelectedEventId] = useState<string>("");
  const [selectedEvent, setSelectedEvent] = useState<Event | null>(null);
  
  const [participants, setParticipants] = useState<RegistrationRecord[]>([]);
  const [targetData, setTargetData] = useState<TargetRealization[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    fetchEvents();
  }, []);

  useEffect(() => {
    if (selectedEventId) {
      const ev = events.find(e => e.id === selectedEventId);
      setSelectedEvent(ev || null);
      fetchReportData();
    }
  }, [selectedEventId, events]);

  async function fetchEvents() {
    const { data } = await supabase
      .from("events")
      .select("id, name, description, max_participants")
      .order("created_at", { ascending: false });
    
    setEvents(data || []);
    if (data && data.length > 0) setSelectedEventId(data[0].id);
  }

  async function fetchReportData() {
    if (!selectedEventId) return;
    setIsLoading(true);
    try {
      const { data: regData } = await supabase
        .from("event_registrations")
        .select(`*, users:registered_by(full_name)`)
        .eq("event_id", selectedEventId)
        .order("created_at", { ascending: false });

      const formattedReg: RegistrationRecord[] = (regData || []).map(r => ({
        ...r,
        registered_by_name: (r.users as any)?.full_name || "Unknown"
      }));
      setParticipants(formattedReg);

      const { data: usersData } = await supabase
        .from("users")
        .select("id, full_name, role")
        .in("role", ["store_associate", "counter"])
        .eq("is_approved", true);

      const { data: targetsData } = await supabase
        .from("event_targets")
        .select("*")
        .eq("event_id", selectedEventId);

      // Realization maps
      const countRealization: Record<string, number> = {};
      const amountRealization: Record<string, number> = {};
      
      formattedReg.forEach(r => {
        const uid = (r as any).registered_by;
        if (uid) {
          countRealization[uid] = (countRealization[uid] || 0) + 1;
          amountRealization[uid] = (amountRealization[uid] || 0) + (r.payment_amount || 0);
        }
      });

      const combined: TargetRealization[] = (usersData || []).map(u => {
        const targetObj = targetsData?.find(t => t.sa_id === u.id);
        const type = targetObj?.target_type || 'peserta';
        return {
          user_id: u.id,
          name: u.full_name,
          role: u.role === 'counter' ? 'Counter' : 'SA',
          target_type: type,
          target: type === 'nominal' ? (targetObj?.target_amount || 0) : (targetObj?.target_count || 0),
          realization: type === 'nominal' ? (amountRealization[u.id] || 0) : (countRealization[u.id] || 0)
        };
      }).filter(item => item.target > 0 || item.realization > 0);

      setTargetData(combined);
    } catch (error) {
      console.error("Error:", error);
    } finally {
      setIsLoading(false);
    }
  }

  const exportPDF = () => {
    const doc = new jsPDF('p', 'mm', 'a4');
    const eventName = selectedEvent?.name || "Event";
    doc.setFontSize(14);
    doc.text(`LAPORAN EVENT: ${eventName.toUpperCase()}`, 14, 15);
    
    const regColumn = ["Nama Peserta", "JK", "Kategori", "Nominal", "Pendaftar"];
    const regRows = participants.map(p => [p.full_name, p.gender === 'Laki-laki' ? 'L' : 'P', p.category_selected, `Rp ${p.payment_amount?.toLocaleString()}`, p.registered_by_name]);
    autoTable(doc, { head: [regColumn], body: regRows, startY: 28, theme: 'grid', headStyles: { fillColor: [43, 86, 179] }, styles: { fontSize: 8 } });

    const lastY = (doc as any).lastAutoTable.finalY + 10;
    doc.setFontSize(11);
    doc.text("PENCAPAIAN TARGET", 14, lastY);
    const targetColumn = ["Nama", "Tipe", "Target", "Realisasi", "%"];
    const targetRows = targetData.map(t => [
      t.name, t.target_type.toUpperCase(), 
      t.target_type === 'nominal' ? `Rp ${t.target?.toLocaleString()}` : `${t.target}`,
      t.target_type === 'nominal' ? `Rp ${t.realization?.toLocaleString()}` : `${t.realization}`,
      `${Math.round((t.realization / (t.target || 1)) * 100)}%`
    ]);
    autoTable(doc, { head: [targetColumn], body: targetRows, startY: lastY + 5, theme: 'grid', headStyles: { fillColor: [16, 185, 129] }, styles: { fontSize: 8 } });

    doc.save(`Laporan_Event_${eventName.replace(/\s/g, '_')}.pdf`);
  };

  return (
    <>
      <PageMeta title="Laporan Event | Gramedia Tracker" description="Rekap pendaftaran dan pencapaian target nominal/peserta." />
      
      <div className="flex flex-col gap-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-xl font-black text-gray-900 dark:text-white uppercase tracking-tight">Laporan Event</h1>
            <p className="text-[11px] text-gray-500 font-bold uppercase">Monitoring pendaftaran & nominal.</p>
          </div>
          <div className="flex items-center gap-3">
             <select className="h-10 px-4 border border-gray-300 rounded-lg dark:bg-gray-900 outline-none min-w-[250px] font-black text-xs uppercase" value={selectedEventId} onChange={(e) => setSelectedEventId(e.target.value)}>
               {events.map(ev => (<option key={ev.id} value={ev.id}>{ev.name}</option>))}
             </select>
             <Button variant="outline" size="sm" onClick={exportPDF} disabled={participants.length === 0} className="h-10 px-5 text-xs font-black uppercase">Export PDF</Button>
          </div>
        </div>

        {selectedEvent && (
          <div className="rounded-xl border border-brand-500/10 bg-brand-50/30 p-5 dark:bg-brand-500/5">
            <div className="flex flex-col md:flex-row justify-between gap-4 items-start">
               <div className="space-y-1">
                  <h2 className="text-lg font-black text-brand-600 uppercase tracking-tight">{selectedEvent.name}</h2>
                  <p className="text-[11px] text-gray-600 dark:text-gray-400 font-medium">{selectedEvent.description || "Tanpa deskripsi."}</p>
               </div>
               <div className="bg-white dark:bg-gray-800 p-3 rounded-lg shadow-sm border border-gray-100 dark:border-gray-700 min-w-[160px] text-center">
                  <p className="text-[9px] uppercase font-black text-gray-400 mb-1">Total Peserta</p>
                  <p className="text-xl font-black text-gray-900 dark:text-white">{participants.length}</p>
                  <p className="text-[9px] uppercase font-black text-brand-600 mt-1">Rp {participants.reduce((s, p) => s + (p.payment_amount || 0), 0).toLocaleString()}</p>
               </div>
            </div>
          </div>
        )}

        <div className="space-y-3">
          <h2 className="text-xs font-black text-gray-400 uppercase tracking-[0.2em] flex items-center gap-2">
             <span className="size-1.5 rounded-full bg-brand-500"></span>
             Daftar Detail Peserta
          </h2>
          <div className="rounded-xl border border-gray-200 bg-white dark:bg-white/[0.03] overflow-hidden shadow-sm">
            <div className="max-w-full overflow-x-auto">
              <Table>
                <TableHeader className="bg-gray-50/50 dark:bg-white/[0.02]">
                  <TableRow>
                    <TableCell isHeader className="px-5 py-3 text-[10px] font-black uppercase">Nama Peserta</TableCell>
                    <TableCell isHeader className="px-5 py-3 text-[10px] font-black uppercase text-end">Nominal</TableCell>
                    <TableCell isHeader className="px-5 py-3 text-[10px] font-black uppercase">Pendaftar</TableCell>
                    <TableCell isHeader className="px-5 py-3 text-end text-[10px] font-black uppercase">Tanggal</TableCell>
                  </TableRow>
                </TableHeader>
                <TableBody className="divide-y divide-gray-100 dark:divide-white/[0.05]">
                  {isLoading ? (
                    <TableRow><TableCell colSpan={4} className="text-center py-8 text-xs text-gray-400 font-bold uppercase tracking-widest">Memuat...</TableCell></TableRow>
                  ) : participants.length === 0 ? (
                    <TableRow><TableCell colSpan={4} className="text-center py-8 text-xs text-gray-400 italic">Belum ada peserta.</TableCell></TableRow>
                  ) : (
                    participants.map(p => (
                      <TableRow key={p.id} className="hover:bg-gray-50/30">
                        <TableCell className="px-5 py-3 text-xs font-bold text-gray-900 dark:text-white">{p.full_name}</TableCell>
                        <TableCell className="px-5 py-3 text-end text-[11px] font-black text-brand-600">Rp {p.payment_amount?.toLocaleString()}</TableCell>
                        <TableCell className="px-5 py-3 text-[11px] font-bold text-gray-700">{p.registered_by_name}</TableCell>
                        <TableCell className="px-5 py-3 text-end text-[10px] text-gray-400">{new Date(p.created_at).toLocaleDateString()}</TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>
          </div>
        </div>

        <div className="space-y-3 mt-4">
          <h2 className="text-xs font-black text-gray-400 uppercase tracking-[0.2em] flex items-center gap-2">
             <span className="size-1.5 rounded-full bg-success-500"></span>
             Pencapaian Target
          </h2>
          <div className="rounded-xl border border-gray-200 bg-white dark:bg-white/[0.03] overflow-hidden shadow-sm">
            <div className="max-w-full overflow-x-auto">
              <Table>
                <TableHeader className="bg-gray-50/50 dark:bg-white/[0.02]">
                  <TableRow>
                    <TableCell isHeader className="px-5 py-3 text-[10px] font-black uppercase">Nama</TableCell>
                    <TableCell isHeader className="px-5 py-3 text-[10px] font-black uppercase">Tipe</TableCell>
                    <TableCell isHeader className="px-5 py-3 text-end text-[10px] font-black uppercase">Target</TableCell>
                    <TableCell isHeader className="px-5 py-3 text-end text-[10px] font-black uppercase">Realisasi</TableCell>
                    <TableCell isHeader className="px-5 py-3 text-end text-[10px] font-black uppercase">Progres</TableCell>
                  </TableRow>
                </TableHeader>
                <TableBody className="divide-y divide-gray-100 dark:divide-white/[0.05]">
                  {targetData.length === 0 ? (
                    <TableRow><TableCell colSpan={5} className="text-center py-8 text-xs text-gray-400 italic">Kosong.</TableCell></TableRow>
                  ) : (
                    targetData.map(t => {
                      const percent = Math.min(Math.round((t.realization / (t.target || 1)) * 100), 100);
                      return (
                        <TableRow key={t.user_id}>
                          <TableCell className="px-5 py-3 text-xs font-black text-gray-900 dark:text-white">{t.name}</TableCell>
                          <TableCell className="px-5 py-3 text-[10px] font-bold text-gray-500 uppercase">{t.target_type}</TableCell>
                          <TableCell className="px-5 py-3 text-end text-xs font-bold text-gray-900">
                             {t.target_type === 'nominal' ? `Rp ${t.target?.toLocaleString()}` : `${t.target}`}
                          </TableCell>
                          <TableCell className="px-5 py-3 text-end text-xs font-black text-brand-600">
                             {t.target_type === 'nominal' ? `Rp ${t.realization?.toLocaleString()}` : `${t.realization}`}
                          </TableCell>
                          <TableCell className="px-5 py-3 text-end">
                             <div className="flex items-center justify-end gap-2">
                                <div className="w-12 bg-gray-100 rounded-full h-1.5 dark:bg-gray-800 overflow-hidden">
                                   <div className={`h-1.5 rounded-full ${percent >= 100 ? 'bg-success-500' : 'bg-brand-500'}`} style={{ width: `${percent}%` }}></div>
                                </div>
                                <span className="text-[10px] font-black text-gray-900">{percent}%</span>
                             </div>
                          </TableCell>
                        </TableRow>
                      );
                    })
                  )}
                </TableBody>
              </Table>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
