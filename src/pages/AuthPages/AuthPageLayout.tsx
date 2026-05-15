import React from "react";
import GridShape from "../../components/common/GridShape";
import { Link } from "react-router";
import ThemeTogglerTwo from "../../components/common/ThemeTogglerTwo";

export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="relative p-6 bg-white z-1 dark:bg-gray-900 sm:p-0">
      <div className="relative flex flex-col justify-center w-full h-screen lg:flex-row dark:bg-gray-900 sm:p-0">
        {children}
        <div className="items-center hidden w-full h-full lg:w-1/2 bg-brand-950 dark:bg-white/5 lg:grid">
          <div className="relative flex items-center justify-center z-1">
            {/* <!-- ===== Common Grid Shape Start ===== --> */}
            <GridShape />
            <div className="flex flex-col items-center max-w-sm">
              <Link to="/" className="block mb-6">
                <div className="flex items-center gap-4">
                   <div className="w-16 h-16 bg-white rounded-2xl flex items-center justify-center text-brand-600 font-bold text-3xl shadow-xl">G</div>
                   <div className="flex flex-col text-left">
                      <span className="font-bold text-4xl text-white tracking-tight">Gramedia</span>
                      <span className="text-sm text-brand-200 font-medium tracking-[4px] uppercase">Kendari</span>
                   </div>
                </div>
              </Link>
              <p className="text-center text-brand-100/60 text-lg font-medium">
                Sistem Monitoring & Pelaporan Operasional Terpadu Gramedia Kendari.
              </p>
            </div>
          </div>
        </div>
        <div className="fixed z-50 hidden bottom-6 right-6 sm:block">
          <ThemeTogglerTwo />
        </div>
      </div>
    </div>
  );
}
