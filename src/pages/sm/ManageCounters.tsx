import React, { useEffect, useState } from "react";
import { supabase } from "../../lib/supabase";
import PageMeta from "../../components/common/PageMeta";
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

  // Search
  const [searchQuery, setSearchQuery] = useState("");

  useEffect(() => {
    fetchData();
  }, []);

  async function fetchData() {
    setIsLoading(true);
    try {
      const { data: counterData, error: counterError } = await supabase
        .from("counters")
        .select("*, users!supervisor_id(full_name)")
        .order("name");

      if (counterError) throw counterError;
      setCounters(counterData || []);

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

  const filteredCounters = counters.filter(c =>
    c.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    (c.users?.full_name || "").toLowerCase().includes(searchQuery.toLowerCase())
  );

  const activeCount = counters.filter(c => c.is_active).length;
  const inactiveCount = counters.filter(c => !c.is_active).length;

  return (
    <>
      <PageMeta title="Kelola Counter | Gramedia Tracker" description="Manajemen counter brand dan plotting supervisor" />

      <div className="flex flex-col gap-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Daftar Counter</h1>
            <p className="text-gray-500 dark:text-gray-400 text-sm">Manajemen brand/counter dan supervisor penanggung jawab.</p>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            {/* Search */}
            <div className="relative">
              <span className="absolute inset-y-0 left-3 flex items-center pointer-events-none">
                <svg className="h-4 w-4 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-4.35-4.35M17 11A6 6 0 1 1 5 11a6 6 0 0 1 12 0z" />
                </svg>
              </span>
              <input
                type="text"
                placeholder="Cari counter / SPV..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="h-9 pl-9 pr-3 w-44 border border-gray-300 rounded-lg dark:bg-gray-900 dark:border-gray-800 dark:text-white/90 outline-none text-xs focus:border-brand-500"
              />
              {searchQuery && (
                <button onClick={() => setSearchQuery("")} className="absolute inset-y-0 right-2 flex items-center text-gray-400 hover:text-gray-600">
                  <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              )}
            </div>
            <Button onClick={() => setIsModalOpen(true)} size="sm" startIcon={<PlusIcon />}>
              Tambah Counter
            </Button>
          </div>
        </div>

        {/* Stats Summary */}
        <div className="grid grid-cols-3 gap-4">
          <div className="rounded-xl border border-gray-200 bg-white dark:border-white/[0.05] dark:bg-white/[0.03] px-5 py-4 flex items-center gap-4">
            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-brand-50 dark:bg-brand-500/10">
              <svg className="h-5 w-5 text-brand-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
              </svg>
            </div>
            <div>
              <p className="text-xs text-gray-500 dark:text-gray-400">Total Counter</p>
              <p className="text-2xl font-bold text-gray-900 dark:text-white">{counters.length}</p>
            </div>
          </div>
          <div className="rounded-xl border border-gray-200 bg-white dark:border-white/[0.05] dark:bg-white/[0.03] px-5 py-4 flex items-center gap-4">
            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-success-50 dark:bg-success-500/10">
              <svg className="h-5 w-5 text-success-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <div>
              <p className="text-xs text-gray-500 dark:text-gray-400">Aktif</p>
              <p className="text-2xl font-bold text-success-600 dark:text-success-400">{activeCount}</p>
            </div>
          </div>
          <div className="rounded-xl border border-gray-200 bg-white dark:border-white/[0.05] dark:bg-white/[0.03] px-5 py-4 flex items-center gap-4">
            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-error-50 dark:bg-error-500/10">
              <svg className="h-5 w-5 text-error-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <div>
              <p className="text-xs text-gray-500 dark:text-gray-400">Nonaktif</p>
              <p className="text-2xl font-bold text-error-600 dark:text-error-400">{inactiveCount}</p>
            </div>
          </div>
        </div>

        {/* Counter Cards Grid */}
        {isLoading ? (
          <div className="flex items-center justify-center py-20">
            <div className="flex flex-col items-center gap-3">
              <div className="h-8 w-8 animate-spin rounded-full border-2 border-brand-500 border-t-transparent"></div>
              <p className="text-sm text-gray-400">Memuat data counter...</p>
            </div>
          </div>
        ) : filteredCounters.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 gap-3">
            <svg className="h-12 w-12 text-gray-300 dark:text-gray-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4" />
            </svg>
            <p className="text-gray-400 font-medium">
              {searchQuery ? `Tidak ditemukan counter "${searchQuery}"` : "Belum ada counter."}
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {filteredCounters.map((counter) => (
              <div
                key={counter.id}
                className={`relative rounded-xl border bg-white dark:bg-white/[0.03] p-5 flex flex-col gap-4 transition-all hover:shadow-md ${
                  counter.is_active
                    ? "border-gray-200 dark:border-white/[0.05]"
                    : "border-gray-200 dark:border-white/[0.05] opacity-60"
                }`}
              >
                {/* Status Badge */}
                <div className="absolute top-4 right-4">
                  <button onClick={() => toggleStatus(counter)} className="focus:outline-none">
                    <Badge size="sm" color={counter.is_active ? "success" : "error"}>
                      {counter.is_active ? "Aktif" : "Nonaktif"}
                    </Badge>
                  </button>
                </div>

                {/* Counter Icon & Name */}
                <div className="flex items-start gap-3 pr-16">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-brand-50 dark:bg-brand-500/10">
                    <svg className="h-5 w-5 text-brand-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
                    </svg>
                  </div>
                  <div className="min-w-0">
                    <h3 className="font-semibold text-gray-900 dark:text-white text-sm leading-tight truncate">{counter.name}</h3>
                    <p className="text-[11px] text-gray-400 mt-0.5">Brand / Counter</p>
                  </div>
                </div>

                {/* Supervisor */}
                <div className="flex items-center gap-2 rounded-lg bg-gray-50 dark:bg-white/[0.03] px-3 py-2.5">
                  <svg className="h-4 w-4 text-gray-400 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                  </svg>
                  <div className="min-w-0">
                    <p className="text-[10px] text-gray-400 uppercase font-semibold tracking-wide">Supervisor PJ</p>
                    <p className="text-xs font-medium text-gray-700 dark:text-gray-300 truncate">
                      {counter.users?.full_name || <span className="text-gray-400 italic font-normal">Belum diplot</span>}
                    </p>
                  </div>
                </div>

                {/* Actions */}
                <div className="flex items-center justify-end gap-2 pt-1 border-t border-gray-100 dark:border-white/[0.05]">
                  <button
                    onClick={() => openEditModal(counter)}
                    className="flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium text-gray-500 hover:text-brand-500 hover:bg-brand-50 dark:hover:bg-brand-500/10 transition-colors"
                  >
                    <PencilIcon className="size-3.5" />
                    Edit
                  </button>
                  <button
                    onClick={() => handleDeleteCounter(counter.id, counter.name)}
                    className="flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium text-gray-500 hover:text-error-500 hover:bg-error-50 dark:hover:bg-error-500/10 transition-colors"
                  >
                    <TrashBinIcon className="size-3.5" />
                    Hapus
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Add Modal */}
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

      {/* Edit Modal */}
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
