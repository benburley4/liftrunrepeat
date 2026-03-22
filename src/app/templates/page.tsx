'use client'

import { useState, useEffect, useRef } from 'react'
import { ChevronDown, ChevronUp, Copy, Share2, Plus, Check, X, Pencil, Trash2, BookmarkPlus, ChevronRight } from 'lucide-react'
import QuickLogFAB from '@/components/log/QuickLogFAB'
import ExerciseBuilder, { ExRow, RunBuilder, RunEntry, RepeatBlock, RunSegment, SEGMENT_TYPES, METRIC_CONFIG } from '@/components/templates/ExerciseBuilder'
import { programmes as staticProgrammes, exercises as libraryExercises } from '@/lib/mockData'
import { getTemplates, upsertTemplate, deleteTemplate } from '@/lib/db'

type TabId = 'lifting' | 'running' | 'hybrid' | 'mine'

// ─── Static template data ────────────────────────────────────────────────────

const liftTemplates = [
  // ── Beginner ──────────────────────────────────────────────────────────────
  { id: 'stronglifts', name: 'StrongLifts 5×5', days: '3-Day', description: "The most popular beginner barbell programme. Two alternating full-body workouts (A/B) built around 5 compound lifts. Add 2.5 kg each session.", scheme: '5×5 linear progression', exercises: ['Back Squat 5×5', 'Bench Press 5×5', 'Barbell Row 5×5', 'Overhead Press 5×5', 'Conventional Deadlift 1×5'] },
  { id: 'starting-strength', name: 'Starting Strength', days: '3-Day', description: "Mark Rippetoe's foundational novice programme. Focuses on the squat, press, and deadlift with aggressive linear progression. Add weight every session.", scheme: '3×5 strength, 1×5 deadlift', exercises: ['Back Squat 3×5', 'Bench Press 3×5', 'Overhead Press 3×5', 'Conventional Deadlift 1×5', 'Barbell Row 3×5'] },
  // ── Intermediate ──────────────────────────────────────────────────────────
  { id: 'texas-method', name: 'Texas Method', days: '3-Day', description: 'Intermediate programme structured around Volume Day (Monday), Recovery Day (Wednesday), and Intensity Day (Friday). Builds strength week to week rather than session to session.', scheme: 'Volume 5×5 → Intensity 1×5 PR', exercises: ['Back Squat 5×5 (Vol) / 1×5 (Int)', 'Bench Press 5×5 (Vol) / 1×5 (Int)', 'Overhead Press 5×5 (Vol) / 1×5 (Int)', 'Conventional Deadlift 1×5 (Vol)', 'Barbell Row 3×5'] },
  { id: '531', name: '5/3/1 Programme', days: '4-Day', description: "Jim Wendler's classic linear progression. Conservative loading, consistent PRs.", scheme: 'Week 1: 3×5, Week 2: 3×3, Week 3: 5/3/1+', exercises: ['Squat 5/3/1+ BBB', 'Bench Press 5/3/1+', 'Deadlift 5/3/1+', 'OHP 5/3/1+'] },
  // ── Power + Hypertrophy ───────────────────────────────────────────────────
  { id: 'upper-lower', name: 'Upper / Lower Split', days: '4-Day', description: 'Alternates upper and lower body sessions. 2× frequency per muscle group per week.', scheme: '4×5 strength, 3×10 hypertrophy', exercises: ['Bench Press 4×5', 'Barbell Row 4×5', 'OHP 3×8', 'Pull-ups 3×8', 'Squat 4×5', 'Romanian Deadlift 3×8', 'Leg Press 3×12'] },
  { id: 'phul', name: 'PHUL', days: '4-Day', description: 'Power Hypertrophy Upper Lower. Two power days (3–5 reps) and two hypertrophy days (8–12 reps) per week. Trains each muscle group twice at different rep ranges.', scheme: 'Power 3×5, Hypertrophy 4×10', exercises: ['Bench Press 3×5', 'Barbell Row 3×5', 'Incline Bench Press 4×10', 'Lat Pulldown 4×10', 'Back Squat 3×5', 'Conventional Deadlift 3×5', 'Leg Press 4×10', 'Romanian Deadlift 4×10'] },
  // ── Hypertrophy ───────────────────────────────────────────────────────────
  { id: 'ppl', name: 'Push / Pull / Legs', days: '6-Day', description: 'High-frequency, high-volume split. Each muscle group trained twice weekly.', scheme: '4×8-12 hypertrophy focus', exercises: ['Bench 4×8', 'OHP 3×10', 'Incline DB 3×12', 'Deadlift 4×5', 'Row 4×8', 'Pull-ups 3×10', 'Squat 4×6', 'Leg Press 4×10'] },
  { id: 'gvt', name: 'German Volume Training', days: '4-Day', description: '10 sets of 10 reps on one primary compound per session. Extreme volume drives hypertrophy. Popularised by Charles Poliquin. Expect soreness.', scheme: '10×10 primary, 3×10–15 accessory', exercises: ['Back Squat 10×10', 'Romanian Deadlift 10×10', 'Bench Press 10×10', 'Barbell Row 10×10', 'Overhead Press 3×12', 'Pull-ups 3×12', 'Dumbbell Curl 3×15'] },
  { id: 'body-part-split', name: 'Body Part Split', days: '5-Day', description: 'Classic bodybuilding bro split. Each session isolates one muscle group allowing maximum volume and recovery time per muscle. Chest / Back / Shoulders / Arms / Legs.', scheme: '4×8-12 isolation focus', exercises: ['Bench Press 4×10', 'Incline Bench Press 3×12', 'Pull-up 4×10', 'Barbell Row 4×10', 'Overhead Press 4×10', 'Lat Pulldown 3×12', 'Back Squat 4×10', 'Leg Press 3×12', 'Romanian Deadlift 3×12', 'Dumbbell Curl 3×12', 'Tricep Dip 3×12'] },
  { id: 'full-body', name: 'Full Body 3×', days: '3-Day', description: 'Three total-body sessions. Perfect for hybrid athletes. Low session fatigue, high recovery.', scheme: '3×5 strength + 2×10 accessory', exercises: ['Squat 3×5', 'Bench Press 3×5', 'Deadlift 3×5', 'OHP 3×5', 'Pull-ups 3×8'] },
]

const runTemplates: { id: string; name: string; effort: string; effortColor: string; duration: string; description: string; tip: string; runRows: RunEntry[] }[] = [
  // ── Easy ──────────────────────────────────────────────────────────────────
  { id: 'easy', name: 'Easy Run', effort: 'Zone 2', effortColor: '#4CAF50', duration: '45 min', description: "Conversational pace. Should be able to hold a full conversation. The foundation of every runner's week.", tip: 'If in doubt, go slower. Most easy runs are done too fast.',
    runRows: [
      { id: 'er-1', segmentType: 'warm-up', metric: 'time', value: '10' },
      { id: 'er-2', segmentType: 'easy', metric: 'time', value: '30' },
      { id: 'er-3', segmentType: 'cool-down', metric: 'time', value: '5' },
    ] },
  { id: 'recovery', name: 'Recovery Jog', effort: 'Zone 1', effortColor: '#A0A0A0', duration: '25 min', description: 'Very easy movement. Promotes blood flow and recovery without adding training stress.', tip: 'Should feel almost too easy. Ridiculously slow is correct.',
    runRows: [
      { id: 'rj-1', segmentType: 'easy', metric: 'time', value: '25' },
    ] },
  { id: 'progression', name: 'Progression Run', effort: 'Zone 2 → 4', effortColor: '#4CAF50', duration: '45 min', description: 'Start at easy pace and gradually increase effort each mile/km. Finishes at tempo effort. Teaches pacing discipline.', tip: 'Split into thirds: easy, moderate, comfortably hard. Never start too fast.',
    runRows: [
      { id: 'pr-1', segmentType: 'easy', metric: 'time', value: '15' },
      { id: 'pr-2', segmentType: 'custom', metric: 'time', value: '15' },
      { id: 'pr-3', segmentType: 'tempo', metric: 'time', value: '15' },
    ] },
  { id: 'negative-split', name: 'Negative Split Run', effort: 'Zone 2–3', effortColor: '#4CAF50', duration: '40 min', description: 'Run the second half faster than the first. Builds pacing control and mental discipline. Great race rehearsal.', tip: 'First half should feel almost too easy. Patience is the workout.',
    runRows: [
      { id: 'ns-1', segmentType: 'easy', metric: 'time', value: '20' },
      { id: 'ns-2', segmentType: 'tempo', metric: 'time', value: '20' },
    ] },

  // ── Tempo ─────────────────────────────────────────────────────────────────
  { id: 'tempo', name: 'Tempo Run', effort: 'Zone 3–4', effortColor: '#F59E0B', duration: '40 min', description: 'Comfortably hard sustained effort at threshold pace. Raises lactate threshold.', tip: '80–90% max HR. Should be able to say 3–4 words.',
    runRows: [
      { id: 'tr-1', segmentType: 'warm-up', metric: 'time', value: '10' },
      { id: 'tr-2', segmentType: 'tempo', metric: 'time', value: '20' },
      { id: 'tr-3', segmentType: 'cool-down', metric: 'time', value: '10' },
    ] },
  { id: 'threshold-intervals', name: 'Threshold Intervals', effort: 'Zone 3–4', effortColor: '#F59E0B', duration: '50 min', description: '3 × 10 min at half marathon pace with 2 min easy jog recovery. Builds threshold power with less fatigue than a continuous tempo.', tip: 'Same intensity as a tempo run but broken into chunks. Total tempo volume: 30 min.',
    runRows: [
      { id: 'ti-1', segmentType: 'warm-up', metric: 'time', value: '10' },
      { id: 'ti-2', kind: 'repeat', count: '3', laps: [
        { id: 'ti-2a', segmentType: 'tempo', metric: 'time', value: '10' },
        { id: 'ti-2b', segmentType: 'easy', metric: 'time', value: '2' },
      ] },
      { id: 'ti-3', segmentType: 'cool-down', metric: 'time', value: '10' },
    ] },
  { id: 'cruise-intervals', name: 'Cruise Intervals', effort: 'Zone 3', effortColor: '#F59E0B', duration: '55 min', description: '4 × 10 min at marathon pace with 90 sec recovery. High volume, moderate intensity. Jack Daniels staple.', tip: 'Recovery should be short — these are not rest intervals. Steady effort throughout.',
    runRows: [
      { id: 'ci-1', segmentType: 'warm-up', metric: 'time', value: '10' },
      { id: 'ci-2', kind: 'repeat', count: '4', laps: [
        { id: 'ci-2a', segmentType: 'custom', metric: 'time', value: '10' },
        { id: 'ci-2b', segmentType: 'rest', metric: 'time', value: '2' },
      ] },
      { id: 'ci-3', segmentType: 'cool-down', metric: 'time', value: '10' },
    ] },
  { id: 'cut-down', name: 'Cut-Down Run', effort: 'Zone 2 → 5', effortColor: '#F59E0B', duration: '45 min', description: 'Each segment is run faster than the last. Starts easy, ends at 5K effort. Combines aerobic and speed work.', tip: 'Use landmarks or GPS splits. The last segment should feel like a hard finish.',
    runRows: [
      { id: 'cd-1', segmentType: 'easy', metric: 'time', value: '15' },
      { id: 'cd-2', segmentType: 'custom', metric: 'time', value: '15' },
      { id: 'cd-3', segmentType: 'tempo', metric: 'time', value: '10' },
      { id: 'cd-4', segmentType: 'interval', metric: 'time', value: '5' },
    ] },
  { id: 'fartlek', name: 'Fartlek', effort: 'Zone 2–5', effortColor: '#F59E0B', duration: '45 min', description: 'Unstructured speed play. Alternate surges of hard effort with easy recovery within a normal run. Swedish origins.', tip: 'Use landmarks: run hard to the next lamppost, easy to the corner. Keep it playful.',
    runRows: [
      { id: 'fl-1', segmentType: 'warm-up', metric: 'time', value: '10' },
      { id: 'fl-2', segmentType: 'custom', metric: 'time', value: '25' },
      { id: 'fl-3', segmentType: 'cool-down', metric: 'time', value: '10' },
    ] },

  // ── VO2max / Speed ────────────────────────────────────────────────────────
  { id: 'vo2max', name: 'VO2max Intervals', effort: 'Zone 5', effortColor: '#EF4444', duration: '40 min', description: '5 × 4 min hard efforts at 3K–5K pace with equal recovery. Maximizes aerobic capacity.', tip: '5K effort or faster. Full recovery between.',
    runRows: [
      { id: 'vo-1', segmentType: 'warm-up', metric: 'time', value: '10' },
      { id: 'vo-2', kind: 'repeat', count: '5', laps: [
        { id: 'vo-2a', segmentType: 'interval', metric: 'time', value: '4' },
        { id: 'vo-2b', segmentType: 'easy', metric: 'time', value: '4' },
      ] },
      { id: 'vo-3', segmentType: 'cool-down', metric: 'time', value: '10' },
    ] },
  { id: '400-repeats', name: '400m Repeats', effort: 'Zone 5', effortColor: '#EF4444', duration: '45 min', description: '10 × 400m at mile to 5K pace with 90 sec recovery jog. Classic track session for speed development.', tip: 'First rep should feel controlled. If slowing by rep 6, you started too fast.',
    runRows: [
      { id: '4r-1', segmentType: 'warm-up', metric: 'time', value: '10' },
      { id: '4r-2', kind: 'repeat', count: '10', laps: [
        { id: '4r-2a', segmentType: 'interval', metric: 'distance', value: '0.4' },
        { id: '4r-2b', segmentType: 'easy', metric: 'distance', value: '0.2' },
      ] },
      { id: '4r-3', segmentType: 'cool-down', metric: 'time', value: '10' },
    ] },
  { id: '800-repeats', name: '800m Repeats', effort: 'Zone 4–5', effortColor: '#EF4444', duration: '50 min', description: '6 × 800m at 5K–10K pace with 400m recovery jog. Combines speed endurance and VO2max stimulus.', tip: 'Even splits each rep. Walk the line between uncomfortable and out of control.',
    runRows: [
      { id: '8r-1', segmentType: 'warm-up', metric: 'time', value: '10' },
      { id: '8r-2', kind: 'repeat', count: '6', laps: [
        { id: '8r-2a', segmentType: 'interval', metric: 'distance', value: '0.8' },
        { id: '8r-2b', segmentType: 'easy', metric: 'distance', value: '0.4' },
      ] },
      { id: '8r-3', segmentType: 'cool-down', metric: 'time', value: '10' },
    ] },
  { id: '1k-repeats', name: '1K Repeats', effort: 'Zone 4–5', effortColor: '#EF4444', duration: '50 min', description: '5 × 1000m at 5K pace with 500m recovery. Effective VO2max session with slightly longer stimulus than 800s.', tip: 'Best done on track or flat loop. Consistent pacing across all reps is the goal.',
    runRows: [
      { id: '1k-1', segmentType: 'warm-up', metric: 'time', value: '10' },
      { id: '1k-2', kind: 'repeat', count: '5', laps: [
        { id: '1k-2a', segmentType: 'interval', metric: 'distance', value: '1' },
        { id: '1k-2b', segmentType: 'easy', metric: 'distance', value: '0.5' },
      ] },
      { id: '1k-3', segmentType: 'cool-down', metric: 'time', value: '10' },
    ] },
  { id: 'mile-repeats', name: 'Mile Repeats', effort: 'Zone 4–5', effortColor: '#EF4444', duration: '55 min', description: '4 × 1 mile at 5K–10K pace with 800m recovery jog. Develops lactate threshold and running economy simultaneously.', tip: 'Last mile rep should be your fastest. Save something for the finish.',
    runRows: [
      { id: 'mr-1', segmentType: 'warm-up', metric: 'time', value: '10' },
      { id: 'mr-2', kind: 'repeat', count: '4', laps: [
        { id: 'mr-2a', segmentType: 'interval', metric: 'distance', value: '1.6' },
        { id: 'mr-2b', segmentType: 'easy', metric: 'distance', value: '0.8' },
      ] },
      { id: 'mr-3', segmentType: 'cool-down', metric: 'time', value: '10' },
    ] },
  { id: 'yasso-800s', name: 'Yasso 800s', effort: 'Zone 4–5', effortColor: '#EF4444', duration: '60 min', description: '10 × 800m with 400m jog recovery. The time in min:sec for each rep predicts marathon finish time in hours:min.', tip: 'Build up over weeks: start with 4 reps, add 1–2 per week until you hit 10.',
    runRows: [
      { id: 'ya-1', segmentType: 'warm-up', metric: 'time', value: '10' },
      { id: 'ya-2', kind: 'repeat', count: '10', laps: [
        { id: 'ya-2a', segmentType: 'interval', metric: 'distance', value: '0.8' },
        { id: 'ya-2b', segmentType: 'easy', metric: 'distance', value: '0.4' },
      ] },
      { id: 'ya-3', segmentType: 'cool-down', metric: 'time', value: '10' },
    ] },

  // ── Sprint ────────────────────────────────────────────────────────────────
  { id: 'sprint-intervals', name: 'Sprint Intervals', effort: 'Zone 5+', effortColor: '#C8102E', duration: '35 min', description: 'Maximum effort sprints of 20–30 seconds with full 3 min recovery. Builds power, speed, and neuromuscular fitness.', tip: 'Full recovery is essential — these are not cardio intervals. Quality over quantity.',
    runRows: [
      { id: 'si-1', segmentType: 'warm-up', metric: 'time', value: '10' },
      { id: 'si-2', kind: 'repeat', count: '6', laps: [
        { id: 'si-2a', segmentType: 'interval', metric: 'distance', value: '0.1' },
        { id: 'si-2b', segmentType: 'rest', metric: 'time', value: '3' },
      ] },
      { id: 'si-3', segmentType: 'cool-down', metric: 'time', value: '10' },
    ] },
  { id: 'strides', name: 'Strides', effort: 'Zone 4', effortColor: '#F59E0B', duration: '10–15 min add-on', description: '80–100m accelerations at 90–95% effort. Neuromuscular activation and running economy.', tip: '4–8 strides after easy runs. Full recovery between each.',
    runRows: [
      { id: 'st-1', kind: 'repeat', count: '6', laps: [
        { id: 'st-1a', segmentType: 'strides', metric: 'distance', value: '0.1' },
        { id: 'st-1b', segmentType: 'rest', metric: 'time', value: '1' },
      ] },
    ] },

  // ── Long ──────────────────────────────────────────────────────────────────
  { id: 'long', name: 'Long Run', effort: 'Zone 2', effortColor: '#4CAF50', duration: '90 min', description: 'Weekly long easy run. Builds fatigue resistance, fat oxidation, and mental toughness.', tip: 'Keep truly easy. The distance is the stimulus, not the pace.',
    runRows: [
      { id: 'lr-1', segmentType: 'easy', metric: 'time', value: '90' },
    ] },
  { id: 'long-with-surges', name: 'Long Run with Surges', effort: 'Zone 2 + Zone 4', effortColor: '#4CAF50', duration: '90 min', description: 'Easy long run with 5 × 1 min surges at 10K effort scattered throughout. Breaks up monotony and adds neuromuscular stimulus.', tip: 'Do surges from miles 4–10. Return to easy pace fully before the next surge.',
    runRows: [
      { id: 'ls-1', segmentType: 'warm-up', metric: 'time', value: '20' },
      { id: 'ls-2', kind: 'repeat', count: '5', laps: [
        { id: 'ls-2a', segmentType: 'easy', metric: 'time', value: '10' },
        { id: 'ls-2b', segmentType: 'tempo', metric: 'time', value: '1' },
      ] },
      { id: 'ls-3', segmentType: 'cool-down', metric: 'time', value: '15' },
    ] },
  { id: 'marathon-pace-long', name: 'Marathon Pace Long Run', effort: 'Zone 2–3', effortColor: '#4CAF50', duration: '100 min', description: 'Long run with final 40 min at goal marathon pace. Race-specific preparation and confidence builder.', tip: 'The pace shift should happen naturally. If it feels forced early, your MP goal may be ambitious.',
    runRows: [
      { id: 'mp-1', segmentType: 'easy', metric: 'time', value: '30' },
      { id: 'mp-2', segmentType: 'custom', metric: 'time', value: '30' },
      { id: 'mp-3', segmentType: 'tempo', metric: 'time', value: '30' },
      { id: 'mp-4', segmentType: 'cool-down', metric: 'time', value: '10' },
    ] },

  // ── Hills ─────────────────────────────────────────────────────────────────
  { id: 'hills', name: 'Hill Repeats', effort: 'Zone 4–5', effortColor: '#C8102E', duration: '45 min', description: 'Short hard uphill repeats with jog-down recovery. Builds strength and power without heavy eccentric load.', tip: 'Great pairing with lift days — less pounding on legs.',
    runRows: [
      { id: 'hr-1', segmentType: 'warm-up', metric: 'time', value: '15' },
      { id: 'hr-2', kind: 'repeat', count: '8', laps: [
        { id: 'hr-2a', segmentType: 'hills', metric: 'time', value: '1' },
        { id: 'hr-2b', segmentType: 'easy', metric: 'time', value: '2' },
      ] },
      { id: 'hr-3', segmentType: 'cool-down', metric: 'time', value: '10' },
    ] },
  { id: 'long-hill-repeats', name: 'Long Hill Repeats', effort: 'Zone 4', effortColor: '#C8102E', duration: '55 min', description: '4 × 4 min uphill at 5K effort with easy jog down. Builds strength-endurance over a longer stimulus.', tip: 'Choose a 4–6% gradient hill. Consistent effort uphill, fully recover jogging down.',
    runRows: [
      { id: 'lh-1', segmentType: 'warm-up', metric: 'time', value: '15' },
      { id: 'lh-2', kind: 'repeat', count: '4', laps: [
        { id: 'lh-2a', segmentType: 'hills', metric: 'time', value: '4' },
        { id: 'lh-2b', segmentType: 'easy', metric: 'time', value: '4' },
      ] },
      { id: 'lh-3', segmentType: 'cool-down', metric: 'time', value: '10' },
    ] },
  { id: 'rolling-hills', name: 'Rolling Hills Run', effort: 'Zone 2–3', effortColor: '#C8102E', duration: '50 min', description: 'Easy-paced run over undulating terrain. Builds leg strength, glute activation, and ankle stability with low injury risk.', tip: 'Run by effort not pace — let the hills dictate pace naturally.',
    runRows: [
      { id: 'rh-1', segmentType: 'easy', metric: 'time', value: '50' },
    ] },
]

const hybridTemplates = [
  { id: 'squat-easy', name: 'Heavy Squat + Easy Run', order: 'Squat → (2hr gap) → Easy Run', recoveryNotes: 'Allow minimum 2 hours between. Stay truly Zone 2 on run.', interference: 'Low', interferenceColor: '#00BFA5', description: 'Classic hybrid combo. Heavy lower body strength work followed by aerobic work. Low interference when run stays easy.' },
  { id: 'am-pm', name: 'AM Lift / PM Run', order: 'Morning Lift → Evening Easy Run', recoveryNotes: 'Eat and rest between sessions. Adequate protein and carbs.', interference: 'Low-Med', interferenceColor: '#4CAF50', description: 'Split sessions with full day recovery between. Works well for busy schedules.' },
  { id: 'upper-tempo', name: 'Upper Body + Tempo', order: 'Upper Body Lift → Tempo Run', recoveryNotes: 'Upper body first. Lower limb interference minimized.', interference: 'Low', interferenceColor: '#00BFA5', description: "Best hybrid pairing — upper body doesn't directly compromise running. Follow with quality threshold run." },
  { id: 'brick', name: 'Brick Session (Lift → Run)', order: 'Full Body Lift → Immediate Easy Run', recoveryNotes: 'Pre-load carbs. Keep run very easy. Max 30–40 min.', interference: 'Medium', interferenceColor: '#F59E0B', description: 'Train the transition. Develops the ability to run on fatigued legs — useful for hybrid athletes and triathletes.' },
  { id: 'deadlift-rest', name: 'Deadlift Day = Run Rest', order: 'Deadlift Day → Full Rest from Running', recoveryNotes: 'Full rest day from running after heavy pulls. Protect posterior chain.', interference: 'None', interferenceColor: '#00BFA5', description: 'Smart programming principle — heavy posterior chain work demands full recovery. No run that day.' },
]

// ─── Custom template types ───────────────────────────────────────────────────

type TemplateType = 'lift' | 'run' | 'hybrid'

interface CustomTemplate {
  id: string
  name: string
  type: TemplateType
  description: string
  duration: string
  notes: string
  tags: string
  exerciseRows?: ExRow[]
  runRows?: RunEntry[]
}

const LS_KEY = 'thhl_custom_templates'

// ─── Add to Programme dropdown button ────────────────────────────────────────

function ProgrammeOption({ name, onSelect }: { name: string; onSelect: () => void }) {
  return (
    <button
      onClick={onSelect}
      className="w-full flex items-center justify-between px-4 py-2.5 text-left transition-colors gap-3"
      style={{ borderBottom: '1px solid #2E2E2E' }}
      onMouseEnter={e => (e.currentTarget.style.background = '#242424')}
      onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
    >
      <span className="text-sm" style={{ color: '#F5F5F5', fontFamily: 'Inter, sans-serif', whiteSpace: 'normal', lineHeight: '1.3' }}>
        {name}
      </span>
      <Plus size={12} style={{ color: '#606060', flexShrink: 0 }} />
    </button>
  )
}

function AddToProgrammeButton({ onSuccess }: { onSuccess: (msg: string) => void }) {
  const [open, setOpen]           = useState(false)
  const [programmes, setProgs]    = useState<{ id: string; name: string; isCustom: boolean }[]>([])
  const ref                       = useRef<HTMLDivElement>(null)

  // Load whenever the dropdown opens
  useEffect(() => {
    if (!open) return
    try {
      const custom = JSON.parse(localStorage.getItem('thhl_custom_programmes') || '[]')
      setProgs([
        ...custom.map((p: { id: string; name: string }) => ({ id: p.id, name: p.name, isCustom: true })),
        ...staticProgrammes.map(p => ({ id: p.id, name: p.name, isCustom: false })),
      ])
    } catch {
      setProgs(staticProgrammes.map(p => ({ id: p.id, name: p.name, isCustom: false })))
    }
  }, [open])

  useEffect(() => {
    function handler(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  return (
    <div ref={ref} className="relative flex-1">
      <button
        onClick={() => setOpen(o => !o)}
        className="w-full h-full py-2.5 flex items-center justify-center gap-1.5 text-xs font-medium transition-colors"
        style={{
          color: open ? '#00BFA5' : '#606060',
          background: open ? '#00BFA508' : 'transparent',
          fontFamily: 'Inter, sans-serif',
          borderRight: '1px solid #2E2E2E',
        }}
        onMouseEnter={e => { if (!open) e.currentTarget.style.background = '#242424' }}
        onMouseLeave={e => { if (!open) e.currentTarget.style.background = 'transparent' }}
      >
        <BookmarkPlus size={12} />
        Add to Programme
        <ChevronRight size={10} style={{ transform: open ? 'rotate(90deg)' : 'none', transition: 'transform 0.15s' }} />
      </button>

      {open && (
        <div
          className="absolute bottom-full left-0 z-50 rounded-xl overflow-hidden"
          style={{
            background: '#1A1A1A',
            border: '1px solid #2E2E2E',
            width: 'max-content',
            minWidth: '300px',
            maxWidth: '420px',
            maxHeight: '320px',
            overflowY: 'auto',
            boxShadow: '0 -8px 32px rgba(0,0,0,0.7)',
            marginBottom: '4px',
          }}
        >
          <div className="px-4 py-2.5" style={{ borderBottom: '1px solid #2E2E2E', background: '#242424' }}>
            <p className="text-xs uppercase tracking-wider" style={{ color: '#00BFA5', fontFamily: 'Inter, sans-serif' }}>
              Add to Programme
            </p>
          </div>

          {programmes.length === 0 ? (
            <div className="px-4 py-5 text-center">
              <p className="text-sm" style={{ color: '#606060', fontFamily: 'Inter, sans-serif' }}>No programmes yet</p>
              <p className="text-xs mt-1" style={{ color: '#3E3E3E', fontFamily: 'Inter, sans-serif' }}>
                Create one under Programmes first
              </p>
            </div>
          ) : (
            <>
              {/* My Programmes section */}
              {programmes.some(p => p.isCustom) && (
                <>
                  <div className="px-4 pt-3 pb-1">
                    <p className="text-xs uppercase tracking-wider" style={{ color: '#606060', fontFamily: 'Inter, sans-serif' }}>
                      My Programmes
                    </p>
                  </div>
                  {programmes.filter(p => p.isCustom).map(p => (
                    <ProgrammeOption key={p.id} name={p.name} onSelect={() => { onSuccess(`Added to "${p.name}"`); setOpen(false) }} />
                  ))}
                </>
              )}

              {/* Library section */}
              <div className="px-4 pt-3 pb-1" style={{ borderTop: programmes.some(p => p.isCustom) ? '1px solid #2E2E2E' : 'none' }}>
                <p className="text-xs uppercase tracking-wider" style={{ color: '#606060', fontFamily: 'Inter, sans-serif' }}>
                  Programme Library
                </p>
              </div>
              {programmes.filter(p => !p.isCustom).map(p => (
                <ProgrammeOption key={p.id} name={p.name} onSelect={() => { onSuccess(`Added to "${p.name}"`); setOpen(false) }} />
              ))}
            </>
          )}
        </div>
      )}
    </div>
  )
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function EffortBadge({ effort, color }: { effort: string; color: string }) {
  return (
    <span className="px-2 py-0.5 rounded text-xs font-semibold" style={{ background: `${color}18`, color, border: `1px solid ${color}33`, fontFamily: 'Inter, sans-serif' }}>
      {effort}
    </span>
  )
}

function Toast({ message }: { message: string }) {
  return (
    <div className="fixed bottom-24 right-6 z-50 px-4 py-3 rounded-xl flex items-center gap-2" style={{ background: '#1A1A1A', border: '1px solid #00BFA5', boxShadow: '0 0 20px rgba(0,229,200,0.2)' }}>
      <Check size={14} style={{ color: '#00BFA5' }} />
      <span className="text-sm" style={{ color: '#F5F5F5', fontFamily: 'Inter, sans-serif' }}>{message}</span>
    </div>
  )
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-2">
      <label className="text-xs uppercase tracking-wider" style={{ color: '#606060', fontFamily: 'Inter, sans-serif' }}>{label}</label>
      {children}
    </div>
  )
}

// ─── Create / Edit Template Modal ────────────────────────────────────────────

interface TemplateModalProps {
  onClose: () => void
  onSave: (t: CustomTemplate) => void
  initialData?: CustomTemplate
}

function TemplateModal({ onClose, onSave, initialData }: TemplateModalProps) {
  const isEditing = !!initialData
  const [name, setName]             = useState(initialData?.name ?? '')
  const [type, setType]             = useState<TemplateType>(initialData?.type ?? 'lift')
  const [exerciseRows, setExRows]   = useState<ExRow[]>(initialData?.exerciseRows ?? [])
  const [runRows, setRunRows]       = useState<RunEntry[]>(initialData?.runRows ?? [])

  const TYPE_OPTIONS: { value: TemplateType; label: string; color: string; bg: string }[] = [
    { value: 'lift',   label: 'Lifting',      color: '#00BFA5', bg: '#00BFA520' },
    { value: 'run',    label: 'Running',       color: '#C8102E', bg: '#C8102E20' },
    { value: 'hybrid', label: 'Hybrid Combo',  color: '#A78BFA', bg: '#A78BFA20' },
  ]

  function handleSave() {
    if (!name.trim()) return
    onSave({
      id: initialData?.id ?? `custom-tpl-${Date.now()}`,
      name: name.trim(),
      type,
      description: '',
      duration: '',
      notes: '',
      tags: '',
      exerciseRows: (type === 'lift' || type === 'hybrid') ? exerciseRows : undefined,
      runRows: (type === 'run' || type === 'hybrid') ? runRows : undefined,
    })
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: 'rgba(0,0,0,0.85)' }}>
      <div className="rounded-2xl overflow-hidden flex flex-col" style={{ width: 'fit-content', minWidth: '420px', maxWidth: '90vw', background: '#1A1A1A', border: '1px solid #2E2E2E', maxHeight: '90vh' }}>
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4" style={{ borderBottom: '1px solid #2E2E2E' }}>
          <div>
            <p className="text-xs uppercase tracking-widest mb-0.5" style={{ color: '#00BFA5', fontFamily: 'Inter, sans-serif' }}>
              {isEditing ? 'Edit Template' : 'New Template'}
            </p>
            <h2 className="text-2xl font-black uppercase" style={{ fontFamily: 'Montserrat, sans-serif', color: '#F5F5F5' }}>
              {isEditing ? 'Edit Template' : 'Create Template'}
            </h2>
          </div>
          <button onClick={onClose} className="p-2 rounded-lg hover:bg-[#242424]" style={{ color: '#606060' }}>
            <X size={18} />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-6 py-5 space-y-5">
          <Field label="Template Name *">
            <input
              type="text"
              placeholder="e.g. My Squat + Run Day"
              value={name}
              onChange={e => setName(e.target.value)}
              className="w-full px-4 py-3 rounded-xl text-sm outline-none"
              style={{ background: '#242424', border: '1px solid #2E2E2E', color: '#F5F5F5', fontFamily: 'Inter, sans-serif' }}
              onFocus={e => (e.target.style.borderColor = '#00BFA544')}
              onBlur={e  => (e.target.style.borderColor = '#2E2E2E')}
            />
          </Field>

          <Field label="Type">
            <div className="grid grid-cols-3 gap-2">
              {TYPE_OPTIONS.map(opt => (
                <button
                  key={opt.value}
                  onClick={() => setType(opt.value)}
                  className="py-2.5 rounded-xl text-sm font-semibold transition-all"
                  style={{
                    background: type === opt.value ? opt.bg : '#242424',
                    color: type === opt.value ? opt.color : '#606060',
                    border: type === opt.value ? `1px solid ${opt.color}44` : '1px solid #2E2E2E',
                    fontFamily: 'Inter, sans-serif',
                  }}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </Field>

          {/* Exercise builder for lift / hybrid */}
          {(type === 'lift' || type === 'hybrid') && (
            <Field label="Exercises">
              <ExerciseBuilder rows={exerciseRows} onChange={setExRows} />
            </Field>
          )}

          {/* Run builder for run / hybrid */}
          {(type === 'run' || type === 'hybrid') && (
            <Field label="Run Structure">
              <RunBuilder entries={runRows} onChange={setRunRows} />
            </Field>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-6 py-4" style={{ borderTop: '1px solid #2E2E2E' }}>
          <button onClick={onClose} className="px-4 py-2 rounded-lg text-sm" style={{ color: '#606060', fontFamily: 'Inter, sans-serif' }}>
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={!name.trim()}
            className="flex items-center gap-1.5 px-5 py-2 rounded-lg text-sm font-semibold transition-opacity"
            style={{
              background: name.trim() ? '#00BFA5' : '#1A1A1A',
              color: name.trim() ? '#0D0D0D' : '#606060',
              fontFamily: 'Inter, sans-serif',
              cursor: name.trim() ? 'pointer' : 'not-allowed',
            }}
          >
            <Check size={14} />
            {isEditing ? 'Save Changes' : 'Save Template'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── Custom Template Card ────────────────────────────────────────────────────

function CustomTemplateCard({
  template, onEdit, onDelete, onToast,
}: {
  template: CustomTemplate
  onEdit: () => void
  onDelete: () => void
  onToast: (msg: string) => void
}) {
  const typeColor = template.type === 'lift' ? '#00BFA5' : template.type === 'run' ? '#C8102E' : '#A78BFA'
  const typeLabel = template.type === 'lift' ? 'Lifting' : template.type === 'run' ? 'Running' : 'Hybrid'
  const [expanded, setExpanded] = useState(false)

  return (
    <div className="rounded-xl overflow-hidden" style={{ background: '#1A1A1A', border: '1px solid #2E2E2E' }}>
      <div className="p-5">
        <div className="flex items-start justify-between mb-2">
          <div className="flex-1 min-w-0">
            <h3 className="text-xl font-black uppercase leading-tight" style={{ fontFamily: 'Montserrat, sans-serif', color: '#F5F5F5' }}>
              {template.name}
            </h3>
            {template.duration && (
              <span className="text-xs" style={{ color: '#606060', fontFamily: 'JetBrains Mono, monospace' }}>{template.duration}</span>
            )}
          </div>
          <span className="ml-2 px-2 py-0.5 rounded text-xs font-semibold whitespace-nowrap" style={{ background: `${typeColor}18`, color: typeColor, border: `1px solid ${typeColor}44`, fontFamily: 'Inter, sans-serif' }}>
            {typeLabel}
          </span>
        </div>

        {((template.exerciseRows && template.exerciseRows.length > 0) || (template.runRows && template.runRows.length > 0)) && (
          <>
            <button onClick={() => setExpanded(e => !e)} className="text-xs flex items-center gap-1 mb-1" style={{ color: '#606060' }}>
              {expanded ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
              {expanded ? 'Hide details' : (() => {
                const parts = []
                if (template.exerciseRows?.length) parts.push(`${template.exerciseRows.length} exercise${template.exerciseRows.length !== 1 ? 's' : ''}`)
                if (template.runRows?.length) parts.push(`${template.runRows.length} run segment${template.runRows.length !== 1 ? 's' : ''}`)
                return `Show details (${parts.join(', ')})`
              })()}
            </button>
            {expanded && (
              <div className="mt-2 space-y-3">
                {/* Exercise rows */}
                {template.exerciseRows && template.exerciseRows.length > 0 && (
                  <div className="space-y-2">
                    {template.exerciseRows.map((row, i) => {
                      const filledSets = row.sets.filter(s => s.reps || s.weight)
                      return (
                        <div key={row.id} className="rounded-lg overflow-hidden" style={{ border: '1px solid #2E2E2E' }}>
                          <div className="flex items-center gap-2 px-3 py-2" style={{ background: '#1A1A1A', borderBottom: '1px solid #2E2E2E' }}>
                            <span className="text-xs" style={{ color: '#3E3E3E', fontFamily: 'JetBrains Mono, monospace' }}>{i + 1}</span>
                            <span className="text-sm font-medium flex-1" style={{ color: '#F5F5F5', fontFamily: 'Inter, sans-serif' }}>
                              {row.exerciseName || <span style={{ color: '#3E3E3E' }}>Unnamed</span>}
                            </span>
                            <span className="text-xs" style={{ color: '#606060', fontFamily: 'Inter, sans-serif' }}>
                              {filledSets.length} set{filledSets.length !== 1 ? 's' : ''}
                            </span>
                          </div>
                          {filledSets.length > 0 && (
                            <div style={{ background: '#242424' }}>
                              {filledSets.map((set, si) => (
                                <div key={set.id} className="flex items-center gap-3 px-3 py-1.5"
                                  style={{ borderBottom: si < filledSets.length - 1 ? '1px solid #1A1A1A' : 'none' }}>
                                  <span className="text-xs w-10 flex-shrink-0" style={{ color: '#3E3E3E', fontFamily: 'JetBrains Mono, monospace' }}>Set {si + 1}</span>
                                  <span className="text-xs" style={{ color: '#A0A0A0', fontFamily: 'JetBrains Mono, monospace' }}>
                                    {set.reps ? `${set.reps} reps` : ''}{set.reps && set.weight ? ' · ' : ''}{set.weight ? `${set.weight} kg` : ''}
                                  </span>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      )
                    })}
                  </div>
                )}

                {/* Run segments */}
                {template.runRows && template.runRows.length > 0 && (
                  <div className="space-y-1.5">
                    {template.exerciseRows && template.exerciseRows.length > 0 && (
                      <p className="text-xs uppercase tracking-wider" style={{ color: '#606060', fontFamily: 'Inter, sans-serif' }}>Run Structure</p>
                    )}
                    {template.runRows.map((entry, i) => {
                      function segDisplay(lap: RunSegment) {
                        if (!lap.value) return '—'
                        const conf = METRIC_CONFIG[lap.metric]
                        return `${lap.value} ${conf.unit}`
                      }
                      if ('kind' in entry) {
                        const block = entry as RepeatBlock
                        const lapKm = block.laps.reduce((s, l) => s + (l.metric === 'distance' ? parseFloat(l.value) || 0 : 0), 0)
                        const count = parseInt(block.count) || 0
                        return (
                          <div key={block.id} className="rounded-lg overflow-hidden" style={{ border: '1px solid #EF444433', background: '#EF44440A' }}>
                            <div className="flex items-center gap-2 px-3 py-1.5" style={{ borderBottom: '1px solid #EF444422' }}>
                              <span className="text-xs font-bold" style={{ color: '#EF4444', fontFamily: 'JetBrains Mono, monospace' }}>
                                ×{block.count || '?'} Repeat
                              </span>
                              {lapKm > 0 && count > 0 && (
                                <span className="text-xs" style={{ color: '#606060', fontFamily: 'JetBrains Mono, monospace' }}>
                                  {(lapKm * count) % 1 === 0 ? lapKm * count : (lapKm * count).toFixed(1)} km total
                                </span>
                              )}
                            </div>
                            <div className="px-3 py-1.5 space-y-1">
                              {block.laps.map(lap => {
                                const t = SEGMENT_TYPES.find(t => t.value === lap.segmentType) ?? SEGMENT_TYPES[1]
                                return (
                                  <div key={lap.id} className="flex items-center gap-2 text-xs">
                                    <span className="px-1.5 py-0.5 rounded font-semibold flex-shrink-0"
                                      style={{ background: `${t.color}18`, color: t.color, border: `1px solid ${t.color}44`, fontFamily: 'Inter, sans-serif' }}>
                                      {t.label}
                                    </span>
                                    <span style={{ color: '#A0A0A0', fontFamily: 'JetBrains Mono, monospace' }}>{segDisplay(lap)}</span>
                                  </div>
                                )
                              })}
                            </div>
                          </div>
                        )
                      }
                      const typeInfo = SEGMENT_TYPES.find(t => t.value === entry.segmentType) ?? SEGMENT_TYPES[1]
                      return (
                        <div key={entry.id} className="flex items-center gap-2 px-3 py-2 rounded-lg" style={{ background: '#242424', border: '1px solid #2E2E2E' }}>
                          <span className="text-xs" style={{ color: '#3E3E3E', fontFamily: 'JetBrains Mono, monospace', width: '16px', flexShrink: 0 }}>{i + 1}</span>
                          <span className="text-xs font-semibold px-1.5 py-0.5 rounded flex-shrink-0"
                            style={{ background: `${typeInfo.color}18`, color: typeInfo.color, border: `1px solid ${typeInfo.color}44`, fontFamily: 'Inter, sans-serif' }}>
                            {typeInfo.label}
                          </span>
                          <span className="text-xs" style={{ color: '#A0A0A0', fontFamily: 'JetBrains Mono, monospace' }}>{segDisplay(entry as RunSegment)}</span>
                        </div>
                      )
                    })}
                    {(() => {
                      function ps(val: string): number {
                        if (!val) return 0
                        const p = val.split(':').map(Number)
                        if (p.length === 3) return p[0]*3600 + p[1]*60 + (p[2]||0)
                        if (p.length === 2) return p[0]*60 + (p[1]||0)
                        return 0
                      }
                      function fmt(t: number): string {
                        if (t <= 0) return '—'
                        const h = Math.floor(t/3600), m = Math.floor((t%3600)/60), s = t%60
                        if (h > 0) return `${h}h ${m.toString().padStart(2,'0')}m`
                        if (s > 0) return `${m}m ${s.toString().padStart(2,'0')}s`
                        return `${m}m`
                      }
                      function lapKm(l: RunSegment)   { return l.metric === 'distance' ? parseFloat(l.value)||0 : 0 }
                      function lapSecs(l: RunSegment) { return l.metric === 'time' ? ps(l.value) : 0 }
                      const totalKm = template.runRows!.reduce((s, e) => {
                        if ('kind' in e) { const b = e as RepeatBlock; return s + (parseInt(b.count)||0) * b.laps.reduce((ls,l)=>ls+lapKm(l),0) }
                        return s + lapKm(e as RunSegment)
                      }, 0)
                      const totalSecs = template.runRows!.reduce((s, e) => {
                        if ('kind' in e) { const b = e as RepeatBlock; return s + (parseInt(b.count)||0) * b.laps.reduce((ls,l)=>ls+lapSecs(l),0) }
                        return s + lapSecs(e as RunSegment)
                      }, 0)
                      return (
                        <div className="flex items-center gap-4 px-1 pt-1" style={{ borderTop: '1px solid #2E2E2E' }}>
                          <div className="flex items-center gap-2 flex-1">
                            <span className="text-xs" style={{ color: '#3E3E3E', fontFamily: 'Inter, sans-serif' }}>Distance</span>
                            <span className="text-xs font-bold ml-auto" style={{ color: totalKm > 0 ? '#C8102E' : '#3E3E3E', fontFamily: 'JetBrains Mono, monospace' }}>
                              {totalKm > 0 ? `${totalKm % 1 === 0 ? totalKm : totalKm.toFixed(1)} km` : '—'}
                            </span>
                          </div>
                          <div className="w-px self-stretch" style={{ background: '#2E2E2E' }} />
                          <div className="flex items-center gap-2 flex-1">
                            <span className="text-xs" style={{ color: '#3E3E3E', fontFamily: 'Inter, sans-serif' }}>Time</span>
                            <span className="text-xs font-bold ml-auto" style={{ color: totalSecs > 0 ? '#C8102E' : '#3E3E3E', fontFamily: 'JetBrains Mono, monospace' }}>
                              {fmt(totalSecs)}
                            </span>
                          </div>
                        </div>
                      )
                    })()}
                  </div>
                )}
              </div>
            )}
          </>
        )}

        <div className="flex gap-2 mt-3">
          <button
            onClick={onEdit}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all hover:opacity-90"
            style={{ background: '#00BFA518', color: '#00BFA5', border: '1px solid #00BFA544', fontFamily: 'Inter, sans-serif' }}
          >
            <Pencil size={11} /> Edit
          </button>
          <button
            onClick={onDelete}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all hover:opacity-90"
            style={{ background: '#C8102E18', color: '#C8102E', border: '1px solid #C8102E44', fontFamily: 'Inter, sans-serif' }}
          >
            <Trash2 size={11} /> Delete
          </button>
        </div>
      </div>

    </div>
  )
}

// ─── Main Page ───────────────────────────────────────────────────────────────

export default function TemplatesPage() {
  const [activeTab, setActiveTab]           = useState<TabId>('mine')
  const [expanded, setExpanded]             = useState<string | null>(null)
  const [toast, setToast]                   = useState<string | null>(null)
  const [showModal, setShowModal]           = useState(false)
  const [editingTemplate, setEditingTemplate] = useState<CustomTemplate | null>(null)
  const [customTemplates, setCustomTemplates] = useState<CustomTemplate[]>([])

  useEffect(() => {
    getTemplates()
      .then(tpls => setCustomTemplates(tpls as CustomTemplate[]))
      .catch(() => {
        try {
          const stored = localStorage.getItem(LS_KEY)
          if (stored) setCustomTemplates(JSON.parse(stored))
        } catch { /* ignore */ }
      })
  }, [])

  function showToast(msg: string) {
    setToast(msg)
    setTimeout(() => setToast(null), 2500)
  }

  function handleSave(t: CustomTemplate) {
    const isUpdate = customTemplates.some(c => c.id === t.id)
    const next = isUpdate
      ? customTemplates.map(c => c.id === t.id ? t : c)
      : [t, ...customTemplates]
    setCustomTemplates(next)
    setShowModal(false)
    setEditingTemplate(null)
    if (!isUpdate) setActiveTab('mine')
    upsertTemplate(t.id, t)
      .then(() => showToast(isUpdate ? 'Template updated!' : 'Template saved!'))
      .catch(err => showToast(`Save failed: ${err?.message ?? 'unknown error'}`))
  }

  function handleDelete(id: string) {
    const next = customTemplates.filter(c => c.id !== id)
    setCustomTemplates(next)
    deleteTemplate(id)
      .then(() => showToast('Template deleted.'))
      .catch(err => showToast(`Delete failed: ${err?.message ?? 'unknown error'}`))
  }

  const tabs: { id: TabId; label: string; count?: number }[] = [
    { id: 'mine',    label: 'My Templates', count: customTemplates.length || undefined },
    { id: 'lifting', label: 'Lifting' },
    { id: 'running', label: 'Running' },
    { id: 'hybrid',  label: 'Hybrid Combos' },
  ]

  return (
    <div style={{ background: '#0D0D0D', minHeight: '100vh' }}>
      <QuickLogFAB />
      {toast && <Toast message={toast} />}
      {(showModal || editingTemplate) && (
        <TemplateModal
          onClose={() => { setShowModal(false); setEditingTemplate(null) }}
          onSave={handleSave}
          initialData={editingTemplate ?? undefined}
        />
      )}

      {/* Header */}
      <div className="pt-16 pb-6" style={{ background: '#0A0A0A', borderBottom: '1px solid #1A1A1A' }}>
        <div className="max-w-6xl mx-auto px-4 sm:px-6 pt-8 flex items-end justify-between gap-4 flex-wrap">
          <div>
            <p className="text-xs uppercase tracking-widest mb-2" style={{ color: '#00BFA5', fontFamily: 'Inter, sans-serif' }}>Library</p>
            <h1 className="text-5xl font-black uppercase" style={{ fontFamily: 'Montserrat, sans-serif', color: '#F5F5F5' }}>Templates</h1>
          </div>
          <button
            onClick={() => { setEditingTemplate(null); setShowModal(true); setActiveTab('mine') }}
            className="flex items-center gap-2 px-5 py-3 rounded-xl text-sm font-semibold transition-all hover:opacity-90"
            style={{ background: '#00BFA5', color: '#0D0D0D', fontFamily: 'Inter, sans-serif' }}
          >
            <Plus size={16} /> Create Your Own
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="sticky top-16 z-30" style={{ background: 'rgba(13,13,13,0.95)', backdropFilter: 'blur(12px)', borderBottom: '1px solid #1A1A1A' }}>
        <div className="max-w-6xl mx-auto px-4 sm:px-6">
          <div className="flex gap-1">
            {tabs.map(tab => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className="px-4 py-4 text-sm font-medium transition-colors relative flex items-center gap-1.5"
                style={{ color: activeTab === tab.id ? '#F5F5F5' : '#606060', fontFamily: 'Inter, sans-serif' }}
              >
                {tab.label}
                {tab.count !== undefined && (
                  <span className="px-1.5 py-0.5 rounded-full text-xs" style={{ background: '#00BFA520', color: '#00BFA5', fontFamily: 'Inter, sans-serif', fontSize: '10px' }}>
                    {tab.count}
                  </span>
                )}
                {activeTab === tab.id && <div className="absolute bottom-0 left-0 right-0 h-0.5" style={{ background: '#00BFA5' }} />}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="max-w-6xl mx-auto px-4 sm:px-6 py-8">

        {/* LIFTING TAB */}
        {activeTab === 'lifting' && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {liftTemplates.map(t => (
              <div key={t.id} className="rounded-xl overflow-hidden" style={{ background: '#1A1A1A', border: '1px solid #2E2E2E' }}>
                <div className="p-5">
                  <div className="flex items-start justify-between mb-2">
                    <div>
                      <h3 className="text-xl font-black uppercase" style={{ fontFamily: 'Montserrat, sans-serif', color: '#F5F5F5' }}>{t.name}</h3>
                      <span className="text-xs" style={{ color: '#00BFA5', fontFamily: 'JetBrains Mono, monospace' }}>{t.days}</span>
                    </div>
                    <span className="text-xs px-2 py-1 rounded" style={{ background: '#242424', color: '#606060', border: '1px solid #2E2E2E' }}>{t.scheme}</span>
                  </div>
                  <p className="text-sm mb-4" style={{ color: '#A0A0A0' }}>{t.description}</p>
                  <div className="flex items-center gap-3">
                    <button onClick={() => setExpanded(expanded === t.id ? null : t.id)} className="text-xs flex items-center gap-1" style={{ color: '#606060' }}>
                      {expanded === t.id ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
                      {expanded === t.id ? 'Hide exercises' : 'Preview exercises'}
                    </button>
                    <button
                      onClick={() => {
                        function matchLibraryExercise(name: string) {
                          const lower = name.toLowerCase()
                          return (
                            libraryExercises.find(e => e.name.toLowerCase() === lower) ??
                            libraryExercises.find(e => e.name.toLowerCase().includes(lower)) ??
                            libraryExercises.find(e => lower.includes(e.name.toLowerCase())) ??
                            null
                          )
                        }
                        const exerciseRows: ExRow[] = t.exercises.map((ex, i) => {
                          const setsMatch = ex.match(/(\d+)[×x](\d+)/)
                          const parsedName = setsMatch ? ex.slice(0, ex.lastIndexOf(setsMatch[0])).trim() : ex.replace(/\s+[\d/+]+$/, '').trim()
                          const numSets = setsMatch ? parseInt(setsMatch[1]) : 1
                          const reps = setsMatch ? setsMatch[2] : ''
                          const matched = matchLibraryExercise(parsedName)
                          return {
                            id: `ex-${Date.now()}-${i}`,
                            exerciseId: matched?.id ?? '',
                            exerciseName: matched?.name ?? (parsedName || ex),
                            category: matched?.category ?? '',
                            sets: Array.from({ length: numSets }, (_, j) => ({
                              id: `set-${Date.now()}-${i}-${j}`,
                              reps,
                              weight: '',
                            })),
                          }
                        })
                        setEditingTemplate({
                          id: `custom-tpl-${Date.now()}`,
                          name: t.name,
                          type: 'lift',
                          description: '',
                          duration: '',
                          notes: '',
                          tags: '',
                          exerciseRows,
                        })
                        setShowModal(true)
                      }}
                      className="text-xs flex items-center gap-1"
                      style={{ color: '#00BFA5' }}
                    >
                      <BookmarkPlus size={12} /> Customise
                    </button>
                  </div>
                  {expanded === t.id && (
                    <div className="mt-3 space-y-1.5">
                      {t.exercises.map((ex, i) => (
                        <div key={i} className="flex items-center gap-2">
                          <div className="w-1 h-1 rounded-full" style={{ background: '#00BFA5' }} />
                          <span className="text-xs" style={{ color: '#A0A0A0', fontFamily: 'JetBrains Mono, monospace' }}>{ex}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}

        {/* RUNNING TAB */}
        {activeTab === 'running' && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {runTemplates.map(t => {
              function segDisplay(lap: RunSegment) {
                if (!lap.value) return '—'
                const conf = METRIC_CONFIG[lap.metric]
                return `${lap.value} ${conf.unit}`
              }
              return (
                <div key={t.id} className="rounded-xl overflow-hidden flex flex-col" style={{ background: '#1A1A1A', border: '1px solid #2E2E2E' }}>
                  <div className="p-5 flex-1">
                    <div className="flex items-start justify-between mb-3">
                      <h3 className="text-lg font-black uppercase" style={{ fontFamily: 'Montserrat, sans-serif', color: '#F5F5F5' }}>{t.name}</h3>
                      <EffortBadge effort={t.effort} color={t.effortColor} />
                    </div>
                    <p className="text-xs mb-2" style={{ color: '#606060', fontFamily: 'JetBrains Mono, monospace' }}>{t.duration}</p>
                    <p className="text-sm mb-3 leading-relaxed" style={{ color: '#A0A0A0' }}>{t.description}</p>
                    <div className="rounded p-2.5 text-xs mb-3" style={{ background: '#242424', color: '#A0A0A0', fontStyle: 'italic', border: '1px solid #2E2E2E' }}>
                      💡 {t.tip}
                    </div>
                    <div className="flex items-center gap-3">
                      <button
                        onClick={() => setExpanded(expanded === t.id ? null : t.id)}
                        className="text-xs flex items-center gap-1"
                        style={{ color: '#606060' }}
                      >
                        {expanded === t.id ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
                        {expanded === t.id ? 'Hide structure' : 'View structure'}
                      </button>
                      <button
                        onClick={() => {
                          setEditingTemplate({
                            id: `custom-tpl-${Date.now()}`,
                            name: t.name,
                            type: 'run',
                            description: '',
                            duration: '',
                            notes: '',
                            tags: '',
                            runRows: t.runRows,
                          })
                          setShowModal(true)
                        }}
                        className="text-xs flex items-center gap-1"
                        style={{ color: '#00BFA5' }}
                      >
                        <BookmarkPlus size={12} /> Customise
                      </button>
                    </div>
                    {expanded === t.id && (
                      <div className="mt-3 space-y-1.5">
                        {t.runRows.map((entry, i) => {
                          if ('kind' in entry) {
                            const block = entry as RepeatBlock
                            return (
                              <div key={block.id} className="rounded-lg overflow-hidden" style={{ border: '1px solid #EF444433', background: '#EF44440A' }}>
                                <div className="flex items-center gap-2 px-3 py-1.5" style={{ borderBottom: '1px solid #EF444422' }}>
                                  <span className="text-xs font-bold" style={{ color: '#EF4444', fontFamily: 'JetBrains Mono, monospace' }}>
                                    ×{block.count || '?'} Repeat
                                  </span>
                                </div>
                                <div className="px-3 py-1.5 space-y-1">
                                  {block.laps.map(lap => {
                                    const typeInfo = SEGMENT_TYPES.find(s => s.value === lap.segmentType) ?? SEGMENT_TYPES[1]
                                    return (
                                      <div key={lap.id} className="flex items-center gap-2 text-xs">
                                        <span className="px-1.5 py-0.5 rounded font-semibold flex-shrink-0"
                                          style={{ background: `${typeInfo.color}18`, color: typeInfo.color, border: `1px solid ${typeInfo.color}44`, fontFamily: 'Inter, sans-serif' }}>
                                          {typeInfo.label}
                                        </span>
                                        <span style={{ color: '#A0A0A0', fontFamily: 'JetBrains Mono, monospace' }}>{segDisplay(lap)}</span>
                                      </div>
                                    )
                                  })}
                                </div>
                              </div>
                            )
                          }
                          const seg = entry as RunSegment
                          const typeInfo = SEGMENT_TYPES.find(s => s.value === seg.segmentType) ?? SEGMENT_TYPES[1]
                          return (
                            <div key={seg.id} className="flex items-center gap-2 px-3 py-2 rounded-lg" style={{ background: '#242424', border: '1px solid #2E2E2E' }}>
                              <span className="text-xs" style={{ color: '#3E3E3E', fontFamily: 'JetBrains Mono, monospace', width: '16px', flexShrink: 0 }}>{i + 1}</span>
                              <span className="text-xs font-semibold px-1.5 py-0.5 rounded flex-shrink-0"
                                style={{ background: `${typeInfo.color}18`, color: typeInfo.color, border: `1px solid ${typeInfo.color}44`, fontFamily: 'Inter, sans-serif' }}>
                                {typeInfo.label}
                              </span>
                              <span className="text-xs" style={{ color: '#A0A0A0', fontFamily: 'JetBrains Mono, monospace' }}>{segDisplay(seg)}</span>
                            </div>
                          )
                        })}
                      </div>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        )}

        {/* HYBRID COMBOS TAB */}
        {activeTab === 'hybrid' && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {hybridTemplates.map(t => (
              <div key={t.id} className="rounded-xl overflow-hidden" style={{ background: '#1A1A1A', border: '1px solid #2E2E2E' }}>
                <div className="p-5">
                  <div className="flex items-start justify-between mb-2">
                    <h3 className="text-xl font-black uppercase" style={{ fontFamily: 'Montserrat, sans-serif', color: '#F5F5F5' }}>{t.name}</h3>
                    <span className="px-2 py-1 rounded text-xs font-semibold whitespace-nowrap" style={{ background: `${t.interferenceColor}18`, color: t.interferenceColor, border: `1px solid ${t.interferenceColor}33`, fontFamily: 'Inter, sans-serif' }}>
                      {t.interference} interference
                    </span>
                  </div>
                  <div className="px-3 py-2 rounded mb-3 text-xs" style={{ background: '#242424', color: '#A0A0A0', fontFamily: 'JetBrains Mono, monospace', border: '1px solid #2E2E2E' }}>
                    {t.order}
                  </div>
                  <p className="text-sm mb-3 leading-relaxed" style={{ color: '#A0A0A0' }}>{t.description}</p>
                  <div className="rounded p-2.5 text-xs" style={{ background: 'rgba(0,229,200,0.06)', color: '#A0A0A0', border: '1px solid rgba(0,229,200,0.1)' }}>
                    Recovery: {t.recoveryNotes}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* MY TEMPLATES TAB */}
        {activeTab === 'mine' && (
          <div>
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center gap-3">
                <h2 className="text-2xl font-black uppercase" style={{ fontFamily: 'Montserrat, sans-serif', color: '#F5F5F5' }}>My Templates</h2>
                {customTemplates.length > 0 && (
                  <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold" style={{ background: '#00BFA520', color: '#00BFA5', border: '1px solid #00BFA544', fontFamily: 'Inter, sans-serif' }}>
                    {customTemplates.length}
                  </span>
                )}
              </div>
              <button
                onClick={() => { setEditingTemplate(null); setShowModal(true) }}
                className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold transition-all hover:opacity-90"
                style={{ background: '#00BFA5', color: '#0D0D0D', fontFamily: 'Inter, sans-serif' }}
              >
                <Plus size={14} /> New Template
              </button>
            </div>

            {customTemplates.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-20 text-center">
                <div className="w-20 h-20 rounded-2xl flex items-center justify-center mb-6" style={{ background: '#1A1A1A', border: '2px dashed #2E2E2E' }}>
                  <Plus size={32} style={{ color: '#2E2E2E' }} />
                </div>
                <h3 className="text-3xl font-black uppercase mb-2" style={{ fontFamily: 'Montserrat, sans-serif', color: '#606060' }}>
                  No Templates Yet
                </h3>
                <p className="text-sm mb-6" style={{ color: '#606060', maxWidth: '320px' }}>
                  Create your own templates or fork from the library to build your personal collection.
                </p>
                <div className="flex gap-3">
                  <button
                    onClick={() => { setEditingTemplate(null); setShowModal(true) }}
                    className="px-5 py-2.5 rounded-xl text-sm font-semibold"
                    style={{ background: '#00BFA5', color: '#0D0D0D', fontFamily: 'Inter, sans-serif' }}
                  >
                    Create Template
                  </button>
                  <button
                    onClick={() => setActiveTab('lifting')}
                    className="px-5 py-2.5 rounded-xl text-sm font-semibold"
                    style={{ background: '#1A1A1A', color: '#A0A0A0', border: '1px solid #2E2E2E', fontFamily: 'Inter, sans-serif' }}
                  >
                    Browse Library
                  </button>
                </div>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {customTemplates.map(t => (
                  <CustomTemplateCard
                    key={t.id}
                    template={t}
                    onEdit={() => setEditingTemplate(t)}
                    onDelete={() => handleDelete(t.id)}
                    onToast={showToast}
                  />
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
