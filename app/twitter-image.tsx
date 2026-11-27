/*
 * Twitter's card image is the Open Graph card, byte for byte. Next links the two file conventions
 * separately (`og:image` and `twitter:image`), and X reads only its own tag, so without this file a
 * shared link there showed no image at all.
 */
export { default, alt, size, contentType } from './opengraph-image'
