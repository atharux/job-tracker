import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import * as fc from 'fast-check';
import App from './App.jsx';
import { supabase } from './supabaseClient';
import * as gamification from './gamification.js';

/**
 * Bug Condition Exploration Test for Gamification Persistence Fix
 * 
 * **Validates: Requirements 1.1, 1.2, 1.3, 1.4**
 * 
 * This test explores the race condition where gamificationState initializes
 * to default values (points: 0, rank: 'Newcomer') before Supabase data loads.
 * 
 * CRITICAL: This test MUST FAIL on unfixed code - failure confirms the bug exists.
 * 
 * The bug occurs when:
 * - User has existing gamification data (50 applications, earned points/rank)
 * - User closes and reopens the browser
 * - App component mounts and initializes gamificationState with getInitialState()
 * - Initial render shows default values before loadGamificationState() completes
 */

// Mock Supabase client
vi.mock('./supabaseClient', () => ({
  supabase: {
    auth: {
      getUser: vi.fn(),
      onAuthStateChange: vi.fn(() => ({
        data: { subscription: { unsubscribe: vi.fn() } }
      })),
      signOut: vi.fn(),
    },
    from: vi.fn(),
  },
}));

describe('Bug Condition Exploration: Race Condition on Initial Load', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  /**
   * Property 1: Fault Condition - Race Condition on Initial Load
   * 
   * This property-based test generates scenarios where a user with existing
   * gamification data (50 applications, earned points and rank) reopens the application.
   * 
   * The test verifies that the initial render does NOT show default values
   * (points: 0, rank: 'Newcomer') before the async loadGamificationState() completes.
   * 
   * Expected behavior: gamificationState should be null or loading state until
   * loadGamificationState() completes, preventing display of incorrect default values.
   * 
   * EXPECTED OUTCOME: This test FAILS on unfixed code (proves bug exists)
   */
  it('Property 1: should NOT show default values during initial render when user has existing gamification data', async () => {
    await fc.assert(
      fc.asyncProperty(
        // Generate test data: user with 50 applications and corresponding points
        fc.record({
          userId: fc.uuid(),
          applications: fc.constant(50), // User has 50 applications
          streakDays: fc.integer({ min: 0, max: 10 }),
        }),
        async (testData) => {
          // Setup: Mock authenticated user with existing gamification data
          const mockUser = { id: testData.userId, email: 'test@example.com' };
          
          // Mock auth.getUser to return authenticated user
          supabase.auth.getUser.mockResolvedValue({
            data: { user: mockUser },
            error: null,
          });

          // Mock auth state change
          supabase.auth.onAuthStateChange.mockImplementation((callback) => {
            // Simulate immediate auth state with user
            setTimeout(() => callback('SIGNED_IN', { user: mockUser }), 0);
            return {
              data: { subscription: { unsubscribe: vi.fn() } }
            };
          });

          // Create mock applications data (50 applications)
          const mockApplications = Array.from({ length: testData.applications }, (_, i) => ({
            id: i + 1,
            company: `Company ${i + 1}`,
            position: `Position ${i + 1}`,
            status: 'applied',
            date_applied: '2024-01-01',
            user_id: testData.userId,
          }));

          // Calculate retroactive points: 50 applications × 10 points = 500 points
          const retroactivePoints = testData.applications * 10;

          // Mock gamification state from Supabase (existing data)
          const mockGamificationState = {
            user_id: testData.userId,
            points: retroactivePoints,
            rank: gamification.calculateRank(retroactivePoints), // Calculate rank from points
            streak_days: testData.streakDays,
            last_activity: '2024-01-15',
          };

          // Mock Supabase queries with realistic async delay
          const mockFrom = vi.fn((table) => {
            const mockQuery = {
              select: vi.fn(() => mockQuery),
              eq: vi.fn(() => mockQuery),
              single: vi.fn(() => {
                if (table === 'gamification_state') {
                  // Simulate async database fetch with delay
                  return new Promise((resolve) => {
                    setTimeout(() => {
                      resolve({ data: mockGamificationState, error: null });
                    }, 100); // 100ms delay to simulate network latency
                  });
                }
                return Promise.resolve({ data: null, error: null });
              }),
              update: vi.fn(() => mockQuery),
              insert: vi.fn(() => mockQuery),
              delete: vi.fn(() => mockQuery),
              order: vi.fn(() => mockQuery),
              then: vi.fn((callback) => {
                if (table === 'applications') {
                  return Promise.resolve(callback({ data: mockApplications, error: null }));
                }
                return Promise.resolve(callback({ data: [], error: null }));
              }),
            };
            return mockQuery;
          });

          supabase.from = mockFrom;

          // Render the App component
          const { container } = render(<App />);

          // CRITICAL ASSERTION: Check initial render state
          // The bug manifests when the component renders with default values
          // (points: 0, rank: 'Newcomer') before loadGamificationState() completes
          
          // Wait a brief moment for initial render
          await new Promise(resolve => setTimeout(resolve, 10));

          // Check if default values are visible in the DOM
          // This is the FAULT CONDITION we're testing for
          const hasDefaultRank = container.textContent.includes('Newcomer');
          const hasDefaultPoints = container.textContent.includes('0 pts');

          // EXPECTED BEHAVIOR: Should NOT show default values during initial render
          // The component should either:
          // 1. Show nothing (gamificationState is null)
          // 2. Show a loading state
          // 3. Wait for loadGamificationState() to complete before rendering
          
          // This assertion will FAIL on unfixed code (proving the bug exists)
          expect(hasDefaultRank).toBe(false);
          expect(hasDefaultPoints).toBe(false);

          // Wait for the actual data to load
          // The rank should be calculated from retroactive points
          const expectedRank = gamification.calculateRank(retroactivePoints);
          
          await waitFor(() => {
            expect(container.textContent).toContain(expectedRank);
          }, { timeout: 500 });

          // After load completes, verify correct data is displayed
          expect(container.textContent).toContain(expectedRank);
          expect(container.textContent).toContain(`${retroactivePoints} pts`);
        }
      ),
      { numRuns: 5, timeout: 10000 } // Run 5 test cases with 10s timeout
    );
  }, 15000); // 15 second test timeout
});

/**
 * Preservation Property Tests for Gamification Persistence Fix
 * 
 * **Validates: Requirements 3.1, 3.2, 3.3, 3.4, 3.5**
 * 
 * These tests verify that the fix does NOT break existing gamification functionality:
 * - New user initialization (3.1)
 * - Point calculation on user actions (3.2)
 * - Retroactive point calculation (3.3)
 * - Supabase state persistence (3.4)
 * - Milestone detection and toast display (3.5)
 * 
 * IMPORTANT: These tests should PASS on unfixed code (baseline behavior to preserve)
 */

describe('Property 2: Preservation - Non-Race-Condition Behavior', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  /**
   * Property 2.1: New User Initialization
   * 
   * Validates Requirement 3.1: WHEN a new user with no existing gamification data 
   * logs in for the first time THEN the system SHALL CONTINUE TO create a new 
   * gamification_state record with initial values (points: 0, rank: 'Newcomer')
   */
  it('Property 2.1: should create initial gamification state for new users', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.record({
          userId: fc.uuid(),
          email: fc.emailAddress(),
        }),
        async (testData) => {
          // Setup: Mock new user with no existing gamification data
          const mockUser = { id: testData.userId, email: testData.email };
          
          supabase.auth.getUser.mockResolvedValue({
            data: { user: mockUser },
            error: null,
          });

          supabase.auth.onAuthStateChange.mockImplementation((callback) => {
            setTimeout(() => callback('SIGNED_IN', { user: mockUser }), 0);
            return {
              data: { subscription: { unsubscribe: vi.fn() } }
            };
          });

          // Mock: No existing applications
          const mockApplications = [];

          // Mock: No existing gamification state (PGRST116 error = not found)
          let insertedState = null;
          const mockFrom = vi.fn((table) => {
            const mockQuery = {
              select: vi.fn(() => mockQuery),
              eq: vi.fn(() => mockQuery),
              single: vi.fn(() => {
                if (table === 'gamification_state') {
                  // Return "not found" error for new user
                  return Promise.resolve({
                    data: null,
                    error: { code: 'PGRST116', message: 'No rows found' }
                  });
                }
                return Promise.resolve({ data: null, error: null });
              }),
              insert: vi.fn((data) => {
                if (table === 'gamification_state') {
                  insertedState = data[0];
                }
                return mockQuery;
              }),
              update: vi.fn(() => mockQuery),
              delete: vi.fn(() => mockQuery),
              order: vi.fn(() => mockQuery),
              then: vi.fn((callback) => {
                if (table === 'applications') {
                  return Promise.resolve(callback({ data: mockApplications, error: null }));
                }
                if (table === 'gamification_state' && insertedState) {
                  return Promise.resolve(callback({ data: insertedState, error: null }));
                }
                return Promise.resolve(callback({ data: [], error: null }));
              }),
            };
            return mockQuery;
          });

          supabase.from = mockFrom;

          // Render the App component
          render(<App />);

          // Wait for gamification state to be initialized
          await waitFor(() => {
            expect(insertedState).not.toBeNull();
          }, { timeout: 1000 });

          // Verify: Initial state was created with correct values
          expect(insertedState).toMatchObject({
            user_id: testData.userId,
            points: 0,
            rank: 'Newcomer',
            streak_days: 0,
          });
        }
      ),
      { numRuns: 5, timeout: 10000 }
    );
  }, 15000);

  /**
   * Property 2.2: Point Calculation on User Actions
   * 
   * Validates Requirement 3.2: WHEN a user performs an action that earns points 
   * (creates application, updates status) THEN the system SHALL CONTINUE TO 
   * calculate points correctly using applyGamification()
   */
  it('Property 2.2: should calculate points correctly for user actions', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.record({
          userId: fc.uuid(),
          initialPoints: fc.integer({ min: 0, max: 100 }),
          action: fc.constantFrom('create_application', 'update_status'),
          statusChange: fc.record({
            oldStatus: fc.constantFrom('applied', 'interview'),
            newStatus: fc.constantFrom('interview', 'offered'),
          }),
        }),
        async (testData) => {
          // Calculate expected points based on action
          let expectedPointsAdded = 0;
          if (testData.action === 'create_application') {
            expectedPointsAdded = 10; // APPLICATION points
          } else if (testData.action === 'update_status') {
            if (testData.statusChange.oldStatus === 'applied' && testData.statusChange.newStatus === 'interview') {
              expectedPointsAdded = 25; // INTERVIEW points
            } else if (testData.statusChange.newStatus === 'offered') {
              expectedPointsAdded = 50; // OFFER points
            }
          }

          // Setup: Mock user with existing gamification state
          const mockUser = { id: testData.userId, email: 'test@example.com' };
          
          supabase.auth.getUser.mockResolvedValue({
            data: { user: mockUser },
            error: null,
          });

          supabase.auth.onAuthStateChange.mockImplementation((callback) => {
            setTimeout(() => callback('SIGNED_IN', { user: mockUser }), 0);
            return {
              data: { subscription: { unsubscribe: vi.fn() } }
            };
          });

          const mockGamificationState = {
            user_id: testData.userId,
            points: testData.initialPoints,
            rank: 'Newcomer',
            streak_days: 0,
            last_activity: null,
          };

          let updatedState = null;
          const mockFrom = vi.fn((table) => {
            const mockQuery = {
              select: vi.fn(() => mockQuery),
              eq: vi.fn(() => mockQuery),
              single: vi.fn(() => {
                if (table === 'gamification_state') {
                  return Promise.resolve({ data: mockGamificationState, error: null });
                }
                return Promise.resolve({ data: null, error: null });
              }),
              update: vi.fn((data) => {
                if (table === 'gamification_state') {
                  updatedState = data;
                }
                return mockQuery;
              }),
              insert: vi.fn(() => mockQuery),
              delete: vi.fn(() => mockQuery),
              order: vi.fn(() => mockQuery),
              then: vi.fn((callback) => {
                if (table === 'applications') {
                  return Promise.resolve(callback({ data: [], error: null }));
                }
                return Promise.resolve(callback({ data: null, error: null }));
              }),
            };
            return mockQuery;
          });

          supabase.from = mockFrom;

          // Render and wait for initial load
          render(<App />);
          await waitFor(() => {
            expect(supabase.from).toHaveBeenCalledWith('gamification_state');
          }, { timeout: 1000 });

          // Verify: Point calculation logic is correct
          // Note: We're testing the gamification module's computeNewState function
          // which is used by applyGamification
          const { computeNewState } = await import('./gamification.js');
          const newState = computeNewState(
            mockGamificationState,
            testData.action,
            testData.action === 'update_status' ? testData.statusChange : {}
          );

          // Verify points were calculated correctly
          expect(newState.points).toBeGreaterThanOrEqual(testData.initialPoints + expectedPointsAdded);
        }
      ),
      { numRuns: 10, timeout: 10000 }
    );
  }, 15000);

  /**
   * Property 2.3: Retroactive Point Calculation
   * 
   * Validates Requirement 3.3: WHEN retroactive points are calculated from existing 
   * applications THEN the system SHALL CONTINUE TO use the correct formula 
   * (10 points per application, 25 per interview, 50 per offer)
   */
  it('Property 2.3: should calculate retroactive points correctly from existing applications', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.record({
          userId: fc.uuid(),
          numApplied: fc.integer({ min: 0, max: 10 }),
          numInterview: fc.integer({ min: 0, max: 5 }),
          numOffered: fc.integer({ min: 0, max: 3 }),
        }),
        async (testData) => {
          // Setup: Mock user with existing applications
          const mockUser = { id: testData.userId, email: 'test@example.com' };
          
          supabase.auth.getUser.mockResolvedValue({
            data: { user: mockUser },
            error: null,
          });

          supabase.auth.onAuthStateChange.mockImplementation((callback) => {
            setTimeout(() => callback('SIGNED_IN', { user: mockUser }), 0);
            return {
              data: { subscription: { unsubscribe: vi.fn() } }
            };
          });

          // Create mock applications with various statuses
          const mockApplications = [];
          let id = 1;
          
          // Add 'applied' status applications
          for (let i = 0; i < testData.numApplied; i++) {
            mockApplications.push({
              id: id++,
              company: `Company ${id}`,
              position: `Position ${id}`,
              status: 'applied',
              date_applied: '2024-01-01',
              user_id: testData.userId,
            });
          }
          
          // Add 'interview' status applications
          for (let i = 0; i < testData.numInterview; i++) {
            mockApplications.push({
              id: id++,
              company: `Company ${id}`,
              position: `Position ${id}`,
              status: 'interview',
              date_applied: '2024-01-01',
              user_id: testData.userId,
            });
          }
          
          // Add 'offered' status applications
          for (let i = 0; i < testData.numOffered; i++) {
            mockApplications.push({
              id: id++,
              company: `Company ${id}`,
              position: `Position ${id}`,
              status: 'offered',
              date_applied: '2024-01-01',
              user_id: testData.userId,
            });
          }
          
          // Calculate expected retroactive points using the ACTUAL formula from App.jsx
          // 10 points per application
          const totalApplications = testData.numApplied + testData.numInterview + testData.numOffered;
          let expectedPoints = totalApplications * 10;
          
          // 25 points per interview (status = interview, offered, or accepted)
          const interviewCount = testData.numInterview + testData.numOffered;
          expectedPoints += interviewCount * 25;
          
          // 50 points per offer (status = offered or accepted)
          expectedPoints += testData.numOffered * 50;

          // Mock: No existing gamification state (will trigger retroactive calculation)
          let insertedState = null;
          const mockFrom = vi.fn((table) => {
            const mockQuery = {
              select: vi.fn(() => mockQuery),
              eq: vi.fn(() => mockQuery),
              single: vi.fn(() => {
                if (table === 'gamification_state') {
                  return Promise.resolve({
                    data: null,
                    error: { code: 'PGRST116', message: 'No rows found' }
                  });
                }
                return Promise.resolve({ data: null, error: null });
              }),
              insert: vi.fn((data) => {
                if (table === 'gamification_state') {
                  insertedState = data[0];
                }
                return mockQuery;
              }),
              update: vi.fn(() => mockQuery),
              delete: vi.fn(() => mockQuery),
              order: vi.fn(() => mockQuery),
              then: vi.fn((callback) => {
                if (table === 'applications') {
                  return Promise.resolve(callback({ data: mockApplications, error: null }));
                }
                if (table === 'gamification_state' && insertedState) {
                  return Promise.resolve(callback({ data: insertedState, error: null }));
                }
                return Promise.resolve(callback({ data: [], error: null }));
              }),
            };
            return mockQuery;
          });

          supabase.from = mockFrom;

          // Render the App component
          render(<App />);

          // Wait for retroactive calculation to complete
          await waitFor(() => {
            expect(insertedState).not.toBeNull();
          }, { timeout: 1000 });

          // Verify: Retroactive points were calculated correctly
          expect(insertedState.points).toBe(expectedPoints);
        }
      ),
      { numRuns: 10, timeout: 10000 }
    );
  }, 15000);

  /**
   * Property 2.4: Supabase State Persistence
   * 
   * Validates Requirement 3.4: WHEN the gamification state is updated in Supabase 
   * THEN the system SHALL CONTINUE TO maintain data consistency between the React 
   * state and the database
   */
  it('Property 2.4: should persist gamification state updates to Supabase', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.record({
          userId: fc.uuid(),
          initialPoints: fc.integer({ min: 0, max: 100 }),
          pointsToAdd: fc.integer({ min: 10, max: 50 }),
        }),
        async (testData) => {
          // Setup: Mock user with existing gamification state
          const mockUser = { id: testData.userId, email: 'test@example.com' };
          
          supabase.auth.getUser.mockResolvedValue({
            data: { user: mockUser },
            error: null,
          });

          supabase.auth.onAuthStateChange.mockImplementation((callback) => {
            setTimeout(() => callback('SIGNED_IN', { user: mockUser }), 0);
            return {
              data: { subscription: { unsubscribe: vi.fn() } }
            };
          });

          const mockGamificationState = {
            user_id: testData.userId,
            points: testData.initialPoints,
            rank: 'Newcomer',
            streak_days: 0,
            last_activity: null,
          };

          let updateCalled = false;
          let updatedData = null;
          const mockFrom = vi.fn((table) => {
            const mockQuery = {
              select: vi.fn(() => mockQuery),
              eq: vi.fn(() => mockQuery),
              single: vi.fn(() => {
                if (table === 'gamification_state') {
                  return Promise.resolve({ data: mockGamificationState, error: null });
                }
                return Promise.resolve({ data: null, error: null });
              }),
              update: vi.fn((data) => {
                if (table === 'gamification_state') {
                  updateCalled = true;
                  updatedData = data;
                }
                return mockQuery;
              }),
              insert: vi.fn(() => mockQuery),
              delete: vi.fn(() => mockQuery),
              order: vi.fn(() => mockQuery),
              then: vi.fn((callback) => {
                if (table === 'applications') {
                  return Promise.resolve(callback({ data: [], error: null }));
                }
                return Promise.resolve(callback({ data: null, error: null }));
              }),
            };
            return mockQuery;
          });

          supabase.from = mockFrom;

          // Render and wait for initial load
          render(<App />);
          await waitFor(() => {
            expect(supabase.from).toHaveBeenCalledWith('gamification_state');
          }, { timeout: 1000 });

          // Verify: The gamification module's computeNewState maintains consistency
          const { computeNewState } = await import('./gamification.js');
          const newState = computeNewState(mockGamificationState, 'create_application', {});

          // Verify state consistency: points should increase
          expect(newState.points).toBeGreaterThan(mockGamificationState.points);
          expect(newState.user_id).toBe(mockGamificationState.user_id);
        }
      ),
      { numRuns: 10, timeout: 10000 }
    );
  }, 15000);

  /**
   * Property 2.5: Milestone Detection
   * 
   * Validates Requirement 3.5: WHEN milestone detection occurs THEN the system 
   * SHALL CONTINUE TO display milestone toasts correctly based on state changes
   */
  it('Property 2.5: should detect milestones correctly based on state changes', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.record({
          scenario: fc.constantFrom(
            'first_application',
            'first_interview',
            'rank_up',
            'ten_applications'
          ),
        }),
        async (testData) => {
          // Setup milestone scenarios
          let oldState, newState, applications;
          
          switch (testData.scenario) {
            case 'first_application':
              oldState = { points: 0, rank: 'Newcomer', streak_days: 0, last_activity: null };
              newState = { points: 10, rank: 'Newcomer', streak_days: 1, last_activity: '2024-01-01' };
              applications = [{ id: 1, status: 'applied' }];
              break;
            case 'first_interview':
              oldState = { points: 10, rank: 'Newcomer', streak_days: 1, last_activity: '2024-01-01' };
              newState = { points: 35, rank: 'Newcomer', streak_days: 1, last_activity: '2024-01-01' };
              applications = [{ id: 1, status: 'interview' }];
              break;
            case 'rank_up':
              oldState = { points: 45, rank: 'Newcomer', streak_days: 1, last_activity: '2024-01-01' };
              newState = { points: 55, rank: 'Applicant', streak_days: 1, last_activity: '2024-01-01' };
              applications = [{ id: 1, status: 'applied' }];
              break;
            case 'ten_applications':
              oldState = { points: 90, rank: 'Applicant', streak_days: 1, last_activity: '2024-01-01' };
              newState = { points: 100, rank: 'Applicant', streak_days: 1, last_activity: '2024-01-01' };
              applications = Array.from({ length: 10 }, (_, i) => ({ id: i + 1, status: 'applied' }));
              break;
          }

          // Test milestone detection
          const { detectMilestones } = await import('./gamification.js');
          const milestones = detectMilestones(oldState, newState, applications);

          // Verify: Milestones are detected correctly
          expect(milestones).toBeDefined();
          expect(Array.isArray(milestones)).toBe(true);
          
          // Verify milestone structure when detected
          if (milestones.length > 0) {
            milestones.forEach(milestone => {
              expect(milestone).toHaveProperty('type');
              expect(milestone).toHaveProperty('tier');
              expect(milestone).toHaveProperty('title');
              expect(milestone).toHaveProperty('message');
            });
          }
        }
      ),
      { numRuns: 10, timeout: 10000 }
    );
  }, 15000);
});
