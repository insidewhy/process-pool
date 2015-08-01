var glob, pipeline, write, babel, mocha

module.exports = function(pipelines) {
  pipelines.js = [
    glob({ basePath: 'src' }, '**/*.js'),
    babel({ modules: 'common' }),
    write('lib')
  ]

  pipelines.test = [
    pipeline('js'),
    pipeline({ activate: true }, 'mocha')
  ]

  pipelines.explicit.mocha = [ mocha({ files: 'lib/test/**/*.spec.js' }) ]
}
