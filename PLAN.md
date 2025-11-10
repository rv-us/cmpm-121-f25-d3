# D3: Token Collection and Crafting Game

# Game Design Vision

A map-based game where players collect tokens from grid cells on an interactive map centered on their location. Players can pick up tokens from nearby cells and craft them by combining tokens of equal value to create tokens of double the value. The goal is to craft a token of sufficiently high value (e.g., 8 or 16) through strategic collection and crafting. Token spawning is deterministic using a hashing mechanism, ensuring consistent gameplay across sessions.

# Technologies

- TypeScript for most game code, little to no explicit HTML, and all CSS collected in common `style.css` file
- Deno and Vite for building
- Leaflet for interactive map rendering
- GitHub Actions + GitHub Pages for deployment automation

# Assignments

## D3.a: Core mechanics (token collection and crafting)

Key technical challenge: Can you assemble a map-based user interface using the Leaflet mapping framework?
Key gameplay challenge: Can players collect and craft tokens from nearby locations to finally make one of sufficiently high value?

### Steps

- [x] copy main.ts to reference.ts for future reference
- [x] delete everything in main.ts
- [x] put a basic leaflet map on the screen
- [ ] draw the player's location on the map
- [ ] draw a rectangle representing one cell on the map
- [ ] use loops to draw a whole grid of cells on the map
- [ ] implement deterministic token spawning using luck function for each cell
- [ ] display cell contents (token presence and value) visually without requiring clicks
- [ ] implement click handlers for cells
- [ ] implement distance calculation to determine which cells are interactable (about 3 cells away)
- [ ] create inventory system to hold at most one token
- [ ] display current inventory (token value) clearly on screen
- [ ] implement token pickup: remove token from cell when picked up
- [ ] implement crafting: place token on cell with equal value token to create double value token
- [ ] implement win condition detection (token of value 8 or 16 in inventory)
- [ ] ensure initial cell state is consistent across page loads
- [ ] test and refine user experience

## D3.b: (To be determined)

### Steps

- [ ] ...
