import { ChartNoAxesCombined, Gauge, LayoutDashboard, List, Network, ShieldCheck, TrendingUp, type LucideIcon } from "lucide-react";

/**
 * The screens of a client's workspace, in the order its side menu lists them.
 *
 * <p>Only the screens that are built. The firm's design has ten — Fixed Income, Private Markets, Collectibles — and
 * each joins this list, and the router, the day it is built: a menu entry that leads nowhere is worse than none.
 *
 * @property path under /client-workspace/:customerId; empty for the screen the workspace opens on
 * @property group the heading it sits under in the side menu, where it has one
 */
export type WorkspaceScreen = { id: string; label: string; path: string; icon: LucideIcon; group?: string };

export const WORKSPACE_SCREENS: WorkspaceScreen[] = [
  { id: "overview", label: "Overview", path: "", icon: LayoutDashboard },
  { id: "structure", label: "Entity Structure", path: "structure", icon: Network },
  { id: "ips", label: "IPS Monitoring", path: "ips", icon: ShieldCheck },
  { id: "holdings", label: "Consolidated Holdings", path: "holdings", icon: List },
  { id: "performance", label: "Performance & Attribution", path: "performance", icon: ChartNoAxesCombined },
  { id: "risk", label: "Risk & Exposure", path: "risk", icon: Gauge },
  { id: "equity", label: "Equity Analytics", path: "equity", icon: TrendingUp, group: "Asset class analytics" },
];

/** Where one client's workspace opens. */
export function workspaceOf(customerId: string, screen = "") {
  return `/client-workspace/${customerId}${screen ? `/${screen}` : ""}`;
}
