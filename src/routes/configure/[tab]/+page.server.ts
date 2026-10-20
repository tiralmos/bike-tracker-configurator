import type { EntryGenerator } from "./$types"

export const entries: EntryGenerator = () => {
  return [{ tab: "stations" }, { tab: "customize" }, { tab: "advanced" }]
}
