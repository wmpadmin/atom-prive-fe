import { ClientsPage } from "../clients/clients-page";

/**
 * The clients this advisor looks after, and nobody else's (#77). It is the same list Admins and Compliance
 * use — the same columns, search and filters — narrowed by the API to the clients assigned to them, so an
 * advisor and an Admin are looking at one screen rather than two that drift apart.
 */
export function MyClientsPage() {
  return <ClientsPage mine />;
}
