/**
 * Password rules from the task sheet (#2), the same as StrongPassword.java on the server: at least 8 letters
 * (digits and symbols don't count towards the 8), including an uppercase and a lowercase letter, plus a number
 * and a symbol.
 */
export const passwordRules = [
  { label: "At least 8 letters", isMet: (password: string) => (password.match(/\p{L}/gu) ?? []).length >= 8 },
  { label: "An uppercase letter", isMet: (password: string) => /\p{Lu}/u.test(password) },
  { label: "A lowercase letter", isMet: (password: string) => /\p{Ll}/u.test(password) },
  { label: "A number", isMet: (password: string) => /\p{Nd}/u.test(password) },
  { label: "A symbol, such as ! @ # ?", isMet: (password: string) => /[^\p{L}\p{Nd}\s]/u.test(password) },
];

export function isStrongPassword(password: string) {
  return passwordRules.every((rule) => rule.isMet(password));
}
