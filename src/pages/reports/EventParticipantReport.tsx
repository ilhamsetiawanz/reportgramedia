import { useEffect, useState } from "react";
import { supabase } from "../../lib/supabase";
import PageMeta from "../../components/common/PageMeta";
import { useAuthStore } from "../../store/useAuthStore";
import { Table, TableBody, TableCell, TableHeader, TableRow } from "../../components/ui/table";
import Button from "../../components/ui/button/Button";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

interface Event {
  id: string;
  name: string;
}

interface ParticipantRecord {
  id: string;
  name: string;
  age: number;
  school_class: string;
  address: string;
  phone: string;
  category: string;
  created_at: string;
  sa_name: string;
  spv_name: string;
  counter_name?: string;
}

export default function EventParticipantReport() {
  const { profile } = useAuthStore();
  const [events, setEvents] = useState<Event[]>([]);
  const [selectedEventId, setSelectedEventId] = useState<string>("");
  const [participants, setParticipants] = useState<ParticipantRecord[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    fetchEvents();
  }, []);

  useEffect(() => {
    if (selectedEventId) {
      fetchParticipants();
    }
  }, [selectedEventId]);

  async function fetchEvents() {
    const { data } = await supabase
      .from("events")
      .select("id, name")
      .order("created_at", { ascending: false });
    
    setEvents(data || []);
    if (data && data.length > 0) {
      setSelectedEventId(data[0].id);
    }
  }

  async function fetchParticipants() {
    if (!selectedEventId) return;
    setIsLoading(true);
    try {
      // Fetch participants with joined user info
      let query = supabase
        .from("event_participants")
        .select(`
          *,
          users!event_participants_sa_id_fkey(
            full_name,
            supervisors:supervisor_id(full_name)
          )
        `)
        .eq("event_id", selectedEventId);

      // Role based filtering
      if (profile?.role === "supervisor") {
        // Only show participants registered by SAs assigned to this SPV
        // This is a bit complex in Supabase JS client without a better schema, 
        // but we can filter the results in JS or use a more specific query.
        // For now, let's assume SPV can see all for the event or we fetch based on saIds.
      } else if (profile?.role === "store_associate") {
        query = query.eq("sa_id", profile.id);
      }

      const { data, error } = await query.order("created_at", { ascending: false });
      
      if (error) throw error;

      const formattedData: ParticipantRecord[] = (data || []).map(p => ({
        ...p,
        sa_name: (p.users as any)?.full_name || "Unknown",
        spv_name: (p.users as any)?.supervisors?.full_name || "-"
      }));

      setParticipants(formattedData);
    } catch (error) {
      console.error("Error fetching participants:", error);
    } finally {
      setIsLoading(false);
    }
  }

  const exportPDF = () => {
    const doc = new jsPDF('p', 'mm', 'a4');
    const eventName = events.find(e => e.id === selectedEventId)?.name || "Event";

    doc.setFontSize(16);
    doc.text(`Daftar Peserta ${eventName}`, 14, 15);
    doc.setFontSize(10);
    doc.text(`Dicetak pada: ${new Date().toLocaleString('id-ID')}`, 14, 22);

    const tableColumn = ["Nama", "Umur", "Sekolah", "HP", "Kategori", "Pendaftar (SA / Counter)"];
    const tableRows: any[] = [];

    participants.forEach(p => {
      tableRows.push([
        p.name,
        p.age,
        p.school_class,
        p.phone,
        p.category,
        p.counter_name ? `[Counter] ${p.counter_name}` : p.sa_name
      ]);
    });

    autoTable(doc, {
      head: [tableColumn],
      body: tableRows,
      startY: 28,
      theme: 'grid',
      headStyles: { fillColor: [43, 86, 179] }
    });

    doc.save(`Peserta_${eventName}.pdf`);
  };

  return (
    <>
      <PageMeta title="Laporan Peserta Event | Gramedia Tracker" description="Daftar peserta yang mendaftar event" />
      
      <div className="flex flex-col gap-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Laporan Peserta Event</h1>
            <p className="text-sm text-gray-500">Rekapitulasi seluruh peserta pendaftar event.</p>
          </div>
          <div className="flex items-center gap-3">
             <select 
               className="h-10 px-3 border border-gray-300 rounded-lg dark:bg-gray-900 dark:border-gray-800 outline-none min-w-[200px]"
               value={selectedEventId}
               onChange={(e) => setSelectedEventId(e.target.value)}
             >
               {events.map(ev => (
                 <option key={ev.id} value={ev.id}>{ev.name}</option>
               ))}
             </select>
             <Button variant="outline" size="sm" onClick={exportPDF} disabled={participants.length === 0}>
               Export PDF
             </Button>
          </div>
        </div>

        <div className="rounded-xl border border-gray-200 bg-white p-1 dark:border-white/[0.05] dark:bg-white/[0.03]">
          <Table>
            <TableHeader>
              <TableRow>
                <TableCell isHeader className="px-5 py-4">Nama Peserta</TableCell>
                <TableCell isHeader className="px-5 py-4">Umur</TableCell>
                <TableCell isHeader className="px-5 py-4">Sekolah / Kelas</TableCell>
                <TableCell isHeader className="px-5 py-4">Kategori</TableCell>
                <TableCell isHeader className="px-5 py-4">Telepon</TableCell>
                <TableCell isHeader className="px-5 py-4">Pendaftar (SA / Counter)</TableCell>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow><TableCell colSpan={6} className="text-center py-10">Memuat data...</TableCell></TableRow>
              ) : participants.length === 0 ? (
                <TableRow><TableCell colSpan={6} className="text-center py-10">Belum ada peserta terdaftar.</TableCell></TableRow>
              ) : (
                participants.map(p => (
                  <TableRow key={p.id} className="hover:bg-gray-50/50 dark:hover:bg-white/5 transition-colors">
                    <TableCell className="px-5 py-4 font-bold text-gray-900 dark:text-white/90">{p.name}</TableCell>
                    <TableCell className="px-5 py-4">{p.age} thn</TableCell>
                    <TableCell className="px-5 py-4">{p.school_class}</TableCell>
                    <TableCell className="px-5 py-4">{p.category}</TableCell>
                    <TableCell className="px-5 py-4">{p.phone}</TableCell>
                    <TableCell className="px-5 py-4">
                       <div className="flex flex-col">
                          <span className="font-medium text-brand-600">
                            {p.counter_name ? `[${p.counter_name}]` : p.sa_name}
                          </span>
                          {!p.counter_name && <span className="text-[10px] text-gray-400">SPV: {p.spv_name}</span>}
                       </div>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      </div>
    </>
  );
}
