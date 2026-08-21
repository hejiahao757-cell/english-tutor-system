import { cp, mkdir, readdir, stat } from 'node:fs/promises'
import { resolve } from 'node:path'

const source = resolve('legacy-content')
const target = resolve('dist', 'legacy-content')

await mkdir(target, { recursive: true })
await cp(source, target, { recursive: true, force: true })

const names = await readdir(target)
const htmlFiles = names.filter(name => name.toLowerCase().endsWith('.html'))
if (htmlFiles.length !== 9) {
  throw new Error(`Expected 9 legacy HTML files, found ${htmlFiles.length}`)
}

let totalBytes = 0
for (const name of htmlFiles) totalBytes += (await stat(resolve(target, name))).size
process.stdout.write(`Copied ${htmlFiles.length} legacy HTML files (${totalBytes} bytes)\n`)
