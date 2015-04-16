// Invert promise resolution/rejection
export default function(prom) {
  return prom.then(v => { throw Error(v) }, v => v)
}
