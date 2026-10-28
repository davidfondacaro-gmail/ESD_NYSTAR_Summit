import assert from "node:assert/strict"
import test from "node:test"
import { nystarCoordinateOverride } from "../lib/nystar-coordinate-override.ts"

test("blank coordinates retain ZIP lookup fallback", () => {
  assert.equal(nystarCoordinateOverride({ ID: "test" }), null)
  assert.equal(nystarCoordinateOverride({ ID: "test", XLongitute: " ", YLatitude: "" }), null)
})

test("explicit coordinates take precedence, including zero", () => {
  assert.deepEqual(nystarCoordinateOverride({
    ID: "test", XLongitute: " -73.1 ", YLatitude: "40.9",
  }), { longitude: -73.1, latitude: 40.9 })
  assert.deepEqual(nystarCoordinateOverride({
    ID: "test", XLongitute: "0", YLatitude: "0",
  }), { longitude: 0, latitude: 0 })
})

test("invalid or incomplete coordinates identify the record", () => {
  for (const [XLongitute, YLatitude] of [
    ["-73", ""], ["", "41"], ["oops", "41"], ["Infinity", "41"],
    ["-181", "41"], ["181", "41"], ["-73", "91"], ["-73", "-91"],
  ]) {
    assert.throws(() => nystarCoordinateOverride({
      ID: "NYSTAR-test", XLongitute, YLatitude,
    }), /NYSTAR-test: provide both/)
  }
})
