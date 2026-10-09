---
version: 1
slug: "src-ui-gallery-tsx"
primary_target: "src/ui/Gallery.tsx"
related_targets: ["src/ui/workshop.css","src/catalog/gallery.ts"]
---

# Gallery browsing

Scope: extend the published Gallery list; detail pages and model tools retain their behavior. Visitor mode: Experience.
Job: discover published builds across a growing collection, narrow by prompt and AI model, and compare responses to the same brief. Existing index data and published renders provide all content. Constraints: phone first, 44px controls, keyboard access, same approved cream workshop identity, no new service or runtime assets.

## Direction contract

THESIS: A browsable collection of prompts, each showing its matching model responses together.
OWN-WORLD: Inherit DESIGN.md's warm paper, navy ink, burnt-orange actions, Bricolage headings and pastel image stages. This is an extension of the existing gallery, not a new visual identity.
STORY: Start with all prompts; search or combine Prompt and AI model filters; inspect the matching groups; open a response and return to the same filtered collection.
FIRST VIEWPORT: A compact Gallery title leads into the collection. Desktop keeps search and two labeled native filters, with viewing angles and the result count in a single row. Phones show one search row with a Filters button; prompt, model, effort, sorting and viewing angles unfold together only on request. Active choices appear in a single truncated summary beside a clear action. The first prompt's named section and real model renders follow immediately. Prompt text is available through a native disclosure. No long tab rail.
FORM: Existing workshop gallery extended directly for the user's specified model/prompt browsing task; no new world or concept seed is required.
SIGNATURE INTERACTION: Combining filters keeps related builds together, updates the matching counts and supports a one-action reset. Progressive Show more prompts bounds the initial list. Choices, viewing angle and scroll survive detail and Play round trips.
FINISH: Verify filtering, recovery, navigation and six viewport sizes, then perform the finish review and document behavior without replacing the incumbent visual system.

Decision: the user confirmed browsing all prompts, then narrowing by model and prompt. The user also requested less phone space spent on filters; the default closed browsing controls stay below 90px tall. No unanswered product claims.
