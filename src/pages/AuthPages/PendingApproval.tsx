import { useAuthStore } from "../../store/useAuthStore";
import Button from "../../components/ui/button/Button";
import PageMeta from "../../components/common/PageMeta";

export default function PendingApproval() {
  const { profile, signOut } = useAuthStore();

  return (
    <>
      <PageMeta title="Menunggu Persetujuan | Gramedia Tracker" description="Akun Anda sedang dalam tinjauan admin" />
      <div className="flex items-center justify-center min-h-screen bg-gray-50 dark:bg-gray-950 p-6">
        <div className="w-full max-w-md p-8 bg-white dark:bg-gray-900 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-800 text-center">
          <div className="mb-6 flex justify-center text-brand-500">
             <div className="p-4 bg-brand-50 dark:bg-brand-500/10 rounded-full">
                <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="lucide lucide-user-check"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><polyline points="16 11 18 13 22 9"/></svg>
             </div>
          </div>
          
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">Pendaftaran Berhasil</h1>
          <p className="text-gray-500 dark:text-gray-400 mb-8">
            Halo, <span className="font-semibold text-gray-900 dark:text-white">{profile?.full_name || 'Rekan Gramedia'}</span>. 
            Akun Anda saat ini sedang menunggu persetujuan dan penentuan role oleh Store Manager. 
            Silakan hubungi admin atau tunggu hingga akun Anda diaktifkan.
          </p>

          <div className="space-y-3">
             <Button variant="outline" className="w-full" onClick={() => window.location.reload()}>
               Cek Status Akun
             </Button>
             <button 
               onClick={() => signOut()}
               className="text-sm text-gray-500 hover:text-brand-500 transition-colors"
             >
               Logout dan Masuk dengan Akun Lain
             </button>
          </div>
        </div>
      </div>
    </>
  );
}
