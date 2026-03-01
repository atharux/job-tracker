# Implementation Plan: Gamification Enhancements

## Overview

This plan implements celebration animations with flying unicorns and a competitive leaderboard system. The implementation follows a bottom-up approach: starting with core components, adding animations, integrating with the gamification engine, and finally wiring everything together. Testing tasks are included as optional sub-tasks to validate correctness properties.

## Tasks

- [x] 1. Set up component structure and shared types
  - Create `src/components/CelebrationAnimation.jsx` file
  - Create `src/components/Leaderboard.jsx` file
  - Create `src/components/UnicornSprite.jsx` file
  - Define TypeScript interfaces in JSDoc comments for props and data models
  - Start with emoji unicorn (🦄) for quick implementation, structure code to allow easy image swapping later
  - _Requirements: 1.1, 2.1, 3.3_

- [ ] 2. Implement UnicornSprite component
  - [x] 2.1 Create UnicornSprite with animation logic
    - Render unicorn emoji at specified start position
    - Apply CSS animation based on trajectory type (diagonal, arc, wave, straight)
    - Implement self-removal after animation completes
    - Use CSS transforms for GPU acceleration
    - _Requirements: 2.1, 2.2, 2.3, 6.1, 10.1_

  - [ ]* 2.2 Write property test for UnicornSprite position bounds
    - **Property 3: Unicorn Position Bounds**
    - **Validates: Requirements 2.1**

  - [ ]* 2.3 Write unit tests for UnicornSprite cleanup
    - Test that DOM element is removed after animation
    - Test that animation timers are cleared
    - _Requirements: 2.3, 6.1_

- [ ] 3. Implement celebration configuration logic
  - [x] 3.1 Create getCelebrationConfig function
    - Implement tier-based config selection (rank-up, achievement, standard)
    - Return appropriate unicorn count, duration, spawn interval, and trajectories
    - Ensure all configs have unicorn counts between 3-10
    - _Requirements: 5.1, 5.2, 5.3, 5.4, 5.5_

  - [ ]* 3.2 Write property test for celebration config validity
    - **Property 6: Unicorn Count Bounds**
    - **Property 13: Valid Trajectory Types**
    - **Validates: Requirements 5.5, 6.3, 5.4**

- [ ] 4. Implement CelebrationAnimation component
  - [x] 4.1 Create celebration trigger and spawn logic
    - Implement staggered unicorn spawning with configurable intervals
    - Track active unicorns in component state
    - Schedule cleanup for each unicorn after animation completes
    - Invoke onComplete callback after all unicorns finish
    - _Requirements: 1.1, 1.2, 1.3, 1.4, 1.5, 2.4, 2.5_

  - [ ]* 4.2 Write property test for celebration uniqueness
    - **Property 1: Celebration Uniqueness**
    - **Property 2: Callback Invocation Uniqueness**
    - **Validates: Requirements 1.1, 1.5**

  - [ ]* 4.3 Write property test for staggered spawn timing
    - **Property 4: Staggered Spawn Timing**
    - **Validates: Requirements 2.4**

  - [ ]* 4.4 Write property test for complete animation cleanup
    - **Property 5: Complete Animation Cleanup**
    - **Validates: Requirements 2.5, 6.1**

  - [x] 4.5 Implement navigation cleanup handler
    - Add useEffect cleanup to cancel animations on unmount
    - Remove all unicorn DOM elements
    - Clear all animation timers
    - _Requirements: 6.2, 6.5, 8.4_

- [x] 5. Checkpoint - Ensure celebration animations work
  - Ensure all tests pass, ask the user if questions arise.

- [ ] 6. Implement leaderboard data fetching
  - [x] 6.1 Create fetchLeaderboardData function
    - Query gamification_state table using Supabase client
    - Order results by points descending
    - Transform raw data into LeaderboardEntry objects with position values
    - Mark current user's entry with is_current_user flag
    - Handle query errors with descriptive error messages
    - _Requirements: 3.1, 3.2, 3.3, 3.4, 3.5, 7.3, 7.5_

  - [ ]* 6.2 Write property test for leaderboard ordering
    - **Property 7: Leaderboard Ordering Invariant**
    - **Validates: Requirements 3.2, 7.1**

  - [ ]* 6.3 Write property test for data transformation validity
    - **Property 8: Data Transformation Validity**
    - **Validates: Requirements 3.3**

  - [ ]* 6.4 Write property test for position consistency
    - **Property 9: Position Starts at One**
    - **Property 12: Position Consistency**
    - **Validates: Requirements 3.5, 4.3, 7.2**

  - [ ]* 6.5 Write property test for unique current user marking
    - **Property 14: Unique Current User Marking**
    - **Validates: Requirements 7.3**

  - [ ]* 6.6 Write property test for valid UUID format
    - **Property 15: Valid UUID Format**
    - **Validates: Requirements 7.5**

- [ ] 7. Implement Leaderboard component UI
  - [x] 7.1 Create Leaderboard component with data fetching
    - Fetch leaderboard data on component mount
    - Display loading indicator while fetching
    - Display error message with retry button on failure
    - Display empty state when no data available
    - _Requirements: 3.1, 3.4, 4.4, 4.5, 8.1_

  - [x] 7.2 Implement leaderboard entry rendering
    - Render each entry with position, rank badge, points, and streak days
    - Highlight current user's entry with distinct styling
    - Ensure only public fields are displayed (user_id, rank, points, streak_days)
    - _Requirements: 4.1, 4.2, 9.2_

  - [ ]* 7.3 Write property test for rendered fields completeness
    - **Property 10: Rendered Fields Completeness**
    - **Property 11: Current User Highlighting**
    - **Validates: Requirements 4.1, 4.2**

  - [ ]* 7.4 Write property test for data privacy field filtering
    - **Property 16: Data Privacy Field Filtering**
    - **Validates: Requirements 9.2**

- [ ] 8. Implement performance optimizations
  - [x] 8.1 Add leaderboard caching with 30-second TTL
    - Cache leaderboard data in component state or context
    - Implement timestamp-based cache invalidation
    - _Requirements: 10.2_

  - [x] 8.2 Add request debouncing for leaderboard refreshes
    - Debounce refresh requests to prevent excessive queries
    - _Requirements: 10.4_

  - [ ]* 8.3 Write property test for leaderboard caching behavior
    - **Property 17: Leaderboard Caching Behavior**
    - **Validates: Requirements 10.2**

  - [ ]* 8.4 Write property test for request debouncing
    - **Property 18: Request Debouncing**
    - **Validates: Requirements 10.4**

  - [x] 8.5 Add CSS optimizations for animations
    - Add will-change CSS property to animated elements
    - Ensure CSS transforms are used for all animations
    - _Requirements: 6.4, 10.1_

- [ ] 9. Integrate with existing gamification system
  - [x] 9.1 Connect CelebrationAnimation to milestone detection
    - Import CelebrationAnimation in main App component
    - Add state to track active celebration and milestone
    - Trigger celebration when GamificationEngine detects milestone
    - Filter milestones to only celebrate rank-up and achievement tiers
    - _Requirements: 1.1, 1.2, 1.3, 1.4_

  - [x] 9.2 Add Leaderboard route and navigation
    - Create new route for Leaderboard page
    - Add navigation link in app header or sidebar
    - Pass current user ID to Leaderboard component
    - _Requirements: 3.1, 4.2_

- [ ] 10. Add error handling and edge cases
  - [x] 10.1 Implement missing gamification_state initialization
    - Check if user's gamification_state exists before displaying leaderboard
    - Initialize default state if missing
    - Reload leaderboard after initialization
    - _Requirements: 7.4, 8.3_

  - [x] 10.2 Add performance degradation handling
    - Detect frame rate drops during animations (optional enhancement)
    - Reduce unicorn count for subsequent celebrations if needed
    - _Requirements: 8.2_

  - [ ]* 10.3 Write integration tests for error scenarios
    - Test leaderboard fetch failure and retry
    - Test celebration during navigation
    - Test missing gamification_state handling
    - _Requirements: 8.1, 8.3, 8.4_

- [x] 11. Final checkpoint - Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

## Notes

- Tasks marked with `*` are optional and can be skipped for faster MVP
- Each task references specific requirements for traceability
- Start with emoji unicorns (🦄) for quick implementation; code is structured to allow easy swapping to custom SVG/PNG images later
- Property tests validate universal correctness properties from the design document
- Unit tests validate specific examples and edge cases
- Checkpoints ensure incremental validation at key milestones
