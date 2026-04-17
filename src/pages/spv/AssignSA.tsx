import { useEffect, useState } from "react";
import { supabase } from "../../lib/supabase";
import PageMeta from "../../components/common/PageMeta";
import { Table, TableBody, TableCell, TableHeader, TableRow } from "../../components/ui/table";
import { useAuthStore } from "../../store/useAuthStore";

interface Department {
  id: string;
  name: string;
  code: string;
  assigned_sa_id: string | null;
}

interface SA {
  id: string;
  full_name: string;
}

export default function AssignSA() {
  const { profile } = useAuthStore();
  const [depts, setDepts] = useState<Department[]>([]);
  const [sas, setSas] = useState<SA[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const [selectedMonth, setSelectedMonth] = useState(new Date().getMonth() + 1);
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());

  useEffect(() => {
    if (profile?.id) {
      fetchData();
    }
  }, [profile, selectedMonth, selectedYear]);

  async function fetchData() {
    setIsLoading(true);
    try {
      // 1. Fetch departments assigned to this SPV for selected month
      const { data: assignData, error: deptError } = await supabase
        .from("monthly_assignments")
        .select(`
          department_id,
          supervisor_id,
          sa_id,
          departments (id, name, code)
        `)
        .eq("supervisor_id", profile?.id)
        .eq("year", selectedYear)
        .eq("month", selectedMonth);
      
      if (deptError) throw deptError;

      const mappedDepts: Department[] = (assignData || []).map(a => ({
          id: a.department_id,
          name: (a.departments as any)?.name || "Unknown",
          code: (a.departments as any)?.code || "??",
          assigned_sa_id: a.sa_id
      }));

      // 2. Fetch SAs under this SPV
      const { data: saData, error: saError } = await supabase
        .from("users")
        .select("id, full_name")
        .eq("supervisor_id", profile?.id)
        .eq("role", "store_associate")
        .eq("is_approved", true);
      
      if (saError) throw saError;

      setDepts(mappedDepts);
      setSas(saData || []);
    } catch (error) {
      console.error("Error fetching assignment data:", error);
    } finally {
      setIsLoading(false);
    }
  }

  async function handleAssign(deptId: string, saId: string) {
    try {
      const { error } = await supabase
        .from("monthly_assignments")
        .update({ sa_id: saId || null })
        .eq("department_id", deptId)
        .eq("year", selectedYear)
        .eq("month", selectedMonth);
      
      if (error) throw error;
      
      // Update local state
      setDepts(prev => prev.map(d => d.id === deptId ? { ...d, assigned_sa_id: saId } : d));
    } catch (error) {
      alert("Gagal melakukan penugasan: " + (error as any).message);
    }
  }

  return (
    <>
      <PageMeta title="Penugasan SA | Gramedia Kendari Tracker" description="Atur staff penanggung jawab omset harian per departemen" />
      
      <div className="flex flex-col gap-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Penugasan Staff ke Departemen</h1>
            <p className="text-sm text-gray-500">Periode: {selectedMonth}/{selectedYear}</p>
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
          </div>
        </div>

        <div className="overflow-hidden rounded-xl border border-gray-200 bg-white dark:border-white/[0.05] dark:bg-white/[0.03]">
          <div className="max-w-full overflow-x-auto">
            <Table>
              <TableHeader className="border-b border-gray-100 dark:border-white/[0.05]">
                <TableRow>
                  <TableCell isHeader className="px-5 py-3 text-start">Kode</TableCell>
                  <TableCell isHeader className="px-5 py-3 text-start">Nama Departemen</TableCell>
                  <TableCell isHeader className="px-5 py-3 text-start">Staff Penanggung Jawab (SA)</TableCell>
                </TableRow>
              </TableHeader>
              <TableBody className="divide-y divide-gray-100 dark:divide-white/[0.05]">
                {isLoading ? (
                  <TableRow>
                    <TableCell colSpan={3} className="text-center py-10 text-gray-400">Memuat data penugasan...</TableCell>
                  </TableRow>
                ) : depts.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={3} className="text-center py-10 text-gray-400">Anda belum memiliki departemen yang dikelola. Hubungi SM.</TableCell>
                  </TableRow>
                ) : (
                  depts.map((dept) => (
                    <TableRow key={dept.id}>
                      <TableCell className="px-5 py-4 font-bold text-brand-600">{dept.code}</TableCell>
                      <TableCell className="px-5 py-4 text-gray-800 dark:text-white/90">{dept.name}</TableCell>
                      <TableCell className="px-5 py-4">
                        <select 
                          className="h-10 w-full max-w-[250px] rounded-lg border border-gray-300 px-3 text-sm focus:border-brand-500 dark:bg-gray-900 dark:border-gray-800 dark:text-white/90"
                          value={dept.assigned_sa_id || ""}
                          onChange={(e) => handleAssign(dept.id, e.target.value)}
                        >
                          <option value="">-- Tanpa Penugasan --</option>
                          {sas.map(sa => (
                            <option key={sa.id} value={sa.id}>{sa.full_name}</option>
                          ))}
                        </select>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </div>
      </div>
    </>
  );
}
