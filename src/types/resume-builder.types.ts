/**
 * TypeScript type definitions for Resume Builder & Manager feature
 * These types correspond to the database schema in supabase/migrations/20240101000000_resume_builder_schema.sql
 */

// ========================================
// Database Table Types
// ========================================

/**
 * Resume Version - A named collection of modules representing a complete resume
 */
export interface ResumeVersion {
  id: string;
  user_id: string;
  name: string;
  template_id: string;
  created_at: string;
  updated_at: string;
}

/**
 * Resume Module - An individual resume component (experience, education, skills, etc.)
 */
export interface ResumeModule {
  id: string;
  user_id: string;
  type: ModuleType;
  content: ModuleContent;
  created_at: string;
  updated_at: string;
}

/**
 * Version Module Link - Junction table entry linking versions to modules
 */
export interface VersionModule {
  version_id: string;
  module_id: string;
  display_order: number;
  created_at: string;
}

// ========================================
// Module Types
// ========================================

export type ModuleType = 
  | 'experience' 
  | 'education' 
  | 'skills' 
  | 'custom' 
  | 'summary' 
  | 'certification';

export type ModuleContent = 
  | ExperienceContent 
  | EducationContent 
  | SkillsContent 
  | CustomContent 
  | SummaryContent 
  | CertificationContent;

// ========================================
// Module Content Types
// ========================================

/**
 * Experience Module Content
 */
export interface ExperienceContent {
  company: string;
  position: string;
  location?: string;
  startDate: string;
  endDate: string | 'Present';
  achievements: string[];
  technologies?: string[];
}

/**
 * Education Module Content
 */
export interface EducationContent {
  institution: string;
  degree: string;
  field: string;
  startDate: string;
  endDate: string;
  gpa?: string;
  honors?: string[];
}

/**
 * Skills Module Content
 */
export interface SkillsContent {
  category: string; // 'technical', 'soft', 'languages', 'tools'
  skills: string[];
}

/**
 * Custom Module Content
 */
export interface CustomContent {
  title: string;
  format: 'text' | 'list' | 'table';
  data: string | string[] | Record<string, string>[];
}

/**
 * Summary Module Content
 */
export interface SummaryContent {
  text: string;
}

/**
 * Certification Module Content
 */
export interface CertificationContent {
  name: string;
  issuer: string;
  date: string;
  expiryDate?: string;
  credentialId?: string;
}

// ========================================
// Insert Types (without auto-generated fields)
// ========================================

export type ResumeVersionInsert = Omit<ResumeVersion, 'id' | 'created_at' | 'updated_at'>;
export type ResumeModuleInsert = Omit<ResumeModule, 'id' | 'created_at' | 'updated_at'>;
export type VersionModuleInsert = Omit<VersionModule, 'created_at'>;

// ========================================
// Update Types (partial, without auto-generated fields)
// ========================================

export type ResumeVersionUpdate = Partial<Omit<ResumeVersion, 'id' | 'user_id' | 'created_at' | 'updated_at'>>;
export type ResumeModuleUpdate = Partial<Omit<ResumeModule, 'id' | 'user_id' | 'created_at' | 'updated_at'>>;

// ========================================
// Extended Types (with related data)
// ========================================

/**
 * Resume Version with its modules
 */
export interface ResumeVersionWithModules extends ResumeVersion {
  modules: ResumeModule[];
}

/**
 * Resume Version with module links
 */
export interface ResumeVersionWithLinks extends ResumeVersion {
  version_modules: VersionModule[];
}

// ========================================
// Application Types (extended)
// ========================================

/**
 * Application with linked resume version
 */
export interface ApplicationWithResume {
  id: number;
  user_id: string;
  company: string;
  position: string;
  status: string;
  resume_version_id?: string;
  resume_version?: ResumeVersion;
  created_at: string;
  updated_at: string;
}

// ========================================
// Export Types
// ========================================

export type ExportFormat = 'ats' | 'pdf';

export interface ExportOptions {
  format: ExportFormat;
  version: ResumeVersion;
  modules: ResumeModule[];
  template?: PDFTemplate;
}

export interface PDFTemplate {
  id: string;
  name: string;
  industry: string;
  fonts: {
    heading: string;
    body: string;
  };
  colors: {
    primary: string;
    secondary: string;
    text: string;
  };
  spacing: {
    sectionGap: number;
    lineHeight: number;
  };
}

// ========================================
// Parsed Resume Data (from upload)
// ========================================

export interface ParsedResumeData {
  filename: string;
  summary?: string;
  experience: ExperienceContent[];
  education: EducationContent[];
  skills: {
    technical?: string[];
    soft?: string[];
    languages?: string[];
    tools?: string[];
  };
  certifications?: CertificationContent[];
}

// ========================================
// Keyword Analysis Types
// ========================================

export interface KeywordAnalysis {
  matched: string[];
  unmatched: string[];
  suggestions: KeywordSuggestion[];
}

export interface KeywordSuggestion {
  keyword: string;
  suggestedModules: string[];
}

// ========================================
// Comparison Types
// ========================================

export interface VersionComparison {
  versionA: ResumeVersion;
  versionB: ResumeVersion;
  modulesOnlyInA: ResumeModule[];
  modulesOnlyInB: ResumeModule[];
  modulesInBoth: ResumeModule[];
  modulesDifferent: {
    moduleA: ResumeModule;
    moduleB: ResumeModule;
  }[];
}

// ========================================
// Validation Types
// ========================================

export interface ValidationResult {
  isValid: boolean;
  errors: string[];
  warnings: string[];
}

export interface CompletenessCheck {
  hasContactInfo: boolean;
  hasExperience: boolean;
  hasEducation: boolean;
  hasSkills: boolean;
  missingSections: string[];
}
