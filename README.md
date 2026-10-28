# ESD_NYSTAR_Summit

App for NYSTAR Summit '26 - display NYSTAR network and add collaborators.

Built with Next.js and shadcn/ui.

## Program map coordinates

In `public/data/nystar-innovation-assets-map-base-layer-lgw.csv`, optional
`XLongitute` (longitude) and `YLatitude` (latitude) columns override the ZIP-code
location. Enter both as decimal degrees (for example, `-73.1` and `40.9`), or
leave both blank to use the ZIP-code lookup. Longitude must be between -180 and
180; latitude must be between -90 and 90. Incomplete or invalid pairs produce
an error identifying the record. Street addresses are not geocoded.

The spelling `XLongitute` is intentional. Markers at identical coordinates may
still be spread apart visually when clustering is off.

## Adding components

To add components to your app, run the following command:

```bash
npx shadcn@latest add button
```

This will place the ui components in the `components` directory.

## Using components

To use the components in your app, import them as follows:

```tsx
import { Button } from "@/components/ui/button"
```
