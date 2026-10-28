/** The one pill every access-request screen uses to say what state a request is in. */
import { SAID, TONE, type Status } from "./access-requests";
import { Pill } from "./panels";

export function StatusPill({ status }: { status: Status }) {
  return <Pill tone={TONE[status]}>{SAID[status]}</Pill>;
}
