import { useCallback, useEffect, useRef, useState } from "react";
import { Link, useLocation } from "react-router";
import { useAuthStore } from "../store/useAuthStore";

import {
  ChevronDownIcon,
  GridIcon,
  HorizontaLDots,
  ListIcon,
  PieChartIcon,
  TableIcon,
  GroupIcon,
  FolderIcon,
  CheckCircleIcon,
  DollarLineIcon,
  PlusIcon,
  LogOutIcon,
} from "../icons";
import { useSidebar } from "../context/SidebarContext";

type NavItem = {
  name: string;
  icon: React.ReactNode;
  path?: string;
  subItems?: { name: string; path: string; pro?: boolean; new?: boolean }[];
};

type MenuSection = {
  title: string;
  items: NavItem[];
};

const AppSidebar: React.FC = () => {
  const {
    isExpanded,
    isMobileOpen,
    isHovered,
    setIsHovered,
    toggleMobileSidebar,
  } = useSidebar();
  const location = useLocation();
  const { profile, signOut } = useAuthStore();
  const [spvHasCounter, setSpvHasCounter] = useState(false);

  const handleLinkClick = () => {
    if (isMobileOpen) {
      toggleMobileSidebar();
    }
  };

  const [openSubmenu, setOpenSubmenu] = useState<{
    sectionIndex: number;
    itemIndex: number;
  } | null>(null);
  const [subMenuHeight, setSubMenuHeight] = useState<Record<string, number>>({});
  const subMenuRefs = useRef<Record<string, HTMLDivElement | null>>({});

  const isActive = useCallback(
    (path: string) => location.pathname === path,
    [location.pathname]
  );

  useEffect(() => {
    if (profile?.role === 'supervisor') {
      import('../lib/supabase').then(({ supabase }) => {
        supabase.from('counters').select('id', { count: 'exact', head: true })
          .eq('supervisor_id', profile.id)
          .then(({ count }) => setSpvHasCounter((count || 0) > 0));
      });
    }
  }, [profile]);

  const getMenuSections = (): MenuSection[] => {
    const role = profile?.role;
    const sections: MenuSection[] = [];

    if (role === "store_manager") {
      sections.push({
        title: "Menu Utama",
        items: [{ name: "Dashboard SM", icon: <GridIcon />, path: "/" }],
      });
      sections.push({
        title: "Operasional Toko",
        items: [
          { name: "Kelola Event", icon: <ListIcon />, path: "/sm/events" },
          { name: "Target Event", icon: <PlusIcon />, path: "/sm/event-targets" },
          { name: "Target Omset", icon: <DollarLineIcon />, path: "/sm/targets" },
          { name: "Manajemen Dept", icon: <FolderIcon />, path: "/sm/departments" },
          { name: "Manajemen Counter", icon: <ListIcon />, path: "/sm/counters" },
          { name: "Manajemen User", icon: <GroupIcon />, path: "/sm/users" },
        ],
      });
      sections.push({
        title: "Laporan & Rekap",
        items: [
          {
            name: "Pusat Laporan",
            icon: <PieChartIcon />,
            subItems: [
              { name: "Omset Harian", path: "/reports/daily" },
              { name: "Rekap Omset Harian", path: "/reports/daily-recap" },
              { name: "Rekap Omset Counter", path: "/reports/counter-weekly" },
              { name: "Omset Bulanan", path: "/reports/monthly" },
              { name: "Waqaf & Member", path: "/reports/waqaf-member" },
              { name: "Peserta Event", path: "/reports/event-participants" },
            ],
          },
        ],
      });
    } else if (role === "supervisor") {
      sections.push({
        title: "Menu Utama",
        items: [{ name: "Dashboard SPV", icon: <GridIcon />, path: "/" }],
      });
      sections.push({
        title: "Monitoring & Verif",
        items: [
          { name: "Input Omset SA", icon: <PlusIcon />, path: "/spv/input-revenue" },
          { name: "Verifikasi Omset", icon: <CheckCircleIcon />, path: "/spv/verify" },
          { name: "Penugasan Dept", icon: <ListIcon />, path: "/spv/assign" },
          { name: "Kelola Tim SA", icon: <GroupIcon />, path: "/spv/sa" },
        ],
      });
      const targetItems: NavItem[] = [
        { name: "Target Dept", icon: <DollarLineIcon />, path: "/spv/targets" },
        { name: "Target WAQAF/Member", icon: <PlusIcon />, path: "/spv/waqaf-targets" },
        { name: "Target Event", icon: <PlusIcon />, path: "/spv/event-targets" },
      ];
      if (spvHasCounter) {
        targetItems.splice(1, 0, { name: "Target Counter", icon: <DollarLineIcon />, path: "/spv/counter-targets" });
      }
      sections.push({ title: "Target Mingguan", items: targetItems });

      const reportSubItems: { name: string; path: string }[] = [
        { name: "Omset Dept", path: "/reports/dept" },
        { name: "Rekap Omset Harian", path: "/reports/daily-recap" },
        { name: "Waqaf & Member", path: "/reports/waqaf-member" },
        { name: "Kegiatan SA", path: "/reports/activities" },
        { name: "Peserta Event", path: "/reports/event-participants" },
      ];
      if (spvHasCounter) {
        reportSubItems.splice(2, 0, { name: "Rekap Omset Counter", path: "/reports/counter-weekly" });
      }
      sections.push({
        title: "Laporan",
        items: [{ name: "Pusat Laporan", icon: <TableIcon />, subItems: reportSubItems }],
      });
    } else if (role === "store_associate") {
      sections.push({
        title: "Menu Utama",
        items: [{ name: "Dashboard SA", icon: <GridIcon />, path: "/" }],
      });
      sections.push({
        title: "Input Data",
        items: [
          { name: "Input Omset", icon: <PlusIcon />, path: "/sa/revenue" },
          { name: "Waqaf & Member", icon: <DollarLineIcon />, path: "/sa/waqaf" },
          { name: "Pendaftaran Event", icon: <ListIcon />, path: "/sa/event-registration" },
        ],
      });
      sections.push({
        title: "Laporan Saya",
        items: [
          { name: "Rekap Harian", icon: <TableIcon />, path: "/reports/daily-recap" },
          { name: "Laporan Bulanan", icon: <PieChartIcon />, path: "/reports/monthly" },
        ],
      });
    } else if (role === "counter") {
      sections.push({
        title: "Menu Utama",
        items: [{ name: "Dashboard Counter", icon: <GridIcon />, path: "/" }],
      });
      sections.push({
        title: "Aktivitas Counter",
        items: [
          { name: "Input Omset Mingguan", icon: <DollarLineIcon />, path: "/counter/revenue" },
          { name: "Pendaftaran Event", icon: <ListIcon />, path: "/counter/event-registration" },
        ],
      });
      sections.push({
        title: "Laporan",
        items: [
          { name: "Rekap Omset", icon: <TableIcon />, path: "/reports/counter-weekly" },
        ],
      });
    } else {
      sections.push({
        title: "Menu Utama",
        items: [{ name: "Dashboard", icon: <GridIcon />, path: "/" }],
      });
    }

    return sections;
  };

  const sections = getMenuSections();

  useEffect(() => {
    let submenuMatched = false;
    sections.forEach((section, sIndex) => {
      section.items.forEach((item, iIndex) => {
        if (item.subItems) {
          item.subItems.forEach((sub) => {
            if (isActive(sub.path)) {
              setOpenSubmenu({ sectionIndex: sIndex, itemIndex: iIndex });
              submenuMatched = true;
            }
          });
        }
      });
    });

    if (!submenuMatched) setOpenSubmenu(null);
  }, [location, isActive]);

  useEffect(() => {
    if (openSubmenu !== null) {
      const key = `${openSubmenu.sectionIndex}-${openSubmenu.itemIndex}`;
      if (subMenuRefs.current[key]) {
        setSubMenuHeight((prev) => ({
          ...prev,
          [key]: subMenuRefs.current[key]?.scrollHeight || 0,
        }));
      }
    }
  }, [openSubmenu]);

  const handleSubmenuToggle = (sIndex: number, iIndex: number) => {
    setOpenSubmenu((prev) => {
      if (prev?.sectionIndex === sIndex && prev?.itemIndex === iIndex) return null;
      return { sectionIndex: sIndex, itemIndex: iIndex };
    });
  };

  const renderMenuItems = (items: NavItem[], sIndex: number) => (
    <ul className="flex flex-col gap-2">
      {items.map((nav, iIndex) => (
        <li key={nav.name}>
          {nav.subItems ? (
            <button
              onClick={() => handleSubmenuToggle(sIndex, iIndex)}
              className={`menu-item group ${
                openSubmenu?.sectionIndex === sIndex && openSubmenu?.itemIndex === iIndex
                  ? "menu-item-active"
                  : "menu-item-inactive"
              } cursor-pointer w-full ${
                !isExpanded && !isHovered ? "lg:justify-center" : "lg:justify-start"
              }`}
            >
              <span className={`menu-item-icon-size ${
                openSubmenu?.sectionIndex === sIndex && openSubmenu?.itemIndex === iIndex
                  ? "menu-item-icon-active" : "menu-item-icon-inactive"
              }`}>
                {nav.icon}
              </span>
              {(isExpanded || isHovered || isMobileOpen) && (
                <span className="menu-item-text">{nav.name}</span>
              )}
              {(isExpanded || isHovered || isMobileOpen) && (
                <ChevronDownIcon className={`ml-auto w-4 h-4 transition-transform duration-200 ${
                  openSubmenu?.sectionIndex === sIndex && openSubmenu?.itemIndex === iIndex ? "rotate-180" : ""
                }`} />
              )}
            </button>
          ) : (
            nav.path && (
              <Link
                to={nav.path}
                onClick={handleLinkClick}
                className={`menu-item group ${
                  isActive(nav.path) ? "menu-item-active" : "menu-item-inactive"
                } ${
                  !isExpanded && !isHovered ? "lg:justify-center" : "lg:justify-start"
                }`}
              >
                <span className={`menu-item-icon-size ${isActive(nav.path) ? "menu-item-icon-active" : "menu-item-icon-inactive"}`}>
                  {nav.icon}
                </span>
                {(isExpanded || isHovered || isMobileOpen) && (
                  <span className="menu-item-text">{nav.name}</span>
                )}
              </Link>
            )
          )}
          {nav.subItems && (isExpanded || isHovered || isMobileOpen) && (
            <div
              ref={(el) => { subMenuRefs.current[`${sIndex}-${iIndex}`] = el; }}
              className="overflow-hidden transition-all duration-300"
              style={{
                height: openSubmenu?.sectionIndex === sIndex && openSubmenu?.itemIndex === iIndex
                  ? `${subMenuHeight[`${sIndex}-${iIndex}`]}px` : "0px",
              }}
            >
              <ul className="mt-1 space-y-1 ml-9">
                {nav.subItems.map((subItem) => (
                  <li key={subItem.name}>
                    <Link
                      to={subItem.path}
                      onClick={handleLinkClick}
                      className={`menu-dropdown-item ${isActive(subItem.path) ? "menu-dropdown-item-active" : "menu-dropdown-item-inactive"}`}
                    >
                      {subItem.name}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </li>
      ))}
    </ul>
  );

  return (
    <aside
      className={`fixed mt-16 flex flex-col lg:mt-0 top-0 px-5 left-0 bg-white dark:bg-gray-900 text-gray-900 h-screen transition-all duration-300 ease-in-out z-50 border-r border-gray-200 dark:border-gray-800
        ${isExpanded || isMobileOpen || isHovered ? "w-[290px]" : "w-[90px]"}
        ${isMobileOpen ? "translate-x-0" : "-translate-x-full"}
        lg:translate-x-0`}
      onMouseEnter={() => !isExpanded && setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      <div className={`py-8 flex ${!isExpanded && !isHovered ? "lg:justify-center" : "justify-start"}`}>
        <Link to="/">
          {isExpanded || isHovered || isMobileOpen ? (
            <div className="flex items-center gap-3">
               <div className="w-10 h-10 bg-brand-600 rounded-xl flex items-center justify-center text-white font-bold shadow-lg shadow-brand-200 dark:shadow-none">G</div>
               <div className="flex flex-col">
                  <span className="font-bold text-lg leading-tight tracking-tight text-gray-900 dark:text-white">Gramedia</span>
                  <span className="text-xs text-gray-500 font-medium tracking-widest uppercase">Kendari</span>
               </div>
            </div>
          ) : (
            <div className="w-10 h-10 bg-brand-600 rounded-xl flex items-center justify-center text-white font-bold text-xl shadow-lg shadow-brand-200 dark:shadow-none">G</div>
          )}
        </Link>
      </div>

      <div className="flex flex-col overflow-y-auto duration-300 ease-linear no-scrollbar flex-1 pb-10">
        <nav className="mb-6">
          <div className="flex flex-col gap-8">
            {sections.map((section, sIndex) => (
              <div key={section.title}>
                <h2 className={`mb-4 text-[10px] font-bold uppercase tracking-[2px] flex leading-[20px] text-gray-400 ${
                  !isExpanded && !isHovered ? "lg:justify-center" : "justify-start"
                }`}>
                  {isExpanded || isHovered || isMobileOpen ? section.title : <HorizontaLDots className="size-5" />}
                </h2>
                {renderMenuItems(section.items, sIndex)}
              </div>
            ))}
          </div>
        </nav>
      </div>

      <div className="py-6 border-t border-gray-100 dark:border-gray-800">
          <button
            onClick={() => signOut()}
            className={`menu-item group menu-item-inactive hover:text-error-500 w-full ${!isExpanded && !isHovered ? "lg:justify-center" : "lg:justify-start"}`}
          >
            <span className="menu-item-icon-size group-hover:text-error-500">
              <LogOutIcon />
            </span>
            {(isExpanded || isHovered || isMobileOpen) && (
              <span className="menu-item-text font-bold text-gray-600 dark:text-gray-400">Keluar Sistem</span>
            )}
          </button>
      </div>
    </aside>
  );
};

export default AppSidebar;
