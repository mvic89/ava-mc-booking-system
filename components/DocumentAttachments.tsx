'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { toast } from 'sonner';
import { getDealershipId } from '@/lib/tenant';
import {
  getDocuments, uploadDocument, deleteDocument,
  CATEGORY_META, fmtFileSize,
  type Document, type DocCategory,
} from '@/lib/documents';

// ─── Props ───────────────────────────────────────────────────────────────────

interface Props {
  leadId?:     number;
  customerId?: number;
  uploaderName?: string;
}

// ─── Component ───────────────────────────────────────────────────────────────

export default function DocumentAttachments({ leadId, customerId, uploaderName = '' }: Props) {
  const [docs,        setDocs]        = useState<Document[]>([]);
  const [loading,     setLoading]     = useState(true);
  const [uploading,   setUploading]   = useState(false);
  const [category,    setCategory]    = useState<DocCategory>('other');
  const [dragOver,    setDragOver]    = useState(false);
  const [deleting,    setDeleting]    = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const dealershipId = getDealershipId() ?? '';

  const load = useCallback(async () => {
    setLoading(true);
    const data = await getDocuments({ leadId, customerId });
    setDocs(data);
    setLoading(false);
  }, [leadId, customerId]);

  useEffect(() => { load(); }, [load]);

  // ── Upload handler ──────────────────────────────────────────────────────────

  async function handleFiles(files: FileList | File[]) {
    const fileArr = Array.from(files);
    if (fileArr.length === 0) return;
    setUploading(true);
    let ok = 0;
    for (const file of fileArr) {
      try {
        await uploadDocument({ file, category, leadId, customerId });
        ok++;
      } catch (err: any) {
        toast.error(`${file.name}: ${err.message}`);
      }
    }
    if (ok > 0) {
      toast.success(`${ok} fil${ok > 1 ? 'er' : ''} uppladdad${ok > 1 ? 'e' : ''}`);
      await load();
    }
    setUploading(false);
    if (fileRef.current) fileRef.current.value = '';
  }

  // ── Delete handler ──────────────────────────────────────────────────────────

  async function handleDelete(doc: Document) {
    if (!confirm(`Ta bort "${doc.name}"?`)) return;
    setDeleting(doc.id);
    try {
      await deleteDocument(doc.id);
      toast.success('Dokument borttaget');
      setDocs(d => d.filter(x => x.id !== doc.id));
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setDeleting(null);
    }
  }

  // ── Drag + drop ─────────────────────────────────────────────────────────────

  function onDrop(e: React.DragEvent) {
    e.preventDefault();
    setDragOver(false);
    if (e.dataTransfer.files.length > 0) handleFiles(e.dataTransfer.files);
  }

  // ── Date helper ─────────────────────────────────────────────────────────────

  function fmtDate(iso: string) {
    return new Date(iso).toLocaleDateString('sv-SE', { day: 'numeric', month: 'short', year: 'numeric' });
  }

  // ─────────────────────────────────────────────────────────────────────────────

  return (
    <div className="bg-white rounded-2xl border border-slate-100 p-5">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <span className="text-lg">📎</span>
          <h3 className="text-sm font-bold text-slate-800">Bifogade dokument</h3>
          {!loading && <span className="text-xs bg-slate-100 text-slate-500 px-2 py-0.5 rounded-full font-bold">{docs.length}</span>}
        </div>
      </div>

      {/* Upload zone */}
      <div
        onDragOver={e => { e.preventDefault(); setDragOver(true); }}
        onDragLeave={() => setDragOver(false)}
        onDrop={onDrop}
        className={`rounded-xl border-2 border-dashed p-4 mb-4 transition-colors ${
          dragOver ? 'border-[#FF6B2C] bg-[#FF6B2C]/5' : 'border-slate-200 bg-slate-50'
        }`}
      >
        <div className="flex flex-wrap items-center gap-3">
          {/* Category picker */}
          <select
            value={category}
            onChange={e => setCategory(e.target.value as DocCategory)}
            className="text-xs border border-slate-200 rounded-lg px-2 py-1.5 bg-white outline-none focus:border-[#FF6B2C] transition-colors"
          >
            {Object.entries(CATEGORY_META).map(([k, v]) => (
              <option key={k} value={k}>{v.icon} {v.label}</option>
            ))}
          </select>

          {/* Upload button */}
          <button
            onClick={() => fileRef.current?.click()}
            disabled={uploading}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#0b1524] hover:bg-[#1a2a42] text-white text-xs font-semibold transition-colors disabled:opacity-50"
          >
            {uploading ? (
              <>
                <div className="w-3 h-3 border-2 border-white border-t-transparent rounded-full animate-spin" />
                Laddar upp…
              </>
            ) : (
              <>
                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
                </svg>
                Välj fil
              </>
            )}
          </button>

          <span className="text-xs text-slate-400">eller dra hit · PDF, bilder, Word · max 20 MB</span>
        </div>

        <input
          ref={fileRef}
          type="file"
          multiple
          accept=".pdf,.jpg,.jpeg,.png,.webp,.heic,.doc,.docx"
          className="hidden"
          onChange={e => e.target.files && handleFiles(e.target.files)}
        />
      </div>

      {/* Document list */}
      {loading ? (
        <div className="space-y-2">
          {[1, 2].map(n => (
            <div key={n} className="h-12 bg-slate-100 rounded-xl animate-pulse" />
          ))}
        </div>
      ) : docs.length === 0 ? (
        <p className="text-xs text-slate-400 text-center py-4">Inga bifogade dokument ännu</p>
      ) : (
        <div className="space-y-2">
          {docs.map(doc => {
            const meta = CATEGORY_META[doc.category] ?? CATEGORY_META.other;
            return (
              <div key={doc.id} className="flex items-center gap-3 p-3 rounded-xl border border-slate-100 bg-slate-50 group">
                {/* Icon */}
                <span className="text-xl shrink-0">{meta.icon}</span>

                {/* Info */}
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-slate-800 truncate">{doc.name}</p>
                  <p className="text-xs text-slate-400">
                    <span className={`font-medium ${meta.color}`}>{meta.label}</span>
                    <span className="mx-1">·</span>
                    {fmtFileSize(doc.fileSize)}
                    <span className="mx-1">·</span>
                    {fmtDate(doc.createdAt)}
                    {doc.uploadedBy && (
                      <><span className="mx-1">·</span>{doc.uploadedBy}</>
                    )}
                  </p>
                </div>

                {/* Actions */}
                <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
                  {doc.url && (
                    <a
                      href={doc.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      title="Öppna"
                      className="w-7 h-7 rounded-lg flex items-center justify-center hover:bg-slate-200 text-slate-500 transition-colors"
                    >
                      <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                      </svg>
                    </a>
                  )}
                  <button
                    onClick={() => handleDelete(doc)}
                    disabled={deleting === doc.id}
                    title="Ta bort"
                    className="w-7 h-7 rounded-lg flex items-center justify-center hover:bg-red-100 text-slate-400 hover:text-red-600 transition-colors disabled:opacity-50"
                  >
                    {deleting === doc.id ? (
                      <div className="w-3 h-3 border-2 border-red-400 border-t-transparent rounded-full animate-spin" />
                    ) : (
                      <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                      </svg>
                    )}
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
