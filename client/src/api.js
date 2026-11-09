export const fmtSize = (b) => b < 1024 ? `${b} B` : b < 1048576 ? `${(b / 1024).toFixed(1)} KB` : `${(b / 1048576).toFixed(1)} MB`;
export const shareUrl = (id) => `${(import.meta.env.VITE_PUBLIC_URL || window.location.origin).replace(/\/$/, '')}/share/${id}`;
export const getConfig = () => fetch('/api/config').then((r) => r.json());
export const createShare = (form, onProgress) => new Promise((resolve, reject) => {
  const x = new XMLHttpRequest(); x.open('POST', '/api/shares');
  x.upload.onprogress = (e) => e.lengthComputable && onProgress(Math.round((e.loaded / e.total) * 100));
  x.onload = () => { let d = {}; try { d = JSON.parse(x.responseText); } catch {} x.status < 300 ? resolve(d) : reject(new Error(d.error || 'Upload failed.')); };
  x.onerror = () => reject(new Error('Network error. Check your connection and try again.'));
  x.send(form);
});
export const deleteShare = (id, token) => fetch(`/api/shares/${id}`, { method: 'DELETE', headers: { 'x-delete-token': token } });
