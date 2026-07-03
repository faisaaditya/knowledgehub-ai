"use client";

import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { LogOut } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { useState } from "react";
import { toast } from "sonner";

export function LogoutButton() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  const handleLogout = async () => {
    setLoading(true);
    const supabase = createClient();
    await supabase.auth.signOut();
    toast.success("Anda telah berhasil keluar.");
    router.push("/login");
    router.refresh();
  };

  return (
    <Button
      variant="ghost"
      className="w-full justify-start text-red-500 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-950/30"
      onClick={handleLogout}
      disabled={loading}
    >
      <LogOut className="h-4 w-4 mr-2" />
      {loading ? "Keluar..." : "Logout"}
    </Button>
  );
}
