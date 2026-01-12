import type { ReactNode } from "react";
import { Link, useLocation } from "react-router-dom";
import { twMerge } from "tailwind-merge";
import { Popover, PopoverTrigger, PopoverContent } from "./ui/popover";
import { useState } from "react";
import { useHoverWithDelay } from "../hooks/useHoverWithDelay";

interface ISideBarItemProps {
  href: string;
  label: string;
  icon: ReactNode;
  popoverContent?: ReactNode;
  popoverOpenOnHover?: boolean;
}

export const SideBarItem = ({ href, label, icon, popoverContent, popoverOpenOnHover }: ISideBarItemProps) => {
  const pathname = useLocation();
  const isActive = pathname.pathname === href;

  const [open, setOpen] = useState(false);
  const { handleMouseEnter, handleMouseLeave } = useHoverWithDelay(() => setOpen(true), () => setOpen(false));

  const baseClasses =
    "group flex flex-row items-center justify-center text-md font-medium p-3 w-12 h-12 rounded-xl border border-white/20 transition-all duration-200 relative overflow-visible";
  const hoverClasses =
    "hover:text-blue-200 hover:bg-white/10 hover:shadow-lg hover:scale-[1.06]";
  const activeClasses =
    "text-blue-300 bg-white/10 shadow-[0_2px_16px_-2px_rgba(72,216,255,0.10)] border-l-4 border-blue-400 pl-2";
  const iconBase = "transition-transform duration-200 group-hover:scale-110";
  const iconActive = "text-blue-300 opacity-100";
  const iconInactive = "opacity-70 group-hover:opacity-90";

  if (popoverContent) {
    if (popoverOpenOnHover) {
      return (
        <Popover open={open} onOpenChange={setOpen}>
          <PopoverTrigger asChild>
            <Link
              to={href}
              className={twMerge(
                baseClasses,
                hoverClasses,
                isActive && activeClasses
              )}
              onMouseEnter={handleMouseEnter}
              onMouseLeave={handleMouseLeave}
            >
              <span className={twMerge(iconBase, isActive ? iconActive : iconInactive)}>
                {icon}
              </span>
              {!popoverContent && (
                <span className="absolute left-full ml-2 px-2 py-1 bg-[#1E2638] text-white text-sm rounded opacity-0 group-hover:opacity-100 transition-opacity duration-200 whitespace-nowrap border border-white/10">
                  {label}
                </span>
              )}
            </Link>
          </PopoverTrigger>
          <PopoverContent side="right" align="start" sideOffset={8} className="p-0 w-96" onMouseEnter={handleMouseEnter} onMouseLeave={handleMouseLeave}>
            {popoverContent}
          </PopoverContent>
        </Popover>
      );
    }
    return (
      <Popover>
        <PopoverTrigger asChild>
          <Link
            to={href}
            className={twMerge(
              baseClasses,
              hoverClasses,
              isActive && activeClasses
            )}
          >
            <span className={twMerge(iconBase, isActive ? iconActive : iconInactive)}>
              {icon}
            </span>
            <span className="absolute left-full ml-2 px-2 py-1 bg-[#1E2638] text-white text-sm rounded opacity-0 group-hover:opacity-100 transition-opacity duration-200 whitespace-nowrap border border-white/10">
              {label}
            </span>
          </Link>
        </PopoverTrigger>
        <PopoverContent side="right" align="start" sideOffset={8} className="p-0 w-96">
          {popoverContent}
        </PopoverContent>
      </Popover>
    );
  }

  return (
    <Link
      to={href}
      className={twMerge(
        baseClasses,
        hoverClasses,
        isActive && activeClasses
      )}
    >
      <span className={twMerge(iconBase, isActive ? iconActive : iconInactive)}>
        {icon}
      </span>
      <span className="absolute left-full ml-2 px-2 py-1 bg-[#1E2638] text-white text-sm rounded opacity-0 group-hover:opacity-100 transition-opacity duration-200 whitespace-nowrap border border-white/10">
        {label}
      </span>
    </Link>
  );
};
