"use client";

import { motion } from "framer-motion";
import { cn } from "@/lib/utils";
import { FileText } from "lucide-react";

interface Source {
  title: string;
  content?: string;
}

interface ChatBubbleProps {
  message: string;
  role: "user" | "assistant";
  timestamp?: string;
  sources?: Source[];
}

export function ChatBubble({ message, role, timestamp, sources }: ChatBubbleProps) {
  const isUser = role === "user";

  const formatTime = (timeStr?: string) => {
    if (!timeStr) return "";
    try {
      const date = new Date(timeStr);
      return date.toLocaleTimeString("id-ID", {
        hour: "2-digit",
        minute: "2-digit",
      });
    } catch {
      return "";
    }
  };

  // Deduplicate sources by title
  const uniqueSources = sources
    ? Array.from(new Set(sources.map((s) => s.title)))
    : [];

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.28, ease: "easeOut" }}
      className={cn(
        "flex w-full mb-4",
        isUser ? "justify-end" : "justify-start"
      )}
    >
      <div
        className={cn(
          "max-w-[75%] px-4 py-3 rounded-2xl text-sm shadow-xs transition-all duration-200",
          isUser
            ? "bg-indigo-600 text-white rounded-br-none"
            : "bg-muted text-foreground rounded-bl-none border border-border"
        )}
      >
        <p className="whitespace-pre-wrap leading-relaxed">{message}</p>

        {/* Render sources for assistant messages if present */}
        {!isUser && uniqueSources.length > 0 && (
          <div className="mt-3 pt-2.5 border-t border-border/50 text-xs text-muted-foreground">
            <span className="font-semibold text-foreground flex items-center gap-1 mb-1">
              <FileText className="h-3.5 w-3.5 text-indigo-500" />
              Sumber Dokumen:
            </span>
            <ul className="space-y-1 mt-1">
              {uniqueSources.map((title, idx) => (
                <li key={idx} className="flex items-center gap-1.5 truncate" title={title}>
                  <span className="text-[10px] bg-muted-foreground/20 text-muted-foreground font-semibold px-1 rounded-sm shrink-0 select-none">
                    {idx + 1}
                  </span>
                  <span className="truncate text-muted-foreground hover:text-foreground">{title}</span>
                </li>
              ))}
            </ul>
          </div>
        )}

        {timestamp && (
          <span
            className={cn(
              "block text-[10px] mt-2 text-right select-none opacity-70",
              isUser ? "text-indigo-200" : "text-muted-foreground"
            )}
          >
            {formatTime(timestamp)}
          </span>
        )}
      </div>
    </motion.div>
  );
}
