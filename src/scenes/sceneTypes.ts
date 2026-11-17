import type { ReactNode } from 'react'

export type SceneLayer = {
  id: string
  image: string
  depth: number
  opacity?: number
  parallax?: number
  fit?: 'cover' | 'contain'
}

export type SceneProp = { id: string; kind: 'component'; render: (time: number, reverseProgress?: number) => ReactNode }
export type SceneLocale = 'pt-BR' | 'en'
export type LocalizedText = Partial<Record<SceneLocale, string>>
export type SceneActor = { id: string; presentation: 'voice' | 'sprite' | 'model'; narration?: string | null; narrationByLocale?: LocalizedText }
export type SceneCue = { id: string; start: number; end: number; subtitle?: string; subtitleByLocale?: LocalizedText; cameraZoom?: number; rewind?: boolean; blackout?: boolean }
export type NarrationSegment = { id: string; text: string; startMs: number; endMs: number; wordTimings?: Array<{ text: string; startMs: number; endMs: number }> }
export type NarrationManifest = { sceneId: string; characterId: string; language: string; audioUrl: string; durationMs: number; status: 'approved'; segments: NarrationSegment[] }

export type HistoricalScene = {
  id: string
  title: string
  location: string
  period: string
  localized?: { title?: LocalizedText; location?: LocalizedText; period?: LocalizedText; nextLocation?: LocalizedText; nextPeriod?: LocalizedText }
  duration: number
  layers: SceneLayer[]
  actors: SceneActor[]
  props: SceneProp[]
  timeline: SceneCue[]
  audio: { narration: string | null; narrationManifest?: NarrationManifest | null; ambience: string | null; clock: string | null; transition: string | null }
  nextScene: { id: string; location: string; period: string }
}
