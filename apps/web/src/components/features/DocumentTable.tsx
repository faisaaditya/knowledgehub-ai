"use client";

import { useEffect, useState, useCallback } from "react";
import { createClient } from "@/lib/supabase/client";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { ScrollArea, ScrollBar } from "@/components/ui/scroll-area";
import { Skeleton } from "@/components/ui/skeleton";
import { Trash2, Loader2, FileText } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

interface DocumentTableProps {
  organizationId: string;
}

interface Document {
  id: string;
  title: string;
  status: string | null;
  storage_path: string;
  created_at: string | null;
  chunk_count: number | null;
}

export function DocumentTable({ organizationId }: DocumentTableProps) {
  const supabase = createClient();
  const [documents, setDocuments] = useState<Document[]>([]);
  const [loading, setLoading] = useState(true);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const fetchDocuments = useCallback(async () => {
    if (!organizationId) return;

    try {
      const { data, error } = await supabase
        .from("documents")
        .select("*")
        .eq("organization_id", organizationId)
        .order("created_at", { ascending: false });

      if (error) throw error;
      setDocuments(data || []);
    } catch (err) {
      console.error("Error fetching documents:", err);
    } finally {
      setLoading(false);
    }
  }, [organizationId, supabase]);

  useEffect(() => {
    fetchDocuments();

    // Subscribe to Postgres changes for realtime update
    const channel = supabase
      .channel("documents-changes")
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "documents",
          filter: `organization_id=eq.${organizationId}`,
        },
        () => {
          fetchDocuments();
        }
      )
      .subscribe();

    // Polling as a fallback (every 5 seconds)
    const interval = setInterval(() => {
      fetchDocuments();
    }, 5000);

    return () => {
      supabase.removeChannel(channel);
      clearInterval(interval);
    };
  }, [organizationId, fetchDocuments, supabase]);

  const handleDelete = async (docId: string, storagePath: string) => {
    if (!confirm("Apakah Anda yakin ingin menghapus dokumen ini?")) return;

    setDeletingId(docId);
    try {
      // 1. Delete physical file from storage
      const { error: storageError } = await supabase.storage
        .from("documents")
        .remove([storagePath]);

      if (storageError) {
        console.error("Error removing file from storage:", storageError);
      }

      // 2. Delete database record
      const { error: dbError } = await supabase
        .from("documents")
        .delete()
        .eq("id", docId);

      if (dbError) throw dbError;

      // Update state locally immediately
      setDocuments((prev) => prev.filter((d) => d.id !== docId));
      toast.success("Dokumen berhasil dihapus.");
    } catch (err) {
      console.error("Error deleting document:", err);
      toast.error("Gagal menghapus dokumen. Silakan coba lagi.");
    } finally {
      setDeletingId(null);
    }
  };

  const getStatusBadge = (status: string | null) => {
    const s = status?.toLowerCase() || "uploading";
    switch (s) {
      case "ready":
        return (
          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800">
            Siap
          </span>
        );
      case "processing":
        return (
          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-50 dark:bg-blue-950/40 text-blue-700 dark:text-blue-400 border border-blue-200 dark:border-blue-800 animate-pulse">
            Memproses
          </span>
        );
      case "uploading":
        return (
          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-400 border border-amber-200 dark:border-amber-800 animate-pulse">
            Mengunggah
          </span>
        );
      case "failed":
        return (
          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-rose-50 dark:bg-rose-950/40 text-rose-700 dark:text-rose-400 border border-rose-200 dark:border-rose-800">
            Gagal
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-muted text-muted-foreground border border-border">
            {s}
          </span>
        );
    }
  };

  const formatDate = (dateString: string | null) => {
    if (!dateString) return "-";
    try {
      const date = new Date(dateString);
      return date.toLocaleDateString("id-ID", {
        day: "numeric",
        month: "short",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      });
    } catch {
      return dateString;
    }
  };

  // --- Skeleton Loading State ---
  if (loading) {
    return (
      <div className="bg-card border border-border rounded-xl overflow-hidden shadow-xs">
        <Table>
          <TableHeader>
            <TableRow className="bg-muted/50 hover:bg-muted/50">
              <TableHead className="w-1/2 font-semibold text-muted-foreground">Nama File</TableHead>
              <TableHead className="font-semibold text-muted-foreground">Status</TableHead>
              <TableHead className="font-semibold text-muted-foreground">Tanggal Unggah</TableHead>
              <TableHead className="w-[80px] text-right font-semibold text-muted-foreground">Aksi</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {Array.from({ length: 4 }).map((_, i) => (
              <TableRow key={i}>
                <TableCell>
                  <div className="flex items-center gap-2">
                    <Skeleton className="h-4 w-4 rounded" />
                    <Skeleton className="h-4 w-48 rounded" />
                  </div>
                </TableCell>
                <TableCell><Skeleton className="h-5 w-20 rounded-full" /></TableCell>
                <TableCell><Skeleton className="h-4 w-32 rounded" /></TableCell>
                <TableCell className="text-right"><Skeleton className="h-8 w-8 rounded ml-auto" /></TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    );
  }

  if (documents.length === 0) {
    return (
      <div className="text-center py-12 bg-card rounded-xl border border-border p-8 shadow-xs">
        <FileText className="mx-auto h-12 w-12 text-muted-foreground mb-4" />
        <h3 className="text-sm font-semibold text-foreground mb-1">Belum ada dokumen</h3>
        <p className="text-sm text-muted-foreground max-w-sm mx-auto">
          Unggah dokumen PDF pertama Anda untuk mulai berinteraksi dengan AI.
        </p>
      </div>
    );
  }

  return (
    <ScrollArea className="w-full rounded-xl border border-border bg-card shadow-xs">
      <Table>
        <TableHeader>
          <TableRow className="bg-muted/50 hover:bg-muted/50">
            <TableHead className="w-1/2 font-semibold text-muted-foreground whitespace-nowrap">Nama File</TableHead>
            <TableHead className="font-semibold text-muted-foreground whitespace-nowrap">Status</TableHead>
            <TableHead className="font-semibold text-muted-foreground whitespace-nowrap">Tanggal Unggah</TableHead>
            <TableHead className="w-[80px] text-right font-semibold text-muted-foreground whitespace-nowrap">Aksi</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {documents.map((doc) => (
            <TableRow key={doc.id} className="hover:bg-muted/30 transition-colors">
              <TableCell className="font-medium text-foreground truncate max-w-md">
                <div className="flex items-center gap-2">
                  <FileText className="h-4 w-4 text-muted-foreground shrink-0" />
                  <span className="truncate" title={doc.title}>{doc.title}</span>
                </div>
              </TableCell>
              <TableCell>{getStatusBadge(doc.status)}</TableCell>
              <TableCell className="text-muted-foreground text-sm whitespace-nowrap">
                {formatDate(doc.created_at)}
              </TableCell>
              <TableCell className="text-right">
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 text-muted-foreground hover:text-destructive hover:bg-destructive/10"
                  onClick={() => handleDelete(doc.id, doc.storage_path)}
                  disabled={deletingId === doc.id}
                >
                  {deletingId === doc.id ? (
                    <Loader2 className="h-4 w-4 animate-spin text-destructive" />
                  ) : (
                    <Trash2 className="h-4 w-4" />
                  )}
                </Button>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
      <ScrollBar orientation="horizontal" />
    </ScrollArea>
  );
}
