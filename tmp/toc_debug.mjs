const mod = await import('../app/services/report_v4/artifact_sections.ts')
const html = `<!DOCTYPE html><html><body>
<div class="cover-panel"><h1 class="cover-title">Staff</h1></div>
<div class="band"><div class="band-title">Load</div></div>
<p>load body</p>
<div class="band"><div class="band-title">Wellness</div></div>
<p>wellness body</p>
</body></html>`
const a = mod.ensureSectionAnchorsInHtml(html)
console.log('stamped', a.stamped)
console.log('sections', mod.indexArtifactSections(a.html).map((s) => ({ id: s.id, t: s.bandTitle })))
const toc = mod.ensureTocInHtml(a.html, { language: 'en', reportTitle: 'Staff' })
console.log('added', toc.added)
console.log(
  'sections after',
  mod.indexArtifactSections(toc.html).map((s) => ({ id: s.id, t: s.bandTitle }))
)
console.log('has sommaire', /id=["']sommaire["']/.test(toc.html))
