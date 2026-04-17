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

const AppSidebar: React.FC = () => {
  const { isExpanded, isMobileOpen, isHovered, setIsHovered } = useSidebar();
  const location = useLocation();
  const { profile, signOut } = useAuthStore();

  const [openSubmenu, setOpenSubmenu] = useState<{
    type: string;
    index: number;
  } | null>(null);
  const [subMenuHeight, setSubMenuHeight] = useState<Record<string, number>>({});
  const subMenuRefs = useRef<Record<string, HTMLDivElement | null>>({});

  const isActive = useCallback(
    (path: string) => location.pathname === path,
    [location.pathname]
  );

  // Define menu based on role
  const getNavItems = (): NavItem[] => {
    const role = profile?.role;

    if (role === "store_manager") {
      return [
        { name: "Dashboard SM", icon: <GridIcon />, path: "/" },
        { name: "Kelola User", icon: <GroupIcon />, path: "/sm/users" },
        { name: "Kelola Dept", icon: <FolderIcon />, path: "/sm/departments" },
        { name: "Target Omset", icon: <DollarLineIcon />, path: "/sm/targets" },
        {
          name: "Laporan",
          icon: <PieChartIcon />,
          subItems: [
            { name: "Omset Harian", path: "/reports/daily" },
            { name: "Rekap Omset Harian", path: "/reports/daily-recap" },
            { name: "Omset Bulanan", path: "/reports/monthly" },
            { name: "Waqaf & Member", path: "/reports/waqaf-member" },
          ],
        },
      ];
    }

    if (role === "supervisor") {
      return [
        { name: "Dashboard SPV", icon: <GridIcon />, path: "/" },
        { name: "Kelola Tim SA", icon: <GroupIcon />, path: "/spv/sa" },
        { name: "Penugasan Dept", icon: <ListIcon />, path: "/spv/assign" },
        { name: "Verifikasi Omset", icon: <CheckCircleIcon />, path: "/spv/verify" },
        { name: "Input Omset SA", icon: <PlusIcon />, path: "/spv/input-revenue" },
        { name: "Target Dept", icon: <DollarLineIcon />, path: "/spv/targets" },
        { name: "Target WAQAF/Member", icon: <PlusIcon />, path: "/spv/waqaf-targets" },
        {
          name: "Laporan",
          icon: <TableIcon />,
          subItems: [
            { name: "Omset Dept", path: "/reports/dept" },
            { name: "Rekap Omset Harian", path: "/reports/daily-recap" },
            { name: "Waqaf & Member", path: "/reports/waqaf-member" },
            { name: "Kegiatan SA", path: "/reports/activities" },
          ],
        },
      ];
    }

    if (role === "store_associate") {
      return [
        { name: "Dashboard SA", icon: <GridIcon />, path: "/" },
        { name: "Input Omset", icon: <PlusIcon />, path: "/sa/revenue" },
        { name: "Waqaf & Member", icon: <DollarLineIcon />, path: "/sa/waqaf" },
        { name: "Rekap Omset Harian", icon: <TableIcon />, path: "/reports/daily-recap" },
        { name: "Laporan Bulanan", icon: <PieChartIcon />, path: "/reports/monthly" },
      ];
    }

    // Default basic menu if role not identified
    return [{ name: "Dashboard", icon: <GridIcon />, path: "/" }];
  };

  const navItems = getNavItems();

  useEffect(() => {
    let submenuMatched = false;
    navItems.forEach((nav, index) => {
      if (nav.subItems) {
        nav.subItems.forEach((subItem) => {
          if (isActive(subItem.path)) {
            setOpenSubmenu({ type: "main", index });
            submenuMatched = true;
          }
        });
      }
    });

    if (!submenuMatched) {
      setOpenSubmenu(null);
    }
  }, [location, isActive]);

  useEffect(() => {
    if (openSubmenu !== null) {
      const key = `${openSubmenu.type}-${openSubmenu.index}`;
      if (subMenuRefs.current[key]) {
        setSubMenuHeight((prevHeights) => ({
          ...prevHeights,
          [key]: subMenuRefs.current[key]?.scrollHeight || 0,
        }));
      }
    }
  }, [openSubmenu]);

  const handleSubmenuToggle = (index: number) => {
    setOpenSubmenu((prevOpenSubmenu) => {
      if (prevOpenSubmenu && prevOpenSubmenu.index === index) {
        return null;
      }
      return { type: "main", index };
    });
  };

  const renderMenuItems = (items: NavItem[]) => (
    <ul className="flex flex-col gap-4">
      {items.map((nav, index) => (
        <li key={nav.name}>
          {nav.subItems ? (
            <button
              onClick={() => handleSubmenuToggle(index)}
              className={`menu-item group ${
                openSubmenu?.index === index
                  ? "menu-item-active"
                  : "menu-item-inactive"
              } cursor-pointer ${
                !isExpanded && !isHovered
                  ? "lg:justify-center"
                  : "lg:justify-start"
              }`}
            >
              <span
                className={`menu-item-icon-size ${
                  openSubmenu?.index === index
                    ? "menu-item-icon-active"
                    : "menu-item-icon-inactive"
                }`}
              >
                {nav.icon}
              </span>
              {(isExpanded || isHovered || isMobileOpen) && (
                <span className="menu-item-text">{nav.name}</span>
              )}
              {(isExpanded || isHovered || isMobileOpen) && (
                <ChevronDownIcon
                  className={`ml-auto w-5 h-5 transition-transform duration-200 ${
                    openSubmenu?.index === index ? "rotate-180 text-brand-500" : ""
                  }`}
                />
              )}
            </button>
          ) : (
            nav.path && (
              <Link
                to={nav.path}
                className={`menu-item group ${
                  isActive(nav.path) ? "menu-item-active" : "menu-item-inactive"
                } ${
                  !isExpanded && !isHovered
                    ? "lg:justify-center"
                    : "lg:justify-start"
                }`}
              >
                <span
                  className={`menu-item-icon-size ${
                    isActive(nav.path)
                      ? "menu-item-icon-active"
                      : "menu-item-icon-inactive"
                  }`}
                >
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
              ref={(el) => {
                subMenuRefs.current[`main-${index}`] = el;
              }}
              className="overflow-hidden transition-all duration-300"
              style={{
                height:
                  openSubmenu?.index === index
                    ? `${subMenuHeight[`main-${index}`]}px`
                    : "0px",
              }}
            >
              <ul className="mt-2 space-y-1 ml-9">
                {nav.subItems.map((subItem) => (
                  <li key={subItem.name}>
                    <Link
                      to={subItem.path}
                      className={`menu-dropdown-item ${
                        isActive(subItem.path)
                          ? "menu-dropdown-item-active"
                          : "menu-dropdown-item-inactive"
                      }`}
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
        ${
          isExpanded || isMobileOpen || isHovered
            ? "w-[290px]"
            : "w-[90px]"
        }
        ${isMobileOpen ? "translate-x-0" : "-translate-x-full"}
        lg:translate-x-0`}
      onMouseEnter={() => !isExpanded && setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      <div
        className={`py-8 flex ${
          !isExpanded && !isHovered ? "lg:justify-center" : "justify-start"
        }`}
      >
        <Link to="/">
          {isExpanded || isHovered || isMobileOpen ? (
            <div className="flex items-center gap-3">
               <div className="w-10 h-10 bg-brand-500 rounded-lg flex items-center justify-center text-white font-bold">G</div>
               <span className="font-bold text-xl tracking-tight">K-Tracker</span>
            </div>
          ) : (
            <div className="w-10 h-10 bg-brand-500 rounded-lg flex items-center justify-center text-white font-bold text-xl">G</div>
          )}
        </Link>
      </div>

      <div className="flex flex-col overflow-y-auto duration-300 ease-linear no-scrollbar flex-1">
        <nav className="mb-6">
          <div className="flex flex-col gap-4">
            <div>
              <h2
                className={`mb-4 text-xs uppercase flex leading-[20px] text-gray-400 ${
                  !isExpanded && !isHovered
                    ? "lg:justify-center"
                    : "justify-start"
                }`}
              >
                {isExpanded || isHovered || isMobileOpen ? (
                  "Menu Utama"
                ) : (
                  <HorizontaLDots className="size-6" />
                )}
              </h2>
              {renderMenuItems(navItems)}
            </div>
          </div>
        </nav>
      </div>

      {/* Logout Section */}
      <div className="py-6 border-t border-gray-100 dark:border-gray-800">
          <button
            onClick={() => signOut()}
            className={`menu-item group menu-item-inactive hover:text-error-500 w-full ${
              !isExpanded && !isHovered ? "lg:justify-center" : "lg:justify-start"
            }`}
          >
            <span className="menu-item-icon-size group-hover:text-error-500">
              <LogOutIcon />
            </span>
            {(isExpanded || isHovered || isMobileOpen) && (
              <span className="menu-item-text">Log Out</span>
            )}
          </button>
      </div>
    </aside>
  );
};

export default AppSidebar;
