import { parseHwpLegacy } from './hwpDecoder.js';
import AdmZip from 'adm-zip';
import { PDFParse } from 'pdf-parse';

/**
 * Unified document parser to detect file type (PDF, HWP, HWPX) and extract plaintext.
 */
export async function parseDocument(filename: string, buffer: Buffer): Promise<string> {
  const extension = filename.split('.').pop()?.toLowerCase();
  let extractedText = '';
  
  try {
    if (extension === 'pdf') {
      try {
        const pdfParse = new PDFParse({ data: buffer });
        const textResult = await pdfParse.getText();
        extractedText = textResult.text || '';
        await pdfParse.destroy();
      } catch (err) {
        console.warn(`PDF Standard Parser failed for ${filename}, attempting raw binary fallback:`, err);
        extractedText = fallbackExtractText(buffer);
      }
    } else if (extension === 'hwp') {
      // Check if it's actually an HWPX file in disguise (starts with ZIP PK magic '504b0304')
      if (buffer.length >= 4) {
        const magic = buffer.slice(0, 4).toString('hex');
        if (magic === '504b0304') {
          extractedText = parseHwpx(buffer);
        } else {
          extractedText = parseHwpLegacy(buffer);
        }
      } else {
        extractedText = parseHwpLegacy(buffer);
      }
    } else if (extension === 'hwpx') {
      extractedText = parseHwpx(buffer);
    } else {
      // Fallback for other files
      extractedText = fallbackExtractText(buffer);
    }
  } catch (err) {
    console.warn(`Main parser threw error for ${filename}, utilizing robust fallback:`, err);
    extractedText = fallbackExtractText(buffer);
  }

  // Final safety net: If extracted text is empty or too short, extract text from binary raw encoding
  if (!extractedText || extractedText.trim().length < 5) {
    console.log(`[Document Parser] Standard extraction yielded empty or too short results. Running raw fallback scanner for ${filename}.`);
    extractedText = fallbackExtractText(buffer);
  }

  return extractedText;
}

/**
 * Fallback to extract readable strings (Korean, English, numbers, emails) directly from raw buffer.
 * Helps rescue critical form entries if file formatting parsing or zlib decompression fails completely.
 */
export function fallbackExtractText(buffer: Buffer): string {
  console.log('[Document Parser] Running robust fallback text scanner on raw buffer...');
  
  // 1. Decode UTF-16LE (HWP and Windows-native structures frequently use UTF-16LE)
  const utf16Str = buffer.toString('utf16le');
  const utf16Count = (utf16Str.match(/[\uAC00-\uD7A3]/g) || []).length;

  // 2. Decode UTF-8
  const utf8Str = buffer.toString('utf8');
  const utf8Count = (utf8Str.match(/[\uAC00-\uD7A3]/g) || []).length;

  // Select the decoded stream showing a higher density of Korean characters
  let bestStr = utf8Count >= utf16Count ? utf8Str : utf16Str;

  // Retain only printable characters: Korean, Alphanumerics, spaces, and typical form symbols
  const regex = /([\uAC00-\uD7A3a-zA-Z0-9\s.,@:;?!_()\[\]{}'"\-+/~*#%&]+)/g;
  const matches = bestStr.match(regex);
  if (!matches) return '';

  return matches
    .map(m => m.trim())
    .filter(m => m.length > 1)
    .join(' ')
    .replace(/\s+/g, ' ');
}

/**
 * Parses HWPX ZIP files by scanning Contents/section*.xml files for body text tags
 */
function parseHwpx(buffer: Buffer): string {
  try {
    const zip = new AdmZip(buffer);
    const zipEntries = zip.getEntries();
    
    // Gather all Section XML files
    const sectionEntries = zipEntries
      .filter(entry => entry.entryName.startsWith('Contents/section') && entry.entryName.endsWith('.xml'))
      .sort((a, b) => {
        const numA = parseInt(a.entryName.match(/\d+/)?.[0] || '0', 10);
        const numB = parseInt(b.entryName.match(/\d+/)?.[0] || '0', 10);
        return numA - numB;
      });

    let fullText = '';
    for (const entry of sectionEntries) {
      const xml = entry.getData().toString('utf8');
      
      // Target <hp:t> (HWPX paragraph text)
      const regex = /<hp:t[^>]*>([\s\S]*?)<\/hp:t>/g;
      let match;
      let textAdded = false;
      while ((match = regex.exec(xml)) !== null) {
        fullText += decodeHtmlEntities(match[1]) + ' ';
        textAdded = true;
      }
      
      if (!textAdded) {
        // Fallback to standard <t> tags
        const regexSimple = /<t[^>]*>([\s\S]*?)<\/t>/g;
        while ((match = regexSimple.exec(xml)) !== null) {
          fullText += decodeHtmlEntities(match[1]) + ' ';
        }
      }
      fullText += '\n';
    }
    
    return fullText.trim();
  } catch (err) {
    console.error('HWPX Parsing error:', err);
    return '';
  }
}

/**
 * Clean HTML entities commonly present in HWPX XML schemas
 */
function decodeHtmlEntities(str: string): string {
  return str
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, ' ');
}
