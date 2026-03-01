/**
 * ATS-OPTIMIZED RESUME EXPORT
 * Plain text format with keyword optimization
 */

export function generateATSResume(modules, personalInfo = {}) {
  const lines = [];
  
  // Header
  if (personalInfo.name) {
    lines.push(personalInfo.name.toUpperCase());
    lines.push('');
  }
  
  if (personalInfo.email || personalInfo.phone) {
    const contact = [personalInfo.email, personalInfo.phone].filter(Boolean).join(' | ');
    lines.push(contact);
    lines.push('');
  }
  
  // Professional Summary
  if (modules.summary) {
    lines.push('PROFESSIONAL SUMMARY');
    lines.push('─'.repeat(50));
    lines.push(modules.summary);
    lines.push('');
  }
  
  // Experience
  if (modules.experience && modules.experience.length > 0) {
    lines.push('PROFESSIONAL EXPERIENCE');
    lines.push('─'.repeat(50));
    
    modules.experience.forEach(exp => {
      lines.push(`${exp.position} | ${exp.company}`);
      lines.push(exp.duration);
      
      if (exp.achievements && exp.achievements.length > 0) {
        exp.achievements.forEach(ach => {
          lines.push(`• ${ach}`);
        });
      }
      
      lines.push('');
    });
  }
  
  // Skills
  if (modules.skills) {
    lines.push('SKILLS');
    lines.push('─'.repeat(50));
    
    if (modules.skills.technical && modules.skills.technical.length > 0) {
      lines.push('Technical: ' + modules.skills.technical.join(' • '));
    }
    
    if (modules.skills.soft && modules.skills.soft.length > 0) {
      lines.push('Professional: ' + modules.skills.soft.join(' • '));
    }
    
    lines.push('');
  }
  
  // Education
  if (modules.education && modules.education.length > 0) {
    lines.push('EDUCATION');
    lines.push('─'.repeat(50));
    
    modules.education.forEach(edu => {
      lines.push(`${edu.degree} | ${edu.institution}`);
      if (edu.year) lines.push(edu.year);
      lines.push('');
    });
  }
  
  // Certifications
  if (modules.certifications && modules.certifications.length > 0) {
    lines.push('CERTIFICATIONS');
    lines.push('─'.repeat(50));
    modules.certifications.forEach(cert => {
      lines.push(`• ${cert}`);
    });
    lines.push('');
  }
  
  return lines.join('\n');
}

export function downloadATSResume(modules, personalInfo, filename = 'resume-ats.txt') {
  const content = generateATSResume(modules, personalInfo);
  const blob = new Blob([content], { type: 'text/plain' });
  const url = window.URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  window.URL.revokeObjectURL(url);
  document.body.removeChild(a);
}

