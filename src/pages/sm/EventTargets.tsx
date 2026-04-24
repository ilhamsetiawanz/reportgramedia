import { useEffect, useState } from "react";
import { supabase } from "../../lib/supabase";
import PageMeta from "../../components/common/PageMeta";
import { Table, TableBody, TableCell, TableHeader, TableRow } from "../../components/ui/table";
import Button from "../../components/ui/button/Button";
import { useAuthStore } from "../../store/useAuthStore";
import { Modal } from "../../components/ui/modal";
import InputField from "../../components/form/input/InputField";

interface Event {
  id: string;
  name: string;
}

interface SATarget {
  id?: string;
  sa_id: string;
  full_name: string;
  target_count: number;
}

interface CounterTarget {
  id?: string;
  counter_name: string;
  target_count: number;
}

export default function EventTargets() {
  const { profile } = useAuthStore();
  const [events, setEvents] = useState<Event[]>([]);
  const [selectedEventId, setSelectedEventId] = useState<string>("");
  const [activeTab, setActiveTab] = useState<"SA" | "Counter">("SA");
  
  const [targets, setTargets] = useState<SATarget[]>([]);
  const [counterTargets, setCounterTargets] = useState<CounterTarget[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  // SA Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingSA, setEditingSA] = useState<SATarget | null>(null);
  const [targetInput, setTargetInput] = useState(0);

  // Counter Modal State
  const [isCounterModalOpen, setIsCounterModalOpen] = useState(false);
  const [editingCounter, setEditingCounter] = useState<CounterTarget | null>(null);
  const [counterNameInput, setCounterNameInput] = useState("");

  useEffect(() => {
    fetchEvents();
  }, []);

  useEffect(() => {
    if (selectedEventId) {
      if (activeTab === "SA") {
        fetchSAsAndTargets();
      } else {
        fetchCounterTargets();
      }
    } else {
      setTargets([]);
      setCounterTargets([]);
    }
  }, [selectedEventId, profile, activeTab]);

  async function fetchEvents() {
    const { data } = await supabase
      .from("events")
      .select("id, name")
      .eq("is_active", true)
      .order("created_at", { ascending: false });
    
    setEvents(data || []);
    if (data && data.length > 0) {
      setSelectedEventId(data[0].id);
    }
  }

  async function fetchSAsAndTargets() {
    if (!profile || !selectedEventId) return;
    setIsLoading(true);
    try {
      let sas: { id: string, full_name: string }[] = [];

      if (profile.role === "store_manager") {
        const { data: userData } = await supabase
          .from("users")
          .select("id, full_name")
          .eq("role", "store_associate")
          .eq("is_approved", true)
          .eq("is_active", true);
        sas = userData || [];
      } else {
        const now = new Date();
        const { data: assignments } = await supabase
          .from("monthly_assignments")
          .select("sa_id, users!monthly_assignments_sa_id_fkey(id, full_name)")
          .eq("supervisor_id", profile.id)
          .eq("month", now.getMonth() + 1)
          .eq("year", now.getFullYear());
        
        sas = (assignments || [])
          .filter(a => a.sa_id)
          .map(a => ({
            id: (a.users as any).id,
            full_name: (a.users as any).full_name
          }));
      }

      const { data: existingTargets } = await supabase
        .from("event_targets")
        .select("*")
        .eq("event_id", selectedEventId);

      const mappedTargets: SATarget[] = sas.map(sa => {
        const target = existingTargets?.find(t => t.sa_id === sa.id);
        return {
          id: target?.id,
          sa_id: sa.id,
          full_name: sa.full_name,
          target_count: target?.target_count || 0,
        };
      });

      setTargets(mappedTargets);
    } catch (error) {
      console.error("Error fetching SA targets:", error);
    } finally {
      setIsLoading(false);
    }
  }

  async function fetchCounterTargets() {
    if (!profile || !selectedEventId) return;
    setIsLoading(true);
    try {
      const { data } = await supabase
        .from("event_counter_targets")
        .select("*")
        .eq("event_id", selectedEventId)
        .order("counter_name", { ascending: true });
      
      setCounterTargets(data || []);
    } catch (error) {
      console.error("Error fetching counter targets:", error);
    } finally {
      setIsLoading(false);
    }
  }

  // --- SA Target Handlers ---
  const openSetTargetModal = (target: SATarget) => {
    setEditingSA(target);
    setTargetInput(target.target_count);
    setIsModalOpen(true);
  };

  async function handleSaveTarget() {
    if (!editingSA || !profile || !selectedEventId) return;
    try {
      const targetData = {
        event_id: selectedEventId,
        sa_id: editingSA.sa_id,
        supervisor_id: profile.id,
        target_count: targetInput
      };
      
      let result;
      if (editingSA.id) {
        result = await supabase.from("event_targets").update({ target_count: targetInput }).eq("id", editingSA.id);
      } else {
        result = await supabase.from("event_targets").insert(targetData);
      }
      
      if (result.error) throw result.error;
      setIsModalOpen(false);
      fetchSAsAndTargets();
    } catch (error) {
      alert("Gagal menyimpan target: " + (error as any).message);
    }
  }

  // --- Counter Target Handlers ---
  const openCounterModal = (target: CounterTarget | null) => {
    setEditingCounter(target);
    if (target) {
      setCounterNameInput(target.counter_name);
      setTargetInput(target.target_count);
    } else {
      setCounterNameInput("");
      setTargetInput(0);
    }
    setIsCounterModalOpen(true);
  };

  async function handleSaveCounterTarget() {
    if (!profile || !selectedEventId || !counterNameInput.trim()) {
      alert("Nama Counter tidak boleh kosong!");
      return;
    }
    
    try {
      const targetData = {
        event_id: selectedEventId,
        counter_name: counterNameInput.trim(),
        target_count: targetInput
      };
      
      let result;
      if (editingCounter && editingCounter.id) {
        result = await supabase.from("event_counter_targets").update(targetData).eq("id", editingCounter.id);
      } else {
        result = await supabase.from("event_counter_targets").insert(targetData);
      }
      
      if (result.error) throw result.error;
      setIsCounterModalOpen(false);
      fetchCounterTargets();
    } catch (error) {
      alert("Gagal menyimpan target counter: " + (error as any).message);
    }
  }

  async function handleDeleteCounter(id: string, name: string) {
    if (!confirm(`Hapus target untuk counter "${name}"?`)) return;
    try {
      const { error } = await supabase.from("event_counter_targets").delete().eq("id", id);
      if (error) throw error;
      fetchCounterTargets();
    } catch (error) {
      alert("Gagal hapus: " + (error as any).message);
    }
  }

  return (
    <>
      <PageMeta title="Target Event | Gramedia Tracker" description="Penentuan target peserta event per SA dan Counter" />

      <div className="flex flex-col gap-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Target Peserta Event</h1>
            <p className="text-sm text-gray-500">Tetapkan target jumlah peserta untuk masing-masing SA atau Counter.</p>
          </div>

          <div className="flex items-center gap-3">
            <select
              className="h-10 px-3 border border-gray-300 rounded-lg dark:bg-gray-900 dark:border-gray-800 outline-none min-w-[200px]"
              value={selectedEventId}
              onChange={(e) => setSelectedEventId(e.target.value)}
            >
              <option value="">-- Pilih Event --</option>
              {events.map(e => (
                <option key={e.id} value={e.id}>{e.name}</option>
              ))}
            </select>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-gray-200 dark:border-gray-800">
          <button
            className={`px-6 py-3 font-medium text-sm transition-colors relative ${activeTab === 'SA' ? 'text-brand-500' : 'text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300'}`}
            onClick={() => setActiveTab('SA')}
          >
            Target Store Associate
            {activeTab === 'SA' && <span className="absolute bottom-0 left-0 w-full h-0.5 bg-brand-500"></span>}
          </button>
          <button
            className={`px-6 py-3 font-medium text-sm transition-colors relative ${activeTab === 'Counter' ? 'text-brand-500' : 'text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300'}`}
            onClick={() => setActiveTab('Counter')}
          >
            Target Counter
            {activeTab === 'Counter' && <span className="absolute bottom-0 left-0 w-full h-0.5 bg-brand-500"></span>}
          </button>
        </div>

        <div className="overflow-hidden rounded-xl border border-gray-200 bg-white dark:border-white/[0.05] dark:bg-white/[0.03]">
          {activeTab === "SA" ? (
            <div className="max-w-full overflow-x-auto">
              <Table>
                <TableHeader className="border-b border-gray-100 dark:border-white/[0.05]">
                  <TableRow>
                    <TableCell isHeader className="px-5 py-3 text-start text-theme-xs uppercase">Nama SA</TableCell>
                    <TableCell isHeader className="px-5 py-3 text-end text-theme-xs uppercase">Target Peserta</TableCell>
                    <TableCell isHeader className="px-5 py-3 text-end text-theme-xs uppercase">Aksi</TableCell>
                  </TableRow>
                </TableHeader>
                <TableBody className="divide-y divide-gray-100 dark:divide-white/[0.05]">
                  {!selectedEventId ? (
                     <TableRow>
                      <TableCell colSpan={3} className="text-center py-10 text-gray-400">Silakan pilih event terlebih dahulu.</TableCell>
                    </TableRow>
                  ) : isLoading ? (
                    <TableRow>
                      <TableCell colSpan={3} className="text-center py-10 text-gray-400">Memuat data target...</TableCell>
                    </TableRow>
                  ) : targets.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={3} className="text-center py-10 text-gray-400 font-medium italic">Belum ada SA yang sesuai.</TableCell>
                    </TableRow>
                  ) : (
                    targets.map((item) => (
                      <TableRow key={item.sa_id}>
                        <TableCell className="px-5 py-4 font-bold text-gray-900 dark:text-white/90">
                          {item.full_name}
                        </TableCell>
                        <TableCell className="px-5 py-4 text-end">
                          <span className="text-brand-600 font-medium">{item.target_count} Peserta</span>
                        </TableCell>
                        <TableCell className="px-5 py-4 text-end">
                          <Button size="sm" variant="outline" onClick={() => openSetTargetModal(item)}>Set Target</Button>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>
          ) : (
            <div className="max-w-full overflow-x-auto">
              <div className="p-4 flex justify-end border-b border-gray-100 dark:border-white/[0.05]">
                 <Button onClick={() => openCounterModal(null)} size="sm">Tambah Target Counter</Button>
              </div>
              <Table>
                <TableHeader className="border-b border-gray-100 dark:border-white/[0.05]">
                  <TableRow>
                    <TableCell isHeader className="px-5 py-3 text-start text-theme-xs uppercase">Nama Counter</TableCell>
                    <TableCell isHeader className="px-5 py-3 text-end text-theme-xs uppercase">Target Peserta</TableCell>
                    <TableCell isHeader className="px-5 py-3 text-end text-theme-xs uppercase">Aksi</TableCell>
                  </TableRow>
                </TableHeader>
                <TableBody className="divide-y divide-gray-100 dark:divide-white/[0.05]">
                  {!selectedEventId ? (
                     <TableRow>
                      <TableCell colSpan={3} className="text-center py-10 text-gray-400">Silakan pilih event terlebih dahulu.</TableCell>
                    </TableRow>
                  ) : isLoading ? (
                    <TableRow>
                      <TableCell colSpan={3} className="text-center py-10 text-gray-400">Memuat data target...</TableCell>
                    </TableRow>
                  ) : counterTargets.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={3} className="text-center py-10 text-gray-400 font-medium italic">Belum ada target Counter ditambahkan.</TableCell>
                    </TableRow>
                  ) : (
                    counterTargets.map((item) => (
                      <TableRow key={item.id}>
                        <TableCell className="px-5 py-4 font-bold text-gray-900 dark:text-white/90">
                          {item.counter_name}
                        </TableCell>
                        <TableCell className="px-5 py-4 text-end">
                          <span className="text-brand-600 font-medium">{item.target_count} Peserta</span>
                        </TableCell>
                        <TableCell className="px-5 py-4 text-end">
                          <div className="flex justify-end gap-2">
                             <Button size="sm" variant="outline" onClick={() => openCounterModal(item)}>Edit</Button>
                             {item.id && <Button size="sm" variant="outline" className="text-error-500 border-error-500" onClick={() => handleDeleteCounter(item.id!, item.counter_name)}>Hapus</Button>}
                          </div>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>
          )}
        </div>
      </div>

      <Modal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)}>
        <div className="p-6">
          <h2 className="text-xl font-bold mb-1 dark:text-white">Set Target Peserta SA</h2>
          <p className="text-sm text-gray-500 mb-6">Staff: {editingSA?.full_name}</p>

          <div className="space-y-4">
            <InputField
              label="Target Peserta (Orang)"
              type="number"
              value={targetInput}
              onChange={(e) => setTargetInput(parseInt(e.target.value) || 0)}
            />

            <div className="flex justify-end gap-3 pt-4">
              <Button variant="outline" onClick={() => setIsModalOpen(false)}>Batal</Button>
              <Button onClick={handleSaveTarget}>Simpan Target</Button>
            </div>
          </div>
        </div>
      </Modal>

      <Modal isOpen={isCounterModalOpen} onClose={() => setIsCounterModalOpen(false)}>
        <div className="p-6">
          <h2 className="text-xl font-bold mb-6 dark:text-white">{editingCounter ? "Edit" : "Tambah"} Target Counter</h2>

          <div className="space-y-4">
            <InputField
              label="Nama Counter / Brand"
              placeholder="Contoh: Counter Faber Castell"
              value={counterNameInput}
              onChange={(e) => setCounterNameInput(e.target.value)}
            />
            <InputField
              label="Target Peserta (Orang)"
              type="number"
              value={targetInput}
              onChange={(e) => setTargetInput(parseInt(e.target.value) || 0)}
            />

            <div className="flex justify-end gap-3 pt-4">
              <Button variant="outline" onClick={() => setIsCounterModalOpen(false)}>Batal</Button>
              <Button onClick={handleSaveCounterTarget}>Simpan Target Counter</Button>
            </div>
          </div>
        </div>
      </Modal>
    </>
  );
}
