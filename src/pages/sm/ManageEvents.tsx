import React, { useEffect, useState } from "react";
import { supabase } from "../../lib/supabase";
import PageMeta from "../../components/common/PageMeta";
import { Table, TableBody, TableCell, TableHeader, TableRow } from "../../components/ui/table";
import { Modal } from "../../components/ui/modal";
import InputField from "../../components/form/input/InputField";
import Button from "../../components/ui/button/Button";
import { PlusIcon, TrashBinIcon, PencilIcon } from "../../icons";
import Badge from "../../components/ui/badge/Badge";

interface Event {
  id: string;
  name: string;
  description: string;
  start_date: string;
  end_date: string;
  type: string;
  reg_link: string;
  categories: string;
  max_participants: number;
  is_active: boolean;
  created_at: string;
}

export default function ManageEvents() {
  const [events, setEvents] = useState<Event[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingEvent, setEditingEvent] = useState<Event | null>(null);
  
  const [formData, setFormData] = useState({
    name: "",
    description: "",
    start_date: "",
    end_date: "",
    type: "Offline",
    reg_link: "",
    categories: "",
    max_participants: 0
  });

  useEffect(() => {
    fetchEvents();
  }, []);

  async function fetchEvents() {
    setIsLoading(true);
    try {
      const { data, error } = await supabase
        .from("events")
        .select("*")
        .order("created_at", { ascending: false });
      
      if (error) throw error;
      setEvents(data || []);
    } catch (error) {
      console.error("Error fetching events:", error);
      alert("Gagal memuat event: " + (error as any).message);
    } finally {
      setIsLoading(false);
    }
  }

  const openAddModal = () => {
    setEditingEvent(null);
    const today = new Date().toISOString().split('T')[0];
    setFormData({
      name: "",
      description: "",
      start_date: today,
      end_date: today,
      type: "Offline",
      reg_link: "",
      categories: "",
      max_participants: 0
    });
    setIsModalOpen(true);
  };

  const openEditModal = (event: Event) => {
    setEditingEvent(event);
    setFormData({
      name: event.name,
      description: event.description || "",
      start_date: event.start_date,
      end_date: event.end_date,
      type: event.type,
      reg_link: event.reg_link || "",
      categories: event.categories || "",
      max_participants: event.max_participants || 0
    });
    setIsModalOpen(true);
  };

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    try {
      const payload = {
        name: formData.name,
        description: formData.description,
        start_date: formData.start_date,
        end_date: formData.end_date,
        type: formData.type,
        reg_link: formData.reg_link,
        categories: formData.categories,
        max_participants: formData.max_participants
      };

      let error;
      if (editingEvent) {
        const { error: err } = await supabase.from("events").update(payload).eq("id", editingEvent.id);
        error = err;
      } else {
        const { error: err } = await supabase.from("events").insert([payload]);
        error = err;
      }

      if (error) throw error;
      setIsModalOpen(false);
      fetchEvents();
    } catch (error) {
      alert("Gagal menyimpan event: " + (error as any).message);
    }
  }

  async function handleDelete(id: string, name: string) {
    if (!confirm(`Hapus event "${name}"?`)) return;
    try {
      const { error } = await supabase.from("events").delete().eq("id", id);
      if (error) throw error;
      fetchEvents();
    } catch (error) {
      alert("Gagal menghapus event: " + (error as any).message);
    }
  }

  return (
    <>
      <PageMeta title="Kelola Event | Gramedia Tracker" description="Halaman manajemen event promosi dan lomba toko." />
      
      <div className="flex flex-col gap-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-black text-gray-900 dark:text-white uppercase tracking-tight">Daftar Event</h1>
            <p className="text-xs text-gray-500 font-medium">Manajemen promosi dan pendaftaran lomba.</p>
          </div>
          <Button onClick={openAddModal} size="sm" startIcon={<PlusIcon />}>Tambah</Button>
        </div>

        <div className="overflow-hidden rounded-xl border border-gray-200 bg-white dark:border-white/[0.05] dark:bg-white/[0.03]">
          <Table>
            <TableHeader className="bg-gray-50/50 dark:bg-white/[0.02]">
              <TableRow>
                <TableCell isHeader className="px-5 py-3 text-theme-xs uppercase font-black">Nama Event</TableCell>
                <TableCell isHeader className="px-5 py-3 text-theme-xs uppercase font-black">Kuota</TableCell>
                <TableCell isHeader className="px-5 py-3 text-theme-xs uppercase font-black">Tanggal</TableCell>
                <TableCell isHeader className="px-5 py-3 text-theme-xs uppercase font-black">Jenis</TableCell>
                <TableCell isHeader className="px-5 py-3 text-end text-theme-xs uppercase font-black">Aksi</TableCell>
              </TableRow>
            </TableHeader>
            <TableBody className="divide-y divide-gray-100 dark:divide-white/[0.05]">
              {isLoading ? (
                <TableRow><TableCell colSpan={5} className="text-center py-8 text-gray-400 text-xs">Memuat...</TableCell></TableRow>
              ) : events.length === 0 ? (
                <TableRow><TableCell colSpan={5} className="text-center py-8 text-gray-400 text-xs italic">Kosong.</TableCell></TableRow>
              ) : (
                events.map((event) => (
                  <TableRow key={event.id} className="hover:bg-gray-50/30">
                    <TableCell className="px-5 py-3 text-sm font-bold text-gray-900 dark:text-white/90">{event.name}</TableCell>
                    <TableCell className="px-5 py-3 text-xs font-bold text-gray-600">
                       {event.max_participants > 0 ? `${event.max_participants} Peserta` : "Tanpa Batas"}
                    </TableCell>
                    <TableCell className="px-5 py-3 text-[10px] text-gray-500 font-bold uppercase">{event.start_date} - {event.end_date}</TableCell>
                    <TableCell className="px-5 py-3">
                      <Badge size="xs" color={event.type === 'Offline' ? 'primary' : 'success'}>{event.type}</Badge>
                    </TableCell>
                    <TableCell className="px-5 py-3 text-end">
                      <div className="flex justify-end gap-2">
                         <button onClick={() => openEditModal(event)} className="text-gray-400 hover:text-brand-500"><PencilIcon className="size-4" /></button>
                         <button onClick={() => handleDelete(event.id, event.name)} className="text-gray-400 hover:text-error-500"><TrashBinIcon className="size-4" /></button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      </div>

      <Modal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} className="max-w-[500px] w-full p-0">
        <div className="p-5 border-b border-gray-100 dark:border-white/[0.05]">
          <h2 className="text-lg font-black text-gray-900 dark:text-white uppercase">{editingEvent ? "Edit" : "Tambah"} Event</h2>
        </div>
        
        <form onSubmit={handleSubmit} className="p-5 space-y-4 overflow-y-auto max-h-[70vh]">
          <InputField label="Nama Event" value={formData.name} onChange={(e) => setFormData({ ...formData, name: e.target.value })} required />
          <div className="space-y-1">
            <label className="text-[11px] font-black text-gray-500 uppercase">Deskripsi</label>
            <textarea className="w-full p-3 text-xs border border-gray-300 rounded-lg outline-none dark:bg-gray-900 dark:border-gray-800 font-medium min-h-[80px]" value={formData.description} onChange={(e) => setFormData({ ...formData, description: e.target.value })} />
          </div>
          
          <div className="grid grid-cols-2 gap-4">
            <InputField label="Tgl Mulai" type="date" value={formData.start_date} onChange={(e) => setFormData({ ...formData, start_date: e.target.value })} required />
            <InputField label="Tgl Selesai" type="date" value={formData.end_date} onChange={(e) => setFormData({ ...formData, end_date: e.target.value })} required />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1">
              <label className="text-[11px] font-black text-gray-500 uppercase">Jenis</label>
              <select className="w-full h-10 px-3 border border-gray-300 rounded-lg dark:bg-gray-900 text-xs font-bold" value={formData.type} onChange={(e) => setFormData({ ...formData, type: e.target.value })}>
                <option value="Offline">Offline</option>
                <option value="Online">Online</option>
              </select>
            </div>
            <InputField label="Kuota Maksimal" type="number" value={formData.max_participants} onChange={(e) => setFormData({ ...formData, max_participants: parseInt(e.target.value) || 0 })} />
          </div>

          <InputField label="Link (Jika Ada)" placeholder="https://..." value={formData.reg_link} onChange={(e) => setFormData({ ...formData, reg_link: e.target.value })} />
          <InputField label="Kategori" placeholder="TK, SD, dll" value={formData.categories} onChange={(e) => setFormData({ ...formData, categories: e.target.value })} />

          <div className="flex justify-end gap-3 pt-4">
            <Button variant="outline" size="sm" onClick={() => setIsModalOpen(false)}>Batal</Button>
            <Button type="submit" size="sm" className="px-6 font-black uppercase">Simpan</Button>
          </div>
        </form>
      </Modal>
    </>
  );
}
