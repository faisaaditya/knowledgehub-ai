"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { createClient } from "@/lib/supabase/client";
import { ChatBubble } from "@/components/features/ChatBubble";
import { ChatSidebar } from "@/components/features/ChatSidebar";
import { Send, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";

interface Message {
  role: "user" | "assistant";
  content: string;
  timestamp: string;
  sources?: Array<{ title: string; content?: string }>;
}

interface ChatSession {
  id: string;
  title: string | null;
  created_at: string | null;
}

export default function ChatPage() {
  const supabase = createClient();
  const [sessions, setSessions] = useState<ChatSession[]>([]);
  const [activeSessionId, setActiveSessionId] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [sessionsLoading, setSessionsLoading] = useState(true);
  const [userId, setUserId] = useState<string | null>(null);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Auto-scroll to bottom when messages change
  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, []);

  useEffect(() => {
    scrollToBottom();
  }, [messages, loading, scrollToBottom]);

  // Fetch current user
  useEffect(() => {
    const getUser = async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (user) setUserId(user.id);
    };
    getUser();
  }, [supabase]);

  // Fetch chat sessions
  const fetchSessions = useCallback(async () => {
    if (!userId) return;
    setSessionsLoading(true);
    try {
      const { data, error } = await supabase
        .from("chat_sessions")
        .select("id, title, created_at")
        .eq("profile_id", userId)
        .order("created_at", { ascending: false });

      if (error) throw error;
      setSessions(data || []);
    } catch (err) {
      console.error("Error fetching sessions:", err);
    } finally {
      setSessionsLoading(false);
    }
  }, [userId, supabase]);

  useEffect(() => {
    if (userId) fetchSessions();
  }, [userId, fetchSessions]);

  // Handle selecting a session
  const handleSelectSession = (sessionId: string) => {
    setActiveSessionId(sessionId);
    // For now, reset messages since we don't persist them yet
    setMessages([]);
  };

  // Handle creating a new chat
  const handleNewChat = () => {
    setActiveSessionId(null);
    setMessages([]);
    setInput("");
    if (textareaRef.current) textareaRef.current.focus();
  };

  // Send message with streaming Edge Function ask-ai call
  const sendMessage = async () => {
    const trimmed = input.trim();
    if (!trimmed || loading) return;

    const userMsg: Message = {
      role: "user",
      content: trimmed,
      timestamp: new Date().toISOString(),
    };
    setMessages((prev) => [...prev, userMsg]);
    setInput("");
    setLoading(true);

    // Auto-resize textarea back to default
    if (textareaRef.current) {
      textareaRef.current.style.height = "auto";
    }

    // Create a new session in DB if this is the first message
    let currentSessionId = activeSessionId;
    if (!currentSessionId && userId) {
      try {
        const sessionTitle =
          trimmed.length > 40 ? trimmed.substring(0, 40) + "..." : trimmed;
        const { data: newSession, error } = await supabase
          .from("chat_sessions")
          .insert({
            profile_id: userId,
            title: sessionTitle,
          })
          .select()
          .single();

        if (error) throw error;
        if (newSession) {
          currentSessionId = newSession.id;
          setActiveSessionId(newSession.id);
          setSessions((prev) => [newSession, ...prev]);
        }
      } catch (err) {
        console.error("Error creating session:", err);
      }
    }

    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        throw new Error("Sesi pengguna tidak ditemukan. Silakan login kembali.");
      }

      const edgeFunctionUrl =
        process.env.NEXT_PUBLIC_SUPABASE_EDGE_FUNCTION_URL ||
        `${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/ask-ai`;

      const response = await fetch(edgeFunctionUrl, {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${session.access_token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ query: trimmed }),
      });

      if (!response.ok) {
        throw new Error(`Gagal memanggil AI. Status: ${response.status}`);
      }

      const reader = response.body?.getReader();
      const decoder = new TextDecoder();

      if (!reader) {
        throw new Error("Gagal membaca respons stream.");
      }

      // Add template assistant message to be populated via SSE stream
      setMessages((prev) => [
        ...prev,
        {
          role: "assistant",
          content: "",
          timestamp: new Date().toISOString(),
          sources: [],
        },
      ]);
      setLoading(false); // Done initializing, start streaming

      let aiResponseText = "";
      let sourcesList: any[] = [];
      let buffer = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n\n");
        // Keep the last partial element in buffer
        buffer = lines.pop() || "";

        for (const line of lines) {
          const cleanLine = line.trim();
          if (cleanLine.startsWith("data: ")) {
            try {
              const data = JSON.parse(cleanLine.slice(6));
              if (data.type === "sources") {
                sourcesList = data.data || [];
                setMessages((prev) => {
                  const updated = [...prev];
                  const last = updated[updated.length - 1];
                  if (last && last.role === "assistant") {
                    last.sources = sourcesList;
                  }
                  return updated;
                });
              } else if (data.type === "text") {
                aiResponseText += data.data;
                setMessages((prev) => {
                  const updated = [...prev];
                  const last = updated[updated.length - 1];
                  if (last && last.role === "assistant") {
                    last.content = aiResponseText;
                  }
                  return updated;
                });
              }
            } catch (jsonErr) {
              console.warn("Error parsing SSE JSON:", jsonErr, cleanLine);
            }
          }
        }
      }

      // Parse remaining buffer if present
      if (buffer.trim()) {
        const cleanLine = buffer.trim();
        if (cleanLine.startsWith("data: ")) {
          try {
            const data = JSON.parse(cleanLine.slice(6));
            if (data.type === "sources") {
              sourcesList = data.data || [];
              setMessages((prev) => {
                const updated = [...prev];
                const last = updated[updated.length - 1];
                if (last && last.role === "assistant") {
                  last.sources = sourcesList;
                }
                return updated;
              });
            } else if (data.type === "text") {
              aiResponseText += data.data;
              setMessages((prev) => {
                const updated = [...prev];
                const last = updated[updated.length - 1];
                if (last && last.role === "assistant") {
                  last.content = aiResponseText;
                }
                return updated;
              });
            }
          } catch (jsonErr) {
            console.warn("Error parsing final SSE JSON:", jsonErr, cleanLine);
          }
        }
      }
    } catch (err: any) {
      console.error("Fetch/Stream error:", err);
      setLoading(false);
      setMessages((prev) => [
        ...prev,
        {
          role: "assistant",
          content: "Maaf, terjadi kesalahan saat menghubungi AI. Silakan coba lagi.",
          timestamp: new Date().toISOString(),
        },
      ]);
    }
  };

  // Handle Enter key (Shift+Enter for newline)
  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  // Auto-resize textarea
  const handleInputChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setInput(e.target.value);
    const el = e.target;
    el.style.height = "auto";
    el.style.height = Math.min(el.scrollHeight, 160) + "px";
  };

  return (
    <div className="flex h-full -m-6 bg-white">
      {/* Chat Sidebar */}
      <ChatSidebar
        sessions={sessions}
        activeSessionId={activeSessionId}
        onSelectSession={handleSelectSession}
        onNewChat={handleNewChat}
        loading={sessionsLoading}
      />

      {/* Main Chat Area */}
      <div className="flex-1 flex flex-col h-full min-w-0">
        {/* Chat Header */}
        <div className="h-14 border-b border-gray-200 flex items-center px-6 bg-white shrink-0">
          <Sparkles className="h-4 w-4 text-indigo-500 mr-2" />
          <h2 className="text-sm font-semibold text-gray-800">
            {activeSessionId
              ? sessions.find((s) => s.id === activeSessionId)?.title ||
                "Percakapan"
              : "Percakapan Baru"}
          </h2>
        </div>

        {/* Messages Area */}
        <div className="flex-1 overflow-y-auto px-6 py-6">
          {messages.length === 0 ? (
            /* Welcome Banner */
            <div className="flex items-center justify-center h-full">
              <div className="text-center max-w-md">
                <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-indigo-50 border border-indigo-100 mb-5">
                  <Sparkles className="h-8 w-8 text-indigo-500" />
                </div>
                <h3 className="text-lg font-bold text-gray-900 mb-2">
                  Halo! Saya asisten AI 👋
                </h3>
                <p className="text-sm text-gray-500 leading-relaxed">
                  Tanyakan apa saja tentang dokumen Anda. Saya akan membantu
                  menjawab berdasarkan konten yang sudah diunggah.
                </p>
              </div>
            </div>
          ) : (
            <>
              {messages.map((msg, i) => (
                <ChatBubble
                  key={i}
                  message={msg.content}
                  role={msg.role}
                  timestamp={msg.timestamp}
                  sources={msg.sources}
                />
              ))}

              {/* Loading Dots */}
              {loading && (
                <div className="flex justify-start mb-4">
                  <div className="bg-gray-100 border border-gray-200 px-4 py-3 rounded-2xl rounded-bl-none">
                    <div className="flex items-center gap-1.5">
                      <span className="w-2 h-2 bg-gray-400 rounded-full animate-bounce [animation-delay:0ms]" />
                      <span className="w-2 h-2 bg-gray-400 rounded-full animate-bounce [animation-delay:150ms]" />
                      <span className="w-2 h-2 bg-gray-400 rounded-full animate-bounce [animation-delay:300ms]" />
                    </div>
                  </div>
                </div>
              )}
              <div ref={messagesEndRef} />
            </>
          )}
        </div>

        {/* Input Area */}
        <div className="border-t border-gray-200 bg-white p-4 shrink-0">
          <div className="flex items-end gap-3 max-w-3xl mx-auto">
            <textarea
              ref={textareaRef}
              value={input}
              onChange={handleInputChange}
              onKeyDown={handleKeyDown}
              placeholder="Ketik pesan Anda..."
              disabled={loading}
              rows={1}
              className="flex-1 resize-none border border-gray-300 rounded-xl px-4 py-3 text-sm text-gray-800 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent disabled:opacity-50 disabled:cursor-not-allowed transition-shadow bg-gray-50/50"
            />
            <Button
              onClick={sendMessage}
              disabled={!input.trim() || loading}
              className="bg-indigo-600 hover:bg-indigo-700 text-white h-11 w-11 rounded-xl shrink-0 disabled:opacity-40 transition-colors"
              size="icon"
            >
              <Send className="h-4 w-4" />
            </Button>
          </div>
          <p className="text-[10px] text-gray-400 text-center mt-2">
            Tekan Enter untuk mengirim, Shift+Enter untuk baris baru
          </p>
        </div>
      </div>
    </div>
  );
}
