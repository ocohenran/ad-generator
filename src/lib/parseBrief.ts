const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB

export async function parseFile(file: File): Promise<string> {
  if (file.size > MAX_FILE_SIZE) {
    throw new Error('File too large (max 10MB).');
  }

  const ext = file.name.split('.').pop()?.toLowerCase();

  if (ext === 'txt' || ext === 'md') {
    return file.text();
  }

  if (ext === 'pdf' || file.type === 'application/pdf') {
    return parsePdf(file);
  }

  throw new Error('Unsupported file type. Use PDF, TXT, or MD.');
}

async function parsePdf(file: File): Promise<string> {
  const pdfjsLib = await import('pdfjs-dist');

  // Set worker source to bundled worker
  pdfjsLib.GlobalWorkerOptions.workerSrc = new URL(
    'pdfjs-dist/build/pdf.worker.mjs',
    import.meta.url,
  ).toString();

  const arrayBuffer = await file.arrayBuffer();
  const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;

  const pages: string[] = [];
  for (let i = 1; i <= pdf.numPages; i++) {
    const page = await pdf.getPage(i);
    const content = await page.getTextContent();
    const text = content.items
      .map((item) => ('str' in item ? item.str : ''))
      .join(' ');
    pages.push(text);
  }

  return pages.join('\n\n');
}
