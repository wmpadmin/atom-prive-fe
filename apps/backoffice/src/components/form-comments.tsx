import type { ApiError } from "@atomprive/api-client";
import {
  getListFormCommentsQueryKey,
  getGetPackQueryKey,
  useListFormComments,
  useSettleFormComment,
  useWriteFormComment,
  type FormCommentList,
  type FormCommentRow,
} from "@atomprive/api-client/backoffice";
import { Alert, Badge, Button, Field, SelectInput, TextArea } from "@atomprive/ui";
import { useQueryClient } from "@tanstack/react-query";
import { Check, MessageSquare } from "lucide-react";
import { useState } from "react";
import { formatDateTime } from "../lib/labels";

/** A part of the form a comment can be left against, as that part is named on screen. */
export interface CommentablePart {
  id: string;
  label: string;
}

/**
 * The comments two members of staff leave each other on a form.
 *
 * <p>An advisor reading a form to sign it had two answers: sign it, which says it is right, or send the whole
 * thing back, which takes a finished form to the beginning again. Most of what they find is smaller than
 * either — a line that reads wrong, a date worth checking — so a comment says what has to change, against the
 * part it is about, and names whoever is being asked to deal with it. The form does not move.
 *
 * <p>Whoever is named hears about it at the bell, and marks it dealt with when it is done.
 */
export function FormComments({
  formId,
  parts,
  packId,
  canWrite,
}: {
  formId: string;
  /** The parts of this form, so a comment can say which one it is about. */
  parts: CommentablePart[];
  /** The signing pack it is being read from, where it is being read while signing. */
  packId?: string;
  /** Compliance read a form and change nothing, comments included. */
  canWrite: boolean;
}) {
  const queryClient = useQueryClient();
  const comments = useListFormComments<FormCommentList, ApiError>(formId);
  const write = useWriteFormComment<ApiError>();
  const settle = useSettleFormComment<ApiError>();
  const [about, setAbout] = useState("");
  const [forStaff, setForStaff] = useState("");
  const [body, setBody] = useState("");
  const [refused, setRefused] = useState<string>();

  function refresh() {
    void queryClient.invalidateQueries({ queryKey: getListFormCommentsQueryKey(formId) });
    // The pack counts open comments beside each form, so it moves when one is written or dealt with.
    if (packId) void queryClient.invalidateQueries({ queryKey: getGetPackQueryKey(packId) });
  }

  function add() {
    const said = body.trim();
    if (said === "") return;
    setRefused(undefined);
    write.mutate(
      {
        formId,
        data: {
          body: said,
          about: about === "" ? null : about,
          aboutLabel: parts.find((part) => part.id === about)?.label ?? null,
          forStaff: forStaff === "" ? null : forStaff,
          packId: packId ?? null,
        },
      },
      {
        onSuccess: () => {
          setBody("");
          refresh();
        },
        onError: (error) => setRefused(error.message),
      },
    );
  }

  function markDone(comment: FormCommentRow) {
    setRefused(undefined);
    settle.mutate(
      { formId, commentId: comment.id },
      { onSuccess: refresh, onError: (error) => setRefused(error.message) },
    );
  }

  const items = comments.data?.items ?? [];
  const people = comments.data?.peopleToTag ?? [];
  const open = comments.data?.open ?? 0;

  return (
    <section aria-labelledby="form-comments-title" className="rounded-2xl border border-line bg-white">
      <div className="flex flex-wrap items-center gap-3 border-b border-line px-6 py-4">
        <MessageSquare aria-hidden="true" className="size-4 text-ink-muted" />
        <h2 id="form-comments-title" className="text-base font-bold">
          Comments
        </h2>
        {open > 0 && <Badge tone="warning">{open === 1 ? "1 to deal with" : `${open} to deal with`}</Badge>}
        <span className="flex-grow" />
        <p className="text-xs text-ink-muted">
          Between the firm's own people. None of this goes on what the client signs.
        </p>
      </div>

      {comments.isError && (
        <div className="px-6 pt-4">
          <Alert tone="danger">{comments.error.message}</Alert>
        </div>
      )}
      {refused && (
        <div className="px-6 pt-4">
          <Alert tone="danger">{refused}</Alert>
        </div>
      )}

      {items.length === 0 ? (
        <p className="px-6 py-5 text-sm text-ink-muted">
          {comments.isLoading ? "Loading…" : "Nothing has been asked about this form."}
        </p>
      ) : (
        <ul className="divide-y divide-line">
          {items.map((comment) => (
            <li key={comment.id} className="flex flex-wrap items-start gap-x-4 gap-y-2 px-6 py-4">
              <div className="min-w-0 flex-1 space-y-1">
                <p className="flex flex-wrap items-center gap-2 text-xs text-ink-muted">
                  <span className="font-semibold text-ink">
                    {comment.mine ? "You" : comment.writtenByName}
                  </span>
                  {comment.aboutLabel && <span className="text-ink-soft">on {comment.aboutLabel}</span>}
                  <span>{formatDateTime(comment.createdAt)}</span>
                  {/* Who is being asked, by name. A comment addressed to nobody is for whoever picks it up. */}
                  {comment.forStaffName && (
                    <Badge tone={comment.forMe ? "warning" : "neutral"}>
                      {comment.forMe ? "For you" : `For ${comment.forStaffName}`}
                    </Badge>
                  )}
                </p>
                <p className="text-sm whitespace-pre-line text-ink">{comment.body}</p>
                {comment.settledAt && (
                  <p className="text-xs text-emerald-700">
                    Dealt with by {comment.settledByName} on {formatDateTime(comment.settledAt)}
                  </p>
                )}
              </div>
              {/* Whoever it was for closes it, and so does whoever wrote it; one left to anybody is closed
                  by whoever picks it up. Anyone else would be deciding for them that it no longer matters. */}
              {canWrite && !comment.settledAt && (comment.mine || comment.forMe || !comment.forStaff) && (
                <Button
                  size="sm"
                  variant="secondary"
                  disabled={settle.isPending}
                  onClick={() => markDone(comment)}
                >
                  <Check aria-hidden="true" />
                  Mark done
                </Button>
              )}
            </li>
          ))}
        </ul>
      )}

      {canWrite && (
        <div className="space-y-4 border-t border-line px-6 py-5">
          <Field id="comment-body" label="Ask for a change">
            <TextArea
              id="comment-body"
              rows={3}
              value={body}
              maxLength={2000}
              placeholder="The date of incorporation doesn't match the certificate."
              onChange={(event) => setBody(event.target.value)}
            />
          </Field>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field id="comment-about" label="Which part" hint="Leave as the whole form if it is about all of it.">
              <SelectInput id="comment-about" value={about} onChange={(event) => setAbout(event.target.value)}>
                <option value="">The form as a whole</option>
                {parts.map((part) => (
                  <option key={part.id} value={part.id}>
                    {part.label}
                  </option>
                ))}
              </SelectInput>
            </Field>
            <Field
              id="comment-for"
              label="Who should deal with it"
              hint="They are told about it. Leave it open for whoever picks it up."
            >
              <SelectInput id="comment-for" value={forStaff} onChange={(event) => setForStaff(event.target.value)}>
                <option value="">Anybody who can</option>
                {people.map((person) => (
                  <option key={person.id} value={person.id}>
                    {person.name}
                    {person.wroteThisForm ? " — filled this in" : ""}
                  </option>
                ))}
              </SelectInput>
            </Field>
          </div>
          <div className="flex justify-end">
            <Button onClick={add} disabled={write.isPending || body.trim() === ""}>
              {write.isPending ? "Adding…" : "Add the comment"}
            </Button>
          </div>
        </div>
      )}
    </section>
  );
}
