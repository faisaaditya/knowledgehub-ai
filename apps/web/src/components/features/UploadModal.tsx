"use client";

import { useState, useRef } from "react";
import { createClient } from "@/lib/supabase/client";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
  DialogClose,
} from "@/components/ui/dialog";
import { Progress } from "@/components/ui/progress";
import { Button } from "@/components/ui/button";
import { UploadCloud, File, AlertCircle, Loader2 } from "lucide-react";

interface UploadModalProps {
  organizationId: string;
  onUploadSuccess?: () => void;
}

export function UploadModal({ organizationId, onUploadSuccess }: UploadModalProps) {
  const supabase = createClient();
  const [open, setOpen] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [dragActive, setDragActive] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [statusText, setStatusText] = useState("");
  
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true);
    } else if (e.type === "dragleave") {
      setDragActive(false);
    }
  };

  const validateFile = (selectedFile: File): boolean => {
    setError(null);
    if (selectedFile.type !== "application/pdf") {
      setError("Hanya diperbolehkan mengunggah file PDF (.pdf).");
      return false;
    }
    // 10MB limit
    if (selectedFile.size > 10 * 1024 * 1024) {
      setError("Ukuran file melebihi batas maksimum 10MB.");
      return false;
    }
    return true;
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);

    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      const selectedFile = e.dataTransfer.files[0];
      if (validateFile(selectedFile)) {
        setFile(selectedFile);
      }
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const selectedFile = e.target.files[0];
      if (validateFile(selectedFile)) {
        setFile(selectedFile);
      }
    }
  };

  const handleUpload = async () => {
    if (!file || !organizationId) return;

    setUploading(true);
    setProgress(0);
    setError(null);
    setStatusText("Menyiapkan dokumen...");

    let docRecordId = "";

    try {
      // 1. Create a record in database with status 'uploading'
      const storagePath = `${organizationId}/${file.name}`;
      
      const { data: docRecord, error: insertError } = await supabase
        .from("documents")
        .insert({
          title: file.name,
          status: "uploading",
          storage_path: storagePath,
          organization_id: organizationId,
        })
        .select()
        .single();

      if (insertError) throw insertError;
      docRecordId = docRecord.id;

      setStatusText("Mengunggah berkas...");

      // 2. Upload file to Supabase Storage Bucket
      const { error: uploadError } = await supabase.storage
        .from("documents")
        .upload(storagePath, file, {
          upsert: true,
          // Real-time progress updates via supabase-js
          onUploadProgress: (progressEvent: { loaded: number; total: number }) => {
            const percent = Math.round(
              (progressEvent.loaded / progressEvent.total) * 100
            );
            setProgress(percent);
          },
        } as any);

      if (uploadError) throw uploadError;

      setStatusText("Mengirim untuk diproses...");

      // 3. Update database record status to 'processing'
      const { error: updateError } = await supabase
        .from("documents")
        .update({ status: "processing" })
        .eq("id", docRecordId);

      if (updateError) throw updateError;

      // Close modal and call success callback
      setOpen(false);
      setFile(null);
      if (onUploadSuccess) onUploadSuccess();
    } catch (err: any) {
      console.error("Upload error:", err);
      setError(err?.message || "Terjadi kesalahan saat mengunggah berkas.");
      
      // Cleanup database record if storage or update failed
      if (docRecordId) {
        await supabase.from("documents").delete().eq("id", docRecordId);
      }
    } finally {
      setUploading(false);
    }
  };

  const onTriggerClick = () => {
    if (fileInputRef.current) {
      fileInputRef.current.click();
    }
  };

  return (
    <Dialog open={open} onOpenChange={(val) => !uploading && setOpen(val)}>
      <DialogTrigger asChild>
        <Button className="bg-indigo-600 hover:bg-indigo-700 text-white font-medium shadow-sm transition-colors">
          Upload Dokumen
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md bg-white border border-gray-100 shadow-xl rounded-xl">
        <DialogHeader>
          <DialogTitle className="text-gray-900 font-bold text-lg">Upload Dokumen</DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-2">
          {/* Drag & Drop Area */}
          {!uploading && (
            <div
              onDragEnter={handleDrag}
              onDragOver={handleDrag}
              onDragLeave={handleDrag}
              onDrop={handleDrop}
              onClick={onTriggerClick}
              className={`border-2 border-dashed rounded-xl p-8 text-center cursor-pointer transition-all ${
                dragActive
                  ? "border-indigo-600 bg-indigo-50/50"
                  : "border-gray-300 hover:border-indigo-500 hover:bg-gray-50/50"
              }`}
            >
              <input
                ref={fileInputRef}
                type="file"
                className="hidden"
                accept=".pdf"
                onChange={handleFileChange}
              />
              <UploadCloud className={`mx-auto h-12 w-12 mb-3 transition-colors ${dragActive ? "text-indigo-600" : "text-gray-400"}`} />
              <p className="text-sm font-semibold text-gray-700">
                Drag & drop file PDF Anda disini, atau klik untuk memilih
              </p>
              <p className="text-xs text-gray-500 mt-1">Hanya file PDF (Maks. 10MB)</p>
            </div>
          )}

          {/* Error Message */}
          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 p-3 rounded-lg flex items-start gap-2 text-xs">
              <AlertCircle className="h-4 w-4 shrink-0 text-red-600" />
              <span>{error}</span>
            </div>
          )}

          {/* Selected File Details */}
          {file && !uploading && (
            <div className="flex items-center gap-3 p-3 bg-gray-50 border border-gray-200 rounded-lg">
              <File className="h-8 w-8 text-indigo-500 shrink-0" />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-gray-950 truncate" title={file.name}>
                  {file.name}
                </p>
                <p className="text-xs text-gray-500">
                  {(file.size / (1024 * 1024)).toFixed(2)} MB
                </p>
              </div>
            </div>
          )}

          {/* Upload Progress Area */}
          {uploading && (
            <div className="space-y-3 p-4 bg-indigo-50/30 border border-indigo-100 rounded-xl">
              <div className="flex justify-between items-center text-xs text-indigo-950 font-semibold">
                <span className="flex items-center gap-1.5">
                  <Loader2 className="h-3.5 w-3.5 animate-spin text-indigo-600" />
                  {statusText}
                </span>
                <span>{progress}%</span>
              </div>
              <Progress value={progress} className="h-2 bg-indigo-100" />
            </div>
          )}
        </div>

        <DialogFooter className="gap-2 sm:gap-0">
          {!uploading && (
            <DialogClose asChild>
              <Button type="button" variant="outline" className="border-gray-300">
                Batal
              </Button>
            </DialogClose>
          )}
          {file && !uploading && (
            <Button
              type="button"
              className="bg-indigo-600 hover:bg-indigo-700 text-white font-medium"
              onClick={handleUpload}
            >
              Mulai Unggah
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
