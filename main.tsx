import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import { QueryClientProvider } from "@tanstack/react-query";
import "./index.css";
import dayjs from "dayjs";
import App from "./app";
import "dayjs/locale/fr";
import "./i18n";
import isSameOrAfter from "dayjs/plugin/isSameOrAfter";
import isSameOrBefore from "dayjs/plugin/isSameOrBefore";
import { queryClient } from "./lib/query/queryClient";
import "react-toastify/dist/ReactToastify.css";

dayjs.locale("fr");
dayjs.extend(isSameOrAfter);
dayjs.extend(isSameOrBefore);

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <App />
      </BrowserRouter>
    </QueryClientProvider>
  </StrictMode>,
);
