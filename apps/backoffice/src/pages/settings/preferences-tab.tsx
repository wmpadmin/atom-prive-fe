import { SelectInput, Switch, cn } from "@atomprive/ui";
import { Accessibility, Globe, Monitor, Moon, Palette, Sun } from "lucide-react";
import { NotYet, Pair, Panel, Setting, Settings, SwitchRow } from "./settings-parts";
import { useTheme } from "../../lib/theme";

/**
 * How the platform looks to this reader, and in what words.
 *
 * <p>The theme is real and takes effect as it is pressed — it is kept in this browser, because how
 * somebody likes to look at a screen is not something the firm has any business holding. Language,
 * region and the accessibility switches are drawn and not wired: there is one language in the platform
 * and no second set of strings to switch to, so a picker offering Hindi would be a lie in the one place
 * a reader would believe it hardest.
 */
export function PreferencesTab() {
  const { preference, choose } = useTheme();

  return (
    <div className="space-y-6">
      <Panel icon={<Palette />} title="Appearance" lead="Light, dark, or whatever this machine is set to.">
        <div className="grid gap-3 sm:grid-cols-3">
          <ThemeChoice on={preference === "light"} onChoose={() => choose("light")} title="Light" icon={<Sun aria-hidden="true" className="size-4" />} swatch="#ffffff" ink="#334155" />
          <ThemeChoice on={preference === "dark"} onChoose={() => choose("dark")} title="Dark" icon={<Moon aria-hidden="true" className="size-4" />} swatch="#0f172a" ink="#cbd5e1" />
          <ThemeChoice
            on={preference === "system"}
            onChoose={() => choose("system")}
            title="This machine"
            icon={<Monitor aria-hidden="true" className="size-4" />}
            // Split down the middle rather than blended: it is two themes, not a third one between them.
            swatch="linear-gradient(110deg, #ffffff 0%, #ffffff 50%, #0f172a 50%, #0f172a 100%)"
            ink="#64748b"
          />
        </div>
        <p className="mt-4 text-xs text-ink-muted">
          Kept in this browser only. "This machine" keeps following it, so a laptop that darkens at dusk
          takes the platform with it.
        </p>
      </Panel>

      <Pair>
        <Panel icon={<Globe />} title="Language and region" lead="What the platform reads in, and how it counts.">
          <Settings>
            <Setting label="Language" htmlFor="language">
              <SelectInput id="language" value="en-GB" disabled onChange={() => {}}>
                <option value="en-GB">English (United Kingdom)</option>
              </SelectInput>
            </Setting>
            <Setting label="Timezone" htmlFor="timezone">
              <SelectInput id="timezone" value="asia-kolkata" disabled onChange={() => {}}>
                <option value="asia-kolkata">India Standard Time (UTC+5:30)</option>
              </SelectInput>
            </Setting>
            <Setting label="Currency" hint="What a figure with no unit beside it means." htmlFor="currency">
              <SelectInput id="currency" value="inr" disabled onChange={() => {}}>
                <option value="inr">Indian Rupee (₹)</option>
              </SelectInput>
            </Setting>
            <Setting label="The week starts" htmlFor="week-start">
              <SelectInput id="week-start" value="monday" disabled onChange={() => {}}>
                <option value="monday">Monday</option>
              </SelectInput>
            </Setting>
          </Settings>
          <NotYet>
            Not connected yet, and shown as the platform actually behaves. There is one set of strings and
            one currency behind every screen, so each of these has exactly one honest answer — a picker
            offering a second would change nothing but a reader's expectations. Date and time shape, which
            <em> is</em> a reader's to set, is on the Workspace tab.
          </NotYet>
        </Panel>

        <Panel icon={<Accessibility />} title="Accessibility" lead="Making the platform easier to read and to work.">
          <SwitchRow title="Reduce motion" lead="Stops things sliding and fading in.">
            <Switch on={false} label="Reduce motion" disabled onChange={() => {}} />
          </SwitchRow>
          <SwitchRow title="Higher contrast" lead="Stronger edges and darker text throughout.">
            <Switch on={false} label="Higher contrast" disabled onChange={() => {}} />
          </SwitchRow>
          <SwitchRow title="Always underline links" lead="Rather than only on hover.">
            <Switch on={false} label="Always underline links" disabled onChange={() => {}} />
          </SwitchRow>
          <SwitchRow title="Larger text" lead="Everything a step up, layout unchanged.">
            <Switch on={false} label="Larger text" disabled onChange={() => {}} />
          </SwitchRow>
          <NotYet>
            Not connected yet as switches. Reduced motion is already honoured from this machine's own
            setting rather than from here, so a reader who has asked their system for it has it on every
            screen — these would be a way to ask for it on the platform alone.
          </NotYet>
        </Panel>
      </Pair>
    </div>
  );
}

/**
 * One of the three themes, shown as the thing it does.
 *
 * <p>The little window is painted in LITERAL colours rather than the palette's. Every other colour on
 * this screen is a token that changes with the theme — which is right everywhere except here, where the
 * whole job of the picture is to show a theme that is not the one in force. Drawn with tokens, the
 * "Light" tile rendered a near-black box with near-black bars the moment anybody switched to dark: it
 * showed the current theme three times and called one of them Light.
 */
function ThemeChoice({
  on,
  onChoose,
  title,
  icon,
  swatch,
  ink,
}: {
  on: boolean;
  onChoose: () => void;
  title: string;
  icon: React.ReactNode;
  /** The ground this theme paints, as a literal colour. */
  swatch: string;
  /** What text looks like on it, as a literal colour. */
  ink: string;
}) {
  return (
    <button
      type="button"
      aria-pressed={on}
      onClick={onChoose}
      className={cn(
        "rounded-xl border p-3 text-left transition-colors",
        "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary-600",
        on ? "border-primary-600 bg-primary-50/50 ring-1 ring-primary-600" : "border-line hover:bg-canvas",
      )}
    >
      <span
        aria-hidden="true"
        className="flex h-[3.25rem] flex-col gap-1.5 rounded-lg border border-black/10 p-2"
        style={{ background: swatch }}
      >
        <span className="h-1 w-2/3 rounded-full" style={{ background: ink }} />
        <span className="h-1 w-full rounded-full opacity-60" style={{ background: ink }} />
        <span className="h-1 w-4/5 rounded-full opacity-40" style={{ background: ink }} />
      </span>
      <span className="mt-2 flex items-center gap-1.5 text-sm font-semibold text-ink">
        {icon}
        {title}
      </span>
    </button>
  );
}
