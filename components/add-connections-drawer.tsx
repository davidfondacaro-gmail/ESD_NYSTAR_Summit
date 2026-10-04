"use client"

import { Plus, X } from "lucide-react"

import { Button } from "@/components/ui/button"
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
import { Field, FieldGroup, FieldLabel, FieldSet, FieldLegend } from "@/components/ui/field"
import { Input } from "@/components/ui/input"

export default function AddConnectionsDrawer() {
  return (
    <Drawer swipeDirection="right">
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
            Enter an organization and its address to add a connection.
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
        <form
          className="flex min-h-0 flex-1 flex-col"
          onSubmit={(event) => event.preventDefault()}
        >
          <div className="min-h-0 flex-1 overflow-y-auto px-6 py-5">
            <FieldGroup className="gap-4">
              <Field>
                <FieldLabel htmlFor="organization-name">
                  Organization name
                </FieldLabel>
                <Input
                  id="organization-name"
                  name="organizationName"
                  autoComplete="organization"
                  placeholder="Organization name"
                  required
                />
              </Field>
              <FieldSet className="gap-3">
                <FieldLegend variant="label">Address</FieldLegend>
                <FieldGroup className="gap-4">
                <Field>
                  <FieldLabel htmlFor="address-line-1">Address line 1</FieldLabel>
                  <Input
                    id="address-line-1"
                    name="addressLine1"
                    autoComplete="address-line1"
                    placeholder="Street address"
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
                    placeholder="Suite, unit, floor"
                  />
                </Field>
                <Field>
                  <FieldLabel htmlFor="city">City</FieldLabel>
                  <Input
                    id="city"
                    name="city"
                    autoComplete="address-level2"
                    placeholder="City"
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
                      placeholder="NY"
                      maxLength={2}
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
                      placeholder="ZIP code"
                      required
                    />
                  </Field>
                </FieldGroup>
                </FieldGroup>
              </FieldSet>
            </FieldGroup>
          </div>
          <DrawerFooter className="flex-row justify-end gap-3 border-t px-6 py-4 pt-4">
            <DrawerClose
              render={
                <Button
                  type="button"
                  variant="brand-outline"
                  size="lg"
                  className="min-w-24"
                />
              }
            >
              Cancel
            </DrawerClose>
            <Button type="submit" variant="brand" size="lg" className="min-w-24">
              Submit
            </Button>
          </DrawerFooter>
        </form>
      </DrawerContent>
    </Drawer>
  )
}