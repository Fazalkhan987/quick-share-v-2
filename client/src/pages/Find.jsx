import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Search, Loader2 } from 'lucide-react';
import toast from 'react-hot-toast';

export default function Find() {
  const [code, setCode] = useState(''); const [busy, setBusy] = useState(false); const nav = useNavigate();
  const go = async (e) => {
    e.preventDefault();
    if (code.length !== 7) return toast.error('Enter all 7 digits.');
    setBusy(true);
    try {
      const r = await fetch(`/api/code/${code}`); const d = await r.json();
      if (!r.ok) throw new Error(d.error); nav(`/share/${d.id}`);
    } catch (err) { toast.error(err.message || 'Couldn’t reach the server.'); } finally { setBusy(false); }
  };
  return (
    <form onSubmit={go} className="card mx-auto mt-6 max-w-md text-center">
      <h1 className="text-3xl font-extrabold">Open a share</h1>
      <p className="mt-2 text-sm text-stone-500">Type the 7-digit code you were given.</p>
      <input autoFocus inputMode="numeric" pattern="\d{7}" maxLength={7} aria-label="7-digit code" placeholder="0000000"
        className="input mt-4 text-center text-3xl font-extrabold tracking-[.3em]" value={code}
        onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, 7))} />
      <button className="btn-primary mt-4 w-full" disabled={busy}>{busy ? <Loader2 className="animate-spin" size={16} /> : <Search size={16} />}Open</button>
    </form>
  );
}
