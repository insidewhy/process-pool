var glob, pipeline, write, babel, mocha

module.exports = function(pipelines) {
  var babelOpts = {
    presets: ['es2015', 'stage-2'],
    plugins: ['transform-es2015-modules-commonjs'],
  }

  pipelines.js = [
    glob({ basePath: 'src' }, '**/*.js'),
    babel(babelOpts),
    write('lib')
  ]

  pipelines.test = [
    pipeline('js'),
    pipeline({ activate: true }, 'mocha')
  ]

  pipelines.explicit.mocha = [ mocha({ files: 'lib/test/**/*.spec.js' }) ]
}
