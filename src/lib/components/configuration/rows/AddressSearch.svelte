<script lang="ts">
  import { Search } from "@lucide/svelte"
  import debounce from "p-debounce"

  interface Props {
    onPlaceSelected?: (location: { lat: number; lng: number }) => void
  }

  let { onPlaceSelected }: Props = $props()

  interface Place {
    label: string
    lat: number
    lng: number
  }

  let query = $state("")
  let results: Place[] = $state([])
  let failed = $state(false)

  // French national address search (Géoplateforme): free, no key needed.
  // Results are biased towards Lyon.
  const GEOCODER_URL = "https://data.geopf.fr/geocodage/search"

  async function _search(text: string) {
    if (text.trim().length < 3) {
      results = []
      return
    }

    try {
      const params = new URLSearchParams({
        q: text,
        limit: "5",
        lat: "45.76",
        lon: "4.84",
        index: "address,poi"
      })
      const response = await fetch(`${GEOCODER_URL}?${params}`)
      if (!response.ok) throw new Error(response.statusText)
      const data = await response.json()
      failed = false
      results = (data.features ?? []).map((feature: any) => ({
        label: feature.properties?.label ?? feature.properties?.name ?? text,
        lng: feature.geometry.coordinates[0],
        lat: feature.geometry.coordinates[1]
      }))
    } catch (error) {
      console.error("Address search failed:", error)
      failed = true
      results = []
    }
  }

  const search = debounce(_search, 300)

  function pick(place: Place) {
    query = place.label
    results = []
    onPlaceSelected?.({ lat: place.lat, lng: place.lng })
  }
</script>

<div class="relative w-80 max-w-[80vw]">
  <Search class="absolute left-2 top-2.5 text-gray-500" size={16} />
  <input
    class="w-full rounded-md border border-gray-300 bg-white py-2 pl-8 pr-3 text-sm text-black shadow-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
    type="text"
    placeholder="Search an address or place in Lyon..."
    bind:value={query}
    oninput={() => search(query)}
    onkeydown={(e) => {
      if (e.key === "Enter") {
        e.preventDefault()
        if (results.length > 0) pick(results[0])
      }
    }}
  />
  {#if results.length > 0}
    <div class="absolute z-10 mt-1 w-full rounded-md border bg-white text-black shadow-md">
      {#each results as place (place.label + place.lat + place.lng)}
        <button
          class="block w-full px-3 py-2 text-left text-sm hover:bg-gray-100"
          onclick={() => pick(place)}
        >
          {place.label}
        </button>
      {/each}
    </div>
  {:else if failed}
    <div class="mt-1 rounded-md bg-white px-3 py-1 text-xs text-gray-600 shadow">
      Address search is unavailable. Move the map by hand instead.
    </div>
  {/if}
</div>
