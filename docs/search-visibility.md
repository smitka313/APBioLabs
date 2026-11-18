# Search visibility and deployment checks

The site remains a free static website with no runtime SEO service or paid tooling.
All public metadata and lab links are in the committed HTML, not injected by JavaScript.

## What is generated

- `tools/seo-content.json`: reviewed catalog copy and per-lab search descriptions.
- `tools/build-seo.py`: page titles, descriptions, canonical URLs, Open Graph and Twitter previews, JSON-LD, static homepage cards, `sitemap.xml`, `robots.txt`, and Cloudflare `_headers`.
- The sitemap lists the homepage, 13 labs, 13 printable guides, public teacher guide, quick start, and guide index (30 pages).
- Structured data describes real `WebSite`, `LearningResource`, `BreadcrumbList`, and directory `ItemList` entities. It makes no ratings, course accreditation, or rich-result guarantees.
- Protected answer keys and utility pages stay out of search through `noindex`. Robots allows crawlers to fetch those pages so they can read that directive; encryption protects the answers.

Run `python3 tools/build-seo.py` after editing search copy or the catalog. The student-directions generator runs it automatically after rebuilding guides. Run `python3 tools/build-seo.py --check` and `python3 tests/seo.test.py` before committing. Hosting has no new build step.

## After deployment

1. Open `https://biologylabbench.com/robots.txt` and `https://biologylabbench.com/sitemap.xml` and confirm they contain the generated files.
2. Check the homepage, one lab, and one guide: source HTML should contain one canonical URL and one description. `.html` requests should redirect to the matching extensionless URL, following Cloudflare Pages' default routing. All canonicals and share images point to `biologylabbench.com`, including copies served on the old GitHub host.
3. Check HTTP response headers for `/teacher-notes`, `/teacher-lab01`, `/teacher-dashboard`, and `/projector`: each should include `X-Robots-Tag: noindex, nosnippet`. The public homepage, labs, and `/teachers` must not receive this header. The existing HTML `noindex` tags remain a fallback on hosts without `_headers` support.
4. In [Google Search Console](https://search.google.com/search-console), verify the `biologylabbench.com` domain using Google's DNS TXT record in Cloudflare. Submit `https://biologylabbench.com/sitemap.xml`. Inspect the homepage and a few lab/guide URLs and request indexing. Verification requires the domain owner's account; do not fabricate a verification token or add someone else's token to the repository.
5. Add/import the same domain in [Bing Webmaster Tools](https://www.bing.com/webmasters/) and submit the sitemap. No subscription is required.
6. Review indexing, search queries, and mobile Core Web Vitals after real traffic accumulates. Track visits with the existing GoatCounter setup; student work must remain private. Fix any indexing exclusions or broken URLs reported by the search tools.

Canonical tags and sitemaps help consolidate the old and new addresses without forcing students away from saved work on the old domain. The migration/transfer behavior is unchanged. Search engines control indexing and rankings; these changes do not guarantee placement or instant indexing.

## References

- [Google Search Essentials](https://developers.google.com/search/docs/essentials)
- [Canonical URLs](https://developers.google.com/search/docs/crawling-indexing/consolidate-duplicate-urls)
- [Sitemaps](https://developers.google.com/search/docs/crawling-indexing/sitemaps/build-sitemap)
- [Keeping pages out of search](https://developers.google.com/search/docs/crawling-indexing/block-indexing)
- [Schema.org LearningResource](https://schema.org/LearningResource)
- [Cloudflare Pages routing](https://developers.cloudflare.com/pages/configuration/serving-pages/)
- [Cloudflare Pages headers](https://developers.cloudflare.com/pages/configuration/headers/)
