import { ApiError } from "@atomprive/api-client";
import { useUploadMyPhoto, type StaffProfile } from "@atomprive/api-client/backoffice";
import { Alert, Badge, Button, TextInput } from "@atomprive/ui";
import { Camera, IdCard, ShieldCheck, UserRound } from "lucide-react";
import { useState } from "react";
import { Link } from "react-router";
import { useSession } from "../../auth/session";
import { roleLabels, type StaffRole } from "../../lib/labels";
import { PhotoField } from "../../components/photo-field";
import { NotYet, Pair, Panel, Setting, Settings } from "./settings-parts";

/**
 * Who the platform has this reader down as.
 *
 * <p>Their photograph is theirs to change and does so here. Their name, their email and their roles are
 * not: an Admin keeps the staff record, and a member of staff editing their own name on a platform where
 * every action is recorded against that name is exactly the wrong way round. So those fields are shown as
 * what they are — read, not typed — with the one line saying who to ask.
 */
export function ProfileTab({ user }: { user: StaffProfile }) {
  const wearsSeveralHats = user.roles.length > 1;

  return (
    <div className="space-y-6">
      <Panel
        icon={<UserRound />}
        title="Personal information"
        lead="What the firm has on file for you. An Admin keeps this; it is not yours to edit."
      >
        <Settings>
          <Setting label="Full name" htmlFor="profile-name">
            <TextInput id="profile-name" value={user.fullName} readOnly disabled />
          </Setting>
          <Setting label="Work email" hint="This is also how you sign in." htmlFor="profile-email">
            <TextInput id="profile-email" value={user.email} readOnly disabled />
          </Setting>
          <Setting label="Phone" htmlFor="profile-phone">
            <TextInput id="profile-phone" value="" placeholder="Not held" readOnly disabled />
          </Setting>
          <Setting label="Employee ID" htmlFor="profile-employee-id">
            <TextInput id="profile-employee-id" value="" placeholder="Not held" readOnly disabled />
          </Setting>
        </Settings>
        <NotYet>
          Your name and email are read from your account and are real. Phone and employee ID the platform
          does hold on your staff record — but what signs you in hands back only the first two, so this
          screen cannot show them yet; an Admin sees the whole record on Manage staff users. None of the
          four is editable from here by design.
        </NotYet>
      </Panel>

      <Pair>
        <Panel
          icon={<Camera />}
          title="Your photograph"
          lead="It shows wherever you appear on the platform — in an approval queue, on an audit entry, beside a client."
        >
          <MyPhoto user={user} />
        </Panel>

        <Panel icon={<IdCard />} title="Your desk" lead="The role you are working as, and every role you hold.">
          <div className="space-y-4">
            <Setting label="Working as">
              <p className="text-sm font-semibold text-ink">
                {user.activeRole ? roleLabels[user.activeRole] : "Not chosen"}
              </p>
            </Setting>
            <Setting label="Roles you hold">
              <div className="flex flex-wrap gap-1.5">
                {user.roles.map((role) => (
                  <Badge key={role} tone={role === user.activeRole ? "info" : "neutral"}>
                    {roleLabels[role as StaffRole]}
                  </Badge>
                ))}
              </div>
            </Setting>
            {wearsSeveralHats && (
              <p className="text-xs text-ink-muted">
                You hold more than one. Which desk you open at is on the Workspace tab.
              </p>
            )}
          </div>
        </Panel>
      </Pair>

      <Panel
        icon={<ShieldCheck />}
        title="What you may do"
        lead="Set by an Admin on the permission matrix, by role rather than by person. This screen has no path to changing it."
      >
        <p className="text-sm text-ink-soft">
          Your role carries <strong className="font-semibold text-ink tabular-nums">{user.permissions.length}</strong>{" "}
          {user.permissions.length === 1 ? "permission" : "permissions"}. What each one opens is on the matrix,
          and it is the same for everybody at your desk.
        </p>
        <Link to="/roles" className="mt-3 inline-block">
          <Button variant="secondary">See the permission matrix</Button>
        </Link>
      </Panel>
    </div>
  );
}

/**
 * Their own photograph, changed by them and nobody else.
 *
 * <p>Uploaded against the token rather than against an id: the account is whoever is signed in, so there
 * is no way from here to put a face on somebody else's.
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
        hint="JPG, PNG or WebP, up to 5MB."
        onChoose={async (dataUri) => {
          const file = await (await fetch(dataUri)).blob();
          upload.mutate({ data: { file: new File([file], "photo.jpg", { type: "image/jpeg" }) } });
        }}
      />
      {/* No "remove" beside it: the platform has an upload for a staff photograph and no delete, so a
          reader is offered the one thing that works rather than a button that would 404. */}
    </>
  );
}
