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

- [x] **Step 1: Set up map, grid cells, and player location visualization**
  - Create Leaflet map centered on classroom location
  - Draw player marker at fixed location
  - Create grid system with cells (0.0001 degrees per cell)
  - Render grid of cells covering visible map area
  - Set up UI elements (status panel, inventory display)

- [ ] **Step 2: Implement token spawning, display, and interaction system**
  - Use deterministic luck function to spawn tokens in cells
  - Display cell contents (token presence and value) visually without clicks
  - Implement click handlers for cells
  - Calculate distance to determine interactable cells (about 3 cells away)
  - Ensure consistent initial state across page loads

- [ ] **Step 3: Implement inventory, crafting, and win condition**
  - Create inventory system to hold at most one token
  - Display current inventory (token value) clearly on screen
  - Implement token pickup: remove token from cell when picked up
  - Implement crafting: place token on cell with equal value token to create double value token
  - Implement win condition detection (token of value 8 or 16 in inventory)
  - Test and refine user experience

## D3.b: (To be determined)

### Steps

- [ ] ...
