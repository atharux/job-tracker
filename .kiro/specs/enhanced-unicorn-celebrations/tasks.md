# Implementation Plan: Enhanced Unicorn Celebrations

## Overview

This implementation adds unicorn celebration animations for daily login welcome events and early application milestones (5 and 10 applications). The work is organized into four phases: database schema extension, gamification module enhancement, App.jsx integration, and comprehensive testing. All new milestones use the 'standard' tier configuration and integrate with the existing celebration queue system.

## Tasks

- [x] 1. Extend database schema for daily login tracking
  - Add `last_login_date` column to `gamification_state` table (type: DATE, nullable)
  - Verify column accepts NULL values for users who haven't logged in yet
  - _Requirements: 6.5_

- [x] 2. Implement gamification module enhancements
  - [x] 2.1 Add new milestone type constants and configurations
    - Add `WELCOME_LOGIN` and `FIVE_APPLICATIONS` constants to `MILESTONES` object
    - Add tier mappings to `MILESTONE_TIERS` (both use 'standard' tier)
    - Add message configurations to `MILESTONE_MESSAGES` with titles and messages
    - _Requirements: 1.3, 1.4, 2.2, 2.3, 7.1, 7.2, 7.3, 7.4, 7.5_

  - [x] 2.2 Implement checkDailyLogin function
    - Create function that compares last login date with current date
    - Normalize both dates to midnight in local timezone
    - Return true if dates differ or lastLoginDate is null
    - Handle edge cases (null input, invalid dates, future dates)
    - _Requirements: 1.1, 1.2, 6.1, 6.2, 6.3, 6.4_

  - [ ]* 2.3 Write property test for daily login detection
    - **Property 1: Daily login detection**
    - **Validates: Requirements 1.1, 1.2, 6.2, 6.3, 6.4**
    - Generate random date pairs and verify checkDailyLogin returns true iff dates are different days

  - [ ]* 2.4 Write property test for date normalization
    - **Property 10: Date normalization idempotence**
    - **Validates: Requirements 6.3**
    - Verify normalizing a date to midnight multiple times produces same result

  - [x] 2.5 Extend detectMilestones function
    - Add welcome login detection when `options.isDailyLogin` is true
    - Add five applications milestone detection when `applications.length === 5`
    - Preserve existing ten applications detection logic
    - Preserve existing rank-up detection logic
    - _Requirements: 1.1, 2.1, 3.1, 4.1, 7.5_

  - [ ]* 2.6 Write property tests for milestone detection
    - **Property 2: Welcome milestone triggering**
    - **Validates: Requirements 1.1, 7.5**
    - Verify WELCOME_LOGIN milestone appears when isDailyLogin flag is true
    
  - [ ]* 2.7 Write property tests for application milestones
    - **Property 4: Five applications milestone detection**
    - **Validates: Requirements 2.1, 7.5**
    - Verify FIVE_APPLICATIONS milestone appears when applications.length === 5
    - **Property 5: Ten applications milestone detection**
    - **Validates: Requirements 3.1**
    - Verify TEN_APPLICATIONS milestone appears when applications.length === 10
    - **Property 6: Application milestone uniqueness**
    - **Validates: Requirements 2.4, 3.4**
    - Verify milestones don't trigger when count exceeds threshold

  - [ ]* 2.8 Write property test for rank-up preservation
    - **Property 7: Rank-up milestone preservation**
    - **Validates: Requirements 4.1, 4.2, 4.3**
    - Verify rank-up milestones still trigger with correct tier when rank changes

  - [ ]* 2.9 Write property test for milestone tier mapping
    - **Property 3: Milestone tier mapping**
    - **Validates: Requirements 1.3, 2.2, 3.2, 4.2**
    - Verify all milestone types map to correct tiers in MILESTONE_TIERS

  - [ ]* 2.10 Write unit tests for gamification module
    - Test checkDailyLogin with same day, different day, null input, future date
    - Test detectMilestones with specific examples (5 apps, 10 apps, welcome login)
    - Test constant definitions exist and have correct values
    - Test message mappings have correct titles and messages
    - _Requirements: 1.4, 2.3, 3.3, 7.1, 7.2, 7.3, 7.4_

- [x] 3. Checkpoint - Ensure gamification module tests pass
  - Ensure all tests pass, ask the user if questions arise.

- [x] 4. Integrate daily login detection in App.jsx
  - [x] 4.1 Add daily login detection on user authentication
    - Load last_login_date from gamification_state in loadGamificationState()
    - Call checkDailyLogin to determine if this is first login of the day
    - Pass isDailyLogin flag to detectMilestones when calling it
    - _Requirements: 1.1, 1.2, 6.1, 6.2, 6.4_

  - [x] 4.2 Update celebration queue filtering
    - Modify celebration queue filter to include 'standard' tier milestones
    - Change filter from `m.tier === 'rank-up' || m.tier === 'achievement'` to include 'standard'
    - _Requirements: 1.5, 2.5, 3.5_

  - [ ]* 4.3 Write property tests for celebration queue
    - **Property 8: Multiple milestone queueing**
    - **Validates: Requirements 4.4, 5.1, 5.4**
    - Verify all detected milestones are added to queue in order
    - **Property 9: Celebration queue filtering**
    - **Validates: Requirements 1.5, 2.5, 3.5**
    - Verify standard, achievement, and rank-up tiers are included in queue

  - [x] 4.4 Add database update for last login date
    - Update last_login_date in gamification_state table after daily login check
    - Use current date in YYYY-MM-DD format
    - Handle database errors gracefully (log and continue)
    - _Requirements: 6.5_

  - [ ]* 4.5 Write unit tests for App.jsx integration
    - Test daily login detection triggers welcome celebration
    - Test celebration queue includes standard tier milestones
    - Test database update for last_login_date
    - Test multiple milestones queue correctly
    - _Requirements: 1.1, 1.5, 2.5, 3.5, 6.5_

- [x] 5. Checkpoint - Ensure integration tests pass
  - Ensure all tests pass, ask the user if questions arise.

- [x] 6. End-to-end validation and testing
  - [ ]* 6.1 Write integration tests for full celebration flows
    - Test login → welcome celebration flow
    - Test adding 5 applications → celebration flow
    - Test adding 10 applications → celebration flow
    - Test simultaneous milestones (5th app + rank up) queue correctly
    - _Requirements: 1.1, 2.1, 3.1, 4.4, 5.1, 5.2, 5.3, 5.4_

  - [ ]* 6.2 Write integration tests for database persistence
    - Test last_login_date persists across page reloads
    - Test welcome celebration doesn't repeat on same-day login
    - Test welcome celebration appears on next-day login
    - _Requirements: 1.2, 6.5_

  - [ ]* 6.3 Write edge case tests
    - Test timezone boundary cases (11:59 PM vs 12:01 AM)
    - Test leap year dates (February 29th)
    - Test first ever login (null last_login_date)
    - Test application count boundaries (4, 5, 6, 9, 10, 11)
    - _Requirements: 1.1, 1.2, 2.1, 2.4, 3.1, 3.4, 6.3_

- [x] 7. Final checkpoint - Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

## Notes

- Tasks marked with `*` are optional and can be skipped for faster MVP
- Each task references specific requirements for traceability
- Property-based tests use fast-check library with minimum 100 iterations
- All new milestones use 'standard' tier (3 unicorns, 2.5 second duration)
- Database schema change must be deployed before code changes
- Existing rank-up and achievement celebrations remain unchanged
