import { useEffect, useState } from "react";
import { supabase } from "../../lib/supabase";
import PageMeta from "../../components/common/PageMeta";
import { Table, TableBody, TableCell, TableHeader, TableRow } from "../../components/ui/table";
import Button from "../../components/ui/button/Button";
import { useAuthStore } from "../../store/useAuthStore";
import { Modal } from "../../components/ui/modal";
import InputField from "../../components/form/input/InputField";

interface SATarget {
  id?: string;
  sa_id: string;
  full_name: string;
  waqaf_target: number;
  member_target: number;
}

export default function WaqafMemberTargets() {
  const { profile } = useAuthStore();
  const [targets, setTargets] = useState<SATarget[]>([]);
  const [month, setMonth] = useState(new Date().getMonth() + 1);
  const [year, setYear] = useState(new Date().getFullYear());
  const [isLoading, setIsLoading] = useState(true);

  // Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingSA, setEditingSA] = useState<SATarget | null>(null);
  const [waqafTargetInput, setWaqafTargetInput] = useState(0);
  const [memberTargetInput, setMemberTargetInput] = useState(0);

  useEffect(() => {
    if (profile?.id) {
      fetchTargets();
    }
  }, [profile, month, year]);

  async function fetchTargets() {
    setIsLoading(true);
    try {
      if (!profile) return;

      // 1. Fetch SAs assigned to THIS SPV for the SELECTED month/year
      const { data: assignments, error: saError } = await supabase
        .from("monthly_assignments")
        .select("sa_id, users!monthly_assignments_sa_id_fkey(id, full_name)")
        .eq("supervisor_id", profile.id)
        .eq("month", month)
        .eq("year", year);

      if (saError) throw saError;

      const sas = (assignments || [])
        .filter(a => a.sa_id)
        .map(a => ({
          id: (a.users as any).id,
          full_name: (a.users as any).full_name
        }));

      // 2. Fetch existing targets for the selected month/year
      const { data: existingTargets, error: targetError } = await supabase
        .from("waqaf_member_targets")
        .select("*")
        .eq("month", month)
        .eq("year", year);

      if (targetError) throw targetError;

      // 3. Map targets to SAs
      const mappedTargets: SATarget[] = sas.map(sa => {
        const target = existingTargets?.find(t => t.sa_id === sa.id);
        return {
          id: target?.id,
          sa_id: sa.id,
          full_name: sa.full_name,
          waqaf_target: target?.waqaf_target || 0,
          member_target: target?.member_target || 0
        };
      });

      setTargets(mappedTargets);
    } catch (error) {
      console.error("Error fetching targets:", error);
    } finally {
      setIsLoading(false);
    }
  }

  const openSetTargetModal = (target: SATarget) => {
    setEditingSA(target);
    setWaqafTargetInput(target.waqaf_target);
    setMemberTargetInput(target.member_target);
    setIsModalOpen(true);
  };

  async function handleSaveTarget() {
    if (!editingSA || !profile) return;

    try {
      const targetData = {
        sa_id: editingSA.sa_id,
        supervisor_id: profile.id,
        month,
        year,
        waqaf_target: waqafTargetInput,
        member_target: memberTargetInput
      };

      let result;
      if (editingSA.id) {
        // Update
        result = await supabase
          .from("waqaf_member_targets")
          .update({
            waqaf_target: waqafTargetInput,
            member_target: memberTargetInput
          })
          .eq("id", editingSA.id);
      } else {
        // Insert
        result = await supabase
          .from("waqaf_member_targets")
          .insert(targetData);
      }

      if (result.error) throw result.error;

      setIsModalOpen(false);
      fetchTargets();
    } catch (error) {
      alert("Gagal menyimpan target: " + (error as any).message);
    }
  }

  return (
    <>
      <PageMeta title="Target SA | Gramedia Tracker" description="Penentuan target waqaf dan member bulanan per staff" />

      <div className="flex flex-col gap-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Target Waqaf & Member SA</h1>
            <p className="text-sm text-gray-500">Tetapkan target bulanan untuk masing-masing Store Associate.</p>
          </div>

          <div className="flex items-center gap-3">
            <select
              className="h-10 px-3 border border-gray-300 rounded-lg dark:bg-gray-900 dark:border-gray-800 outline-none"
              value={month}
              onChange={(e) => setMonth(parseInt(e.target.value))}
            >
              {Array.from({ length: 12 }, (_, i) => (
                <option key={i + 1} value={i + 1}>{new Date(0, i).toLocaleString('id-ID', { month: 'long' })}</option>
              ))}
            </select>
            <select
              className="h-10 px-3 border border-gray-300 rounded-lg dark:bg-gray-900 dark:border-gray-800 outline-none"
              value={year}
              onChange={(e) => setYear(parseInt(e.target.value))}
            >
              {[year - 1, year, year + 1].map(y => (
                <option key={y} value={y}>{y}</option>
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
                  <TableCell isHeader className="px-5 py-3 text-end text-theme-xs uppercase">Target Waqaf</TableCell>
                  <TableCell isHeader className="px-5 py-3 text-end text-theme-xs uppercase">Target Member</TableCell>
                  <TableCell isHeader className="px-5 py-3 text-end text-theme-xs uppercase">Aksi</TableCell>
                </TableRow>
              </TableHeader>
              <TableBody className="divide-y divide-gray-100 dark:divide-white/[0.05]">
                {isLoading ? (
                  <TableRow>
                    <TableCell colSpan={4} className="text-center py-10 text-gray-400">Memuat data target...</TableCell>
                  </TableRow>
                ) : targets.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={4} className="text-center py-10 text-gray-400 font-medium italic">Belum ada SA yang di-assign.</TableCell>
                  </TableRow>
                ) : (
                  targets.map((item) => (
                    <TableRow key={item.sa_id}>
                      <TableCell className="px-5 py-4 font-bold text-gray-900 dark:text-white/90">
                        {item.full_name}
                      </TableCell>
                      <TableCell className="px-5 py-4 text-end">
                        <span className="text-brand-600 font-medium">Rp {item.waqaf_target.toLocaleString()}</span>
                      </TableCell>
                      <TableCell className="px-5 py-4 text-end">
                        <span className="text-success-600 font-medium">{item.member_target} Member</span>
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
          <h2 className="text-xl font-bold mb-1 dark:text-white">Set Target Bulanan</h2>
          <p className="text-sm text-gray-500 mb-6">Staff: {editingSA?.full_name}</p>

          <div className="space-y-4">
            <InputField
              label="Target Waqaf (Rp)"
              type="number"
              value={waqafTargetInput}
              onChange={(e) => setWaqafTargetInput(parseInt(e.target.value))}
            />
            <InputField
              label="Target MyValue Member (Member)"
              type="number"
              value={memberTargetInput}
              onChange={(e) => setMemberTargetInput(parseInt(e.target.value) || 0)}
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
