'use client'

const MUSCLE_TO_REGIONS: Record<string, string[]> = {
  'Chest': ['chest'],
  'Upper Chest': ['chest'],
  'Lower Chest': ['chest'],
  'Inner Chest': ['chest'],
  'Triceps': ['arms'],
  'Biceps': ['arms'],
  'Brachialis': ['arms'],
  'Forearms': ['forearms'],
  'Shoulders': ['shoulders'],
  'Front Delts': ['shoulders'],
  'Lateral Delts': ['shoulders'],
  'Rear Delts': ['shoulders'],
  'Traps': ['traps'],
  'Upper Back': ['traps'],
  'Rhomboids': ['traps'],
  'Lats': ['lats'],
  'Core': ['abs'],
  'Rectus Abdominis': ['abs'],
  'Hip Flexors': ['hips'],
  'Glutes': ['hips'],
  'Adductors': ['adductors'],
  'Inner Thighs': ['adductors'],
  'Quads': ['quads'],
  'Hamstrings': ['quads'],
  'Calves': ['calves'],
  'Soleus': ['calves'],
  'Full Body': ['chest', 'abs', 'quads', 'shoulders', 'lats', 'arms', 'traps', 'hips', 'forearms', 'calves'],
}

function getActiveRegions(primaryMuscles: string[]): Set<string> {
  const active = new Set<string>()
  for (const muscle of primaryMuscles) {
    for (const [key, regions] of Object.entries(MUSCLE_TO_REGIONS)) {
      if (
        muscle.toLowerCase() === key.toLowerCase() ||
        muscle.toLowerCase().includes(key.toLowerCase()) ||
        key.toLowerCase().includes(muscle.toLowerCase())
      ) {
        regions.forEach(r => active.add(r))
      }
    }
  }
  return active
}

export default function MuscleBodyMap({ primaryMuscles, color }: { primaryMuscles: string[]; color: string }) {
  const active = getActiveRegions(primaryMuscles)

  const f = (region: string) => active.has(region) ? color : '#2A2A2A'
  const neutral = '#252525'

  return (
    <svg viewBox="0 0 80 185" width="56" height="130" style={{ display: 'block', flexShrink: 0 }}>
      {/* Head */}
      <ellipse cx="40" cy="12" rx="11" ry="12" fill={neutral} />

      {/* Neck */}
      <rect x="36" y="23" width="8" height="8" rx="2" fill={neutral} />

      {/* Traps */}
      <path d="M36 23 L19 34 L19 46 L61 46 L61 34 L44 23 Z" fill={f('traps')} />

      {/* Left Shoulder */}
      <ellipse cx="15" cy="38" rx="9" ry="10" fill={f('shoulders')} />
      {/* Right Shoulder */}
      <ellipse cx="65" cy="38" rx="9" ry="10" fill={f('shoulders')} />

      {/* Left Upper Arm */}
      <rect x="6" y="44" width="11" height="27" rx="5" fill={f('arms')} />
      {/* Right Upper Arm */}
      <rect x="63" y="44" width="11" height="27" rx="5" fill={f('arms')} />

      {/* Left Forearm */}
      <rect x="5" y="73" width="10" height="21" rx="4" fill={f('forearms')} />
      {/* Right Forearm */}
      <rect x="65" y="73" width="10" height="21" rx="4" fill={f('forearms')} />

      {/* Chest — two pecs */}
      <ellipse cx="32" cy="52" rx="12" ry="10" fill={f('chest')} />
      <ellipse cx="48" cy="52" rx="12" ry="10" fill={f('chest')} />

      {/* Lats */}
      <path d="M19 46 L30 62 L30 76 L19 80 Z" fill={f('lats')} />
      <path d="M61 46 L50 62 L50 76 L61 80 Z" fill={f('lats')} />

      {/* Abs */}
      <rect x="30" y="62" width="20" height="26" rx="3" fill={f('abs')} />

      {/* Hips / Glutes */}
      <rect x="25" y="88" width="30" height="14" rx="4" fill={f('hips')} />

      {/* Left Quad */}
      <rect x="25" y="102" width="13" height="38" rx="5" fill={f('quads')} />
      {/* Right Quad */}
      <rect x="42" y="102" width="13" height="38" rx="5" fill={f('quads')} />

      {/* Adductors (inner thighs) */}
      <path d="M38 104 L42 104 L42 138 L38 138 Z" fill={f('adductors')} />

      {/* Left Calf */}
      <rect x="25" y="142" width="12" height="28" rx="4" fill={f('calves')} />
      {/* Right Calf */}
      <rect x="43" y="142" width="12" height="28" rx="4" fill={f('calves')} />
    </svg>
  )
}
