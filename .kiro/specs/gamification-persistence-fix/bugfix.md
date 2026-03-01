# Bugfix Requirements Document

## Introduction

The gamification system in the job tracker application fails to persist user progress across browser sessions. Users who have recorded 50 applications and earned corresponding points, achievements, and rank are incorrectly shown as "Newcomer" (the initial rank) when they close and reopen the browser. This occurs because the gamification state is initialized to default values in React component state before the Supabase data is loaded, and the component renders with these default values.

The root cause is a race condition in the component lifecycle: `gamificationState` is initialized with `gamification.getInitialState()` (which returns points: 0, rank: 'Newcomer') in the component's state declaration, and this default state is used for rendering before `loadGamificationState()` completes its async database fetch.

## Bug Analysis

### Current Behavior (Defect)

1.1 WHEN a user with existing gamification data (50 applications, earned points and rank) closes the browser and reopens the application THEN the system displays the default "Newcomer" rank and 0 points instead of their actual persisted rank and points

1.2 WHEN the `App` component mounts and initializes `gamificationState` with `gamification.getInitialState()` THEN the system sets the state to default values (points: 0, rank: 'Newcomer') before the async `loadGamificationState()` function completes

1.3 WHEN `loadGamificationState()` successfully fetches data from Supabase THEN the system updates the state, but the user has already seen the incorrect default values during the initial render

1.4 WHEN a user has 50 applications in the database THEN the system should calculate retroactive points (500 points minimum for 50 applications) but displays 0 points on initial load

### Expected Behavior (Correct)

2.1 WHEN a user with existing gamification data reopens the application THEN the system SHALL display their actual persisted rank and points from Supabase without showing default values

2.2 WHEN the `App` component mounts THEN the system SHALL initialize `gamificationState` to `null` or a loading state and wait for `loadGamificationState()` to complete before rendering gamification UI

2.3 WHEN `loadGamificationState()` fetches data from Supabase THEN the system SHALL set the gamification state to the fetched values (or calculated retroactive values) before the gamification UI is rendered

2.4 WHEN a user has 50 applications in the database THEN the system SHALL display the correct calculated points (minimum 500 points) and corresponding rank immediately upon successful data load

### Unchanged Behavior (Regression Prevention)

3.1 WHEN a new user with no existing gamification data logs in for the first time THEN the system SHALL CONTINUE TO create a new gamification_state record with initial values (points: 0, rank: 'Newcomer')

3.2 WHEN a user performs an action that earns points (creates application, updates status) THEN the system SHALL CONTINUE TO calculate points correctly using `applyGamification()` and persist to Supabase

3.3 WHEN retroactive points are calculated from existing applications THEN the system SHALL CONTINUE TO use the correct formula (10 points per application, 25 per interview, 50 per offer)

3.4 WHEN the gamification state is updated in Supabase THEN the system SHALL CONTINUE TO maintain data consistency between the React state and the database

3.5 WHEN milestone detection occurs THEN the system SHALL CONTINUE TO display milestone toasts correctly based on state changes
