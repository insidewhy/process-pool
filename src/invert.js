// Invert promise resolution/rejection
export default function(prom) {
  var empty = {}
  var err = empty
  return prom.catch(e => { err = e }).then(v => {
    if (err !== empty)
      return err
    throw Error(v)
  })
}
