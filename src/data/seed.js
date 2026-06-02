// Dummy data for 10 clients — used by the seed feature in SettingsPage
// Each client has: profile, PRs, attribute entries, measurement entries, attendance
// All clients are tagged isDummy: true so they can be selectively flushed
// Attendance dates are DD-MM-YYYY. Today = 01-06-2026.

export const DUMMY_CLIENTS = [
  {
    client: {
      name: 'Priya Sharma', goal: 'Build strength and lose 5 kg',
      goalType: 'weight_loss',
      dob: '1990-04-12', notes: 'Lower back history — avoid heavy deadlifts initially',
      paymentStatus: 'paid', status: 'active', isDummy: true,
      membershipType: 3, startDate: '05-01-2026',
    },
    prs: [
      { exerciseId: 'back-squat',   exerciseName: 'Back squat',   value: 50,  type: 'weight', unit: 'kg',   period: 'monthly', date: '2024-11-01', notes: 'First baseline' },
      { exerciseId: 'back-squat',   exerciseName: 'Back squat',   value: 57,  type: 'weight', unit: 'kg',   period: 'monthly', date: '2025-01-10', notes: '' },
      { exerciseId: 'back-squat',   exerciseName: 'Back squat',   value: 62,  type: 'weight', unit: 'kg',   period: 'monthly', date: '2025-03-15', notes: 'PB!' },
      { exerciseId: 'bench-press',  exerciseName: 'Bench press',  value: 35,  type: 'weight', unit: 'kg',   period: 'monthly', date: '2024-11-01', notes: '' },
      { exerciseId: 'bench-press',  exerciseName: 'Bench press',  value: 42,  type: 'weight', unit: 'kg',   period: 'monthly', date: '2025-03-15', notes: '' },
      { exerciseId: 'run-5k',       exerciseName: '5 km run',     value: 1740,type: 'time',   unit: 'sec',  period: 'monthly', date: '2024-12-01', notes: '29 min' },
      { exerciseId: 'run-5k',       exerciseName: '5 km run',     value: 1560,type: 'time',   unit: 'sec',  period: 'monthly', date: '2025-03-01', notes: '26 min' },
    ],
    attributes: [
      { date: '2024-11-01', scores: { Mobility:5, Flexibility:4, Stamina:6, Strength:5, Coordination:6, Balance:5, Endurance:6, Power:4, Agility:5 } },
      { date: '2025-01-15', scores: { Mobility:6, Flexibility:5, Stamina:7, Strength:6, Coordination:6, Balance:6, Endurance:7, Power:5, Agility:6 } },
      { date: '2025-03-20', scores: { Mobility:7, Flexibility:6, Stamina:8, Strength:7, Coordination:7, Balance:7, Endurance:8, Power:6, Agility:7 } },
    ],
    measurements: [
      { date: '2024-11-01', values: { weight: 72, waist: 82, hips: 96, chest_bust: 88, shoulders: 98, arms: 29, thighs: 58, calves: 36 } },
      { date: '2025-01-15', values: { weight: 70, waist: 80, hips: 94, chest_bust: 87, shoulders: 98, arms: 30, thighs: 57, calves: 36 } },
      { date: '2025-03-20', values: { weight: 68, waist: 77, hips: 92, chest_bust: 86, shoulders: 99, arms: 31, thighs: 55, calves: 37 } },
    ],
    // 12/13 expected → improving (92%)
    attendance: [
      { date: '04-05-2026' }, { date: '06-05-2026' }, { date: '08-05-2026' },
      { date: '11-05-2026' }, { date: '13-05-2026' }, { date: '15-05-2026' },
      { date: '18-05-2026' }, { date: '20-05-2026' }, { date: '22-05-2026' },
      { date: '25-05-2026' }, { date: '27-05-2026' }, { date: '29-05-2026' },
    ],
  },
  {
    client: {
      name: 'Rohan Mehta', goal: 'Marathon prep',
      goalType: 'athletic',
      dob: '1988-09-23', notes: 'Runs 4x per week, needs strength supplementation',
      paymentStatus: 'unpaid', status: 'active', isDummy: true,
      membershipType: 4, startDate: '12-01-2026',
    },
    prs: [
      { exerciseId: 'run-5k',  exerciseName: '5 km run',  value: 1320, type: 'time', unit: 'sec', period: 'weekly', date: '2024-10-05', notes: '22 min' },
      { exerciseId: 'run-5k',  exerciseName: '5 km run',  value: 1200, type: 'time', unit: 'sec', period: 'weekly', date: '2025-01-12', notes: '20 min' },
      { exerciseId: 'run-5k',  exerciseName: '5 km run',  value: 1110, type: 'time', unit: 'sec', period: 'weekly', date: '2025-03-22', notes: '18.5 min PB' },
      { exerciseId: 'run-10k', exerciseName: '10 km run', value: 2820, type: 'time', unit: 'sec', period: 'monthly', date: '2024-11-10', notes: '47 min' },
      { exerciseId: 'run-10k', exerciseName: '10 km run', value: 2520, type: 'time', unit: 'sec', period: 'monthly', date: '2025-03-10', notes: '42 min PB' },
      { exerciseId: 'deadlift', exerciseName: 'Deadlift', value: 80,   type: 'weight', unit: 'kg', period: 'monthly', date: '2025-01-20', notes: '' },
      { exerciseId: 'deadlift', exerciseName: 'Deadlift', value: 95,   type: 'weight', unit: 'kg', period: 'monthly', date: '2025-03-25', notes: '' },
    ],
    attributes: [
      { date: '2024-10-05', scores: { Mobility:6, Flexibility:5, Stamina:8, Strength:5, Coordination:7, Balance:6, Endurance:9, Power:5, Agility:7 } },
      { date: '2025-02-01', scores: { Mobility:7, Flexibility:6, Stamina:9, Strength:6, Coordination:7, Balance:7, Endurance:9, Power:6, Agility:8 } },
    ],
    measurements: [
      { date: '2024-10-05', values: { weight: 68, waist: 78, hips: 88, chest_bust: 90, shoulders: 104, arms: 32, thighs: 54, calves: 37 } },
      { date: '2025-02-01', values: { weight: 67, waist: 76, hips: 87, chest_bust: 91, shoulders: 105, arms: 33, thighs: 53, calves: 38 } },
    ],
    // 16/17 expected → improving (94%)
    attendance: [
      { date: '04-05-2026' }, { date: '05-05-2026' }, { date: '07-05-2026' }, { date: '08-05-2026' },
      { date: '11-05-2026' }, { date: '12-05-2026' }, { date: '14-05-2026' }, { date: '15-05-2026' },
      { date: '18-05-2026' }, { date: '19-05-2026' }, { date: '21-05-2026' }, { date: '22-05-2026' },
      { date: '25-05-2026' }, { date: '26-05-2026' }, { date: '28-05-2026' }, { date: '29-05-2026' },
    ],
  },
  {
    client: {
      name: 'Aisha Okonkwo', goal: 'General fitness and toning',
      goalType: 'general',
      dob: '1995-02-14', notes: 'Prefers morning sessions, no equipment at home',
      paymentStatus: 'paid', status: 'active', isDummy: true,
      membershipType: 3, startDate: '19-01-2026',
    },
    prs: [
      { exerciseId: 'push-ups', exerciseName: 'Push-ups',   value: 12, type: 'reps', unit: 'reps', period: 'weekly', date: '2024-12-01', notes: '' },
      { exerciseId: 'push-ups', exerciseName: 'Push-ups',   value: 18, type: 'reps', unit: 'reps', period: 'weekly', date: '2025-02-10', notes: '' },
      { exerciseId: 'push-ups', exerciseName: 'Push-ups',   value: 25, type: 'reps', unit: 'reps', period: 'weekly', date: '2025-04-01', notes: 'PB' },
      { exerciseId: 'pull-ups', exerciseName: 'Pull-ups',   value: 2,  type: 'reps', unit: 'reps', period: 'monthly', date: '2024-12-01', notes: 'First ever' },
      { exerciseId: 'pull-ups', exerciseName: 'Pull-ups',   value: 6,  type: 'reps', unit: 'reps', period: 'monthly', date: '2025-04-01', notes: '' },
      { exerciseId: 'plank',    exerciseName: 'Plank hold', value: 45, type: 'time', unit: 'sec',  period: 'weekly', date: '2024-12-01', notes: '' },
      { exerciseId: 'plank',    exerciseName: 'Plank hold', value: 90, type: 'time', unit: 'sec',  period: 'weekly', date: '2025-04-01', notes: '' },
    ],
    attributes: [
      { date: '2024-12-01', scores: { Mobility:6, Flexibility:7, Stamina:5, Strength:4, Coordination:6, Balance:6, Endurance:5, Power:4, Agility:6 } },
      { date: '2025-02-15', scores: { Mobility:7, Flexibility:8, Stamina:6, Strength:5, Coordination:7, Balance:7, Endurance:6, Power:5, Agility:7 } },
      { date: '2025-04-05', scores: { Mobility:8, Flexibility:8, Stamina:7, Strength:6, Coordination:8, Balance:8, Endurance:7, Power:6, Agility:8 } },
    ],
    measurements: [
      { date: '2024-12-01', values: { weight: 63, waist: 73, hips: 92, chest_bust: 84, shoulders: 96, arms: 27, thighs: 55, calves: 35 } },
      { date: '2025-02-15', values: { weight: 62, waist: 71, hips: 90, chest_bust: 83, shoulders: 96, arms: 27, thighs: 54, calves: 35 } },
      { date: '2025-04-05', values: { weight: 61, waist: 69, hips: 89, chest_bust: 83, shoulders: 97, arms: 28, thighs: 53, calves: 36 } },
    ],
    // 12/13 expected → improving (92%)
    attendance: [
      { date: '04-05-2026' }, { date: '06-05-2026' }, { date: '08-05-2026' },
      { date: '11-05-2026' }, { date: '13-05-2026' }, { date: '15-05-2026' },
      { date: '18-05-2026' }, { date: '20-05-2026' }, { date: '22-05-2026' },
      { date: '25-05-2026' }, { date: '27-05-2026' }, { date: '29-05-2026' },
    ],
  },
  {
    client: {
      name: 'James Thornton', goal: 'Powerlifting — target 120 kg squat',
      goalType: 'muscle_gain',
      dob: '1992-07-30', notes: 'Competes at regional level. Responds well to high volume.',
      paymentStatus: 'paid', status: 'active', isDummy: true,
      membershipType: 5, startDate: '05-01-2026',
    },
    prs: [
      { exerciseId: 'back-squat',  exerciseName: 'Back squat',   value: 100, type: 'weight', unit: 'kg', period: 'monthly', date: '2024-10-01', notes: '' },
      { exerciseId: 'back-squat',  exerciseName: 'Back squat',   value: 107, type: 'weight', unit: 'kg', period: 'monthly', date: '2025-01-05', notes: '' },
      { exerciseId: 'back-squat',  exerciseName: 'Back squat',   value: 115, type: 'weight', unit: 'kg', period: 'monthly', date: '2025-04-01', notes: 'Season best' },
      { exerciseId: 'deadlift',    exerciseName: 'Deadlift',     value: 140, type: 'weight', unit: 'kg', period: 'monthly', date: '2024-10-01', notes: '' },
      { exerciseId: 'deadlift',    exerciseName: 'Deadlift',     value: 152, type: 'weight', unit: 'kg', period: 'monthly', date: '2025-04-01', notes: 'PB' },
      { exerciseId: 'bench-press', exerciseName: 'Bench press',  value: 90,  type: 'weight', unit: 'kg', period: 'monthly', date: '2024-10-01', notes: '' },
      { exerciseId: 'bench-press', exerciseName: 'Bench press',  value: 97,  type: 'weight', unit: 'kg', period: 'monthly', date: '2025-04-01', notes: '' },
    ],
    attributes: [
      { date: '2024-10-01', scores: { Mobility:4, Flexibility:3, Stamina:6, Strength:9, Coordination:5, Balance:5, Endurance:6, Power:9, Agility:4 } },
      { date: '2025-04-01', scores: { Mobility:5, Flexibility:4, Stamina:6, Strength:10, Coordination:5, Balance:5, Endurance:6, Power:10, Agility:4 } },
    ],
    measurements: [
      { date: '2024-10-01', values: { weight: 92, waist: 90, hips: 102, chest_bust: 110, shoulders: 126, arms: 42, thighs: 66, calves: 42 } },
      { date: '2025-04-01', values: { weight: 93, waist: 89, hips: 101, chest_bust: 112, shoulders: 127, arms: 43, thighs: 66, calves: 43 } },
    ],
    // 20/21 expected → improving (95%)
    attendance: [
      { date: '04-05-2026' }, { date: '05-05-2026' }, { date: '06-05-2026' }, { date: '07-05-2026' }, { date: '08-05-2026' },
      { date: '11-05-2026' }, { date: '12-05-2026' }, { date: '13-05-2026' }, { date: '14-05-2026' }, { date: '15-05-2026' },
      { date: '18-05-2026' }, { date: '19-05-2026' }, { date: '20-05-2026' }, { date: '21-05-2026' }, { date: '22-05-2026' },
      { date: '25-05-2026' }, { date: '26-05-2026' }, { date: '27-05-2026' }, { date: '28-05-2026' },
    ],
  },
  {
    client: {
      name: 'Sofia Andersen', goal: 'Post-partum recovery and core strength',
      goalType: 'rehabilitation',
      dob: '1991-11-05', notes: 'Cleared by physio. Slow progressive loading only.',
      paymentStatus: 'paid', status: 'active', isDummy: true,
      membershipType: 3, startDate: '26-01-2026',
    },
    prs: [
      { exerciseId: 'plank',       exerciseName: 'Plank hold',        value: 20,  type: 'time',   unit: 'sec', period: 'weekly', date: '2025-01-10', notes: 'Starting point' },
      { exerciseId: 'plank',       exerciseName: 'Plank hold',        value: 45,  type: 'time',   unit: 'sec', period: 'weekly', date: '2025-02-15', notes: '' },
      { exerciseId: 'plank',       exerciseName: 'Plank hold',        value: 75,  type: 'time',   unit: 'sec', period: 'weekly', date: '2025-04-01', notes: '' },
      { exerciseId: 'hip-thrust',  exerciseName: 'Hip thrust',        value: 20,  type: 'weight', unit: 'kg',  period: 'monthly', date: '2025-01-20', notes: '' },
      { exerciseId: 'hip-thrust',  exerciseName: 'Hip thrust',        value: 40,  type: 'weight', unit: 'kg',  period: 'monthly', date: '2025-04-01', notes: '' },
    ],
    attributes: [
      { date: '2025-01-10', scores: { Mobility:5, Flexibility:6, Stamina:4, Strength:3, Coordination:5, Balance:4, Endurance:4, Power:3, Agility:4 } },
      { date: '2025-04-05', scores: { Mobility:6, Flexibility:7, Stamina:6, Strength:5, Coordination:6, Balance:6, Endurance:6, Power:5, Agility:5 } },
    ],
    measurements: [
      { date: '2025-01-10', values: { weight: 67, waist: 84, hips: 99, chest_bust: 92, shoulders: 100, arms: 28, thighs: 57, calves: 35 } },
      { date: '2025-02-20', values: { weight: 66, waist: 82, hips: 97, chest_bust: 91, shoulders: 100, arms: 28, thighs: 56, calves: 35 } },
      { date: '2025-04-05', values: { weight: 65, waist: 80, hips: 95, chest_bust: 90, shoulders: 101, arms: 29, thighs: 55, calves: 36 } },
    ],
    // 7/13 expected → declining (54%)
    attendance: [
      { date: '04-05-2026' }, { date: '06-05-2026' },
      { date: '13-05-2026' },
      { date: '18-05-2026' }, { date: '20-05-2026' },
      { date: '25-05-2026' },
      { date: '29-05-2026' },
    ],
  },
  {
    client: {
      name: 'Marcus Webb', goal: 'Lose weight and improve cardio',
      goalType: 'weight_loss',
      dob: '1985-03-18', notes: 'Desk job, sedentary background. Motivated but beginner level.',
      paymentStatus: 'unpaid', status: 'active', isDummy: true,
      membershipType: 3, startDate: '05-01-2026',
    },
    prs: [
      { exerciseId: 'run-1k',  exerciseName: '1 km run',  value: 480, type: 'time', unit: 'sec', period: 'weekly', date: '2025-01-05', notes: '8 min — first attempt' },
      { exerciseId: 'run-1k',  exerciseName: '1 km run',  value: 420, type: 'time', unit: 'sec', period: 'weekly', date: '2025-02-10', notes: '7 min' },
      { exerciseId: 'run-1k',  exerciseName: '1 km run',  value: 360, type: 'time', unit: 'sec', period: 'weekly', date: '2025-04-01', notes: '6 min PB' },
      { exerciseId: 'push-ups', exerciseName: 'Push-ups', value: 5,  type: 'reps', unit: 'reps', period: 'monthly', date: '2025-01-05', notes: '' },
      { exerciseId: 'push-ups', exerciseName: 'Push-ups', value: 14, type: 'reps', unit: 'reps', period: 'monthly', date: '2025-04-01', notes: '' },
    ],
    attributes: [
      { date: '2025-01-05', scores: { Mobility:4, Flexibility:3, Stamina:3, Strength:3, Coordination:4, Balance:4, Endurance:3, Power:3, Agility:3 } },
      { date: '2025-04-05', scores: { Mobility:5, Flexibility:4, Stamina:5, Strength:4, Coordination:5, Balance:5, Endurance:5, Power:4, Agility:4 } },
    ],
    measurements: [
      { date: '2025-01-05', values: { weight: 98, waist: 108, hips: 112, chest_bust: 108, shoulders: 118, arms: 36, thighs: 62, calves: 40 } },
      { date: '2025-02-10', values: { weight: 95, waist: 105, hips: 110, chest_bust: 107, shoulders: 118, arms: 36, thighs: 61, calves: 40 } },
      { date: '2025-04-05', values: { weight: 91, waist: 101, hips: 107, chest_bust: 105, shoulders: 117, arms: 36, thighs: 59, calves: 40 } },
    ],
    // 10/13 expected → stagnant (77%)
    attendance: [
      { date: '04-05-2026' }, { date: '08-05-2026' },
      { date: '11-05-2026' }, { date: '15-05-2026' },
      { date: '18-05-2026' }, { date: '20-05-2026' }, { date: '22-05-2026' },
      { date: '25-05-2026' }, { date: '27-05-2026' }, { date: '29-05-2026' },
    ],
  },
  {
    client: {
      name: 'Yuki Tanaka', goal: 'Flexibility and mobility focus',
      goalType: 'rehabilitation',
      dob: '1997-06-22', notes: 'Former dancer. Wants to maintain mobility, add functional strength.',
      paymentStatus: 'paid', status: 'paused', isDummy: true,
      membershipType: 3, startDate: '09-02-2026',
    },
    prs: [
      { exerciseId: 'plank',     exerciseName: 'Plank hold',    value: 120, type: 'time',   unit: 'sec', period: 'monthly', date: '2024-09-01', notes: '' },
      { exerciseId: 'plank',     exerciseName: 'Plank hold',    value: 150, type: 'time',   unit: 'sec', period: 'monthly', date: '2024-11-15', notes: '' },
      { exerciseId: 'db-lunge',  exerciseName: 'DB lunge',      value: 10,  type: 'weight', unit: 'kg',  period: 'monthly', date: '2024-09-01', notes: '' },
      { exerciseId: 'db-lunge',  exerciseName: 'DB lunge',      value: 16,  type: 'weight', unit: 'kg',  period: 'monthly', date: '2024-11-15', notes: '' },
    ],
    attributes: [
      { date: '2024-09-01', scores: { Mobility:9, Flexibility:10, Stamina:6, Strength:4, Coordination:9, Balance:8, Endurance:6, Power:4, Agility:9 } },
      { date: '2024-11-15', scores: { Mobility:9, Flexibility:10, Stamina:7, Strength:5, Coordination:9, Balance:9, Endurance:7, Power:5, Agility:9 } },
    ],
    measurements: [
      { date: '2024-09-01', values: { weight: 55, waist: 66, hips: 88, chest_bust: 80, shoulders: 94, arms: 25, thighs: 50, calves: 33 } },
      { date: '2024-11-15', values: { weight: 55, waist: 65, hips: 87, chest_bust: 80, shoulders: 94, arms: 25, thighs: 49, calves: 33 } },
    ],
    // Paused — only old April dates, outside 30-day window → insufficient
    attendance: [
      { date: '13-04-2026' }, { date: '15-04-2026' }, { date: '17-04-2026' },
    ],
  },
  {
    client: {
      name: 'Fatima Al-Hassan', goal: 'Wedding prep — 3 months',
      goalType: 'recomposition',
      dob: '1993-08-11', notes: 'Goal date: July 2025. Focus on toning and posture.',
      paymentStatus: 'paid', status: 'active', isDummy: true,
      membershipType: 4, startDate: '02-02-2026',
    },
    prs: [
      { exerciseId: 'overhead-press', exerciseName: 'Overhead press', value: 25, type: 'weight', unit: 'kg', period: 'weekly', date: '2025-02-01', notes: '' },
      { exerciseId: 'overhead-press', exerciseName: 'Overhead press', value: 30, type: 'weight', unit: 'kg', period: 'weekly', date: '2025-04-01', notes: '' },
      { exerciseId: 'hip-thrust',     exerciseName: 'Hip thrust',     value: 50, type: 'weight', unit: 'kg', period: 'weekly', date: '2025-02-01', notes: '' },
      { exerciseId: 'hip-thrust',     exerciseName: 'Hip thrust',     value: 65, type: 'weight', unit: 'kg', period: 'weekly', date: '2025-04-01', notes: 'PB' },
      { exerciseId: 'run-5k',        exerciseName: '5 km run',       value: 1620, type: 'time', unit: 'sec', period: 'monthly', date: '2025-02-15', notes: '27 min' },
      { exerciseId: 'run-5k',        exerciseName: '5 km run',       value: 1440, type: 'time', unit: 'sec', period: 'monthly', date: '2025-04-10', notes: '24 min' },
    ],
    attributes: [
      { date: '2025-02-01', scores: { Mobility:6, Flexibility:7, Stamina:6, Strength:5, Coordination:6, Balance:6, Endurance:6, Power:5, Agility:6 } },
      { date: '2025-04-10', scores: { Mobility:7, Flexibility:8, Stamina:7, Strength:7, Coordination:7, Balance:7, Endurance:7, Power:6, Agility:7 } },
    ],
    measurements: [
      { date: '2025-02-01', values: { weight: 66, waist: 74, hips: 93, chest_bust: 85, shoulders: 99, arms: 28, thighs: 56, calves: 35 } },
      { date: '2025-03-15', values: { weight: 64, waist: 72, hips: 91, chest_bust: 84, shoulders: 99, arms: 28, thighs: 55, calves: 35 } },
      { date: '2025-04-10', values: { weight: 63, waist: 70, hips: 90, chest_bust: 84, shoulders: 100, arms: 29, thighs: 54, calves: 36 } },
    ],
    // 16/17 expected → improving (94%)
    attendance: [
      { date: '04-05-2026' }, { date: '05-05-2026' }, { date: '07-05-2026' }, { date: '08-05-2026' },
      { date: '11-05-2026' }, { date: '12-05-2026' }, { date: '14-05-2026' }, { date: '15-05-2026' },
      { date: '18-05-2026' }, { date: '19-05-2026' }, { date: '21-05-2026' }, { date: '22-05-2026' },
      { date: '25-05-2026' }, { date: '26-05-2026' }, { date: '28-05-2026' }, { date: '29-05-2026' },
    ],
  },
  {
    client: {
      name: 'Daniel Osei', goal: 'Functional fitness and injury prevention',
      goalType: 'general',
      dob: '1987-12-03', notes: 'Right knee reconstruction 2022. Physio cleared for all exercises.',
      paymentStatus: 'unpaid', status: 'active', isDummy: true,
      membershipType: 4, startDate: '05-01-2026',
    },
    prs: [
      { exerciseId: 'farmers-carry', exerciseName: 'Farmers carry', value: 30, type: 'weight', unit: 'kg', period: 'monthly', date: '2024-11-01', notes: 'Each hand' },
      { exerciseId: 'farmers-carry', exerciseName: 'Farmers carry', value: 40, type: 'weight', unit: 'kg', period: 'monthly', date: '2025-02-01', notes: '' },
      { exerciseId: 'farmers-carry', exerciseName: 'Farmers carry', value: 48, type: 'weight', unit: 'kg', period: 'monthly', date: '2025-04-01', notes: '' },
      { exerciseId: 'kb-swing',      exerciseName: 'Kettlebell swing', value: 20, type: 'weight', unit: 'kg', period: 'weekly', date: '2024-11-01', notes: '' },
      { exerciseId: 'kb-swing',      exerciseName: 'Kettlebell swing', value: 28, type: 'weight', unit: 'kg', period: 'weekly', date: '2025-04-01', notes: '' },
      { exerciseId: 'row-500m',      exerciseName: '500 m row',        value: 132, type: 'time', unit: 'sec', period: 'monthly', date: '2025-01-10', notes: '2:12' },
      { exerciseId: 'row-500m',      exerciseName: '500 m row',        value: 118, type: 'time', unit: 'sec', period: 'monthly', date: '2025-04-01', notes: '1:58 PB' },
    ],
    attributes: [
      { date: '2024-11-01', scores: { Mobility:5, Flexibility:4, Stamina:6, Strength:6, Coordination:6, Balance:5, Endurance:7, Power:6, Agility:5 } },
      { date: '2025-02-01', scores: { Mobility:6, Flexibility:5, Stamina:7, Strength:7, Coordination:7, Balance:6, Endurance:7, Power:7, Agility:6 } },
      { date: '2025-04-05', scores: { Mobility:7, Flexibility:6, Stamina:8, Strength:8, Coordination:7, Balance:7, Endurance:8, Power:7, Agility:7 } },
    ],
    measurements: [
      { date: '2024-11-01', values: { weight: 82, waist: 88, hips: 98, chest_bust: 100, shoulders: 116, arms: 37, thighs: 60, calves: 40 } },
      { date: '2025-02-01', values: { weight: 80, waist: 86, hips: 96, chest_bust: 101, shoulders: 117, arms: 38, thighs: 59, calves: 40 } },
      { date: '2025-04-05', values: { weight: 79, waist: 84, hips: 95, chest_bust: 102, shoulders: 118, arms: 39, thighs: 59, calves: 41 } },
    ],
    // 9/17 expected → declining (53%)
    attendance: [
      { date: '04-05-2026' }, { date: '08-05-2026' },
      { date: '12-05-2026' }, { date: '15-05-2026' },
      { date: '19-05-2026' },
      { date: '22-05-2026' }, { date: '25-05-2026' },
      { date: '27-05-2026' }, { date: '29-05-2026' },
    ],
  },
  {
    client: {
      name: 'Lena Kovacs', goal: 'Improve rowing performance',
      goalType: 'athletic',
      dob: '1999-01-27', notes: 'University rower. Off-season strength block.',
      paymentStatus: 'paid', status: 'active', isDummy: true,
      membershipType: 5, startDate: '05-01-2026',
    },
    prs: [
      { exerciseId: 'row-2k',      exerciseName: '2 km row',      value: 462, type: 'time',   unit: 'sec', period: 'weekly', date: '2024-10-01', notes: '7:42' },
      { exerciseId: 'row-2k',      exerciseName: '2 km row',      value: 438, type: 'time',   unit: 'sec', period: 'weekly', date: '2025-01-10', notes: '7:18' },
      { exerciseId: 'row-2k',      exerciseName: '2 km row',      value: 418, type: 'time',   unit: 'sec', period: 'weekly', date: '2025-03-20', notes: '6:58 PB' },
      { exerciseId: 'deadlift',    exerciseName: 'Deadlift',       value: 70,  type: 'weight', unit: 'kg',  period: 'monthly', date: '2024-10-01', notes: '' },
      { exerciseId: 'deadlift',    exerciseName: 'Deadlift',       value: 85,  type: 'weight', unit: 'kg',  period: 'monthly', date: '2025-01-10', notes: '' },
      { exerciseId: 'deadlift',    exerciseName: 'Deadlift',       value: 95,  type: 'weight', unit: 'kg',  period: 'monthly', date: '2025-03-20', notes: 'PB' },
      { exerciseId: 'overhead-press', exerciseName: 'Overhead press', value: 40, type: 'weight', unit: 'kg', period: 'monthly', date: '2025-03-20', notes: '' },
    ],
    attributes: [
      { date: '2024-10-01', scores: { Mobility:6, Flexibility:5, Stamina:8, Strength:6, Coordination:7, Balance:6, Endurance:9, Power:7, Agility:6 } },
      { date: '2025-01-15', scores: { Mobility:7, Flexibility:6, Stamina:8, Strength:7, Coordination:7, Balance:7, Endurance:9, Power:8, Agility:7 } },
      { date: '2025-03-25', scores: { Mobility:7, Flexibility:7, Stamina:9, Strength:8, Coordination:8, Balance:7, Endurance:10, Power:8, Agility:7 } },
    ],
    measurements: [
      { date: '2024-10-01', values: { weight: 64, waist: 72, hips: 90, chest_bust: 84, shoulders: 106, arms: 30, thighs: 55, calves: 36 } },
      { date: '2025-01-15', values: { weight: 65, waist: 71, hips: 90, chest_bust: 85, shoulders: 107, arms: 31, thighs: 55, calves: 37 } },
      { date: '2025-03-25', values: { weight: 65, waist: 70, hips: 89, chest_bust: 86, shoulders: 108, arms: 32, thighs: 54, calves: 37 } },
    ],
    // 19/21 expected → improving (90%)
    attendance: [
      { date: '04-05-2026' }, { date: '05-05-2026' }, { date: '06-05-2026' }, { date: '07-05-2026' },
      { date: '11-05-2026' }, { date: '12-05-2026' }, { date: '13-05-2026' }, { date: '14-05-2026' },
      { date: '18-05-2026' }, { date: '19-05-2026' }, { date: '20-05-2026' }, { date: '21-05-2026' }, { date: '22-05-2026' },
      { date: '25-05-2026' }, { date: '26-05-2026' }, { date: '27-05-2026' }, { date: '28-05-2026' }, { date: '29-05-2026' },
      { date: '01-06-2026' },
    ],
  },
]
