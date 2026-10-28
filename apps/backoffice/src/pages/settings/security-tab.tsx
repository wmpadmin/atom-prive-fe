import { Badge, Button, SelectInput } from "@atomprive/ui";
import { KeyRound, Laptop, LifeBuoy, LogOut, ScrollText, ShieldCheck } from "lucide-react";
import { Link } from "react-router";
import { useSession } from "../../auth/session";
import { NotYet, Pair, Panel, Setting, Settings } from "./settings-parts";
import { SignedInDevices } from "../signed-in-devices";

/**
 * A reader's own account security.
 *
 * <p>Two of these panels are real and three are not, and the screen says which is which rather than
 * leaving a reader to find out by pressing something. The password is changed on its own screen and the
 * live sessions are read from the server; two-factor, recovery addresses and a login history are drawn to
 * the firm's design and wired to nothing, because none of the three exists behind the API yet.
 */
export function SecurityTab() {
  const { signOut } = useSession();

  return (
    <div className="space-y-6">
      <Pair>
        <Panel
          icon={<KeyRound />}
          title="Password"
          lead="Changing it signs you out everywhere else, so a session somebody else has is ended with it."
        >
          <Link to="/change-password">
            <Button variant="secondary">Change my password</Button>
          </Link>
        </Panel>

        <Panel
          icon={<ShieldCheck />}
          title="Two-factor authentication"
          lead="A six-digit code from an app on top of your password, so a stolen password is not enough on its own."
        >
          <div className="flex items-center justify-between gap-4 rounded-xl border border-line bg-canvas px-4 py-3">
            <div>
              <p className="text-sm font-semibold text-ink">Authenticator app</p>
              <p className="mt-0.5 text-xs text-ink-muted">
                Scanned once when you first signed in. You type its code every time since.
              </p>
            </div>
            <Badge tone="success">On</Badge>
          </div>
          {/* No switch beside it, and that is the design rather than a gap: every member of staff signs in
              through an authenticator, nobody at the firm may turn it off for themselves, and a control
              suggesting otherwise would be the one misleading thing on a security screen. */}
          <p className="mt-3 text-xs text-ink-muted">
            Required for everybody at the firm and not yours to turn off. Lost the phone it is on? An Admin
            resets it from Manage staff users, and you scan a new code at your next sign-in.
          </p>
        </Panel>
      </Pair>

      <Panel
        icon={<LifeBuoy />}
        title="Recovery"
        lead="Getting back in when you cannot sign in."
      >
        <Settings>
          <Setting label="Password reset">
            <p className="text-sm text-ink-soft">
              A link to your work address, from the sign-in screen.
            </p>
            <Link to="/forgot-password" className="mt-2 inline-block text-sm font-semibold text-primary-700 underline">
              Forgot your password?
            </Link>
          </Setting>
          <Setting label="Lost authenticator">
            <p className="text-sm text-ink-soft">
              Only an Admin can reset it. They clear the old one, and you scan a fresh code at your next
              sign-in.
            </p>
          </Setting>
        </Settings>
        <Settings>
          <Setting label="Recovery email" hint="A second address, somewhere other than work." htmlFor="recovery-email">
            <SelectInput id="recovery-email" value="" disabled onChange={() => {}}>
              <option value="">Not held</option>
            </SelectInput>
          </Setting>
          <Setting label="Recovery phone" hint="For a code by text." htmlFor="recovery-phone">
            <SelectInput id="recovery-phone" value="" disabled onChange={() => {}}>
              <option value="">Not held</option>
            </SelectInput>
          </Setting>
        </Settings>
        <NotYet>
          The two routes above are real. The two fields below them are not: the platform keeps no second
          address or number for staff, so a reset goes to your work email or through an Admin and nowhere
          else.
        </NotYet>
      </Panel>

      <Panel
        icon={<Laptop />}
        title="Where you are signed in"
        lead="Every device holding a live session on your account. Ending one signs that device out at once."
      >
        <SignedInDevices />
      </Panel>

      <Panel
        icon={<ScrollText />}
        title="Recent sign-ins"
        lead="Every attempt on your account, successful or not, with where it came from."
      >
        <div className="overflow-x-auto">
          <table className="w-full min-w-[32rem]">
            <thead>
              <tr className="border-b border-line text-2xs font-semibold tracking-wider text-ink-muted uppercase">
                <th className="py-2 pr-4 text-left">When</th>
                <th className="py-2 pr-4 text-left">Where from</th>
                <th className="py-2 pr-4 text-left">Device</th>
                <th className="py-2 text-left">Result</th>
              </tr>
            </thead>
            <tbody>
              {/* The headings stay when there is nothing under them, so an empty table reads as empty
                  rather than as a screen that failed to draw. */}
              <tr>
                <td colSpan={4} className="py-8 text-center text-sm text-ink-muted">
                  Nothing to show here yet.
                </td>
              </tr>
            </tbody>
          </table>
        </div>
        <NotYet>
          Not connected yet for your own account. Every sign-in <em>is</em> recorded — an Admin reads the
          whole history on the Staff sessions tab and in the audit log — but there is no endpoint that hands
          a reader their own, so this one is empty rather than filled with something invented.
        </NotYet>
      </Panel>

      <Panel icon={<LogOut />} title="Signing out" lead="Ends this session on this device. Every sign-in is recorded.">
        <Button variant="secondary" onClick={() => void signOut()}>
          Sign out
        </Button>
      </Panel>
    </div>
  );
}
