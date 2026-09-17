import { createBrowserRouter } from "react-router";
import { AppLayout } from "./app-layout";

// Customer screens start after the back-office foundation is in place.
export const router = createBrowserRouter([
  {
    path: "/",
    element: <AppLayout />,
    children: [{ index: true, element: <p className="text-slate-600">Customer portal</p> }],
  },
]);
