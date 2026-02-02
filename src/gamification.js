/**
 * GAMIFICATION ENGINE
 * Pure functions only. No side effects. No imports. No UI coupling.
 * White-hat design: transparent rules, no manipulation, no loss mechanics.
 */

// ========== CONSTANTS ==========

const POINTS = {
  APPLICATION: 10,
  INTERVIEW: 25,
  OFFER: 50,
  STREAK_BONUS: 5,
};

const RANKS = [
  { name: 'Newcomer', threshold: 0 },
  { name: 'Applicant', threshold: 50 },
  { name: 'Interviewer', threshold: 150 },
  { name: 'Contender', threshold: 350 },
  { name: 'Top Candidate', threshold: 600 },
  { name: 'Job Seeker Pro', threshold: 1000 },
];

const MILESTONES = {
  FIRST_APPLICATION: 'first_application',
  FIRST_INTERVIEW: 'first_interview',
  FIRST_OFFER: 'first_offer',
  FIVE_DAY_STREAK: 'five_day_streak',
  TEN_APPLICATIONS: 'ten_applications',
  RANK_UP: 'rank_up',
};

const MILESTONE_TIERS = {
  [MILESTONES.RANK_UP]: 'rank-up',
  [MILESTONES.FIRST_INTERVIEW]: 'achievement',
  [MILESTONES.FIRST_OFFER]: 'achievement',
  [MILESTONES.FIVE_DAY_STREAK]: 'achievement',
  [MILESTONES.FIRST_APPLICATION]: 'standard',
  [MILESTONES.TEN_APPLICATIONS]: 'standard',
};

const MILESTONE_MESSAGES = {
  [MILESTONES.FIRST_APPLICATION]: {
    title: 'First Step!',
    message: "You submitted your first application. Keep going!",
  },
  [MILESTONES.FIRST_INTERVIEW]: {
    title: 'Interview Secured!',
    message: "Your first interview — great progress!",
  },
  [MILESTONES.FIRST_OFFER]: {
    title: 'Offer Received!',
    message: "You got your first offer. Congratulations!",
  },
  [MILESTONES.FIVE_DAY_STREAK]: {
    title: '5-Day Streak!',
    message: "Five days of consistent progress. You're on fire!",
  },
  [MILESTONES.TEN_APPLICATIONS]: {
    title: '10 Applications!',
    message: "You've submitted 10 applications. Momentum is building!",
  },
  [MILESTONES.RANK_UP]: (rank) => ({
    title: `Rank Up: ${rank}!`,
    message: `You've advanced to ${rank}. Keep climbing!`,
  }),
};

// ========== PURE FUNCTIONS ==========

/**
 * Calculate current rank based on points
 */
export function calculateRank(points) {
  for (let i = RANKS.length - 1; i >= 0; i--) {
    if (points >= RANKS[i].threshold) {
      return RANKS[i].name;
    }
  }
  return RANKS[0].name;
}

/**
 * Get next rank and points needed
 */
export function getNextRank(currentPoints) {
  const currentRank = calculateRank(currentPoints);
  const currentIndex = RANKS.findIndex(r => r.name === currentRank);
  
  if (currentIndex === RANKS.length - 1) {
    return { name: null, pointsNeeded: 0 }; // Max rank reached
  }
  
  const nextRank = RANKS[currentIndex + 1];
  return {
    name: nextRank.name,
    pointsNeeded: nextRank.threshold - currentPoints,
  };
}

/**
 * Calculate progress percentage to next rank
 */
export function getRankProgress(currentPoints) {
  const currentRank = calculateRank(currentPoints);
  const currentIndex = RANKS.findIndex(r => r.name === currentRank);
  
  if (currentIndex === RANKS.length - 1) {
    return 100; // Max rank
  }
  
  const currentThreshold = RANKS[currentIndex].threshold;
  const nextThreshold = RANKS[currentIndex + 1].threshold;
  const progress = ((currentPoints - currentThreshold) / (nextThreshold - currentThreshold)) * 100;
  
  return Math.min(Math.max(progress, 0), 100);
}

/**
 * Calculate streak days
 * Returns new streak count based on last activity date and today
 */
export function calculateStreak(lastActivityDate, todayDate = new Date()) {
  if (!lastActivityDate) return 1; // First activity ever
  
  const last = new Date(lastActivityDate);
  const today = new Date(todayDate);
  
  // Normalize to midnight for date comparison
  last.setHours(0, 0, 0, 0);
  today.setHours(0, 0, 0, 0);
  
  const diffMs = today - last;
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
  
  if (diffDays === 0) {
    // Same day - streak continues but doesn't increment
    return null; // Signal: no change
  } else if (diffDays === 1) {
    // Next day - increment streak
    return 'increment';
  } else {
    // Gap - reset streak
    return 'reset';
  }
}

/**
 * Calculate points earned from an action
 */
export function calculatePointsForAction(action, oldStatus, newStatus) {
  switch (action) {
    case 'create_application':
      return POINTS.APPLICATION;
    
    case 'update_status':
      if (oldStatus === 'applied' && newStatus === 'interview') {
        return POINTS.INTERVIEW;
      }
      if ((oldStatus === 'applied' || oldStatus === 'interview') && newStatus === 'offered') {
        return POINTS.OFFER;
      }
      return 0;
    
    case 'streak_bonus':
      return POINTS.STREAK_BONUS;
    
    default:
      return 0;
  }
}

/**
 * Detect milestones based on old state vs new state
 * Returns array of milestone objects { type, tier, title, message }
 */
export function detectMilestones(oldState, newState, applications) {
  const milestones = [];
  
  // Rank up
  if (oldState.rank !== newState.rank) {
    const msg = MILESTONE_MESSAGES[MILESTONES.RANK_UP](newState.rank);
    milestones.push({
      type: MILESTONES.RANK_UP,
      tier: MILESTONE_TIERS[MILESTONES.RANK_UP],
      title: msg.title,
      message: msg.message,
    });
  }
  
  // First application
  if (applications.length === 1 && oldState.points === 0) {
    milestones.push({
      type: MILESTONES.FIRST_APPLICATION,
      tier: MILESTONE_TIERS[MILESTONES.FIRST_APPLICATION],
      ...MILESTONE_MESSAGES[MILESTONES.FIRST_APPLICATION],
    });
  }
  
  // Ten applications
  if (applications.length === 10) {
    milestones.push({
      type: MILESTONES.TEN_APPLICATIONS,
      tier: MILESTONE_TIERS[MILESTONES.TEN_APPLICATIONS],
      ...MILESTONE_MESSAGES[MILESTONES.TEN_APPLICATIONS],
    });
  }
  
  // First interview
  const hasInterview = applications.some(app => app.status === 'interview' || app.status === 'offered' || app.status === 'accepted');
  const hadInterview = oldState.points >= POINTS.INTERVIEW;
  if (hasInterview && !hadInterview) {
    milestones.push({
      type: MILESTONES.FIRST_INTERVIEW,
      tier: MILESTONE_TIERS[MILESTONES.FIRST_INTERVIEW],
      ...MILESTONE_MESSAGES[MILESTONES.FIRST_INTERVIEW],
    });
  }
  
  // First offer
  const hasOffer = applications.some(app => app.status === 'offered' || app.status === 'accepted');
  const hadOffer = oldState.points >= (POINTS.APPLICATION + POINTS.INTERVIEW + POINTS.OFFER);
  if (hasOffer && !hadOffer) {
    milestones.push({
      type: MILESTONES.FIRST_OFFER,
      tier: MILESTONE_TIERS[MILESTONES.FIRST_OFFER],
      ...MILESTONE_MESSAGES[MILESTONES.FIRST_OFFER],
    });
  }
  
  // Five day streak
  if (newState.streak_days === 5 && oldState.streak_days < 5) {
    milestones.push({
      type: MILESTONES.FIVE_DAY_STREAK,
      tier: MILESTONE_TIERS[MILESTONES.FIVE_DAY_STREAK],
      ...MILESTONE_MESSAGES[MILESTONES.FIVE_DAY_STREAK],
    });
  }
  
  return milestones;
}

/**
 * Compute new gamification state after an action
 * Pure function - does not mutate anything
 */
export function computeNewState(currentState, action, actionData = {}) {
  const newState = { ...currentState };
  
  // Handle streak
  const streakResult = calculateStreak(currentState.last_activity);
  if (streakResult === 'increment') {
    newState.streak_days = currentState.streak_days + 1;
    newState.points += POINTS.STREAK_BONUS;
  } else if (streakResult === 'reset') {
    newState.streak_days = 1;
  }
  // If null (same day), no change to streak
  
  // Update last activity
  newState.last_activity = new Date().toISOString().split('T')[0];
  
  // Add points for action
  const pointsEarned = calculatePointsForAction(
    action,
    actionData.oldStatus,
    actionData.newStatus
  );
  newState.points += pointsEarned;
  
  // Recalculate rank
  newState.rank = calculateRank(newState.points);
  
  return newState;
}

/**
 * Get initial state for a new user
 */
export function getInitialState() {
  return {
    points: 0,
    streak_days: 0,
    last_activity: null,
    rank: 'Newcomer',
  };
}

/**
 * Format rank card data for UI
 */
export function formatRankCardData(state) {
  const progress = getRankProgress(state.points);
  const next = getNextRank(state.points);
  
  return {
    rank: state.rank,
    points: state.points,
    streak: state.streak_days,
    progress: Math.round(progress),
    nextRank: next.name,
    pointsToNext: next.pointsNeeded,
  };
}
export function formatRankCardData(state) {
  const rankThresholds = {
    rookie: 100,
    junior: 300,
    mid: 700,
    senior: 1500,
    principal: 3000,
  };

  const nextRankPoints =
    rankThresholds[state.rank] ?? rankThresholds.rookie;

  const progressPercent = Math.min(
    100,
    Math.round((state.points / nextRankPoints) * 100)
  );

  return {
    currentRank: state.rank,
    currentPoints: state.points,
    nextRankPoints,
    progressPercent,
    streakDays: state.streak_days || 0,
  };
}
