// type: 'weight' = kg/cm PR (higher is better)
//       'time'   = seconds PR (lower is better for races, higher for holds)
//       'reps'   = max reps (higher is better)
export const DEFAULT_EXERCISES = [
  // Barbell
  { id: 'back-squat',     name: 'Back squat',        category: 'Barbell',    type: 'weight', unit: 'kg'   },
  { id: 'front-squat',    name: 'Front squat',        category: 'Barbell',    type: 'weight', unit: 'kg'   },
  { id: 'deadlift',       name: 'Deadlift',           category: 'Barbell',    type: 'weight', unit: 'kg'   },
  { id: 'bench-press',    name: 'Bench press',        category: 'Barbell',    type: 'weight', unit: 'kg'   },
  { id: 'overhead-press', name: 'Overhead press',     category: 'Barbell',    type: 'weight', unit: 'kg'   },
  { id: 'barbell-row',    name: 'Barbell row',        category: 'Barbell',    type: 'weight', unit: 'kg'   },
  { id: 'hip-thrust',     name: 'Hip thrust',         category: 'Barbell',    type: 'weight', unit: 'kg'   },
  { id: 'rdl',            name: 'Romanian deadlift',  category: 'Barbell',    type: 'weight', unit: 'kg'   },
  // Dumbbell
  { id: 'db-press',       name: 'DB shoulder press',  category: 'Dumbbell',   type: 'weight', unit: 'kg'   },
  { id: 'db-curl',        name: 'DB bicep curl',      category: 'Dumbbell',   type: 'weight', unit: 'kg'   },
  { id: 'db-lunge',       name: 'DB lunge',           category: 'Dumbbell',   type: 'weight', unit: 'kg'   },
  { id: 'db-row',         name: 'DB single-arm row',  category: 'Dumbbell',   type: 'weight', unit: 'kg'   },
  // Bodyweight
  { id: 'pull-ups',       name: 'Pull-ups',           category: 'Bodyweight', type: 'reps',   unit: 'reps' },
  { id: 'push-ups',       name: 'Push-ups',           category: 'Bodyweight', type: 'reps',   unit: 'reps' },
  { id: 'dips',           name: 'Dips',               category: 'Bodyweight', type: 'reps',   unit: 'reps' },
  { id: 'plank',          name: 'Plank hold',         category: 'Bodyweight', type: 'time',   unit: 'sec'  },
  // Cardio
  { id: 'run-1k',         name: '1 km run',           category: 'Cardio',     type: 'time',   unit: 'sec'  },
  { id: 'run-5k',         name: '5 km run',           category: 'Cardio',     type: 'time',   unit: 'sec'  },
  { id: 'run-10k',        name: '10 km run',          category: 'Cardio',     type: 'time',   unit: 'sec'  },
  { id: 'row-500m',       name: '500 m row',          category: 'Cardio',     type: 'time',   unit: 'sec'  },
  { id: 'row-2k',         name: '2 km row',           category: 'Cardio',     type: 'time',   unit: 'sec'  },
  { id: 'bike-10k',       name: '10 km bike',         category: 'Cardio',     type: 'time',   unit: 'sec'  },
  // Functional
  { id: 'farmers-carry',  name: 'Farmers carry',      category: 'Functional', type: 'weight', unit: 'kg'   },
  { id: 'kb-swing',       name: 'Kettlebell swing',   category: 'Functional', type: 'weight', unit: 'kg'   },
  { id: 'box-jump',       name: 'Box jump',           category: 'Functional', type: 'weight', unit: 'cm'   },
]

export const DEFAULT_ATTRIBUTES = [
  'Mobility', 'Flexibility', 'Stamina', 'Strength',
  'Coordination', 'Balance', 'Endurance', 'Power', 'Agility',
]

export const DEFAULT_MEASUREMENTS = [
  { id: 'weight',     label: 'Body weight',   unit: 'kg' },
  { id: 'waist',      label: 'Waist',         unit: 'cm' },
  { id: 'hips',       label: 'Hips',          unit: 'cm' },
  { id: 'chest_bust', label: 'Chest / bust',  unit: 'cm' },
  { id: 'shoulders',  label: 'Shoulders',     unit: 'cm' },
  { id: 'arms',       label: 'Arms (biceps)', unit: 'cm' },
  { id: 'thighs',     label: 'Thighs',        unit: 'cm' },
  { id: 'calves',     label: 'Calves',        unit: 'cm' },
]
