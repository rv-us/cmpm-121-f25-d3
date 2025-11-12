// @deno-types="npm:@types/leaflet"
import leaflet from "leaflet";

// Style sheets
import "leaflet/dist/leaflet.css";
import "./style.css";

// Fix missing marker images
import "./_leafletWorkaround.ts";

// Import our luck function
import luck from "./_luck.ts";

// Null Island (0,0) - anchor point for coordinate system
// Cells are calculated relative to Null Island (0,0)
const _NULL_ISLAND = leaflet.latLng(0, 0);

// Classroom location (starting player position)
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

// Player position (starts at classroom location converted to cell coordinates)
const initialPlayerCellId = latLngToCellId(
  CLASSROOM_LATLNG.lat,
  CLASSROOM_LATLNG.lng,
);
let playerCellId: CellId = { ...initialPlayerCellId };

// Create the map (will be centered on player position after cells are created)
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

// Add player marker (will be positioned based on playerCellId)
const playerMarker = leaflet.marker(CLASSROOM_LATLNG);
playerMarker.bindTooltip("That's you!");
playerMarker.addTo(map);

// Calculate visible bounds to determine grid size
// We'll create a large grid that covers the visible area
const VISIBLE_GRID_SIZE = 50; // cells in each direction from center

// Cell identifier type - represents a cell in the global grid
interface CellId {
  i: number; // latitude cell index
  j: number; // longitude cell index
}

// Convert CellId to string key for Map
function cellIdToKey(cellId: CellId): string {
  return `${cellId.i},${cellId.j}`;
}

// Convert latitude/longitude to cell identifier (based on Null Island)
function latLngToCellId(lat: number, lng: number): CellId {
  return {
    i: Math.floor(lat / CELL_SIZE),
    j: Math.floor(lng / CELL_SIZE),
  };
}

// Convert cell identifier to latitude/longitude bounds
function cellIdToBounds(cellId: CellId): leaflet.LatLngBounds {
  return leaflet.latLngBounds([
    [
      cellId.i * CELL_SIZE,
      cellId.j * CELL_SIZE,
    ],
    [
      (cellId.i + 1) * CELL_SIZE,
      (cellId.j + 1) * CELL_SIZE,
    ],
  ]);
}

// Get center point of a cell from cell identifier
function cellIdToCenter(cellId: CellId): leaflet.LatLng {
  return leaflet.latLng(
    (cellId.i + 0.5) * CELL_SIZE,
    (cellId.j + 0.5) * CELL_SIZE,
  );
}

// Cell data structure to track cell state
interface Cell {
  cellId: CellId;
  rectangle: leaflet.Rectangle;
  tokenValue: number | null;
  marker: leaflet.Marker | null; // Visual marker for token
}

// Store all cells
const cells = new Map<string, Cell>();

// Inventory system - player can hold at most one token
let playerInventory: number | null = null;

// Win condition values
const WIN_TOKEN_VALUES = [8, 16];

// Calculate distance between two cells (Manhattan distance)
function cellDistance(cellId1: CellId, cellId2: CellId): number {
  return Math.abs(cellId1.i - cellId2.i) + Math.abs(cellId1.j - cellId2.j);
}

// Check if a cell is within interaction distance
function isInteractable(cellId: CellId): boolean {
  return cellDistance(cellId, playerCellId) <= INTERACTION_DISTANCE;
}

// Spawn token in a cell using deterministic luck function
function spawnTokenInCell(cell: Cell): void {
  // Use deterministic luck to determine if token spawns
  const spawnKey = cellIdToKey(cell.cellId);
  const luckValue = luck(spawnKey);
  if (luckValue < TOKEN_SPAWN_PROBABILITY) {
    // Determine token value using deterministic luck
    const valueKey = `${spawnKey},initialValue`;
    const tokenValue = Math.floor(luck(valueKey) * 8) + 1; // Values 1-8
    cell.tokenValue = tokenValue;
    updateCellVisual(cell);
  }
}

// Update cell visual appearance based on state
function updateCellVisual(cell: Cell): void {
  const isInteract = isInteractable(cell.cellId);
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
      const center = cellIdToCenter(cell.cellId);
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

// Create a cell at grid position
function createCell(cellId: CellId): Cell {
  const bounds = cellIdToBounds(cellId);
  const rectangle = leaflet.rectangle(bounds, {
    color: "#3388ff",
    weight: 1,
    fillOpacity: 0.1,
  });
  rectangle.addTo(map);

  const cell: Cell = {
    cellId,
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
  if (!isInteractable(cell.cellId)) {
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
        `Crafted! Created token with value ${newValue} in cell (${cell.cellId.i}, ${cell.cellId.j}).`;
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
      `Picked up token with value ${playerInventory} from cell (${cell.cellId.i}, ${cell.cellId.j}).`;
    return;
  }

  // If both are empty
  if (playerInventory === null && cell.tokenValue === null) {
    statusPanelDiv.innerHTML =
      `Cell (${cell.cellId.i}, ${cell.cellId.j}) is empty.`;
  }
}

// Create grid of cells covering visible area around player starting position
let tokenCount = 0;
for (let i = -VISIBLE_GRID_SIZE; i < VISIBLE_GRID_SIZE; i++) {
  for (let j = -VISIBLE_GRID_SIZE; j < VISIBLE_GRID_SIZE; j++) {
    const cellId: CellId = {
      i: playerCellId.i + i,
      j: playerCellId.j + j,
    };
    const cellKey = cellIdToKey(cellId);
    const cell = createCell(cellId);
    cells.set(cellKey, cell);
    if (cell.tokenValue !== null) {
      tokenCount++;
    }
  }
}

// Move player to a new cell position
function movePlayer(newCellId: CellId): void {
  playerCellId = newCellId;

  // Update player marker position
  const newPosition = cellIdToCenter(playerCellId);
  playerMarker.setLatLng(newPosition);

  // Update map center to follow player with smooth panning
  map.panTo(newPosition, { animate: true, duration: 0.3 });

  // Update all cell visuals to reflect new interactable cells
  for (const cell of cells.values()) {
    updateCellVisual(cell);
  }

  statusPanelDiv.innerHTML =
    `Moved to cell (${playerCellId.i}, ${playerCellId.j}). Use Arrow Keys or WASD to move.`;
}

// Handle keyboard input for player movement
document.addEventListener("keydown", (event) => {
  const newCellId: CellId = { ...playerCellId };
  let moved = false;

  // Arrow keys or WASD
  // i affects latitude (north-south): increasing i moves north
  // j affects longitude (east-west): increasing j moves east
  if (
    event.key === "ArrowUp" || event.key === "w" || event.key === "W"
  ) {
    // Move north (up): increase i
    newCellId.i += 1;
    moved = true;
  } else if (
    event.key === "ArrowDown" || event.key === "s" || event.key === "S"
  ) {
    // Move south (down): decrease i
    newCellId.i -= 1;
    moved = true;
  } else if (
    event.key === "ArrowLeft" || event.key === "a" || event.key === "A"
  ) {
    // Move west (left): decrease j
    newCellId.j -= 1;
    moved = true;
  } else if (
    event.key === "ArrowRight" || event.key === "d" || event.key === "D"
  ) {
    // Move east (right): increase j
    newCellId.j += 1;
    moved = true;
  }

  if (moved) {
    // Prevent default scrolling behavior
    event.preventDefault();
    movePlayer(newCellId);
  }
});

// Initialize status panel and inventory
statusPanelDiv.innerHTML =
  `Ready to play! Tokens spawned: ${tokenCount}. Use Arrow Keys or WASD to move.`;
updateInventoryDisplay();
