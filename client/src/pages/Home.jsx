import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { UploadCloud, FileText, Link2, Contact, Wifi, Braces, Files, X, Copy, Download, RefreshCw, Trash2, Loader2 } from 'lucide-react';
import toast from 'react-hot-toast'; import { QRCodeCanvas } from 'qrcode.react';
import { createShare, deleteShare, fmtSize, getConfig, shareUrl } from '../api';

const TABS = [['file', 'Files', Files], ['text', 'Text', FileText], ['link', 'Link', Link2], ['contact', 'Contact', Contact], ['wifi', 'Wi-Fi', Wifi], ['custom', 'Custom', Braces]];
const FIELDS = {
  text: [['text', 'Your text or code', 'area']], link: [['url', 'Link (https://…)']],
  contact: [['name', 'Full name'], ['phone', 'Phone'], ['email', 'Email'], ['org', 'Company']],
  wifi: [['ssid', 'Network name'], ['password', 'Password'], ['security', 'Security', 'select']],
  custom: [['label', 'Label (optional)'], ['value', 'Value', 'area']],
};

export default function Home() {
  const [tab, setTab] = useState('file'); const [files, setFiles] = useState([]); const [data, setData] = useState({ security: 'WPA' });
  const [expiry, setExpiry] = useState('24h'); const [cfg, setCfg] = useState({ maxFileMb: 100, maxFiles: 20 });
  const [busy, setBusy] = useState(false); const [pct, setPct] = useState(0); const [result, setResult] = useState(null);
  const [drag, setDrag] = useState(false); const input = useRef(); const qr = useRef();
  useEffect(() => { getConfig().then(setCfg).catch(() => {}); }, []);

  const addFiles = (list) => {
    const next = [...files];
    for (const f of list) {
      if (f.size > cfg.maxFileMb * 1048576) { toast.error(`${f.name} is over ${cfg.maxFileMb} MB.`); continue; }
      if (/\.(exe|bat|cmd|com|scr|msi|vbs|ps1|jar|dll)$/i.test(f.name)) { toast.error(`${f.name} is an unsupported file type.`); continue; }
      if (next.length >= cfg.maxFiles) { toast.error(`You can share up to ${cfg.maxFiles} files.`); break; }
      next.push(f);
    }
    setFiles(next);
  };
  const submit = async () => {
    const form = new FormData(); form.append('type', tab); form.append('expiresIn', expiry);
    if (tab === 'file') { if (!files.length) return toast.error('Add at least one file.'); files.forEach((f) => form.append('files', f)); }
    else form.append('payload', JSON.stringify(data));
    setBusy(true); setPct(0);
    try { setResult(await createShare(form, setPct)); toast.success('Share created.'); } catch (e) { toast.error(e.message); } finally { setBusy(false); }
  };
  const reset = () => { setResult(null); setFiles([]); setData({ security: 'WPA' }); };
  const copy = () => navigator.clipboard.writeText(shareUrl(result.id)).then(() => toast.success('Link copied.'), () => toast.error('Couldn’t copy. Select the link and copy it manually.'));
  const png = () => { const a = document.createElement('a'); a.href = qr.current.toDataURL('image/png'); a.download = 'quick-share-qr.png'; a.click(); };
  const remove = async () => { await deleteShare(result.id, result.deleteToken); toast.success('Share deleted.'); reset(); };

  return (
    <div>
      <section className="mx-auto max-w-2xl py-8 text-center">
        <h1 className="text-4xl font-extrabold tracking-tight sm:text-6xl">Share Anything. Instantly.</h1>
        <p className="mt-4 text-stone-600 dark:text-stone-400">Upload files, share text, or send links with a simple QR code. No signup required.</p>
        <Link to="/find" className="mt-3 inline-block text-sm font-semibold text-brand-600 underline">Have a 7-digit code? Open a share</Link>
      </section>

      {result ? (
        <div className="card mx-auto max-w-md text-center">
          <div className="mx-auto w-fit rounded-2xl bg-white p-4 ring-1 ring-stone-200"><QRCodeCanvas ref={qr} value={shareUrl(result.id)} size={240} marginSize={1} /></div>
          <p className="mt-3 text-sm text-stone-500">Scan with a phone camera, or enter this code at <b>/find</b>:</p>
          <button className="mx-auto mt-1 block rounded-xl bg-stone-100 px-5 py-2 text-3xl font-extrabold tracking-[.3em] dark:bg-stone-800" title="Copy code" onClick={() => navigator.clipboard.writeText(result.code).then(() => toast.success('Code copied.'))}>{result.code}</button>
          <input readOnly value={shareUrl(result.id)} onFocus={(e) => e.target.select()} className="input mt-3 text-center" aria-label="Share link" />
          <div className="mt-3 grid grid-cols-2 gap-2">
            <button className="btn-primary" onClick={copy}><Copy size={16} />Copy link</button>
            <button className="btn-ghost" onClick={png}><Download size={16} />Download QR</button>
            <button className="btn-ghost" onClick={reset}><RefreshCw size={16} />New share</button>
            <button className="btn-ghost text-red-600" onClick={remove}><Trash2 size={16} />Delete share</button>
          </div>
        </div>
      ) : (
        <div className="card mx-auto max-w-2xl">
          <div role="tablist" className="mb-4 flex gap-1 overflow-x-auto rounded-2xl bg-stone-100 p-1 dark:bg-stone-800">
            {TABS.map(([k, label, Icon]) => <button key={k} role="tab" aria-selected={tab === k} onClick={() => setTab(k)}
              className={`flex flex-1 items-center justify-center gap-1.5 whitespace-nowrap rounded-xl px-3 py-2 text-sm font-semibold transition ${tab === k ? 'bg-white shadow dark:bg-stone-950' : 'text-stone-500'}`}><Icon size={15} />{label}</button>)}
          </div>

          {tab === 'file' ? (
            <>
              <div onDragOver={(e) => { e.preventDefault(); setDrag(true); }} onDragLeave={() => setDrag(false)}
                onDrop={(e) => { e.preventDefault(); setDrag(false); addFiles([...e.dataTransfer.files]); }}
                className={`grid place-items-center rounded-2xl border-2 border-dashed p-8 text-center transition ${drag ? 'border-brand-500 bg-brand-50 dark:bg-brand-700/10' : 'border-stone-300 dark:border-stone-700'}`}>
                <UploadCloud className="text-brand-600" size={36} />
                <p className="mt-2 font-semibold">Drag and drop files here</p>
                <p className="text-xs text-stone-500">Up to {cfg.maxFiles} files, {cfg.maxFileMb} MB each</p>
                <button className="btn-primary mt-3" onClick={() => input.current.click()}>Browse files</button>
                <input ref={input} type="file" multiple hidden onChange={(e) => { addFiles([...e.target.files]); e.target.value = ''; }} />
              </div>
              {files.length === 0 ? <p className="mt-3 text-center text-sm text-stone-500">No files added yet.</p> :
                <ul className="mt-3 space-y-2">{files.map((f, i) => (
                  <li key={i} className="flex items-center gap-3 rounded-xl border border-stone-200 p-2 dark:border-stone-800">
                    {f.type.startsWith('image/') ? <img src={URL.createObjectURL(f)} alt="" className="h-10 w-10 rounded-lg object-cover" /> : <span className="grid h-10 w-10 place-items-center rounded-lg bg-stone-100 dark:bg-stone-800"><FileText size={18} /></span>}
                    <div className="min-w-0 flex-1"><p className="truncate text-sm font-semibold">{f.name}</p><p className="text-xs text-stone-500">{fmtSize(f.size)} · {f.type || 'unknown type'}</p></div>
                    <button aria-label={`Remove ${f.name}`} className="btn-ghost !p-1.5" onClick={() => setFiles(files.filter((_, j) => j !== i))}><X size={14} /></button>
                  </li>))}</ul>}
            </>
          ) : (
            <div className="space-y-3">{FIELDS[tab].map(([k, label, kind]) => (
              <label key={k} className="block text-sm font-semibold">{label}
                {kind === 'area' ? <textarea rows={6} className="input mt-1 font-normal" value={data[k] || ''} onChange={(e) => setData({ ...data, [k]: e.target.value })} />
                  : kind === 'select' ? <select className="input mt-1 font-normal" value={data[k]} onChange={(e) => setData({ ...data, [k]: e.target.value })}><option>WPA</option><option>WEP</option><option value="nopass">None</option></select>
                  : <input className="input mt-1 font-normal" value={data[k] || ''} onChange={(e) => setData({ ...data, [k]: e.target.value })} />}
              </label>))}</div>
          )}

          <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-center">
            <label className="text-sm font-semibold">Expires after{' '}
              <select className="input mt-1 !w-auto sm:ml-2 sm:mt-0" value={expiry} onChange={(e) => setExpiry(e.target.value)}><option value="1h">1 hour</option><option value="24h">24 hours</option><option value="7d">7 days</option></select></label>
            <button className="btn-primary flex-1" disabled={busy} onClick={submit}>{busy ? <><Loader2 className="animate-spin" size={16} />{tab === 'file' ? `Uploading ${pct}%` : 'Creating…'}</> : 'Create QR code'}</button>
          </div>
          {busy && tab === 'file' && <div className="mt-3 h-2 overflow-hidden rounded-full bg-stone-200 dark:bg-stone-800"><div className="h-full bg-brand-600 transition-all" style={{ width: `${pct}%` }} /></div>}
        </div>
      )}
    </div>
  );
}
