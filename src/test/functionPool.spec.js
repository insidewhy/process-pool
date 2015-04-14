import _ from 'lodash'
import Promise from 'bluebird'
import functionPool from '../functionPool'

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
})
