import { ApiError } from "@atomprive/api-client";
import {
  exportBankFieldMapping,
  exportEmailTemplates,
  exportFxRates,
  exportSupportedBanks,
  useGetFieldMappingSummary,
  type MappingSummary,
} from "@atomprive/api-client/backoffice";
import { Alert, Button, cn } from "@atomprive/ui";
import { Download, PencilLine } from "lucide-react";
import { useState, type KeyboardEvent } from "react";
import { useSearchParams } from "react-router";
import { downloadTextFile } from "../../lib/download";
import { BanksTab } from "./banks-tab";
import { EmailTemplatesTab } from "./email-templates-tab";
import { FieldMappingTab } from "./field-mapping-tab";
import { FxRatesTab } from "./fx-rates-tab";
import { OffboardingTab } from "./offboarding-tab";

const tabs = [
  { id: "banks", title: "Supported banks", subtitle: "Connections & schedules" },
  { id: "mapping", title: "Format mapping & alerts", subtitle: "Field mapping" },
  { id: "offboarding", title: "Deactivation & deletion", subtitle: "Off-boarding approvals" },
  { id: "fx", title: "FX rates", subtitle: "Daily rates in USD" },
  { id: "templates", title: "Email templates", subtitle: "Subject, body, versions" },
] as const;

type TabId = (typeof tabs)[number]["id"];

/** Admin-only configuration (#98, #100–#102, N3). The open tab, bank and template live in the URL. */
export function ConfigPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const active: TabId = tabs.find((tab) => tab.id === searchParams.get("tab"))?.id ?? "banks";
  const summary = useGetFieldMappingSummary<MappingSummary, ApiError>();
  const [exporting, setExporting] = useState(false);
  const [exportError, setExportError] = useState<string>();
  const [creatingTemplate, setCreatingTemplate] = useState(false);
  // The mapping tab shows the first bank until one is picked.
  const bankId = searchParams.get("bank") ?? summary.data?.banks[0]?.bankId ?? null;

  function select(tab: TabId) {
    setExportError(undefined);
    setSearchParams({ tab }, { replace: true });
  }

  function handleTabKeys(event: KeyboardEvent<HTMLDivElement>) {
    const index = tabs.findIndex((tab) => tab.id === active);
    const next = event.key === "ArrowRight" ? index + 1 : event.key === "ArrowLeft" ? index - 1 : null;
    if (next === null) return;
    event.preventDefault();
    const tab = tabs[(next + tabs.length) % tabs.length];
    select(tab.id);
    document.getElementById(`config-tab-${tab.id}`)?.focus();
  }

  async function exportActiveTab() {
    setExporting(true);
    setExportError(undefined);
    const today = new Date().toISOString().slice(0, 10);
    try {
      if (active === "banks") downloadCsv(`supported-banks-${today}.csv`, await exportSupportedBanks());
      if (active === "mapping" && bankId) downloadCsv(`field-mapping-${today}.csv`, await exportBankFieldMapping(bankId));
      if (active === "fx") downloadCsv(`fx-rates-${today}.csv`, await exportFxRates());
      if (active === "templates") downloadCsv(`email-templates-${today}.csv`, await exportEmailTemplates());
    } catch (caught) {
      setExportError(caught instanceof ApiError ? caught.message : "Couldn't export. Try again.");
    } finally {
      setExporting(false);
    }
  }

  const canExport = active !== "offboarding" && !(active === "mapping" && !bankId);

  return (
    <div className="space-y-6">
      <header className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
        <div className="min-w-0">
          <h1 className="text-[1.625rem] font-bold">Config &amp; reference data</h1>
          <p className="mt-1 text-sm text-ink-muted">
            Banks, field mapping, off-boarding approvals, FX rates and email templates. Every change here is written to the
            audit log with your name and timestamp.
          </p>
        </div>
        <div className="flex shrink-0 gap-3">
          <Button variant="secondary" onClick={() => void exportActiveTab()} disabled={exporting || !canExport}>
            <Download aria-hidden="true" />
            {exporting ? "Exporting…" : "Export"}
          </Button>
          {active === "templates" && (
            <Button onClick={() => setCreatingTemplate(true)}>
              <PencilLine aria-hidden="true" />
              Create template
            </Button>
          )}
        </div>
      </header>

      {exportError && <Alert tone="danger">{exportError}</Alert>}

      <div
        role="tablist"
        aria-label="Configuration"
        onKeyDown={handleTabKeys}
        className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5"
      >
        {tabs.map((tab) => {
          const selected = tab.id === active;
          const badge = tab.id === "mapping" ? summary.data?.unmappedFields : undefined;
          return (
            <button
              key={tab.id}
              id={`config-tab-${tab.id}`}
              type="button"
              role="tab"
              aria-selected={selected}
              aria-controls="config-panel"
              tabIndex={selected ? 0 : -1}
              onClick={() => select(tab.id)}
              className={cn(
                "rounded-xl border px-3.5 py-2.5 text-left transition-colors",
                "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary-600",
                selected ? "border-primary-600 bg-primary-600 text-white shadow-sm" : "border-line bg-white hover:border-primary-100",
              )}
            >
              <span className="flex items-center gap-1.5 text-sm font-semibold whitespace-nowrap">
                {tab.title}
                {badge ? (
                  <span
                    aria-label={`${badge} unmapped`}
                    className="grid min-w-4 place-items-center rounded-full bg-red-600 px-1 text-3xs leading-4 font-bold text-white"
                  >
                    {badge}
                  </span>
                ) : null}
              </span>
              <span className={cn("block text-xs", selected ? "text-white/80" : "text-ink-muted")}>{tab.subtitle}</span>
            </button>
          );
        })}
      </div>

      <div id="config-panel" role="tabpanel" aria-labelledby={`config-tab-${active}`}>
        {active === "banks" && <BanksTab />}
        {active === "mapping" && <FieldMappingTab />}
        {active === "offboarding" && <OffboardingTab />}
        {active === "fx" && <FxRatesTab />}
        {active === "templates" && (
          <EmailTemplatesTab creating={creatingTemplate} onCreatingChange={setCreatingTemplate} />
        )}
      </div>
    </div>
  );
}

function downloadCsv(filename: string, csv: string) {
  downloadTextFile(filename, csv, "text/csv;charset=utf-8");
}
