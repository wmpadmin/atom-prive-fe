import { ApiError } from "@atomprive/api-client";
import { getListFormCatalogueQueryKey, useListFormCatalogue, type CatalogueEntry } from "@atomprive/api-client/backoffice";
import { Alert, Button, cn } from "@atomprive/ui";
import { useQueryClient } from "@tanstack/react-query";
import { FolderTree } from "lucide-react";
import { useState } from "react";
import { useStaffUser } from "../../auth/session";
import { hasAuthority } from "../../lib/permissions";
import { FormCategoriesDialog } from "./form-categories-dialog";
import { categoryLabels } from "./form-labels";

/** Every form in the client pack, and which kinds of account each is used by. */
export function FormsPage() {
  const user = useStaffUser();
  const canChange = hasAuthority(user, "ONBOARD_CLIENTS:CHANGE");
  const queryClient = useQueryClient();
  const [recategorising, setRecategorising] = useState<CatalogueEntry | null>(null);
  const pack = useListFormCatalogue<CatalogueEntry[], ApiError>();

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-[1.625rem] font-bold">Forms</h1>
        <p className="mt-1 text-sm text-ink-muted">
          Every form a client signs when their account is opened. Each one is asked for on the client's onboarding case,
          under Client documents.
        </p>
      </header>

      {pack.isError && <Alert tone="danger">{pack.error.message}</Alert>}

      <div className="overflow-x-auto rounded-2xl border border-line bg-white">
        <table className="min-w-full text-sm">
          <thead>
            <tr className="border-b border-line text-left text-2xs font-semibold tracking-wider text-ink-muted uppercase">
              <th scope="col" className="py-3 pr-4 pl-5">Form</th>
              <th scope="col" className="px-4 py-3">Category</th>
              <th scope="col" className="py-3 pr-5 pl-4 text-right">Action</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-line">
            {pack.isPending && (
              <tr>
                <td colSpan={3} className="px-5 py-8 text-center text-ink-muted">Loading the pack…</td>
              </tr>
            )}
            {(pack.data ?? []).map((form) => (
              // Clicking the form does what the form's Action does, rather than only the word at the end of the line.
              <tr
                key={form.kind}
                onClick={canChange ? () => setRecategorising(form) : undefined}
                className={cn(canChange && "cursor-pointer hover:bg-slate-50")}
              >
                <td className="py-3 pr-4 pl-5 font-semibold">{form.title}</td>
                <td className="px-4 py-3">
                  <span className="flex flex-wrap gap-1">
                    {form.categories.map((held) => (
                      <span key={held} className="rounded-md bg-slate-100 px-1.5 py-0.5 text-2xs font-semibold text-ink-soft">
                        {categoryLabels[held]}
                      </span>
                    ))}
                  </span>
                </td>
                <td className="py-3 pr-5 pl-4 text-right">
                  {canChange && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={(event) => {
                        // The row opens this as well; once is enough.
                        event.stopPropagation();
                        setRecategorising(form);
                      }}
                    >
                      <FolderTree aria-hidden="true" />
                      Categories
                    </Button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <FormCategoriesDialog
        form={recategorising}
        onClose={() => setRecategorising(null)}
        onChanged={(changed) => queryClient.setQueryData(getListFormCatalogueQueryKey(), changed)}
      />
    </div>
  );
}
