const SCIENTIFIC_NOTES_KEY = 'sharpstone.scientific-notes-read.v1'
const SCIENTIFIC_NOTE_EVENT = 'stonephys:scientific-note-read'

export function readScientificNotes() {
  try {
    const value: unknown = JSON.parse(window.localStorage.getItem(SCIENTIFIC_NOTES_KEY) ?? '[]')
    return Array.isArray(value) ? value.filter((note): note is string => typeof note === 'string') : []
  } catch {
    return []
  }
}

export function recordScientificNoteRead(noteId: string) {
  const notes = new Set(readScientificNotes())
  if (notes.has(noteId)) return
  notes.add(noteId)
  try { window.localStorage.setItem(SCIENTIFIC_NOTES_KEY, JSON.stringify([...notes])) } catch { /* Keep note progress for this visit via the event. */ }
  window.dispatchEvent(new CustomEvent(SCIENTIFIC_NOTE_EVENT, { detail: { noteId } }))
}

export const scientificNoteReadEvent = SCIENTIFIC_NOTE_EVENT
