# Requirements Document

## Introduction

This feature enhances the existing gamification system by adding unicorn celebration animations for additional milestone events. Currently, unicorns only appear during rank-up milestones. This enhancement adds celebrations for daily login welcome events and early application milestones (5 and 10 applications), making the application more engaging for users in the early stages of their job search journey.

## Glossary

- **Celebration_System**: The existing animation system that displays flying unicorns when milestones are achieved
- **Milestone**: An achievement event that triggers a celebration (e.g., rank-up, first application, 5 applications)
- **Login_Event**: The event that occurs when a user successfully authenticates and the application loads
- **Application_Count**: The total number of job applications a user has submitted
- **Celebration_Queue**: The system that manages multiple celebration animations to prevent overlapping
- **Session**: A single continuous period of user interaction with the application, from login to logout or tab close
- **Daily_Login**: The first login event for a user within a 24-hour period

## Requirements

### Requirement 1: Welcome Celebration on Daily Login

**User Story:** As a user, I want to see a welcome celebration when I first log in each day, so that I feel motivated and engaged when starting my job search activities.

#### Acceptance Criteria

1. WHEN a user logs in for the first time in a 24-hour period, THE Celebration_System SHALL display a welcome celebration animation
2. WHEN a user logs in multiple times within the same 24-hour period, THE Celebration_System SHALL NOT display the welcome celebration
3. THE welcome celebration SHALL use the 'standard' milestone tier configuration (3 unicorns, 2.5 second duration)
4. THE welcome celebration SHALL display the title "Welcome Back!" and message "Ready to make progress today?"
5. WHEN the welcome celebration is triggered, THE Celebration_System SHALL add it to the Celebration_Queue to prevent overlap with other celebrations

### Requirement 2: Five Applications Milestone Celebration

**User Story:** As a user, I want to see a celebration when I reach 5 applications, so that I feel encouraged by my early progress.

#### Acceptance Criteria

1. WHEN the Application_Count reaches exactly 5, THE Celebration_System SHALL display a celebration animation
2. THE 5 applications celebration SHALL use the 'standard' milestone tier configuration (3 unicorns, 2.5 second duration)
3. THE 5 applications celebration SHALL display the title "5 Applications!" and message "Great start! Keep the momentum going!"
4. THE Celebration_System SHALL trigger this celebration only once per user (when count transitions to 5)
5. WHEN the 5 applications celebration is triggered, THE Celebration_System SHALL add it to the Celebration_Queue to prevent overlap with other celebrations

### Requirement 3: Ten Applications Milestone Celebration

**User Story:** As a user, I want to see a celebration when I reach 10 applications, so that I feel recognized for reaching a significant early milestone.

#### Acceptance Criteria

1. WHEN the Application_Count reaches exactly 10, THE Celebration_System SHALL display a celebration animation
2. THE 10 applications celebration SHALL use the existing 'standard' milestone tier configuration (3 unicorns, 2.5 second duration)
3. THE existing 10 applications celebration SHALL continue to display the title "10 Applications!" and message "You have submitted 10 applications. Momentum is building!"
4. THE Celebration_System SHALL trigger this celebration only once per user (when count transitions to 10)
5. WHEN the 10 applications celebration is triggered, THE Celebration_System SHALL add it to the Celebration_Queue to prevent overlap with other celebrations

### Requirement 4: Preserve Existing Rank-Up Celebrations

**User Story:** As a user, I want rank-up celebrations to continue working as they currently do, so that my progression through ranks remains rewarding.

#### Acceptance Criteria

1. THE Celebration_System SHALL continue to display celebrations for all existing rank-up milestones (Newcomer → Applicant → Interviewer → Contender → Top Candidate → Job Seeker Pro)
2. THE rank-up celebrations SHALL continue to use the 'rank-up' milestone tier configuration (8 unicorns, 4 second duration)
3. THE rank-up celebrations SHALL continue to display their existing titles and messages
4. WHEN a rank-up occurs simultaneously with another milestone, THE Celebration_System SHALL queue both celebrations and display them sequentially

### Requirement 5: Celebration Non-Overlap

**User Story:** As a user, I want celebrations to display one at a time, so that I can appreciate each achievement without visual confusion.

#### Acceptance Criteria

1. WHEN multiple milestones are achieved simultaneously, THE Celebration_System SHALL queue all celebrations
2. WHEN a celebration is active, THE Celebration_System SHALL NOT start another celebration until the active one completes
3. WHEN a celebration completes, THE Celebration_System SHALL automatically start the next queued celebration if one exists
4. THE Celebration_Queue SHALL process celebrations in the order they were triggered
5. WHEN the application loads with pending celebrations, THE Celebration_System SHALL process them from the queue in order

### Requirement 6: Daily Login Tracking

**User Story:** As a user, I want the system to accurately track my daily logins, so that I receive the welcome celebration at the appropriate times.

#### Acceptance Criteria

1. WHEN a user logs in, THE Application SHALL record the current date as the last login date
2. WHEN determining if a login is the first of the day, THE Application SHALL compare the stored last login date with the current date
3. THE Application SHALL consider dates in the user's local timezone for login tracking
4. WHEN a user's last login date is from a previous day, THE Application SHALL mark the current login as a Daily_Login
5. THE Application SHALL persist the last login date to the database for the user

### Requirement 7: Milestone Type Definitions

**User Story:** As a developer, I want clear milestone type definitions for the new celebrations, so that the system can properly categorize and handle them.

#### Acceptance Criteria

1. THE Application SHALL define a milestone type constant 'WELCOME_LOGIN' for daily login celebrations
2. THE Application SHALL define a milestone type constant 'FIVE_APPLICATIONS' for the 5 applications milestone
3. THE Application SHALL assign the 'standard' tier to the 'WELCOME_LOGIN' milestone type
4. THE Application SHALL assign the 'standard' tier to the 'FIVE_APPLICATIONS' milestone type
5. THE Application SHALL include 'WELCOME_LOGIN' and 'FIVE_APPLICATIONS' in the milestone detection logic
