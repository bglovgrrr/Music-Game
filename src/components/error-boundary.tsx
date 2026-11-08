import { Component, type ReactNode } from 'react'
import { report } from '@/lib/report'

/** If a screen crashes: say so kindly, report it, and offer a reload (the game is saved). */
export class ErrorBoundary extends Component<{ children: ReactNode }, { failed: boolean }> {
  state = { failed: false }

  static getDerivedStateFromError() {
    return { failed: true }
  }

  componentDidCatch(error: unknown) {
    report('react', error)
  }

  render() {
    if (!this.state.failed) return this.props.children
    return (
      <div className="grid min-h-dvh place-items-center p-6">
        <div className="paper paper-texture on-table grid max-w-sm gap-3 rounded-[4px] bg-[var(--paper)] p-6 text-center">
          <p className="font-display text-2xl font-bold [font-stretch:80%]">The tape got tangled.</p>
          <p className="text-sm text-muted-foreground">Something went wrong on this screen. Your game is saved; reloading usually fixes it.</p>
          <button
            className="key mx-auto cursor-pointer rounded-[10px] bg-primary px-5 py-2.5 font-semibold text-primary-foreground"
            onClick={() => location.reload()}
          >
            Reload
          </button>
        </div>
      </div>
    )
  }
}
