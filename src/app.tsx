import { useLocation, useRoutes } from "react-router-dom";
import { routes } from "./routes/routes";
import { useDemoMode } from "./hooks/useDemoMode";
import { type ReactNode, useLayoutEffect } from "react";
import { scrollToTop } from "./utils/scroll_to_top";
import { DevIndicator } from "./components/ui/dev-indicator";
import { ToastContainer } from "react-toastify";

const Wrapper = ({ children }: { children: ReactNode }) => {
  const location = useLocation();

  // biome-ignore lint/correctness/useExhaustiveDependencies: <explanation>
  useLayoutEffect(() => {
    scrollToTop();
  }, [location.pathname]);

  return children;
};

const App = () => {
  useDemoMode();
  const element = useRoutes([routes]);
  return (
    <Wrapper>
      {element}
      <DevIndicator />
      <ToastContainer
        position="top-right"
        autoClose={5000}
        hideProgressBar={false}
        newestOnTop={false}
        closeOnClick
        rtl={false}
        pauseOnFocusLoss
        draggable
        pauseOnHover
        theme="light"
      />
    </Wrapper>
  );
};

export default App;
