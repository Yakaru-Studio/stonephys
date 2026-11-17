import type { ReactNode } from 'react'

export type SceneLayer = {
  id: string
  image: string
  depth: number
  opacity?: number
  parallax?: number
  fit?: 'cover' | 'contain'
}

export type SceneProp = { id: string; kind: 'component'; render: (time: number) => ReactNode }
export type SceneActor = { id: string; presentation: 'voice' | 'sprite' | 'model'; narration?: string | null }
export type SceneCue = { id: string; start: number; end: number; subtitle?: string; cameraZoom?: number; rewind?: boolean; blackout?: boolean }

export type HistoricalScene = {
  id: string
  title: string
  location: string
  period: string
  duration: number
  layers: SceneLayer[]
  actors: SceneActor[]
  props: SceneProp[]
  timeline: SceneCue[]
  audio: { narration: string | null; ambience: string | null; clock: string | null; transition: string | null }
  nextScene: { id: string; location: string; period: string }
}
