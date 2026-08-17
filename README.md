# PixelForge — Image Resizer & Compressor MVP

## Run
Open `index.html` directly in a modern browser, or run:

```bash
python -m http.server 5500
```

Then open `http://localhost:5500`.

## Current MVP
- Drag & drop image upload
- Width + height resizing
- Aspect-ratio lock
- Target KB / MB mode
- JPEG / WEBP / PNG output
- Quality control
- High-quality canvas scaling
- Before/after preview
- Local browser processing
- Download result

## Product direction
Next iterations can add:
1. Batch processing
2. Exact target-size optimizer with a stronger search algorithm
3. Smart crop / fit / fill
4. EXIF orientation handling
5. Presets for WhatsApp, Instagram, passport, forms, government portals, etc.
6. PWA/offline support
7. Worker-based processing for very large images
8. MERN backend for accounts, saved presets, history and optional cloud processing
