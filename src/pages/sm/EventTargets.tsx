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

export default function EventTargets() {
  const { profile } = useAuthStore();
  const [events, setEvents] = useState<Event[]>([]);
  const [selectedEventId, setSelectedEventId] = useState<string>("");
  const [targets, setTargets] = useState<SATarget[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  // Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingSA, setEditingSA] = useState<SATarget | null>(null);
  const [targetInput, setTargetInput] = useState(0);

  useEffect(() => {
    fetchEvents();
  }, []);

  useEffect(() => {
    if (selectedEventId) {
      fetchSAsAndTargets();
    } else {
      setTargets([]);
    }
  }, [selectedEventId, profile]);

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
        // Fetch all SAs
        const { data: userData } = await supabase
          .from("users")
          .select("id, full_name")
          .eq("role", "store_associate")
          .eq("is_approved", true)
          .eq("is_active", true);
        sas = userData || [];
      } else {
        // Fetch SAs assigned to THIS SPV (current month/year for simplicity or just general)
        // Using common pattern in this app: monthly_assignments
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

      // 2. Fetch existing targets for the selected event
      const { data: existingTargets } = await supabase
        .from("event_targets")
        .select("*")
        .eq("event_id", selectedEventId);

      // 3. Map targets to SAs
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
        result = await supabase
          .from("event_targets")
          .update({ target_count: targetInput })
          .eq("id", editingSA.id);
      } else {
        result = await supabase
          .from("event_targets")
          .insert(targetData);
      }

      if (result.error) throw result.error;

      setIsModalOpen(false);
      fetchSAsAndTargets();
    } catch (error) {
      alert("Gagal menyimpan target: " + (error as any).message);
    }
  }

  return (
    <>
      <PageMeta title="Target Event | Gramedia Tracker" description="Penentuan target peserta event per SA" />

      <div className="flex flex-col gap-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Target Peserta Event</h1>
            <p className="text-sm text-gray-500">Tetapkan target jumlah peserta untuk masing-masing Store Associate.</p>
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

        <div className="overflow-hidden rounded-xl border border-gray-200 bg-white dark:border-white/[0.05] dark:bg-white/[0.03]">
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
        </div>
      </div>

      <Modal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)}>
        <div className="p-6">
          <h2 className="text-xl font-bold mb-1 dark:text-white">Set Target Peserta</h2>
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
    </>
  );
}
