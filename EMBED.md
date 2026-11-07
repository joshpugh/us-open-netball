# U.S. Open Netball standings – embed

Hosted at https://joshpugh.github.io/us-open-netball/

## Both divisions, with Ladies / Mixed tabs
```html
<iframe class="nl-ladder" src="https://joshpugh.github.io/us-open-netball/?id=both" title="U.S. Open Netball Standings"
  style="width:100%;border:0;min-height:600px" scrolling="no" loading="lazy"></iframe>
```

## One division per embed
```html
<iframe class="nl-ladder" src="https://joshpugh.github.io/us-open-netball/?d=ladies&id=ladies" title="U.S. Open Netball – Ladies Standings"
  style="width:100%;border:0;min-height:600px" scrolling="no" loading="lazy"></iframe>

<iframe class="nl-ladder" src="https://joshpugh.github.io/us-open-netball/?d=mixed&id=mixed" title="U.S. Open Netball – Mixed Standings"
  style="width:100%;border:0;min-height:600px" scrolling="no" loading="lazy"></iframe>
```

## Auto-height (paste once per page, below the iframes)
Makes each iframe exactly as tall as the table on every screen size.
```html
<script>
window.addEventListener("message", function (e) {
  if (!e.data || e.data.type !== "nl-ladder-height") return;
  document.querySelectorAll("iframe.nl-ladder").forEach(function (f) {
    if (f.contentWindow === e.source) f.style.height = e.data.height + "px";
  });
});
</script>
```
