# Implementation Plan: Resume Builder & Manager

## Overview

This implementation plan breaks down the Resume Builder & Manager feature into discrete, incremental coding tasks. The plan follows a phased approach starting with MVP functionality (upload, parsing, module management, version management, ATS export) and progressively adding enhanced features. Each task builds on previous work, with checkpoints to validate progress.

The implementation uses React 18 + Vite for the frontend, Supabase PostgreSQL for the backend, and client-side processing for resume parsing and PDF generation.

## Tasks

- [x] 1. Set up database schema and backend infrastructure
  - Create Supabase migration file for resume_versions, resume_modules, and version_modules tables
  - Add resume_version_id column to applications table
  - Implement Row Level Security policies for all new tables
  - Create database indexes for performance optimization
  - _Requirements: 2.1, 2.2, 2.3, 2.5, 4.1, 4.2, 7.1_

- [ ]* 1.1 Write property test for module ID uniqueness
  - **Property 7: Module ID Uniqueness**
  - **Validates: Requirements 2.5**

- [x] 2. Create core TypeScript interfaces and types
  - Define Module, ResumeVersion, VersionModule interfaces
  - Define content type interfaces (ExperienceContent, EducationContent, SkillsContent, CustomContent, SummaryContent, CertificationContent)
  - Define ParsedResumeData, PDFTemplate, and KeywordAnalysis interfaces
  - Create type guards for module content validation
  - _Requirements: 2.1, 2.2, 2.3, 3.2_

- [x] 3. Implement file upload and validation
  - Create ResumeUploader component with drag-and-drop interface
  - Implement file type validation (PDF, DOCX, TXT only)
  - Implement file size validation (max 5MB)
  - Add loading states and error handling UI
  - Create FileReader integration for text extraction
  - _Requirements: 1.1, 1.3_

- [ ]* 3.1 Write unit tests for file upload validation
  - Test unsupported file format rejection
  - Test file size limit enforcement
  - Test successful file reading for each supported format
  - _Requirements: 1.1, 1.3_

- [ ]* 3.2 Write property test for unsupported format error handling
  - **Property 2: Unsupported Format Error Handling**
  - **Validates: Requirements 1.3**

- [x] 4. Implement backend proxy for AI resume parsing
  - Create serverless function endpoint /api/parse-resume
  - Integrate Claude API for resume parsing
  - Implement secure API key storage in environment variables
  - Add error handling and fallback logic
  - Create prompt template for structured resume extraction
  - _Requirements: 1.1, 1.2, 1.4_

- [ ]* 4.1 Write property test for multi-format resume parsing
  - **Property 1: Multi-Format Resume Parsing**
  - **Validates: Requirements 1.1, 1.2**

- [ ]* 4.2 Write property test for parsing fallback
  - **Property 3: Parsing Fallback to Manual Entry**
  - **Validates: Requirements 1.4**

- [ ]* 4.3 Write property test for original content preservation
  - **Property 4: Original Content Preservation**
  - **Validates: Requirements 1.5**

- [x] 5. Create module management system
  - Implement module CRUD operations with Supabase
  - Create ModuleCard component for displaying modules
  - Create ModuleLibrary component with grid/list view
  - Implement module type-specific rendering
  - Add module deletion with confirmation dialog
  - _Requirements: 2.1, 2.2, 2.3, 2.4, 2.5_

- [ ]* 5.1 Write property test for module data integrity
  - **Property 5: Module Data Integrity**
  - **Validates: Requirements 2.1, 2.2, 2.3**

- [ ]* 5.2 Write property test for default version creation
  - **Property 6: Default Version Creation**
  - **Validates: Requirements 2.4**

- [x] 6. Implement module editor
  - Create ModuleEditor component with form fields for each module type
  - Implement rich text formatting support (bold, italic, bullet points)
  - Add required field validation
  - Implement save/cancel functionality
  - Create module type selector for new modules
  - _Requirements: 3.1, 3.2, 3.3, 3.4, 3.5_

- [ ]* 6.1 Write property test for module content editability
  - **Property 8: Module Content Editability**
  - **Validates: Requirements 3.1**

- [ ]* 6.2 Write property test for required field validation
  - **Property 9: Required Field Validation**
  - **Validates: Requirements 3.2**

- [ ]* 6.3 Write property test for module update propagation
  - **Property 10: Module Update Propagation**
  - **Validates: Requirements 3.3**

- [ ]* 6.4 Write property test for rich text format preservation
  - **Property 11: Rich Text Format Preservation**
  - **Validates: Requirements 3.4**

- [x] 7. Checkpoint - Ensure module management works end-to-end
  - Verify file upload, parsing, module creation, and editing flow
  - Ensure all tests pass, ask the user if questions arise

- [x] 8. Implement resume version management
  - Create VersionManager component for creating/editing versions
  - Implement version CRUD operations with Supabase
  - Create version list view with names and last modified dates
  - Implement module selection interface for versions
  - Add version renaming functionality
  - Store module order in version configuration
  - _Requirements: 4.1, 4.2, 4.3, 4.5, 4.6_

- [ ]* 8.1 Write property test for module selection flexibility
  - **Property 12: Module Selection Flexibility**
  - **Validates: Requirements 4.2**

- [ ]* 8.2 Write property test for version list completeness
  - **Property 13: Version List Completeness**
  - **Validates: Requirements 4.3**

- [ ]* 8.3 Write property test for version deletion module preservation
  - **Property 15: Version Deletion Module Preservation**
  - **Validates: Requirements 4.5**

- [ ]* 8.4 Write property test for version renaming
  - **Property 16: Version Renaming**
  - **Validates: Requirements 4.6**

- [x] 9. Implement version cloning functionality
  - Add clone button to version list items
  - Implement clone logic to duplicate version with all modules
  - Append " Copy" to cloned version name
  - Open cloned version for editing after creation
  - _Requirements: 4.4, 8.1, 8.2, 8.3_

- [ ]* 9.1 Write property test for version cloning accuracy
  - **Property 14: Version Cloning Accuracy**
  - **Validates: Requirements 4.4, 8.1**

- [ ]* 9.2 Write property test for clone name differentiation
  - **Property 17: Clone Name Differentiation**
  - **Validates: Requirements 8.2**

- [x] 10. Implement ATS text export
  - Create ATSExporter utility function
  - Generate plain text with clear section headers
  - Implement standard section ordering (contact, summary, experience, education, skills)
  - Remove special characters and complex formatting
  - Implement file download with correct filename format
  - _Requirements: 5.1, 5.2, 5.3, 5.4, 5.5_

- [ ]* 10.1 Write property test for ATS format compliance
  - **Property 18: ATS Format Compliance**
  - **Validates: Requirements 5.1, 5.2**

- [ ]* 10.2 Write property test for ATS section ordering
  - **Property 19: ATS Section Ordering**
  - **Validates: Requirements 5.3**

- [ ]* 10.3 Write property test for export filename convention
  - **Property 20: Export Filename Convention**
  - **Validates: Requirements 5.4, 6.4**

- [ ]* 10.4 Write property test for export module completeness
  - **Property 21: Export Module Completeness**
  - **Validates: Requirements 5.5, 6.3**

- [x] 11. Integrate resume versions with application tracker
  - Add resume version selector to application creation/edit form
  - Display linked resume version name in application view
  - Add quick action to view/download linked resume
  - Handle deleted resume version references
  - Allow changing linked resume version for existing applications
  - _Requirements: 7.1, 7.2, 7.3, 7.4, 7.5_

- [ ]* 11.1 Write property test for resume version linking
  - **Property 24: Resume Version Linking**
  - **Validates: Requirements 7.1, 7.5**

- [ ]* 11.2 Write property test for linked resume display
  - **Property 25: Linked Resume Display**
  - **Validates: Requirements 7.2**

- [ ]* 11.3 Write property test for deleted resume reference handling
  - **Property 26: Deleted Resume Reference Handling**
  - **Validates: Requirements 7.4**

- [x] 12. Checkpoint - Ensure MVP functionality is complete
  - Test complete flow: upload → parse → edit modules → create version → export ATS → link to application
  - Ensure all tests pass, ask the user if questions arise

- [ ] 13. Install PDF generation dependencies
  - Add jspdf and jspdf-autotable to package.json
  - Install and configure dependencies
  - _Requirements: 6.1_

- [ ] 14. Implement PDF export with basic template
  - Create PDFExporter utility function using jsPDF
  - Implement basic template with consistent typography and spacing
  - Apply module content to PDF layout
  - Implement file download with correct filename format
  - Ensure PDF validity and cross-viewer compatibility
  - _Requirements: 6.1, 6.2, 6.3, 6.4, 6.5_

- [ ]* 14.1 Write property test for PDF generation validity
  - **Property 22: PDF Generation Validity**
  - **Validates: Requirements 6.1**

- [ ]* 14.2 Write property test for PDF formatting consistency
  - **Property 23: PDF Formatting Consistency**
  - **Validates: Requirements 6.2**

- [ ] 15. Implement resume template system
  - Create PDFTemplate interface and default templates
  - Create at least 5 industry-specific templates (Technology, Design, Business, Healthcare, Education)
  - Add template selector to version creation/editing
  - Apply template styling to PDF exports (fonts, colors, layout)
  - Allow template switching without losing content
  - _Requirements: 11.1, 11.2, 11.3, 11.4, 11.5_

- [ ]* 15.1 Write property test for template application to PDF
  - **Property 33: Template Application to PDF**
  - **Validates: Requirements 11.3, 11.5**

- [ ]* 15.2 Write property test for template switching content preservation
  - **Property 34: Template Switching Content Preservation**
  - **Validates: Requirements 11.4**

- [ ] 16. Implement keyword matching functionality
  - Create KeywordMatcher component with job description input
  - Implement keyword extraction algorithm (filter stop words, identify technical skills)
  - Compare extracted keywords against resume content
  - Display matched keywords with visual indicators
  - Display unmatched keywords with module suggestions
  - _Requirements: 9.1, 9.2, 9.3, 9.4, 9.5_

- [ ]* 16.1 Write property test for keyword extraction
  - **Property 27: Keyword Extraction**
  - **Validates: Requirements 9.1, 9.5**

- [ ]* 16.2 Write property test for keyword matching accuracy
  - **Property 28: Keyword Matching Accuracy**
  - **Validates: Requirements 9.2**

- [ ]* 16.3 Write property test for keyword visualization
  - **Property 29: Keyword Visualization**
  - **Validates: Requirements 9.3, 9.4**

- [ ] 17. Implement version comparison feature
  - Create VersionComparison component with side-by-side layout
  - Implement difference detection algorithm
  - Highlight modules present in only one version
  - Highlight modules with different content
  - Display difference count summary
  - Add copy module functionality between versions
  - _Requirements: 10.1, 10.2, 10.3, 10.4, 10.5_

- [ ]* 17.1 Write property test for comparison difference detection
  - **Property 30: Comparison Difference Detection**
  - **Validates: Requirements 10.2, 10.3**

- [ ]* 17.2 Write property test for comparison difference count
  - **Property 31: Comparison Difference Count**
  - **Validates: Requirements 10.4**

- [ ]* 17.3 Write property test for cross-version module copy
  - **Property 32: Cross-Version Module Copy**
  - **Validates: Requirements 10.5**

- [ ] 18. Implement resume completeness validation
  - Add validation check for critical sections (contact, experience, education)
  - Display warning message listing missing sections before export
  - Allow users to proceed with export despite warnings
  - Create completeness indicator for version view
  - Add quick links to add missing sections
  - _Requirements: 13.1, 13.2, 13.3, 13.4, 13.5_

- [ ]* 18.1 Write property test for export completeness validation
  - **Property 39: Export Completeness Validation**
  - **Validates: Requirements 13.1, 13.2**

- [ ]* 18.2 Write property test for export warning override
  - **Property 40: Export Warning Override**
  - **Validates: Requirements 13.3**

- [ ]* 18.3 Write property test for completeness indicator accuracy
  - **Property 41: Completeness Indicator Accuracy**
  - **Validates: Requirements 13.4**

- [ ] 19. Checkpoint - Ensure enhanced features are working
  - Test PDF export with templates, keyword matching, version comparison, and validation
  - Ensure all tests pass, ask the user if questions arise

- [ ] 20. Implement module reordering within versions
  - Add drag handles to module list in version editor
  - Implement drag-and-drop reordering functionality
  - Update module_order array on reorder
  - Preserve module order in exports
  - Implement module type grouping option
  - Set default placement for new modules (end of type group)
  - _Requirements: 14.1, 14.2, 14.3, 14.4, 14.5_

- [ ]* 20.1 Write property test for module order isolation
  - **Property 42: Module Order Isolation**
  - **Validates: Requirements 14.2**

- [ ]* 20.2 Write property test for export order preservation
  - **Property 43: Export Order Preservation**
  - **Validates: Requirements 14.3**

- [ ]* 20.3 Write property test for module type grouping
  - **Property 44: Module Type Grouping**
  - **Validates: Requirements 14.4**

- [ ]* 20.4 Write property test for new module default placement
  - **Property 45: New Module Default Placement**
  - **Validates: Requirements 14.5**

- [ ] 21. Implement module search and filtering
  - Add search input field to module library
  - Implement text-based search filtering
  - Add filter controls for module type
  - Add date range filter for experience and education modules
  - Display count of matching modules
  - Add "Add to version" button for filtered modules
  - _Requirements: 15.1, 15.2, 15.3, 15.4, 15.5_

- [ ]* 21.1 Write property test for module search filtering
  - **Property 46: Module Search Filtering**
  - **Validates: Requirements 15.1**

- [ ]* 21.2 Write property test for module type and date filtering
  - **Property 47: Module Type and Date Filtering**
  - **Validates: Requirements 15.2, 15.3, 15.4**

- [ ]* 21.3 Write property test for filtered module addition
  - **Property 48: Filtered Module Addition**
  - **Validates: Requirements 15.5**

- [ ] 22. Implement cover letter builder (future phase)
  - Create CoverLetterBuilder component
  - Implement cover letter CRUD operations with Supabase
  - Add resume version linking for cover letters
  - Create text editor with formatting options
  - Implement template variables (company name, position title)
  - Add export functionality for PDF and plain text formats
  - Store multiple cover letter versions
  - _Requirements: 12.1, 12.2, 12.3, 12.4, 12.5_

- [ ]* 22.1 Write property test for cover letter resume linking
  - **Property 35: Cover Letter Resume Linking**
  - **Validates: Requirements 12.1**

- [ ]* 22.2 Write property test for cover letter template variable substitution
  - **Property 36: Cover Letter Template Variable Substitution**
  - **Validates: Requirements 12.3**

- [ ]* 22.3 Write property test for cover letter multi-format export
  - **Property 37: Cover Letter Multi-Format Export**
  - **Validates: Requirements 12.4**

- [ ]* 22.4 Write property test for cover letter storage
  - **Property 38: Cover Letter Storage**
  - **Validates: Requirements 12.5**

- [ ] 23. Polish UI and integrate with existing theme
  - Apply cyberpunk theme classes to all new components
  - Ensure consistent styling with existing application
  - Add loading states and animations
  - Implement responsive design for mobile devices
  - Add keyboard navigation and accessibility features
  - Test color contrast and screen reader compatibility
  - _Requirements: All_

- [ ] 24. Final checkpoint - Complete end-to-end testing
  - Test all user flows from upload to export
  - Verify integration with application tracker
  - Test error handling and edge cases
  - Ensure all property tests and unit tests pass
  - Verify performance and responsiveness
  - Ask the user if questions arise or if ready for deployment

## Notes

- Tasks marked with `*` are optional property-based tests and can be skipped for faster MVP delivery
- Each task references specific requirements for traceability
- Checkpoints ensure incremental validation at key milestones
- Property tests validate universal correctness properties using fast-check library
- Unit tests validate specific examples and edge cases
- The implementation follows a phased approach: MVP (tasks 1-12) → Enhanced (tasks 13-19) → Advanced (tasks 20-24)
- All database operations use Supabase with Row Level Security for data protection
- Client-side processing minimizes server costs for parsing and PDF generation
