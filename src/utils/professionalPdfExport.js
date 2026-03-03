/**
 * Professional PDF Export Utility
 * Generates print-ready HTML for professional resume formatting
 * Matches the style shown in the reference image
 */

export function generateProfessionalPDF(content, filename) {
  const html = `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8"/>
<title>${filename}</title>
<style>
  * {
    margin: 0;
    padding: 0;
    box-sizing: border-box;
  }
  
  body {
    font-family: Georgia, serif;
    font-size: 11pt;
    color: #1a1a1a;
    padding: 0.5in 0.75in;
    max-width: 8.5in;
    margin: 0 auto;
    line-height: 1.45;
    background: white;
  }
  
  /* Name/Header */
  .resume-name {
    font-size: 28pt;
    font-weight: 700;
    color: #0f172a;
    margin-bottom: 6px;
    letter-spacing: -0.02em;
  }
  
  /* Contact Info */
  .resume-contact {
    font-size: 10pt;
    color: #475569;
    margin-bottom: 2px;
    line-height: 1.6;
  }
  
  /* Horizontal divider */
  .resume-divider {
    border: none;
    border-top: 2px solid #0f172a;
    margin: 14px 0 10px;
  }
  
  /* Section Headers (EXPERIENCE, SKILLS, etc.) */
  .resume-section-header {
    font-size: 9pt;
    font-weight: 700;
    letter-spacing: 0.18em;
    text-transform: uppercase;
    color: #0f172a;
    border-bottom: 1px solid #cbd5e1;
    padding-bottom: 3px;
    margin-top: 14px;
    margin-bottom: 6px;
    page-break-after: avoid;
  }
  
  /* Entry container */
  .resume-entry {
    margin-bottom: 10px;
    page-break-inside: avoid;
  }
  
  /* Job title / Entry title */
  .resume-entry-title {
    font-size: 11.5pt;
    font-weight: 700;
    color: #0f172a;
    margin-bottom: 2px;
    page-break-after: avoid;
  }
  
  /* Company, location, dates */
  .resume-entry-meta {
    font-size: 10pt;
    color: #64748b;
    margin-bottom: 3px;
    font-style: italic;
    page-break-after: avoid;
  }
  
  /* Bullet points */
  .resume-bullet {
    font-size: 11pt;
    color: #334155;
    line-height: 1.5;
    padding-left: 16px;
    position: relative;
    margin-bottom: 1px;
    page-break-inside: avoid;
  }
  
  .resume-bullet::before {
    content: '•';
    position: absolute;
    left: 4px;
    color: #94a3b8;
  }
  
  /* Regular paragraph text */
  .resume-para {
    font-size: 11pt;
    color: #334155;
    line-height: 1.55;
    margin-bottom: 3px;
  }
  
  /* Summary section */
  .resume-summary {
    font-size: 11pt;
    color: #334155;
    line-height: 1.55;
    margin-bottom: 6px;
  }
  
  @media print {
    body {
      padding: 0;
      margin: 0;
    }
    
    .resume-entry {
      page-break-inside: avoid;
    }
    
    .resume-section-header {
      page-break-after: avoid;
    }
    
    .resume-entry-title {
      page-break-after: avoid;
    }
    
    .resume-entry-meta {
      page-break-after: avoid;
    }
  }
</style>
</head>
<body>${parseAndFormatResume(content)}</body>
</html>`;

  // Create iframe and trigger print
  const iframe = document.createElement('iframe');
  iframe.style.cssText = 'position:fixed;top:-9999px;left:-9999px;width:0;height:0;border:none;';
  document.body.appendChild(iframe);
  
  const doc = iframe.contentWindow.document;
  doc.open();
  doc.write(html);
  doc.close();
  
  iframe.contentWindow.focus();
  setTimeout(() => {
    iframe.contentWindow.print();
    setTimeout(() => document.body.removeChild(iframe), 1000);
  }, 400);
}

/**
 * Parse resume content and format it with proper HTML structure
 */
function parseAndFormatResume(content) {
  if (!content) return '<p>No content</p>';
  
  const lines = content.split('\n');
  let html = '';
  let i = 0;
  let currentEntry = [];
  let nameFound = false;
  
  const isSectionHeader = (line) => {
    const t = line.trim();
    return t.length > 1 && t === t.toUpperCase() && /^[A-Z\s\/&\-:]+$/.test(t) && t.length < 60;
  };
  
  const isBullet = (line) => /^\s*[-\u2022\u25cf*\u25aa]/.test(line);
  
  const hasDate = (line) => /(\d{4}|\bJan\b|\bFeb\b|\bMar\b|\bApr\b|\bMay\b|\bJun\b|\bJul\b|\bAug\b|\bSep\b|\bOct\b|\bNov\b|\bDec\b|Present|Current)/i.test(line);
  
  const isContactInfo = (line) => {
    const lower = line.toLowerCase();
    return /^(p:|e:|phone:|email:|location:|portfolio:|linkedin:|github:|website:)/i.test(line) ||
           /@/.test(line) || 
           /\d{3}[-.\s]?\d{3}[-.\s]?\d{4}/.test(line) ||
           /https?:\/\//.test(line);
  };
  
  const flushEntry = () => {
    if (currentEntry.length > 0) {
      html += '<div class="resume-entry">' + currentEntry.join('') + '</div>';
      currentEntry = [];
    }
  };
  
  // Skip empty lines at start
  while (i < lines.length && !lines[i].trim()) i++;
  
  // Look for name - it should be the first substantial line that's NOT a section header or contact info
  while (i < lines.length && !nameFound) {
    const line = lines[i].trim();
    
    if (!line) {
      i++;
      continue;
    }
    
    // Skip "CONTACT INFO:" or similar headers
    if (isSectionHeader(line)) {
      i++;
      continue;
    }
    
    // If it's contact info, we haven't found the name yet
    if (isContactInfo(line)) {
      i++;
      continue;
    }
    
    // This should be the name
    html += `<div class="resume-name">${escapeHtml(line)}</div>`;
    nameFound = true;
    i++;
    break;
  }
  
  // If no name found, add a placeholder
  if (!nameFound) {
    html += '<div class="resume-name">[Your Name]</div>';
  }
  
  // Parse contact info (lines before first real section header like SUMMARY, EXPERIENCE, etc.)
  while (i < lines.length) {
    const line = lines[i].trim();
    
    if (!line) {
      i++;
      continue;
    }
    
    // Stop at first real section (not CONTACT INFO)
    if (isSectionHeader(line) && !line.match(/^CONTACT\s*INFO:?$/i)) {
      break;
    }
    
    // Skip "CONTACT INFO:" header itself
    if (line.match(/^CONTACT\s*INFO:?$/i)) {
      i++;
      continue;
    }
    
    html += `<div class="resume-contact">${escapeHtml(line)}</div>`;
    i++;
  }
  
  html += '<hr class="resume-divider" />';
  
  // Parse sections
  while (i < lines.length) {
    const line = lines[i].trim();
    
    if (!line) {
      i++;
      continue;
    }
    
    if (isSectionHeader(line)) {
      flushEntry();
      html += `<div class="resume-section-header">${escapeHtml(line)}</div>`;
      i++;
      continue;
    }
    
    if (isBullet(line)) {
      const text = line.replace(/^\s*[-\u2022\u25cf*\u25aa]\s*/, '');
      currentEntry.push(`<div class="resume-bullet">${escapeHtml(text)}</div>`);
      i++;
      continue;
    }
    
    // Check for job title + meta pattern
    if (i + 1 < lines.length && hasDate(lines[i + 1].trim()) && lines[i + 1].trim()) {
      flushEntry();
      const metaLine = lines[i + 1].trim();
      currentEntry.push(`<div class="resume-entry-title">${escapeHtml(line)}</div>`);
      currentEntry.push(`<div class="resume-entry-meta">${escapeHtml(metaLine)}</div>`);
      i += 2;
      continue;
    }
    
    // Regular paragraph
    currentEntry.push(`<div class="resume-para">${escapeHtml(line)}</div>`);
    i++;
  }
  
  flushEntry();
  
  return html;
}

function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}
