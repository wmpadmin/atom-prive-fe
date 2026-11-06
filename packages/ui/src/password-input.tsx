import { Eye, EyeOff } from "lucide-react";
import { useState, type CSSProperties, type InputHTMLAttributes, type TextareaHTMLAttributes } from "react";
import { cn } from "./cn";
import { TextArea, TextInput } from "./form";

/**
 * A password box with an eye to show what has been typed, for somebody checking a temporary password they
 * are copying off a note, or a new one before they commit to it. Hidden again by the same button.
 */
export function PasswordInput({ what = "password", ...props }: Omit<InputHTMLAttributes<HTMLInputElement>, "type"> & {
  /** What the eye says it shows: "password", "API key", "client secret". */
  what?: string;
}) {
  const [shown, setShown] = useState(false);
  return (
    <div className="relative">
      <TextInput {...props} type={shown ? "text" : "password"} className={cn("pr-11", props.className)} />
      <EyeButton shown={shown} what={what} onToggle={() => setShown((was) => !was)} className="inset-y-0" />
    </div>
  );
}

/**
 * The same for something pasted over several lines, such as a private key: hidden as dots until the eye is
 * pressed, so a key is not on the screen for whoever is passing.
 */
export function SecretArea({ what, ...props }: TextareaHTMLAttributes<HTMLTextAreaElement> & { what: string }) {
  const [shown, setShown] = useState(false);
  return (
    <div className="relative">
      <TextArea
        {...props}
        className={cn("pr-11", props.className)}
        style={shown ? props.style : { ...props.style, WebkitTextSecurity: "disc" } as CSSProperties}
      />
      <EyeButton shown={shown} what={what} onToggle={() => setShown((was) => !was)} className="top-0 h-11" />
    </div>
  );
}

function EyeButton({ shown, what, onToggle, className }: {
  shown: boolean;
  what: string;
  onToggle: () => void;
  className: string;
}) {
  const Icon = shown ? EyeOff : Eye;
  return (
    <button
      type="button"
      onClick={onToggle}
      aria-label={shown ? `Hide ${what}` : `Show ${what}`}
      aria-pressed={shown}
      className={cn(
        "absolute right-0 flex w-11 items-center justify-center rounded-r-xl text-ink-muted hover:text-ink focus-visible:outline-2 focus-visible:outline-primary-600",
        className,
      )}
    >
      <Icon aria-hidden="true" className="size-4" />
    </button>
  );
}
