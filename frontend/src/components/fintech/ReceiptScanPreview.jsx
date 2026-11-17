import { CheckCircle2, FileText } from 'lucide-react';
import { motion } from 'motion/react';
import { useEffect, useState } from 'react';
import { useFintechMotion } from './useFintechMotion';

export default function ReceiptScanPreview({ file }) {
  const { enabled } = useFintechMotion();
  const [preview, setPreview] = useState(null);
  const [scan, setScan] = useState({ file, version: 0, done: false });
  const [failedImage, setFailedImage] = useState(null);
  // Reset before committing a replacement, even when its name and size are identical.
  if (scan.file !== file) setScan({ file, version: scan.version + 1, done: false });
  useEffect(() => {
    if (!enabled) setScan((current) => current.file === file && !current.done ? { ...current, done: true } : current);
  }, [enabled, file]);
  useEffect(() => {
    if (!file || typeof URL.createObjectURL !== 'function') return;
    let url;
    try { url = URL.createObjectURL(file); setPreview({ file, url }); } catch { return; }
    return () => { if (typeof URL.revokeObjectURL === 'function') URL.revokeObjectURL(url); };
  }, [file]);
  if (!file) return null;
  const captured = !enabled || scan.done;
  const url = preview?.file === file ? preview.url : null;
  const image = file.type.startsWith('image/');
  const Pill = enabled ? motion.div : 'div';
  return (
    <section className="relative overflow-hidden rounded-xl border border-slate-200 bg-slate-50/80" aria-label="Selected receipt preview">
      <div className="relative flex h-56 items-center justify-center overflow-hidden p-4">
        {image && url && failedImage !== file ? <img src={url} alt={`Selected receipt: ${file.name}`} onError={() => setFailedImage(file)} className="h-full max-w-full rounded border border-slate-200 bg-white object-contain shadow-sm" />
          : !image && url ? <object data={url} type="application/pdf" aria-label={`PDF receipt: ${file.name}`} className="h-full w-full"><div className="flex h-full flex-col items-center justify-center gap-3 text-slate-400"><FileText size={36} /><span className="text-xs">PDF receipt attached</span></div></object>
            : <div className="text-center text-slate-400"><FileText size={36} className="mx-auto mb-3" /><p className="text-xs">{image ? 'Image receipt attached' : 'PDF receipt attached'}</p></div>}
        {enabled && !captured && <motion.div key={scan.version} aria-hidden="true" data-receipt-scan="" className="pointer-events-none absolute inset-0 z-10"
          initial={{ y: '0%' }} animate={{ y: '100%' }} transition={{ duration: 1.2, ease: 'linear' }}
          onAnimationComplete={() => setScan((current) => current.version === scan.version ? { ...current, done: true } : current)}>
          <div className="absolute -top-16 inset-x-0 h-16 bg-gradient-to-b from-transparent via-emerald-400/25 to-transparent"><div className="absolute inset-x-0 bottom-0 h-[1.5px] bg-emerald-500/70" /></div>
        </motion.div>}
      </div>
      <div className="border-t border-slate-200 bg-white/80 p-3">
        <p className="truncate text-xs text-slate-500" dir="auto">{file.name}</p>
        <div className="mt-2 min-h-7" role="status">
          {captured ? <Pill className="inline-flex items-center gap-1.5 rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-1 text-[10px] font-medium text-emerald-700"
            {...(enabled ? { initial: { opacity: 0, y: 3 }, animate: { opacity: 1, y: 0 }, transition: { duration: 0.2 } } : {})}>
            <CheckCircle2 size={12} aria-hidden="true" />Receipt captured • Ready for submission
          </Pill> : <span className="text-xs text-slate-400">Preparing your receipt…</span>}
        </div>
      </div>
    </section>
  );
}
