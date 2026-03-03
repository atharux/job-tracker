/**
 * Professional PDF Export Utility
 * Generates print-ready HTML for professional resume formatting
 * Matches ATS-friendly Helvetica/Arial style
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
    font-family: "Helvetica Neue", Arial, sans-serif;
    font-size: 11pt;
    line-height: 1.45;
    color: #000;
    margin: 0;
    padding: 0;
    background: #fff;
  }
  
  .resume {
    width: 794px;
    margin: 40px auto;
    padding: 0 40px;
  }
  
  /* Name/Header */
  .resume-name {
    font-size: 20pt;
    font-weight: 700;
    margin: 0;
    margin-bottom: 8px;
  }
  
  /* Contact Info */
  .resume-contact {
    font-size: 10pt;
    margin-bottom: 2px;
    line-height: 1.4;
  }
  
  .resume-contact a {
    color: #000;
    text-decoration: none;
  }
  
  /* Horizontal divider */
  .resume-divider {
    border: none;
    border-top: 1px solid #000;
    margin: 16px 0 8px;
  }
  
  /* Section Headers (EXPERIENCE, SKILLS, etc.) */
  .resume-section-header {
    font-size: 12pt;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.5px;
    margin-top: 28px;
    margin-bottom: 10px;
    border-bottom: 1px solid #000;
    padding-bottom: 4px;
    page-break-after: avoid;
  }
  
  /* Entry container */
  .resume-entry {
    margin-top: 16px;
    margin-bottom: 10px;
    page-break-inside: avoid;
  }
  
  /* Job title / Entry title */
  .resume-entry-title {
    font-size: 11pt;
    font-weight: 700;
    margin-bottom: 2px;
    page-break-after: avoid;
  }
  
  /* Company, location, dates */
  .resume-entry-meta {
    font-size: 10pt;
    color: #333;
    margin-bottom: 6px;
    font-style: normal;
    page-break-after: avoid;
  }
  
  /* Bullet points */
  .resume-bullets {
    margin: 6px 0 10px 18px;
    padding: 0;
    list-style-type: disc;
  }
  
  .resume-bullet {
    margin-bottom: 4px;
    line-height: 1.45;
    page-break-inside: avoid;
  }
  
  /* Regular paragraph text */
  .resume-para {
    font-size: 11pt;
    line-height: 1.45;
    margin-bottom: 6px;
  }
  
  /* Skills grid */
  .resume-skills-grid {
    display: grid;
    grid-template-columns: repeat(2, 1fr);
    gap: 24px;
    margin-top: 10px;
  }
  
  .resume-skills-category {
    margin-bottom: 12px;
  }
  
  .resume-skills-category-title {
    font-weight: 700;
    font-size: 11pt;
    margin-bottom: 6px;
  }
  
  .resume-skills-list {
    font-size: 11pt;
    line-height: 1.45;
  }
  
  @media print {
    body {
      margin: 0;
      padding: 0;
    }
    
    .resume {
      margin: 0;
      width: 100%;
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
<body>
<div class="resume">
${parseAndFormatResume(content)}
</div>
</body>
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
  let currentBullets = [];
  let nameFound = false;
  
  const isSectionHeader = (line) => {
    const t = line.trim();
    return t.length > 1 && t === t.toUpperCase() && /^[A-Z\s\/&\-:]+$/.test(t) && t.length < 60;
  };
  
  const isBullet = (line) => /^\s*[-\u2022\u25cf*\u25aa•]/.test(line);
  
  const hasDate = (line) => /(\d{4}|\bJan\b|\bFeb\b|\bMar\b|\bApr\b|\bMay\b|\bJun\b|\bJul\b|\bAug\b|\bSep\b|\bOct\b|\bNov\b|\bDec\b|Present|Current)/i.test(line);
  
  const isContactInfo = (line) => {
    const lower = line.toLowerCase();
    return /^(p:|e:|phone:|email:|location:|portfolio:|linkedin:|github:|website:)/i.test(line) ||
           /@/.test(line) || 
           /\d{3}[-.\s]?\d{3}[-.\s]?\d{4}/.test(line) ||
           /https?:\/\//.test(line);
  };
  
  const flushBullets = () => {
    if (currentBullets.length > 0) {
      html += '<ul class="resume-bullets">';
      currentBullets.forEach(bullet => {
        html += `<li class="resume-bullet">${bullet}</li>`;
      });
      html += '</ul>';
      currentBullets = [];
    }
  };
  
  // Skip empty lines at start
  while (i < lines.length && !lines[i].trim()) i++;
  
  // Look for name - first substantial line that's NOT a section header or contact info
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
    html += `<h1 class="resume-name">${escapeHtml(line)}</h1>`;
    nameFound = true;
    i++;
    break;
  }
  
  // If no name found, add a placeholder
  if (!nameFound) {
    html += '<h1 class="resume-name">[Your Name]</h1>';
  }
  
  // Parse contact info (lines before first real section header)
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
      flushBullets();
      html += `<h2 class="resume-section-header">${escapeHtml(line)}</h2>`;
      i++;
      continue;
    }
    
    if (isBullet(line)) {
      const text = line.replace(/^\s*[-\u2022\u25cf*\u25aa•]\s*/, '');
      currentBullets.push(escapeHtml(text));
      i++;
      continue;
    }
    
    // Check for job title + meta pattern
    if (i + 1 < lines.length && hasDate(lines[i + 1].trim()) && lines[i + 1].trim()) {
      flushBullets();
      const metaLine = lines[i + 1].trim();
      html += '<div class="resume-entry">';
      html += `<div class="resume-entry-title">${escapeHtml(line)}</div>`;
      html += `<div class="resume-entry-meta">${escapeHtml(metaLine)}</div>`;
      html += '</div>';
      i += 2;
      continue;
    }
    
    // Regular paragraph
    flushBullets();
    html += `<p class="resume-para">${escapeHtml(line)}</p>`;
    i++;
  }
  
  flushBullets();
  
  return html;
}

function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}
