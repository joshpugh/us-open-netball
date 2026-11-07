# U.S. Open Netball standings – embed

## Recommended: script embed (no iframe)
Put a placeholder wherever each board should appear, and the script once per page.

```html
<div data-nl-ladder="ladies"></div>
<div data-nl-ladder="mixed"></div>
<script src="https://joshpugh.github.io/us-open-netball/embed.js" defer></script>
```

- Renders straight into your page, so it never has its own scrollbar on mobile.
- Adapts to the width of the column it sits in (not just the screen).
- Styles are sealed off, so your site's CSS can't break it and it can't break your site.
- Checks for new standings every minute.
- Add `data-title="false"` to a div to hide the navy header bar, e.g. if your page already has a heading.
- Brand colors: on your page, set `[data-nl-ladder]{--nl-brand:#0B1F4B;--nl-accent:#E4002B}` in CSS.

Demo: https://joshpugh.github.io/us-open-netball/demo.html

## Fallback: iframe
```html
<iframe src="https://joshpugh.github.io/us-open-netball/?d=ladies" style="width:100%;border:0;height:900px"></iframe>
```
