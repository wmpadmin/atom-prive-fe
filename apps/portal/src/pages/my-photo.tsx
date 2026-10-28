import { ApiError } from "@atomprive/api-client";
import { useRemoveMyPhoto, useUploadMyPhoto, type Me } from "@atomprive/api-client/portal";
import { useQueryClient } from "@tanstack/react-query";
import { useRef, useState } from "react";
import { initialsOf } from "./family-tree";

/**
 * The client's own face, and the one place they change it.
 *
 * <p>On the avatar itself rather than behind a settings page. Somebody who wants their photograph on their
 * family tree is already looking at the circle with their initials in it, and a screen that made them hunt
 * for the place to change it is a screen they will not bother with.
 *
 * <p>The firm can already set this from a client's file, which is right for somebody who walked in with a
 * passport. This is for the client who simply wants to be recognisable to their own family.
 */
export function MyPhoto({ me }: { me: Me | undefined }) {
  const [open, setOpen] = useState(false);
  const [problem, setProblem] = useState<string>();
  const file = useRef<HTMLInputElement>(null);
  const queryClient = useQueryClient();

  const done = {
    mutation: {
      onSuccess: () => {
        setProblem(undefined);
        setOpen(false);
        void queryClient.invalidateQueries();
      },
      onError: (failed: ApiError) => setProblem(failed.message),
    },
  };
  const upload = useUploadMyPhoto<ApiError>(done);
  const remove = useRemoveMyPhoto<ApiError>(done);
  const busy = upload.isPending || remove.isPending;

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen((was) => !was)}
        aria-label="Change your photo"
        className="block rounded-full ring-blue-500 focus-visible:ring-2 focus-visible:outline-none"
      >
        {me?.photo ? (
          <img src={me.photo} alt="" className="size-9 rounded-full object-cover" />
        ) : (
          <span
            aria-hidden="true"
            className="grid size-9 place-items-center rounded-full bg-blue-100 text-xs font-bold text-blue-700"
          >
            {initialsOf(me?.fullName ?? "")}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute top-11 right-0 z-10 w-60 rounded-xl border border-slate-200 bg-white p-4 shadow-lg">
          <p className="text-sm font-bold text-slate-900">Your photo</p>
          <p className="mt-1 text-xs text-slate-500">
            Shown to your family on the family tree. JPEG, PNG or WebP, up to 5MB.
          </p>

          {/* The input itself is hidden: a browser's own file control cannot be styled and reads as a
              fragment of a different application sitting inside this one. */}
          <input
            ref={file}
            type="file"
            accept="image/jpeg,image/png,image/webp"
            className="hidden"
            onChange={(event) => {
              const chosen = event.target.files?.[0];
              event.target.value = "";
              if (chosen) {
                upload.mutate({ data: { file: chosen } });
              }
            }}
          />

          {problem && <p className="mt-2 text-xs text-red-600">{problem}</p>}

          <div className="mt-3 space-y-2">
            <button
              type="button"
              disabled={busy}
              onClick={() => file.current?.click()}
              className="w-full rounded-lg bg-blue-600 px-3 py-2 text-xs font-bold text-white disabled:opacity-60"
            >
              {upload.isPending ? "Uploading…" : me?.photo ? "Choose a new photo" : "Upload a photo"}
            </button>
            {me?.photo && (
              <button
                type="button"
                disabled={busy}
                onClick={() => remove.mutate()}
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-xs font-bold text-slate-700 disabled:opacity-60"
              >
                {remove.isPending ? "Removing…" : "Remove photo"}
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
