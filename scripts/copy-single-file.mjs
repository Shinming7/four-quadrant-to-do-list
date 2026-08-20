import { readFile, writeFile } from 'node:fs/promises'

const html = await readFile('dist/index.html', 'utf8')
const scriptStart = html.indexOf('<script type="module" crossorigin>')
const scriptEnd = html.lastIndexOf('</script>') + '</script>'.length
const rawScript = html.slice(scriptStart, scriptEnd)
const scriptContent = rawScript.slice(rawScript.indexOf('>') + 1, rawScript.lastIndexOf('</script>')).replace(/<\/script/gi, '<\\/script')
const script = `<script>window.addEventListener('DOMContentLoaded', () => {\n${scriptContent}\n})</script>`
const htmlWithoutHeadScript = html.slice(0, scriptStart) + html.slice(scriptEnd)
const singleFileHtml = htmlWithoutHeadScript.replace('</body>', `${script}</body>`)
await writeFile('dist/index.html', singleFileHtml)
await writeFile('四象限待办.html', singleFileHtml)