import { QueueActions } from "../../components/queue-actions";
import { ListReportButton } from "../layout/list-report";
import { ReportMenu } from "../layout/report";

/**
 * The top of the proposals screen: what it is and what can be done from it.
 *
 * <p>Named for the thing and not for a direction. "Sent" was true for a relationship manager, who sends
 * what is on this list, and false for whoever reads every relationship manager's — and flatly confusing for
 * somebody holding both roles, who sends some of these and oversees the rest.
 *
 * <p>No line of its own saying whose proposals these are. It said what the screen already says: the tab
 * that opened it is named, the card below is named, and every row carries the relationship manager who
 * wrote it — so the sentence was a third naming, set above the filter row it had nothing to do with.
 *
 * <p>No search of its own either. Above the list the search sits in the filter row with everything else
 * that narrows it, and above an open proposal there is nothing on the page for a search to narrow —
 * typing in it sent the reader off the document they had just opened.
 *
 * <p>It sits above an open proposal as well as above the list, so opening one never loses the way back to
 * everything else — the screen is the list, and a proposal is read within it.
 */
export function ProposalsHeader(props: {
  /** Above the list: the whole list as filtered, as PDF or Excel. */
  report: { list: string; load: () => Promise<string>; filters?: string; columns?: string[] };
} | {
  /** Above one open proposal: that proposal, as a PDF. */
  onExport: (kind: "pdf" | "excel") => void;
  exporting: "pdf" | "excel" | null;
}) {
  return (
    // No box of its own. Above a list the buttons go up to the screen's heading row, where there was room
    // for them.
    //
    // Only what can be done, at the end of the row. This header stands above the approvals queue and above
    // Trade logs, and on neither of them does starting a fresh piece of advice belong: one is a queue of what
    // is waiting on somebody, the other the record of rebalances already asked for. What the button makes
    // changes with what is below it — the list reports the list, and a proposal prints itself.
    <QueueActions className="flex flex-wrap items-center justify-end gap-2">
      {"report" in props ? (
        <ListReportButton list={props.report.list} load={props.report.load} filters={props.report.filters} columns={props.report.columns} />
      ) : (
        <ReportMenu busy={props.exporting} problem={null} onPick={props.onExport}
          excel="A sheet for each table: the moves, the plan, the holdings" />
      )}
    </QueueActions>
  );
}
