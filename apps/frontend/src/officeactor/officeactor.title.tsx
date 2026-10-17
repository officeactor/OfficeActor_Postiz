// Shows "OfficeActor" instead of "Postiz" or "Gitroom" in the browser tab. The
// pages keep their upstream `metadata.title`; this inline script in <head>
// runs while the HTML is parsed, right after the <title>, and renames it again
// whenever a navigation sets a new one.
const titleScript = `(function () {
  var rename = function () {
    var title = document.title;
    var renamed = title.replace(/Postiz|Gitroom/g, 'OfficeActor');
    if (renamed !== title) document.title = renamed;
  };
  rename();
  new MutationObserver(rename).observe(document.head, {
    childList: true,
    subtree: true,
    characterData: true,
  });
})();`;

export const OfficeActorTitle = () => (
  <script
    id="officeactor-title"
    dangerouslySetInnerHTML={{ __html: titleScript }}
  />
);
