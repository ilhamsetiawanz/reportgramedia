import React, { useEffect, useState } from "react";
import { supabase } from "../../lib/supabase";
import PageMeta from "../../components/common/PageMeta";
import { Table, TableBody, TableCell, TableHeader, TableRow } from "../../components/ui/table";
import { Modal } from "../../components/ui/modal";
import InputField from "../../components/form/input/InputField";
import Button from "../../components/ui/button/Button";
import { PlusIcon, TrashBinIcon, PencilIcon } from "../../icons";
import Badge from "../../components/ui/badge/Badge";

interface Counter {
  id: string;
  name: string;
  supervisor_id: string | null;
  is_active: boolean;
  users?: { full_name: string }; // Join relation
}

export default function ManageCounters() {
  const [counters, setCounters] = useState<Counter[]>([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  
  // Form State
  const [newCounter, setNewCounter] = useState({ name: "", supervisor_id: "" });
  const [supervisors, setSupervisors] = useState<{ id: string, full_name: string }[]>([]);
  
  // CRUD State
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [editingCounter, setEditingCounter] = useState<Counter | null>(null);
  const [editForm, setEditForm] = useState({ name: "", supervisor_id: "" });

  useEffect(() => {
    fetchData();
  }, []);

  async function fetchData() {
    setIsLoading(true);
    try {
      // Fetch Counters with Supervisor Info
      const { data: counterData, error: counterError } = await supabase
        .from("counters")
        .select("*, users!supervisor_id(full_name)")
        .order("name");
      
      if (counterError) throw counterError;
      setCounters(counterData || []);

      // Fetch Supervisors for dropdown
      const { data: spvData } = await supabase
        .from("users")
        .select("id, full_name")
        .eq("role", "supervisor")
        .eq("is_approved", true);
      
      setSupervisors(spvData || []);
    } catch (error) {
      console.error("Error fetching data:", error);
    } finally {
      setIsLoading(false);
    }
  }

  async function handleAddCounter(e: React.FormEvent) {
    e.preventDefault();
    try {
      if (!newCounter.name) return alert("Isi nama counter!");

      const { error } = await supabase
        .from("counters")
        .insert([{ 
          name: newCounter.name, 
          supervisor_id: newCounter.supervisor_id || null
        }]);
      
      if (error) throw error;
      
      setNewCounter({ name: "", supervisor_id: "" });
      setIsModalOpen(false);
      fetchData();
    } catch (error) {
      alert("Gagal menambah counter: " + (error as any).message);
    }
  }

  const openEditModal = (counter: Counter) => {
    setEditingCounter(counter);
    setEditForm({ name: counter.name, supervisor_id: counter.supervisor_id || "" });
    setIsEditModalOpen(true);
  };

  async function handleEditCounter(e: React.FormEvent) {
    e.preventDefault();
    if (!editingCounter) return;
    try {
      const { error } = await supabase
        .from("counters")
        .update({ 
          name: editForm.name, 
          supervisor_id: editForm.supervisor_id || null
        })
        .eq("id", editingCounter.id);
      
      if (error) throw error;
      setIsEditModalOpen(false);
      fetchData();
    } catch (error) {
      alert("Gagal mengubah counter: " + (error as any).message);
    }
  }

  async function handleDeleteCounter(id: string, name: string) {
    if (!confirm(`Hapus counter "${name}"?`)) return;
    try {
      const { error } = await supabase.from("counters").delete().eq("id", id);
      if (error) throw error;
      fetchData();
    } catch (error) {
      alert("Gagal menghapus: " + (error as any).message);
    }
  }

  async function toggleStatus(counter: Counter) {
    try {
      const { error } = await supabase
        .from("counters")
        .update({ is_active: !counter.is_active })
        .eq("id", counter.id);
      
      if (error) throw error;
      fetchData();
    } catch (error) {
      alert("Gagal update status: " + (error as any).message);
    }
  }

  return (
    <>
      <PageMeta title="Kelola Counter | Gramedia Tracker" description="Manajemen counter brand dan plotting supervisor" />
      
      <div className="flex flex-col gap-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Daftar Counter</h1>
            <p className="text-gray-500 text-sm">Manajemen brand/counter dan supervisor penanggung jawab.</p>
          </div>
          <Button onClick={() => setIsModalOpen(true)} size="sm" startIcon={<PlusIcon />}>
            Tambah Counter
          </Button>
        </div>

        <div className="overflow-hidden rounded-xl border border-gray-200 bg-white dark:border-white/[0.05] dark:bg-white/[0.03]">
          <div className="max-w-full overflow-x-auto">
            <Table>
              <TableHeader className="border-b border-gray-100 dark:border-white/[0.05]">
                <TableRow>
                  <TableCell isHeader className="px-5 py-3 text-start">Nama Counter / Brand</TableCell>
                  <TableCell isHeader className="px-5 py-3 text-start">Supervisor PJ</TableCell>
                  <TableCell isHeader className="px-5 py-3 text-start">Status</TableCell>
                  <TableCell isHeader className="px-5 py-3 text-end">Aksi</TableCell>
                </TableRow>
              </TableHeader>
              <TableBody className="divide-y divide-gray-100 dark:divide-white/[0.05]">
                {isLoading ? (
                  <TableRow>
                    <TableCell colSpan={4} className="text-center py-10 text-gray-400">Memuat data...</TableCell>
                  </TableRow>
                ) : counters.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={4} className="text-center py-10 text-gray-400 font-medium">Belum ada counter.</TableCell>
                  </TableRow>
                ) : (
                  counters.map((counter) => (
                    <TableRow key={counter.id}>
                      <TableCell className="px-5 py-4 font-bold text-gray-900 dark:text-white/90">{counter.name}</TableCell>
                      <TableCell className="px-5 py-4 text-gray-700 dark:text-gray-400">
                        {counter.users?.full_name || <span className="text-gray-400 italic text-xs">Belum diplot</span>}
                      </TableCell>
                      <TableCell className="px-5 py-4">
                        <button onClick={() => toggleStatus(counter)}>
                          <Badge size="sm" color={counter.is_active ? "success" : "error"}>
                            {counter.is_active ? "Aktif" : "Nonaktif"}
                          </Badge>
                        </button>
                      </TableCell>
                      <TableCell className="px-5 py-4 text-end">
                        <div className="flex justify-end gap-2">
                           <button onClick={() => openEditModal(counter)} className="text-gray-500 hover:text-brand-500"><PencilIcon className="size-5" /></button>
                           <button onClick={() => handleDeleteCounter(counter.id, counter.name)} className="text-gray-500 hover:text-error-500"><TrashBinIcon className="size-5" /></button>
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

      <Modal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} className="max-w-[500px] p-8">
        <h2 className="mb-6 text-lg font-bold text-gray-900 dark:text-white">Tambah Counter Baru</h2>
        <form onSubmit={handleAddCounter} className="space-y-4">
          <InputField
            label="Nama Counter / Brand"
            placeholder="Contoh: Faber Castell, Yamaha, dll"
            value={newCounter.name}
            onChange={(e) => setNewCounter({ ...newCounter, name: e.target.value })}
            required
          />
          <div>
            <label className="mb-2 block text-sm font-medium text-gray-700 dark:text-gray-400">Supervisor Penanggung Jawab</label>
            <select 
              className="h-11 w-full rounded-lg border border-gray-300 px-4 py-2.5 text-sm outline-none focus:border-brand-500 dark:bg-gray-900 dark:border-gray-800 dark:text-white/90"
              value={newCounter.supervisor_id}
              onChange={(e) => setNewCounter({ ...newCounter, supervisor_id: e.target.value })}
            >
              <option value="">-- Pilih Supervisor --</option>
              {supervisors.map(spv => (
                <option key={spv.id} value={spv.id}>{spv.full_name}</option>
              ))}
            </select>
          </div>
          <div className="flex justify-end gap-3 mt-6">
            <Button variant="outline" onClick={() => setIsModalOpen(false)}>Batal</Button>
            <Button type="submit">Simpan</Button>
          </div>
        </form>
      </Modal>

      <Modal isOpen={isEditModalOpen} onClose={() => setIsEditModalOpen(false)} className="max-w-[500px] p-8">
        <h2 className="mb-6 text-lg font-bold text-gray-900 dark:text-white">Ubah Counter</h2>
        <form onSubmit={handleEditCounter} className="space-y-4">
          <InputField
            label="Nama Counter"
            value={editForm.name}
            onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
            required
          />
          <div>
            <label className="mb-2 block text-sm font-medium text-gray-700 dark:text-gray-400">Supervisor Penanggung Jawab</label>
            <select 
              className="h-11 w-full rounded-lg border border-gray-300 px-4 py-2.5 text-sm outline-none focus:border-brand-500 dark:bg-gray-900 dark:border-gray-800 dark:text-white/90"
              value={editForm.supervisor_id}
              onChange={(e) => setEditForm({ ...editForm, supervisor_id: e.target.value })}
            >
              <option value="">-- Pilih Supervisor --</option>
              {supervisors.map(spv => (
                <option key={spv.id} value={spv.id}>{spv.full_name}</option>
              ))}
            </select>
          </div>
          <div className="flex justify-end gap-3 mt-6">
            <Button variant="outline" onClick={() => setIsEditModalOpen(false)}>Batal</Button>
            <Button type="submit">Simpan Perubahan</Button>
          </div>
        </form>
      </Modal>
    </>
  );
}
