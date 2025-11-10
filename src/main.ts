// @deno-types="npm:@types/leaflet"
import leaflet from "leaflet";

// Style sheets
import "leaflet/dist/leaflet.css";
import "./style.css";

// Fix missing marker images
import "./_leafletWorkaround.ts";

// Import our luck function
import luck from "./_luck.ts";

// Classroom location (fixed player position)
const CLASSROOM_LATLNG = leaflet.latLng(
  36.997936938057016,
  -122.05703507501151,
);

// Game parameters
const GAMEPLAY_ZOOM_LEVEL = 19;
const CELL_SIZE = 0.0001; // degrees per cell (about the size of a house)
const INTERACTION_DISTANCE = 3; // cells away player can interact
const TOKEN_SPAWN_PROBABILITY = 0.1; // probability of token spawning in a cell

// Create UI elements
const statusPanelDiv = document.createElement("div");
statusPanelDiv.id = "statusPanel";
document.body.append(statusPanelDiv);

const inventoryPanelDiv = document.createElement("div");
inventoryPanelDiv.id = "inventoryPanel";
document.body.append(inventoryPanelDiv);

const mapDiv = document.createElement("div");
mapDiv.id = "map";
document.body.append(mapDiv);

// Create the map
const map = leaflet.map(mapDiv, {
  center: CLASSROOM_LATLNG,
  zoom: GAMEPLAY_ZOOM_LEVEL,
  minZoom: GAMEPLAY_ZOOM_LEVEL,
  maxZoom: GAMEPLAY_ZOOM_LEVEL,
  zoomControl: false,
  scrollWheelZoom: false,
});

// Add background tile layer
leaflet
  .tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
    maxZoom: 19,
    attribution:
      '&copy; <a href="http://www.openstreetmap.org/copyright">OpenStreetMap</a>',
  })
  .addTo(map);

// Add player marker
const playerMarker = leaflet.marker(CLASSROOM_LATLNG);
playerMarker.bindTooltip("That's you!");
playerMarker.addTo(map);

// Calculate visible bounds to determine grid size
// We'll create a large grid that covers the visible area
const VISIBLE_GRID_SIZE = 50; // cells in each direction from center

// Cell data structure to track cell state
interface Cell {
  i: number;
  j: number;
  rectangle: leaflet.Rectangle;
  tokenValue: number | null;
  marker: leaflet.Marker | null; // Visual marker for token
}

// Store all cells
const cells = new Map<string, Cell>();

// Player position (starts at cell 0, 0)
let playerCellI = 0;
let playerCellJ = 0;

// Inventory system - player can hold at most one token
let playerInventory: number | null = null;

// Win condition values
const WIN_TOKEN_VALUES = [8, 16];

// Convert cell coordinates (i, j) to lat/lng bounds
function cellToBounds(i: number, j: number): leaflet.LatLngBounds {
  return leaflet.latLngBounds([
    [
      CLASSROOM_LATLNG.lat + i * CELL_SIZE,
      CLASSROOM_LATLNG.lng + j * CELL_SIZE,
    ],
    [
      CLASSROOM_LATLNG.lat + (i + 1) * CELL_SIZE,
      CLASSROOM_LATLNG.lng + (j + 1) * CELL_SIZE,
    ],
  ]);
}

// Get center point of a cell
function cellToCenter(i: number, j: number): leaflet.LatLng {
  return leaflet.latLng(
    CLASSROOM_LATLNG.lat + (i + 0.5) * CELL_SIZE,
    CLASSROOM_LATLNG.lng + (j + 0.5) * CELL_SIZE,
  );
}

// Calculate distance between two cells (Manhattan distance)
function cellDistance(i1: number, j1: number, i2: number, j2: number): number {
  return Math.abs(i1 - i2) + Math.abs(j1 - j2);
}

// Check if a cell is within interaction distance
function isInteractable(i: number, j: number): boolean {
  return cellDistance(i, j, playerCellI, playerCellJ) <=
    INTERACTION_DISTANCE;
}

// Spawn token in a cell using deterministic luck function
function spawnTokenInCell(cell: Cell): void {
  // Use deterministic luck to determine if token spawns
  const spawnKey = `${cell.i},${cell.j}`;
  const luckValue = luck(spawnKey);
  if (luckValue < TOKEN_SPAWN_PROBABILITY) {
    // Determine token value using deterministic luck
    const valueKey = `${cell.i},${cell.j},initialValue`;
    const tokenValue = Math.floor(luck(valueKey) * 8) + 1; // Values 1-8
    cell.tokenValue = tokenValue;
    updateCellVisual(cell);
  }
}

// Update cell visual appearance based on state
function updateCellVisual(cell: Cell): void {
  const isInteract = isInteractable(cell.i, cell.j);
  const hasToken = cell.tokenValue !== null;

  // Update rectangle style based on interactability
  if (isInteract) {
    cell.rectangle.setStyle({
      color: "#ff3388",
      weight: 2,
      fillOpacity: 0.2,
    });
  } else {
    cell.rectangle.setStyle({
      color: "#3388ff",
      weight: 1,
      fillOpacity: 0.1,
    });
  }

  // Update token marker
  if (hasToken && cell.tokenValue !== null) {
    if (cell.marker === null) {
      const center = cellToCenter(cell.i, cell.j);
      const icon = leaflet.divIcon({
        className: "token-marker",
        html:
          `<div style="background-color: gold; border: 3px solid black; border-radius: 50%; width: 30px; height: 30px; display: flex; align-items: center; justify-content: center; font-weight: bold; font-size: 14px; color: black; box-shadow: 0 2px 4px rgba(0,0,0,0.3); cursor: pointer;">${cell.tokenValue}</div>`,
        iconSize: [30, 30],
        iconAnchor: [15, 15],
      });
      cell.marker = leaflet.marker(center, { icon });
      cell.marker.addTo(map);
      // Make token marker clickable
      cell.marker.on("click", () => {
        handleTokenClick(cell);
      });
    } else {
      // Update existing marker
      const icon = leaflet.divIcon({
        className: "token-marker",
        html:
          `<div style="background-color: gold; border: 3px solid black; border-radius: 50%; width: 30px; height: 30px; display: flex; align-items: center; justify-content: center; font-weight: bold; font-size: 14px; color: black; box-shadow: 0 2px 4px rgba(0,0,0,0.3); cursor: pointer;">${cell.tokenValue}</div>`,
        iconSize: [30, 30],
        iconAnchor: [15, 15],
      });
      cell.marker.setIcon(icon);
    }
  } else {
    // Remove marker if no token
    if (cell.marker !== null) {
      cell.marker.removeFrom(map);
      cell.marker = null;
    }
  }
}

// Create a cell at grid position (i, j)
function createCell(i: number, j: number): Cell {
  const bounds = cellToBounds(i, j);
  const rectangle = leaflet.rectangle(bounds, {
    color: "#3388ff",
    weight: 1,
    fillOpacity: 0.1,
  });
  rectangle.addTo(map);

  const cell: Cell = {
    i,
    j,
    rectangle,
    tokenValue: null,
    marker: null,
  };

  // Spawn token using deterministic luck
  spawnTokenInCell(cell);

  // Add click handler
  rectangle.on("click", () => {
    handleCellClick(cell);
  });

  // Update visual appearance
  updateCellVisual(cell);

  return cell;
}

// Update inventory display
function updateInventoryDisplay(): void {
  if (playerInventory !== null) {
    inventoryPanelDiv.innerHTML = `Inventory: Token value ${playerInventory}`;
    // Check win condition
    if (WIN_TOKEN_VALUES.includes(playerInventory)) {
      inventoryPanelDiv.innerHTML +=
        ` 🎉 WIN! You have a token of value ${playerInventory}!`;
      statusPanelDiv.innerHTML = "Congratulations! You've won the game!";
    }
  } else {
    inventoryPanelDiv.innerHTML = "Inventory: Empty";
  }
}

// Handle token marker click
function handleTokenClick(cell: Cell): void {
  handleCellInteraction(cell);
}

// Handle cell click
function handleCellClick(cell: Cell): void {
  handleCellInteraction(cell);
}

// Common handler for cell/token interactions
function handleCellInteraction(cell: Cell): void {
  if (!isInteractable(cell.i, cell.j)) {
    statusPanelDiv.innerHTML =
      "Too far away! You can only interact with nearby cells.";
    return;
  }

  // If player has a token and cell has a token, try crafting
  if (playerInventory !== null && cell.tokenValue !== null) {
    if (playerInventory === cell.tokenValue) {
      // Craft: combine two tokens of equal value to create double value
      const newValue = playerInventory * 2;
      cell.tokenValue = newValue;
      playerInventory = null; // Remove token from inventory
      updateCellVisual(cell);
      updateInventoryDisplay();
      statusPanelDiv.innerHTML =
        `Crafted! Created token with value ${newValue} in cell (${cell.i}, ${cell.j}).`;
    } else {
      statusPanelDiv.innerHTML =
        `Cannot craft! Cell has token value ${cell.tokenValue}, but you have ${playerInventory}. Tokens must match to craft.`;
    }
    return;
  }

  // If player has no token and cell has a token, pick it up
  if (playerInventory === null && cell.tokenValue !== null) {
    playerInventory = cell.tokenValue;
    cell.tokenValue = null; // Remove token from cell
    updateCellVisual(cell);
    updateInventoryDisplay();
    statusPanelDiv.innerHTML =
      `Picked up token with value ${playerInventory} from cell (${cell.i}, ${cell.j}).`;
    return;
  }

  // If both are empty
  if (playerInventory === null && cell.tokenValue === null) {
    statusPanelDiv.innerHTML = `Cell (${cell.i}, ${cell.j}) is empty.`;
  }
}

// Create grid of cells covering visible area
let tokenCount = 0;
for (let i = -VISIBLE_GRID_SIZE; i < VISIBLE_GRID_SIZE; i++) {
  for (let j = -VISIBLE_GRID_SIZE; j < VISIBLE_GRID_SIZE; j++) {
    const cellKey = `${i},${j}`;
    const cell = createCell(i, j);
    cells.set(cellKey, cell);
    if (cell.tokenValue !== null) {
      tokenCount++;
    }
  }
}

// Move player to a new cell position
function movePlayer(newI: number, newJ: number): void {
  playerCellI = newI;
  playerCellJ = newJ;

  // Update player marker position
  const newPosition = cellToCenter(playerCellI, playerCellJ);
  playerMarker.setLatLng(newPosition);

  // Update map center to follow player with smooth panning
  map.panTo(newPosition, { animate: true, duration: 0.3 });

  // Update all cell visuals to reflect new interactable cells
  for (const cell of cells.values()) {
    updateCellVisual(cell);
  }

  statusPanelDiv.innerHTML =
    `Moved to cell (${playerCellI}, ${playerCellJ}). Use Arrow Keys or WASD to move.`;
}

// Handle keyboard input for player movement
document.addEventListener("keydown", (event) => {
  let newI = playerCellI;
  let newJ = playerCellJ;
  let moved = false;

  // Arrow keys or WASD
  // i affects latitude (north-south): increasing i moves north
  // j affects longitude (east-west): increasing j moves east
  if (
    event.key === "ArrowUp" || event.key === "w" || event.key === "W"
  ) {
    // Move north (up): increase i
    newI += 1;
    moved = true;
  } else if (
    event.key === "ArrowDown" || event.key === "s" || event.key === "S"
  ) {
    // Move south (down): decrease i
    newI -= 1;
    moved = true;
  } else if (
    event.key === "ArrowLeft" || event.key === "a" || event.key === "A"
  ) {
    // Move west (left): decrease j
    newJ -= 1;
    moved = true;
  } else if (
    event.key === "ArrowRight" || event.key === "d" || event.key === "D"
  ) {
    // Move east (right): increase j
    newJ += 1;
    moved = true;
  }

  if (moved) {
    // Prevent default scrolling behavior
    event.preventDefault();
    movePlayer(newI, newJ);
  }
});

// Initialize status panel and inventory
statusPanelDiv.innerHTML =
  `Ready to play! Tokens spawned: ${tokenCount}. Use Arrow Keys or WASD to move.`;
updateInventoryDisplay();
