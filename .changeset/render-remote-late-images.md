---
'@astryxdesign/cli': patch
---

[experimental] `astryx experimental render`: an https image the page shows only later (after a click, in the next view) is carried too, when the page's own code writes its address whole. That means an address whose path ends in an image extension, the value of a JSX `src`, `srcSet` or `poster`, or the value of a property or attribute one of whose words names an image (`avatarUrl`, `cover_image`; not `logoutUrl`). It is fetched with the same rules and limits as an image in the first paint, listed in `remoteImages`, and the file's script draws it from the carried data, so it shows offline. A link's address (`href`) is never fetched, even when it names an image file. An API address held by an image-named property (`imageUploadUrl`) is requested like an image; when the answer is not an image, the page keeps the address as written, with no warning, and `remoteImages.failed` lists it with why. No other address is fetched. An image address the code builds from parts gets a `remote-asset` warning that names it, its file and its line.

@josephfarina
