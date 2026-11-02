import { TextInput } from "@atomprive/ui";
import { Eye, EyeOff } from "lucide-react";
import { useState, type InputHTMLAttributes } from "react";

/**
 * A password box with an eye to show what has been typed, for somebody checking a temporary password they
 * are copying off a note, or a new one before they commit to it. Hidden again by the same button.
 */
export function PasswordInput(props: Omit<InputHTMLAttributes<HTMLInputElement>, "type">) {
  const [shown, setShown] = useState(false);
  const Icon = shown ? EyeOff : Eye;
  return (
    <div className="relative">
      <TextInput {...props} type={shown ? "text" : "password"} className="pr-11" />
      <button
        type="button"
        onClick={() => setShown((was) => !was)}
        aria-label={shown ? "Hide password" : "Show password"}
        aria-pressed={shown}
        className="absolute inset-y-0 right-0 flex w-11 items-center justify-center rounded-r-xl text-ink-muted hover:text-ink focus-visible:outline-2 focus-visible:outline-primary-600"
      >
        <Icon aria-hidden="true" className="size-4" />
      </button>
    </div>
  );
}
