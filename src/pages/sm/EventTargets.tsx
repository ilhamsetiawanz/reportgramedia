import { useEffect, useState } from "react";
import { supabase } from "../../lib/supabase";
import PageMeta from "../../components/common/PageMeta";
import { Table, TableBody, TableCell, TableHeader, TableRow } from "../../components/ui/table";
import { Modal } from "../../components/ui/modal";
import InputField from "../../components/form/input/InputField";
import Button from "../../components/ui/button/Button";
import { PlusIcon } from "../../icons";
import Badge from "../../components/ui/badge/Badge";

interface Event {
  id: string;
  name: string;
}

interface User {
  id: string;
  full_name: string;
  role: string;
}

interface EventTarget {
  id: string;
  event_id: string;
  sa_id: string;
  target_count: number;
  target_type: 'peserta' | 'nominal';
  target_amount: number;
}

export default function EventTargets() {
  const [events, setEvents] = useState<Event[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [targets, setTargets] = useState<EventTarget[]>([]);
  const [selectedEventId, setSelectedEventId] = useState<string>("");
  const [isLoading, setIsLoading] = useState(true);
  
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [targetTypeInput, setTargetTypeInput] = useState<'peserta' | 'nominal'>('peserta');
  const [formData, setFormData] = useState({
    sa_id: "",
    value: ""
  });

  useEffect(() => {
    fetchInitialData();
  }, []);

  useEffect(() => {
    if (selectedEventId) fetchTargets();
  }, [selectedEventId]);

  async function fetchInitialData() {
    const { data: evData } = await supabase.from("events").select("id, name").eq("is_active", true);
    setEvents(evData || []);
    if (evData && evData.length > 0) setSelectedEventId(evData[0].id);

    const { data: userData } = await supabase.from("users").select("id, full_name, role").in("role", ["store_associate", "counter"]).eq("is_approved", true);
    setUsers(userData || []);
    setIsLoading(false);
  }

  async function fetchTargets() {
    const { data } = await supabase.from("event_targets").select("*").eq("event_id", selectedEventId);
    setTargets(data || []);
  }

  async function handleSave() {
    try {
      const payload = {
        event_id: selectedEventId,
        sa_id: formData.sa_id,
        target_type: targetTypeInput,
        target_count: targetTypeInput === 'peserta' ? parseInt(formData.value) : 0,
        target_amount: targetTypeInput === 'nominal' ? parseFloat(formData.value) : 0
      };

      const { error } = await supabase.from("event_targets").upsert([payload], { onConflict: 'event_id, sa_id' });
      if (error) throw error;
      
      setIsModalOpen(false);
      fetchTargets();
    } catch (error) {
      alert("Gagal simpan: " + (error as any).message);
    }
  }

  return (
    <>
      <PageMeta title="Set Target Event | Gramedia" description="Atur target peserta atau nominal untuk SA/Counter." />
      
      <div className="flex flex-col gap-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-black text-gray-900 dark:text-white uppercase">Set Target Event</h1>
            <p className="text-[11px] text-gray-500 font-bold uppercase">Plotting target per event.</p>
          </div>
          <div className="flex gap-3">
             <select className="h-10 px-3 border border-gray-300 rounded-lg text-xs font-black uppercase outline-none" value={selectedEventId} onChange={(e) => setSelectedEventId(e.target.value)}>
               {events.map(ev => (<option key={ev.id} value={ev.id}>{ev.name}</option>))}
             </select>
             <Button size="sm" onClick={() => setIsModalOpen(true)} startIcon={<PlusIcon />}>Set Target</Button>
          </div>
        </div>

        <div className="rounded-xl border border-gray-200 bg-white dark:bg-white/[0.03] overflow-hidden">
          <Table>
            <TableHeader className="bg-gray-50/50 dark:bg-white/[0.02]">
              <TableRow>
                <TableCell isHeader className="px-5 py-3 text-[10px] font-black uppercase">Nama Staff</TableCell>
                <TableCell isHeader className="px-5 py-3 text-[10px] font-black uppercase">Role</TableCell>
                <TableCell isHeader className="px-5 py-3 text-[10px] font-black uppercase">Tipe Target</TableCell>
                <TableCell isHeader className="px-5 py-3 text-end text-[10px] font-black uppercase">Nilai Target</TableCell>
              </TableRow>
            </TableHeader>
            <TableBody className="divide-y divide-gray-100 dark:divide-white/[0.05]">
              {isLoading ? (
                <TableRow><TableCell colSpan={4} className="text-center py-10 text-xs font-bold text-gray-400">Memuat data...</TableCell></TableRow>
              ) : targets.length === 0 ? (
                <TableRow><TableCell colSpan={4} className="text-center py-10 text-xs italic text-gray-400">Belum ada target diplot.</TableCell></TableRow>
              ) : (
                targets.map(t => {
                  const user = users.find(u => u.id === t.sa_id);
                  return (
                    <TableRow key={t.id}>
                      <TableCell className="px-5 py-3 text-xs font-bold text-gray-900 dark:text-white">{user?.full_name || "Unknown"}</TableCell>
                      <TableCell className="px-5 py-3 text-[10px] font-bold text-gray-400 uppercase">{user?.role}</TableCell>
                      <TableCell className="px-5 py-3">
                        <Badge size="xs" color={t.target_type === 'nominal' ? 'success' : 'primary'}>{t.target_type === 'nominal' ? 'NOMINAL' : 'PESERTA'}</Badge>
                      </TableCell>
                      <TableCell className="px-5 py-3 text-end text-xs font-black text-gray-900">
                        {t.target_type === 'nominal' ? `Rp ${t.target_amount?.toLocaleString()}` : `${t.target_count} Orang`}
                      </TableCell>
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
        </div>
      </div>

      <Modal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} className="max-w-[400px] w-full p-0 overflow-hidden">
         <div className="p-5 border-b border-gray-100 dark:border-white/[0.05]">
            <h2 className="text-sm font-black text-gray-900 dark:text-white uppercase">Set Target Staff</h2>
         </div>
         <div className="p-5 space-y-4">
            <div className="space-y-1">
               <label className="text-[10px] font-black text-gray-500 uppercase">Pilih Staff (SA/Counter)</label>
               <select className="w-full h-10 px-3 border border-gray-300 rounded-lg text-xs font-bold" value={formData.sa_id} onChange={(e) => setFormData({ ...formData, sa_id: e.target.value })}>
                  <option value="">-- Pilih Staff --</option>
                  {users.map(u => (<option key={u.id} value={u.id}>{u.full_name} ({u.role})</option>))}
               </select>
            </div>
            <div className="space-y-1">
               <label className="text-[10px] font-black text-gray-500 uppercase">Tipe Target</label>
               <div className="flex gap-2">
                  <button onClick={() => setTargetTypeInput('peserta')} className={`flex-1 py-2 text-[10px] font-black rounded-lg border transition-all ${targetTypeInput === 'peserta' ? 'bg-brand-500 text-white border-brand-500' : 'bg-white text-gray-500 border-gray-200'}`}>PESERTA</button>
                  <button onClick={() => setTargetTypeInput('nominal')} className={`flex-1 py-2 text-[10px] font-black rounded-lg border transition-all ${targetTypeInput === 'nominal' ? 'bg-success-500 text-white border-success-500' : 'bg-white text-gray-500 border-gray-200'}`}>NOMINAL (RP)</button>
               </div>
            </div>
            <InputField label={targetTypeInput === 'peserta' ? "Jumlah Orang" : "Nominal (Rp)"} type="number" value={formData.value} onChange={(e) => setFormData({ ...formData, value: e.target.value })} />
            
            <div className="flex justify-end gap-3 pt-4">
               <Button variant="outline" size="sm" onClick={() => setIsModalOpen(false)}>Batal</Button>
               <Button size="sm" onClick={handleSave} className="px-6 font-black uppercase">Simpan Target</Button>
            </div>
         </div>
      </Modal>
    </>
  );
}
