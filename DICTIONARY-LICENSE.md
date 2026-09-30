# JMdict data attribution

The generated `public/catalog.json` contains material derived from the **JMdict** dictionary files by the Electronic Dictionary Research and Development Group (EDRDG). The derived vocabulary data is available under [Creative Commons Attribution-ShareAlike 4.0](https://creativecommons.org/licenses/by-sa/4.0/). The original data and license are available at [EDRDG](https://www.edrdg.org/wiki/JMdict-EDICT_Dictionary_Project.html) and the [EDRDG license statement](https://www.edrdg.org/edrdg/licence.html).

Changes made here: readings were restricted to exactly four hiragana characters; homographic readings were grouped; one representative written form and one English gloss were chosen; entries were sorted. No content category or offensiveness filter was applied. The generated file's metadata records its source date and entry count.

The 11 hand-checked Kōjien examples in `src/data.ts` are separate editorial additions. The app does not claim that every JMdict entry is in Kōjien. Kōjien dictionary text is not included.

EDRDG requires a regular update procedure. Run `npm run update:dictionary` monthly, inspect the generated diff, publish the site, and update the Supabase catalog from the same snapshot. Keep attribution and this license with any redistributed catalog.
