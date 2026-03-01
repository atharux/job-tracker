# Requirements Document: Resume Content Visualizer

## Introduction

The Resume Content Visualizer transforms the linear resume upload experience into an interactive list-based card interface. Users upload resumes, see content parsed into color-coded module cards, select multiple cards, merge them, reclassify types, drag-and-drop to reorder, and export tailored resume versions. The system provides a clean two-panel interface for managing resume content with a cyberpunk aesthetic.

## Glossary

- **System**: The Resume Content Visualizer application
- **Parser**: The component that extracts and structures text from uploaded resume files
- **Module**: A visual card representation of a discrete piece of resume content (experience, skill, education, etc.)
- **Module Library**: The left panel displaying all available modules as cards
- **Assembly Panel**: The right panel for drag-and-drop resume assembly
- **Module Type**: The classification of a module (name, contact, summary, experience, education, skill, certification)
- **Merge**: Combining multiple selected modules into a single module
- **Reclassify**: Changing the type of an existing module
- **Format Help**: A modal guide showing users how to format TXT files for optimal parsing

## Requirements

### Requirement 1: Resume Upload and Parsing

**User Story:** As a user, I want to upload my resume file, so that the system can extract and visualize my content.

#### Acceptance Criteria

1. WHEN a user uploads a PDF, DOCX, or TXT file under 5MB, THE System SHALL extract the text content
2. WHEN the file type is unsupported, THE System SHALL display an error message and allow the user to upload a different file
3. WHEN the file exceeds 5MB, THE System SHALL reject the upload and display a size limit error
4. WHEN text extraction completes, THE Parser SHALL structure the content into resume sections (experience, education, skills, certifications, projects, summary)
5. IF text extraction fails, THEN THE System SHALL display a warning and provide an empty canvas with manual node creation capability

### Requirement 2: Content Parsing and Module Generation

**User Story:** As a user, I want my resume content automatically broken into visual module cards, so that I can see and manipulate individual pieces of content.

#### Acceptance Criteria

1. WHEN the Parser completes structuring, THE System SHALL create individual modules for each content piece
2. FOR each experience entry, THE System SHALL create one module containing the position, company, dates, and achievements
3. FOR each education entry, THE System SHALL create one module containing the degree, institution, and dates
4. FOR each skill category, THE System SHALL create one module containing the skills
5. FOR each certification, THE System SHALL create one module containing the certification name and issuer
6. FOR name and contact information, THE System SHALL create separate modules for each
7. WHEN creating modules, THE System SHALL assign a type-specific color to each module based on its content type
8. WHEN creating modules, THE System SHALL display them as cards in the Module Library

### Requirement 3: Module Card Visualization

**User Story:** As a user, I want to see my resume content as interactive module cards, so that I can understand and organize content visually.

#### Acceptance Criteria

1. WHEN modules are generated, THE Module Library SHALL display all modules as cards
2. WHEN rendering cards, THE System SHALL show a type badge with color coding
3. WHEN rendering cards, THE System SHALL display the module label (truncated content preview)
4. WHEN rendering cards, THE System SHALL show module details (dates, company, etc.)
5. WHEN a user hovers over a card, THE System SHALL maintain the current visual state
6. THE System SHALL support color-coded type badges: name (pink), contact (cyan), experience (blue), education (purple), skill (green), certification (orange), summary (pink)

### Requirement 4: Module Selection and Interaction

**User Story:** As a user, I want to interact with module cards through clicking and selection, so that I can organize and group content.

#### Acceptance Criteria

1. WHEN a user clicks a module card, THE System SHALL toggle that module's selection state
2. WHEN a module is selected, THE System SHALL display a checkmark in the checkbox
3. WHEN a module is selected, THE System SHALL apply visual highlighting (green border)
4. WHEN a user clicks "Select All", THE System SHALL select all visible modules
5. WHEN a user clicks "Deselect All", THE System SHALL clear all selections
6. WHEN modules are selected, THE System SHALL display bulk action buttons (Add to Resume, Merge, Delete)

### Requirement 5: Module Merging

**User Story:** As a user, I want to merge selected modules into a single module, so that I can combine split content.

#### Acceptance Criteria

1. WHEN a user selects 2 or more modules and clicks "Merge", THE System SHALL combine them into one module
2. WHEN merging modules of different types, THE System SHALL prompt for confirmation and use the first module's type
3. WHEN merging modules of the same type, THE System SHALL proceed without confirmation
4. WHEN a merge completes, THE System SHALL remove the original modules and add the merged module
5. WHEN a merge completes, THE System SHALL display a success message showing the count of merged modules

### Requirement 6: Search and Filter

**User Story:** As a user, I want to search and filter modules, so that I can quickly find specific content.

#### Acceptance Criteria

1. WHEN a user enters a search query, THE System SHALL filter modules by content text match
2. WHEN search results are returned, THE Module Library SHALL display only matching modules
3. WHEN a user selects a type filter, THE Module Library SHALL display only modules of the selected type
4. WHEN a user selects "All Types", THE Module Library SHALL display all modules
5. WHEN filters are cleared, THE Module Library SHALL restore all modules to visibility
6. THE System SHALL support filtering by: name, contact, summary, experience, education, skill, certification

### Requirement 7: Module Editing and Reclassification

**User Story:** As a user, I want to edit module content and reclassify module types, so that I can correct parsing errors.

#### Acceptance Criteria

1. WHEN a user clicks the edit button on a module, THE System SHALL open the edit modal
2. WHEN the edit modal opens, THE System SHALL display a type dropdown with all module types
3. WHEN the edit modal opens, THE System SHALL display the module content in JSON format
4. WHEN a user changes the type and saves, THE System SHALL update the module type
5. WHEN a user changes the content and saves, THE System SHALL update the module content
6. WHEN a user clicks cancel, THE System SHALL close the modal without saving changes
7. THE System SHALL support reclassifying to: name, contact, summary, experience, education, skill, certification

### Requirement 8: Resume Assembly with Drag-and-Drop

**User Story:** As a user, I want to assemble modules into a resume with drag-and-drop reordering, so that I can create tailored resumes.

#### Acceptance Criteria

1. WHEN a user selects modules and clicks "Add to Resume", THE System SHALL add them to the Assembly Panel
2. WHEN modules are added to the Assembly Panel, THE System SHALL display them in a vertical list
3. WHEN a user drags a module in the Assembly Panel, THE System SHALL show a drag preview
4. WHEN a user drops a module, THE System SHALL reorder the list
5. WHEN a user clicks the remove button, THE System SHALL remove that module from the assembly
6. WHEN a user clicks "Clear All", THE System SHALL remove all modules from the assembly
7. THE Assembly Panel SHALL display the count of assembled modules

### Requirement 9: Resume Preview and Export

**User Story:** As a user, I want to preview and export my assembled resume, so that I can submit it to job applications.

#### Acceptance Criteria

1. WHEN a user clicks "Preview Resume", THE System SHALL open a preview modal
2. WHEN the preview modal opens, THE System SHALL display the resume with professional formatting
3. WHEN displaying the preview, THE System SHALL group modules by type with section headers
4. WHEN a user clicks "Export as TXT", THE System SHALL generate a formatted text file
5. WHEN exporting, THE System SHALL include section headers (PROFESSIONAL SUMMARY, EXPERIENCE, EDUCATION, SKILLS, CERTIFICATIONS)
6. WHEN exporting, THE System SHALL format experience entries with position, company, dates, and bullet points
7. WHEN exporting, THE System SHALL format education entries with degree, institution, and dates
8. WHEN exporting, THE System SHALL format skills as a comma-separated list
9. WHEN export completes, THE System SHALL download the file with a timestamped filename

### Requirement 10: Format Help and User Guidance

**User Story:** As a user, I want guidance on formatting my TXT resume file, so that the parser can extract content accurately.

#### Acceptance Criteria

1. WHEN a user clicks "Format Help", THE System SHALL open the format help modal
2. WHEN the format help modal opens, THE System SHALL display recognized section headings
3. WHEN displaying format help, THE System SHALL show an example TXT resume format
4. WHEN displaying format help, THE System SHALL list all supported module types with color coding
5. WHEN displaying format help, THE System SHALL provide formatting tips
6. THE System SHALL recognize these headings: SUMMARY, PROFESSIONAL SUMMARY, OBJECTIVE, EXPERIENCE, WORK EXPERIENCE, EMPLOYMENT, EDUCATION, ACADEMIC BACKGROUND, SKILLS, TECHNICAL SKILLS, CORE COMPETENCIES, CERTIFICATIONS, CERTIFICATES, LICENSES
7. WHEN a user clicks "Got it!", THE System SHALL close the format help modal

### Requirement 11: Load from Builder

**User Story:** As a user, I want to load my existing resume modules from the Resume Builder, so that I can visualize and reorganize them.

#### Acceptance Criteria

1. WHEN a user clicks "Load from Builder", THE System SHALL query the database for existing resume modules
2. WHEN modules are loaded, THE System SHALL display them as cards in the Module Library
3. WHEN loading modules with array content, THE System SHALL flatten them into individual modules
4. WHEN loading modules, THE System SHALL preserve the module type and content
5. IF no modules exist, THE System SHALL display an empty state message

### Requirement 12: Manual Module Creation

**User Story:** As a user, I want to manually create new modules, so that I can add content not in my uploaded resume.

#### Acceptance Criteria

1. WHEN a user clicks "New Module", THE System SHALL open the new module modal
2. WHEN the new module modal opens, THE System SHALL display a type dropdown
3. WHEN the new module modal opens, THE System SHALL display a content textarea
4. WHEN a user enters content and clicks "Create", THE System SHALL add the new module to the Module Library
5. WHEN a user clicks "Cancel", THE System SHALL close the modal without creating a module
6. IF the content is empty, THE System SHALL display an error message and prevent creation

### Requirement 13: Module Deletion

**User Story:** As a user, I want to delete selected modules, so that I can remove unwanted content.

#### Acceptance Criteria

1. WHEN a user selects modules and clicks "Delete", THE System SHALL prompt for confirmation
2. WHEN the user confirms deletion, THE System SHALL remove the selected modules from the Module Library
3. WHEN the user cancels deletion, THE System SHALL keep the modules
4. WHEN modules are deleted, THE System SHALL clear the selection
5. THE System SHALL display the count of modules to be deleted in the confirmation prompt

### Requirement 14: Error Handling and User Feedback

**User Story:** As a user, I want clear error messages and feedback, so that I understand what's happening.

#### Acceptance Criteria

1. WHEN an error occurs during file upload, THE System SHALL display a specific error message
2. WHEN parsing fails, THE System SHALL show a warning and allow manual module creation
3. WHEN module creation fails due to empty content, THE System SHALL display an error message
4. WHEN merge is attempted with less than 2 modules, THE System SHALL display an error message
5. WHEN modules are successfully merged, THE System SHALL display a success message
6. WHEN a resume is exported, THE System SHALL display a success message with the filename

### Requirement 15: Empty States

**User Story:** As a user, I want helpful messages when there's no content, so that I know what to do next.

#### Acceptance Criteria

1. WHEN no modules exist, THE Module Library SHALL display an empty state with upload options
2. WHEN the empty state is shown, THE System SHALL display "Load from Builder" and "Upload Resume" buttons
3. WHEN no modules are in the Assembly Panel, THE System SHALL display a helpful message
4. WHEN search returns no results, THE System SHALL display a "no results" message
5. THE empty states SHALL provide clear next steps for the user


