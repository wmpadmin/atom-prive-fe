import { Badge, Button, SelectInput, Switch } from "@atomprive/ui";
import { Download, Eye, Plug, ShieldAlert, Trash2 } from "lucide-react";
import { Link } from "react-router";
import { NotYet, Pair, Panel, Setting, Settings, SwitchRow } from "./settings-parts";

/**
 * What the platform holds about a reader, and what it does with it.
 *
 * <p>Not one panel here is wired, and that is worth being exact about rather than vague. A staff member
 * cannot export their own record, cannot set how long their own trail is kept, has no connected
 * applications to revoke and cannot deactivate themselves — the last on purpose, since a member of staff
 * walking out of their own account would leave the firm with an orphaned book of clients, so it is an
 * Admin's to do.
 *
 * <p>So the panels are drawn to the firm's design and each says plainly what it would do and that it does
 * not do it yet. What the platform genuinely records about a reader is already readable: the audit log
 * holds every action, and an Admin reads it.
 */
export function DataPrivacyTab() {
  return (
    <div className="space-y-6">
      <Pair>
        <Panel
          icon={<Download />}
          title="Your own record"
          lead="Everything the platform holds about you as a member of staff, in one file."
        >
          <ul className="space-y-1.5 text-sm text-ink-soft">
            <li className="flex gap-2">
              <span aria-hidden="true" className="mt-1.5 size-1.5 shrink-0 rounded-full bg-slate-300" />
              Your profile, roles and the desk you open at
            </li>
            <li className="flex gap-2">
              <span aria-hidden="true" className="mt-1.5 size-1.5 shrink-0 rounded-full bg-slate-300" />
              Every action you have taken, from the audit log
            </li>
            <li className="flex gap-2">
              <span aria-hidden="true" className="mt-1.5 size-1.5 shrink-0 rounded-full bg-slate-300" />
              Every session, with where it was signed in from
            </li>
            <li className="flex gap-2">
              <span aria-hidden="true" className="mt-1.5 size-1.5 shrink-0 rounded-full bg-slate-300" />
              The nine declarations you have signed
            </li>
          </ul>
          <div className="mt-4 flex flex-wrap gap-2">
            <Button variant="secondary" disabled>
              Download as JSON
            </Button>
            <Button variant="secondary" disabled>
              Download as CSV
            </Button>
          </div>
          <NotYet>
            Not connected yet. There is no endpoint that gathers a staff member's own record, and nothing
            here would produce a file.
          </NotYet>
        </Panel>

        <Panel
          icon={<Eye />}
          title="What is recorded about you"
          lead="The firm records what staff do on client data. This is not a setting — it is how the platform works."
        >
          <SwitchRow title="Every action you take" lead="Who, what, which client, when and from where.">
            <Badge tone="neutral">Always on</Badge>
          </SwitchRow>
          <SwitchRow title="Every client record you open" lead="Reading a client's file is itself recorded.">
            <Badge tone="neutral">Always on</Badge>
          </SwitchRow>
          <SwitchRow title="Every sign-in and sign-out" lead="Successful or not, with the device and address.">
            <Badge tone="neutral">Always on</Badge>
          </SwitchRow>
          <p className="mt-4 text-xs text-ink-muted">
            None of these can be turned off by anybody, including an Admin. A regulated firm has to be able
            to say afterwards who saw what. The{" "}
            <Link to="/audit-log" className="underline">
              audit log
            </Link>{" "}
            is where it is read.
          </p>
        </Panel>
      </Pair>

      <Panel
        icon={<ShieldAlert />}
        title="How long things are kept"
        lead="How far back the platform's own records go before they are thinned out."
      >
        <Settings>
          <Setting label="Audit trail" hint="Every action on client data.">
            <SelectInput id="retain-audit" value="forever" disabled onChange={() => {}}>
              <option value="forever">Kept indefinitely</option>
            </SelectInput>
          </Setting>
          <Setting label="Session history" hint="Where people have signed in.">
            <SelectInput id="retain-sessions" value="forever" disabled onChange={() => {}}>
              <option value="forever">Kept indefinitely</option>
            </SelectInput>
          </Setting>
          <Setting label="Notification log" hint="What the platform has sent.">
            <SelectInput id="retain-notifications" value="forever" disabled onChange={() => {}}>
              <option value="forever">Kept indefinitely</option>
            </SelectInput>
          </Setting>
          <Setting label="Uploaded documents" hint="Client paperwork and KYC files.">
            <SelectInput id="retain-documents" value="forever" disabled onChange={() => {}}>
              <option value="forever">Kept indefinitely</option>
            </SelectInput>
          </Setting>
        </Settings>
        <NotYet>
          Not connected yet, and shown as it actually behaves: nothing is thinned out or deleted on a
          schedule today, so every one of these reads indefinitely because that is the truth. Retention
          periods are a firm-wide policy decision, not a reader's, so when they arrive they will belong to
          an Admin rather than to this tab.
        </NotYet>
      </Panel>

      <Panel
        icon={<Plug />}
        title="Connected applications"
        lead="Anything outside the platform that has been given a way into your account."
      >
        <div className="overflow-x-auto">
          <table className="w-full min-w-[30rem]">
            <thead>
              <tr className="border-b border-line text-2xs font-semibold tracking-wider text-ink-muted uppercase">
                <th className="py-2 pr-4 text-left">Application</th>
                <th className="py-2 pr-4 text-left">What it may do</th>
                <th className="py-2 pr-4 text-left">Connected</th>
                <th className="py-2" />
              </tr>
            </thead>
            <tbody>
              <tr>
                <td colSpan={4} className="py-8 text-center text-sm text-ink-muted">
                  Nothing is connected to your account.
                </td>
              </tr>
            </tbody>
          </table>
        </div>
        <p className="mt-3 text-xs text-ink-muted">
          Accurate today: the platform issues no third-party access of any kind, so there is nothing here to
          revoke. Bank feeds are a firm-wide connection an Admin manages, not one of yours.
        </p>
      </Panel>

      <Panel
        icon={<Trash2 />}
        title="Leaving"
        lead="Closing your own account, and what the firm keeps when you do."
      >
        <div className="rounded-xl border border-rose-200 bg-rose-50/50 p-4">
          <p className="text-sm font-semibold text-ink">Deactivate my account</p>
          <p className="mt-1 text-sm text-ink-soft">
            Ends every session and takes away every way in. Your record and your trail stay — a regulated
            firm cannot delete who did what — and any client assigned to you has to be moved to another desk
            first.
          </p>
          <div className="mt-3 flex items-center gap-3">
            <Button variant="secondary" disabled>
              Deactivate my account
            </Button>
            <Switch on={false} label="I understand what deactivating does" disabled onChange={() => {}} />
          </div>
        </div>
        <NotYet>
          Not connected yet, and deliberately: a member of staff deactivating themselves would leave their
          clients unassigned and an approval queue with nobody at it. An Admin does it from Manage staff
          users, which also moves the book first.
        </NotYet>
      </Panel>
    </div>
  );
}
