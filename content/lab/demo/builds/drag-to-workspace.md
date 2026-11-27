## Letting go at the edge sends the window; holding opens a picker

Drag a window to the left or right edge of the screen, and a small tab shows which [[t:gnome-workspace|workspace]] it will go to. Let go straight away and it goes to the next one, while you stay where you are. Keep holding and a column of every workspace on that side opens, with live previews: drop on the half nearest the edge to send the window there, or on the inner half to go with it.

Point at the thin line above the first card and a new workspace opens right next to this one, if you use [[t:dynamic-workspaces|dynamic workspaces]]. The window keeps its size and place, and stays maximised if it was. Change your mind, drag back from the edge or press Escape, and nothing moves.

## Only the top two thirds of each edge move windows, so tiling keeps working

GNOME already uses those edges: drag a window to the side and it [[t:edge-tiling|tiles to half the screen]]. A tool that takes over that gesture is one you uninstall in a day. So by default only the top two thirds of each side edge move windows, and the bottom third tiles as it always did. Which part of the edge, and how close the pointer has to get, are both settings.

The top edge and the edges between monitors need a longer hold, for the same reason: GNOME maximises and moves windows between screens there. Let go without choosing a workspace, and GNOME does what it normally would.

## The drag logic imports nothing from GNOME, so it tests under plain node

The decisions live in `lib/logic.js`, which has no GNOME imports, so `make test` runs them under node. The real drags run in `make e2e`: a throwaway headless [[t:gnome-shell|GNOME Shell]] with its own home and session bus, where a driver moves a virtual pointer over real windows, and any JavaScript error in the shell’s log fails the run.[^readme]

There’s no version check at runtime. Each range of GNOME versions from 46 to 51 gets its own zip, with only the code that range runs, and each zip is tested on real distro builds. It works on [[t:wayland|Wayland]] and X11, and with a finger on a touchscreen. Like [[holt|Holt]], it’s [[tag:open-source|open source]]: translations and bug reports go to the repository.
