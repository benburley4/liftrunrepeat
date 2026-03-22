'use client'

import { useState, useEffect } from 'react'
import { Search, ChevronDown, ChevronUp, Plus, X, Check, Trash2 } from 'lucide-react'
import { exercises as builtInExercises, Exercise } from '@/lib/mockData'
import QuickLogFAB from '@/components/log/QuickLogFAB'
import MuscleBodyMap from '@/components/ui/MuscleBodyMap'
import { getCustomExercises, upsertCustomExercise, deleteCustomExercise } from '@/lib/db'

const CUSTOM_KEY = 'thhl_custom_library_exercises'

type Category = 'all' | Exercise['category']

const categories: { id: Category; label: string }[] = [
  { id: 'all', label: 'All' },
  { id: 'barbell', label: 'Barbell' },
  { id: 'dumbbell', label: 'Dumbbell' },
  { id: 'machine', label: 'Machine' },
  { id: 'bodyweight', label: 'Bodyweight' },
  { id: 'run-drill', label: 'Run Drills' },
  { id: 'mobility', label: 'Mobility' },
]

const categoryColors: Record<string, string> = {
  barbell: '#00BFA5',
  dumbbell: '#4CAF50',
  machine: '#F59E0B',
  bodyweight: '#A78BFA',
  'run-drill': '#C8102E',
  mobility: '#06B6D4',
}

function loadCustom(): Exercise[] {
  try { return JSON.parse(localStorage.getItem(CUSTOM_KEY) || '[]') } catch { return [] }
}

function saveCustom(list: Exercise[]) {
  localStorage.setItem(CUSTOM_KEY, JSON.stringify(list))
}

export default function LibraryPage() {
  const [search, setSearch] = useState('')
  const [activeCategory, setActiveCategory] = useState<Category>('all')
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set())
  const [loggedToast, setLoggedToast] = useState<string | null>(null)
  const [customExercises, setCustomExercises] = useState<Exercise[]>([])
  const [showAddModal, setShowAddModal] = useState(false)

  // Add form state
  const [newName, setNewName] = useState('')
  const [newCategory, setNewCategory] = useState<Exercise['category']>('barbell')
  const [newMuscles, setNewMuscles] = useState('')
  const [newCues, setNewCues] = useState('')

  useEffect(() => {
    getCustomExercises()
      .then(exs => setCustomExercises(exs as Exercise[]))
      .catch(() => setCustomExercises(loadCustom()))
  }, [])

  const allExercises = [...builtInExercises, ...customExercises]

  const filtered = allExercises.filter(ex => {
    const matchesSearch = ex.name.toLowerCase().includes(search.toLowerCase()) ||
      ex.primaryMuscles.some(m => m.toLowerCase().includes(search.toLowerCase()))
    const matchesCategory = activeCategory === 'all' || ex.category === activeCategory
    return matchesSearch && matchesCategory
  })

  const handleLog = (name: string) => {
    setLoggedToast(name)
    setTimeout(() => setLoggedToast(null), 2000)
  }

  function handleAddExercise() {
    if (!newName.trim()) return
    const ex: Exercise = {
      id: `custom-${Date.now()}`,
      name: newName.trim(),
      category: newCategory,
      primaryMuscles: newMuscles.split(',').map(m => m.trim()).filter(Boolean),
      cues: newCues.split('\n').map(c => c.trim()).filter(Boolean),
    }
    setCustomExercises(prev => [...prev, ex])
    upsertCustomExercise(ex.id, ex).catch(console.error)
    setShowAddModal(false)
    setNewName(''); setNewMuscles(''); setNewCues('')
  }

  function handleDeleteCustom(id: string) {
    setCustomExercises(prev => prev.filter(ex => ex.id !== id))
    deleteCustomExercise(id).catch(console.error)
  }

  const isCustom = (id: string) => id.startsWith('custom-')

  const inputStyle: React.CSSProperties = {
    width: '100%', padding: '10px 14px', borderRadius: '10px',
    background: '#1E1E1E', border: '1px solid #2E2E2E',
    color: '#F5F5F5', fontSize: '13px', fontFamily: 'Inter, sans-serif',
    outline: 'none', boxSizing: 'border-box',
  }

  return (
    <div style={{ background: '#0D0D0D', minHeight: '100vh' }}>
      <QuickLogFAB />

      {loggedToast && (
        <div className="fixed bottom-24 right-6 z-50 px-4 py-3 rounded-xl"
          style={{ background: '#1A1A1A', border: '1px solid #00BFA5' }}>
          <span className="text-sm" style={{ color: '#F5F5F5' }}>
            ✓ <strong style={{ color: '#00BFA5' }}>{loggedToast}</strong> added to session
          </span>
        </div>
      )}

      {/* Header */}
      <div className="pt-16 pb-6" style={{ background: '#0A0A0A', borderBottom: '1px solid #1A1A1A' }}>
        <div className="max-w-6xl mx-auto px-4 sm:px-6 pt-8">
          <p className="text-xs uppercase tracking-widest mb-2" style={{ color: '#00BFA5' }}>Reference</p>
          <div className="flex items-end justify-between gap-4 mb-4">
            <h1 className="text-5xl font-black uppercase" style={{ fontFamily: 'Montserrat, sans-serif', color: '#F5F5F5' }}>
              Exercise Library
            </h1>
            <button
              onClick={() => setShowAddModal(true)}
              className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold shrink-0"
              style={{ background: '#00BFA5', color: '#0D0D0D', fontFamily: 'Inter, sans-serif', border: 'none', cursor: 'pointer' }}
            >
              <Plus size={15} />
              Add Exercise
            </button>
          </div>

          {/* Search bar */}
          <div className="relative max-w-lg">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: '#606060' }} />
            <input
              type="text" value={search} onChange={e => setSearch(e.target.value)}
              placeholder="Search exercises or muscles..."
              className="w-full pl-10 pr-4 py-3 rounded-xl outline-none text-sm"
              style={{ background: '#1A1A1A', color: '#F5F5F5', border: '1px solid #2E2E2E', fontFamily: 'Inter, sans-serif' }}
            />
          </div>
        </div>
      </div>

      {/* Category tabs */}
      <div className="sticky top-16 z-30"
        style={{ background: 'rgba(13,13,13,0.95)', backdropFilter: 'blur(12px)', borderBottom: '1px solid #1A1A1A' }}>
        <div className="max-w-6xl mx-auto px-4 sm:px-6">
          <div className="flex gap-1 overflow-x-auto pb-px">
            {categories.map(cat => (
              <button key={cat.id} onClick={() => setActiveCategory(cat.id)}
                className="px-4 py-4 text-sm font-medium whitespace-nowrap transition-colors relative"
                style={{ color: activeCategory === cat.id ? (cat.id === 'all' ? '#00BFA5' : (categoryColors[cat.id] || '#00BFA5')) : '#606060', fontFamily: 'Inter, sans-serif' }}>
                {cat.label}
                {activeCategory === cat.id && (
                  <div className="absolute bottom-0 left-0 right-0 h-0.5"
                    style={{ background: cat.id === 'all' ? '#00BFA5' : (categoryColors[cat.id] || '#00BFA5') }} />
                )}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="max-w-6xl mx-auto px-4 sm:px-6 py-8">
        <p className="text-xs mb-5" style={{ color: '#606060' }}>
          Showing {filtered.length} of {allExercises.length} exercises
          {customExercises.length > 0 && <span style={{ color: '#00BFA5' }}> · {customExercises.length} custom</span>}
        </p>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map(ex => {
            const color = categoryColors[ex.category] || '#A0A0A0'
            const isCollapsed = collapsed.has(ex.id)
            const custom = isCustom(ex.id)
            const toggleCollapsed = () => setCollapsed(prev => {
              const n = new Set(prev)
              n.has(ex.id) ? n.delete(ex.id) : n.add(ex.id)
              return n
            })

            return (
              <div key={ex.id} className="rounded-xl overflow-hidden"
                style={{ background: '#1A1A1A', border: `1px solid ${custom ? '#00BFA530' : '#2E2E2E'}` }}>
                <div className="p-4">
                  {/* Top row: info + body map */}
                  <div className="flex items-start gap-3">
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div className="flex items-start justify-between mb-2">
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div className="flex items-center gap-2 mb-1">
                            <h3 className="text-base font-black uppercase"
                              style={{ fontFamily: 'Montserrat, sans-serif', color: '#F5F5F5', fontSize: '16px' }}>
                              {ex.name}
                            </h3>
                            {custom && (
                              <span style={{ fontSize: '9px', fontWeight: 700, color: '#00BFA5', background: '#00BFA515', border: '1px solid #00BFA530', borderRadius: '100px', padding: '1px 6px', whiteSpace: 'nowrap', fontFamily: 'Inter, sans-serif' }}>
                                CUSTOM
                              </span>
                            )}
                          </div>
                          <div className="flex flex-wrap gap-1.5">
                            <span className="text-xs px-2 py-0.5 rounded font-semibold capitalize"
                              style={{ background: `${color}18`, color, border: `1px solid ${color}33`, fontSize: '10px' }}>
                              {ex.category.replace('-', ' ')}
                            </span>
                            {ex.primaryMuscles.map(m => (
                              <span key={m} className="text-xs px-1.5 py-0.5 rounded"
                                style={{ background: '#242424', color: '#606060', fontSize: '10px' }}>
                                {m}
                              </span>
                            ))}
                          </div>
                        </div>
                        <div className="flex items-center gap-1.5 shrink-0 ml-2">
                          {custom && (
                            <button onClick={() => handleDeleteCustom(ex.id)}
                              className="w-7 h-7 rounded flex items-center justify-center"
                              style={{ background: 'rgba(200,16,46,0.08)', color: '#3E3E3E', border: '1px solid rgba(200,16,46,0.2)', cursor: 'pointer' }}
                              onMouseEnter={e => (e.currentTarget.style.color = '#C8102E')}
                              onMouseLeave={e => (e.currentTarget.style.color = '#3E3E3E')}
                              title="Delete custom exercise">
                              <Trash2 size={12} />
                            </button>
                          )}
                          <button onClick={() => handleLog(ex.name)}
                            className="w-8 h-8 rounded flex items-center justify-center"
                            style={{ background: 'rgba(0,229,200,0.08)', color: '#00BFA5', border: '1px solid rgba(0,229,200,0.2)', cursor: 'pointer' }}
                            title="Log this exercise">
                            <Plus size={14} />
                          </button>
                        </div>
                      </div>

                      {ex.cues.length > 0 && (
                        <button onClick={toggleCollapsed}
                          className="flex items-center gap-1.5 text-xs mt-2"
                          style={{ color: '#606060', fontFamily: 'Inter, sans-serif', background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}>
                          {isCollapsed ? <ChevronDown size={12} /> : <ChevronUp size={12} />}
                          {isCollapsed ? 'Coaching cues' : 'Hide cues'}
                        </button>
                      )}

                      {!isCollapsed && ex.cues.length > 0 && (
                        <div className="mt-3 space-y-1.5">
                          {ex.cues.map((cue, i) => (
                            <div key={i} className="flex items-start gap-2">
                              <span className="mt-0.5 text-xs font-bold" style={{ color }}>{i + 1}.</span>
                              <span className="text-xs leading-relaxed" style={{ color: '#A0A0A0' }}>{cue}</span>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>

                    {/* Body map */}
                    {ex.primaryMuscles.length > 0 && (
                      <div className="shrink-0" style={{ opacity: 0.85 }}>
                        <MuscleBodyMap primaryMuscles={ex.primaryMuscles} color={color} />
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )
          })}
        </div>

        {filtered.length === 0 && (
          <div className="text-center py-20">
            <p className="text-5xl font-black uppercase mb-3" style={{ fontFamily: 'Montserrat, sans-serif', color: '#2E2E2E' }}>
              NO RESULTS
            </p>
            <p className="text-sm" style={{ color: '#606060' }}>Try a different search term or category</p>
          </div>
        )}
      </div>

      {/* Add Exercise Modal */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4"
          style={{ background: 'rgba(0,0,0,0.85)' }}
          onClick={e => e.target === e.currentTarget && setShowAddModal(false)}>
          <div className="w-full flex flex-col rounded-2xl overflow-hidden"
            style={{ maxWidth: '480px', maxHeight: '90vh', background: '#1A1A1A', border: '1px solid #2E2E2E' }}>

            {/* Header */}
            <div className="flex items-center justify-between px-6 py-4" style={{ borderBottom: '1px solid #2E2E2E' }}>
              <div>
                <p className="text-xs uppercase tracking-widest mb-0.5" style={{ color: '#00BFA5', fontFamily: 'Inter, sans-serif' }}>Library</p>
                <h2 className="text-2xl font-black uppercase" style={{ fontFamily: 'Montserrat, sans-serif', color: '#F5F5F5' }}>Add Exercise</h2>
              </div>
              <button onClick={() => setShowAddModal(false)}
                style={{ background: 'none', border: 'none', color: '#606060', cursor: 'pointer' }}>
                <X size={18} />
              </button>
            </div>

            {/* Body */}
            <div className="flex-1 overflow-y-auto px-6 py-5 space-y-4">
              <div>
                <label style={{ display: 'block', fontSize: '11px', color: '#606060', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '8px', fontFamily: 'Inter, sans-serif' }}>Exercise Name *</label>
                <input type="text" value={newName} onChange={e => setNewName(e.target.value)}
                  placeholder="e.g. Landmine Press" style={inputStyle}
                  onFocus={e => (e.target.style.borderColor = '#00BFA544')}
                  onBlur={e => (e.target.style.borderColor = '#2E2E2E')} />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '11px', color: '#606060', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '8px', fontFamily: 'Inter, sans-serif' }}>Category</label>
                <div className="grid grid-cols-3 gap-2">
                  {categories.filter(c => c.id !== 'all').map(cat => (
                    <button key={cat.id} onClick={() => setNewCategory(cat.id as Exercise['category'])}
                      style={{
                        padding: '8px', borderRadius: '8px', fontSize: '11px', fontWeight: 600, cursor: 'pointer',
                        fontFamily: 'Inter, sans-serif', border: `1px solid ${newCategory === cat.id ? (categoryColors[cat.id] + '44') : '#2E2E2E'}`,
                        background: newCategory === cat.id ? (categoryColors[cat.id] + '20') : '#242424',
                        color: newCategory === cat.id ? categoryColors[cat.id] : '#606060',
                      }}>
                      {cat.label}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '11px', color: '#606060', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '8px', fontFamily: 'Inter, sans-serif' }}>Primary Muscles <span style={{ color: '#3E3E3E' }}>(comma separated)</span></label>
                <input type="text" value={newMuscles} onChange={e => setNewMuscles(e.target.value)}
                  placeholder="e.g. Shoulders, Triceps, Core" style={inputStyle}
                  onFocus={e => (e.target.style.borderColor = '#00BFA544')}
                  onBlur={e => (e.target.style.borderColor = '#2E2E2E')} />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '11px', color: '#606060', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '8px', fontFamily: 'Inter, sans-serif' }}>Coaching Cues <span style={{ color: '#3E3E3E' }}>(one per line, optional)</span></label>
                <textarea value={newCues} onChange={e => setNewCues(e.target.value)}
                  placeholder={'Drive elbow to ceiling\nKeep torso upright\nFull range of motion'}
                  rows={4}
                  style={{ ...inputStyle, resize: 'vertical', lineHeight: '1.5' }}
                  onFocus={e => (e.target.style.borderColor = '#00BFA544')}
                  onBlur={e => (e.target.style.borderColor = '#2E2E2E')} />
              </div>
            </div>

            {/* Footer */}
            <div className="flex items-center justify-between px-6 py-4" style={{ borderTop: '1px solid #2E2E2E' }}>
              <button onClick={() => setShowAddModal(false)}
                style={{ background: 'none', border: 'none', color: '#606060', cursor: 'pointer', fontSize: '14px', fontFamily: 'Inter, sans-serif' }}>
                Cancel
              </button>
              <button onClick={handleAddExercise} disabled={!newName.trim()}
                className="flex items-center gap-1.5 px-5 py-2 rounded-lg text-sm font-semibold"
                style={{
                  background: newName.trim() ? '#00BFA5' : '#1A1A1A',
                  color: newName.trim() ? '#0D0D0D' : '#606060',
                  border: 'none', cursor: newName.trim() ? 'pointer' : 'not-allowed',
                  fontFamily: 'Inter, sans-serif',
                }}>
                <Check size={14} />
                Add to Library
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
