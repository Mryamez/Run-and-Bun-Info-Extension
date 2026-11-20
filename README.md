# Run & Bun Dex Lookup (Chrome/Edge extension)

Highlight a move, ability or item name on any web page to see what it does under Gen 8 mechanics, with Pokémon Run & Bun changes shown in a yellow box.

## Install
1. Open `chrome://extensions` (or `edge://extensions`).
2. Turn on **Developer mode**.
3. Click **Load unpacked** and pick the `extension` folder.

## Use
- Highlight a name, then click the red **?** button that appears.
- Or right-click the highlighted text and choose **Run & Bun Dex: look up**, or press **Alt+Shift+L**.
- Click the toolbar icon to search by typing and to see the list of R&B mechanic changes.
- Esc or clicking elsewhere closes the popup. Drag it by the red bar.

## Data
- Gen 8 stats and text come from Pokémon Showdown's data (Gen 8 text is used where it differs from Gen 9).
- Run & Bun changes come from `Mechanic Changes.txt` (v1.07) in the Run & Bun Drive folder. They live in `build/rnb_changes.json`.
- To rebuild after editing that file, re-download the Showdown files and run:
  `py -I build/build_data.py <download folder> extension/data.js`
