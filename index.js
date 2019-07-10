const fs = require('fs')
const path = require('path')
const yaml = require('js-yaml')

function getCMSConfigPath(config) {
  try {
    const cmsEntry = config.plugins.find(
      ({use}) => use === 'gridsome-plugin-netlify-cms',
    )
    const configPath = cmsEntry.options.configPath
    if (configPath !== undefined) return configPath
  } catch (e) {}

  throw new Error(
    'gridsome-plugin-netlify-cms must be configured before gridsome-plugin-netlify-cms-paths',
  )
}

class NetlifyPaths {
  // defaultOptions merged with this.options in App.vue
  static defaultOptions() {
    return {
      contentTypes: [],
      coverField: 'cover_image',
      mimeType: 'text/markdown',
    }
  }

  constructor(api, options = {}) {
    this.options = options

    const {_app, config, context, store} = api

    const cmsConfig = yaml.safeLoad(
      fs.readFileSync(getCMSConfigPath(config), 'utf8'),
    )

    this.mediaFolder = path.join(context, cmsConfig.media_folder)
    this.publicFolder = cmsConfig.public_folder

    let remark = store._transformers[options.mimeType]
    const _resolve = remark.resolveNodeFilePath.bind(remark)
    remark.resolveNodeFilePath = (node, toPath) =>
      _resolve(node, this.fixPath(toPath))

    for (const {use, options: opts} of config.plugins) {
      if (
        use === '@gridsome/source-filesystem' &&
        options.contentTypes.includes(opts.typeName)
      ) {
        const {typeName, route} = opts,
          coverField = opts.coverField || options.coverField,
          ContentType = store.addContentType({
            typeName: typeName,
            route: route,
          })

        ContentType.on('add', node => {
          node[coverField] = this.fixPath(node[coverField])
        })
      }
    }
  }

  fixPath(imagePath) {
    let out = imagePath
    if (imagePath !== undefined) {
      if (/^\w/.test(imagePath) && !/:\/\//.test(imagePath))
        out = path.join(this.mediaFolder, imagePath)
      else if (imagePath.startsWith(this.publicFolder))
        out = path.join(
          this.mediaFolder,
          imagePath.substring(this.publicFolder.length),
        )
    }
    return out
  }
}

module.exports = NetlifyPaths
