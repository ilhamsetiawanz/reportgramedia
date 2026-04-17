export default function SidebarWidget() {
  return (
    <div
      className={`
        mx-auto mb-10 w-full max-w-60 rounded-2xl bg-brand-50 mx-4 px-4 py-5 text-center dark:bg-white/[0.03]`}
    >
      <h3 className="mb-2 font-semibold text-gray-900 dark:text-white">
        Gramedia Kendari
      </h3>
      <p className="mb-4 text-gray-500 text-theme-sm dark:text-gray-400">
        Sistem pelaporan performa toko Gramedia Kendari terpadu.
      </p>
      <div className="text-xs text-brand-500 font-bold">
        v2.1.0 - Operational
      </div>
    </div>
  );
}
