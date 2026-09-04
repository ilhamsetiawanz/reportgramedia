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

interface SAUser {
  id: string;
  full_name: string;
}

export default function ManageDepartments() {
  const [departments, setDepartments] = useState<Department[]>([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  // Form State
  const [newDept, setNewDept] = useState({ name: "", code: "" });
  const [supervisors, setSupervisors] = useState<{ id: string, full_name: string }[]>([]);

  // SPV assignments: deptId → spvId
  const [assignments, setAssignments] = useState<Record<string, string>>({});
  // SOA assignments: deptId → saId
  const [saAssignments, setSaAssignments] = useState<Record<string, string>>({});
  // SA list per SPV: spvId → SA[]
  const [sasBySpv, setSasBySpv] = useState<Record<string, SAUser[]>>({});

  const [monthlyTargets, setMonthlyTargets] = useState<Record<string, number>>({});
  const [lastYearTargets, setLastYearTargets] = useState<Record<string, number>>({});

  // Target State
  const [isTargetModalOpen, setIsTargetModalOpen] = useState(false);
  const [targetDept, setTargetDept] = useState<Department | null>(null);
  const [targetForm, setTargetForm] = useState({ target_amount: 0, last_year_amount: 0 });

  // CRUD State
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [editingDept, setEditingDept] = useState<Department | null>(null);
  const [editForm, setEditForm] = useState({ name: "", code: "" });

  // Custom Dept State
  const [isOther, setIsOther] = useState(false);
  const [customName, setCustomName] = useState("");

  // Search State
  const [searchQuery, setSearchQuery] = useState("");

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
        .select("department_id, target_amount, last_year_amount")
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
      const deptSaMap: Record<string, string> = {};
      assignData?.forEach(a => {
        if (a.department_id && a.supervisor_id) {
          deptAssignMap[a.department_id] = a.supervisor_id;
        }
        if (a.department_id && a.sa_id) {
          deptSaMap[a.department_id] = a.sa_id;
        }
      });
      setAssignments(deptAssignMap);
      setSaAssignments(deptSaMap);

      // Fetch all active SAs and group by supervisor_id
      const { data: saData } = await supabase
        .from("users")
        .select("id, full_name, supervisor_id")
        .eq("role", "store_associate")
        .eq("is_approved", true)
        .eq("is_active", true);

      const spvSaMap: Record<string, SAUser[]> = {};
      saData?.forEach(sa => {
        if (sa.supervisor_id) {
          if (!spvSaMap[sa.supervisor_id]) spvSaMap[sa.supervisor_id] = [];
          spvSaMap[sa.supervisor_id].push({ id: sa.id, full_name: sa.full_name });
        }
      });
      setSasBySpv(spvSaMap);

      const targetMap: Record<string, number> = {};
      const lastYearMap: Record<string, number> = {};
      targetData?.forEach(t => {
        targetMap[t.department_id] = t.target_amount;
        lastYearMap[t.department_id] = t.last_year_amount || 0;
      });
      setMonthlyTargets(targetMap);
      setLastYearTargets(lastYearMap);
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

      const { error: deptError } = await supabase
        .from("departments")
        .insert([{
          name: finalName,
          code: newDept.code.toUpperCase()
        }]);

      if (deptError) throw deptError;

      setNewDept({ name: "", code: "" });
      setCustomName("");
      setIsOther(false);
      setIsModalOpen(false);
      fetchData();
    } catch (error) {
      alert("Gagal menambah departemen: " + (error as any).message);
    }
  }

  // --- CRUD FUNCTIONS ---

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
      const { error } = await supabase
        .from("monthly_assignments")
        .upsert({
          department_id: deptId,
          supervisor_id: spvId || null,
          sa_id: null, // Reset SOA when SPV changes
          year: selectedYear,
          month: selectedMonth
        }, { onConflict: 'department_id,month,year' });

      if (error) throw error;

      // Reset SOA assignment for this dept locally
      setAssignments(prev => ({ ...prev, [deptId]: spvId }));
      setSaAssignments(prev => ({ ...prev, [deptId]: "" }));
    } catch (error: any) {
      console.error("Error updating SPV:", error);
      alert("Gagal update SPV: " + error.message);
    }
  }

  async function handleUpdateSOA(deptId: string, saId: string) {
    try {
      const currentSpvId = assignments[deptId] || null;

      const { error } = await supabase
        .from("monthly_assignments")
        .upsert({
          department_id: deptId,
          supervisor_id: currentSpvId,
          sa_id: saId || null,
          year: selectedYear,
          month: selectedMonth
        }, { onConflict: 'department_id,month,year' });

      if (error) throw error;

      setSaAssignments(prev => ({ ...prev, [deptId]: saId }));
    } catch (error: any) {
      console.error("Error updating SOA:", error);
      alert("Gagal update SOA: " + error.message);
    }
  }

  const openTargetModal = (dept: Department) => {
    setTargetDept(dept);
    setTargetForm({
      target_amount: monthlyTargets[dept.id] || 0,
      last_year_amount: lastYearTargets[dept.id] || 0
    });
    setIsTargetModalOpen(true);
  };

  async function handleSaveTarget(e: React.FormEvent) {
    e.preventDefault();
    if (!targetDept) return;
    try {
      const { error } = await supabase
        .from("monthly_targets")
        .upsert({
          department_id: targetDept.id,
          year: selectedYear,
          month: selectedMonth,
          target_amount: targetForm.target_amount,
          last_year_amount: targetForm.last_year_amount
        }, { onConflict: 'department_id,month,year' });

      if (error) throw error;
      setIsTargetModalOpen(false);
      fetchData();
    } catch (error) {
      alert("Gagal menyimpan target: " + (error as any).message);
    }
  }


  return (
    <>
      <PageMeta title="Kelola Departemen | Gramedia Tracker" description="Manajemen departemen dan target bulanan" />

      <div className="flex flex-col gap-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Daftar Departemen</h1>
            <p className="text-gray-500 dark:text-gray-400 text-sm italic">Periode: {selectedMonth}/{selectedYear}</p>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            {/* Search Input */}
            <div className="relative">
              <span className="absolute inset-y-0 left-3 flex items-center pointer-events-none">
                <svg className="h-4 w-4 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-4.35-4.35M17 11A6 6 0 1 1 5 11a6 6 0 0 1 12 0z" />
                </svg>
              </span>
              <input
                type="text"
                placeholder="Cari nama / kode dept..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="h-9 pl-9 pr-3 w-52 border border-gray-300 rounded-lg dark:bg-gray-900 dark:border-gray-800 dark:text-white/90 outline-none text-xs focus:border-brand-500"
              />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery("")}
                  className="absolute inset-y-0 right-2 flex items-center text-gray-400 hover:text-gray-600"
                >
                  <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              )}
            </div>
            <select
              className="h-9 px-2 border border-gray-300 rounded-lg dark:bg-gray-900 dark:border-gray-800 outline-none text-xs"
              value={selectedMonth}
              onChange={(e) => setSelectedMonth(parseInt(e.target.value))}
            >
              {Array.from({ length: 12 }, (_, i) => (
                <option key={i + 1} value={i + 1}>{new Date(0, i).toLocaleString('id-ID', { month: 'long' })}</option>
              ))}
            </select>
            <select
              className="h-9 px-2 border border-gray-300 rounded-lg dark:bg-gray-900 dark:border-gray-800 outline-none text-xs"
              value={selectedYear}
              onChange={(e) => setSelectedYear(parseInt(e.target.value))}
            >
              {[selectedYear - 1, selectedYear, selectedYear + 1].map(y => (
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
                  <TableCell isHeader className="px-5 py-3 text-start">Penugasan (SPV & SOA)</TableCell>
                  <TableCell isHeader className="px-5 py-3 text-start">Status</TableCell>
                  <TableCell isHeader className="px-5 py-3 text-start">Target & Omset</TableCell>
                  <TableCell isHeader className="px-5 py-3 text-end text-theme-xs">Aksi</TableCell>
                </TableRow>
              </TableHeader>
              <TableBody className="divide-y divide-gray-100 dark:divide-white/[0.05]">
                {isLoading ? (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center py-10 text-gray-400">Memuat data...</TableCell>
                  </TableRow>
                ) : departments.filter(d =>
                    d.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                    d.code.toLowerCase().includes(searchQuery.toLowerCase())
                  ).length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center py-10 text-gray-400 font-medium">
                      {searchQuery ? `Tidak ditemukan departemen "${searchQuery}".` : "Belum ada departemen."}
                    </TableCell>
                  </TableRow>
                ) : (
                  departments.filter(d =>
                    d.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                    d.code.toLowerCase().includes(searchQuery.toLowerCase())
                  ).map((dept) => {
                    const assignedSpvId = assignments[dept.id] || "";
                    const assignedSaId = saAssignments[dept.id] || "";
                    const availableSAs = assignedSpvId ? (sasBySpv[assignedSpvId] || []) : [];

                    return (
                      <TableRow key={dept.id}>
                        <TableCell className="px-5 py-4 font-bold text-brand-600">{dept.code}</TableCell>
                        <TableCell className="px-5 py-4 text-gray-800 dark:text-white/90">{dept.name}</TableCell>
                        <TableCell className="px-5 py-4 min-w-[260px]">
                          <div className="flex flex-col gap-2">
                            {/* SPV Dropdown */}
                            <div className="flex flex-col gap-1">
                              <span className="text-[10px] font-semibold uppercase tracking-wide text-gray-400 dark:text-gray-500">
                                Supervisor (SPV)
                              </span>
                              <select
                                className="h-9 w-full rounded-lg border border-gray-300 px-3 text-xs outline-none focus:border-brand-500 dark:bg-gray-900 dark:border-gray-800 dark:text-white/90"
                                value={assignedSpvId}
                                onChange={(e) => handleUpdateSPV(dept.id, e.target.value)}
                              >
                                <option value="">-- Plot SPV --</option>
                                {supervisors.map(spv => (
                                  <option key={spv.id} value={spv.id}>{spv.full_name}</option>
                                ))}
                              </select>
                            </div>

                            {/* SOA Dropdown — only shown when SPV is assigned */}
                            <div className="flex flex-col gap-1">
                              <span className="text-[10px] font-semibold uppercase tracking-wide text-gray-400 dark:text-gray-500">
                                Store Associate (SOA)
                              </span>
                              {assignedSpvId ? (
                                availableSAs.length > 0 ? (
                                  <select
                                    className="h-9 w-full rounded-lg border border-gray-300 px-3 text-xs outline-none focus:border-brand-500 dark:bg-gray-900 dark:border-gray-800 dark:text-white/90"
                                    value={assignedSaId}
                                    onChange={(e) => handleUpdateSOA(dept.id, e.target.value)}
                                  >
                                    <option value="">-- Plot SOA --</option>
                                    {availableSAs.map(sa => (
                                      <option key={sa.id} value={sa.id}>{sa.full_name}</option>
                                    ))}
                                  </select>
                                ) : (
                                  <span className="text-xs text-amber-500 italic">
                                    SPV ini belum memiliki SA aktif
                                  </span>
                                )
                              ) : (
                                <span className="text-xs text-gray-400 italic">
                                  Pilih SPV terlebih dahulu
                                </span>
                              )}
                            </div>
                          </div>
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
                          <div className="flex flex-col gap-1">
                            <span className="text-xs text-gray-500">Bulan ini:</span>
                            <Badge size="sm" color="primary">
                              Rp {monthlyTargets[dept.id]?.toLocaleString() || "0"}
                            </Badge>
                            <span className="text-xs text-gray-500 mt-1">Thn Lalu:</span>
                            <Badge size="sm" color="success">
                              Rp {lastYearTargets[dept.id]?.toLocaleString() || "0"}
                            </Badge>
                          </div>
                        </TableCell>
                        <TableCell className="px-5 py-4 text-end">
                          <div className="flex justify-end gap-2">
                            <Button size="sm" variant="outline" onClick={() => openTargetModal(dept)}>Set Target</Button>
                            <button onClick={() => openEditModal(dept)} className="text-gray-500 hover:text-brand-500 transition-colors"><PencilIcon className="size-5" /></button>
                            <button onClick={() => handleDeleteDepartment(dept.id, dept.name)} className="text-gray-500 hover:text-error-500 transition-colors"><TrashBinIcon className="size-5" /></button>
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
            label="Kode Departement"
            placeholder="Contoh: B01, NVL, MNB"
            value={newDept.code}
            onChange={(e) => setNewDept({ ...newDept, code: e.target.value })}
            required
          />

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
            <Button variant="outline" type="button" onClick={() => setIsEditModalOpen(false)}>Batal</Button>
            <Button type="submit">Simpan Perubahan</Button>
          </div>
        </form>
      </Modal>

      {/* Target Modal */}
      <Modal isOpen={isTargetModalOpen} onClose={() => setIsTargetModalOpen(false)} className="max-w-[500px] p-8">
        <h2 className="mb-6 text-lg font-bold text-gray-900 dark:text-white">Atur Target ({targetDept?.name})</h2>
        <p className="text-sm text-gray-500 mb-4">Periode: {selectedMonth}/{selectedYear}</p>
        <form onSubmit={handleSaveTarget} className="space-y-4">
          <InputField
            label="Target Bulan Ini (Rp)"
            type="number"
            value={targetForm.target_amount}
            onChange={(e) => setTargetForm({ ...targetForm, target_amount: parseFloat(e.target.value) || 0 })}
            required
          />
          <InputField
            label="Omset Tahun Lalu (Rp)"
            type="number"
            value={targetForm.last_year_amount}
            onChange={(e) => setTargetForm({ ...targetForm, last_year_amount: parseFloat(e.target.value) || 0 })}
            required
          />
          <div className="flex justify-end gap-3 mt-6">
            <Button variant="outline" type="button" onClick={() => setIsTargetModalOpen(false)}>Batal</Button>
            <Button type="submit">Simpan Target</Button>
          </div>
        </form>
      </Modal>
    </>
  );
}
