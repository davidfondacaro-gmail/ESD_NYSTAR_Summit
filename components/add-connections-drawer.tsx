"use client"

import { useRouter } from "next/navigation"
import { useState, type ChangeEvent, type FormEvent } from "react"
import { ChevronRight, Plus, X } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible"
import {
  Drawer,
  DrawerClose,
  DrawerContent,
  DrawerDescription,
  DrawerFooter,
  DrawerHeader,
  DrawerTitle,
  DrawerTrigger,
} from "@/components/ui/drawer"
import {
  Field,
  FieldContent,
  FieldDescription,
  FieldGroup,
  FieldLabel,
  FieldTitle,
} from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import {
  ToggleGroup,
  ToggleGroupItem,
} from "@/components/ui/toggle-group"
import type { NystarProgramGroup } from "@/lib/nystar-locations"

type GroupingMode = "type" | "region"

type ConnectionDetails = {
  organizationName: string
  addressLine1: string
  addressLine2: string
  city: string
  state: string
  postalCode: string
}

export default function AddConnectionsDrawer({
  categories,
  regions,
}: {
  categories: NystarProgramGroup[]
  regions: NystarProgramGroup[]
}) {
  const router = useRouter()
  const [drawerOpen, setDrawerOpen] = useState(false)
  const [step, setStep] = useState<1 | 2>(1)
  const [groupingMode, setGroupingMode] = useState<GroupingMode>("type")
  const [details, setDetails] = useState<ConnectionDetails>({
    organizationName: "",
    addressLine1: "",
    addressLine2: "",
    city: "",
    state: "NY",
    postalCode: "",
  })
  const [selectedPrograms, setSelectedPrograms] = useState<Set<string>>(
    () => new Set(),
  )
  const [openCategories, setOpenCategories] = useState<Set<string>>(
    () => new Set(),
  )
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [hasSubmitted, setHasSubmitted] = useState(false)
  const [formError, setFormError] = useState("")
  const [formMessage, setFormMessage] = useState("")

  function resetForm() {
    setStep(1)
    setGroupingMode("type")
    setDetails({
      organizationName: "",
      addressLine1: "",
      addressLine2: "",
      city: "",
      state: "NY",
      postalCode: "",
    })
    setSelectedPrograms(new Set())
    setOpenCategories(new Set())
    setIsSubmitting(false)
    setHasSubmitted(false)
    setFormError("")
    setFormMessage("")
  }

  function updateDetails(event: ChangeEvent<HTMLInputElement>) {
    const { name, value } = event.currentTarget
    setDetails((current) => ({ ...current, [name]: value }))
  }

  function continueToLocations(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setFormError("")
    setStep(2)
  }

  async function submitConnection() {
    setIsSubmitting(true)
    setFormError("")

    try {
      const response = await fetch("/api/customer-locations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...details,
          connectedAssetIds: [...selectedPrograms],
        }),
      })
      const result = (await response.json()) as { error?: string }

      if (!response.ok) {
        throw new Error(result.error ?? "Unable to save this connection.")
      }

      setHasSubmitted(true)
      setFormMessage(`${details.organizationName} was added to the network.`)
      router.refresh()
    } catch (error) {
      setFormError(
        error instanceof Error ? error.message : "Unable to save this connection.",
      )
    } finally {
      setIsSubmitting(false)
    }
  }

  function toggleProgram(programId: string, checked: boolean | "indeterminate") {
    setSelectedPrograms((current) => {
      const next = new Set(current)
      if (checked === true) {
        next.add(programId)
      } else {
        next.delete(programId)
      }
      return next
    })
  }

  function toggleCategory(categoryName: string, open: boolean) {
    setOpenCategories((current) => {
      const next = new Set(current)
      if (open) {
        next.add(categoryName)
      } else {
        next.delete(categoryName)
      }
      return next
    })
  }

  return (
    <Drawer
      open={drawerOpen}
      onOpenChange={(open) => {
        setDrawerOpen(open)
        if (!open) resetForm()
      }}
      swipeDirection="right"
    >
      <DrawerTrigger
        render={<Button variant="brand" size="lg" className="network-add-trigger w-full justify-between" />}
      >
        Add Your Connections
        <Plus aria-hidden="true" data-icon="inline-end" />
      </DrawerTrigger>
      <DrawerContent className="w-[min(30rem,92vw)]">
        <DrawerHeader className="relative px-6 pt-7 pb-5">
          <DrawerTitle className="text-lg">Add Your Connections</DrawerTitle>
          <DrawerDescription>
            {step === 1
              ? "Step 1 of 2 · Enter the organization and its address."
              : "Step 2 of 2 · Select one or more NYSTAR locations."}
          </DrawerDescription>
          <DrawerClose
            render={
              <Button
                variant="ghost"
                size="icon"
                className="absolute top-3 right-4"
                aria-label="Close drawer"
              />
            }
          >
            <X aria-hidden="true" />
          </DrawerClose>
        </DrawerHeader>
        <form className="flex min-h-0 flex-1 flex-col" onSubmit={continueToLocations}>
          <div className="min-h-0 flex-1 overflow-y-auto px-6 py-5">
            {step === 1 ? (
              <FieldGroup className="gap-4">
                <Field>
                  <FieldLabel htmlFor="organization-name">
                    Organization name
                  </FieldLabel>
                  <Input
                    id="organization-name"
                    name="organizationName"
                    autoComplete="organization"
                    value={details.organizationName}
                    onChange={updateDetails}
                    required
                  />
                </Field>
                <FieldGroup className="gap-4">
                  <Field>
                    <FieldLabel htmlFor="address-line-1">
                      Address line 1
                    </FieldLabel>
                    <Input
                      id="address-line-1"
                      name="addressLine1"
                      autoComplete="address-line1"
                      value={details.addressLine1}
                      onChange={updateDetails}
                      required
                    />
                  </Field>
                  <Field>
                    <FieldLabel htmlFor="address-line-2">
                      Address line 2 (optional)
                    </FieldLabel>
                    <Input
                      id="address-line-2"
                      name="addressLine2"
                      autoComplete="address-line2"
                      value={details.addressLine2}
                      onChange={updateDetails}
                    />
                  </Field>
                  <Field>
                    <FieldLabel htmlFor="city">City</FieldLabel>
                    <Input
                      id="city"
                      name="city"
                      autoComplete="address-level2"
                      value={details.city}
                      onChange={updateDetails}
                      required
                    />
                  </Field>
                  <FieldGroup className="grid grid-cols-[minmax(0,1fr)_minmax(0,2fr)] gap-4">
                    <Field>
                      <FieldLabel htmlFor="state">State</FieldLabel>
                      <Input
                        id="state"
                        name="state"
                        autoComplete="address-level1"
                        value={details.state}
                        maxLength={2}
                        disabled
                        required
                      />
                    </Field>
                    <Field>
                      <FieldLabel htmlFor="postal-code">ZIP code</FieldLabel>
                      <Input
                        id="postal-code"
                        name="postalCode"
                        autoComplete="postal-code"
                        inputMode="numeric"
                        value={details.postalCode}
                        onChange={updateDetails}
                      required
                      />
                    </Field>
                  </FieldGroup>
                </FieldGroup>
              </FieldGroup>
            ) : (
              <FieldGroup className="gap-3">
                <Field>
                  <FieldTitle id="nystar-grouping-label">Organize by</FieldTitle>
                  <ToggleGroup
                    aria-labelledby="nystar-grouping-label"
                    value={[groupingMode]}
                    onValueChange={(value) => {
                      const nextMode = value[0]
                      if (nextMode === "type" || nextMode === "region") {
                        setGroupingMode(nextMode)
                        setOpenCategories(new Set())
                      }
                    }}
                    variant="outline"
                    size="sm"
                    spacing={0}
                  >
                    <ToggleGroupItem value="type">Type</ToggleGroupItem>
                    <ToggleGroupItem value="region">Region</ToggleGroupItem>
                  </ToggleGroup>
                </Field>
                <p className="text-sm text-muted-foreground">
                  {selectedPrograms.size} selected
                </p>
                <ul className="flex flex-col gap-2">
                  {(groupingMode === "type" ? categories : regions).map((group) => {
                    const open = openCategories.has(group.name)
                    return (
                      <li key={`${groupingMode}-${group.name}`}>
                        <Collapsible
                          open={open}
                          onOpenChange={(nextOpen) =>
                            toggleCategory(group.name, nextOpen)
                          }
                          className="rounded-md border border-border"
                        >
                          <CollapsibleTrigger
                            render={
                              <Button
                                type="button"
                                variant="ghost"
                                className="h-auto min-h-8 w-full justify-start gap-2 px-3 py-3 text-left whitespace-normal"
                              />
                            }
                          >
                            <ChevronRight
                              aria-hidden="true"
                              className={`shrink-0 transition-transform ${open ? "rotate-90" : ""}`}
                              data-icon="inline-start"
                            />
                            <span>{group.name}</span>
                            <span className="ml-auto shrink-0 text-xs text-muted-foreground">
                              {group.programs.length}
                            </span>
                          </CollapsibleTrigger>
                          <CollapsibleContent className="border-t border-border px-3 py-2">
                            <FieldGroup className="gap-1">
                              {group.programs.map((program) => (
                                <Field
                                  key={program.id}
                                  orientation="horizontal"
                                  className="items-start gap-3 rounded-sm py-2"
                                >
                                  <Checkbox
                                    id={program.id}
                                    checked={selectedPrograms.has(program.id)}
                                    onCheckedChange={(checked) =>
                                      toggleProgram(program.id, checked)
                                    }
                                  />
                                  <FieldContent>
                                    <FieldLabel
                                      htmlFor={program.id}
                                      className="cursor-pointer text-sm"
                                    >
                                      {program.name}
                                    </FieldLabel>
                                    {program.details && (
                                      <FieldDescription className="text-xs">
                                        {groupingMode === "region"
                                          ? `${program.category} · ${program.details}`
                                          : program.details}
                                      </FieldDescription>
                                    )}
                                  </FieldContent>
                                </Field>
                              ))}
                            </FieldGroup>
                          </CollapsibleContent>
                        </Collapsible>
                      </li>
                    )
                  })}
                </ul>
              </FieldGroup>
            )}
          </div>
          {formError && (
            <p className="px-6 pt-3 text-sm text-destructive" role="alert">
              {formError}
            </p>
          )}
          {formMessage && (
            <p className="px-6 pt-3 text-sm text-foreground" role="status">
              {formMessage}
            </p>
          )}
          <DrawerFooter className="flex-row justify-end gap-3 border-t px-6 py-4 pt-4">
            <DrawerClose render={<Button type="button" variant="brand-outline" size="lg" className="min-w-24" />}>
              Cancel
            </DrawerClose>
            {step === 1 ? (
              <Button type="submit" variant="brand" size="lg" className="min-w-24">
                Next
              </Button>
            ) : (
              <>
                <Button
                  type="button"
                  variant="brand-outline"
                  size="lg"
                  className="min-w-24"
                  onClick={() => setStep(1)}
                  disabled={isSubmitting || hasSubmitted}
                >
                  Back
                </Button>
                <Button
                  type="button"
                  variant="brand"
                  size="lg"
                  className="min-w-24"
                  disabled={selectedPrograms.size === 0 || isSubmitting || hasSubmitted}
                  onClick={submitConnection}
                >
                  {isSubmitting ? "Saving…" : hasSubmitted ? "Added" : "Submit"}
                </Button>
              </>
            )}
          </DrawerFooter>
        </form>
      </DrawerContent>
    </Drawer>
  )
}