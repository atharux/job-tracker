# Implementation Plan: Resume Content Visualizer (MVP)

## Overview

This is a streamlined MVP implementation focused on getting a functional resume visualizer working within 1 hour. We're using React Flow for node visualization, skipping complex 3D layouts and advanced clustering, and focusing on core functionality: upload, parse, visualize, drag nodes, and create modules.

## Tasks

- [x] 1. Install React Flow dependency
  - Run: `npm install reactflow`
  - _Requirements: 3.1_

- [x] 2. Update header navigation
  - [x] 2.1 Remove emoji from existing header buttons
    - Remove 📋, 🏆, 📄 emojis from button text in App.jsx
    - Keep text labels only: "Applications", "Leaderboard", "Resume Builder"
    - _Requirements: N/A (UI polish)_
  
  - [x] 2.2 Add Resume Visualizer button to header
    - Add third button for "Resume Visualizer" view
    - Update currentView state to include 'visualizer' option
    - Add conditional rendering for visualizer view
    - _Requirements: 1.1, 3.1_

- [x] 3. Create basic ResumeVisualizer page component
  - [x] 3.1 Create ResumeVisualizer.jsx component file
    - Set up component structure with state management
    - Add file upload handler (reuse existing upload logic)
    - Include basic layout with upload area and canvas area
    - _Requirements: 1.1, 1.2, 9.1_
  
  - [x] 3.2 Integrate with existing resume parser
    - Import and use extractTextFromFile and parseResumeText from utils
    - Handle parsed resume data
    - _Requirements: 1.4, 2.1_

- [x] 4. Implement simple node visualization with React Flow
  - [x] 4.1 Set up React Flow canvas
    - Create ReactFlow component with basic configuration
    - Set up nodes and edges state
    - Configure viewport controls (zoom, pan)
    - _Requirements: 3.1, 3.2, 3.5_
  
  - [x] 4.2 Create ContentNode custom component
    - Build simple node component with type-based colors
    - Display content preview (truncated text)
    - Show node type badge
    - Add hover state for full content
    - _Requirements: 2.7, 3.1, 4.4_
  
  - [x] 4.3 Generate nodes from parsed resume
    - Convert parsed experience entries to nodes
    - Convert parsed education entries to nodes
    - Convert parsed skills to nodes
    - Assign initial positions (simple grid layout for MVP)
    - _Requirements: 2.1, 2.2, 2.3, 2.4, 2.5, 2.6, 2.8_

- [x] 5. Implement drag-and-drop functionality
  - [x] 5.1 Enable node dragging in React Flow
    - Configure nodesDraggable prop
    - Handle onNodesChange event
    - Persist node positions to state
    - _Requirements: 4.1, 4.3_
  
  - [x] 5.2 Add node selection
    - Enable node selection in React Flow
    - Handle onSelectionChange event
    - Visual highlight for selected nodes
    - _Requirements: 4.1, 4.2, 4.5_

- [x] 6. Implement module creation from selected nodes
  - [x] 6.1 Add "Create Module" button
    - Show button when nodes are selected
    - Validate all selected nodes have same type
    - Display error if types don't match
    - _Requirements: 7.1, 7.2_
  
  - [x] 6.2 Merge selected nodes into module
    - Combine node content into single module
    - Save module to database (resume_modules table)
    - Clear selection after module creation
    - Show success message
    - _Requirements: 7.3, 7.4, 7.5, 9.3_

- [x] 7. Add basic search and filter
  - [x] 7.1 Add search input
    - Create search bar component
    - Filter nodes by content text match
    - Highlight matching nodes
    - _Requirements: 6.1, 6.2_
  
  - [x] 7.2 Add type filter dropdown
    - Create filter dropdown for node types
    - Filter visible nodes by selected types
    - _Requirements: 6.3_

- [x] 8. Checkpoint - Test core functionality
  - Upload a resume and verify nodes are created
  - Drag nodes around the canvas
  - Select multiple nodes and create a module
  - Test search and filter
  - Ensure all tests pass, ask the user if questions arise

- [x] 9. Add node statistics display
  - Show total node count
  - Show count by type
  - Display color legend for node types
  - _Requirements: 11.1, 11.2, 11.5_

- [x] 10. Final polish and error handling
  - [x] 10.1 Add loading states
    - Show spinner during file processing
    - Show spinner during module creation
    - _Requirements: 1.1_
  
  - [x] 10.2 Add error messages
    - Handle file upload errors
    - Handle parsing failures
    - Handle module creation errors
    - _Requirements: 15.1, 15.2, 15.4_
  
  - [x] 10.3 Add empty states
    - Show helpful message when no nodes exist
    - Show message when no nodes match search
    - _Requirements: 1.5_

- [x] 11. Final checkpoint - Complete MVP validation
  - Test complete workflow: upload → visualize → drag → create module
  - Verify all error states work correctly
  - Ensure UI is responsive and intuitive
  - Ensure all tests pass, ask the user if questions arise

## Notes

- This MVP skips: 3D isometric layout, force-directed layout algorithm, clustering, Web Workers, version assembly, export functionality
- Focus is on core value: visual node manipulation and module creation
- Uses simple grid layout for initial node positioning
- React Flow handles most of the heavy lifting for canvas interactions
- All tasks reference specific requirements for traceability
- Database schema assumes resume_modules table exists (from existing ResumeBuilder)
- Reuses existing parsing logic from ResumeUploader component
- Target completion time: 1 hour for experienced developer

## Database Requirements

Assumes these tables exist:
- `resume_modules` - for storing created modules
- `resume_versions` - for storing resume versions (existing)

If content_nodes table is needed for persistence, it can be added post-MVP.
