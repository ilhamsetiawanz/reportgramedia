import { useEffect, useState } from "react";
import { supabase } from "../../lib/supabase";
import PageMeta from "../../components/common/PageMeta";
import { Table, TableBody, TableCell, TableHeader, TableRow } from "../../components/ui/table";
import Button from "../../components/ui/button/Button";
import Badge from "../../components/ui/badge/Badge";
import { useAuthStore } from "../../store/useAuthStore";

interface UserProfile {
  id: string;
  full_name: string;
  email: string;
  role: string;
  is_approved: boolean;
  is_active: boolean;
}

export default function ManageSA() {
  const { profile } = useAuthStore();
  const [sas, setSas] = useState<UserProfile[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (profile?.id) {
      fetchMySA();
    }
  }, [profile]);

  async function fetchMySA() {
    setIsLoading(true);
    try {
      if (!profile) return;
      const currentMonth = new Date().getMonth() + 1;
      const currentYear = new Date().getFullYear();

      // Get SAs assigned to THIS SPV for CURRENT month
      const { data: assignments } = await supabase
        .from("monthly_assignments")
        .select("sa_id, users!monthly_assignments_sa_id_fkey(*)")
        .eq("supervisor_id", profile.id)
        .eq("month", currentMonth)
        .eq("year", currentYear);
      
      const saList = (assignments || [])
        .filter(a => a.sa_id)
        .map(a => (a.users as any));

      setSas(saList || []);
    } catch (error) {
      console.error("Error fetching SA list:", error);
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
      fetchMySA();
    } catch (error) {
      alert("Gagal update status: " + (error as any).message);
    }
  }

  return (
    <>
      <PageMeta title="Kelola Tim SA | Gramedia Tracker" description="Persetujuan dan manajemen tim Store Associate" />
      
      <div className="flex flex-col gap-6">
        <div className="flex flex-col gap-1">
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Tim Store Associate Saya</h1>
          <p className="text-sm text-gray-500">Daftar staff yang ditugaskan Store Manager di bawah pengawasan Anda.</p>
        </div>

        <div className="overflow-hidden rounded-xl border border-gray-200 bg-white dark:border-white/[0.05] dark:bg-white/[0.03]">
          <div className="max-w-full overflow-x-auto">
            <Table>
              <TableHeader className="border-b border-gray-100 dark:border-white/[0.05]">
                <TableRow>
                  <TableCell isHeader className="px-5 py-3 text-start text-theme-xs uppercase">Nama SA</TableCell>
                  <TableCell isHeader className="px-5 py-3 text-start text-theme-xs uppercase">Email</TableCell>
                  <TableCell isHeader className="px-5 py-3 text-start text-theme-xs uppercase">Status Persetujuan</TableCell>
                  <TableCell isHeader className="px-5 py-3 text-end text-theme-xs uppercase">Aksi</TableCell>
                </TableRow>
              </TableHeader>
              <TableBody className="divide-y divide-gray-100 dark:divide-white/[0.05]">
                {isLoading ? (
                  <TableRow>
                    <TableCell colSpan={4} className="text-center py-10 text-gray-400">Memuat anggota tim...</TableCell>
                  </TableRow>
                ) : sas.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={4} className="text-center py-10 text-gray-400 font-medium">Belum ada SA yang ditugaskan ke Anda.</TableCell>
                  </TableRow>
                ) : (
                  sas.map((sa) => (
                    <TableRow key={sa.id}>
                      <TableCell className="px-5 py-4 font-medium text-gray-800 dark:text-white/90">
                        {sa.full_name}
                      </TableCell>
                      <TableCell className="px-5 py-4 text-sm text-gray-500">
                        {sa.email}
                      </TableCell>
                      <TableCell className="px-5 py-4">
                        <Badge size="sm" color={sa.is_approved ? "success" : "warning"}>
                          {sa.is_approved ? "Sudah Di-approve" : "Menunggu Approve"}
                        </Badge>
                      </TableCell>
                      <TableCell className="px-5 py-4 text-end">
                        <Button 
                          size="sm" 
                          variant={sa.is_approved ? "outline" : "primary"}
                          onClick={() => handleApprove(sa.id, sa.is_approved)}
                        >
                          {sa.is_approved ? "Batalkan Approve" : "Approve Staff"}
                        </Button>
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
