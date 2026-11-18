import fs from 'fs';
import path from 'path';
import zlib from 'zlib';

function createPngBuffer(width, height, colorRgb) {
  // Simple uncompressed IDAT chunk PNG encoder
  const [r, g, b] = colorRgb;
  const rawRows = [];
  for (let y = 0; y < height; y++) {
    rawRows.push(0); // Filter byte 0 (None)
    for (let x = 0; x < width; x++) {
      // Draw dark slate background with cyan emblem center
      const cx = width / 2;
      const cy = height / 2;
      const dist = Math.hypot(x - cx, y - cy);
      if (dist < width * 0.2) {
        rawRows.push(6, 182, 212, 255); // Cyan #06b6d4
      } else if (dist < width * 0.38) {
        rawRows.push(10, 16, 29, 255); // Slate #0a101d
      } else {
        rawRows.push(4, 7, 12, 255); // Dark background #04070c
      }
    }
  }

  const uncompressedData = Buffer.from(rawRows);
  const compressedData = zlib.deflateSync(uncompressedData);

  function makeChunk(type, data) {
    const len = Buffer.alloc(4);
    len.writeUInt32BE(data.length, 0);
    const typeBuf = Buffer.from(type, 'ascii');
    const crcBuf = Buffer.alloc(4);
    const combined = Buffer.concat([typeBuf, data]);
    const crc = crc32(combined);
    crcBuf.writeUInt32BE(crc >>> 0, 0);
    return Buffer.concat([len, typeBuf, data, crcBuf]);
  }

  const signature = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8; // Bit depth
  ihdr[9] = 6; // Color type 6 = RGBA
  ihdr[10] = 0; // Compression
  ihdr[11] = 0; // Filter
  ihdr[12] = 0; // Interlace

  const ihdrChunk = makeChunk('IHDR', ihdr);
  const idatChunk = makeChunk('IDAT', compressedData);
  const iendChunk = makeChunk('IEND', Buffer.alloc(0));

  return Buffer.concat([signature, ihdrChunk, idatChunk, iendChunk]);
}

// CRC32 implementation for PNG chunks
function crc32(buf) {
  let c = ~0;
  for (let i = 0; i < buf.length; i++) {
    c ^= buf[i];
    for (let k = 0; k < 8; k++) {
      c = (c & 1) ? (0xedb88320 ^ (c >>> 1)) : (c >>> 1);
    }
  }
  return ~c;
}

const publicDir = path.resolve('public');
fs.writeFileSync(path.join(publicDir, 'pwa-192x192.png'), createPngBuffer(192, 192, [6, 182, 212]));
fs.writeFileSync(path.join(publicDir, 'pwa-512x512.png'), createPngBuffer(512, 512, [6, 182, 212]));
fs.writeFileSync(path.join(publicDir, 'apple-touch-icon.png'), createPngBuffer(180, 180, [6, 182, 212]));
fs.writeFileSync(path.join(publicDir, 'maskable-512x512.png'), createPngBuffer(512, 512, [6, 182, 212]));

console.log('PWA PNG icons generated successfully!');
