import { Outlet, useLocation } from "react-router-dom";
import { twMerge } from "tailwind-merge";
import { SideBar } from "../components/side_bar";

export const SideBarLayout = () => {
  const routesWithoutSideBar = ["/login", "/privacy-policy"];
  const location = useLocation();
  const withSideBar = !routesWithoutSideBar.includes(location.pathname);

  return (
    <div className="flex flex-row min-h-screen overflow-x-hidden">
      {withSideBar && <SideBar />}
      <div
        className={twMerge(
          "bg-[#1E2638] w-full relative main-content-wrapper",
          withSideBar && "ml-20",
        )}
      >
        <div className="relative px-8 sm:px-12 py-6 sm:py-8">
          <Outlet />
        </div>
      </div>
    </div>
  );
};
