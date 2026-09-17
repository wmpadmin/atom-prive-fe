/** Props that connect a control to the Field with the same id. */
export function describedBy(id: string, error?: string) {
  return { id, "aria-invalid": error ? true : undefined, "aria-describedby": error ? `${id}-error` : `${id}-hint` };
}
