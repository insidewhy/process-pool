import Promise from 'bluebird'
import ProcessPool from '../ProcessPool'
import invert from '../invert'
import {ChildProcess} from "child_process";

describe('process pool', () => {
  var pool
  beforeEach(() => pool = new ProcessPool({ processLimit: 2 }))
  afterEach(() => pool.destroy())

  it('should create a sub-process that can accept arguments and return a value', () => {
    var func = pool.prepare(() => (arg1, arg2) => arg1 * arg2 * 10)
    return func(2, 3).then(v => {
      func.running.length.should.equal(0)
      v.should.equal(60)
    })
  })

  it(
    'ready() call should return promise that resolves when all subprocesses are ready',
    () => {
      var func = pool.prepare(() => () => {})
      return pool.ready()
    }
  )

  it(
    'should create a sub-process that can accept arguments and return a value from a Promise',
    () => {
      var func = pool.prepare(() => {
        var Promise = require('bluebird')
        return (arg1, arg2) => Promise.resolve(arg1 * arg2 * 10)
      })
      return func(2, 3).then(v => {
        v.should.equal(60)
      })
    }
  )

  it('should catch a thrown exception in a sub-process and fail the promise', done => {
    var func = pool.prepare(() => (arg1, arg2) => { throw Error('ohno') })
    return invert(func(2, 3)).then(err => {
      err.message.should.equal('ohno')
      done()
    })
  })

  it('should pass context to prepare call', () => {
    var func = pool.prepare(ctxt => {
      var Promise = require('bluebird')
      return (arg1, arg2) => Promise.resolve(arg1 + arg2 + ctxt)
    }, 10)
    return func(2, 3).then(v => {
      v.should.equal(15)
    })
  })

  it('should require node modules using the parent process module.paths', () => {
    module.paths.push(__dirname + '/node_modules.test')

    var func = pool.prepare(ctxt => {
      var friender = require('friender')
      // would throw without module.filename being set via module
      require('./node_modules.test/friender/index.js')

      return () => friender.friend || 'unknown'
    })
    // TODO: use indirect require to test this instead of previous line
    // }, null, { module })

    return func().then(v => {
      v.should.equal('treebear')
    })
  })

  it('should schedule three calls across two processes', () => {
    var subprocFunc = pool.prepare(() => {
      var Promise = require('bluebird')
      return () => Promise.delay(Date.now(), 100)
    })

    return pool.ready().then(() => {
      return Promise.all([ subprocFunc(), subprocFunc(), subprocFunc() ])
    })
    .then(vals => {
      vals.length.should.equal(3)
      Math.abs(vals[0] - vals[1]).should.be.below(50)
      var longDiff = (vals[2] - vals[1])
      longDiff .should.be.above(99)
    })
  })

  it('should kill active process when requested', () => {
    var subprocFunc = pool.prepare(() => {
      var Promise = require('bluebird')
      return () => Promise.delay(Date.now(), 100)
    })
    var func = pool.preparedFuncs[0]

    return pool.ready().then(() => {
      func.pool.free.length.should.equal(2)
      func.pool.running.length.should.equal(0)

      var callPromise = subprocFunc()

      return Promise.delay(10).then(() => {
        func.pool.free.length.should.equal(1)
        func.pool.running.length.should.equal(1)
        var killed = subprocFunc.kill()
        killed.length.should.equal(1)
        return invert(callPromise)
      })
    })
    .then(err => {
      err.message.should.equal('killed')
      func.subProcesses.length.should.equal(2)
      func.pool.free.length.should.equal(2)
      func.pool.running.length.should.equal(0)

      // wait for replace function to ready...
      return pool.ready()
    })
    .then(() => {
      return Promise.all([ subprocFunc(), subprocFunc() ])
    })
    .then(vals => {
      vals.length.should.equal(2)
      Math.abs(vals[0] - vals[1]).should.be.below(50)
    })
  })

  it('should call onChildProcessSpawned callback on child process ready', () => {
    function worker() {}
    var calledCount = 0;
    var childProcesses = []
    function onChildProcessSpawned(childProcess) {
      childProcesses.push(childProcess)
    }
    pool.prepare(worker, null, {processLimit: 4, onChildProcessSpawned});
    return pool.ready().then(() => {
      childProcesses.length.should.be.equal(4);
    })
  })
})
