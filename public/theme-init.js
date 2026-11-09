// Applies the saved light/dark choice before the app loads (no flash of the wrong theme).
try {
  var t = localStorage.getItem('mm:theme') || localStorage.getItem('sideb:theme')
  if (t === 'light' || t === 'dark') document.documentElement.setAttribute('data-theme', t)
} catch {}
