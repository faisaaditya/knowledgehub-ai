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
import { Trash2, Loader2, FileText } from "lucide-react";
import { Button } from "@/components/ui/button";

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
    } catch (err) {
      console.error("Error deleting document:", err);
      alert("Gagal menghapus dokumen. Silakan coba lagi.");
    } finally {
      setDeletingId(null);
    }
  };

  const getStatusBadge = (status: string | null) => {
    const s = status?.toLowerCase() || "uploading";
    switch (s) {
      case "ready":
        return (
          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-emerald-50 text-emerald-700 border border-emerald-200">
            Siap
          </span>
        );
      case "processing":
        return (
          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-50 text-blue-700 border border-blue-200 animate-pulse">
            Memproses
          </span>
        );
      case "uploading":
        return (
          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-amber-50 text-amber-700 border border-amber-200 animate-pulse">
            Mengunggah
          </span>
        );
      case "failed":
        return (
          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-rose-50 text-rose-700 border border-rose-200">
            Gagal
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-50 text-gray-700 border border-gray-200">
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

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-gray-500">
        <Loader2 className="h-8 w-8 animate-spin mb-2 text-indigo-600" />
        <p className="text-sm">Memuat daftar dokumen...</p>
      </div>
    );
  }

  if (documents.length === 0) {
    return (
      <div className="text-center py-12 bg-white rounded-xl border border-gray-200 p-8 shadow-xs">
        <FileText className="mx-auto h-12 w-12 text-gray-400 mb-4" />
        <h3 className="text-sm font-semibold text-gray-900 mb-1">Belum ada dokumen</h3>
        <p className="text-sm text-gray-500 max-w-sm mx-auto">
          Unggah dokumen PDF pertama Anda untuk mulai berinteraksi dengan AI.
        </p>
      </div>
    );
  }

  return (
    <div className="bg-white border border-gray-200 rounded-xl overflow-hidden shadow-xs">
      <Table>
        <TableHeader>
          <TableRow className="bg-gray-50 hover:bg-gray-50">
            <TableHead className="w-1/2 font-semibold text-gray-700">Nama File</TableHead>
            <TableHead className="font-semibold text-gray-700">Status</TableHead>
            <TableHead className="font-semibold text-gray-700">Tanggal Unggah</TableHead>
            <TableHead className="w-[80px] text-right font-semibold text-gray-700">Aksi</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {documents.map((doc) => (
            <TableRow key={doc.id} className="hover:bg-gray-50/50 transition-colors">
              <TableCell className="font-medium text-gray-900 truncate max-w-md">
                <div className="flex items-center gap-2">
                  <FileText className="h-4 w-4 text-gray-400 shrink-0" />
                  <span className="truncate" title={doc.title}>{doc.title}</span>
                </div>
              </TableCell>
              <TableCell>{getStatusBadge(doc.status)}</TableCell>
              <TableCell className="text-gray-500 text-sm">
                {formatDate(doc.created_at)}
              </TableCell>
              <TableCell className="text-right">
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 text-gray-500 hover:text-red-600 hover:bg-red-50"
                  onClick={() => handleDelete(doc.id, doc.storage_path)}
                  disabled={deletingId === doc.id}
                >
                  {deletingId === doc.id ? (
                    <Loader2 className="h-4 w-4 animate-spin text-red-600" />
                  ) : (
                    <Trash2 className="h-4 w-4" />
                  )}
                </Button>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
