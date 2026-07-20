// ══════════════════════════════════════════════════════════════════════
// Minimal ZIP (STORE method, no external deps) builder
// Used by /api/assets/:folder/download-zip to bundle a production's
// generated files into a real .zip archive.
// ══════════════════════════════════════════════════════════════════════

// Precompute the standard CRC-32 lookup table
const CRC_TABLE = (() => {
  const table = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) {
      c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    }
    table[n] = c >>> 0;
  }
  return table;
})();

function crc32(buf) {
  let crc = 0xffffffff;
  for (let i = 0; i < buf.length; i++) {
    crc = CRC_TABLE[(crc ^ buf[i]) & 0xff] ^ (crc >>> 8);
  }
  return (crc ^ 0xffffffff) >>> 0;
}

// DOS date/time fields required by the ZIP spec (local file header).
function toDosDateTime(date = new Date()) {
  const dosTime =
    ((date.getHours() & 0x1f) << 11) |
    ((date.getMinutes() & 0x3f) << 5) |
    ((date.getSeconds() / 2) & 0x1f);
  const dosDate =
    (((date.getFullYear() - 1980) & 0x7f) << 9) |
    (((date.getMonth() + 1) & 0xf) << 5) |
    (date.getDate() & 0x1f);
  return { dosTime, dosDate };
}

/**
 * Build a valid ZIP archive (no compression — STORE method) from a list
 * of { name, content } entries. content may be a string or Buffer.
 * Returns a Buffer containing the complete .zip file.
 */
function createZip(files) {
  const { dosTime, dosDate } = toDosDateTime(new Date());
  const localParts = [];
  const centralParts = [];
  let offset = 0;

  for (const file of files) {
    const nameBuf = Buffer.from(file.name, 'utf-8');
    const contentBuf = Buffer.isBuffer(file.content)
      ? file.content
      : Buffer.from(file.content, 'utf-8');
    const crc = crc32(contentBuf);
    const size = contentBuf.length;

    // Local file header
    const localHeader = Buffer.alloc(30);
    localHeader.writeUInt32LE(0x04034b50, 0); // local file header signature
    localHeader.writeUInt16LE(20, 4);          // version needed to extract
    localHeader.writeUInt16LE(0, 6);           // general purpose flag
    localHeader.writeUInt16LE(0, 8);           // compression method = STORE
    localHeader.writeUInt16LE(dosTime, 10);
    localHeader.writeUInt16LE(dosDate, 12);
    localHeader.writeUInt32LE(crc, 14);
    localHeader.writeUInt32LE(size, 18);       // compressed size
    localHeader.writeUInt32LE(size, 22);       // uncompressed size
    localHeader.writeUInt16LE(nameBuf.length, 26);
    localHeader.writeUInt16LE(0, 28);          // extra field length

    localParts.push(localHeader, nameBuf, contentBuf);

    // Central directory header
    const centralHeader = Buffer.alloc(46);
    centralHeader.writeUInt32LE(0x02014b50, 0); // central dir signature
    centralHeader.writeUInt16LE(20, 4);          // version made by
    centralHeader.writeUInt16LE(20, 6);          // version needed
    centralHeader.writeUInt16LE(0, 8);           // flags
    centralHeader.writeUInt16LE(0, 10);          // compression = STORE
    centralHeader.writeUInt16LE(dosTime, 12);
    centralHeader.writeUInt16LE(dosDate, 14);
    centralHeader.writeUInt32LE(crc, 16);
    centralHeader.writeUInt32LE(size, 20);       // compressed size
    centralHeader.writeUInt32LE(size, 24);       // uncompressed size
    centralHeader.writeUInt16LE(nameBuf.length, 28);
    centralHeader.writeUInt16LE(0, 30);          // extra field length
    centralHeader.writeUInt16LE(0, 32);          // comment length
    centralHeader.writeUInt16LE(0, 34);          // disk number start
    centralHeader.writeUInt16LE(0, 36);          // internal attrs
    centralHeader.writeUInt32LE(0, 38);          // external attrs
    centralHeader.writeUInt32LE(offset, 42);     // offset of local header

    centralParts.push(centralHeader, nameBuf);

    offset += localHeader.length + nameBuf.length + contentBuf.length;
  }

  const centralDirStart = offset;
  const centralDirBuf = Buffer.concat(centralParts);

  const end = Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50, 0);          // end of central dir signature
  end.writeUInt16LE(0, 4);                   // disk number
  end.writeUInt16LE(0, 6);                   // disk with central dir
  end.writeUInt16LE(files.length, 8);        // entries on this disk
  end.writeUInt16LE(files.length, 10);       // total entries
  end.writeUInt32LE(centralDirBuf.length, 12); // size of central dir
  end.writeUInt32LE(centralDirStart, 16);    // offset of central dir
  end.writeUInt16LE(0, 20);                  // comment length

  return Buffer.concat([...localParts, centralDirBuf, end]);
}

export { createZip };
