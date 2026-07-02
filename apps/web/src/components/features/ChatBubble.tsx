"use client";

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
    <div
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
            : "bg-gray-100 text-gray-800 rounded-bl-none border border-gray-200"
        )}
      >
        <p className="whitespace-pre-wrap leading-relaxed">{message}</p>
        
        {/* Render sources for assistant messages if present */}
        {!isUser && uniqueSources.length > 0 && (
          <div className="mt-3 pt-2.5 border-t border-gray-300/50 text-xs text-gray-500">
            <span className="font-semibold text-gray-700 flex items-center gap-1 mb-1">
              <FileText className="h-3.5 w-3.5 text-indigo-500" />
              Sumber Dokumen:
            </span>
            <ul className="space-y-1 mt-1">
              {uniqueSources.map((title, idx) => (
                <li key={idx} className="flex items-center gap-1.5 truncate" title={title}>
                  <span className="text-[10px] bg-gray-200 text-gray-700 font-semibold px-1 rounded-sm shrink-0 select-none">
                    {idx + 1}
                  </span>
                  <span className="truncate text-gray-600 hover:text-gray-900">{title}</span>
                </li>
              ))}
            </ul>
          </div>
        )}

        {timestamp && (
          <span
            className={cn(
              "block text-[10px] mt-2 text-right select-none opacity-70",
              isUser ? "text-indigo-200" : "text-gray-400"
            )}
          >
            {formatTime(timestamp)}
          </span>
        )}
      </div>
    </div>
  );
}
