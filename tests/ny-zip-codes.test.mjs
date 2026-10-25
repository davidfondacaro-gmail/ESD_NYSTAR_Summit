import assert from "node:assert/strict"
import test from "node:test"

import { postalCodeError } from "../lib/ny-zip-codes.ts"

test("accepts New York ZIP codes", () => {
  for (const zip of ["12207", "10001", "14604", " 11201 ", "06390"]) {
    assert.equal(postalCodeError(zip), "", zip)
  }
})

test("rejects ZIP codes outside New York", () => {
  for (const zip of ["06830", "07030", "90210", "15001"]) {
    assert.equal(postalCodeError(zip), "Enter a New York ZIP code.", zip)
  }
})

test("rejects malformed ZIP codes and ignores empty input", () => {
  assert.equal(postalCodeError("1220"), "Enter a five-digit ZIP code.")
  assert.equal(postalCodeError("1220a"), "Enter a five-digit ZIP code.")
  assert.equal(postalCodeError(""), "")
})
