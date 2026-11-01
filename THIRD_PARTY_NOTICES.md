# Third-party notices

Chess Reader is free software, licensed under the **GNU Affero General Public License, version 3 or (at your option) any later
version** (AGPL-3.0-or-later). The full text is in [LICENSE](LICENSE). Copyright © Chess Reader contributors.

Chess Reader is made from the reader of Cozy Shelves (same license) and ships components of other projects. Each keeps its own
license. Two of them are under the GPL: chessground (GPL-3.0-or-later) and Stockfish (GPL-3.0). Chess Reader as a whole is
distributed under the AGPL, as section 13 of the GPL-3.0 permits. Everything else listed here is under a license that is
compatible with it.

The texts of all licenses, with the copyright notices of each package, are collected in `THIRD_PARTY_LICENSES.txt`, which
`npm run build` writes into `dist/reader`. The desktop packages carry it next to the program (`npm run dist:win`, `dist:linux`, `dist:mac`), and the Android app carries it in its assets.

## Components of the program

| Component | Version | License | Used for | Source |
|---|---|---|---|---|
| Electron (with Chromium and Node.js) | 44.3.0 | MIT; Chromium's components: see `LICENSES.chromium.html` in the program folder | desktop runtime (Windows, Linux, macOS) | <https://github.com/electron/electron> |
| AndroidX webkit, activity, core (the Android app only, `android/`) | 1.12.1, 1.9.3, 1.15.0 | Apache-2.0 | the WebView shell of the Android app: asset loader, back dispatcher, window insets | <https://github.com/androidx/androidx> |
| Kotlin standard library, Android Gradle Plugin (the Android app only) | 2.1.0, 8.7.3 | Apache-2.0 | the language of the shell, the build | <https://github.com/JetBrains/kotlin>, <https://developer.android.com/build> |
| three.js | r186 (0.186.0) | MIT | the 3D chess board | <https://github.com/mrdoob/three.js> |
| foliate-js | vendored in `vendor-src/foliate-js` | MIT | reader for EPUB, MOBI, AZW3, FB2, CBZ | <https://github.com/johnfactotum/foliate-js> |
| PDF.js | 5.5.207 | Apache-2.0 | PDF pages | <https://github.com/mozilla/pdf.js> |
| Adobe CMaps, Foxit fonts, Liberation Sans (part of PDF.js) | | BSD-3-Clause, BSD-3-Clause, OFL-1.1 | PDF text encodings and standard fonts | <https://github.com/mozilla/pdf.js> |
| fflate, zip.js (part of foliate-js) | | MIT, BSD-3-Clause | compressed e-books | <https://github.com/101arrowz/fflate>, <https://github.com/gildas-lormeau/zip.js> |
| chessground | 9.2.1 | GPL-3.0-or-later | 2D chessboard | <https://github.com/lichess-org/chessground> |
| cburnett chess pieces (part of chessground) | | GPL-2.0-or-later, by Colin M.L. Burnett | chess pieces | <https://github.com/lichess-org/lila/blob/master/COPYING.md> |
| chess.js | 1.4.0 | BSD-2-Clause | chess rules | <https://github.com/jhlywa/chess.js> |
| Stockfish 18 (stockfish.js) | 18.0.8 | GPL-3.0 | chess engine | <https://github.com/nmrugg/stockfish.js>, <https://stockfishchess.org> |
| hyphen with TeX hyphenation patterns (hyph-utf8: German 1996, English US) | 1.14.1 | ISC; patterns under their own free licenses | hyphenation in the reading browser and in the text view of PDFs | <https://github.com/ytiurin/hyphen>, <https://ctan.org/pkg/hyph-utf8> |
| @mozilla/readability | 0.6.0 | Apache-2.0 | full articles, reading mode | <https://github.com/mozilla/readability> |
| EB Garamond, Cormorant Garamond, Caveat, VT323, Playfair Display (Fontsource) | 5.3.0 | OFL-1.1 | typography | <https://fontsource.org> |
| Literata (TypeTogether for Google), Source Serif 4 (Adobe), Atkinson Hyperlegible Next (Braille Institute) | Fontsource 5.3.0, kept in `app/data/fonts` with their `OFL.txt` | OFL-1.1 | reading fonts of the reader | <https://github.com/googlefonts/literata>, <https://github.com/adobe-fonts/source-serif>, <https://github.com/googlefonts/atkinson-hyperlegible-next> |
| Chess diagram recognition network (`app/src/ui/chess/diagram/net-weights.js`, 102 KB, int8) | | AGPL-3.0-or-later, like Cozy Shelves (own work) | recognises the pieces in chess diagrams; trained with `build/chess-net` on generated diagrams drawn with the cburnett pieces, DejaVu Sans, the chess symbols of the Windows fonts and invented piece sets; contains no font data | this repository |

The program contacts the internet only when a link inside a book is opened: the page is fetched to be shown in reading mode, or opened in the browser of the system.
