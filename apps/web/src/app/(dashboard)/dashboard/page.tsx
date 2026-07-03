import { createClient } from "@/lib/supabase/server";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { FileText, CheckCircle, MessageSquare } from "lucide-react";
import { DocumentTable } from "@/components/features/DocumentTable";
import { UploadModal } from "@/components/features/UploadModal";

export default async function DashboardPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  // Ambil organization_id dari profile user
  const { data: profile } = await supabase
    .from("profiles")
    .select("organization_id")
    .eq("id", user?.id || "")
    .single();

  const orgId = profile?.organization_id || "";

  // --- DEBUGGING LOGS ---
  console.log("User ID:", user?.id);
  console.log("Profile data:", profile);
  console.log("Org ID:", orgId);
  // ----------------------

  // Hitung statistik dokumen
  let totalDocsCount = 0;
  let readyDocsCount = 0;
  let chatSessionsCount = 0;

  if (orgId) {
    const { count: totalDocs } = await supabase
      .from("documents")
      .select("*", { count: "exact", head: true })
      .eq("organization_id", orgId);
    totalDocsCount = totalDocs || 0;

    const { count: readyDocs } = await supabase
      .from("documents")
      .select("*", { count: "exact", head: true })
      .eq("organization_id", orgId)
      .eq("status", "ready");
    readyDocsCount = readyDocs || 0;
  }

  if (user?.id) {
    const { count: chatSessions } = await supabase
      .from("chat_sessions")
      .select("*", { count: "exact", head: true })
      .eq("profile_id", user.id);
    chatSessionsCount = chatSessions || 0;
  }

  const stats = [
    {
      title: "Total Dokumen",
      value: totalDocsCount,
      icon: FileText,
      color: "text-blue-500",
      bg: "bg-blue-50 dark:bg-blue-950/40",
    },
    {
      title: "Dokumen Siap",
      value: readyDocsCount,
      icon: CheckCircle,
      color: "text-emerald-500",
      bg: "bg-emerald-50 dark:bg-emerald-950/40",
    },
    {
      title: "Sesi Chat",
      value: chatSessionsCount,
      icon: MessageSquare,
      color: "text-purple-500",
      bg: "bg-purple-50 dark:bg-purple-950/40",
    },
  ];

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-foreground mb-2">Dashboard</h1>
        <p className="text-sm text-muted-foreground">Kelola berkas dokumen dan lihat aktivitas chatbot tim Anda.</p>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        {stats.map((stat) => {
          const Icon = stat.icon;
          return (
            <Card key={stat.title} className="bg-card border-border">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">
                  {stat.title}
                </CardTitle>
                <div className={`p-2 rounded-lg ${stat.bg}`}>
                  <Icon className={`h-4 w-4 ${stat.color}`} />
                </div>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-foreground">{stat.value}</div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      <div className="mt-8">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-lg font-semibold text-foreground">Daftar Dokumen</h2>
          {orgId && <UploadModal organizationId={orgId} />}
        </div>
        {orgId ? (
          <DocumentTable organizationId={orgId} />
        ) : (
          <div className="bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 p-4 rounded-xl text-amber-800 dark:text-amber-300 text-sm">
            Profil Anda tidak memiliki ID organisasi. Harap hubungi administrator.
          </div>
        )}
      </div>
    </div>
  );
}