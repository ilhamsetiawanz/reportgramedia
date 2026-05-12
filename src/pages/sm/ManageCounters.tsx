import { useEffect, useState } from "react";
import { supabase } from "../../lib/supabase";
import PageMeta from "../../components/common/PageMeta";
import { Table, TableBody, TableCell, TableHeader, TableRow } from "../../components/ui/table";
import Button from "../../components/ui/button/Button";
import { Modal } from "../../components/ui/modal";
import InputField from "../../components/form/input/InputField";
import { PlusIcon, TrashBinIcon, PencilIcon } from "../../icons";

interface Counter {
  id: string;
  name: string;
  supervisor_id: string | null;
  users?: { full_name: string };
}

interface Supervisor {
  id: string;
  full_name: string;
}

export default function ManageCounters() {
  const [counters, setCounters] = useState<Counter[]>([]);
  const [supervisors, setSupervisors] = useState<Supervisor[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  
  // Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingCounter, setEditingCounter] = useState<Counter | null>(null);
  const [formData, setFormData] = useState({
    name: "",
    supervisor_id: ""
  });

  useEffect(() => {
    fetchData();
  }, []);

  async function fetchData() {
    setIsLoading(true);
    try {
      const [countersRes, supervisorsRes] = await Promise.all([
        supabase.from("counters").select("*, users:supervisor_id(full_name)").order("name"),
        supabase.from("users").select("id, full_name").eq("role", "supervisor").eq("is_active", true)
      ]);
      
      setCounters(countersRes.data || []);
      setSupervisors(supervisorsRes.data || []);
    } catch (error) {
      console.error("Error fetching data:", error);
    } finally {
      setIsLoading(false);
    }
  }

  const openAddModal = () => {
    setEditingCounter(null);
    setFormData({ name: "", supervisor_id: "" });
    setIsModalOpen(true);
  };

  const openEditModal = (counter: Counter) => {
    setEditingCounter(counter);
    setFormData({ 
      name: counter.name, 
      supervisor_id: counter.supervisor_id || "" 
    });
    setIsModalOpen(true);
  };

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    try {
      const payload = {
        name: formData.name,
        supervisor_id: formData.supervisor_id || null
      };

      let error;
      if (editingCounter) {
        const { error: err } = await supabase.from("counters").update(payload).eq("id", editingCounter.id);
        error = err;
      } else {
        const { error: err } = await supabase.from("counters").insert([payload]);
        error = err;
      }

      if (error) throw error;
      setIsModalOpen(false);
      fetchData();
    } catch (error) {
      alert("Gagal menyimpan counter: " + (error as any).message);
    }
  }

  async function handleDelete(id: string, name: string) {
    if (!confirm(`Hapus counter "${name}"?`)) return;
    try {
      const { error } = await supabase.from("counters").delete().eq("id", id);
      if (error) throw error;
      fetchData();
    } catch (error) {
      alert("Gagal menghapus counter: " + (error as any).message);
    }
  }

  return (
    <>
      <PageMeta title="Kelola Counter | Gramedia Tracker" description="Manajemen grup counter dan SPV penanggung jawab" />
      
      <div className="flex flex-col gap-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Daftar Brand Counter</h1>
            <p className="text-sm text-gray-500">Kelola brand counter (Faber-Castell, Yamaha, dll) dan SPV-nya.</p>
          </div>
          <Button onClick={openAddModal} size="sm" startIcon={<PlusIcon />}>
            Tambah Counter
          </Button>
        </div>

        <div className="overflow-hidden rounded-xl border border-gray-200 bg-white dark:border-white/[0.05] dark:bg-white/[0.03]">
          <Table>
            <TableHeader>
              <TableRow>
                <TableCell isHeader className="px-5 py-3">Nama Brand</TableCell>
                <TableCell isHeader className="px-5 py-3">SPV Penanggung Jawab</TableCell>
                <TableCell isHeader className="px-5 py-3 text-end">Aksi</TableCell>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow><TableCell colSpan={3} className="text-center py-10">Memuat data...</TableCell></TableRow>
              ) : counters.length === 0 ? (
                <TableRow><TableCell colSpan={3} className="text-center py-10">Belum ada brand counter.</TableCell></TableRow>
              ) : (
                counters.map(counter => (
                  <TableRow key={counter.id}>
                    <TableCell className="px-5 py-4 font-bold text-gray-900 dark:text-white">{counter.name}</TableCell>
                    <TableCell className="px-5 py-4">{(counter.users as any)?.full_name || "-"}</TableCell>
                    <TableCell className="px-5 py-4 text-end">
                       <div className="flex justify-end gap-2">
                          <button onClick={() => openEditModal(counter)} className="text-gray-400 hover:text-brand-500"><PencilIcon className="size-5" /></button>
                          <button onClick={() => handleDelete(counter.id, counter.name)} className="text-gray-400 hover:text-error-500"><TrashBinIcon className="size-5" /></button>
                       </div>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      </div>

      <Modal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} className="max-w-[400px] p-8">
        <h2 className="mb-6 text-lg font-bold text-gray-900 dark:text-white">
          {editingCounter ? "Ubah Counter" : "Tambah Counter Baru"}
        </h2>
        <form onSubmit={handleSubmit} className="space-y-4">
          <InputField
            label="Nama Brand Counter"
            placeholder="Contoh: Faber Castell"
            value={formData.name}
            onChange={(e) => setFormData({ ...formData, name: e.target.value })}
            required
          />
          
          <div className="space-y-2">
            <label className="text-sm font-medium text-gray-700 dark:text-gray-400">Supervisor Penanggung Jawab</label>
            <select
              className="w-full h-11 px-4 text-sm border border-gray-300 rounded-lg focus:border-brand-500 outline-none dark:bg-gray-900 dark:border-gray-800 dark:text-white/90"
              value={formData.supervisor_id}
              onChange={(e) => setFormData({ ...formData, supervisor_id: e.target.value })}
            >
              <option value="">Pilih Supervisor...</option>
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
    </>
  );
}
