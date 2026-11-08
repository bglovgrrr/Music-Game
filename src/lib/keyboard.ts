/**
 * iPhones only raise the keyboard when focus happens during a tap. When a tap leads to a
 * screen with a text field (e.g. asking a question → the song search), call this in the tap
 * handler: it focuses an invisible field right away so the keyboard comes up, and the next
 * screen's field takes the focus over (the keyboard stays up).
 */
export function primeKeyboard() {
  try {
    let el = document.getElementById('keyboard-primer') as HTMLInputElement | null
    if (!el) {
      el = document.createElement('input')
      el.id = 'keyboard-primer'
      el.setAttribute('aria-hidden', 'true')
      el.tabIndex = -1
      // 16px avoids iOS zooming in; nearly invisible but still focusable
      el.style.cssText = 'position:fixed;top:0;left:0;width:1px;height:1px;opacity:0;font-size:16px;border:0;padding:0;pointer-events:none'
      document.body.appendChild(el)
    }
    el.focus({ preventScroll: true })
    window.setTimeout(() => el?.remove(), 4000)
  } catch {
    /* ignore */
  }
}
