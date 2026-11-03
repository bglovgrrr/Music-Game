// Turns the single-file preview build into a page that can be published as a
// Claude Artifact (strips the document skeleton the Artifact host adds itself).
// Usage: npm run build:preview && node scripts/claude-preview.mjs [out.html]
import { readFileSync, writeFileSync } from 'node:fs'

const html = readFileSync('dist-preview/index.html', 'utf8')
const head = html.match(/<head>([\s\S]*)<\/head>/)[1]
const body = html.match(/<body>([\s\S]*)<\/body>/)[1]
const keep = head.match(
  /<title>[\s\S]*?<\/title>|<link[^>]*fonts\.(?:googleapis|gstatic)[^>]*>|<style[^>]*>[\s\S]*?<\/style>|<script[^>]*>[\s\S]*?<\/script>/g,
)
const out = process.argv[2] ?? 'dist-preview/side-b.html'
writeFileSync(out, `${keep.join('\n')}\n${body}`)
console.log(`Wrote ${out}`)
