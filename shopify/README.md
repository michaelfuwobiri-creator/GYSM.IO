# Installing the Cadence&co section

Works with any Online Store 2.0 theme (Dawn, Sense, Craft, and others).

1. **Create the collections** in Shopify Admin → Products → Collections: *Jewellery*, *Perfumes*, *Homeopathy*. Add products and photos to each.
2. **Add the files to your theme.** Go to Online Store → Themes → ⋯ → Edit code. Then:
   - under `assets/`, add `cadence.css` and `cadence.js` from this repo's `assets/` folder;
   - under `sections/`, add `cadence-home.liquid`.

   With Shopify CLI, copy the same files into your theme folder and run `shopify theme dev` to preview, then `shopify theme push` to publish.
3. **Add the section to the homepage.** Go to Online Store → Themes → Customize → Home page → Add section → **Cadence&co homepage**.
4. **Pick the three collections** in the section settings, then set the speed and number of products per row.
5. Preview it, then **Publish**.

The "Add" buttons on the cards use Shopify's own product form, so they add the first available variant to the cart. The newsletter form saves sign-ups as customers tagged `newsletter`.
