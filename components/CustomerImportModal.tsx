'use client';

import { useCallback, useRef, useState } from 'react';
import { toast } from 'sonner';
import { createCustomer } from '@/lib/customers';
import {
  parseFile,
  applyMapping,
  rowToCustomer,
  type MappedField,
  FIELD_LABELS,
  FIELD_GROUPS,
} from '@/lib/import-customers';

// ── Types ──────────────────────────────────────────────────────────────────────

type Step = 'upload' | 'mapping' | 'importing' | 'done';

interface Props {
  onClose:   () => void;
  onSuccess: () => void;
}

// ── Column colour coding ──────────────────────────────────────────────────────

function colourForField(f: MappedField) {
  if (f === 'skip') return { dot: 'bg-slate-300',  header: 'bg-slate-50  text-slate-400', badge: 'bg-slate-100  text-slate-400' };
  if (f === 'note') return { dot: 'bg-blue-400',   header: 'bg-blue-50   text-blue-700',  badge: 'bg-blue-100   text-blue-700'  };
  return                   { dot: 'bg-orange-400', header: 'bg-orange-50 text-orange-700',badge: 'bg-orange-100 text-orange-700'};
}

// ── Mapping dropdown component ────────────────────────────────────────────────

function FieldSelect({ value, onChange }: { value: MappedField; onChange: (f: MappedField) => void }) {
  return (
    <select
      value={value}
      onChange={e => onChange(e.target.value as MappedField)}
      className={`w-full text-xs px-1.5 py-1 rounded-md border outline-none transition-colors ${
        value === 'skip'
          ? 'border-slate-200 text-slate-400 bg-white'
          : value === 'note'
          ? 'border-blue-200 text-blue-700 bg-blue-50'
          : 'border-orange-200 text-orange-700 bg-orange-50'
      }`}
    >
      {FIELD_GROUPS.map(group => (
        <optgroup key={group.label} label={group.label}>
          {group.fields.map(field => (
            <option key={field} value={field}>{FIELD_LABELS[field]}</option>
          ))}
        </optgroup>
      ))}
    </select>
  );
}

// ── Main component ─────────────────────────────────────────────────────────────

export default function CustomerImportModal({ onClose, onSuccess }: Props) {
  const [step,       setStep]       = useState<Step>('upload');
  const [isDragging, setIsDragging] = useState(false);
  const [parseError, setParseError] = useState('');
  const [fileName,   setFileName]   = useState('');

  // Data state (set after parse)
  const [headers,  setHeaders]  = useState<string[]>([]);
  const [rawRows,  setRawRows]  = useState<string[][]>([]);
  const [mapping,  setMapping]  = useState<MappedField[]>([]);

  // Preview expansion
  const [showAllRows, setShowAllRows] = useState(false);

  // Import progress
  const [progress,  setProgress]  = useState(0);
  const [imported,  setImported]  = useState(0);
  const [skipped,   setSkipped]   = useState(0);
  const [failed,    setFailed]    = useState(0);

  const fileInputRef = useRef<HTMLInputElement>(null);

  // ── File handling ────────────────────────────────────────────────────────────

  const handleFile = useCallback(async (file: File) => {
    const ext = (file.name.split('.').pop() ?? '').toLowerCase();
    if (!['csv', 'txt', 'pdf'].includes(ext)) {
      setParseError('Ogiltigt filformat. Stödda format: CSV, TXT, PDF.');
      return;
    }
    if (file.size > 15 * 1024 * 1024) {
      setParseError('Filen är för stor (max 15 MB).');
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
      setShowAllRows(false);
      setStep('mapping');
    } catch (e) {
      setParseError('Läsfel: ' + (e instanceof Error ? e.message : 'okänt fel'));
    }
  }, []);

  function handleDrop(e: React.DragEvent) {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files[0];
    if (file) handleFile(file);
  }

  // ── Import ────────────────────────────────────────────────────────────────────

  async function handleImport() {
    setStep('importing');
    setProgress(0); setImported(0); setSkipped(0); setFailed(0);

    const rows  = applyMapping(rawRows, headers, mapping);
    const total = rows.length;
    let   imp = 0, skip = 0, fail = 0;

    for (let i = 0; i < rows.length; i++) {
      try {
        await createCustomer(rowToCustomer(rows[i]));
        imp++;
      } catch (e: unknown) {
        const msg = e instanceof Error ? e.message : '';
        // Unique constraint = duplicate, all others = failure
        if (msg.toLowerCase().includes('unique') || msg.includes('duplicate')) skip++;
        else fail++;
      }

      setProgress(Math.round(((i + 1) / total) * 100));
      setImported(imp); setSkipped(skip); setFailed(fail);
      if (i % 5 === 4) await new Promise(r => setTimeout(r, 10));
    }

    setStep('done');
    if (imp > 0) {
      onSuccess();
      toast.success(`${imp} kunder importerade`);
    }
  }

  // ── Derived values ────────────────────────────────────────────────────────────

  const validRows    = applyMapping(rawRows, headers, mapping);
  const totalValid   = validRows.length;
  const mappedCount  = mapping.filter(f => f !== 'skip').length;
  const noteCount    = mapping.filter(f => f === 'note').length;

  // ── Step labels ───────────────────────────────────────────────────────────────

  const STEP_TITLES: Record<Step, string> = {
    upload:    'Importera kunder',
    mapping:   'Mappning & förhandsgranskning',
    importing: 'Importerar...',
    done:      'Import klar',
  };

  // ─────────────────────────────────────────────────────────────────────────────

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4"
      onClick={e => { if (e.target === e.currentTarget && step !== 'importing') onClose(); }}
    >
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-4xl max-h-[92vh] flex flex-col overflow-hidden">

        {/* ── Header ── */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 shrink-0">
          <div className="flex items-center gap-3">
            <h2 className="text-lg font-bold text-slate-900">{STEP_TITLES[step]}</h2>
            {step === 'mapping' && fileName && (
              <span className="text-xs text-slate-400 bg-slate-100 px-2 py-0.5 rounded-md font-mono truncate max-w-[260px]">
                {fileName}
              </span>
            )}
          </div>
          {step !== 'importing' && (
            <button
              onClick={onClose}
              className="w-8 h-8 rounded-lg flex items-center justify-center text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors"
            >
              ✕
            </button>
          )}
        </div>

        {/* ── Body ── */}
        <div className="flex-1 overflow-y-auto">

          {/* ──────────── STEP: upload ──────────── */}
          {step === 'upload' && (
            <div className="px-6 py-6 space-y-5">
              <div
                onDragOver={e => { e.preventDefault(); setIsDragging(true); }}
                onDragLeave={() => setIsDragging(false)}
                onDrop={handleDrop}
                onClick={() => fileInputRef.current?.click()}
                className={`border-2 border-dashed rounded-2xl p-12 flex flex-col items-center justify-center cursor-pointer transition-all ${
                  isDragging
                    ? 'border-[#FF6B2C] bg-orange-50 scale-[1.01]'
                    : 'border-slate-200 hover:border-slate-300 hover:bg-slate-50'
                }`}
              >
                <div className="text-5xl mb-4">📂</div>
                <p className="text-base font-semibold text-slate-700">
                  Dra filen hit eller{' '}
                  <span className="text-[#FF6B2C] underline">klicka för att välja</span>
                </p>
                <p className="text-sm text-slate-400 mt-1.5">
                  CSV · TXT · PDF &nbsp;·&nbsp; Max 15 MB
                </p>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".csv,.txt,.pdf"
                  className="hidden"
                  onChange={e => {
                    const f = e.target.files?.[0];
                    if (f) handleFile(f);
                    e.target.value = '';
                  }}
                />
              </div>

              {parseError && (
                <div className="flex items-start gap-2 text-sm text-red-700 bg-red-50 border border-red-200 rounded-xl px-4 py-3">
                  <span className="text-base">⚠</span>
                  {parseError}
                </div>
              )}

              <div className="grid grid-cols-3 gap-3 text-xs">
                {[
                  { icon: '📊', title: 'CSV / TXT', body: 'Kolumnrubriker på rad 1. Avgränsare: komma, semikolon eller tabb. Okända kolumner sparas automatiskt som noteringar.' },
                  { icon: '📄', title: 'PDF', body: 'Tabellformatterade exportfiler rekommenderas. Kolumner rekonstrueras från sidans layout. Scannade PDF:er stöds ej.' },
                  { icon: '🔄', title: 'Dubbletter', body: 'Kunder med samma personnummer eller e-post hoppas automatiskt över för att undvika dubbletter.' },
                ].map(tip => (
                  <div key={tip.title} className="bg-slate-50 rounded-xl p-3 border border-slate-100">
                    <p className="text-lg mb-1">{tip.icon}</p>
                    <p className="font-semibold text-slate-700 mb-1">{tip.title}</p>
                    <p className="text-slate-500 leading-relaxed">{tip.body}</p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* ──────────── STEP: mapping ──────────── */}
          {step === 'mapping' && (
            <div className="flex flex-col divide-y divide-slate-100">

              {/* Stats bar */}
              <div className="px-6 py-3 bg-slate-50 flex flex-wrap items-center gap-x-6 gap-y-1 text-xs text-slate-500 shrink-0">
                <span>
                  <span className="font-semibold text-slate-800">{rawRows.length}</span> rader i filen
                </span>
                <span>
                  <span className="font-semibold text-green-700">{totalValid}</span> giltiga rader
                </span>
                <span>
                  <span className="font-semibold text-orange-600">{mappedCount - noteCount}</span> standard­kolumner mappade
                </span>
                {noteCount > 0 && (
                  <span>
                    <span className="font-semibold text-blue-600">{noteCount}</span> kolumn{noteCount !== 1 ? 'er' : ''} sparas som noteringar
                  </span>
                )}
              </div>

              {/* Colour legend */}
              <div className="px-6 py-2.5 flex items-center gap-5 text-xs text-slate-500 shrink-0">
                {[
                  { col: 'bg-orange-400', label: 'Mappad till kundfält' },
                  { col: 'bg-blue-400',   label: 'Sparas som notering' },
                  { col: 'bg-slate-300',  label: 'Hoppas över' },
                ].map(l => (
                  <span key={l.label} className="flex items-center gap-1.5">
                    <span className={`w-2.5 h-2.5 rounded-full ${l.col}`} />
                    {l.label}
                  </span>
                ))}
              </div>

              {/* ── Spreadsheet-style table: header = mapping dropdown, rows = data ── */}
              <div className="overflow-auto">
                <table className="text-xs w-max min-w-full border-collapse">

                  {/* Column mapping row (sticky top) */}
                  <thead>
                    <tr>
                      {/* Row-number gutter */}
                      <th className="sticky top-0 bg-slate-50 border-b border-r border-slate-200 px-3 py-2 text-slate-400 font-normal w-10 text-right z-10">
                        #
                      </th>

                      {headers.map((header, i) => {
                        const f  = mapping[i] ?? 'note';
                        const cl = colourForField(f);
                        return (
                          <th
                            key={i}
                            className={`sticky top-0 z-10 border-b border-r border-slate-200 px-2 py-2 min-w-[140px] max-w-[200px] font-normal ${cl.header}`}
                          >
                            {/* Original header name + colour indicator */}
                            <div className="flex items-center gap-1.5 mb-1.5">
                              <span className={`w-2 h-2 rounded-full shrink-0 ${cl.dot}`} />
                              <span className="font-semibold truncate capitalize">{header}</span>
                            </div>
                            {/* Mapping dropdown */}
                            <FieldSelect
                              value={f}
                              onChange={newField => {
                                const next = [...mapping];
                                next[i] = newField;
                                setMapping(next);
                              }}
                            />
                          </th>
                        );
                      })}
                    </tr>
                  </thead>

                  {/* Data rows */}
                  <tbody>
                    {(showAllRows ? rawRows : rawRows.slice(0, 8)).map((row, ri) => (
                      <tr
                        key={ri}
                        className={ri % 2 === 0 ? 'bg-white' : 'bg-slate-50/50'}
                      >
                        <td className="border-r border-slate-100 px-3 py-1.5 text-slate-300 text-right select-none">
                          {ri + 2}
                        </td>
                        {headers.map((_, i) => {
                          const f   = mapping[i] ?? 'note';
                          const val = (row[i] ?? '').trim();
                          return (
                            <td
                              key={i}
                              className={`border-r border-slate-100 px-2.5 py-1.5 max-w-[200px] truncate ${
                                f === 'skip'
                                  ? 'text-slate-300 line-through'
                                  : f === 'note'
                                  ? 'text-blue-700'
                                  : 'text-slate-700'
                              }`}
                              title={val}
                            >
                              {val || <span className="text-slate-300">—</span>}
                            </td>
                          );
                        })}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Show more / less toggle */}
              {rawRows.length > 8 && (
                <div className="px-6 py-2.5 text-center">
                  <button
                    onClick={() => setShowAllRows(p => !p)}
                    className="text-xs text-[#FF6B2C] hover:underline"
                  >
                    {showAllRows
                      ? `▲ Visa färre rader`
                      : `▼ Visa alla ${rawRows.length} rader`}
                  </button>
                </div>
              )}
            </div>
          )}

          {/* ──────────── STEP: importing ──────────── */}
          {step === 'importing' && (
            <div className="px-6 py-12 flex flex-col items-center gap-6">
              <div className="w-14 h-14 border-4 border-[#FF6B2C] border-t-transparent rounded-full animate-spin" />
              <div className="w-full max-w-md space-y-3">
                <div className="w-full bg-slate-100 rounded-full h-3 overflow-hidden">
                  <div
                    className="bg-[#FF6B2C] h-3 rounded-full transition-all duration-150"
                    style={{ width: `${progress}%` }}
                  />
                </div>
                <div className="flex justify-between text-sm text-slate-500">
                  <span>{imported + skipped + failed} / {totalValid} behandlade</span>
                  <span className="font-medium">{progress}%</span>
                </div>
              </div>
              <div className="flex gap-6 text-sm">
                <span className="text-green-700 font-semibold">{imported} importerade</span>
                {skipped  > 0 && <span className="text-slate-400">{skipped} dubbletter</span>}
                {failed   > 0 && <span className="text-red-500">{failed} misslyckades</span>}
              </div>
              <p className="text-xs text-slate-400">Stäng inte fönstret under pågående import.</p>
            </div>
          )}

          {/* ──────────── STEP: done ──────────── */}
          {step === 'done' && (
            <div className="px-6 py-12 flex flex-col items-center gap-5">
              <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center text-4xl">
                ✓
              </div>
              <div className="text-center space-y-2">
                <p className="text-xl font-bold text-slate-900">Import slutförd</p>
                <div className="flex justify-center gap-4 text-sm">
                  <span className="text-green-700 font-semibold bg-green-50 px-3 py-1 rounded-full">
                    {imported} importerade
                  </span>
                  {skipped > 0 && (
                    <span className="text-slate-500 bg-slate-100 px-3 py-1 rounded-full">
                      {skipped} dubbletter (hoppades över)
                    </span>
                  )}
                  {failed > 0 && (
                    <span className="text-red-600 bg-red-50 px-3 py-1 rounded-full">
                      {failed} misslyckades
                    </span>
                  )}
                </div>
                {noteCount > 0 && (
                  <p className="text-xs text-blue-600 mt-1">
                    Extra kolumner ({noteCount} st) sparades som noteringar på respektive kund.
                  </p>
                )}
              </div>
            </div>
          )}
        </div>

        {/* ── Footer ── */}
        <div className="px-6 py-4 border-t border-slate-100 flex items-center justify-between gap-3 shrink-0">

          {step === 'upload' && (
            <>
              <p className="text-xs text-slate-400">Accepterade format: CSV · TXT · PDF</p>
              <button
                onClick={onClose}
                className="px-4 py-2 text-sm font-medium text-slate-600 hover:text-slate-800 transition-colors"
              >
                Avbryt
              </button>
            </>
          )}

          {step === 'mapping' && (
            <>
              <button
                onClick={() => { setStep('upload'); setParseError(''); }}
                className="flex items-center gap-1 text-sm font-medium text-slate-500 hover:text-slate-800 transition-colors"
              >
                ← Välj annan fil
              </button>

              <div className="flex items-center gap-3">
                {/* Summary pills */}
                <div className="flex items-center gap-2 text-xs">
                  <span className="bg-green-50 text-green-700 font-semibold px-2.5 py-1 rounded-full">
                    {totalValid} kunder
                  </span>
                  {noteCount > 0 && (
                    <span className="bg-blue-50 text-blue-700 px-2.5 py-1 rounded-full">
                      +{noteCount} extra kolumn{noteCount !== 1 ? 'er' : ''} som noteringar
                    </span>
                  )}
                </div>

                <button
                  onClick={handleImport}
                  disabled={totalValid === 0 || mappedCount === 0}
                  className="flex items-center gap-2 bg-[#FF6B2C] hover:bg-[#e55e22] disabled:opacity-40 disabled:cursor-not-allowed text-white text-sm font-bold px-6 py-2.5 rounded-xl transition-colors shadow-sm"
                >
                  Importera {totalValid} kund{totalValid !== 1 ? 'er' : ''} →
                </button>
              </div>
            </>
          )}

          {step === 'importing' && (
            <p className="text-xs text-slate-400 mx-auto">Importerar — vänta...</p>
          )}

          {step === 'done' && (
            <div className="flex-1 flex justify-end">
              <button
                onClick={onClose}
                className="px-6 py-2.5 bg-[#235971] hover:bg-[#1a4557] text-white text-sm font-bold rounded-xl transition-colors"
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
