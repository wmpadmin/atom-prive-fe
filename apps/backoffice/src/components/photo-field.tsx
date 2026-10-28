import { Avatar, Button, cn, StaffAvatar } from "@atomprive/ui";
import { useRef, useState } from "react";
import { squared } from "../lib/squared-photo";

const READABLE = ["image/jpeg", "image/png", "image/webp"];

const MOST_BYTES = 5 * 1024 * 1024;

interface PhotoFieldProps {
  /** Whose face it is, for the initials that stand in until there is a photograph. */
  name: string;
  /**
   * Which kind of person this is, which decides how the face is drawn: a member of the firm brown and
   * in a rounded square, a client blue and in a circle.
   *
   * <p>Required, and set by the caller rather than worked out here. This control takes a bare name and
   * a photograph and has no person behind them, so nothing in it could decide — and it is used on four
   * screens, two of each. Left to a default it would be wrong on half of them, silently.
   */
  kind: "staff" | "client";
  /** What is on the record now, as a data URI, or null. */
  photo: string | null;
  /** Handed the squared data URI. What the caller does with it — hold it, or send it — is theirs. */
  onChoose: (dataUri: string) => void | Promise<void>;
  /** Said under the control. */
  hint?: string;
  busy?: boolean;
  /**
   * Face above the button rather than beside it.
   *
   * <p>For a box where this is one block in the corner and other fields sit to the right of it. Left
   * alone, the button lands in the middle of that row and reads as having nothing to do with the face.
   */
  stacked?: boolean;
  className?: string;
}

/**
 * The control itself: the face as it stands, and one button to replace it.
 *
 * <p>There is no way to take a photograph off. The firm's rule is that one is replaced, never removed — a
 * record going from a face back to initials reads as something having gone wrong with the record.
 */
export function PhotoField({ name, kind, photo, onChoose, hint, busy, stacked, className }: PhotoFieldProps) {
  const Face = kind === "staff" ? StaffAvatar : Avatar;
  const input = useRef<HTMLInputElement>(null);
  const [wrong, setWrong] = useState<string>();

  async function take(file: File | undefined) {
    setWrong(undefined);
    if (!file) return;
    if (!READABLE.includes(file.type)) {
      setWrong("A photo has to be a JPEG, a PNG or a WebP.");
      return;
    }
    if (file.size > MOST_BYTES) {
      setWrong("A photo has to be 5MB or smaller.");
      return;
    }
    try {
      await onChoose(await squared(file));
    }
    catch (caught) {
      setWrong(caught instanceof Error ? caught.message : "That photo couldn't be used.");
    }
  }

  return (
    <div
      className={cn(
        "flex gap-4",
        stacked ? "flex-col items-start gap-2" : "items-center",
        className,
      )}
    >
      <Face name={name} photo={photo} className="size-16 text-base" />
      <div className="min-w-0">
        <input
          ref={input}
          type="file"
          accept={READABLE.join(",")}
          className="sr-only"
          onChange={(event) => {
            void take(event.target.files?.[0]);
            // Cleared, so choosing the same file twice in a row still counts as a change.
            event.target.value = "";
          }}
        />
        <Button type="button" variant="secondary" size="sm" disabled={busy} onClick={() => input.current?.click()}>
          {busy ? "Saving…" : photo ? "Change photo" : "Upload a photo"}
        </Button>
        {wrong ? (
          <p className="mt-1.5 text-xs text-red-600">{wrong}</p>
        ) : (
          hint && <p className="mt-1.5 text-xs text-ink-muted">{hint}</p>
        )}
      </div>
    </div>
  );
}
