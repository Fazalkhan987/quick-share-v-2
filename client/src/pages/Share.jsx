import { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { Download, Copy, FileText, Loader2, Clock, ExternalLink, Archive, Wifi } from 'lucide-react';
import toast from 'react-hot-toast'; import { QRCodeSVG } from 'qrcode.react'; import { fmtSize } from '../api';

const left = (t) => { const s = Math.max(0, Math.floor((t - Date.now()) / 1000)); const d = Math.floor(s / 86400), h = Math.floor(s % 86400 / 3600), m = Math.floor(s % 3600 / 60); return d ? `${d}d ${h}h` : h ? `${h}h ${m}m` : `${m}m ${s % 60}s`; };
const copy = (t) => navigator.clipboard.writeText(t).then(() => toast.success('Copied.'), () => toast.error('Couldn’t copy.'));
const esc = (v = '') => v.replace(/([\\;,:"])/g, '\\$1');

function Preview({ id, f }) {
  const src = `/api/shares/${id}/files/${f.id}?inline=1`;
  if (/^image\/(png|jpe?g|gif|webp)/.test(f.mime)) return <img src={src} alt={f.name} className="mt-2 max-h-80 rounded-xl" />;
  if (f.mime.startsWith('video/')) return <video src={src} controls className="mt-2 max-h-80 w-full rounded-xl" />;
  if (f.mime.startsWith('audio/')) return <audio src={src} controls className="mt-2 w-full" />;
  if (f.mime === 'application/pdf') return <iframe src={src} title={f.name} className="mt-2 h-80 w-full rounded-xl" />;
  return null;
}

export default function Share() {
  const { id } = useParams(); const [s, setS] = useState(null); const [err, setErr] = useState(''); const [, tick] = useState(0);
  useEffect(() => { fetch(`/api/shares/${id}`).then(async (r) => { const d = await r.json(); r.ok ? setS(d) : setErr(d.error); }).catch(() => setErr('Couldn’t load this share. Check your connection.')); }, [id]);
  useEffect(() => { const t = setInterval(() => tick((n) => n + 1), 1000); return () => clearInterval(t); }, []);
  if (err) return <div className="card mx-auto mt-6 max-w-md text-center"><h1 className="text-2xl font-extrabold">Share unavailable</h1><p className="mt-2 text-stone-500">{err}</p><Link className="btn-primary mt-4" to="/">Create a new share</Link></div>;
  if (!s) return <div className="grid place-items-center py-20"><Loader2 className="animate-spin" /></div>;
  const p = s.payload || {};
  const vcf = () => { const b = new Blob([`BEGIN:VCARD\nVERSION:3.0\nFN:${p.name}\n${p.phone ? `TEL:${p.phone}\n` : ''}${p.email ? `EMAIL:${p.email}\n` : ''}${p.org ? `ORG:${p.org}\n` : ''}END:VCARD`], { type: 'text/vcard' }); const a = document.createElement('a'); a.href = URL.createObjectURL(b); a.download = `${p.name}.vcf`; a.click(); };
  return (
    <div className="card mx-auto mt-4 max-w-xl space-y-4">
      <div className="flex items-center justify-between text-sm text-stone-500">
        <span className="flex items-center gap-1"><Clock size={14} />Expires in {left(s.expiresAt)}</span><span>{s.code && <>Code <b className="tracking-widest">{s.code}</b> · </>}{s.downloads} download{s.downloads === 1 ? '' : 's'}</span>
      </div>
      {s.type === 'file' && <>
        <h1 className="text-2xl font-extrabold">{s.files.length === 1 ? 'A file was shared with you' : `${s.files.length} files were shared with you`}</h1>
        <ul className="space-y-3">{s.files.map((f) => (
          <li key={f.id} className="rounded-2xl border border-stone-200 p-3 dark:border-stone-800">
            <div className="flex items-center gap-3"><FileText className="shrink-0 text-brand-600" />
              <div className="min-w-0 flex-1"><p className="truncate font-semibold">{f.name}</p><p className="text-xs text-stone-500">{fmtSize(f.size)} · {f.mime}</p></div>
              <a className="btn-primary" href={`/api/shares/${id}/files/${f.id}`}><Download size={16} />Download</a></div>
            <Preview id={id} f={f} />
          </li>))}</ul>
        {s.files.length > 1 && <a className="btn-ghost w-full" href={`/api/shares/${id}/zip`}><Archive size={16} />Download all as ZIP</a>}
      </>}
      {s.type === 'text' && <><h1 className="text-2xl font-extrabold">Shared text</h1><pre className="max-h-96 overflow-auto whitespace-pre-wrap break-words rounded-xl bg-stone-100 p-3 text-sm dark:bg-stone-800">{p.text}</pre><button className="btn-primary w-full" onClick={() => copy(p.text)}><Copy size={16} />Copy text</button></>}
      {s.type === 'link' && <><h1 className="text-2xl font-extrabold">Shared link</h1><p className="break-all rounded-xl bg-stone-100 p-3 text-sm dark:bg-stone-800">{p.url}</p><a className="btn-primary w-full" href={p.url} target="_blank" rel="noopener noreferrer nofollow"><ExternalLink size={16} />Open link</a><p className="text-xs text-stone-500">Only open links from people you trust.</p></>}
      {s.type === 'contact' && <><h1 className="text-2xl font-extrabold">{p.name}</h1><p className="whitespace-pre-line text-stone-600 dark:text-stone-300">{[p.org, p.phone, p.email].filter(Boolean).join('\n')}</p><button className="btn-primary w-full" onClick={vcf}><Download size={16} />Save contact (.vcf)</button></>}
      {s.type === 'wifi' && <><h1 className="flex items-center gap-2 text-2xl font-extrabold"><Wifi />Wi-Fi: {p.ssid}</h1>
        {p.security !== 'nopass' && <button className="btn-ghost w-full" onClick={() => copy(p.password || '')}><Copy size={16} />Copy password</button>}
        <div className="mx-auto w-fit rounded-xl bg-white p-3"><QRCodeSVG value={`WIFI:T:${p.security};S:${esc(p.ssid)};P:${esc(p.password)};;`} size={180} /></div><p className="text-center text-xs text-stone-500">Scan this with another phone to join the network.</p></>}
      {s.type === 'custom' && <><h1 className="text-2xl font-extrabold">{p.label || 'Shared data'}</h1><pre className="whitespace-pre-wrap break-words rounded-xl bg-stone-100 p-3 text-sm dark:bg-stone-800">{p.value}</pre><button className="btn-primary w-full" onClick={() => copy(p.value)}><Copy size={16} />Copy</button></>}
    </div>
  );
}
