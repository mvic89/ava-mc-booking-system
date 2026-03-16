'use client';

import { useCallback, useRef, useState } from 'react';
import { toast } from 'sonner';
import { createCustomer, type Customer } from '@/lib/customers';
import {
  parseFile,
  applyMapping,
  autoMapHeaders,
  type ImportRow,
  type MappedField,
  type MappableField,
  FIELD_LABELS,
} from '@/lib/import-customers';

// ── Types ──────────────────────────────────────────────────────────────────────

type Step = 'upload' | 'preview' | 'importing' | 'done';

interface Props {
  onClose:   () => void;
  onSuccess: () => void;
}

// ── Constants ──────────────────────────────────────────────────────────────────

const FIELD_OPTIONS: { value: MappedField; label: string }[] = [
  { value: 'skip',         label: '— Hoppa över —' },
  { value: 'firstName',    label: 'Förnamn' },
  { value: 'lastName',     label: 'Efternamn' },
  { value: 'fullName',     label: 'Fullt namn' },
  { value: 'email',        label: 'E-post' },
  { value: 'phone',        label: 'Telefon' },
  { value: 'personnummer', label: 'Personnummer' },
  { value: 'address',      label: 'Adress' },
  { value: 'city',         label: 'Ort' },
  { value: 'birthDate',    label: 'Födelsedag' },
  { value: 'gender',       label: 'Kön' },
];

const ACCEPTED_EXTS = ['.csv', '.txt', '.pdf'];

// ── Helpers ────────────────────────────────────────────────────────────────────

function normalizeGender(g: string): 'Man' | 'Kvinna' {
  const s = g.toLowerCase().trim();
  if (['f', 'female', 'kvinna', 'woman', 'w', 'k'].includes(s)) return 'Kvinna';
  return 'Man';
}

function rowToCustomer(row: ImportRow): Omit<Customer, 'id'> {
  const firstName = row.firstName || row.fullName.split(' ')[0] || '—';
  const lastName  = row.lastName  || row.fullName.split(' ').slice(1).join(' ') || '—';
  return {
    firstName,
    lastName,
    personnummer:     row.personnummer,
    email:            row.email,
    phone:            row.phone,
    address:          [row.address, row.city].filter(Boolean).join(', '),
    birthDate:        row.birthDate,
    gender:           row.gender ? normalizeGender(row.gender) : 'Man',
    source:           'Manual',
    vehicles:         0,
    lifetimeValue:    0,
    lastActivity:     new Date().toISOString(),
    tag:              'New',
    bankidVerified:   false,
    protectedIdentity: false,
  };
}

// ── Main component ─────────────────────────────────────────────────────────────

export default function CustomerImportModal({ onClose, onSuccess }: Props) {
  const [step,       setStep]       = useState<Step>('upload');
  const [isDragging, setIsDragging] = useState(false);
  const [parseError, setParseError] = useState('');
  const [fileName,   setFileName]   = useState('');

  // preview / mapping state
  const [headers,  setHeaders]  = useState<string[]>([]);
  const [rawRows,  setRawRows]  = useState<string[][]>([]);
  const [mapping,  setMapping]  = useState<MappedField[]>([]);

  // import progress state
  const [progress, setProgress] = useState(0);
  const [imported, setImported] = useState(0);
  const [skipped,  setSkipped]  = useState(0);

  const fileInputRef = useRef<HTMLInputElement>(null);

  // ── File handling ──────────────────────────────────────────────────────────

  const handleFile = useCallback(async (file: File) => {
    const ext = file.name.split('.').pop()?.toLowerCase() ?? '';
    if (!ACCEPTED_EXTS.map(e => e.slice(1)).includes(ext)) {
      setParseError('Ogiltigt filformat. Använd CSV, TXT eller PDF.');
      return;
    }
    if (file.size > 10 * 1024 * 1024) {
      setParseError('Filen är för stor (max 10 MB).');
      return;
    }
    setParseError('');
    setFileName(file.name);

    try {
      const result = await parseFile(file);
      if (result.headers.length === 0) {
        setParseError(
          'Inga kolumner hittades. Kontrollera att filen har kolumnrubriker på första raden.'
        );
        return;
      }
      setHeaders(result.headers);
      setRawRows(result.rawRows);
      setMapping(result.mapping);
      setStep('preview');
    } catch (e) {
      setParseError(
        'Fel vid läsning: ' + (e instanceof Error ? e.message : 'okänt fel')
      );
    }
  }, []);

  function handleDrop(e: React.DragEvent) {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files[0];
    if (file) handleFile(file);
  }

  function handleInputChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (file) handleFile(file);
    // Reset so the same file can be re-selected
    e.target.value = '';
  }

  // ── Import ─────────────────────────────────────────────────────────────────

  async function handleImport() {
    setStep('importing');
    setProgress(0);
    setImported(0);
    setSkipped(0);

    const rows  = applyMapping(rawRows, mapping);
    const total = rows.length;
    let   imp   = 0;
    let   skip  = 0;

    for (let i = 0; i < rows.length; i++) {
      try {
        await createCustomer(rowToCustomer(rows[i]));
        imp++;
      } catch {
        skip++;
      }
      setProgress(Math.round(((i + 1) / total) * 100));
      setImported(imp);
      setSkipped(skip);
      // yield to keep UI responsive every 5 rows
      if (i % 5 === 4) await new Promise(r => setTimeout(r, 10));
    }

    setStep('done');
    if (imp > 0) {
      onSuccess();
      toast.success(`${imp} kunder importerade`);
    }
  }

  // ── Derived values ─────────────────────────────────────────────────────────

  const previewRows  = applyMapping(rawRows.slice(0, 5), mapping);
  const totalRows    = applyMapping(rawRows, mapping).length;
  const mappedCount  = mapping.filter(f => f !== 'skip').length;
  const hasMapped    = mappedCount > 0;

  // ── Render helpers ─────────────────────────────────────────────────────────

  const stepTitle: Record<Step, string> = {
    upload:    'Importera kunder',
    preview:   'Granska & mappa kolumner',
    importing: 'Importerar...',
    done:      'Import klar',
  };

  return (
    /* Backdrop */
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4"
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] flex flex-col overflow-hidden">

        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
          <h2 className="text-lg font-bold text-slate-900">{stepTitle[step]}</h2>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-lg flex items-center justify-center text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors"
          >
            ✕
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-6 py-5">

          {/* ── STEP: upload ── */}
          {step === 'upload' && (
            <div className="space-y-5">
              {/* Drop zone */}
              <div
                onDragOver={e => { e.preventDefault(); setIsDragging(true); }}
                onDragLeave={() => setIsDragging(false)}
                onDrop={handleDrop}
                onClick={() => fileInputRef.current?.click()}
                className={`border-2 border-dashed rounded-xl p-10 flex flex-col items-center justify-center cursor-pointer transition-colors ${
                  isDragging
                    ? 'border-[#FF6B2C] bg-orange-50'
                    : 'border-slate-200 hover:border-slate-300 hover:bg-slate-50'
                }`}
              >
                <div className="text-4xl mb-3">📂</div>
                <p className="text-sm font-semibold text-slate-700">
                  Dra filen hit eller{' '}
                  <span className="text-[#FF6B2C] underline">klicka för att välja</span>
                </p>
                <p className="text-xs text-slate-400 mt-1">
                  CSV · TXT · PDF &nbsp;·&nbsp; Max 10 MB
                </p>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept={ACCEPTED_EXTS.join(',')}
                  className="hidden"
                  onChange={handleInputChange}
                />
              </div>

              {parseError && (
                <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-4 py-2.5">
                  {parseError}
                </p>
              )}

              {/* Format tips */}
              <div className="bg-slate-50 border border-slate-100 rounded-xl p-4 text-xs text-slate-500 space-y-1.5">
                <p className="font-semibold text-slate-600 text-sm mb-2">Formattips</p>
                <p>
                  <span className="font-medium text-slate-700">CSV / TXT</span>
                  {' '}— Första raden ska innehålla kolumnrubriker (t.ex. Namn, E-post, Telefon).
                  Avgränsare: komma, semikolon eller tabb.
                </p>
                <p>
                  <span className="font-medium text-slate-700">PDF</span>
                  {' '}— Fungerar bäst med tabellformatterade exportfiler. Scannade PDF:er
                  stöds ej.
                </p>
              </div>
            </div>
          )}

          {/* ── STEP: preview ── */}
          {step === 'preview' && (
            <div className="space-y-5">
              <div className="flex items-center gap-3 text-sm">
                <span className="px-2.5 py-1 bg-slate-100 text-slate-600 rounded-lg font-mono">
                  {fileName}
                </span>
                <span className="text-slate-400">{rawRows.length} rader hittades</span>
              </div>

              {/* Column mapping */}
              <div>
                <p className="text-sm font-semibold text-slate-700 mb-2">Kolumnmappning</p>
                <div className="border border-slate-200 rounded-xl overflow-hidden">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="bg-slate-50 border-b border-slate-200">
                        <th className="text-left px-4 py-2.5 text-xs font-semibold text-slate-500 uppercase tracking-wider w-1/2">
                          Din kolumn
                        </th>
                        <th className="text-left px-4 py-2.5 text-xs font-semibold text-slate-500 uppercase tracking-wider w-1/2">
                          Mappas till
                        </th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {headers.map((header, i) => (
                        <tr key={i} className="hover:bg-slate-50 transition-colors">
                          <td className="px-4 py-2.5 font-medium text-slate-700 capitalize">
                            {header}
                          </td>
                          <td className="px-4 py-2">
                            <select
                              value={mapping[i] ?? 'skip'}
                              onChange={e => {
                                const next = [...mapping];
                                next[i] = e.target.value as MappedField;
                                setMapping(next);
                              }}
                              className={`w-full text-sm px-2 py-1.5 rounded-lg border outline-none transition-colors ${
                                (mapping[i] ?? 'skip') === 'skip'
                                  ? 'border-slate-200 text-slate-400 bg-white'
                                  : 'border-[#FF6B2C]/40 text-slate-800 bg-orange-50'
                              }`}
                            >
                              {FIELD_OPTIONS.map(opt => (
                                <option key={opt.value} value={opt.value}>
                                  {opt.label}
                                </option>
                              ))}
                            </select>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Preview table */}
              {previewRows.length > 0 && (
                <div>
                  <p className="text-sm font-semibold text-slate-700 mb-2">
                    Förhandsgranskning
                    <span className="ml-1.5 text-slate-400 font-normal">
                      (visar {previewRows.length} av {totalRows})
                    </span>
                  </p>
                  <div className="border border-slate-200 rounded-xl overflow-auto">
                    <table className="w-full text-xs">
                      <thead>
                        <tr className="bg-slate-50 border-b border-slate-200">
                          {(Object.keys(previewRows[0]) as MappableField[])
                            .filter(k => previewRows.some(r => r[k]))
                            .map(k => (
                              <th
                                key={k}
                                className="text-left px-3 py-2 text-xs font-semibold text-slate-500 uppercase tracking-wider whitespace-nowrap"
                              >
                                {FIELD_LABELS[k]}
                              </th>
                            ))}
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {previewRows.map((row, ri) => (
                          <tr key={ri} className="hover:bg-slate-50">
                            {(Object.keys(row) as MappableField[])
                              .filter(k => previewRows.some(r => r[k]))
                              .map(k => (
                                <td
                                  key={k}
                                  className="px-3 py-2 text-slate-700 max-w-[160px] truncate"
                                >
                                  {row[k] || '—'}
                                </td>
                              ))}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {!hasMapped && (
                <p className="text-sm text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-4 py-2.5">
                  Mappa minst en kolumn för att fortsätta.
                </p>
              )}
            </div>
          )}

          {/* ── STEP: importing ── */}
          {step === 'importing' && (
            <div className="flex flex-col items-center justify-center py-12 gap-6">
              <div className="w-14 h-14 border-4 border-[#FF6B2C] border-t-transparent rounded-full animate-spin" />
              <div className="w-full max-w-sm space-y-3">
                {/* Progress bar */}
                <div className="w-full bg-slate-100 rounded-full h-2.5 overflow-hidden">
                  <div
                    className="bg-[#FF6B2C] h-2.5 rounded-full transition-all duration-150"
                    style={{ width: `${progress}%` }}
                  />
                </div>
                <div className="flex justify-between text-sm text-slate-500">
                  <span>
                    {imported + skipped} / {totalRows} behandlade
                  </span>
                  <span>{progress}%</span>
                </div>
              </div>
              <p className="text-sm text-slate-500">
                Importerar batch {Math.ceil((imported + skipped) / 5)} av{' '}
                {Math.ceil(totalRows / 5)}…
              </p>
            </div>
          )}

          {/* ── STEP: done ── */}
          {step === 'done' && (
            <div className="flex flex-col items-center justify-center py-12 gap-5">
              <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center text-3xl">
                ✓
              </div>
              <div className="text-center space-y-2">
                <p className="text-lg font-bold text-slate-900">
                  Import slutförd!
                </p>
                <p className="text-sm text-green-700 font-medium">
                  {imported} kunder importerade
                </p>
                {skipped > 0 && (
                  <p className="text-sm text-slate-500">
                    {skipped} hoppades över (redan befintliga eller ogiltiga)
                  </p>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-slate-100 flex items-center justify-between gap-3">
          {step === 'upload' && (
            <>
              <p className="text-xs text-slate-400">
                Accepterade format: CSV, TXT, PDF
              </p>
              <button
                onClick={onClose}
                className="px-4 py-2 text-sm font-medium text-slate-600 hover:text-slate-900 transition-colors"
              >
                Avbryt
              </button>
            </>
          )}

          {step === 'preview' && (
            <>
              <button
                onClick={() => { setStep('upload'); setParseError(''); }}
                className="px-4 py-2 text-sm font-medium text-slate-600 hover:text-slate-900 transition-colors"
              >
                ← Tillbaka
              </button>
              <button
                onClick={handleImport}
                disabled={!hasMapped || totalRows === 0}
                className="flex items-center gap-2 bg-[#FF6B2C] hover:bg-[#e55e22] disabled:opacity-40 disabled:cursor-not-allowed text-white text-sm font-semibold px-5 py-2.5 rounded-xl transition-colors"
              >
                Importera {totalRows} kund{totalRows !== 1 ? 'er' : ''} →
              </button>
            </>
          )}

          {step === 'importing' && (
            <p className="text-xs text-slate-400">
              Avbryt inte — stäng inte fönstret under pågående import.
            </p>
          )}

          {step === 'done' && (
            <div className="flex-1 flex justify-end">
              <button
                onClick={onClose}
                className="px-5 py-2.5 bg-[#235971] hover:bg-[#1a4557] text-white text-sm font-semibold rounded-xl transition-colors"
              >
                Stäng
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
