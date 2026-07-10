import { create } from 'zustand'
import { toast } from 'sonner'

const useModStore = create((set, get) => ({
  searchResults: { hits: [], totalHits: 0 },
  searchQuery: '',
  filters: { gameVersion: '', loader: '' },
  installedMods: [],
  installing: {},
  loading: false,
  offset: 0,
  limit: 20,

  setQuery: (query) => set({ searchQuery: query }),

  setFilters: (filters) =>
    set((state) => ({
      filters: { ...state.filters, ...filters },
      offset: 0,
      searchResults: { hits: [], totalHits: 0 }
    })),

  search: async (queryText = '', append = false) => {
    set({ searchQuery: queryText })
    const { filters, offset, limit } = get()

    set({ loading: true })

    try {
      const sortBy = !queryText.trim() ? 'downloads' : 'relevance'
      const results = await window.api.mods.search(queryText, {
        ...filters,
        offset: append ? offset : 0,
        limit,
        sortBy
      })

      if (append) {
        set((state) => ({
          searchResults: {
            hits: [...state.searchResults.hits, ...(results.hits || [])],
            totalHits: results.totalHits || 0
          },
          offset: state.offset + limit,
          loading: false
        }))
      } else {
        set({
          searchResults: {
            hits: results.hits || [],
            totalHits: results.totalHits || 0
          },
          offset: limit,
          loading: false
        })
      }
    } catch (err) {
      toast.error('Failed to search mods: ' + (err.message || err))
      set({ loading: false })
    }
  },

  install: async (projectId, versionId) => {
    set((state) => ({
      installing: { ...state.installing, [projectId]: true }
    }))

    try {
      await window.api.mods.install(projectId, versionId || null)
      const installed = await window.api.mods.getInstalled()
      set((state) => ({
        installing: { ...state.installing, [projectId]: false },
        installedMods: installed || []
      }))
    } catch (err) {
      set((state) => ({
        installing: { ...state.installing, [projectId]: false }
      }))
      throw err
    }
  },

  uninstall: async (filename) => {
    try {
      await window.api.mods.uninstall(filename)
      toast.success('Mod uninstalled')
      get().loadInstalled()
    } catch (err) {
      toast.error('Failed to uninstall mod: ' + (err.message || err))
    }
  },

  loadInstalled: async () => {
    try {
      const mods = await window.api.mods.getInstalled()
      set({ installedMods: mods || [] })
    } catch (err) {
      console.error('Failed to load installed mods:', err)
    }
  }
}))

export default useModStore
