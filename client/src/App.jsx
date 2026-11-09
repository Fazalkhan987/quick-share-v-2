import { useEffect, useState } from 'react';
import { Link, Route, Routes } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import { QrCode, Moon, Sun } from 'lucide-react';
import Home from './pages/Home'; import Find from './pages/Find'; import Share from './pages/Share'; import { About, Privacy } from './pages/Static';

export default function App() {
  const [dark, setDark] = useState(() => localStorage.getItem('qs-dark') === '1');
  useEffect(() => { document.documentElement.classList.toggle('dark', dark); localStorage.setItem('qs-dark', dark ? '1' : '0'); }, [dark]);
  return (
    <div className="min-h-screen">
      <header className="mx-auto flex max-w-5xl items-center justify-between px-4 py-4">
        <Link to="/" className="flex items-center gap-2 text-lg font-extrabold"><span className="grid h-9 w-9 place-items-center rounded-xl bg-brand-600 text-white"><QrCode size={20} /></span>Quick Share</Link>
        <nav className="flex items-center gap-4 text-sm font-semibold text-stone-600 dark:text-stone-300">
          <Link to="/find">Enter code</Link><Link to="/about">About</Link><Link to="/privacy">Privacy</Link>
          <button aria-label="Toggle dark mode" className="btn-ghost !p-2" onClick={() => setDark(!dark)}>{dark ? <Sun size={16} /> : <Moon size={16} />}</button>
        </nav>
      </header>
      <main className="mx-auto max-w-5xl px-4 pb-16">
        <Routes><Route path="/" element={<Home />} /><Route path="/share/:id" element={<Share />} /><Route path="/find" element={<Find />} /><Route path="/about" element={<About />} /><Route path="/privacy" element={<Privacy />} /></Routes>
      </main>
      <Toaster position="top-center" toastOptions={{ style: { borderRadius: 14 } }} />
    </div>
  );
}
