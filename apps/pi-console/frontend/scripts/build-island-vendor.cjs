// Build only the components used by this dashboard. The source archive stays
// byte-for-byte intact under ../../vendor; no upstream lifecycle scripts run.
const fs = require('fs/promises')
const path = require('path')
const babel = require('@babel/core')
const less = require('less')
const crypto = require('crypto')
const root = path.resolve(__dirname, '../..')
const source = path.join(root, 'vendor/animal-island-ui/src')
const out = path.join(root, 'frontend/src/vendor/animal-island')

async function main() {
  const manifest = []
  for (const component of ['Card', 'Button', 'Tag', 'Progress']) {
    const directory = path.join(source, 'components', component)
    const target = path.join(out, component)
    await fs.mkdir(target, { recursive: true })
    for (const name of await fs.readdir(directory)) {
      if (!/\.(tsx?|less)$/.test(name) || /\.test\./.test(name)) continue
      const original = await fs.readFile(path.join(directory, name), 'utf8')
      manifest.push({ source: `src/components/${component}/${name}`, sha256: crypto.createHash('sha256').update(original).digest('hex') })
      if (name.endsWith('.less')) {
        const result = await less.render(original, { filename: path.join(directory, name) })
        await fs.writeFile(path.join(target, name.replace(/\.less$/, '.css')), result.css)
      } else {
        const result = babel.transformSync(original.replace(/\.module\.less/g, '.module.css'), {
          filename: name, babelrc: false, configFile: false,
          presets: [['@babel/preset-typescript', { onlyRemoveTypeImports: false }]],
          comments: false
        })
        await fs.writeFile(path.join(target, name.replace(/\.tsx?$/, '.js')), '// Generated from the pinned Animal Island source. Do not edit.\n' + result.code + '\n')
      }
    }
  }
  const vars = await fs.readFile(path.join(source, 'styles/variables.less'), 'utf8')
  const theme = await fs.readFile(path.join(source, 'styles/themes/default.less'), 'utf8')
  await fs.writeFile(path.join(out, 'tokens.css'), (await less.render(vars + '\n' + theme)).css)
  const assets = ['fonts/nunito-latin-500-normal.woff2', 'fonts/nunito-latin-700-normal.woff2', 'fonts/nunito-latin-900-normal.woff2',
    'img/icons/icon-map.svg', 'img/icons/icon-leaf.png', 'img/icons/icon-chat.svg', 'img/icons/icon-diy.svg', 'img/icons/wifi.svg', 'img/footer/footer-tree.webp']
  for (const file of assets) {
    const target = path.join(out, 'assets', file)
    await fs.mkdir(path.dirname(target), { recursive: true })
    await fs.copyFile(path.join(source, 'assets', file), target)
  }
  await fs.copyFile(path.join(root, 'vendor/animal-island-ui/LICENSE'), path.join(out, 'LICENSE'))
  await fs.writeFile(path.join(out, 'BUILD-MANIFEST.json'), JSON.stringify({ upstream: '891455ac8bd1194b1adc5e3a768bc3dd7ad713c5', components: manifest, assets }, null, 2) + '\n')
  console.log('Animal Island: four real components, design tokens, selected artwork and local fonts built from vendored source.')
}
main().catch(error => { console.error(error); process.exitCode = 1 })
