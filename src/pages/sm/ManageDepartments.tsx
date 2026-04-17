import React, { useEffect, useState } from "react";
import { supabase } from "../../lib/supabase";
import PageMeta from "../../components/common/PageMeta";
import { Table, TableBody, TableCell, TableHeader, TableRow } from "../../components/ui/table";
import { Modal } from "../../components/ui/modal";
import InputField from "../../components/form/input/InputField";
import Button from "../../components/ui/button/Button";
import { PlusIcon, TrashBinIcon, PencilIcon } from "../../icons";
import Badge from "../../components/ui/badge/Badge";

const PRESET_DEPARTMENTS = [
  "DEP RELIGION & SPIRITUALITY",
  "DEP DICTIONARY",
  "DEP SOCIAL SCIENCES",
  "DEP SCIENCE & NATURE",
  "DEP PSYCHOLOGY",
  "DEP EDUCATION & TEACHING",
  "DEP PARENTING & FAMILY",
  "DEP NOVELS",
  "DEP COMICS",
  "DEP BUSINESS & ECONOMICS",
  "DEP COMPUTING & TECHNOLO",
  "DEP MEDICAL",
  "DEP SCHOOLBOOKS",
  "DEP SELF IMPROVEMENT",
  "DEP REFERENCE",
  "DEP HOBBIES",
  "DEP DIET & HEALTH",
  "DEP ENGINEERING",
  "MNB (NON BOOKS)",
  "DEP CHILDRENS BOOKS",
  "DEP LAW"
];

interface Department {
  id: string;
  name: string;
  code: string;
  is_active: boolean;
  supervisor_id: string;
  users?: { full_name: string }; // Join relation
}

export default function ManageDepartments() {
  const [departments, setDepartments] = useState<Department[]>([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  
  // Form State
  const [newDept, setNewDept] = useState({ name: "", code: "", supervisor_id: "" });
  const [supervisors, setSupervisors] = useState<{ id: string, full_name: string }[]>([]);
  const [assignments, setAssignments] = useState<Record<string, string>>({}); // deptId -> spvId
  const [monthlyTargets, setMonthlyTargets] = useState<Record<string, number>>({}); 
  
  // CRUD State
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [editingDept, setEditingDept] = useState<Department | null>(null);
  const [editForm, setEditForm] = useState({ name: "", code: "" });
  
  // Custom Dept State
  const [isOther, setIsOther] = useState(false);
  const [customName, setCustomName] = useState("");
  
  const [selectedMonth, setSelectedMonth] = useState(new Date().getMonth() + 1);
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());

  useEffect(() => {
    fetchData();
  }, [selectedMonth, selectedYear]);

  async function fetchData() {
    setIsLoading(true);
    try {
      // Fetch Departments with Supervisor Info
      const { data: deptData, error: deptError } = await supabase
        .from("departments")
        .select("*, users!departments_supervisor_id_fkey(full_name)")
        .order("name");
      
      if (deptError) throw deptError;
      setDepartments(deptData || []);

      // Fetch Supervisors for dropdown
      const { data: spvData } = await supabase
        .from("users")
        .select("id, full_name")
        .eq("role", "supervisor")
        .eq("is_approved", true);
      
      setSupervisors(spvData || []);

      // Fetch current month targets
      const { data: targetData, error: targetError } = await supabase
        .from("monthly_targets")
        .select("department_id, target_amount")
        .eq("year", selectedYear)
        .eq("month", selectedMonth);
      
      if (targetError) throw targetError;

      // Fetch Monthly Assignments (SPV & SA Plotting)
      const { data: assignData } = await supabase
        .from("monthly_assignments")
        .select("department_id, supervisor_id, sa_id")
        .eq("year", selectedYear)
        .eq("month", selectedMonth);
      
      const deptAssignMap: Record<string, string> = {};
      assignData?.forEach(a => {
         if (a.department_id && a.supervisor_id) {
           deptAssignMap[a.department_id] = a.supervisor_id;
         }
      });
      setAssignments(deptAssignMap);
      
      const targetMap: Record<string, number> = {};
      targetData?.forEach(t => {
        targetMap[t.department_id] = t.target_amount;
      });
      setMonthlyTargets(targetMap);
    } catch (error) {
      console.error("Error fetching data:", error);
    } finally {
      setIsLoading(false);
    }
  }

  async function handleAddDepartment(e: React.FormEvent) {
    e.preventDefault();
    try {
      const finalName = isOther ? customName : newDept.name;
      if (!finalName) return alert("Pilih atau isi nama departemen!");

      const { error } = await supabase
        .from("departments")
        .insert([{ 
          name: finalName, 
          code: newDept.code.toUpperCase(),
          supervisor_id: newDept.supervisor_id || null
        }]);
      
      if (error) throw error;
      
      setNewDept({ name: "", code: "", supervisor_id: "" });
      setCustomName("");
      setIsOther(false);
      setIsModalOpen(false);
      fetchData();
    } catch (error) {
      alert("Gagal menambah departemen: " + (error as any).message);
    }
  }

  // --- NEW CRUD FUNCTIONS ---

  const openEditModal = (dept: Department) => {
    setEditingDept(dept);
    setEditForm({ name: dept.name, code: dept.code });
    setIsEditModalOpen(true);
  };

  async function handleEditDepartment(e: React.FormEvent) {
    e.preventDefault();
    if (!editingDept) return;
    try {
      const { error } = await supabase
        .from("departments")
        .update({ 
          name: editForm.name, 
          code: editForm.code.toUpperCase() 
        })
        .eq("id", editingDept.id);
      
      if (error) throw error;
      setIsEditModalOpen(false);
      fetchData();
    } catch (error) {
      alert("Gagal mengubah departemen: " + (error as any).message);
    }
  }

  async function handleDeleteDepartment(deptId: string, deptName: string) {
    if (!confirm(`Apakah Anda yakin ingin menghapus departemen "${deptName}" secara permanen?\n\nTindakan ini dapat berpengaruh pada histori laporan yang terkait dengan departemen ini.`)) return;
    
    try {
      const { error } = await supabase
        .from("departments")
        .delete()
        .eq("id", deptId);
      
      if (error) throw error;
      fetchData();
    } catch (error) {
      alert("Gagal menghapus departemen: " + (error as any).message);
    }
  }

  async function toggleDeptStatus(dept: Department) {
    try {
      const { error } = await supabase
        .from("departments")
        .update({ is_active: !dept.is_active })
        .eq("id", dept.id);
      
      if (error) throw error;
      fetchData();
    } catch (error) {
      alert("Gagal update status: " + (error as any).message);
    }
  }


  async function handleUpdateSPV(deptId: string, spvId: string) {
    try {
      // Manual Assignment per Month
      const { error } = await supabase
        .from("monthly_assignments")
        .upsert({
          department_id: deptId,
          year: selectedYear,
          month: selectedMonth,
          supervisor_id: spvId || null
        }, { onConflict: 'department_id,year,month' });
      
      if (error) throw error;
      
      setAssignments(prev => ({ ...prev, [deptId]: spvId }));
      alert("Penugasan SPV berhasil disimpan!");
    } catch (error) {
      alert("Gagal update SPV: " + (error as any).message);
    }
  }


  return (
    <>
      <PageMeta title="Kelola Departemen | Gramedia Tracker" description="Manajemen departemen dan target bulanan" />
      
      <div className="flex flex-col gap-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Daftar Departemen</h1>
            <p className="text-gray-500 dark:text-gray-400 text-sm italic">Periode: {selectedMonth}/{selectedYear}</p>
          </div>
          <div className="flex items-center gap-3">
             <select 
               className="h-9 px-2 border border-gray-300 rounded-lg dark:bg-gray-900 dark:border-gray-800 outline-none text-xs"
               value={selectedMonth}
               onChange={(e) => setSelectedMonth(parseInt(e.target.value))}
             >
               {Array.from({ length: 12 }, (_, i) => (
                 <option key={i+1} value={i+1}>{new Date(0, i).toLocaleString('id-ID', { month: 'long' })}</option>
               ))}
             </select>
             <select 
               className="h-9 px-2 border border-gray-300 rounded-lg dark:bg-gray-900 dark:border-gray-800 outline-none text-xs"
               value={selectedYear}
               onChange={(e) => setSelectedYear(parseInt(e.target.value))}
             >
               {[selectedYear-1, selectedYear, selectedYear+1].map(y => (
                 <option key={y} value={y}>{y}</option>
               ))}
             </select>
            <Button onClick={() => setIsModalOpen(true)} size="sm" startIcon={<PlusIcon />}>
              Tambah Departemen
            </Button>
          </div>
        </div>

        <div className="overflow-hidden rounded-xl border border-gray-200 bg-white dark:border-white/[0.05] dark:bg-white/[0.03]">
          <div className="max-w-full overflow-x-auto">
            <Table>
              <TableHeader className="border-b border-gray-100 dark:border-white/[0.05]">
                <TableRow>
                  <TableCell isHeader className="px-5 py-3 text-start">Kode</TableCell>
                   <TableCell isHeader className="px-5 py-3 text-start">Nama Departemen</TableCell>
                   <TableCell isHeader className="px-5 py-3 text-start">Supervisor</TableCell>
                   <TableCell isHeader className="px-5 py-3 text-start">Status</TableCell>
                  <TableCell isHeader className="px-5 py-3 text-start">Target Bulan Ini</TableCell>
                  <TableCell isHeader className="px-5 py-3 text-end text-theme-xs">Aksi</TableCell>
                </TableRow>
              </TableHeader>
              <TableBody className="divide-y divide-gray-100 dark:divide-white/[0.05]">
                {isLoading ? (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center py-10 text-gray-400">Memuat data...</TableCell>
                  </TableRow>
                ) : departments.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center py-10 text-gray-400 font-medium">Belum ada departemen.</TableCell>
                  </TableRow>
                ) : (
                  departments.map((dept) => (
                    <TableRow key={dept.id}>
                      <TableCell className="px-5 py-4 font-bold text-brand-600">{dept.code}</TableCell>
                       <TableCell className="px-5 py-4 text-gray-800 dark:text-white/90">{dept.name}</TableCell>
                       <TableCell className="px-5 py-4 min-w-[200px]">
                         <select 
                           className="h-9 w-full rounded-lg border border-gray-300 px-3 text-xs outline-none focus:border-brand-500 dark:bg-gray-900 dark:border-gray-800 dark:text-white/90"
                           value={assignments[dept.id] || ""}
                           onChange={(e) => handleUpdateSPV(dept.id, e.target.value)}
                         >
                           <option value="">-- Plot SPV --</option>
                           {supervisors.map(spv => (
                             <option key={spv.id} value={spv.id}>{spv.full_name}</option>
                           ))}
                         </select>
                       </TableCell>
                      <TableCell className="px-5 py-4">
                        <button 
                          onClick={() => toggleDeptStatus(dept)}
                          className="focus:outline-none"
                        >
                          <Badge size="sm" color={dept.is_active ? "success" : "error"}>
                            {dept.is_active ? "Aktif" : "Nonaktif"}
                          </Badge>
                        </button>
                      </TableCell>
                      <TableCell className="px-5 py-4">
                        <Badge size="sm" color="primary">
                           Rp {monthlyTargets[dept.id]?.toLocaleString() || "0"}
                        </Badge>
                      </TableCell>
                      <TableCell className="px-5 py-4 text-end">
                        <div className="flex justify-end gap-2">
                           <button onClick={() => openEditModal(dept)} className="text-gray-500 hover:text-brand-500 transition-colors"><PencilIcon className="size-5" /></button>
                           <button onClick={() => handleDeleteDepartment(dept.id, dept.name)} className="text-gray-500 hover:text-error-500 transition-colors"><TrashBinIcon className="size-5" /></button>
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
        <h2 className="mb-6 text-lg font-bold text-gray-900 dark:text-white">Tambah Departemen Baru</h2>
        <form onSubmit={handleAddDepartment} className="space-y-4">
          <div className="space-y-2">
            <label className="text-sm font-medium text-gray-700 dark:text-gray-400">Pilih Departemen</label>
            <select
              className="w-full h-11 px-4 text-sm border border-gray-300 rounded-lg focus:border-brand-500 outline-none dark:bg-gray-900 dark:border-gray-800 dark:text-gray-400"
              value={isOther ? "OTHER" : newDept.name}
              onChange={(e) => {
                if (e.target.value === "OTHER") {
                  setIsOther(true);
                  setNewDept({ ...newDept, name: "" });
                } else {
                  setIsOther(false);
                  setNewDept({ ...newDept, name: e.target.value });
                }
              }}
              required
            >
              <option value="">Pilih Departemen...</option>
              {PRESET_DEPARTMENTS.map(d => (
                <option key={d} value={d}>{d}</option>
              ))}
              <option value="OTHER">LAINNYA...</option>
            </select>
          </div>

          {isOther && (
            <InputField
              label="Nama Departemen Kustom"
              placeholder="Masukkan nama departemen baru..."
              value={customName}
              onChange={(e) => setCustomName(e.target.value)}
              required
            />
          )}

           <InputField
             label="Kode Unit (Singkatan)"
             placeholder="Contoh: B01, NVL, MNB"
             value={newDept.code}
             onChange={(e) => setNewDept({ ...newDept, code: e.target.value })}
             required
           />
           <div>
             <label className="mb-2 block text-sm font-medium text-gray-700 dark:text-gray-400">
               Supervisor Penanggung Jawab
             </label>
             <select 
               className="h-11 w-full rounded-lg border border-gray-300 px-4 py-2.5 text-sm outline-none focus:border-brand-500 dark:bg-gray-900 dark:border-gray-800 dark:text-white/90"
               value={newDept.supervisor_id}
               onChange={(e) => setNewDept({ ...newDept, supervisor_id: e.target.value })}
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
        <h2 className="mb-6 text-lg font-bold text-gray-900 dark:text-white">Ubah Departemen</h2>
        <form onSubmit={handleEditDepartment} className="space-y-4">
          <InputField
            label="Nama Departemen"
            value={editForm.name}
            onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
            required
          />
           <InputField
             label="Kode Departemen"
             value={editForm.code}
             onChange={(e) => setEditForm({ ...editForm, code: e.target.value })}
             required
           />
          <div className="flex justify-end gap-3 mt-6">
            <Button variant="outline" onClick={() => setIsEditModalOpen(false)}>Batal</Button>
            <Button type="submit">Simpan Perubahan</Button>
          </div>
        </form>
      </Modal>
    </>
  );
}
