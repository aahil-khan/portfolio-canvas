/*
 * A project's Twitter card image is its Open Graph card. Without this file, `twitter:image` on a
 * project page fell back to the site-wide card in `app/twitter-image.tsx` while `og:image` named
 * the project's own, so X showed a different picture from every other site.
 */
export { default, alt, size, contentType, generateStaticParams } from './opengraph-image'
