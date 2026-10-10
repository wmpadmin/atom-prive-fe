import { Alert } from "@atomprive/ui";
import { Link } from "react-router";

/**
 * What to do when the firm's sheet is not finished.
 *
 * <p>Compliance writes it, so for anybody else the honest answer is who to ask. Said here rather than left
 * to be worked out: an empty screen with a list of faults on it is a dead end.
 */
export function SheetNotReady({ faults, mayRead }: { faults: string[]; mayRead: boolean }) {
  return (
    <Alert tone="warning">
      <p className="font-semibold">Nobody has finished the firm's risk matrix, so nothing can be scored yet.</p>
      <ul className="mt-2 list-disc space-y-0.5 pl-5 text-sm">
        {faults.map((fault) => (
          <li key={fault}>{fault}</li>
        ))}
      </ul>
      <p className="mt-2 text-sm">
        Compliance writes the matrix — its questions, what each answer is worth, and where the bands fall.
        {mayRead && (
          <>
            {" "}
            <Link to="/aml-risk/matrix" className="font-semibold underline">
              Open the matrix
            </Link>
          </>
        )}
      </p>
    </Alert>
  );
}
