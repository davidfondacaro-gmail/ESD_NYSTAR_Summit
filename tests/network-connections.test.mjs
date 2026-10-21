import assert from "node:assert/strict"
import test from "node:test"
import {
  connectedOrganizationsForPopup,
  connectionKey,
  connectionsForPopup,
  tourInsetData,
} from "../lib/network-connections.ts"

const asset = (id) => ({ id, name: id, category: "Test" })
const customer = (id, connections) => ({
  id,
  name: id,
  connections: connections.map(([assetId, connectionType]) => ({
    assetId,
    connectionType,
  })),
})
const locations = [
  {
    latitude: 42,
    longitude: -75,
    assets: [asset("a"), asset("unrelated")],
    customers: [
      customer("local", [
        ["a", "Existing"],
        ["b", "Desired"],
      ]),
    ],
  },
  {
    latitude: 44,
    longitude: -73,
    assets: [asset("b")],
    customers: [
      customer("remote", [
        ["a", "Desired"],
        ["a", "Desired"],
      ]),
    ],
  },
  { latitude: 43, longitude: -77, assets: [asset("isolated")], customers: [] },
]
const programConnections = [
  { assetId1: "a", assetId2: "b", connectionType: "Existing" },
  { assetId1: "b", assetId2: "a", connectionType: "Existing" },
  { assetId1: "b", assetId2: "a", connectionType: "Desired" },
  { assetId1: "a", assetId2: "unmapped", connectionType: "Existing" },
  { assetId1: "b", assetId2: "unrelated", connectionType: "Existing" },
]

test("inset contains only direct mapped endpoints, including remote partners and programs", () => {
  const data = tourInsetData("a", programConnections, locations)
  assert.deepEqual(
    data.locations.flatMap((l) => l.assets.map((a) => a.id)),
    ["a", "b"]
  )
  assert.deepEqual(
    data.locations.flatMap((l) => l.customers.map((c) => c.id)),
    ["local", "remote"]
  )
  assert.equal(data.connections.length, 4)
  assert.deepEqual(data.connections.map(connectionKey).sort(), [
    "asset:a>asset:b:Desired",
    "asset:a>asset:b:Existing",
    "asset:a>partner:local:Existing",
    "asset:a>partner:remote:Desired",
  ])
  assert.deepEqual(
    data.locations.map((l) => [l.latitude, l.longitude]),
    [
      [42, -75],
      [44, -73],
    ]
  )
  assert.equal(locations[0].assets.length, 2)
})

test("inset preserves a singleton asset without inventing connections", () => {
  const data = tourInsetData("isolated", programConnections, locations)
  assert.equal(data.connections.length, 0)
  assert.deepEqual(
    data.locations.flatMap((l) => l.assets.map((a) => a.id)),
    ["isolated"]
  )
  assert.deepEqual(tourInsetData("missing", [], locations).locations, [])
})

test("shared collector preserves normal program and partner popup connection scopes", () => {
  const partnerConnections = connectionsForPopup(
    new Set(),
    new Set(["local"]),
    programConnections,
    locations
  )
  assert.equal(partnerConnections.length, 2)
  assert.ok(
    partnerConnections.every((c) => c.to.id === "local" && c.animateFromTarget)
  )
  assert.deepEqual(
    connectionsForPopup(new Set(), new Set(), programConnections, locations),
    []
  )
  const program = connectionsForPopup(
    new Set(["a"]),
    new Set(),
    programConnections,
    locations
  )
  assert.ok(program.every((c) => c.fromAssetId === "a"))
})

test("program popup lists unique direct organizations with only name and symbol data", () => {
  assert.deepEqual(
    connectedOrganizationsForPopup(
      { kind: "asset", id: "a" },
      programConnections,
      locations
    ),
    [
      { id: "b", kind: "asset", name: "b", category: "Test" },
      { id: "local", kind: "partner", name: "local" },
      { id: "remote", kind: "partner", name: "remote" },
    ]
  )
})

test("partner popup lists only its connected programs with category symbols", () => {
  assert.deepEqual(
    connectedOrganizationsForPopup(
      { kind: "partner", id: "local" },
      programConnections,
      locations
    ),
    [
      { id: "a", kind: "asset", name: "a", category: "Test" },
      { id: "b", kind: "asset", name: "b", category: "Test" },
    ]
  )
  assert.equal(
    connectedOrganizationsForPopup(
      { kind: "partner", id: "remote" },
      programConnections,
      locations
    ).length,
    1
  )
  assert.deepEqual(
    connectedOrganizationsForPopup(
      { kind: "asset", id: "isolated" },
      programConnections,
      locations
    ),
    []
  )
})
