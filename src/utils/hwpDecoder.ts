import * as zlib from 'zlib';

/**
 * Compound File Binary Format (OLE CFBF) Decoder for legacy HWP (v5.0) documents.
 * Extracts BodyText stream bytes, inflates them, and decodes HWP Record paragraphs.
 */
export interface DirectoryEntry {
  name: string;
  type: number;
  startSector: number;
  size: number;
}

export function parseOleCFBF(buffer: Buffer): Map<string, Buffer> {
  const streams = new Map<string, Buffer>();

  // Check Magic: D0 CF 11 E0 A1 B1 1A E1
  if (buffer.length < 512) return streams;
  const magic = buffer.readDoubleLE(0);
  if (magic !== -6.005128082937326e+250 && magic !== 0xE11AB1A1E011CFD0) {
    // Some systems or Node versions read Double differently, check bytes directly
    const magicHex = buffer.slice(0, 8).toString('hex');
    if (magicHex !== 'd0cf11e0a1b11ae1') {
      return streams; // Not an OLE file
    }
  }

  const sectorShift = buffer.readUInt16LE(0x1E);
  const sectorSize = 1 << sectorShift; // Typically 512
  const miniSectorShift = buffer.readUInt16LE(0x20);
  const miniSectorSize = 1 << miniSectorShift; // Typically 64

  const fatSectorsCount = buffer.readUInt32LE(0x2C);
  const firstDirSector = buffer.readUInt32LE(0x30);
  const miniStreamCutoff = buffer.readUInt32LE(0x38); // Typically 4096
  const firstMiniFatSector = buffer.readUInt32LE(0x3C);
  const miniFatSectorsCount = buffer.readUInt32LE(0x40);
  const firstDifatSector = buffer.readUInt32LE(0x44);
  const difatSectorsCount = buffer.readUInt32LE(0x48);

  // Helper to get sector offset in file
  const getSectorOffset = (sid: number) => 512 + sid * sectorSize;

  // 1. Build DIFAT (Double Indirect FAT)
  const difat: number[] = [];
  for (let i = 0; i < 109; i++) {
    const sid = buffer.readUInt32LE(0x4C + i * 4);
    if (sid < 0xFFFFFFFE) {
      difat.push(sid);
    }
  }

  let nextDifatSector = firstDifatSector;
  while (nextDifatSector < 0xFFFFFFFE && nextDifatSector !== 0) {
    const offset = getSectorOffset(nextDifatSector);
    if (offset + sectorSize > buffer.length) break;
    for (let i = 0; i < (sectorSize / 4) - 1; i++) {
      const sid = buffer.readUInt32LE(offset + i * 4);
      if (sid < 0xFFFFFFFE) difat.push(sid);
    }
    nextDifatSector = buffer.readUInt32LE(offset + sectorSize - 4);
  }

  // 2. Build FAT
  const fat: number[] = [];
  for (const fatSid of difat) {
    const offset = getSectorOffset(fatSid);
    if (offset + sectorSize > buffer.length) continue;
    for (let i = 0; i < sectorSize / 4; i++) {
      fat.push(buffer.readUInt32LE(offset + i * 4));
    }
  }

  // Chain collector helper
  const collectChain = (startSid: number): Buffer[] => {
    const chunks: Buffer[] = [];
    let sid = startSid;
    const visited = new Set<number>();
    while (sid < 0xFFFFFFFE && sid !== 0) {
      if (visited.has(sid)) break; // Prevent infinite loop
      visited.add(sid);
      const offset = getSectorOffset(sid);
      if (offset + sectorSize > buffer.length) {
        // Grab remaining part if file is cut short
        if (offset < buffer.length) {
          chunks.push(buffer.slice(offset));
        }
        break;
      }
      chunks.push(buffer.slice(offset, offset + sectorSize));
      sid = fat[sid];
    }
    return chunks;
  };

  // 3. Read Directories
  const dirBuffer = Buffer.concat(collectChain(firstDirSector));
  const entries: DirectoryEntry[] = [];
  for (let i = 0; i < dirBuffer.length; i += 128) {
    if (i + 128 > dirBuffer.length) break;
    const nameLength = dirBuffer.readUInt16LE(i + 0x40);
    if (nameLength <= 2) continue; // Empty or invalid entry

    // Parse UTF-16LE Name (safely handle null termination across environments)
    const nameStr = dirBuffer.slice(i, i + nameLength).toString('utf16le').replace(/\0/g, '').trim();
    const type = dirBuffer[i + 0x42];
    const startSector = dirBuffer.readUInt32LE(i + 0x74);
    const size = Number(dirBuffer.readBigUInt64LE(i + 0x78) & 0xFFFFFFFFn); // Safe casting for standard sizes

    entries.push({ name: nameStr, type, startSector, size });
  }

  // 4. Build Mini FAT if needed
  let miniFat: number[] = [];
  if (firstMiniFatSector < 0xFFFFFFFE && miniFatSectorsCount > 0) {
    const miniFatChunks = collectChain(firstMiniFatSector);
    const miniFatBuf = Buffer.concat(miniFatChunks);
    for (let i = 0; i < miniFatBuf.length; i += 4) {
      miniFat.push(miniFatBuf.readUInt32LE(i));
    }
  }

  // Build Mini Stream if Root exists
  const rootEntry = entries.find(e => e.type === 5); // Root Entry
  let miniStream = Buffer.alloc(0);
  if (rootEntry && rootEntry.startSector < 0xFFFFFFFE) {
    miniStream = Buffer.concat(collectChain(rootEntry.startSector));
  }

  // Helper to collect Mini FAT Chain
  const collectMiniChain = (startSid: number, targetSize: number): Buffer => {
    let sizeCollected = 0;
    const chunks: Buffer[] = [];
    let sid = startSid;
    const visited = new Set<number>();
    while (sid < 0xFFFFFFFE && sizeCollected < targetSize) {
      if (visited.has(sid)) break;
      visited.add(sid);
      const offset = sid * miniSectorSize;
      if (offset + miniSectorSize > miniStream.length) {
        if (offset < miniStream.length) {
          chunks.push(miniStream.slice(offset));
        }
        break;
      }
      chunks.push(miniStream.slice(offset, offset + miniSectorSize));
      sizeCollected += miniSectorSize;
      sid = miniFat[sid] !== undefined ? miniFat[sid] : 0xFFFFFFFE;
    }
    const full = Buffer.concat(chunks);
    return full.slice(0, targetSize);
  };

  // 5. Gather Streams
  // We can track full paths of storages if needed, but for HWP, 
  // streams like "Section0", "Section1", "FileHeader" are typically unique enough.
  for (const entry of entries) {
    if (entry.type === 2) { // Stream
      let streamData = Buffer.alloc(0);
      if (entry.size >= miniStreamCutoff) {
        // Normal stream
        const chunks = collectChain(entry.startSector);
        streamData = Buffer.concat(chunks).slice(0, entry.size);
      } else if (miniStream.length > 0 && entry.startSector < 0xFFFFFFFE) {
        // Mini stream
        streamData = collectMiniChain(entry.startSector, entry.size);
      }
      streams.set(entry.name, streamData);
    }
  }

  return streams;
}

/**
 * Parses inflated HWP section stream data and returns concatenated plaintext.
 * Handles the HWP record format and grabs UTF-16 characters from HWPTAG_PARA_TEXT (Tag 67)
 */
export function extractTextFromHwpSection(sectionBuffer: Buffer): string {
  let offset = 0;
  let text = '';

  while (offset + 4 <= sectionBuffer.length) {
    const header = sectionBuffer.readUInt32LE(offset);
    offset += 4;

    const tagId = header & 0x3FF;
    const level = (header >> 10) & 0x3FF;
    let length = (header >> 20) & 0xFFF;

    if (length === 0xFFF) {
      if (offset + 4 > sectionBuffer.length) break;
      length = sectionBuffer.readUInt32LE(offset);
      offset += 4;
    }

    if (offset + length > sectionBuffer.length) {
      length = sectionBuffer.length - offset;
    }

    const recordData = sectionBuffer.slice(offset, offset + length);
    offset += length;

    // HWPTAG_PARA_TEXT Tag ID is 67
    if (tagId === 67) {
      // Paragraph text is stored in UTF-16LE format.
      // Filter out internal HWP controls and format characters for cleaner extraction.
      let paragraphText = '';
      let charIdx = 0;
      while (charIdx + 2 <= recordData.length) {
        const charCode = recordData.readUInt16LE(charIdx);
        charIdx += 2;

        // Skip HWP control characters (0 ~ 31) except specific ones like inline tabs if necessary.
        // HWP special control blocks are prefixed with characters like 1, 2, 3, etc. and take up to 16 bytes.
        if (charCode < 32) {
          if (charCode === 9 || charCode === 10 || charCode === 13) {
            paragraphText += ' '; // Map spacing controls
          }
          // Some control codes in HWP are followed by inline control blocks of fixed sizes.
          // Handle skipping control block parameters to avoid garbage characters.
          if (charCode === 3) {
            // Field start control (Hyperlink, bookmark, etc.): skips its parameters
            charIdx += 14; // typically 14 bytes control data
          } else if (charCode === 4 || charCode === 11 || charCode === 15 || charCode === 16 || charCode === 17 || charCode === 18 || charCode === 21) {
            charIdx += 14;
          }
          continue;
        }

        // Standard Unicode characters
        paragraphText += String.fromCharCode(charCode);
      }
      text += paragraphText + '\n';
    }
  }

  return text;
}

/**
 * Full parser to process a legacy HWP (.hwp) file buffer and return its full text.
 */
export function parseHwpLegacy(buffer: Buffer): string {
  try {
    const streams = parseOleCFBF(buffer);
    
    // Check if HWP is compressed. Look at FileHeader stream.
    const fileHeader = streams.get('FileHeader');
    let isCompressed = false;
    if (fileHeader && fileHeader.length >= 40) {
      const attributes = fileHeader.readUInt32LE(36);
      isCompressed = (attributes & 0x01) !== 0;
    }

    let fullText = '';
    
    // Sort sections by their name, e.g., "Section0", "Section1", etc.
    const sectionNames = Array.from(streams.keys())
      .filter(name => name.toLowerCase().startsWith('section'))
      .sort((a, b) => {
        const numA = parseInt(a.toLowerCase().replace('section', '')) || 0;
        const numB = parseInt(b.toLowerCase().replace('section', '')) || 0;
        return numA - numB;
      });

    for (const secName of sectionNames) {
      let secData = streams.get(secName);
      if (!secData || secData.length === 0) continue;

      if (isCompressed) {
        try {
          // Decompress raw zlib deflate
          secData = zlib.inflateRawSync(secData);
        } catch (inflateErr) {
          // If raw inflate fails, try standard inflate (in case it contains zlib header)
          try {
            secData = zlib.inflateSync(secData);
          } catch (e) {
            console.error(`Decompression failed for ${secName}:`, inflateErr);
            continue;
          }
        }
      }

      fullText += extractTextFromHwpSection(secData) + '\n';
    }

    return fullText.trim();
  } catch (err) {
    console.error('Error parsing legacy HWP file:', err);
    return '';
  }
}
