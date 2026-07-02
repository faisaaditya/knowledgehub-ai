"use client";

import { MessageSquare, Plus, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
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
    <div className="w-60 bg-white border-r border-gray-200 flex flex-col h-full shrink-0">
      {/* Action Button */}
      <div className="p-4 border-b border-gray-100">
        <Button
          onClick={onNewChat}
          className="w-full bg-indigo-50 text-indigo-700 hover:bg-indigo-100 hover:text-indigo-800 border border-indigo-100 flex items-center justify-center gap-2 font-medium transition-colors"
        >
          <Plus className="h-4 w-4" />
          Percakapan Baru
        </Button>
      </div>

      {/* History Title */}
      <div className="px-4 pt-4 pb-2 text-xs font-semibold text-gray-400 uppercase tracking-wider">
        Riwayat Obrolan
      </div>

      {/* Sessions list */}
      <div className="flex-1 overflow-y-auto px-2 pb-4 space-y-1">
        {loading ? (
          <div className="flex items-center justify-center py-8 text-gray-400">
            <Loader2 className="h-5 w-5 animate-spin mr-2 text-indigo-500" />
            <span className="text-xs">Memuat sesi...</span>
          </div>
        ) : sessions.length === 0 ? (
          <div className="text-center py-8 px-4 text-xs text-gray-400 leading-relaxed">
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
                    ? "bg-indigo-50 text-indigo-950 font-medium"
                    : "text-gray-600 hover:bg-gray-50 hover:text-gray-900"
                )}
              >
                <MessageSquare
                  className={cn(
                    "h-4 w-4 shrink-0 mt-0.5 transition-colors",
                    isActive
                      ? "text-indigo-600"
                      : "text-gray-400 group-hover:text-gray-600"
                  )}
                />
                <div className="flex-1 min-w-0">
                  <p
                    className="truncate text-xs font-medium text-gray-800 group-hover:text-gray-950"
                    title={session.title || "Percakapan"}
                  >
                    {session.title || "Percakapan"}
                  </p>
                  <span className="block text-[10px] text-gray-400 mt-0.5">
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
