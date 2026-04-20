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
  categories: string[];
  registration_deadline: string;
  is_active: boolean;
  created_at: string;
}

export default function ManageEvents() {
  const [events, setEvents] = useState<Event[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  
  // Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingEvent, setEditingEvent] = useState<Event | null>(null);
  
  // Form State
  const [formData, setFormData] = useState({
    name: "",
    description: "",
    categories_text: "",
    registration_deadline: ""
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
        .order("registration_deadline", { ascending: false });
      
      if (error) throw error;
      setEvents(data || []);
    } catch (error) {
      console.error("Error fetching events:", error);
    } finally {
      setIsLoading(false);
    }
  }

  const openAddModal = () => {
    setEditingEvent(null);
    setFormData({
      name: "",
      description: "",
      categories_text: "",
      registration_deadline: new Date().toISOString().split('T')[0]
    });
    setIsModalOpen(true);
  };

  const openEditModal = (event: Event) => {
    setEditingEvent(event);
    setFormData({
      name: event.name,
      description: event.description || "",
      categories_text: (event.categories || []).join(", "),
      registration_deadline: new Date(event.registration_deadline).toISOString().split('T')[0]
    });
    setIsModalOpen(true);
  };

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    try {
      const categories = formData.categories_text
        .split(",")
        .map(c => c.trim())
        .filter(c => c !== "");

      const payload = {
        name: formData.name,
        description: formData.description,
        categories: categories,
        registration_deadline: formData.registration_deadline,
      };

      let error;
      if (editingEvent) {
        const { error: err } = await supabase
          .from("events")
          .update(payload)
          .eq("id", editingEvent.id);
        error = err;
      } else {
        const { error: err } = await supabase
          .from("events")
          .insert([payload]);
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
    if (!confirm(`Hapus event "${name}"? Semua data pendaftaran dan target akan ikut terhapus.`)) return;
    
    try {
      const { error } = await supabase.from("events").delete().eq("id", id);
      if (error) throw error;
      fetchEvents();
    } catch (error) {
      alert("Gagal menghapus event: " + (error as any).message);
    }
  }

  async function toggleStatus(event: Event) {
    try {
      const { error } = await supabase
        .from("events")
        .update({ is_active: !event.is_active })
        .eq("id", event.id);
      
      if (error) throw error;
      fetchEvents();
    } catch (error) {
      alert("Gagal update status: " + (error as any).message);
    }
  }

  return (
    <>
      <PageMeta title="Kelola Event | Gramedia Tracker" description="Manajemen event dan pendaftaran" />
      
      <div className="flex flex-col gap-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Daftar Event</h1>
            <p className="text-sm text-gray-500">Kelola event promosi dan pendaftaran lomba.</p>
          </div>
          <Button onClick={openAddModal} size="sm" startIcon={<PlusIcon />}>
            Tambah Event
          </Button>
        </div>

        <div className="overflow-hidden rounded-xl border border-gray-200 bg-white dark:border-white/[0.05] dark:bg-white/[0.03]">
          <div className="max-w-full overflow-x-auto">
            <Table>
              <TableHeader className="border-b border-gray-100 dark:border-white/[0.05]">
                <TableRow>
                  <TableCell isHeader className="px-5 py-3 text-start">Nama Event</TableCell>
                  <TableCell isHeader className="px-5 py-3 text-start">Deadline</TableCell>
                  <TableCell isHeader className="px-5 py-3 text-start">Kategori</TableCell>
                  <TableCell isHeader className="px-5 py-3 text-start">Status</TableCell>
                  <TableCell isHeader className="px-5 py-3 text-end">Aksi</TableCell>
                </TableRow>
              </TableHeader>
              <TableBody className="divide-y divide-gray-100 dark:divide-white/[0.05]">
                {isLoading ? (
                  <TableRow>
                    <TableCell colSpan={5} className="text-center py-10 text-gray-400">Memuat data...</TableCell>
                  </TableRow>
                ) : events.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={5} className="text-center py-10 text-gray-400 font-medium">Belum ada event.</TableCell>
                  </TableRow>
                ) : (
                  events.map((event) => (
                    <TableRow key={event.id}>
                      <TableCell className="px-5 py-4 font-medium text-gray-900 dark:text-white/90">
                        {event.name}
                      </TableCell>
                      <TableCell className="px-5 py-4 text-gray-500">
                        {new Date(event.registration_deadline).toLocaleDateString('id-ID', { 
                          day: 'numeric', month: 'short', year: 'numeric' 
                        })}
                      </TableCell>
                      <TableCell className="px-5 py-4">
                        <div className="flex flex-wrap gap-1">
                          {event.categories?.map(cat => (
                            <Badge key={cat} size="xs" color="primary">{cat}</Badge>
                          ))}
                        </div>
                      </TableCell>
                      <TableCell className="px-5 py-4">
                        <button onClick={() => toggleStatus(event)}>
                          <Badge size="sm" color={event.is_active ? "success" : "error"}>
                            {event.is_active ? "Aktif" : "Selesai"}
                          </Badge>
                        </button>
                      </TableCell>
                      <TableCell className="px-5 py-4 text-end">
                        <div className="flex justify-end gap-2">
                           <button onClick={() => openEditModal(event)} className="text-gray-500 hover:text-brand-500"><PencilIcon className="size-5" /></button>
                           <button onClick={() => handleDelete(event.id, event.name)} className="text-gray-500 hover:text-error-500"><TrashBinIcon className="size-5" /></button>
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

      <Modal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} className="max-w-[600px] p-8">
        <h2 className="mb-6 text-lg font-bold text-gray-900 dark:text-white">
          {editingEvent ? "Ubah Event" : "Tambah Event Baru"}
        </h2>
        <form onSubmit={handleSubmit} className="space-y-4">
          <InputField
            label="Nama Event"
            placeholder="Contoh: Lomba Mewarnai Gramedia"
            value={formData.name}
            onChange={(e) => setFormData({ ...formData, name: e.target.value })}
            required
          />
          
          <div className="space-y-2">
            <label className="text-sm font-medium text-gray-700 dark:text-gray-400">Detail Event</label>
            <textarea
              className="w-full p-3 text-sm border border-gray-300 rounded-lg focus:border-brand-500 outline-none dark:bg-gray-900 dark:border-gray-800 dark:text-white/90"
              rows={3}
              placeholder="Deskripsi singkat event..."
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
            />
          </div>

          <InputField
            label="Deadline Pendaftaran"
            type="date"
            value={formData.registration_deadline}
            onChange={(e) => setFormData({ ...formData, registration_deadline: e.target.value })}
            required
          />

          <div className="space-y-2">
            <label className="text-sm font-medium text-gray-700 dark:text-gray-400">Kategori (Pisahkan dengan koma)</label>
            <textarea
              className="w-full p-3 text-sm border border-gray-300 rounded-lg focus:border-brand-500 outline-none dark:bg-gray-900 dark:border-gray-800 dark:text-white/90"
              rows={2}
              placeholder="Contoh: Pra-TK, TK, Kelas 1-3 SD"
              value={formData.categories_text}
              onChange={(e) => setFormData({ ...formData, categories_text: e.target.value })}
              required
            />
          </div>

          <div className="flex justify-end gap-3 mt-6">
            <Button variant="outline" onClick={() => setIsModalOpen(false)}>Batal</Button>
            <Button type="submit">Simpan</Button>
          </div>
        </form>
      </Modal>
    </>
  );
}
