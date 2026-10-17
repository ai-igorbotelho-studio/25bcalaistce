import { useEffect } from "react";

export default function Lightbox({ src, alt, onClose }) {
  useEffect(() => {
    const k = (e) => e.key === "Escape" && onClose();
    document.addEventListener("keydown", k);
    return () => document.removeEventListener("keydown", k);
  }, []);
  return (
    <div className="lightbox" role="dialog" aria-modal="true" aria-label={alt} onClick={onClose}>
      <img src={src} alt={alt} />
      <button type="button" className="lightbox-close" aria-label="Close photo"><i className="ti ti-x" /></button>
    </div>
  );
}
