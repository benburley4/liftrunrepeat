export type GoalBias = 'strength' | 'balanced' | 'endurance'
export type RunVolume = 'low' | 'medium' | 'high'
export type Level = 'beginner' | 'intermediate' | 'advanced'
export type DayType = 'lift' | 'run' | 'hybrid' | 'rest' | 'physio'

export interface DayPreview {
  type: DayType
  label: string
}

export interface Programme {
  id: string
  name: string
  description: string
  goalBias: GoalBias
  liftDays: number
  runVolume: RunVolume
  level: Level
  durationWeeks: number
  raceTarget: string
  tags: string[]
  weekPreview: DayPreview[]
}

export const programmes: Programme[] = [
  {
    id: 'hybrid-beginner',
    name: 'Hybrid Beginner',
    description: 'Perfect entry point for athletes new to combining strength and running. Low interference, high learning.',
    goalBias: 'balanced',
    liftDays: 3,
    runVolume: 'low',
    level: 'beginner',
    durationWeeks: 12,
    raceTarget: '5K',
    tags: ['beginner', 'balanced', 'intro'],
    weekPreview: [
      { type: 'lift', label: 'Full Body' },
      { type: 'run', label: 'Easy 5km' },
      { type: 'rest', label: 'Rest' },
      { type: 'lift', label: 'Full Body' },
      { type: 'run', label: 'Easy 5km' },
      { type: 'lift', label: 'Full Body' },
      { type: 'rest', label: 'Rest' },
    ],
  },
  {
    id: '531-easy-miles',
    name: '5/3/1 + Easy Kms',
    description: 'Jim Wendler\'s proven 5/3/1 strength programme paired with consistent aerobic base building.',
    goalBias: 'strength',
    liftDays: 4,
    runVolume: 'low',
    level: 'intermediate',
    durationWeeks: 16,
    raceTarget: 'none',
    tags: ['5/3/1', 'strength-focus', 'barbell'],
    weekPreview: [
      { type: 'lift', label: 'Squat' },
      { type: 'run', label: 'Easy 6km' },
      { type: 'lift', label: 'Bench' },
      { type: 'run', label: 'Easy 5km' },
      { type: 'lift', label: 'Deadlift' },
      { type: 'lift', label: 'OHP' },
      { type: 'rest', label: 'Rest' },
    ],
  },
  {
    id: 'running-priority',
    name: 'Running Priority',
    description: 'Race-focused plan maintaining strength gains. High mileage with minimalist lifting to stay strong.',
    goalBias: 'endurance',
    liftDays: 2,
    runVolume: 'high',
    level: 'intermediate',
    durationWeeks: 20,
    raceTarget: 'half',
    tags: ['race-prep', 'high-mileage', 'maintenance-lifts'],
    weekPreview: [
      { type: 'run', label: 'Easy 10km' },
      { type: 'lift', label: 'Upper' },
      { type: 'run', label: 'Tempo 8km' },
      { type: 'run', label: 'Easy 6km' },
      { type: 'lift', label: 'Lower' },
      { type: 'run', label: 'Long 19km' },
      { type: 'rest', label: 'Rest' },
    ],
  },
  {
    id: 'powerbuilding-tempo',
    name: 'Powerbuilding + Tempo',
    description: 'Hypertrophy-focused lifting block paired with threshold running. Build size and engine simultaneously.',
    goalBias: 'balanced',
    liftDays: 4,
    runVolume: 'medium',
    level: 'advanced',
    durationWeeks: 12,
    raceTarget: '10K',
    tags: ['powerbuilding', 'hypertrophy', 'threshold'],
    weekPreview: [
      { type: 'lift', label: 'Upper Power' },
      { type: 'run', label: 'Easy 8km' },
      { type: 'lift', label: 'Lower Power' },
      { type: 'run', label: 'Tempo 6km' },
      { type: 'lift', label: 'Upper Volume' },
      { type: 'hybrid', label: 'Lower+Easy' },
      { type: 'rest', label: 'Rest' },
    ],
  },
  {
    id: 'concurrent-peaking',
    name: 'Concurrent Peaking',
    description: 'Advanced periodization to peak strength and race fitness simultaneously. Requires careful recovery management.',
    goalBias: 'balanced',
    liftDays: 3,
    runVolume: 'medium',
    level: 'advanced',
    durationWeeks: 16,
    raceTarget: 'full',
    tags: ['peaking', 'concurrent', 'advanced-periodization'],
    weekPreview: [
      { type: 'lift', label: 'Heavy Squat' },
      { type: 'run', label: 'Easy 10km' },
      { type: 'run', label: 'Intervals' },
      { type: 'lift', label: 'Bench+OHP' },
      { type: 'run', label: 'Tempo 8km' },
      { type: 'lift', label: 'Deadlift' },
      { type: 'run', label: 'Long 26km' },
    ],
  },
  {
    id: 'couch-to-hybrid',
    name: 'Couch to Hybrid',
    description: 'Start from zero. Build a foundation of movement, basic barbell skills, and run/walk intervals over 16 weeks.',
    goalBias: 'balanced',
    liftDays: 3,
    runVolume: 'low',
    level: 'beginner',
    durationWeeks: 16,
    raceTarget: '5K',
    tags: ['beginner', 'foundation', 'run-walk'],
    weekPreview: [
      { type: 'lift', label: 'Full Body' },
      { type: 'run', label: 'Walk/Run' },
      { type: 'rest', label: 'Rest' },
      { type: 'lift', label: 'Full Body' },
      { type: 'run', label: 'Walk/Run' },
      { type: 'rest', label: 'Rest' },
      { type: 'lift', label: 'Full Body' },
    ],
  },
]

export interface Template {
  id: string
  name: string
  type: 'lift' | 'run' | 'hybrid'
  description: string
  duration: string
  exercises?: string[]
  effort?: string
  tags: string[]
}

export const templates: Template[] = [
  { id: 'upper-lower', name: 'Upper/Lower Split', type: 'lift', description: '4-day split alternating upper and lower body. Excellent for strength and hypertrophy.', duration: '60-75 min', exercises: ['Bench Press', 'Barbell Row', 'OHP', 'Pull-ups', 'Squats', 'Romanian Deadlift', 'Leg Press'], tags: ['4-day', 'hypertrophy', 'strength'] },
  { id: 'ppl', name: 'Push/Pull/Legs', type: 'lift', description: '6-day high frequency training. Each muscle hit twice per week.', duration: '60-80 min', exercises: ['Bench Press', 'OHP', 'Squat', 'Deadlift', 'Pull-ups', 'Barbell Row', 'Hip Thrust'], tags: ['6-day', 'high-frequency', 'hypertrophy'] },
  { id: 'full-body', name: 'Full Body 3x', type: 'lift', description: 'Three full-body sessions per week. Ideal for beginners and hybrid athletes.', duration: '50-65 min', exercises: ['Squat', 'Bench Press', 'Deadlift', 'Pull-ups', 'OHP'], tags: ['3-day', 'beginner', 'hybrid-friendly'] },
  { id: '531', name: '5/3/1 Programme', type: 'lift', description: 'Jim Wendler\'s classic. Linear progression on the big 4 lifts.', duration: '45-60 min', exercises: ['Squat', 'Bench Press', 'Deadlift', 'Overhead Press'], tags: ['4-day', 'strength', 'classic'] },
  { id: 'easy-run', name: 'Easy Run', type: 'run', description: 'Conversational pace aerobic run. Zone 2 effort, builds base fitness.', duration: '30-60 min', effort: 'Zone 2 (60-70% HRmax)', tags: ['aerobic', 'recovery', 'base'] },
  { id: 'tempo-run', name: 'Tempo Run', type: 'run', description: 'Comfortably hard sustained effort at threshold pace. Raises lactate threshold.', duration: '20-40 min', effort: 'Zone 3-4 (80-88% HRmax)', tags: ['threshold', 'speed', 'intermediate'] },
  { id: 'vo2max-intervals', name: 'VO2max Intervals', type: 'run', description: 'Short hard efforts at 5K pace or faster. Maximizes aerobic capacity.', duration: '30-45 min', effort: 'Zone 5 (95%+ HRmax)', tags: ['intervals', 'speed', 'advanced'] },
  { id: 'long-run', name: 'Long Run', type: 'run', description: 'Weekly long easy run for endurance development. The cornerstone of any running plan.', duration: '60-180 min', effort: 'Zone 2 (easy)', tags: ['endurance', 'weekly', 'base'] },
  { id: 'heavy-squat-easy-run', name: 'Heavy Squat + Easy Run', type: 'hybrid', description: 'Squat heavy first, then easy run after 2+ hours. Classic hybrid session.', duration: '90-120 min', tags: ['lower', 'aerobic', 'same-day'] },
  { id: 'upper-tempo', name: 'Upper Body + Tempo', type: 'hybrid', description: 'Upper body lift followed by tempo run. Lower limb interference minimized.', duration: '90-100 min', tags: ['upper', 'threshold', 'low-interference'] },
]

export interface Exercise {
  id: string
  name: string
  category: 'barbell' | 'dumbbell' | 'machine' | 'bodyweight' | 'run-drill' | 'mobility'
  primaryMuscles: string[]
  cues: string[]
}

export const exercises: Exercise[] = [
  { id: 'squat', name: 'Back Squat', category: 'barbell', primaryMuscles: ['Quads', 'Glutes', 'Hamstrings'], cues: ['Bar on traps, not neck', 'Chest up, brace core', 'Drive knees out', 'Break parallel'] },
  { id: 'bench', name: 'Bench Press', category: 'barbell', primaryMuscles: ['Chest', 'Triceps', 'Front Delts'], cues: ['Arch naturally, not excessively', 'Tuck elbows 45°', 'Bar to lower chest', 'Drive feet into floor'] },
  { id: 'deadlift', name: 'Conventional Deadlift', category: 'barbell', primaryMuscles: ['Hamstrings', 'Glutes', 'Back'], cues: ['Bar over mid-foot', 'Lat pulldown cue', 'Push floor away', 'Lock hips at top'] },
  { id: 'ohp', name: 'Overhead Press', category: 'barbell', primaryMuscles: ['Shoulders', 'Triceps', 'Upper Chest'], cues: ['Bar at clavicle start', 'Brace and squeeze glutes', 'Press slightly back overhead', 'Full lockout'] },
  { id: 'row', name: 'Barbell Row', category: 'barbell', primaryMuscles: ['Lats', 'Rhomboids', 'Biceps'], cues: ['Hinge 45° forward', 'Pull to lower chest', 'Drive elbows back', 'Squeeze at top'] },
  { id: 'rdl', name: 'Romanian Deadlift', category: 'barbell', primaryMuscles: ['Hamstrings', 'Glutes'], cues: ['Soft knee bend', 'Push hips back', 'Bar drags down legs', 'Feel stretch before reversing'] },
  { id: 'incline-press', name: 'Incline Bench Press', category: 'barbell', primaryMuscles: ['Upper Chest', 'Front Delts', 'Triceps'], cues: ['30-45° incline', 'Same bench cues apply', 'Slightly wider grip'] },
  { id: 'pullup', name: 'Pull-up', category: 'bodyweight', primaryMuscles: ['Lats', 'Biceps', 'Core'], cues: ['Dead hang start', 'Pull chest to bar', 'Full range of motion', 'Controlled descent'] },
  { id: 'dip', name: 'Tricep Dip', category: 'bodyweight', primaryMuscles: ['Triceps', 'Chest', 'Front Delts'], cues: ['Lean slightly forward', 'Elbows flared slightly', 'Full depth'] },
  { id: 'lunge', name: 'Walking Lunge', category: 'bodyweight', primaryMuscles: ['Quads', 'Glutes', 'Hamstrings'], cues: ['Long stride', 'Back knee near floor', 'Keep torso upright'] },
  { id: 'hip-thrust', name: 'Hip Thrust', category: 'machine', primaryMuscles: ['Glutes', 'Hamstrings'], cues: ['Bench at shoulder blade height', 'Drive hips to parallel', 'Squeeze glutes at top'] },
  { id: 'leg-press', name: 'Leg Press', category: 'machine', primaryMuscles: ['Quads', 'Glutes'], cues: ['Feet shoulder width', 'Full range of motion', 'Don\'t lock knees aggressively'] },
  { id: 'lat-pulldown', name: 'Lat Pulldown', category: 'machine', primaryMuscles: ['Lats', 'Biceps'], cues: ['Lean back slightly', 'Pull to upper chest', 'Squeeze lats'] },
  { id: 'cable-row', name: 'Seated Cable Row', category: 'machine', primaryMuscles: ['Lats', 'Rhomboids', 'Biceps'], cues: ['Tall posture', 'Pull to navel', 'Squeeze shoulder blades'] },
  { id: 'db-curl', name: 'Dumbbell Curl', category: 'dumbbell', primaryMuscles: ['Biceps', 'Brachialis'], cues: ['Supinate at top', 'No swinging', 'Full extension at bottom'] },
  { id: 'a-skips', name: 'A-Skips', category: 'run-drill', primaryMuscles: ['Hip Flexors', 'Calves'], cues: ['High knee drive', 'Dorsiflexion', 'Arm drive matches legs'] },
  { id: 'b-skips', name: 'B-Skips', category: 'run-drill', primaryMuscles: ['Hamstrings', 'Hip Flexors'], cues: ['Kick forward at peak', 'Stay tall', 'Quick ground contact'] },
  { id: 'c-skips', name: 'C-Skips', category: 'run-drill', primaryMuscles: ['Hip Flexors', 'Hamstrings', 'Glutes'], cues: ['Combine A-skip knee drive with B-skip kick-through', 'Full circular leg action', 'Stay tall, drive arms', 'Smooth rhythm throughout'] },
  { id: 'strides', name: 'Running Strides', category: 'run-drill', primaryMuscles: ['Full Body'], cues: ['80-95% effort', '80-100m distance', 'Relax between strides', '4-6 reps'] },
  { id: 'butt-kicks', name: 'Butt Kicks', category: 'run-drill', primaryMuscles: ['Hamstrings', 'Calves'], cues: ['Heel to glute each stride', 'Quick cadence, minimal ground time', 'Keep hips forward', 'Light on your feet'] },
  { id: 'carioca', name: 'Carioca', category: 'run-drill', primaryMuscles: ['Hip Abductors', 'Hip Adductors', 'Glutes'], cues: ['Lateral movement, crossover steps', 'Rotate hips fully on each cross', 'Stay on balls of feet', 'Keep shoulders square'] },
  { id: 'ankling', name: 'Ankling', category: 'run-drill', primaryMuscles: ['Calves', 'Achilles', 'Foot'], cues: ['Quick low cycles, minimal knee lift', 'Dorsiflexed foot on contact', 'Focus on foot stiffness', 'Fast cadence, very short ground contact'] },
  { id: 'bounding', name: 'Bounding', category: 'run-drill', primaryMuscles: ['Glutes', 'Hamstrings', 'Calves'], cues: ['Exaggerated running stride', 'Powerful push-off each step', 'Drive opposite knee up aggressively', 'Cover maximum ground per stride'] },
  { id: 'fast-legs', name: 'Fast Legs', category: 'run-drill', primaryMuscles: ['Hip Flexors', 'Calves'], cues: ['Rapid leg turnover, very short stride', 'Stay relaxed in upper body', 'Focus on cadence not distance', 'Land under hips'] },
  { id: 'straight-leg-shuffle', name: 'Straight Leg Shuffle', category: 'run-drill', primaryMuscles: ['Calves', 'Hamstrings', 'Glutes'], cues: ['Keep legs nearly straight throughout', 'Pawing action — pull foot back under hips', 'Lean slightly forward', 'Lead with hips, not chest'] },
  { id: 'power-skips', name: 'Power Skips', category: 'run-drill', primaryMuscles: ['Glutes', 'Calves', 'Hip Flexors'], cues: ['Maximum height per skip', 'Drive knee and opposite arm up together', 'Full extension of push-off leg', 'Land on ball of foot and immediately skip again'] },
  { id: 'wall-drill', name: 'Wall Drill', category: 'run-drill', primaryMuscles: ['Hip Flexors', 'Glutes', 'Core'], cues: ['Lean into wall at 45°, arms straight', 'Drive one knee to 90° and hold', 'Alternate legs rhythmically', 'Maintain dorsiflexion throughout'] },
  { id: 'arm-drive-drill', name: 'Arm Drive Drill', category: 'run-drill', primaryMuscles: ['Shoulders', 'Triceps', 'Core'], cues: ['90° bend at elbow', 'Drive back to hip, not across body', 'Relaxed hands — imagine holding crisps without crushing them', 'Shoulders down and back'] },
  { id: 'falling-starts', name: 'Falling Starts', category: 'run-drill', primaryMuscles: ['Glutes', 'Calves', 'Core'], cues: ['Stand tall, lean forward from ankles (not waist)', 'When balance point breaks, catch yourself with one leg', 'Immediately accelerate into a 20m stride', 'Trains forward lean and explosive first step'] },
  { id: 'backward-running', name: 'Backward Running', category: 'run-drill', primaryMuscles: ['Glutes', 'Hamstrings', 'Calves'], cues: ['Push off ball of foot', 'Stay upright, look over shoulder periodically', 'Engages posterior chain differently', 'Good for active recovery and coordination'] },
  { id: 'running-marching', name: 'Running Marching', category: 'run-drill', primaryMuscles: ['Hip Flexors', 'Glutes', 'Core'], cues: ['Slow exaggerated A-skip motion', 'Hold each knee at 90° for a beat', 'Full hip extension on standing leg', 'Used to ingrain correct drive mechanics'] },
  { id: 'rhythm-bounds', name: 'Rhythm Bounds', category: 'run-drill', primaryMuscles: ['Glutes', 'Hamstrings', 'Calves'], cues: ['Triple extension: ankle, knee, hip', 'Maintain consistent rhythm between bounds', 'Soft landing, immediate rebound', 'Arms work in opposition to legs'] },
  { id: 'hip-flexor-stretch', name: 'Hip Flexor Stretch', category: 'mobility', primaryMuscles: ['Hip Flexors', 'Quads'], cues: ['Lunge position', 'Posterior pelvic tilt', '60+ seconds per side'] },
  { id: 'thoracic-rotation', name: 'Thoracic Rotation', category: 'mobility', primaryMuscles: ['Thoracic Spine', 'Lats'], cues: ['90/90 position', 'Rotate from thorax not hips', 'Full range each rep'] },

  // ── Barbell ──────────────────────────────────────────────────────────────────
  { id: 'front-squat', name: 'Front Squat', category: 'barbell', primaryMuscles: ['Quads', 'Core', 'Upper Back'], cues: ['Elbows high, rack position', 'Torso stays vertical', 'Knees track toes', 'Break parallel'] },
  { id: 'sumo-deadlift', name: 'Sumo Deadlift', category: 'barbell', primaryMuscles: ['Glutes', 'Adductors', 'Hamstrings'], cues: ['Wide stance, toes flared', 'Grip inside knees', 'Push floor apart', 'Drive hips through at lockout'] },
  { id: 'hex-bar-deadlift', name: 'Hex Bar Deadlift', category: 'barbell', primaryMuscles: ['Quads', 'Glutes', 'Hamstrings', 'Back'], cues: ['Sit into the handles', 'Chest up, neutral spine', 'Push floor away', 'Hips and shoulders rise together'] },
  { id: 'power-clean', name: 'Power Clean', category: 'barbell', primaryMuscles: ['Full Body', 'Traps', 'Glutes'], cues: ['Bar over mid-foot', 'Triple extension: ankles, knees, hips', 'High pull then drop under', 'Catch in quarter squat'] },
  { id: 'clean-and-jerk', name: 'Clean and Jerk', category: 'barbell', primaryMuscles: ['Full Body', 'Shoulders', 'Traps'], cues: ['Clean to front rack', 'Dip and drive with legs', 'Press bar overhead', 'Lock out arms fully'] },
  { id: 'snatch', name: 'Snatch', category: 'barbell', primaryMuscles: ['Full Body', 'Shoulders', 'Traps'], cues: ['Wide grip, snatch grip', 'Bar close to body throughout', 'Full triple extension', 'Receive with arms locked out'] },
  { id: 'clean', name: 'Clean', category: 'barbell', primaryMuscles: ['Full Body', 'Traps', 'Glutes'], cues: ['Start like a deadlift', 'Accelerate through mid-thigh', 'Pull under bar fast', 'Front rack catch position'] },
  { id: 'push-press', name: 'Push Press', category: 'barbell', primaryMuscles: ['Shoulders', 'Triceps', 'Legs'], cues: ['Shallow dip with knees', 'Drive legs then press', 'Lock out overhead', 'Control the descent'] },
  { id: 'close-grip-bench', name: 'Close Grip Bench Press', category: 'barbell', primaryMuscles: ['Triceps', 'Chest', 'Front Delts'], cues: ['Grip shoulder-width or slightly inside', 'Elbows tucked tight', 'Bar to lower chest', 'Triceps drive at lockout'] },
  { id: 'decline-bench', name: 'Decline Bench Press', category: 'barbell', primaryMuscles: ['Lower Chest', 'Triceps', 'Front Delts'], cues: ['Feet anchored securely', 'Bar to lower pec', 'Same press cues as flat bench', 'Spotter advised'] },
  { id: 'barbell-curl', name: 'Barbell Curl', category: 'barbell', primaryMuscles: ['Biceps', 'Brachialis'], cues: ['Elbows fixed at sides', 'Supinate wrists at top', 'No swinging', 'Full extension at bottom'] },
  { id: 'ez-bar-curl', name: 'EZ Bar Curl', category: 'barbell', primaryMuscles: ['Biceps', 'Brachialis'], cues: ['Semi-supinated grip reduces wrist stress', 'Elbows pinned at sides', 'Full ROM', 'Slow eccentric'] },
  { id: 'preacher-curl', name: 'Preacher Curl', category: 'barbell', primaryMuscles: ['Biceps', 'Brachialis'], cues: ['Arm against pad throughout', 'Don\'t hyperextend at bottom', 'Squeeze hard at top', 'Control the negative'] },
  { id: 'lying-tricep-extension', name: 'Lying Tricep Extension', category: 'barbell', primaryMuscles: ['Triceps'], cues: ['Lower bar to forehead or behind head', 'Elbows pointed at ceiling', 'Extend fully at top', 'Keep upper arms vertical'] },
  { id: 'barbell-shrug', name: 'Barbell Shrug', category: 'barbell', primaryMuscles: ['Traps', 'Upper Back'], cues: ['Hold with double overhand or straps', 'Shrug straight up, no rolling', 'Hold 1 sec at top', 'Full depression at bottom'] },
  { id: 't-bar-row', name: 'T-Bar Row', category: 'barbell', primaryMuscles: ['Lats', 'Rhomboids', 'Biceps'], cues: ['Chest on pad or free-standing hinge', 'Drive elbows back', 'Squeeze shoulder blades', 'Full stretch at bottom'] },
  { id: 'seated-shoulder-press', name: 'Seated Shoulder Press', category: 'barbell', primaryMuscles: ['Shoulders', 'Triceps'], cues: ['Bar at clavicle, press overhead', 'Don\'t arch excessively', 'Full lockout at top', 'Core braced throughout'] },
  { id: 'hack-squat-barbell', name: 'Hack Squat (Barbell)', category: 'barbell', primaryMuscles: ['Quads', 'Glutes'], cues: ['Bar behind heels', 'Upright torso', 'Drive through heels', 'Full depth'] },

  // ── Dumbbell ─────────────────────────────────────────────────────────────────
  { id: 'db-bench', name: 'Dumbbell Bench Press', category: 'dumbbell', primaryMuscles: ['Chest', 'Triceps', 'Front Delts'], cues: ['Full ROM — greater stretch than barbell', 'Neutral or pronated grip', 'Touch dumbbells lightly at top', 'Control the descent'] },
  { id: 'db-incline-bench', name: 'Incline Dumbbell Bench Press', category: 'dumbbell', primaryMuscles: ['Upper Chest', 'Front Delts', 'Triceps'], cues: ['30–45° incline', 'Dumbbells at shoulder height start', 'Press up and slightly together', 'Slow eccentric for stretch'] },
  { id: 'db-shoulder-press', name: 'Dumbbell Shoulder Press', category: 'dumbbell', primaryMuscles: ['Shoulders', 'Triceps'], cues: ['Start at ear height', 'Press straight up', 'Slight arc inward at top', 'Don\'t shrug at lockout'] },
  { id: 'db-seated-shoulder-press', name: 'Seated Dumbbell Shoulder Press', category: 'dumbbell', primaryMuscles: ['Shoulders', 'Triceps'], cues: ['Back supported reduces spinal load', 'Full press overhead', 'Control descent to ear level', 'Keep core tight'] },
  { id: 'db-lateral-raise', name: 'Dumbbell Lateral Raise', category: 'dumbbell', primaryMuscles: ['Lateral Delts', 'Traps'], cues: ['Slight forward lean', 'Lead with elbows, not wrists', 'Raise to shoulder height', 'Slow controlled negative'] },
  { id: 'db-row', name: 'Dumbbell Row', category: 'dumbbell', primaryMuscles: ['Lats', 'Rhomboids', 'Biceps'], cues: ['Brace on bench with opposite hand', 'Pull elbow to hip', 'Retract shoulder blade at top', 'Full stretch at bottom'] },
  { id: 'hammer-curl', name: 'Hammer Curl', category: 'dumbbell', primaryMuscles: ['Brachialis', 'Biceps', 'Forearms'], cues: ['Neutral grip (thumbs up)', 'Elbows fixed at sides', 'Full curl to shoulder', 'Great for forearm thickness'] },
  { id: 'db-bulgarian-split-squat', name: 'Dumbbell Bulgarian Split Squat', category: 'dumbbell', primaryMuscles: ['Quads', 'Glutes', 'Hamstrings'], cues: ['Rear foot elevated on bench', 'Front foot far enough forward', 'Vertical torso preferred', 'Back knee toward floor'] },
  { id: 'goblet-squat', name: 'Goblet Squat', category: 'dumbbell', primaryMuscles: ['Quads', 'Glutes', 'Core'], cues: ['Hold dumbbell at chest', 'Elbows inside knees at bottom', 'Upright torso', 'Great teaching squat pattern'] },
  { id: 'db-fly', name: 'Dumbbell Fly', category: 'dumbbell', primaryMuscles: ['Chest', 'Front Delts'], cues: ['Slight bend in elbows throughout', 'Wide arc downward', 'Stretch at bottom', 'Squeeze at top — hug a tree'] },
  { id: 'db-shrug', name: 'Dumbbell Shrug', category: 'dumbbell', primaryMuscles: ['Traps', 'Upper Back'], cues: ['Arms at sides', 'Shrug straight up', 'Hold 1 sec at top', 'No rolling motion'] },

  // ── Machine ───────────────────────────────────────────────────────────────────
  { id: 'tricep-pushdown', name: 'Tricep Pushdown', category: 'machine', primaryMuscles: ['Triceps'], cues: ['Elbows pinned at sides', 'Full extension at bottom', 'Controlled return', 'Rope or bar attachment'] },
  { id: 'chest-press-machine', name: 'Chest Press Machine', category: 'machine', primaryMuscles: ['Chest', 'Triceps', 'Front Delts'], cues: ['Adjust seat so handles are at chest height', 'Press straight forward', 'Full extension without locking out hard', 'Control the return'] },
  { id: 'machine-shoulder-press', name: 'Machine Shoulder Press', category: 'machine', primaryMuscles: ['Shoulders', 'Triceps'], cues: ['Adjust seat height', 'Press overhead fully', 'Keep back against pad', 'Control descent'] },
  { id: 'machine-chest-fly', name: 'Machine Chest Fly', category: 'machine', primaryMuscles: ['Chest', 'Front Delts'], cues: ['Slight bend in elbows', 'Wide arc', 'Squeeze at front', 'Slow eccentric for chest stretch'] },
  { id: 'leg-extension', name: 'Leg Extension', category: 'machine', primaryMuscles: ['Quads'], cues: ['Adjust pad above ankles', 'Extend fully at top', 'Squeeze quads at lockout', 'Slow controlled negative'] },
  { id: 'seated-leg-curl', name: 'Seated Leg Curl', category: 'machine', primaryMuscles: ['Hamstrings'], cues: ['Thigh pad snug', 'Curl to full flexion', 'Hold briefly at top', 'Slow extension'] },
  { id: 'lying-leg-curl', name: 'Lying Leg Curl', category: 'machine', primaryMuscles: ['Hamstrings'], cues: ['Hips flat on pad', 'Curl heels toward glutes', 'Pause at top', 'Control the negative'] },
  { id: 'machine-calf-raise', name: 'Machine Calf Raise', category: 'machine', primaryMuscles: ['Calves', 'Soleus'], cues: ['Full range — deep stretch at bottom', 'Rise on balls of feet', 'Pause at top', 'Straight-leg hits gastroc'] },
  { id: 'hip-adduction', name: 'Hip Adduction Machine', category: 'machine', primaryMuscles: ['Adductors', 'Inner Thighs'], cues: ['Controlled movement', 'Full ROM', 'Don\'t let weight slam', 'Pause at peak contraction'] },
  { id: 'smith-machine-bench', name: 'Smith Machine Bench Press', category: 'machine', primaryMuscles: ['Chest', 'Triceps', 'Front Delts'], cues: ['Fixed bar path — adjust grip accordingly', 'Bar to lower chest', 'Spotter not required vs free bar', 'Useful for training alone'] },
  { id: 'hack-squat-machine', name: 'Hack Squat Machine', category: 'machine', primaryMuscles: ['Quads', 'Glutes'], cues: ['Shoulder pads firm', 'Full depth', 'Push through heels', 'Knees track toes'] },
  { id: 'sled-leg-press', name: 'Sled Leg Press', category: 'machine', primaryMuscles: ['Quads', 'Glutes', 'Hamstrings'], cues: ['Foot position affects muscle emphasis', 'Full ROM — don\'t short the depth', 'Don\'t lock knees at top aggressively', 'Slow controlled negative'] },
  { id: 'horizontal-leg-press', name: 'Horizontal Leg Press', category: 'machine', primaryMuscles: ['Quads', 'Glutes', 'Hamstrings'], cues: ['Back flat against pad', 'Feet shoulder-width on platform', 'Full ROM — don\'t lock knees', 'Control the return'] },

  // ── Bodyweight ─────────────────────────────────────────────────────────────────
  { id: 'push-ups', name: 'Push Ups', category: 'bodyweight', primaryMuscles: ['Chest', 'Triceps', 'Front Delts'], cues: ['Hands shoulder-width', 'Body plank — no sagging hips', 'Chest to floor', 'Full lockout at top'] },
  { id: 'chin-ups', name: 'Chin Ups', category: 'bodyweight', primaryMuscles: ['Biceps', 'Lats', 'Core'], cues: ['Supinated (palms facing you) grip', 'Chest to bar', 'Full dead hang start', 'Controlled descent'] },
  { id: 'neutral-grip-pull-ups', name: 'Neutral Grip Pull Ups', category: 'bodyweight', primaryMuscles: ['Lats', 'Biceps', 'Brachialis'], cues: ['Palms facing each other', 'Easier on elbows/shoulders', 'Full ROM', 'Drive elbows to hips'] },
  { id: 'muscle-ups', name: 'Muscle Ups', category: 'bodyweight', primaryMuscles: ['Lats', 'Chest', 'Triceps', 'Core'], cues: ['False grip for rings version', 'Explosive pull, then transition', 'Push to lockout at top', 'Core tight throughout'] },
  { id: 'crunches', name: 'Crunches', category: 'bodyweight', primaryMuscles: ['Rectus Abdominis'], cues: ['Hands behind head lightly', 'Curl shoulders off floor', 'Don\'t pull neck', 'Exhale at top'] },
  { id: 'sit-ups', name: 'Sit Ups', category: 'bodyweight', primaryMuscles: ['Rectus Abdominis', 'Hip Flexors'], cues: ['Feet anchored or free', 'Full ROM — shoulder blades to floor', 'Cross arms or hands behind head', 'Control the descent'] },
  { id: 'bodyweight-squat', name: 'Bodyweight Squat', category: 'bodyweight', primaryMuscles: ['Quads', 'Glutes', 'Hamstrings'], cues: ['Feet shoulder-width, toes slightly out', 'Sit back and down', 'Knees track toes', 'Chest up throughout'] },
  { id: 'one-arm-push-ups', name: 'One Arm Push Ups', category: 'bodyweight', primaryMuscles: ['Chest', 'Triceps', 'Core'], cues: ['Wide foot stance for stability', 'Arm centred under chest', 'Keep hips level', 'Full ROM'] },
  { id: 'diamond-push-ups', name: 'Diamond Push Ups', category: 'bodyweight', primaryMuscles: ['Triceps', 'Inner Chest'], cues: ['Hands form a diamond below sternum', 'Elbows close to body', 'Chest touches hands', 'Triceps drive the press'] },
  { id: 'plank', name: 'Plank', category: 'bodyweight', primaryMuscles: ['Core', 'Shoulders'], cues: ['Forearms flat, elbows under shoulders', 'Body in straight line — no sagging hips', 'Squeeze glutes and core', 'Breathe steadily'] },
  { id: 'side-plank', name: 'Side Plank', category: 'bodyweight', primaryMuscles: ['Core', 'Glutes'], cues: ['Elbow under shoulder', 'Hips stacked, body straight', 'Don\'t let hips sag', 'Hold or add hip dips for variation'] },
  { id: 'glute-bridge', name: 'Glute Bridge', category: 'bodyweight', primaryMuscles: ['Glutes', 'Hamstrings'], cues: ['Feet flat, knees at 90°', 'Drive hips to ceiling', 'Squeeze glutes hard at top', 'Pause 1–2 sec before lowering'] },
  { id: 'burpee', name: 'Burpee', category: 'bodyweight', primaryMuscles: ['Full Body'], cues: ['Jump feet back to plank', 'Chest to floor', 'Jump feet forward then explode up', 'Arms overhead at jump'] },
  { id: 'mountain-climbers', name: 'Mountain Climbers', category: 'bodyweight', primaryMuscles: ['Core', 'Hip Flexors', 'Shoulders'], cues: ['High plank position', 'Drive knee to chest', 'Alternate fast or slow', 'Hips stay low and level'] },
  { id: 'bird-dog', name: 'Bird Dog', category: 'bodyweight', primaryMuscles: ['Core', 'Glutes'], cues: ['All fours, neutral spine', 'Extend opposite arm and leg simultaneously', 'Don\'t rotate hips', 'Return and repeat other side'] },
  { id: 'bear-crawl', name: 'Bear Crawl', category: 'bodyweight', primaryMuscles: ['Core', 'Shoulders', 'Quads'], cues: ['Hands and toes on floor, knees hovering 1 inch', 'Move opposite hand and foot together', 'Keep back flat', 'Stay slow and controlled'] },
  { id: 'jump-squat', name: 'Jump Squat', category: 'bodyweight', primaryMuscles: ['Quads', 'Glutes', 'Calves'], cues: ['Squat to parallel', 'Explode through heels', 'Soft landing — absorb through knees and hips', 'Immediate reset for next rep'] },
  { id: 'reverse-lunge', name: 'Reverse Lunge', category: 'bodyweight', primaryMuscles: ['Quads', 'Glutes', 'Hamstrings'], cues: ['Step back and lower back knee toward floor', 'Keep front shin vertical', 'Torso upright throughout', 'Drive front heel to return'] },
  { id: 'pistol-squat', name: 'Pistol Squat', category: 'bodyweight', primaryMuscles: ['Quads', 'Glutes', 'Core'], cues: ['One leg extended forward', 'Sit all the way down on working leg', 'Keep heel flat', 'Use arms for balance if needed'] },
  { id: 'superman', name: 'Superman', category: 'bodyweight', primaryMuscles: ['Glutes', 'Hamstrings'], cues: ['Lie face down, arms extended', 'Lift chest, arms and legs simultaneously', 'Squeeze glutes at top', 'Hold 2 sec then lower'] },
  { id: 'leg-raise', name: 'Leg Raise', category: 'bodyweight', primaryMuscles: ['Core', 'Hip Flexors'], cues: ['Flat on back, hands under hips', 'Keep legs straight', 'Lower to just above floor', 'Don\'t let lower back arch away from floor'] },
  { id: 'bicycle-crunch', name: 'Bicycle Crunch', category: 'bodyweight', primaryMuscles: ['Core'], cues: ['Hands behind head lightly', 'Rotate elbow toward opposite knee', 'Extend opposite leg low', 'Slow and controlled — not a race'] },
  { id: 'hollow-body-hold', name: 'Hollow Body Hold', category: 'bodyweight', primaryMuscles: ['Core'], cues: ['Lower back pressed into floor', 'Arms overhead, legs extended low', 'The lower the legs, the harder', 'Breathe shallow — stay braced'] },
  { id: 'pike-push-up', name: 'Pike Push Up', category: 'bodyweight', primaryMuscles: ['Shoulders', 'Triceps'], cues: ['Hips high, body inverted V', 'Lower head toward floor between hands', 'Press back to top', 'Progression toward handstand push up'] },
  { id: 'wall-sit', name: 'Wall Sit', category: 'bodyweight', primaryMuscles: ['Quads', 'Glutes'], cues: ['Back flat against wall', 'Thighs parallel to floor', 'Knees at 90°', 'Hold position — time under tension'] },
  { id: 'inchworm', name: 'Inchworm', category: 'bodyweight', primaryMuscles: ['Hamstrings', 'Core', 'Shoulders'], cues: ['Stand tall, fold and walk hands out to plank', 'Optional push up', 'Walk feet toward hands', 'Stand and repeat'] },
  { id: 'high-knees', name: 'High Knees', category: 'bodyweight', primaryMuscles: ['Hip Flexors', 'Quads', 'Calves'], cues: ['Drive knees to hip height', 'Quick feet, light contact', 'Pump arms to match', 'Tall posture throughout'] },
  { id: 'step-up', name: 'Step Up', category: 'bodyweight', primaryMuscles: ['Quads', 'Glutes'], cues: ['Full foot on the box', 'Drive through heel of lead foot', 'Don\'t push off trailing foot', 'Stand fully upright at top'] },
  { id: 'dead-bug', name: 'Dead Bug', category: 'bodyweight', primaryMuscles: ['Core'], cues: ['Lower back pressed into floor throughout', 'Extend opposite arm and leg', 'Breathe out as you extend', 'Return slowly and repeat other side'] },
  { id: 'contralateral-limb-raise', name: 'Contralateral Limb Raise', category: 'bodyweight', primaryMuscles: ['Glutes', 'Hamstrings'], cues: ['Lie prone, arms extended', 'Raise opposite arm and leg together', 'Keep hips level', 'Slow and controlled both directions'] },
  { id: 'split-squat-jump', name: 'Split Squat Jump', category: 'bodyweight', primaryMuscles: ['Quads', 'Glutes', 'Calves'], cues: ['Start in split stance', 'Explode and switch legs mid-air', 'Soft landing — absorb impact', 'Keep torso upright throughout'] },

  // ── Mobility (ACE) ─────────────────────────────────────────────────────────────
  { id: 'cat-cow', name: 'Cat-Cow', category: 'mobility', primaryMuscles: ['Core'], cues: ['On all fours, wrists under shoulders', 'Cat: round spine toward ceiling, tuck chin and pelvis', 'Cow: drop belly, lift head and tailbone', 'Flow slowly with breath — 1–2 sec per position'] },
  { id: 'childs-pose', name: "Child's Pose", category: 'mobility', primaryMuscles: ['Lats', 'Glutes'], cues: ['Kneel and sink hips toward heels', 'Arms extended forward or at sides', 'Breathe into lower back', 'Hold 30–60 seconds'] },
  { id: 'cobra', name: 'Cobra', category: 'mobility', primaryMuscles: ['Core'], cues: ['Lie prone, hands under shoulders', 'Press chest up using back muscles — not arms', 'Pelvis stays on floor', 'Hold 3–5 sec or flow in and out'] },
  { id: 'pigeon-pose', name: 'Pigeon Pose', category: 'mobility', primaryMuscles: ['Glutes', 'Hip Flexors'], cues: ['Front shin roughly parallel to hips', 'Square hips toward floor', 'Fold forward over front leg for deeper stretch', 'Hold 45–90 sec per side'] },
  { id: 'worlds-greatest-stretch', name: "World's Greatest Stretch", category: 'mobility', primaryMuscles: ['Hip Flexors', 'Thoracic Spine', 'Hamstrings'], cues: ['Lunge forward, same hand to floor', 'Rotate upper arm to ceiling', 'Then reach arm under for thoracic rotation', 'Full sequence one side before switching'] },
]

export interface AnalyticsWeek {
  week: string
  squatRM: number
  benchRM: number
  deadliftRM: number
  weeklyKm: number
  volume: number
  vdot: number
}

export const analyticsData: AnalyticsWeek[] = [
  { week: 'W1',  squatRM: 111, benchRM: 75,  deadliftRM: 143, weeklyKm: 24,  volume: 14500, vdot: 44.0 },
  { week: 'W2',  squatRM: 113, benchRM: 76,  deadliftRM: 145, weeklyKm: 27,  volume: 15200, vdot: 44.2 },
  { week: 'W3',  squatRM: 116, benchRM: 77,  deadliftRM: 147, weeklyKm: 32,  volume: 15500, vdot: 44.5 },
  { week: 'W4',  squatRM: 118, benchRM: 78,  deadliftRM: 150, weeklyKm: 35,  volume: 15900, vdot: 44.8 },
  { week: 'W5',  squatRM: 120, benchRM: 79,  deadliftRM: 152, weeklyKm: 40,  volume: 16300, vdot: 45.1 },
  { week: 'W6',  squatRM: 122, benchRM: 80,  deadliftRM: 154, weeklyKm: 45,  volume: 16800, vdot: 45.5 },
  { week: 'W7',  squatRM: 122, benchRM: 81,  deadliftRM: 155, weeklyKm: 56,  volume: 16600, vdot: 46.0 },
  { week: 'W8',  squatRM: 121, benchRM: 81,  deadliftRM: 154, weeklyKm: 61,  volume: 16200, vdot: 46.3 },
  { week: 'W9',  squatRM: 122, benchRM: 81,  deadliftRM: 155, weeklyKm: 58,  volume: 16300, vdot: 46.5 },
  { week: 'W10', squatRM: 125, benchRM: 82,  deadliftRM: 156, weeklyKm: 45,  volume: 16900, vdot: 46.4 },
  { week: 'W11', squatRM: 127, benchRM: 83,  deadliftRM: 159, weeklyKm: 35,  volume: 17500, vdot: 46.2 },
  { week: 'W12', squatRM: 129, benchRM: 84,  deadliftRM: 161, weeklyKm: 29,  volume: 18100, vdot: 46.0 },
]

export interface Session {
  id: string
  date: string
  type: 'lift' | 'run' | 'hybrid'
  name: string
  details: string
  duration: number
}

export const recentSessions: Session[] = [
  { id: '1', date: '2026-03-18', type: 'lift', name: 'Squat Day', details: 'Squat 138×5×3, RDL 102×8×3, Leg Press 163×12×3', duration: 65 },
  { id: '2', date: '2026-03-17', type: 'run', name: 'Easy Run', details: '10 km @ 5:33/km — Zone 2 aerobic', duration: 55 },
  { id: '3', date: '2026-03-16', type: 'hybrid', name: 'Upper + Tempo', details: 'Bench 84×5×3, OHP 61×5×3 → Tempo 6km @ 4:33/km', duration: 95 },
  { id: '4', date: '2026-03-14', type: 'lift', name: 'Deadlift Day', details: 'Deadlift 156×3×3, Row 84×8×3, Pull-ups 3×8', duration: 70 },
  { id: '5', date: '2026-03-13', type: 'run', name: 'Long Run', details: '22.5 km @ 5:42/km — Weekly long run', duration: 128 },
]
