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

- [x] **Step 2: Implement token spawning, display, and interaction system**
  - Use deterministic luck function to spawn tokens in cells
  - Display cell contents (token presence and value) visually without clicks
  - Implement click handlers for cells
  - Calculate distance to determine interactable cells (about 3 cells away)
  - Ensure consistent initial state across page loads

- [x] **Step 3: Implement inventory, crafting, and win condition**
  - Create inventory system to hold at most one token
  - Display current inventory (token value) clearly on screen
  - Implement token pickup: remove token from cell when picked up
  - Implement crafting: place token on cell with equal value token to create double value token
  - Implement win condition detection (token of value 8 or 16 in inventory)
  - Test and refine user experience

## D3.b: Globe-spanning Gameplay

Key technical challenge: Can you implement an earth-spanning coordinate system and dynamic cell spawning/despawning?
Key gameplay challenge: Can players explore the globe and farm tokens by moving in and out of cell visibility?

### Steps

- [x] **Step 1: Implement Null Island coordinate system and cell identifier type**
  - Create CellId interface/type for grid cells independent of screen representation
  - Implement functions to convert lat/lng to cell identifiers based on Null Island (0,0)
  - Implement functions to convert cell identifiers to lat/lng bounds
  - Update existing code to use new coordinate system

- [x] **Step 2: Add movement buttons and implement cell spawning/despawning**
  - Add UI buttons for north/south/east/west movement
  - Implement cell spawning/despawning based on visible map area
  - Make cells memoryless (reset state when despawned, allowing token farming)
  - Ensure cells are visible all the way to map edges

- [x] **Step 3: Implement map scrolling without moving character**
  - Allow map panning without moving player position
  - Handle Leaflet moveend event to detect map movement
  - Update interactable cells based on player position (not map view)
  - Keep player marker visible when scrolling

- [x] **Step 4: Update win condition and test farming mechanics**
  - Increase win condition threshold to higher token value
  - Test that cells reset when moving away and back (farming works)
  - Refine gameplay and user experience

## D3.c: Object persistence

Key technical challenge: Can you implement memory-efficient cell storage using Flyweight and Memento patterns?
Key gameplay challenge: Can cells remember their state when scrolled off-screen and restored when they return?

### Steps

- [x] **Step 1: Implement Flyweight pattern for cell storage**
  - Separate cell coordinates (CellId) from cell state (token value)
  - Use Map<CellId, tokenValue> to store only modified cells
  - Unmodified cells don't require memory storage
  - Cells not visible on map don't consume memory if unmodified

- [x] **Step 2: Implement Memento pattern for cell state persistence**
  - Serialize modified cell states when cells scroll off-screen
  - Deserialize and restore cell states when cells return to view
  - Preserve token values and other cell modifications
  - Ensure state persists across map movements (but not page loads yet)

- [ ] **Step 3: Update cell rendering to rebuild from stored state**
  - Rebuild cell display from scratch using stored Map data
  - Restore cell state when cells become visible again
  - Maintain visual consistency with persisted state
  - Test that modified cells remember their state when scrolling
