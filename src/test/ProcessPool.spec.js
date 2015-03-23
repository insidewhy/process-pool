var ProcessPool = require ('../ProcessPool')

describe('process pool', () => {
  it('runs a single subprocess and returns the return value', () => {
    var pool = new ProcessPool
    var func = pool.prepare(() => (arg1, arg2) => arg1 * arg2 * 10)
    return func(2, 3).then(v => {
      v.should.equal(60)
    })
  })
})
