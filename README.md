# Preset Web Editor — GitHub + Vercel

Website editor preset berbasis browser.

## Fitur
- Paste dan validasi link Alight Creative.
- Workspace preset.
- Live preview area.
- Asset/layer list.
- Replace image/video/audio langsung dari HP.
- Responsive dark UI.
- Vercel Blob upload endpoint untuk asset besar.
- Siap dikembangkan ke rendering pipeline Vercel Sandbox.

## Penting
Project ini sengaja TIDAK membypass endpoint private/internal Alight Motion dan tidak berpura-pura dapat membaca timeline asli hanya dari share URL.

Share URL dapat divalidasi, tetapi timeline, keyframe, efek, asset, dan data project asli hanya dapat diproses jika format project/data yang dapat diakses secara sah tersedia.

UI preview saat ini menampilkan asset pengganti yang benar-benar dipilih user. Itu bukan fake video render.

## Deploy

1. Upload repository ini ke GitHub.
2. Import repository ke Vercel.
3. Deploy.
4. Untuk upload asset ke Vercel Blob:
   - buka Vercel Dashboard
   - Storage
   - buat/connect Blob store ke project.
5. Redeploy setelah storage terhubung.

Vercel Blob mendukung upload file besar secara langsung dari browser dan multipart upload.

## Rendering penuh
Untuk render MP4 dari timeline project, tahap berikutnya membutuhkan parser/render engine yang benar-benar memahami format project. FFmpeg sendiri dapat memproses video/audio, tetapi tidak otomatis memahami semua efek, keyframe, masking, dan compositing proprietary dari editor tertentu.
