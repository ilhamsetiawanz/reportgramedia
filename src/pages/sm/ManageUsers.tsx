import { useEffect, useState } from "react";
import { supabase } from "../../lib/supabase";
import PageMeta from "../../components/common/PageMeta";
import { Table, TableBody, TableCell, TableHeader, TableRow } from "../../components/ui/table";
import Button from "../../components/ui/button/Button";
import Badge from "../../components/ui/badge/Badge";
import { Modal } from "../../components/ui/modal";
import InputField from "../../components/form/input/InputField";

import { UserProfile } from "../../types/database";

interface ExtendedUserProfile extends UserProfile {
  counters?: { name: string };
}

export default function ManageUsers() {
  const [users, setUsers] = useState<ExtendedUserProfile[]>([]);
  const [supervisors, setSupervisors] = useState<UserProfile[]>([]);
  const [counters, setCounters] = useState<{ id: string, name: string }[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Filter State
  const [roleFilter, setRoleFilter] = useState<string>("");
  const [searchQuery, setSearchQuery] = useState("");
  
  // Edit State
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<UserProfile | null>(null);
  const [newName, setNewName] = useState("");

  useEffect(() => {
    fetchUsers();
    fetchCounters();
  }, []);

  async function fetchCounters() {
    const { data } = await supabase.from("counters").select("id, name").order("name");
    setCounters(data || []);
  }

  async function fetchUsers() {
    setIsLoading(true);
    try {
      const { data, error } = await supabase
        .from("users")
        .select("*, counters!counter_id(name)")
        .order("created_at", { ascending: false });
      
      if (error) throw error;
      setUsers(data || []);
      
      // Filter for potential supervisors
      setSupervisors(data?.filter(u => u.role === "supervisor") || []);
    } catch (error) {
      console.error("Error fetching users:", error);
    } finally {
      setIsLoading(false);
    }
  }

  async function handleApprove(userId: string, currentStatus: boolean) {
    try {
      const { error } = await supabase
        .from("users")
        .update({ is_approved: !currentStatus })
        .eq("id", userId);
      
      if (error) throw error;
      fetchUsers();
    } catch (error) {
      alert("Gagal update status: " + (error as any).message);
    }
  }

  async function toggleUserStatus(userId: string, currentStatus: boolean) {
    try {
      const { error } = await supabase
        .from("users")
        .update({ is_active: !currentStatus })
        .eq("id", userId);
      
      if (error) throw error;
      fetchUsers();
    } catch (error) {
      alert("Gagal update status aktif: " + (error as any).message);
    }
  }

  async function handleChangeRole(userId: string, newRole: string) {
    try {
      const { error } = await supabase
        .from("users")
        .update({ role: newRole === "" ? null : newRole })
        .eq("id", userId);
      
      if (error) throw error;
      fetchUsers();
    } catch (error) {
      alert("Gagal update role: " + (error as any).message);
    }
  }

  async function handleAssignSupervisor(userId: string, spvId: string) {
    try {
      const { error } = await supabase
        .from("users")
        .update({ supervisor_id: spvId === "" ? null : spvId })
        .eq("id", userId);
      
      if (error) throw error;
      fetchUsers();
    } catch (error) {
      alert("Gagal update supervisor: " + (error as any).message);
    }
  }

  async function handleAssignCounter(userId: string, counterId: string) {
    try {
      const { error } = await supabase
        .from("users")
        .update({ counter_id: counterId === "" ? null : counterId })
        .eq("id", userId);
      
      if (error) throw error;
      fetchUsers();
    } catch (error) {
      alert("Gagal update counter: " + (error as any).message);
    }
  }

  async function handleHardDelete(userId: string, fullName: string) {
    const confirm1 = confirm(`PERINGATAN: Apakah Anda yakin ingin menghapus "${fullName}" secara PERMANEN? \n\nTindakan ini akan menghapus SELURUH data omset dan laporan yang pernah dibuat oleh user ini dan tidak bisa dikembalikan.`);
    if (!confirm1) return;

    const confirm2 = confirm(`KONFIRMASI TERAKHIR: Anda benar-benar ingin menghapus data "${fullName}" dari database?`);
    if (!confirm2) return;
    
    try {
      const { error } = await supabase
        .from("users")
        .delete()
        .eq("id", userId);
      
      if (error) throw error;
      fetchUsers();
    } catch (error) {
      alert("Gagal menghapus user: " + (error as any).message);
    }
  }

  const openEditModal = (user: UserProfile) => {
    setEditingUser(user);
    setNewName(user.full_name);
    setIsEditOpen(true);
  };

  async function handleSaveEdit() {
    if (!editingUser) return;
    try {
      const { error } = await supabase
        .from("users")
        .update({ full_name: newName })
        .eq("id", editingUser.id);
      
      if (error) throw error;
      setIsEditOpen(false);
      fetchUsers();
    } catch (error) {
      alert("Gagal edit user: " + (error as any).message);
    }
  }

  return (
    <>
      <PageMeta title="Kelola User | Gramedia Tracker" description="Manajemen pendaftaran, role, dan edit data staff" />
      
      <div className="flex flex-col gap-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Daftar Pengguna</h1>
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
                placeholder="Cari nama / email..."
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
            {/* Role Filter */}
            <select
              className="h-9 px-3 border border-gray-300 rounded-lg dark:bg-gray-900 dark:border-gray-800 outline-none text-xs focus:border-brand-500"
              value={roleFilter}
              onChange={(e) => setRoleFilter(e.target.value)}
            >
              <option value="">Semua Role</option>
              <option value="store_manager">Store Manager</option>
              <option value="supervisor">Supervisor</option>
              <option value="store_associate">Store Associate</option>
              <option value="counter">Counter</option>
            </select>
          </div>
        </div>

        <div className="overflow-hidden rounded-xl border border-gray-200 bg-white dark:border-white/[0.05] dark:bg-white/[0.03]">
          <div className="max-w-full overflow-x-auto">
            <Table>
              <TableHeader className="border-b border-gray-100 dark:border-white/[0.05]">
                <TableRow>
                  <TableCell isHeader className="px-5 py-3 text-start text-theme-xs">Nama & Email</TableCell>
                  <TableCell isHeader className="px-5 py-3 text-start text-theme-xs">Role</TableCell>
                  <TableCell isHeader className="px-5 py-3 text-start text-theme-xs">Status</TableCell>
                  <TableCell isHeader className="px-5 py-3 text-start text-theme-xs">Plotting</TableCell>
                  <TableCell isHeader className="px-5 py-3 text-end text-theme-xs">Aksi</TableCell>
                </TableRow>
              </TableHeader>
              <TableBody className="divide-y divide-gray-100 dark:divide-white/[0.05]">
                {isLoading ? (
                  <TableRow>
                    <TableCell colSpan={5} className="text-center py-10 text-gray-400">Memuat user...</TableCell>
                  </TableRow>
                ) : users.filter(u =>
                    (roleFilter === "" || u.role === roleFilter) &&
                    (searchQuery === "" ||
                      u.full_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                      (u.email || "").toLowerCase().includes(searchQuery.toLowerCase())
                    )
                  ).length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={5} className="text-center py-10 text-gray-400 font-medium">
                      {roleFilter || searchQuery ? "Tidak ada user yang cocok dengan filter." : "Belum ada user terdaftar."}
                    </TableCell>
                  </TableRow>
                ) : (
                  users.filter(u =>
                    (roleFilter === "" || u.role === roleFilter) &&
                    (searchQuery === "" ||
                      u.full_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                      (u.email || "").toLowerCase().includes(searchQuery.toLowerCase())
                    )
                  ).map((user) => (
                    <TableRow key={user.id} className={user.is_active ? "" : "opacity-50"}>
                      <TableCell className="px-5 py-4">
                        <div className="flex flex-col">
                          <span className="font-medium text-gray-800 dark:text-white/90">{user.full_name} {!user.is_active && "(Nonaktif)"}</span>
                          <span className="text-xs text-gray-500">{user.email}</span>
                        </div>
                      </TableCell>
                      <TableCell className="px-5 py-4">
                        <select 
                          className="bg-transparent text-sm border rounded px-2 py-1 outline-none dark:bg-gray-900 dark:border-gray-800"
                          value={user.role || ""}
                          onChange={(e) => handleChangeRole(user.id, e.target.value)}
                        >
                          <option value="">Belum Ditentukan</option>
                          <option value="store_manager">Store Manager</option>
                          <option value="supervisor">Supervisor</option>
                          <option value="store_associate">Store Associate</option>
                          <option value="counter">Counter</option>
                        </select>
                      </TableCell>
                      <TableCell className="px-5 py-4">
                        <div className="flex flex-col gap-1">
                          <Badge size="sm" color={user.is_approved ? "success" : "warning"}>
                            {user.is_approved ? "Terverifikasi" : "Belum Approve"}
                          </Badge>
                          <Badge size="sm" color={user.is_active ? "success" : "error"}>
                            {user.is_active ? "Aktif" : "Nonaktif"}
                          </Badge>
                        </div>
                      </TableCell>
                      <TableCell className="px-5 py-4">
                        <div className="flex flex-col gap-2">
                          {user.role === "store_associate" && (
                            <div className="flex flex-col gap-1">
                              <span className="text-[10px] text-gray-400 font-bold uppercase">Supervisor:</span>
                              <select 
                                className="bg-transparent text-sm border rounded px-2 py-1 outline-none max-w-[150px] dark:bg-gray-900 dark:border-gray-800"
                                value={user.supervisor_id || ""}
                                onChange={(e) => handleAssignSupervisor(user.id, e.target.value)}
                              >
                                <option value="">Pilih SPV...</option>
                                {supervisors.map(spv => (
                                  <option key={spv.id} value={spv.id}>{spv.full_name}</option>
                                ))}
                              </select>
                            </div>
                          )}

                          {user.role === "counter" && (
                            <div className="flex flex-col gap-1">
                              <span className="text-[10px] text-gray-400 font-bold uppercase">Counter Group:</span>
                              <select 
                                className="bg-transparent text-sm border rounded px-2 py-1 outline-none max-w-[150px] dark:bg-gray-900 dark:border-gray-800"
                                value={user.counter_id || ""}
                                onChange={(e) => handleAssignCounter(user.id, e.target.value)}
                              >
                                <option value="">Pilih Counter...</option>
                                {counters.map(c => (
                                  <option key={c.id} value={c.id}>{c.name}</option>
                                ))}
                              </select>
                            </div>
                          )}

                          {!user.role || (user.role !== 'store_associate' && user.role !== 'counter') && (
                            <span className="text-gray-400 text-xs">-</span>
                          )}
                        </div>
                      </TableCell>
                      <TableCell className="px-5 py-4 text-end">
                        <div className="flex justify-end gap-2">
                          <Button size="sm" variant="outline" onClick={() => openEditModal(user)}>Edit</Button>
                          <Button 
                            size="sm" 
                            variant={user.is_approved ? "outline" : "primary"}
                            onClick={() => handleApprove(user.id, user.is_approved)}
                          >
                            {user.is_approved ? "Cabut Akses" : "Approve"}
                          </Button>
                          <Button 
                            size="sm" 
                            variant="outline"
                            onClick={() => toggleUserStatus(user.id, user.is_active)}
                          >
                            {user.is_active ? "Nonaktifkan" : "Aktifkan"}
                          </Button>
                          <Button 
                            size="sm" 
                            variant="outline"
                            className="text-error-500 border-error-500 hover:bg-error-50"
                            onClick={() => handleHardDelete(user.id, user.full_name)}
                          >
                            Hapus
                          </Button>
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

      <Modal isOpen={isEditOpen} onClose={() => setIsEditOpen(false)}>
        <div className="p-6">
          <h2 className="text-xl font-bold mb-4 dark:text-white">Edit Nama Pengguna</h2>
          <div className="space-y-4">
             <InputField 
               label="Nama Lengkap" 
               value={newName} 
               onChange={(e) => setNewName(e.target.value)} 
               placeholder="Masukkan nama lengkap baru"
             />
             <div className="flex justify-end gap-3 pt-4">
                <Button variant="outline" onClick={() => setIsEditOpen(false)}>Batal</Button>
                <Button onClick={handleSaveEdit}>Simpan Perubahan</Button>
             </div>
          </div>
        </div>
      </Modal>
    </>
  );
}
