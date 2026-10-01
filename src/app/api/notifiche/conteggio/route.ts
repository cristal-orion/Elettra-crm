import { getCurrentUser } from "@/lib/dal";
import { unreadNotificationCount } from "@/lib/notifiche";

export async function GET() {
  const user = await getCurrentUser();
  const headers = { "Cache-Control": "private, no-store" };
  if (!user) return Response.json({ error: "Sessione non valida." }, { status: 401, headers });
  return Response.json({ count: await unreadNotificationCount(user.id) }, { headers });
}
