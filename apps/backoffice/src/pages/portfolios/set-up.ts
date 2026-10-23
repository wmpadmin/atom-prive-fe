import type { PortfolioStanding, StaffProfile } from "@atomprive/api-client/backoffice";
import { hasAuthority } from "../../lib/permissions";

/**
 * Whether the Net AUM calculator is offered at all.
 *
 * <p>Off, because the firm types no figure into this platform: what a client is worth comes from the
 * daily file the firm already produces, and a figure somebody typed beside one that was uploaded is two
 * answers to one question with nothing to say which is right.
 *
 * <p>Hidden rather than taken out. The screen, its four steps and everything that reads them are left
 * exactly where they are, because the upload that replaces it does not exist yet — and until it does,
 * this is the only thing that knows how to write a client down. Turning this back on is the whole of
 * putting it back.
 *
 * <p>Three doors, and all three read this: the button on a client's portfolio, the redirect that used to
 * carry an unwritten client into it, and the clients list, whose unfinished rows opened it instead of the
 * portfolio.
 */
export const THE_CALCULATOR_IS_OFFERED = false;

/**
 * Whether the Net AUM calculator has been worked through to the end for this client.
 *
 * <p>Two things, because two of the four steps ask for something that can be missing. Step 1 is the
 * allocation and step 4 is the plan; steps 2 and 3 can be empty for an honest reason — a client may own
 * nothing outside the portfolio and owe nothing, and the third step types no figure at all, it only adds
 * up the two before it.
 *
 * <p>Neither half is enough on its own, and both halves are reachable without the other. A plan can be put
 * on a client who has written nothing down: the first step has a Skip, the second and third let somebody
 * press Next over an empty form, and three of the four ways a model gets set — this screen's own picker,
 * an approved change request, an allocation written for the client alone — do not go through the dialog at
 * all. And an allocation can be written by somebody who stops before picking a plan, which is the way round
 * that was reported.
 *
 * <p>Read by the list, to decide where a row goes; by the dialog, to decide which step it opens on; and by
 * the portfolio screen, to decide whether it may be drawn. One answer in one place, because three
 * screens each remembering the rule is three chances to remember it differently.
 */
export function isSetUp(standing: PortfolioStanding | undefined): boolean {
  return standing !== undefined
    && standing.underManagement > 0
    && standing.modelPortfolioId !== null;
}

/**
 * Whether this reader could finish setting a client up if they were sent to do it.
 *
 * <p>Every one of the dialog's writes is held to SEND_PROPOSALS:CHANGE, which only a portfolio manager and
 * an administrator hold. Reading a client's portfolio is held to something far wider — a relationship
 * manager, compliance and operations all have it — so sending those three into the calculator would be
 * sending them to a form whose Next is refused, with the screen they could read until a moment ago now shut
 * behind it. They are left on the portfolio, which is what they came to do and all they can do.
 */
export function mayFinishSettingUp(user: StaffProfile): boolean {
  return hasAuthority(user, "SEND_PROPOSALS:CHANGE");
}
