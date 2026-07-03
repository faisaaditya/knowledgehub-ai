"use client";

import { MessageSquare, Plus, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

interface ChatSession {
  id: string;
  title: string | null;
  created_at: string | null;
}

interface ChatSidebarProps {
  sessions: ChatSession[];
  activeSessionId: string | null;
  onSelectSession: (id: string) => void;
  onNewChat: () => void;
  loading: boolean;
}

export function ChatSidebar({
  sessions,
  activeSessionId,
  onSelectSession,
  onNewChat,
  loading,
}: ChatSidebarProps) {
  const formatDate = (dateStr: string | null) => {
    if (!dateStr) return "";
    try {
      const date = new Date(dateStr);
      return date.toLocaleDateString("id-ID", {
        day: "numeric",
        month: "short",
      });
    } catch {
      return "";
    }
  };

  return (
    <div className="w-60 bg-card border-r border-border flex flex-col h-full shrink-0">
      {/* Action Button */}
      <div className="p-4 border-b border-border">
        <Button
          onClick={onNewChat}
          className="w-full bg-indigo-50 dark:bg-indigo-950/50 text-indigo-700 dark:text-indigo-300 hover:bg-indigo-100 dark:hover:bg-indigo-950/80 border border-indigo-100 dark:border-indigo-900 flex items-center justify-center gap-2 font-medium transition-colors"
        >
          <Plus className="h-4 w-4" />
          Percakapan Baru
        </Button>
      </div>

      {/* History Title */}
      <div className="px-4 pt-4 pb-2 text-xs font-semibold text-muted-foreground uppercase tracking-wider">
        Riwayat Obrolan
      </div>

      {/* Sessions list */}
      <div className="flex-1 overflow-y-auto px-2 pb-4 space-y-1">
        {loading ? (
          <div className="space-y-1 px-1 pt-1">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="flex items-start gap-2.5 px-3 py-2.5">
                <Skeleton className="h-4 w-4 rounded shrink-0 mt-0.5" />
                <div className="flex-1 space-y-1.5">
                  <Skeleton className="h-3 w-full rounded" />
                  <Skeleton className="h-2.5 w-16 rounded" />
                </div>
              </div>
            ))}
          </div>
        ) : sessions.length === 0 ? (
          <div className="text-center py-8 px-4 text-xs text-muted-foreground leading-relaxed">
            Belum ada percakapan
          </div>
        ) : (
          sessions.map((session) => {
            const isActive = session.id === activeSessionId;
            return (
              <button
                key={session.id}
                onClick={() => onSelectSession(session.id)}
                className={cn(
                  "w-full text-left px-3 py-2.5 rounded-lg text-sm transition-all flex items-start gap-2.5 group",
                  isActive
                    ? "bg-indigo-50 dark:bg-indigo-950/50 text-indigo-900 dark:text-indigo-100 font-medium"
                    : "text-muted-foreground hover:bg-muted hover:text-foreground"
                )}
              >
                <MessageSquare
                  className={cn(
                    "h-4 w-4 shrink-0 mt-0.5 transition-colors",
                    isActive
                      ? "text-indigo-600 dark:text-indigo-400"
                      : "text-muted-foreground group-hover:text-foreground"
                  )}
                />
                <div className="flex-1 min-w-0">
                  <p
                    className="truncate text-xs font-medium"
                    title={session.title || "Percakapan"}
                  >
                    {session.title || "Percakapan"}
                  </p>
                  <span className="block text-[10px] text-muted-foreground mt-0.5">
                    {formatDate(session.created_at)}
                  </span>
                </div>
              </button>
            );
          })
        )}
      </div>
    </div>
  );
}
