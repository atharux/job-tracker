# Implementation Plan

- [x] 1. Write bug condition exploration test
  - **Property 1: Fault Condition** - Race Condition on Initial Load
  - **CRITICAL**: This test MUST FAIL on unfixed code - failure confirms the bug exists
  - **DO NOT attempt to fix the test or the code when it fails**
  - **NOTE**: This test encodes the expected behavior - it will validate the fix when it passes after implementation
  - **GOAL**: Surface counterexamples that demonstrate the race condition bug exists
  - **Scoped PBT Approach**: Scope the property to the concrete failing case - user with existing gamification data (50 applications, earned points/rank) reopens the application
  - Test that when App component mounts with existing Supabase data, the initial render does NOT show default values (points: 0, rank: 'Newcomer')
  - The test assertions should verify that gamificationState is null or loading state until loadGamificationState() completes
  - Run test on UNFIXED code
  - **EXPECTED OUTCOME**: Test FAILS (this is correct - it proves the race condition exists)
  - Document counterexamples found: "Initial render shows points: 0, rank: 'Newcomer' instead of waiting for Supabase data"
  - Mark task complete when test is written, run, and failure is documented
  - _Requirements: 1.1, 1.2, 1.3, 1.4_

- [x] 2. Write preservation property tests (BEFORE implementing fix)
  - **Property 2: Preservation** - Non-Race-Condition Behavior
  - **IMPORTANT**: Follow observation-first methodology
  - Observe behavior on UNFIXED code for non-buggy scenarios:
    - New user login (no existing gamification data)
    - Point calculation on user actions (create application, update status)
    - Retroactive point calculation from existing applications
    - Supabase state persistence
    - Milestone detection and toast display
  - Write property-based tests capturing observed behavior patterns:
    - New users get initial state (points: 0, rank: 'Newcomer') created in Supabase
    - applyGamification() calculates points correctly (10 per app, 25 per interview, 50 per offer)
    - State updates persist to Supabase correctly
    - Milestone toasts display on state changes
  - Property-based testing generates many test cases for stronger guarantees
  - Run tests on UNFIXED code
  - **EXPECTED OUTCOME**: Tests PASS (this confirms baseline behavior to preserve)
  - Mark task complete when tests are written, run, and passing on unfixed code
  - _Requirements: 3.1, 3.2, 3.3, 3.4, 3.5_

- [ ] 3. Fix race condition in gamification state initialization

  - [x] 3.1 Implement the fix
    - Modify src/App.jsx state initialization
    - Change `const [gamificationState, setGamificationState] = useState(gamification.getInitialState());` to `const [gamificationState, setGamificationState] = useState(null);`
    - Ensure loadGamificationState() sets state after Supabase fetch completes
    - Add conditional rendering to wait for gamificationState to be non-null before displaying gamification UI
    - _Bug_Condition: isBugCondition(input) where user has existing gamification data AND component mounts AND gamificationState initializes to default values before Supabase load_
    - _Expected_Behavior: gamificationState initializes to null, waits for loadGamificationState() to complete, then renders with actual persisted values from Supabase_
    - _Preservation: New user initialization, point calculation, retroactive calculation, Supabase persistence, milestone detection all continue to work correctly_
    - _Requirements: 1.1, 1.2, 1.3, 1.4, 2.1, 2.2, 2.3, 2.4, 3.1, 3.2, 3.3, 3.4, 3.5_

  - [x] 3.2 Verify bug condition exploration test now passes
    - **Property 1: Expected Behavior** - No Default Values on Initial Render
    - **IMPORTANT**: Re-run the SAME test from task 1 - do NOT write a new test
    - The test from task 1 encodes the expected behavior
    - When this test passes, it confirms the race condition is fixed
    - Run bug condition exploration test from step 1
    - **EXPECTED OUTCOME**: Test PASSES (confirms bug is fixed - no default values shown during initial render)
    - _Requirements: 2.1, 2.2, 2.3, 2.4_

  - [x] 3.3 Verify preservation tests still pass
    - **Property 2: Preservation** - Non-Race-Condition Behavior Unchanged
    - **IMPORTANT**: Re-run the SAME tests from task 2 - do NOT write new tests
    - Run preservation property tests from step 2
    - **EXPECTED OUTCOME**: Tests PASS (confirms no regressions)
    - Confirm all tests still pass after fix:
      - New user initialization works correctly
      - Point calculation on actions works correctly
      - Retroactive calculation works correctly
      - Supabase persistence works correctly
      - Milestone detection works correctly

- [x] 4. Checkpoint - Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.
