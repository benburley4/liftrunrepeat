'use client'

import { useEffect, useState } from 'react'
import { User, Save, Sparkles } from 'lucide-react'
import { AthleteProfile, loadProfile, saveProfile, daysToRace } from '@/lib/athleteProfile'

const inputStyle: React.CSSProperties = {
  width: '100%',
  padding: '10px 12px',
  borderRadius: '10px',
  background: '#1E1E1E',
  border: '1px solid #2E2E2E',
  color: '#F5F5F5',
  fontSize: '14px',
  fontFamily: 'var(--font-sans)',
  outline: 'none',
  boxSizing: 'border-box',
}

const labelStyle: React.CSSProperties = {
  display: 'block',
  fontSize: '11px',
  color: '#606060',
  textTransform: 'uppercase',
  letterSpacing: '0.06em',
  marginBottom: '6px',
  fontFamily: 'var(--font-sans)',
}

function Field({ label, value, onChange, placeholder, type = 'text' }: {
  label: string
  value: string
  onChange: (v: string) => void
  placeholder?: string
  type?: string
}) {
  return (
    <div>
      <label style={labelStyle}>{label}</label>
      <input
        type={type}
        value={value}
        onChange={e => onChange(e.target.value)}
        placeholder={placeholder}
        style={inputStyle}
        onFocus={e => (e.target.style.borderColor = '#00BFA544')}
        onBlur={e => (e.target.style.borderColor = '#2E2E2E')}
      />
    </div>
  )
}

function SectionCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div style={{ borderRadius: '20px', background: '#141414', border: '1px solid #2E2E2E', overflow: 'hidden', marginBottom: '20px' }}>
      <div style={{ padding: '14px 24px', borderBottom: '1px solid #2E2E2E' }}>
        <p style={{ fontSize: '13px', fontWeight: 700, color: '#00BFA5', fontFamily: 'var(--font-sans)', textTransform: 'uppercase', letterSpacing: '0.05em', margin: 0 }}>
          {title}
        </p>
      </div>
      <div style={{ padding: '24px' }}>{children}</div>
    </div>
  )
}

export default function ProfilePage() {
  const [profile, setProfile] = useState<AthleteProfile>({})
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    loadProfile().then(p => { setProfile(p); setLoading(false) }).catch(() => setLoading(false))
  }, [])

  function set(key: keyof AthleteProfile) {
    return (v: string) => { setProfile(prev => ({ ...prev, [key]: v })); setSaved(false) }
  }

  async function handleSave() {
    setSaving(true)
    setError('')
    try {
      await saveProfile(profile)
      setSaved(true)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to save profile')
    } finally {
      setSaving(false)
    }
  }

  const raceDays = daysToRace(profile)

  return (
    <div style={{ minHeight: '100vh', background: '#0D0D0D', padding: '96px 16px 48px' }}>
      <div style={{ maxWidth: '760px', margin: '0 auto' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '8px' }}>
          <User size={20} style={{ color: '#00BFA5' }} />
          <h1 style={{ fontSize: '24px', fontWeight: 900, color: '#F5F5F5', fontFamily: 'var(--font-heading)', textTransform: 'uppercase', letterSpacing: '0.04em', margin: 0 }}>
            Athlete Profile
          </h1>
        </div>
        <p style={{ color: '#A0A0A0', fontSize: '14px', fontFamily: 'var(--font-sans)', marginBottom: '28px', display: 'flex', alignItems: 'center', gap: '6px' }}>
          <Sparkles size={14} style={{ color: '#A78BFA' }} />
          Everything here feeds your AI coach — programme generation, weekly reports, and reviews are all tailored to this profile.
        </p>

        {loading ? (
          <p style={{ color: '#606060', fontFamily: 'var(--font-sans)' }}>Loading…</p>
        ) : (
          <>
            <SectionCard title="About You">
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: '16px' }}>
                <Field label="Age" value={profile.age ?? ''} onChange={set('age')} placeholder="e.g. 34" />
                <Field label="Sex" value={profile.sex ?? ''} onChange={set('sex')} placeholder="e.g. Male" />
                <Field label="Bodyweight (kg)" value={profile.bodyweightKg ?? ''} onChange={set('bodyweightKg')} placeholder="e.g. 78" />
                <Field label="Training age (years)" value={profile.trainingAgeYears ?? ''} onChange={set('trainingAgeYears')} placeholder="e.g. 5" />
              </div>
            </SectionCard>

            <SectionCard title="Current 1RMs (kg)">
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: '16px' }}>
                <Field label="Back Squat" value={profile.squat1RM ?? ''} onChange={set('squat1RM')} placeholder="e.g. 140" />
                <Field label="Bench Press" value={profile.bench1RM ?? ''} onChange={set('bench1RM')} placeholder="e.g. 100" />
                <Field label="Deadlift" value={profile.deadlift1RM ?? ''} onChange={set('deadlift1RM')} placeholder="e.g. 180" />
                <Field label="Overhead Press" value={profile.ohp1RM ?? ''} onChange={set('ohp1RM')} placeholder="e.g. 60" />
              </div>
            </SectionCard>

            <SectionCard title="Goal Race">
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '16px' }}>
                <Field label="Distance" value={profile.raceDistance ?? ''} onChange={set('raceDistance')} placeholder="e.g. Half Marathon" />
                <Field label="Race date" value={profile.raceDate ?? ''} onChange={set('raceDate')} type="date" />
                <Field label="Target time" value={profile.raceTargetTime ?? ''} onChange={set('raceTargetTime')} placeholder="e.g. 1:45:00" />
                <Field label="Recent race result" value={profile.recentRaceResult ?? ''} onChange={set('recentRaceResult')} placeholder="e.g. 10K in 48:30 (May 2026)" />
              </div>
              {raceDays !== null && (
                <p style={{ marginTop: '16px', marginBottom: 0, color: '#00BFA5', fontSize: '13px', fontWeight: 700, fontFamily: 'var(--font-sans)' }}>
                  {raceDays === 0 ? 'Race day is today — good luck!' : `${raceDays} days to race day`}
                </p>
              )}
            </SectionCard>

            <SectionCard title="Injuries & Other Context">
              <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                <div>
                  <label style={labelStyle}>Injuries / limitations</label>
                  <textarea
                    value={profile.injuries ?? ''}
                    onChange={e => set('injuries')(e.target.value)}
                    placeholder="e.g. Left knee patellar tendinopathy — avoid deep jump landings"
                    rows={2}
                    style={{ ...inputStyle, resize: 'vertical' }}
                    onFocus={e => (e.target.style.borderColor = '#00BFA544')}
                    onBlur={e => (e.target.style.borderColor = '#2E2E2E')}
                  />
                </div>
                <div>
                  <label style={labelStyle}>Anything else (sleep, work schedule, equipment…)</label>
                  <textarea
                    value={profile.notes ?? ''}
                    onChange={e => set('notes')(e.target.value)}
                    placeholder="e.g. Shift worker, trains early mornings; home gym with barbell + dumbbells only"
                    rows={3}
                    style={{ ...inputStyle, resize: 'vertical' }}
                    onFocus={e => (e.target.style.borderColor = '#00BFA544')}
                    onBlur={e => (e.target.style.borderColor = '#2E2E2E')}
                  />
                </div>
              </div>
            </SectionCard>

            {error && <p style={{ color: '#C8102E', fontSize: '13px', fontFamily: 'var(--font-sans)' }}>{error}</p>}

            <button
              onClick={handleSave}
              disabled={saving}
              style={{
                display: 'flex', alignItems: 'center', gap: '8px',
                padding: '14px 28px', borderRadius: '12px',
                background: saving ? '#1A1A1A' : saved ? '#1A1A1A' : '#00BFA5',
                color: saving ? '#606060' : saved ? '#00BFA5' : '#0D0D0D',
                border: saved ? '1px solid #00BFA544' : 'none',
                fontWeight: 800, fontSize: '14px',
                cursor: saving ? 'not-allowed' : 'pointer',
                fontFamily: 'var(--font-sans)',
              }}
            >
              <Save size={16} />
              {saving ? 'Saving…' : saved ? 'Saved ✓' : 'Save Profile'}
            </button>
          </>
        )}
      </div>
    </div>
  )
}
