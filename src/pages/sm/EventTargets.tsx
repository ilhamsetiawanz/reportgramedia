import { useEffect, useState } from "react";
import { supabase } from "../../lib/supabase";
import PageMeta from "../../components/common/PageMeta";
import { Table, TableBody, TableCell, TableHeader, TableRow } from "../../components/ui/table";
import { Modal } from "../../components/ui/modal";
import InputField from "../../components/form/input/InputField";
import Button from "../../components/ui/button/Button";
import { PlusIcon, PencilIcon, TrashBinIcon } from "../../icons";
import Badge from "../../components/ui/badge/Badge";

interface Event {
  id: string;
  name: string;
  target_type: 'peserta' | 'nominal';
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
  const [editingTarget, setEditingTarget] = useState<EventTarget | null>(null);

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
    const { data: evData } = await supabase.from("events").select("id, name, target_type").eq("is_active", true);
    setEvents(evData || []);
    if (evData && evData.length > 0) setSelectedEventId(evData[0].id);

    const { data: userData } = await supabase.from("users").select("id, full_name, role").in("role", ["store_associate", "counter"]).eq("is_approved", true);
    setUsers(userData || []);
    setIsLoading(false);
  }

  async function fetchTargets() {
    if (targets.length === 0) setIsLoading(true);
    const { data } = await supabase.from("event_targets").select("*").eq("event_id", selectedEventId);
    setTargets(data || []);
    setIsLoading(false);
  }

  const selectedEvent = events.find(e => e.id === selectedEventId);

  const openAddModal = () => {
    setEditingTarget(null);
    setFormData({ sa_id: "", value: "" });
    setIsModalOpen(true);
  };

  const openEditModal = (target: EventTarget) => {
    setEditingTarget(target);
    setFormData({
      sa_id: target.sa_id,
      value: (target.target_type === 'nominal' ? target.target_amount : target.target_count).toString()
    });
    setIsModalOpen(true);
  };

  async function handleSave() {
    if (!selectedEvent) return;
    if (!formData.sa_id || !formData.value) {
      alert("Harap isi semua kolom.");
      return;
    }

    try {
      const payload = {
        event_id: selectedEventId,
        sa_id: formData.sa_id,
        target_type: selectedEvent.target_type,
        target_count: selectedEvent.target_type === 'peserta' ? parseInt(formData.value) || 0 : 0,
        target_amount: selectedEvent.target_type === 'nominal' ? parseFloat(formData.value) || 0 : 0
      };

      const { error } = await supabase.from("event_targets").upsert([payload], { onConflict: 'event_id, sa_id' });
      if (error) throw error;

      setIsModalOpen(false);
      fetchTargets();
    } catch (error) {
      alert("Gagal simpan: " + (error as any).message);
    }
  }

  async function handleDelete(id: string) {
    if (!confirm("Hapus plotting target untuk staff ini?")) return;
    try {
      const { error } = await supabase.from("event_targets").delete().eq("id", id);
      if (error) throw error;
      fetchTargets();
    } catch (error) {
      alert("Gagal hapus: " + (error as any).message);
    }
  }

  return (
    <>
      <PageMeta title="Set Target Event | Gramedia" description="Manajemen plotting target staff untuk event toko." />

      <div className="flex flex-col gap-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-xl font-black text-gray-900 dark:text-white uppercase tracking-tight">Plotting Target Staff</h1>
            <div className="flex items-center gap-2 mt-1">
              <Badge size="xs" color="primary" className="font-black">MODE TARGET:</Badge>
              <span className="text-[10px] font-black text-brand-600 uppercase tracking-widest">
                {selectedEvent?.target_type === 'nominal' ? 'BERBASIS NOMINAL (RUPIAH)' : 'BERBASIS JUMLAH PESERTA'}
              </span>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <select className="h-10 px-4 border border-gray-300 rounded-lg text-[11px] font-black uppercase outline-none bg-white dark:bg-gray-900 min-w-[200px]" value={selectedEventId} onChange={(e) => setSelectedEventId(e.target.value)}>
              {events.map(ev => (<option key={ev.id} value={ev.id}>{ev.name}</option>))}
            </select>
            <Button size="sm" onClick={openAddModal} startIcon={<PlusIcon />} className="h-10 font-black uppercase text-[10px] tracking-widest">Tambah Plot</Button>
          </div>
        </div>

        <div className="rounded-2xl border border-gray-200 bg-white dark:border-white/[0.05] dark:bg-white/[0.03] overflow-hidden shadow-sm">
          <Table>
            <TableHeader className="bg-gray-50/50 dark:bg-white/[0.02]">
              <TableRow>
                <TableCell isHeader className="px-5 py-4 text-[10px] font-black uppercase tracking-wider text-gray-500">Nama Lengkap SOA/Counter</TableCell>
                <TableCell isHeader className="px-5 py-4 text-[10px] font-black uppercase tracking-wider text-gray-500">Posisi</TableCell>
                <TableCell isHeader className="px-5 py-4 text-end text-[10px] font-black uppercase tracking-wider text-gray-500">Target Realisasi</TableCell>
                <TableCell isHeader className="px-5 py-4 text-end text-[10px] font-black uppercase tracking-wider text-gray-500">Aksi</TableCell>
              </TableRow>
            </TableHeader>
            <TableBody className="divide-y divide-gray-100 dark:divide-white/[0.05]">
              {isLoading ? (
                <TableRow><TableCell colSpan={4} className="text-center py-12 text-[10px] font-black text-gray-400 uppercase tracking-widest">Sedang memuat data...</TableCell></TableRow>
              ) : targets.length === 0 ? (
                <TableRow><TableCell colSpan={4} className="text-center py-12 text-xs font-medium text-gray-400 italic">Belum ada SOA atau Counter yang diplot untuk event ini.</TableCell></TableRow>
              ) : (
                targets.map(t => {
                  const user = users.find(u => u.id === t.sa_id);
                  return (
                    <TableRow key={t.id} className="hover:bg-gray-50/30 transition-colors">
                      <TableCell className="px-5 py-4">
                        <div className="text-xs font-black text-gray-900 dark:text-white uppercase">{user?.full_name || "Unknown User"}</div>
                      </TableCell>
                      <TableCell className="px-5 py-4">
                        <Badge size="xs" color="primary" className="font-bold">{user?.role?.replace('_', ' ')}</Badge>
                      </TableCell>
                      <TableCell className="px-5 py-4 text-end">
                        <span className="text-xs font-black text-brand-600">
                          {t.target_type === 'nominal' ? `Rp ${t.target_amount?.toLocaleString()}` : `${t.target_count} Orang`}
                        </span>
                      </TableCell>
                      <TableCell className="px-5 py-4">
                        <div className="flex justify-end gap-3">
                          <button onClick={() => openEditModal(t)} className="text-gray-400 hover:text-brand-500 transition-colors" title="Edit Target">
                            <PencilIcon className="size-4" />
                          </button>
                          <button onClick={() => handleDelete(t.id)} className="text-gray-400 hover:text-error-500 transition-colors" title="Hapus Plot">
                            <TrashBinIcon className="size-4" />
                          </button>
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

      <Modal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} className="max-w-[400px] w-full p-0 overflow-hidden">
        <div className="p-5 border-b border-gray-100 dark:border-white/[0.05] bg-gray-50/50">
          <h2 className="text-sm font-black text-gray-900 dark:text-white uppercase tracking-tight">
            {editingTarget ? "Ubah Target Staff" : "Plotting Target Baru"}
          </h2>
        </div>
        <div className="p-6 space-y-5">
          <div className="bg-brand-50/50 p-4 rounded-xl border border-brand-100/50">
            <p className="text-[9px] font-black text-brand-500 uppercase tracking-[0.2em] mb-1">Konfigurasi Aktif</p>
            <p className="text-[11px] font-bold text-gray-700">Event ini mewajibkan target dalam bentuk: <span className="text-brand-600 underline decoration-2">{selectedEvent?.target_type?.toUpperCase()}</span></p>
          </div>

          <div className="space-y-1.5">
            <label className="text-[10px] font-black text-gray-500 uppercase tracking-widest">Pilih Nama Staff</label>
            <select
              className="w-full h-11 px-3 border border-gray-300 rounded-xl text-xs font-bold bg-white dark:bg-gray-900 focus:ring-2 focus:ring-brand-500 outline-none transition-all disabled:opacity-50 disabled:bg-gray-50"
              value={formData.sa_id}
              onChange={(e) => setFormData({ ...formData, sa_id: e.target.value })}
              disabled={!!editingTarget}
            >
              <option value="">-- Cari Nama Staff --</option>
              {users.map(u => (<option key={u.id} value={u.id}>{u.full_name} ({u.role})</option>))}
            </select>
            {editingTarget && <p className="text-[9px] text-gray-400 italic mt-1">* Nama staff tidak dapat diubah saat mode edit.</p>}
          </div>

          <InputField
            label={selectedEvent?.target_type === 'peserta' ? "Target Jumlah Orang" : "Target Nominal (Rp)"}
            type="number"
            placeholder={selectedEvent?.target_type === 'peserta' ? "Contoh: 50" : "Contoh: 1000000"}
            value={formData.value}
            onChange={(e) => setFormData({ ...formData, value: e.target.value })}
          />

          <div className="flex justify-end gap-3 pt-4">
            <Button variant="outline" size="sm" onClick={() => setIsModalOpen(false)} className="px-6 font-black uppercase text-[10px]">Batal</Button>
            <Button size="sm" onClick={handleSave} className="px-8 font-black uppercase text-[10px] tracking-widest">
              {editingTarget ? "Simpan Perubahan" : "Plot Target"}
            </Button>
          </div>
        </div>
      </Modal>
    </>
  );
}
