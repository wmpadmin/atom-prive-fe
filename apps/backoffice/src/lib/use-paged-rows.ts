import { useState } from "react";
import { DEFAULT_PAGE_SIZE } from "./page-sizes";

/**
 * Pages a list already held in the browser, for tables the API sends whole — supported banks, FX rates, a bank's
 * incoming fields. The page is clamped to what is left, so narrowing a filter or asking for more rows per page while
 * on a later page shows rows rather than an empty table.
 */
export function usePagedRows<T>(rows: readonly T[], startingPageSize: number = DEFAULT_PAGE_SIZE) {
  const [wanted, setPage] = useState(0);
  const [pageSize, setPageSize] = useState(startingPageSize);
  const lastPage = Math.max(0, Math.ceil(rows.length / pageSize) - 1);
  const page = Math.min(wanted, lastPage);
  return {
    page,
    setPage,
    pageSize,
    setPageSize: (size: number) => {
      setPageSize(size);
      setPage(0);
    },
    totalItems: rows.length,
    shown: rows.slice(page * pageSize, (page + 1) * pageSize),
  };
}
