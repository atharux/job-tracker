/**
 * ATS (Applicant Tracking System) Export Utility
 * Generates plain text resumes optimized for ATS parsing
 * Implements Requirements 5.1-5.5 from resume-builder-manager spec
 */

/**
 * Export resume version as ATS-friendly plain text
 * @param {Object} version - Resume version object
 * @param {Array} modules - Array of module objects
 * @param {Object} contactInfo - Contact information {name, email, phone, location}
 * @returns {string} ATS-formatted plain text
 */
export function generateATSResume(version, modules, contactInfo = {}) {
  const sections = [];

  // Standard section order: contact, summary, experience, education, skills
  const sectionOrder = ['contact', 'summary', 'experience', 'education', 'skills', 'certification', 'custom'];

  // Group modules by type
  const modulesByType = modules.reduce((acc, module) => {
    if (!acc[module.type]) {
      acc[module.type] = [];
    }
    acc[module.type].push(module);
    return acc;
  }, {});

  // Generate each section in order
  sectionOrder.forEach(type => {
    if (type === 'contact') {
      const contactSection = generateContactSection(contactInfo);
      if (contactSection) sections.push(contactSection);
    } else if (modulesByType[type]) {
      const section = generateSection(type, modulesByType[type]);
      if (section) sections.push(section);
    }
  });

  return sections.join('\n\n');
}

/**
 * Generate contact information section
 */
function generateContactSection(contactInfo) {
  if (!contactInfo.name && !contactInfo.email) {
    return null;
  }

  const lines = [];
  
  if (contactInfo.name) lines.push(contactInfo.name.toUpperCase());
  
  const contactDetails = [];
  if (contactInfo.email) contactDetails.push(contactInfo.email);
  if (contactInfo.phone) contactDetails.push(contactInfo.phone);
  if (contactInfo.location) contactDetails.push(contactInfo.location);
  
  if (contactDetails.length > 0) {
    lines.push(contactDetails.join(' | '));
  }

  return lines.join('\n');
}

/**
 * Generate section based on module type
 */
function generateSection(type, modules) {
  const sectionTitle = getSectionTitle(type);
  const sectionContent = modules.map(module => formatModule(module)).filter(Boolean).join('\n\n');
  
  if (!sectionContent) return null;
  
  return `${sectionTitle}\n${'='.repeat(sectionTitle.length)}\n\n${sectionContent}`;
}

/**
 * Get section title for module type
 */
function getSectionTitle(type) {
  const titles = {
    summary: 'PROFESSIONAL SUMMARY',
    experience: 'WORK EXPERIENCE',
    education: 'EDUCATION',
    skills: 'SKILLS',
    certification: 'CERTIFICATIONS',
    custom: 'ADDITIONAL INFORMATION'
  };
  return titles[type] || type.toUpperCase();
}

/**
 * Format individual module based on type
 */
function formatModule(module) {
  switch (module.type) {
    case 'summary':
      return formatSummary(module.content);
    case 'experience':
      return formatExperience(module.content);
    case 'education':
      return formatEducation(module.content);
    case 'skills':
      return formatSkills(module.content);
    case 'certification':
      return formatCertification(module.content);
    case 'custom':
      return formatCustom(module.content);
    default:
      return null;
  }
}

/**
 * Format summary module
 */
function formatSummary(content) {
  return cleanText(content.text);
}

/**
 * Format experience module
 */
function formatExperience(content) {
  const lines = [];
  
  // Position and Company
  lines.push(`${content.position} - ${content.company}`);
  
  // Location and dates
  const details = [];
  if (content.location) details.push(content.location);
  details.push(`${formatDate(content.startDate)} - ${formatDate(content.endDate)}`);
  lines.push(details.join(' | '));
  
  // Achievements
  if (content.achievements && content.achievements.length > 0) {
    lines.push('');
    content.achievements.forEach(achievement => {
      if (achievement.trim()) {
        lines.push(`- ${cleanText(achievement)}`);
      }
    });
  }
  
  // Technologies
  if (content.technologies && content.technologies.length > 0) {
    const techs = content.technologies.filter(t => t.trim()).join(', ');
    if (techs) {
      lines.push('');
      lines.push(`Technologies: ${techs}`);
    }
  }
  
  return lines.join('\n');
}

/**
 * Format education module
 */
function formatEducation(content) {
  const lines = [];
  
  // Degree and Field
  lines.push(`${content.degree} in ${content.field}`);
  
  // Institution and dates
  lines.push(`${content.institution} | ${formatDate(content.startDate)} - ${formatDate(content.endDate)}`);
  
  // GPA
  if (content.gpa) {
    lines.push(`GPA: ${content.gpa}`);
  }
  
  // Honors
  if (content.honors && content.honors.length > 0) {
    const honors = content.honors.filter(h => h.trim()).join(', ');
    if (honors) {
      lines.push(`Honors: ${honors}`);
    }
  }
  
  return lines.join('\n');
}

/**
 * Format skills module
 */
function formatSkills(content) {
  if (!content.skills || content.skills.length === 0) {
    return null;
  }
  
  const skills = content.skills.filter(s => s.trim()).join(', ');
  if (!skills) return null;
  
  const category = content.category ? `${content.category.charAt(0).toUpperCase() + content.category.slice(1)}: ` : '';
  return `${category}${skills}`;
}

/**
 * Format certification module
 */
function formatCertification(content) {
  const lines = [];
  
  // Certification name
  lines.push(content.name);
  
  // Issuer and date
  const details = [content.issuer, formatDate(content.date)];
  if (content.expiryDate) {
    details.push(`Expires: ${formatDate(content.expiryDate)}`);
  }
  lines.push(details.join(' | '));
  
  // Credential ID
  if (content.credentialId) {
    lines.push(`Credential ID: ${content.credentialId}`);
  }
  
  return lines.join('\n');
}

/**
 * Format custom module
 */
function formatCustom(content) {
  const lines = [];
  
  if (content.title) {
    lines.push(content.title);
    lines.push('');
  }
  
  if (content.format === 'list' && Array.isArray(content.data)) {
    content.data.forEach(item => {
      if (item.trim()) {
        lines.push(`- ${cleanText(item)}`);
      }
    });
  } else if (typeof content.data === 'string') {
    lines.push(cleanText(content.data));
  }
  
  return lines.join('\n');
}

/**
 * Format date for ATS
 */
function formatDate(date) {
  if (!date) return '';
  if (date === 'Present') return 'Present';
  
  // Convert YYYY-MM to Month YYYY
  const [year, month] = date.split('-');
  if (!year) return date;
  
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const monthName = month ? months[parseInt(month) - 1] : '';
  
  return monthName ? `${monthName} ${year}` : year;
}

/**
 * Clean text for ATS compatibility
 * Remove special characters, formatting, and normalize whitespace
 */
function cleanText(text) {
  if (!text) return '';
  
  return text
    // Remove markdown formatting
    .replace(/\*\*(.+?)\*\*/g, '$1') // Bold
    .replace(/\*(.+?)\*/g, '$1') // Italic
    .replace(/\[(.+?)\]\(.+?\)/g, '$1') // Links
    // Remove special characters that might confuse ATS
    .replace(/[^\x00-\x7F]/g, '') // Non-ASCII
    .replace(/\t/g, ' ') // Tabs
    .replace(/\|/g, '-') // Pipes
    // Normalize whitespace
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Download ATS resume as text file
 * @param {Object} version - Resume version object
 * @param {Array} modules - Array of module objects
 * @param {Object} contactInfo - Contact information
 */
export function downloadATSResume(version, modules, contactInfo) {
  const atsText = generateATSResume(version, modules, contactInfo);
  const filename = `${version.name.replace(/[^a-z0-9]/gi, '_')}_ATS.txt`;
  
  const blob = new Blob([atsText], { type: 'text/plain' });
  const url = window.URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  window.URL.revokeObjectURL(url);
  document.body.removeChild(a);
}
