import type { Readable } from "svelte/store"
import type { FeatureCollection } from "geojson"
import { config, type ConfigState } from "./state"

export interface Feed {
  code: string
  name: string
  description: string
  bounds: [number, number, number, number]
}

export interface Stop {
  stopId: string
  stopCode: string | null
  name: string
  lat: number
  lon: number
}

export interface StationListEntry {
  stationId: string
  name: string
  lat: number
  lon: number
}

export interface StationStatus {
  stationId: string
  name: string
  capacity: number | null
  docksAvailable: number
  mechanicalBikesAvailable: number
  electricBikesAvailable: number
  isInstalled: boolean
  isRenting: boolean
  isReturning: boolean
  lastReported: number | null
}

class BikeTrackerApi {
  private baseUrl!: string

  constructor(state: Readable<ConfigState>) {
    state.subscribe((config) => {
      this.baseUrl = new URL(config.apiBaseUrl).origin
    })
  }

  async getFeeds(): Promise<Feed[]> {
    const response = await fetch(`${this.baseUrl}/feeds`)
    if (!response.ok) {
      throw new Error(`Error fetching feeds: ${response.statusText}`)
    }
    return response.json()
  }

  async getServiceAreas(): Promise<FeatureCollection> {
    const response = await fetch(`${this.baseUrl}/feeds/service-areas`)
    if (!response.ok) {
      throw new Error(`Error fetching service areas: ${response.statusText}`)
    }
    return response.json()
  }

  async listStations(): Promise<StationListEntry[]> {
    const response = await fetch(`${this.baseUrl}/stations`)
    if (!response.ok) {
      throw new Error(`Error fetching stations: ${response.statusText}`)
    }
    return response.json()
  }

  async getStations(stationIds: string[], signal?: AbortSignal): Promise<StationStatus[]> {
    const response = await fetch(
      `${this.baseUrl}/stations/${encodeURIComponent(stationIds.join(";"))}`,
      { signal }
    )
    if (!response.ok) {
      throw new Error(`Error fetching stations: ${response.statusText}`)
    }
    const { stations } = await response.json()
    return stations
  }

  async getStopsWithin(bounds: number[][], signal?: AbortSignal): Promise<Stop[]> {
    const response = await fetch(
      `${this.baseUrl}/stops/within/${bounds[0][0]},${bounds[0][1]},${bounds[1][0]},${bounds[1][1]}`,
      { signal }
    )
    if (!response.ok) {
      throw new Error(`Error fetching stops: ${response.statusText}`)
    }
    return response.json()
  }
}

export const api = new BikeTrackerApi(config)
