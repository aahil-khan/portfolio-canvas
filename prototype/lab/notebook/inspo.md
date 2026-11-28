# Round 6 inspiration: sharing, tags, the author card, the first screen

**Source note.** The Mobbin MCP was installed but signed out for the whole of this round, so
these come from my own knowledge of the apps, not from Mobbin screens. Re-check them against
Mobbin once it's signed in. Each entry gives the app, the screen, what to borrow and what to avoid.

## Sharing

1. **Medium: the article's clap/share row, top and bottom.** One share icon sits under the byline
   and again in the footer row after the last paragraph. On a phone it opens the native sheet.
   - Borrow: the same control in both places, small and next to the byline at the top, so the
     reader finds it again at the end without hunting.
   - Avoid: the sticky bottom action bar and the "member-only" interstitials. Anything fixed over
     the text competes with reading. The Lab has a rule: nothing is fixed at the bottom.

2. **Substack: the post's "Share" button and its end-of-post share box.** The end box says, in the
   writer's voice, "Share this post if you liked it", with copy link, X, Facebook and email.
   - Borrow: the end box as inline content (part of the page, not a popup), in the author's own
     voice, with a copy-link that says "Copied". This is the model for the nudge.
   - Avoid: the subscribe modal that opens at 50% scroll, and asking twice. The Lab asks once per
     note per visitor, and never over the text.

3. **Readwise Reader / Pocket: the share menu.** A short menu: copy link first, then a few
   targets, each one line with an icon. A link to a highlight carries the highlight's position.
   - Borrow: copy link first. It's what most people do with a link they want to send. A heading
     link carries its heading (`?a=`), as Reader's highlight links do.
   - Avoid: long target lists (WhatsApp, Telegram, Reddit, …). The native sheet already has those
     on a phone, so the fallback menu stays at four.

4. **Arc / Notion: "Copy link" feedback.** The button's own label flips to "Copied" for about a
   second, in place, with no toast stacking up.
   - Borrow: the feedback is in the button itself, plus the existing polite toast for screen readers.
   - Avoid: Notion's share panel, which is a permissions dialog. The Lab is public, so there is
     nothing to configure.

## Tags

5. **Substack / Ghost: tag chips under the title, and a tag page.** The chips are small and
   tappable, and the tag page is a plain list of posts with a count.
   - Borrow: chips right under the kicker, before the reading starts, plus a tag page that is
     a list grouped by section, with counts.
   - Avoid: tag clouds and dozens of tags. A tag that matches one note is noise, so the Lab keeps
     about 12, each with its own glyph.

6. **GitHub topics / Linear labels: a consistent swatch per label.** Every place a label appears,
   it has the same colour, so you recognise it before you read it.
   - Borrow: one glyph and one tone per tag, everywhere: chips, the tag page, the switcher's
     filter row and the map's filter row.
   - Avoid: free colour per label. Linear's custom colours fail contrast in dark mode. The Lab's
     tones are the theme's own text tokens, which already pass 4.5:1 in both themes.

## The author card and next read

7. **Medium: "Written by …" at the end.** Avatar, name, one line, follower count, Follow, then
   "More from the author" with two or three posts.
   - Borrow: name, one role line, and one human line, then the links and *one* next read. "Next
     up" plus "start from the beginning" answers "what now?" for someone who arrived cold.
   - Avoid: the follower count and the recommendation grid. A grid of six cards turns the end of
     a note into a feed.

8. **Substack: the about-the-writer footer.** One sentence of who they are, said plainly, plus a
   single "Subscribe" call to action.
   - Borrow: one call to action ("follow for the next one", which points at LinkedIn and X, where
     the posts are announced), said in his voice, not marketing copy.
   - Avoid: an email capture. The Lab has no newsletter, and a dead form is worse than none.

## The first screen of a link visitor

9. **Substack / Medium web post on a phone: the first screen.** The publication name sits at the
   top, then the title, a one-line subtitle, and the author's name and date, all before the
   first paragraph. You know whose writing it is without scrolling.
   - Borrow: a one-line byline above the kicker, "Aahil's Lab · notes on making agents behave",
     that links to start-here, then the kicker, the title and the TL;DR, all on the first
     390×664 screen.
   - Avoid: a hero banner or a cookie or app-install prompt above the title. In-app browsers
     (LinkedIn, X) are already short on height.

10. **Readwise Reader / Pocket: the breadcrumb and back.** In an in-app browser there is often no
    useful back button, so the path out has to be on the page.
    - Borrow: "‹ Shopkeeper" in the bar reads like a place, and the start-here link reads as
      "start here", not as "Lab".
    - Avoid: internal names like "00" or "hub" on the way up.
