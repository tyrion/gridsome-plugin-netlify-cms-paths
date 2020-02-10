const fs = require('fs')
const path = require('path')
const yaml = require('js-yaml')
const RemarkTransformer = require('@gridsome/transformer-remark')

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
      coverField: undefined,
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

        // Patch remark transformer to fix image paths in markdown bodies
        for (const mimeType of RemarkTransformer.mimeTypes()) {
          const transformer = ContentType._transformers[mimeType]
          if (transformer instanceof RemarkTransformer) {
            console.info(
              `Patching RemarkTransformer for ${typeName} (${mimeType})`,
            )
            const _resolve = transformer.resolveNodeFilePath.bind(transformer)
            transformer.resolveNodeFilePath = (node, toPath) =>
              _resolve(node, this.fixPath(toPath))
          }
        }

        // Fix cover images
        if (coverField !== undefined) {
          console.info(`Fixing cover images for ${typeName}.${coverField}`)
          ContentType.on('add', node => {
            node[coverField] = this.fixPath(node[coverField])
          })
        }
      }
    }
  }

  fixPath(imagePath) {
    let out = imagePath
    if (imagePath !== undefined) {
      if (/^\w/.test(imagePath) && !/^[a-z][a-z0-9+.-]*:/i.test(imagePath))
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
