import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import {
    ArrowLeft, Download, Upload, FileSpreadsheet, CheckCircle2, AlertTriangle,
    XCircle, Loader2, Info, RefreshCw, ShieldAlert, ListChecks,
} from 'lucide-react';
import { supabase } from '../../supabaseClient';
import { useAuth } from '../../context/AuthContext';
import { parseCsv, toCsv, downloadTextFile } from '../../utils/csv';
import {
    CSV_COLUMNS, REQUIRED_COLUMNS, LIMITS, validateRows, buildTemplateCsv,
} from '../../utils/productBulkImport';

const STEPS = [
    { n: 1, label: 'Download Template' },
    { n: 2, label: 'Upload CSV' },
    { n: 3, label: 'Validate' },
    { n: 4, label: 'Review' },
    { n: 5, label: 'Import' },
];

const ACTION_BADGE = {
    create: 'bg-emerald-50 text-emerald-700 border-emerald-200',
    update: 'bg-amber-50 text-amber-700 border-amber-200',
    error: 'bg-red-50 text-red-700 border-red-200',
};

const Card = ({ children, className = '' }) => (
    <div className={`bg-white rounded-3xl border border-slate-100 shadow-soft ${className}`}>{children}</div>
);

const BulkImportProducts = () => {
    const navigate = useNavigate();
    const { user } = useAuth();
    const role = user?.role || localStorage.getItem('role');

    const fileInputRef = useRef(null);
    const [catalog, setCatalog] = useState({ categories: [], products: [], loading: true });

    const [file, setFile] = useState(null);
    const [fileError, setFileError] = useState(null);
    const [validation, setValidation] = useState(null); // output of validateRows
    const [phase, setPhase] = useState('upload');       // upload | validating | validated | importing | done
    const [importResult, setImportResult] = useState(null);
    const [importError, setImportError] = useState(null);

    // --- load the live catalogue once (needed for template + validation) ---
    const loadCatalog = useCallback(async () => {
        setCatalog((c) => ({ ...c, loading: true }));
        try {
            const [{ data: cats, error: cErr }, { data: prods, error: pErr }] = await Promise.all([
                supabase.from('categories').select('id, name, is_active').order('name'),
                supabase.from('products').select('id, name, model_number, description, image_url, specifications, category_id, is_active'),
            ]);
            if (cErr) throw cErr;
            if (pErr) throw pErr;
            setCatalog({ categories: cats || [], products: prods || [], loading: false });
        } catch (err) {
            console.error('[BulkImport] catalog load failed:', err);
            toast.error('Could not load categories/products');
            setCatalog({ categories: [], products: [], loading: false });
        }
    }, []);

    useEffect(() => { loadCatalog(); }, [loadCatalog]);

    const currentStep = useMemo(() => {
        if (phase === 'done' || phase === 'importing') return 5;
        if (phase === 'validated') return 4;
        if (phase === 'validating') return 3;
        if (file) return 3;
        return 2;
    }, [phase, file]);

    if (role !== 'admin') {
        return (
            <Card className="p-12 text-center">
                <ShieldAlert size={44} className="mx-auto text-red-300 mb-4" />
                <h3 className="text-lg font-bold text-slate-900">Admins only</h3>
                <p className="text-slate-400 text-sm mt-1">Bulk product import is restricted to administrator accounts.</p>
            </Card>
        );
    }

    // --- template download ---
    const handleDownloadTemplate = () => {
        const withModel = catalog.products.filter((p) => p.model_number);
        const sample = (withModel[0] ? [withModel[0]] : catalog.products.slice(0, 1));
        const text = buildTemplateCsv(toCsv, catalog.categories, sample);
        downloadTextFile('product-import-template.csv', text);
        toast.success('Template downloaded');
    };

    // --- file selection ---
    const resetAfterFile = () => {
        setValidation(null);
        setImportResult(null);
        setImportError(null);
        setPhase('upload');
    };

    const handleFile = (f) => {
        setFileError(null);
        resetAfterFile();
        if (!f) { setFile(null); return; }

        const nameOk = /\.csv$/i.test(f.name) || f.type === 'text/csv' || f.type === 'application/vnd.ms-excel';
        if (!nameOk) {
            setFile(null);
            setFileError('Please choose a .csv file. Export your spreadsheet as CSV first.');
            return;
        }
        if (f.size > LIMITS.maxBytes) {
            setFile(null);
            setFileError(`File is ${(f.size / 1024 / 1024).toFixed(2)} MB — the limit is ${(LIMITS.maxBytes / 1024 / 1024)} MB.`);
            return;
        }
        setFile(f);
    };

    // --- validate ---
    const handleValidate = async () => {
        if (!file) return;
        setPhase('validating');
        setValidation(null);
        try {
            const text = await file.text();
            const { headers, rows } = parseCsv(text);

            if (!headers.length) {
                setValidation({ fatal: 'The file is empty or is not valid CSV.' });
                setPhase('validated');
                return;
            }
            if (rows.length === 0) {
                setValidation({ fatal: 'The file has a header row but no product rows.' });
                setPhase('validated');
                return;
            }
            if (rows.length > LIMITS.maxRows) {
                setValidation({ fatal: `The file has ${rows.length} rows — the limit is ${LIMITS.maxRows}. Split it into smaller files.` });
                setPhase('validated');
                return;
            }

            const result = validateRows(rows, headers, catalog.categories, catalog.products);
            setValidation(result);
            setPhase('validated');

            if (result.headerErrors.length) {
                toast.error('The CSV is missing required columns');
            } else if (result.summary.error) {
                toast.error(`${result.summary.error} row(s) need fixing`);
            } else {
                toast.success('Validation passed — review and import');
            }
        } catch (err) {
            console.error('[BulkImport] validate failed:', err);
            setValidation({ fatal: err?.message || 'Could not read the file.' });
            setPhase('validated');
        }
    };

    // --- import ---
    const canImport = phase === 'validated'
        && validation
        && !validation.fatal
        && !validation.headerErrors?.length
        && validation.summary.error === 0
        && (validation.summary.create + validation.summary.update) > 0;

    const handleImport = async () => {
        if (!canImport) return;
        const items = validation.items.filter((i) => i.payload).map((i) => i.payload);
        setPhase('importing');
        setImportError(null);
        try {
            const { data, error } = await supabase.rpc('bulk_import_products', { p_items: items });
            if (error) throw error;
            setImportResult(data || { created: 0, updated: 0, processed: 0 });
            setPhase('done');
            toast.success('Import complete');
            loadCatalog();
        } catch (err) {
            console.error('[BulkImport] import failed:', err);
            setImportError(err?.message || 'Import failed. No changes were made.');
            setPhase('validated'); // back to review so they can retry
            toast.error('Import failed — nothing was changed');
        }
    };

    const startOver = () => {
        setFile(null);
        if (fileInputRef.current) fileInputRef.current.value = '';
        resetAfterFile();
    };

    const previewItems = validation?.items || [];
    const shownItems = previewItems.slice(0, 250);

    return (
        <div className="space-y-6">
            <Link
                to="/admin/products"
                className="inline-flex items-center gap-2 text-slate-400 hover:text-slate-900 font-bold text-xs uppercase tracking-widest transition-colors"
            >
                <ArrowLeft size={16} /> Back to Categories
            </Link>

            <div>
                <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-1">Admin · Catalog</p>
                <h1 className="text-2xl font-display font-bold text-slate-900">Bulk Import (CSV)</h1>
                <p className="text-slate-500 text-sm mt-0.5 max-w-2xl">
                    Download the CSV template, add or update products, upload the completed file, validate it,
                    review the preview, and then import. Nothing is written to the database until validation
                    passes and you confirm.
                </p>
            </div>

            {/* Step indicator */}
            <div className="flex items-center gap-2 overflow-x-auto pb-1">
                {STEPS.map((s, idx) => (
                    <React.Fragment key={s.n}>
                        <div className={`flex items-center gap-2 shrink-0 ${currentStep >= s.n ? 'text-slate-900' : 'text-slate-300'}`}>
                            <span className={`w-6 h-6 rounded-full text-[11px] font-black flex items-center justify-center border ${
                                currentStep > s.n ? 'bg-emerald-500 border-emerald-500 text-white'
                                    : currentStep === s.n ? 'bg-slate-900 border-slate-900 text-white'
                                        : 'border-slate-200 text-slate-300'
                            }`}>
                                {currentStep > s.n ? '✓' : s.n}
                            </span>
                            <span className="text-xs font-bold uppercase tracking-widest">{s.label}</span>
                        </div>
                        {idx < STEPS.length - 1 && <div className="w-6 h-px bg-slate-200 shrink-0" />}
                    </React.Fragment>
                ))}
            </div>

            {/* Step 1 — template */}
            <Card className="p-6 md:p-8">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                    <div className="flex items-start gap-4">
                        <div className="p-3 rounded-2xl bg-slate-900 text-white shrink-0"><FileSpreadsheet size={22} /></div>
                        <div>
                            <h2 className="font-bold text-slate-900">1. Download CSV template</h2>
                            <p className="text-sm text-slate-500 mt-1 max-w-xl">
                                The template has the exact columns the importer expects, pre-filled with one of
                                your real products (as an “update” example) and one placeholder new product.
                            </p>
                        </div>
                    </div>
                    <button
                        onClick={handleDownloadTemplate}
                        disabled={catalog.loading}
                        className="inline-flex items-center justify-center gap-2 bg-slate-900 hover:bg-slate-800 text-white font-black text-xs uppercase tracking-widest px-5 py-3.5 rounded-2xl transition-all disabled:opacity-50 shrink-0"
                    >
                        <Download size={15} /> Download Template
                    </button>
                </div>

                <div className="mt-6 grid md:grid-cols-2 gap-4">
                    <div className="rounded-2xl bg-slate-50 border border-slate-100 p-4">
                        <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Columns</p>
                        <div className="flex flex-wrap gap-1.5">
                            {CSV_COLUMNS.map((c) => (
                                <span key={c} className="text-[11px] font-mono font-semibold px-2 py-1 rounded-lg bg-white border border-slate-200 text-slate-600">
                                    {c}{REQUIRED_COLUMNS.includes(c) ? ' *' : ''}
                                </span>
                            ))}
                        </div>
                        <p className="text-[11px] text-slate-400 mt-2">* required. <span className="font-mono">id</span> is optional — leave blank for new products.</p>
                    </div>
                    <div className="rounded-2xl bg-slate-50 border border-slate-100 p-4 text-[13px] text-slate-600 space-y-1.5">
                        <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Rules</p>
                        <p>• <b>category</b> must be one that already exists (categories are never created here).</p>
                        <p>• <b>specifications</b>: <span className="font-mono text-xs">Key: Value; Key: Value</span> or a JSON object.</p>
                        <p>• <b>is_active</b>: <span className="font-mono text-xs">active / inactive</span> (or true/false). Blank = active for new.</p>
                        <p>• <b>image_url</b>: a full <span className="font-mono text-xs">https://…</span> link or a <span className="font-mono text-xs">/path</span>. Image files can’t be embedded in CSV.</p>
                        <p>• Max {(LIMITS.maxBytes / 1024 / 1024)} MB, max {LIMITS.maxRows} rows.</p>
                    </div>
                </div>

                {!catalog.loading && (
                    <p className="text-[11px] text-slate-400 mt-4">
                        Existing categories:{' '}
                        <span className="text-slate-500 font-semibold">
                            {catalog.categories.map((c) => c.name).join(' · ') || '— none —'}
                        </span>
                    </p>
                )}
            </Card>

            {/* Step 2 — upload */}
            <Card className="p-6 md:p-8">
                <div className="flex items-start gap-4">
                    <div className="p-3 rounded-2xl bg-sky-100 text-sky-600 shrink-0"><Upload size={22} /></div>
                    <div className="flex-1">
                        <h2 className="font-bold text-slate-900">2. Choose your completed CSV</h2>
                        <p className="text-sm text-slate-500 mt-1">
                            Existing products are matched by <b>id</b>, then by <b>model_number</b> within the
                            category, then by <b>product name</b> within the category — matched rows are
                            <b> updated</b>, unmatched rows are <b>created</b>. Duplicates are never made.
                        </p>

                        <div className="mt-4 flex flex-col sm:flex-row sm:items-center gap-3">
                            <label className="inline-flex items-center gap-2 px-4 py-3 rounded-2xl border-2 border-dashed border-slate-200 hover:border-primary-400 cursor-pointer transition-all text-sm font-bold text-slate-600 w-full sm:w-auto">
                                <FileSpreadsheet size={16} className="text-slate-400" />
                                {file ? 'Change File' : 'Choose File'}
                                <input
                                    ref={fileInputRef}
                                    type="file"
                                    accept=".csv,text/csv"
                                    className="hidden"
                                    onChange={(e) => handleFile(e.target.files?.[0] || null)}
                                />
                            </label>
                            {file && (
                                <div className="flex items-center gap-2 text-sm text-slate-600">
                                    <CheckCircle2 size={16} className="text-emerald-500" />
                                    <span className="font-semibold">{file.name}</span>
                                    <span className="text-slate-400">({(file.size / 1024).toFixed(1)} KB)</span>
                                </div>
                            )}
                        </div>

                        {fileError && (
                            <p className="mt-3 text-sm text-red-600 flex items-center gap-2">
                                <XCircle size={15} /> {fileError}
                            </p>
                        )}

                        <div className="mt-4 flex flex-wrap gap-3">
                            <button
                                onClick={handleValidate}
                                disabled={!file || phase === 'validating' || catalog.loading}
                                className="inline-flex items-center justify-center gap-2 bg-slate-900 hover:bg-slate-800 text-white font-black text-xs uppercase tracking-widest px-5 py-3.5 rounded-2xl transition-all disabled:opacity-40"
                            >
                                {phase === 'validating'
                                    ? <><Loader2 size={15} className="animate-spin" /> Validating…</>
                                    : <><ListChecks size={15} /> Validate File</>}
                            </button>
                            {(file || validation) && (
                                <button
                                    onClick={startOver}
                                    className="inline-flex items-center gap-2 text-slate-500 hover:text-slate-900 font-black text-xs uppercase tracking-widest px-4 py-3.5 rounded-2xl hover:bg-slate-50 transition-all"
                                >
                                    <RefreshCw size={14} /> Start over
                                </button>
                            )}
                        </div>
                    </div>
                </div>
            </Card>

            {/* Step 3/4 — validation results + preview */}
            {phase === 'validated' && validation && (
                <Card className="p-6 md:p-8">
                    {validation.fatal ? (
                        <div className="flex items-start gap-3 text-red-600">
                            <XCircle size={20} className="shrink-0 mt-0.5" />
                            <div>
                                <h2 className="font-bold text-slate-900">Can’t read this file</h2>
                                <p className="text-sm text-red-600 mt-1">{validation.fatal}</p>
                            </div>
                        </div>
                    ) : validation.headerErrors.length ? (
                        <div className="flex items-start gap-3">
                            <XCircle size={20} className="shrink-0 mt-0.5 text-red-500" />
                            <div>
                                <h2 className="font-bold text-slate-900">Column problem</h2>
                                <ul className="text-sm text-red-600 mt-1 list-disc ml-5 space-y-0.5">
                                    {validation.headerErrors.map((e, i) => <li key={i}>{e}</li>)}
                                </ul>
                                <p className="text-xs text-slate-400 mt-2">
                                    Re-download the template to get the correct header row.
                                </p>
                            </div>
                        </div>
                    ) : (
                        <>
                            <h2 className="font-bold text-slate-900 mb-1">Import preview</h2>
                            <p className="text-sm text-slate-500 mb-4">
                                Reviewed {validation.summary.total} row(s). Nothing has been saved yet.
                            </p>

                            <div className="grid grid-cols-3 gap-3 mb-5">
                                <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-center">
                                    <p className="text-2xl font-black text-emerald-700">{validation.summary.create}</p>
                                    <p className="text-[10px] font-black uppercase tracking-widest text-emerald-600 mt-0.5">New products</p>
                                </div>
                                <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-center">
                                    <p className="text-2xl font-black text-amber-700">{validation.summary.update}</p>
                                    <p className="text-[10px] font-black uppercase tracking-widest text-amber-600 mt-0.5">To update</p>
                                </div>
                                <div className={`rounded-2xl border p-4 text-center ${validation.summary.error ? 'border-red-200 bg-red-50' : 'border-slate-200 bg-slate-50'}`}>
                                    <p className={`text-2xl font-black ${validation.summary.error ? 'text-red-700' : 'text-slate-500'}`}>{validation.summary.error}</p>
                                    <p className={`text-[10px] font-black uppercase tracking-widest mt-0.5 ${validation.summary.error ? 'text-red-600' : 'text-slate-400'}`}>Errors</p>
                                </div>
                            </div>

                            {validation.unknownColumns?.length > 0 && (
                                <p className="text-xs text-slate-400 mb-3 flex items-center gap-1.5">
                                    <Info size={13} /> Ignored unknown column(s): {validation.unknownColumns.join(', ')}
                                </p>
                            )}

                            {validation.summary.error > 0 && (
                                <div className="rounded-2xl border border-red-200 bg-red-50/60 p-4 mb-5">
                                    <p className="text-xs font-black text-red-700 uppercase tracking-widest mb-2 flex items-center gap-1.5">
                                        <AlertTriangle size={14} /> Fix these rows, then re-upload
                                    </p>
                                    <ul className="space-y-1.5 max-h-52 overflow-y-auto">
                                        {validation.items.filter((i) => i.errors.length).map((i) => (
                                            <li key={i.rowNumber} className="text-sm text-red-700">
                                                <span className="font-black">Row {i.rowNumber}:</span>{' '}
                                                {i.errors.join('; ')}
                                            </li>
                                        ))}
                                    </ul>
                                </div>
                            )}

                            {importError && (
                                <div className="rounded-2xl border border-red-200 bg-red-50 p-4 mb-5 text-sm text-red-700 flex items-start gap-2">
                                    <XCircle size={16} className="shrink-0 mt-0.5" />
                                    <div>
                                        <p className="font-black">Import failed — no products were changed.</p>
                                        <p className="mt-0.5">{importError}</p>
                                    </div>
                                </div>
                            )}

                            <div className="rounded-2xl border border-slate-100 overflow-hidden">
                                <div className="overflow-x-auto max-h-[420px]">
                                    <table className="w-full text-sm">
                                        <thead className="bg-slate-50 sticky top-0">
                                            <tr className="text-left text-[10px] font-black text-slate-400 uppercase tracking-widest">
                                                <th className="px-4 py-3 w-14">Row</th>
                                                <th className="px-4 py-3">Category</th>
                                                <th className="px-4 py-3">Product</th>
                                                <th className="px-4 py-3">Model</th>
                                                <th className="px-4 py-3 w-24">Action</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-slate-50">
                                            {shownItems.map((i) => (
                                                <tr key={i.rowNumber} className={i.action === 'error' ? 'bg-red-50/40' : ''}>
                                                    <td className="px-4 py-2.5 text-slate-400 font-mono text-xs">{i.rowNumber}</td>
                                                    <td className="px-4 py-2.5 text-slate-700">{i.categoryName || <span className="text-slate-300">—</span>}</td>
                                                    <td className="px-4 py-2.5 text-slate-900 font-semibold">{i.productName || <span className="text-slate-300">—</span>}</td>
                                                    <td className="px-4 py-2.5 text-slate-500 font-mono text-xs">{i.modelNumber || <span className="text-slate-300">—</span>}</td>
                                                    <td className="px-4 py-2.5">
                                                        <span className={`text-[10px] font-black uppercase tracking-widest px-2 py-1 rounded-lg border ${ACTION_BADGE[i.action]}`}>
                                                            {i.action === 'create' ? 'New' : i.action === 'update' ? 'Update' : 'Error'}
                                                        </span>
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                                {previewItems.length > shownItems.length && (
                                    <p className="text-xs text-slate-400 px-4 py-2 bg-slate-50 border-t border-slate-100">
                                        Showing first {shownItems.length} of {previewItems.length} rows.
                                    </p>
                                )}
                            </div>

                            <div className="mt-6 flex flex-wrap gap-3">
                                <button
                                    onClick={handleImport}
                                    disabled={!canImport || phase === 'importing'}
                                    className="inline-flex items-center justify-center gap-2 bg-emerald-600 hover:bg-emerald-700 text-white font-black text-xs uppercase tracking-widest px-6 py-3.5 rounded-2xl transition-all disabled:opacity-40 disabled:bg-slate-300"
                                >
                                    {phase === 'importing'
                                        ? <><Loader2 size={15} className="animate-spin" /> Importing…</>
                                        : <><CheckCircle2 size={15} /> Import to Products</>}
                                </button>
                                <button
                                    onClick={startOver}
                                    className="inline-flex items-center gap-2 text-slate-500 hover:text-slate-900 font-black text-xs uppercase tracking-widest px-4 py-3.5 rounded-2xl hover:bg-slate-50 transition-all"
                                >
                                    Cancel
                                </button>
                                {!canImport && validation.summary.error > 0 && (
                                    <span className="text-xs text-slate-400 self-center">
                                        Resolve all {validation.summary.error} error(s) to enable import.
                                    </span>
                                )}
                                {!canImport && validation.summary.error === 0 && (validation.summary.create + validation.summary.update) === 0 && (
                                    <span className="text-xs text-slate-400 self-center">Nothing to import.</span>
                                )}
                            </div>
                        </>
                    )}
                </Card>
            )}

            {/* Step 5 — success */}
            {phase === 'done' && importResult && (
                <Card className="p-8 text-center">
                    <div className="w-16 h-16 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center mx-auto mb-4">
                        <CheckCircle2 size={32} />
                    </div>
                    <h2 className="text-xl font-black text-slate-900">Import successful</h2>
                    <p className="text-sm text-slate-500 mt-1">
                        {importResult.processed} product(s) processed —{' '}
                        <span className="text-emerald-600 font-bold">{importResult.created} created</span>,{' '}
                        <span className="text-amber-600 font-bold">{importResult.updated} updated</span>, 0 errors.
                    </p>
                    <div className="mt-6 flex flex-wrap gap-3 justify-center">
                        <button
                            onClick={() => navigate('/admin/products')}
                            className="inline-flex items-center gap-2 bg-slate-900 hover:bg-slate-800 text-white font-black text-xs uppercase tracking-widest px-6 py-3.5 rounded-2xl transition-all"
                        >
                            View Products
                        </button>
                        <button
                            onClick={startOver}
                            className="inline-flex items-center gap-2 text-slate-500 hover:text-slate-900 font-black text-xs uppercase tracking-widest px-4 py-3.5 rounded-2xl hover:bg-slate-50 transition-all"
                        >
                            <Upload size={14} /> Import another file
                        </button>
                    </div>
                </Card>
            )}
        </div>
    );
};

export default BulkImportProducts;
