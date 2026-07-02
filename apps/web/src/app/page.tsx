import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export default async function HomePage() {
  const supabase = await createClient();
  const {
    data: { session },
  } = await supabase.auth.getSession();

  // Jika sudah login, langsung ke dashboard
  if (session) {
    redirect("/dashboard");
  } else {
    // Jika belum, ke halaman login
    redirect("/login");
  }
}
