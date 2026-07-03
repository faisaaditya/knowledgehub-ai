import { createClient } from "@/lib/supabase/server";
import { Sidebar } from "@/components/layouts/Sidebar";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  // Ambil profile user (full_name, organization_id)
  const { data: profile } = await supabase
    .from("profiles")
    .select("full_name")
    .eq("id", user?.id || "")
    .single();

  return (
    <div className="flex h-screen bg-background">
      <Sidebar user={user} profile={profile} />
      <main className="flex-1 overflow-y-auto p-6 pt-20 md:pt-6">
        {children}
      </main>
    </div>
  );
}

