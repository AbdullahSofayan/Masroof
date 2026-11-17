import { createContext, useContext, useEffect, useState } from 'react';
import { CheckCircle2, X } from 'lucide-react';
const NoticeContext = createContext(null);
export function NoticeProvider({ children }) {
  const [notice, setNotice] = useState(null);
  useEffect(() => { if (notice) { const timeout = setTimeout(() => setNotice(null), 6000); return () => clearTimeout(timeout); } }, [notice]);
  return <NoticeContext.Provider value={(message) => setNotice({ message })}>{children}{notice && <div role="status" className="toast"><CheckCircle2 size={20} className="text-emerald-600" /><span>{notice.message}</span><button aria-label="Dismiss notification" onClick={() => setNotice(null)}><X size={18} /></button></div>}</NoticeContext.Provider>;
}
export const useNotice = () => useContext(NoticeContext);
