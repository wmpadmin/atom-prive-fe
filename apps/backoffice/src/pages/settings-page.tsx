import { ApiError } from "@atomprive/api-client";
import { useEnterWorkspace, useUploadMyPhoto, type StaffProfile } from "@atomprive/api-client/backoffice";
import { Alert, Button, Field, SelectInput } from "@atomprive/ui";
import { useQueryClient } from "@tanstack/react-query";
import { Camera, KeyRound, Laptop, UserRound, Users } from "lucide-react";
import { useState, type ReactNode } from "react";
import { Link } from "react-router";
import { useSession, useStaffUser } from "../auth/session";
import { roleLabels, roleList, type StaffRole } from "../lib/labels";
import { PhotoField } from "../components/photo-field";
import { SignedInDevices } from "./signed-in-devices";

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

      <Panel icon={<Camera aria-hidden="true" className="size-4" />} title="Your photo">
        <MyPhoto user={user} />
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
      {wearsSeveralHats && <WorkspacePanel user={user} />}

      <Panel icon={<Laptop aria-hidden="true" className="size-4" />} title="Where you are signed in">
        <SignedInDevices />
      </Panel>

      <Panel title="Signing out">
        <p className="text-sm text-ink-muted">Ends this session on this device. Every sign-in is recorded.</p>
        <Button variant="secondary" className="mt-3" onClick={() => void signOut()}>
          Sign out
        </Button>
      </Panel>
    </div>
  );
}

/**
 * The role this person opens in, which they set for themselves.
 *
 * <p>The Admin chooses it when a member of staff is added, and this is where that person changes their own
 * mind. It takes effect at once — picking one enters it — so the screens change under them as they choose,
 * which is the point: it is their workspace, not a preference to be applied later.
 */
/**
 * Their own photograph, changed by them and nobody else.
 *
 * <p>Uploaded against the token rather than against an id: the account is whoever is signed in, so there is
 * no way from here to put a face on somebody else's.
 */
function MyPhoto({ user }: { user: StaffProfile }) {
  const { applyProfile } = useSession();
  const [wrong, setWrong] = useState<string>();
  const upload = useUploadMyPhoto<ApiError>({
    mutation: {
      onSuccess: (profile) => {
        setWrong(undefined);
        applyProfile(profile);
      },
      onError: (caught) => setWrong(caught.message),
    },
  });

  return (
    <>
      {wrong && (
        <div className="mb-3">
          <Alert tone="danger">{wrong}</Alert>
        </div>
      )}
      <PhotoField
        kind="staff"
        name={user.fullName}
        photo={user.photo ?? null}
        busy={upload.isPending}
        hint="JPG, PNG or WebP, up to 5MB. It shows wherever you appear on the platform."
        onChoose={async (dataUri) => {
          const file = await (await fetch(dataUri)).blob();
          upload.mutate({ data: { file: new File([file], "photo.jpg", { type: "image/jpeg" }) } });
        }}
      />
    </>
  );
}

function WorkspacePanel({ user }: { user: StaffProfile }) {
  const queryClient = useQueryClient();
  const { applyProfile } = useSession();
  const [saved, setSaved] = useState(false);
  const enter = useEnterWorkspace<ApiError>({
    mutation: {
      onSuccess: (profile) => {
        setSaved(true);
        // The menu and every screen behind it are the active role's, so none of what is cached still
        // applies — and the profile has to be taken in hand too, or the sidebar redraws as it was.
        queryClient.clear();
        applyProfile(profile);
      },
    },
  });

  return (
    <Panel icon={<Users aria-hidden="true" className="size-4" />} title="Workspace">
      <p className="text-sm text-ink-muted">
        You hold more than one role. The one you open in decides what you see when you sign in — and you move
        into it as soon as you choose it.
      </p>
      {enter.isError && (
        <div className="mt-3">
          <Alert tone="danger">{enter.error.message}</Alert>
        </div>
      )}
      {saved && !enter.isError && (
        <div className="mt-3">
          <Alert tone="success">You open in {roleLabels[(user.opensIn ?? user.activeRole) as StaffRole]} from now on.</Alert>
        </div>
      )}
      <Field id="opens-in" label="I open in" className="mt-3 max-w-xs">
        <SelectInput
          id="opens-in"
          value={(user.opensIn ?? user.activeRole ?? "") as string}
          disabled={enter.isPending}
          onChange={(event) => {
            const role = event.target.value as StaffRole;
            setSaved(false);
            enter.mutate({ data: { role, fromNowOn: true } });
          }}
        >
          {user.roles.map((role) => (
            <option key={role} value={role}>
              {roleLabels[role as StaffRole]}
            </option>
          ))}
        </SelectInput>
      </Field>
    </Panel>
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
