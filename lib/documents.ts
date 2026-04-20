import { getDealershipId } from './tenant';

export type DocCategory = 'agreement' | 'insurance' | 'registration' | 'invoice' | 'other';

export interface Document {
  id:           string;
  dealershipId: string;
  leadId:       number | null;
  customerId:   number | null;
  name:         string;
  filePath:     string;
  fileSize:     number;
  mimeType:     string;
  category:     DocCategory;
  uploadedBy:   string;
  createdAt:    string;
  url?:         string;  // signed download URL (added client-side)
}

// ─── Upload ───────────────────────────────────────────────────────────────────

export interface UploadDocumentOptions {
  file:       File;
  name?:      string;           // display name — defaults to file.name
  category:   DocCategory;
  leadId?:    number | null;
  customerId?: number | null;
}

export async function uploadDocument(opts: UploadDocumentOptions): Promise<Document> {
  const dealershipId = getDealershipId() ?? '';
  const form = new FormData();
  form.append('file',     opts.file);
  form.append('name',     opts.name ?? opts.file.name);
  form.append('category', opts.category);
  if (opts.leadId)     form.append('leadId',     String(opts.leadId));
  if (opts.customerId) form.append('customerId', String(opts.customerId));

  const res = await fetch('/api/documents/upload', {
    method: 'POST',
    headers: { 'x-dealership-id': dealershipId },
    body: form,
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error ?? 'Upload failed');
  }
  return res.json();
}

// ─── List ────────────────────────────────────────────────────────────────────

export async function getDocuments(opts: {
  leadId?:    number;
  customerId?: number;
} = {}): Promise<Document[]> {
  const params = new URLSearchParams();
  if (opts.leadId)     params.set('leadId',     String(opts.leadId));
  if (opts.customerId) params.set('customerId', String(opts.customerId));

  const dealershipId = getDealershipId() ?? '';
  const res = await fetch(`/api/documents?${params}`, {
    headers: { 'x-dealership-id': dealershipId },
  });
  if (!res.ok) return [];
  return res.json();
}

// ─── Delete ───────────────────────────────────────────────────────────────────

export async function deleteDocument(id: string): Promise<void> {
  const dealershipId = getDealershipId() ?? '';
  const res = await fetch(`/api/documents?id=${id}`, {
    method: 'DELETE',
    headers: { 'x-dealership-id': dealershipId },
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error ?? 'Delete failed');
  }
}

// ─── Category meta ────────────────────────────────────────────────────────────

export const CATEGORY_META: Record<DocCategory, { label: string; icon: string; color: string }> = {
  agreement:    { label: 'Köpeavtal',           icon: '📋', color: 'text-[#235971]' },
  insurance:    { label: 'Försäkring',          icon: '🛡️', color: 'text-emerald-700' },
  registration: { label: 'Registreringsbevis',  icon: '🚗', color: 'text-violet-700' },
  invoice:      { label: 'Faktura',             icon: '🧾', color: 'text-amber-700' },
  other:        { label: 'Övrigt',              icon: '📄', color: 'text-slate-500' },
};

export function fmtFileSize(bytes: number): string {
  if (bytes < 1024)        return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
