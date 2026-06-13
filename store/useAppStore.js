import { create } from 'zustand'

const useAppStore = create((set) => ({
  tenant:    null,
  user:      null,
  setTenant: (tenant) => set({ tenant }),
  setUser:   (user)   => set({ user }),
}))

export default useAppStore
