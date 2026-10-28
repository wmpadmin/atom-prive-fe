import { Switch } from "@atomprive/ui";
import { Bell, Clock, Mail } from "lucide-react";
import { Link } from "react-router";
import { NotYet, Panel, SwitchHeadings, SwitchRow } from "./settings-parts";

/**
 * What the platform would tell a reader about, and how.
 *
 * <p>Drawn to the firm's design and connected to nothing, which the screen says in as many words. There
 * is a notification log in the back office and a delivery pipeline behind it, but it has no per-person
 * choices: nobody at the firm can presently say "email me approvals, do not email me sync errors". Until
 * that exists these switches would be read by nothing, so they are shown in their intended state, left
 * where a reader cannot move them, and the one line under each panel says why.
 */
export function NotificationsTab() {
  const events: { title: string; lead: string; email: boolean; inApp: boolean }[] = [
    {
      title: "Something is waiting for your approval",
      lead: "An onboarding case, a KYC document, a model change or a bank mandate at your desk.",
      email: true,
      inApp: true,
    },
    {
      title: "A client asked for access to an account",
      lead: "A family member asking to see somebody else's holdings.",
      email: true,
      inApp: true,
    },
    {
      title: "A client signed, or declined to sign",
      lead: "A form you sent came back.",
      email: false,
      inApp: true,
    },
    {
      title: "A bank feed failed",
      lead: "An overnight ingestion that did not land, on an account you look after.",
      email: true,
      inApp: true,
    },
    {
      title: "A client was assigned to you",
      lead: "A new relationship, or one moved to your desk.",
      email: true,
      inApp: true,
    },
    {
      title: "A declaration of yours is due",
      lead: "One of the nine everybody at the firm signs.",
      email: true,
      inApp: true,
    },
  ];

  return (
    <div className="space-y-6">
      <Panel
        icon={<Bell />}
        title="What you hear about"
        lead="Each of these can reach you by email, on the platform, or both."
      >
        <SwitchHeadings of={["Email", "On screen"]} />
        <div>
          {events.map((event) => (
            <SwitchRow key={event.title} title={event.title} lead={event.lead}>
              <span className="w-[3.75rem] text-center">
                <Switch on={event.email} label={`Email me about: ${event.title}`} disabled onChange={() => {}} />
              </span>
              <span className="w-[3.75rem] text-center">
                <Switch on={event.inApp} label={`Show me on screen: ${event.title}`} disabled onChange={() => {}} />
              </span>
            </SwitchRow>
          ))}
        </div>
        <NotYet>
          Not connected yet. The platform sends notifications but keeps no per-person choices about them,
          so nothing would read these. What has actually been sent is on the{" "}
          <Link to="/notifications" className="underline">
            notification log
          </Link>
          .
        </NotYet>
      </Panel>

      <Panel
        icon={<Mail />}
        title="A summary instead"
        lead="One message gathering the day or the week, rather than one message each time."
      >
        <SwitchRow title="Daily summary" lead="Everything waiting at your desk, once each morning.">
          <span className="w-[3.75rem] text-center">
            <Switch on={false} label="Send me a daily summary" disabled onChange={() => {}} />
          </span>
        </SwitchRow>
        <SwitchRow title="Weekly summary" lead="What moved on your clients over the week.">
          <span className="w-[3.75rem] text-center">
            <Switch on={false} label="Send me a weekly summary" disabled onChange={() => {}} />
          </span>
        </SwitchRow>
        <NotYet>Not connected yet. Nothing gathers or sends a summary.</NotYet>
      </Panel>

      <Panel
        icon={<Clock />}
        title="Quiet hours"
        lead="Hold everything but the urgent until the morning, and over the weekend."
      >
        <SwitchRow title="Hold notifications overnight" lead="From 8pm to 8am, in your own timezone.">
          <span className="w-[3.75rem] text-center">
            <Switch on={false} label="Hold notifications overnight" disabled onChange={() => {}} />
          </span>
        </SwitchRow>
        <SwitchRow title="Hold notifications at the weekend" lead="Saturday and Sunday.">
          <span className="w-[3.75rem] text-center">
            <Switch on={false} label="Hold notifications at the weekend" disabled onChange={() => {}} />
          </span>
        </SwitchRow>
        <NotYet>Not connected yet. Notifications go out when the thing happens, whatever the hour.</NotYet>
      </Panel>
    </div>
  );
}
