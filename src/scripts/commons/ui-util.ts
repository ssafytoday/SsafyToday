/**
 * Common UI utility functions
 * Functions used commonly across all platforms
 */

/**
 * Convert image tag relative URLs to absolute URLs
 *
 * @param element - Document or HTMLElement to process
 */
export function convertImageTagToAbsoluteURL(element: Document | HTMLElement = document): void {
  if (!element) return;

  // Find img tags and convert src attributes to absolute paths
  Array.from(element.getElementsByTagName("img")).forEach((img) => {
    if (img.currentSrc) {
      img.setAttribute("src", img.currentSrc);
    }
  });
}
