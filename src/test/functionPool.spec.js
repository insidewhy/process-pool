import _ from 'lodash'
import Promise from 'bluebird'
import functionPool from '../functionPool'
import invert from '../invert'

describe('function pool', () => {
  it('should schedule a single function call', () => {
    var pool = functionPool([ arg => Promise.resolve(arg + 5) ])

    return pool(4).then(result => {
      result.should.equal(9)
    })
  })

  it('should schedule four calls over two functions', () => {
    var defs = _.range(0, 4).map(Promise.defer)
    var nCalls = 0
    var pool = functionPool(_.range(0, 2).map(() => () => defs[nCalls++].promise))
    var promises = _.range(0, 4).map(() => pool())

    return Promise.delay(10).then(() => {
      nCalls.should.equal(2)
      defs[1].fulfill()
      return promises[1]
    })
    .then(() => {
      nCalls.should.equal(3)
      defs[0].fulfill()
      return promises[0]
    })
    .then(() => {
      nCalls.should.equal(4)
      defs[2].fulfill()
      defs[3].fulfill()
      return Promise.all(promises.slice(2))
    })
  })

  it('should schedule four calls over two functions accounting for rejections', () => {
    var defs = _.range(0, 4).map(Promise.defer)
    var nCalls = 0
    var pool = functionPool(_.range(0, 2).map(() => () => defs[nCalls++].promise))
    var promises = _.range(0, 4).map(() => pool())

    return Promise.delay(10).then(() => {
      nCalls.should.equal(2)
      defs[1].reject()
      return invert(promises[1])
    })
    .then(() => {
      nCalls.should.equal(3)
      defs[0].reject()
      return invert(promises[0])
    })
    .then(() => {
      nCalls.should.equal(4)
      defs[2].fulfill()
      defs[3].fulfill()
      return Promise.all(promises.slice(2))
    })
  })

  it('should replace a free function with a replacement', () => {
    var pooled = _.range(0, 2).map(idx => () => Promise.resolve((idx + 1) * 10))
    var pool = functionPool(pooled)

    pool.replace(pooled[1], () => Promise.resolve(5))

    return Promise.all([ pool(), pool(), pool() ]).then(vals => {
      vals.should.eql([10, 5, 10])
    })
  })

  it('should replace a running function with a replacement', () => {
    var pooled = _.range(0, 2).map(idx => () => Promise.delay((idx + 1) * 10, 100))
    var pool = functionPool(pooled)

    var calls = [ pool(), pool(), pool(), pool() ]

    return Promise.delay(10).then(() => {
      pool.replace(pooled[1], () => Promise.resolve(5))
      return Promise.delay(10)
    })
    .then(() => {
      calls[0].isFulfilled().should.be.false
      calls[1].isFulfilled().should.be.false
      calls[2].isFulfilled().should.be.true
      calls[3].isFulfilled().should.be.true
      return Promise.all(calls)
    })
    .then(vals => {
      vals.should.eql([10, 20, 5, 5])
    })
  })

  var setDelayFunction = (data, instruction) => {
    var { set, delay } = instruction
    if (set) {
      var oldVal = data.field
      data.field = set
      return Promise.resolve(data.idx + oldVal)
    }
    else if (delay)
      return Promise.delay(data.idx + data.field, delay)
  }

  it('should call all free functions via `all`', () => {
    var pooled = _.range(0, 2).map(idx => {
      return setDelayFunction.bind(null, { idx, field: 0 })
    })
    var pool = functionPool(pooled)

    return Promise.all([
      pool.all({ set: 10 }),
      pool({ delay: 100 }),
      pool({ delay: 100 }),
    ])
    .then(results => {
      results.should.eql([ [ 0, 1 ], 10, 11 ])
      pool.running.should.have.length(0)
      pool.free.should.have.length(2)
    })
  })

  it('should call one free and one running function (when ready) via `all`', () => {
    var pooled = _.range(0, 2).map(idx => {
      return setDelayFunction.bind(null, { idx, field: 0 })
    })
    var pool = functionPool(pooled)

    return Promise.all([
      pool({ delay: 50 }),
      pool.all({ set: 10 }),
      pool({ delay: 100 }),
      pool({ delay: 100 }),
      pool({ delay: 100 }),
      pool({ delay: 100 }),
    ])
    .then(results => {
      results.should.eql([ 0, [1, 0], 10, 11, 10, 11 ])
      pool.running.should.have.length(0)
      pool.free.should.have.length(2)
    })
  })
})
