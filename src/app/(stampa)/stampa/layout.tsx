import { requireUser } from "@/lib/dal";
import "./stampa.css";

export const metadata = { robots: { index: false, follow: false } };

export default async function PrintLayout({ children }: { children: React.ReactNode }) {
  await requireUser();
  return children;
}
