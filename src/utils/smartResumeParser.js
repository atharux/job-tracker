/**
 * Smart Resume Parser - No AI Required
 * Uses pattern matching to extract resume data from text
 */

import * as pdfjsLib from 'pdfjs-dist';
import mammoth from 'mammoth';

// Configure PDF.js worker - use CDN for production builds
if (typeof window !== 'undefined') {
  pdfjsLib.GlobalWorkerOptions.workerSrc = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsLib.version}/pdf.worker.min.js`;
}

/**
 * Extract text from PDF file
 */
async function extractTextFromPDF(file) {
  const arrayBuffer = await file.arrayBuffer();
  const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
  
  let fullText = '';
  for (let i = 1; i <= pdf.numPages; i++) {
    const page = await pdf.getPage(i);
    const textContent = await page.getTextContent();
    const pageText = textContent.items.map(item => item.str).join(' ');
    fullText += pageText + '\n';
  }
  
  return fullText;
}

/**
 * Extract text from DOCX file
 */
async function extractTextFromDOCX(file) {
  const arrayBuffer = await file.arrayBuffer();
  const result = await mammoth.extractRawText({ arrayBuffer });
  return result.value;
}

/**
 * Extract text from TXT file
 */
async function extractTextFromTXT(file) {
  return await file.text();
}

/**
 * Main text extraction function
 */
export async function extractTextFromFile(file) {
  const fileType = file.type;
  const fileName = file.name.toLowerCase();
  
  try {
    if (fileType === 'application/pdf' || fileName.endsWith('.pdf')) {
      return await extractTextFromPDF(file);
    } else if (fileType === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' || fileName.endsWith('.docx')) {
      return await extractTextFromDOCX(file);
    } else if (fileType === 'text/plain' || fileName.endsWith('.txt')) {
      return await extractTextFromTXT(file);
    } else {
      throw new Error('Unsupported file type');
    }
  } catch (error) {
    console.error('Text extraction error:', error);
    throw new Error(`Failed to extract text from ${file.name}`);
  }
}

/**
 * Find section in text using multiple patterns
 */
function findSection(text, sectionNames) {
  const lines = text.split('\n');
  let sectionStart = -1;
  let sectionEnd = lines.length;
  
  // Find section start
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim().toLowerCase();
    if (sectionNames.some(name => line.includes(name.toLowerCase()))) {
      sectionStart = i + 1;
      break;
    }
  }
  
  if (sectionStart === -1) return '';
  
  // Find next section (common section headers)
  const commonSections = [
    'experience', 'education', 'skills', 'certifications', 'projects',
    'summary', 'objective', 'awards', 'publications', 'languages',
    'references', 'interests', 'volunteer'
  ];
  
  for (let i = sectionStart; i < lines.length; i++) {
    const line = lines[i].trim().toLowerCase();
    if (commonSections.some(section => 
      line === section || 
      line === section + ':' ||
      line.startsWith(section + ' ') ||
      (line.length < 30 && line.includes(section))
    )) {
      sectionEnd = i;
      break;
    }
  }
  
  return lines.slice(sectionStart, sectionEnd).join('\n');
}

/**
 * Parse experience section
 */
function parseExperience(text) {
  const experiences = [];
  const lines = text.split('\n').filter(line => line.trim());
  
  const datePattern = /(\d{1,2}\/\d{4}|\d{4}|[A-Z][a-z]{2,8}\s+\d{4}|present|current)/gi;
  
  let currentExp = null;
  
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;
    
    const dates = line.match(datePattern);
    
    if (dates && dates.length >= 1) {
      if (currentExp && currentExp.position) {
        experiences.push(currentExp);
      }
      
      const parts = line.split(/[|–—-]/);
      currentExp = {
        company: '',
        position: '',
        location: '',
        startDate: '',
        endDate: '',
        achievements: []
      };
      
      if (parts.length >= 2) {
        currentExp.position = parts[0].replace(datePattern, '').trim();
        currentExp.company = parts[1].replace(datePattern, '').trim();
      } else {
        currentExp.position = line.replace(datePattern, '').trim();
      }
      
      if (dates.length >= 2) {
        currentExp.startDate = dates[0];
        currentExp.endDate = dates[1];
      } else if (dates.length === 1) {
        currentExp.startDate = dates[0];
      }
    } else if (currentExp) {
      if (line.startsWith('•') || line.startsWith('-') || line.startsWith('*') || line.match(/^[\d]+\./)) {
        const achievement = line.replace(/^[•\-*\d.]+\s*/, '').trim();
        if (achievement.length > 10) {
          currentExp.achievements.push(achievement);
        }
      } else if (!currentExp.company && line.length < 100) {
        currentExp.company = line;
      }
    }
  }
  
  if (currentExp && currentExp.position) {
    experiences.push(currentExp);
  }
  
  return experiences;
}

/**
 * Parse education section
 */
function parseEducation(text) {
  const education = [];
  const lines = text.split('\n').filter(line => line.trim());
  
  const datePattern = /(\d{4}|present|current)/gi;
  const degreePattern = /(bachelor|master|phd|doctorate|associate|b\.?s\.?|m\.?s\.?|b\.?a\.?|m\.?a\.?|mba)/i;
  
  let currentEdu = null;
  
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;
    
    const hasDegree = degreePattern.test(line);
    const dates = line.match(datePattern);
    
    if (hasDegree || (dates && dates.length >= 1)) {
      if (currentEdu && currentEdu.institution) {
        education.push(currentEdu);
      }
      
      currentEdu = {
        institution: '',
        degree: '',
        field: '',
        startDate: '',
        endDate: '',
        gpa: '',
        honors: []
      };
      
      const degreeMatch = line.match(degreePattern);
      if (degreeMatch) {
        currentEdu.degree = degreeMatch[0];
      }
      
      if (dates) {
        if (dates.length >= 2) {
          currentEdu.startDate = dates[0];
          currentEdu.endDate = dates[1];
        } else {
          currentEdu.endDate = dates[0];
        }
      }
      
      const parts = line.split(/[|–—-]/);
      if (parts.length > 0) {
        currentEdu.institution = parts[0].replace(datePattern, '').replace(degreePattern, '').trim();
      }
    } else if (currentEdu && !currentEdu.institution && line.length < 100) {
      currentEdu.institution = line;
    } else if (currentEdu && line.toLowerCase().includes('gpa')) {
      const gpaMatch = line.match(/(\d\.\d+)/);
      if (gpaMatch) {
        currentEdu.gpa = gpaMatch[0];
      }
    }
  }
  
  if (currentEdu && currentEdu.institution) {
    education.push(currentEdu);
  }
  
  return education;
}

/**
 * Parse skills section
 */
function parseSkills(text) {
  const skills = {
    technical: [],
    soft: [],
    languages: [],
    tools: []
  };
  
  const lines = text.split('\n').filter(line => line.trim());
  
  for (const line of lines) {
    const items = line.split(/[,;|•\-*]/).map(s => s.trim()).filter(s => s.length > 1);
    
    for (const item of items) {
      const lower = item.toLowerCase();
      
      if (lower.match(/(javascript|python|java|react|node|sql|html|css|typescript|c\+\+|ruby|php|swift|kotlin|angular|vue|django|flask|spring)/)) {
        skills.technical.push(item);
      } else if (lower.match(/(english|spanish|french|german|chinese|japanese|korean|arabic|portuguese|italian)/)) {
        skills.languages.push(item);
      } else if (lower.match(/(leadership|communication|teamwork|problem|management|analytical|creative|organized)/)) {
        skills.soft.push(item);
      } else if (lower.match(/(git|docker|aws|azure|figma|photoshop|excel|jira|slack|kubernetes|jenkins|terraform)/)) {
        skills.tools.push(item);
      } else if (item.length > 2 && item.length < 50) {
        skills.technical.push(item);
      }
    }
  }
  
  return skills;
}

/**
 * Parse certifications section
 */
function parseCertifications(text) {
  const certifications = [];
  const lines = text.split('\n').filter(line => line.trim());
  
  const datePattern = /(\d{1,2}\/\d{4}|\d{4}|[A-Z][a-z]{2,8}\s+\d{4})/gi;
  
  for (const line of lines) {
    if (line.length < 10) continue;
    
    const dates = line.match(datePattern);
    const parts = line.split(/[|–—-]/);
    
    const cert = {
      name: parts[0].replace(datePattern, '').trim(),
      issuer: parts.length > 1 ? parts[1].replace(datePattern, '').trim() : '',
      date: dates && dates.length > 0 ? dates[0] : '',
      expiryDate: dates && dates.length > 1 ? dates[1] : '',
      credentialId: ''
    };
    
    if (cert.name) {
      certifications.push(cert);
    }
  }
  
  return certifications;
}

/**
 * Main parsing function
 */
export function parseResumeText(text) {
  try {
    const experienceText = findSection(text, ['experience', 'work history', 'employment', 'professional experience']);
    const educationText = findSection(text, ['education', 'academic background']);
    const skillsText = findSection(text, ['skills', 'technical skills', 'core competencies']);
    const certificationsText = findSection(text, ['certifications', 'certificates', 'licenses']);
    
    const experience = parseExperience(experienceText);
    const education = parseEducation(educationText);
    const skills = parseSkills(skillsText);
    const certifications = parseCertifications(certificationsText);
    
    const lines = text.split('\n');
    let summary = '';
    for (let i = 0; i < Math.min(10, lines.length); i++) {
      const line = lines[i].trim();
      if (line.length > 50 && !line.toLowerCase().match(/(experience|education|skills|email|phone)/)) {
        summary = line;
        break;
      }
    }
    
    return {
      success: true,
      data: {
        summary,
        experience,
        education,
        skills,
        certifications
      }
    };
  } catch (error) {
    console.error('Resume parsing error:', error);
    return {
      success: false,
      error: error.message
    };
  }
}
