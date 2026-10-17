/* Read an image file and return a downscaled JPEG data URL.
   Also drops EXIF (incl. GPS) because the canvas re-encodes the pixels. */
export function fileToDownscaledDataURL(file, max, quality = 0.85) {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onerror = reject;
    r.onload = () => {
      const img = new Image();
      img.onerror = reject;
      img.onload = () => {
        let w = img.width, h = img.height;
        if (w >= h && w > max) { h = Math.round(h * max / w); w = max; }
        else if (h > w && h > max) { w = Math.round(w * max / h); h = max; }
        const c = document.createElement("canvas");
        c.width = w; c.height = h;
        const ctx = c.getContext("2d");
        ctx.fillStyle = "#fff";            // PNG transparency → white, not black
        ctx.fillRect(0, 0, w, h);
        ctx.drawImage(img, 0, 0, w, h);
        resolve(c.toDataURL("image/jpeg", quality));
      };
      img.src = r.result;
    };
    r.readAsDataURL(file);
  });
}
