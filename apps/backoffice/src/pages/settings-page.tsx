import { Button } from "@atomprive/ui";
import { KeyRound, UserRound, Users } from "lucide-react";
import type { ReactNode } from "react";
import { Link } from "react-router";
import { useSession, useStaffUser } from "../auth/session";
import { roleLabels, roleList } from "../lib/labels";

/**
 * Everything somebody can change about their own account, in one place: who the platform has them down as,
 * their password, and which role they are working as where they hold more than one.
 *
 * <p>Nothing here is anybody else's: changing what a colleague may do is the Admin's, on the permission
 * matrix, and this screen deliberately has no path to it.
 */
export function SettingsPage() {
  const user = useStaffUser();
  const { signOut } = useSession();
  const wearsSeveralHats = user.roles.length > 1;

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-[1.625rem] font-bold">Settings</h1>
        <p className="mt-1 text-sm text-ink-muted">Your own account. What you may do is set by an Admin.</p>
      </header>

      <Panel icon={<UserRound aria-hidden="true" className="size-4" />} title="You">
        <dl className="grid gap-4 sm:grid-cols-3">
          <Fact label="Name">{user.fullName}</Fact>
          <Fact label="Email">{user.email}</Fact>
          <Fact label="Working as">
            {user.activeRole ? roleLabels[user.activeRole] : "Not chosen"}
            {wearsSeveralHats && (
              <span className="block text-xs font-normal text-ink-muted">Also holds {roleList(user.roles as never)}</span>
            )}
          </Fact>
        </dl>
      </Panel>

      <Panel icon={<KeyRound aria-hidden="true" className="size-4" />} title="Password">
        <p className="text-sm text-ink-muted">
          Changing it signs you out everywhere else, so a session somebody else has is ended with it.
        </p>
        <Link to="/change-password" className="mt-3 inline-block">
          <Button variant="secondary">Change my password</Button>
        </Link>
      </Panel>

      {/* Only worth a panel to somebody who holds more than one role; everyone else has nothing to switch to. */}
      {wearsSeveralHats && (
        <Panel icon={<Users aria-hidden="true" className="size-4" />} title="Workspace">
          <p className="text-sm text-ink-muted">
            You hold more than one role. Which you are working as decides what you see, and you may change it at
            any time.
          </p>
          <Link to="/workspace" className="mt-3 inline-block">
            <Button variant="secondary">Switch workspace</Button>
          </Link>
        </Panel>
      )}

      <Panel title="Signing out">
        <p className="text-sm text-ink-muted">Ends this session on this device. Every sign-in is recorded.</p>
        <Button variant="secondary" className="mt-3" onClick={() => void signOut()}>
          Sign out
        </Button>
      </Panel>
    </div>
  );
}

function Panel({ icon, title, children }: { icon?: ReactNode; title: string; children: ReactNode }) {
  return (
    <section className="rounded-2xl border border-line bg-white p-6">
      <h2 className="flex items-center gap-2 text-sm font-semibold">
        {icon}
        {title}
      </h2>
      <div className="mt-3">{children}</div>
    </section>
  );
}

function Fact({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div>
      <dt className="text-2xs font-semibold tracking-wider text-ink-muted uppercase">{label}</dt>
      <dd className="mt-0.5 text-sm font-medium text-ink">{children}</dd>
    </div>
  );
}
