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

// Player is at cell (0, 0)
const PLAYER_CELL_I = 0;
const PLAYER_CELL_J = 0;

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
  return cellDistance(i, j, PLAYER_CELL_I, PLAYER_CELL_J) <= INTERACTION_DISTANCE;
}

// Spawn token in a cell using deterministic luck function
function spawnTokenInCell(cell: Cell): void {
  // Use deterministic luck to determine if token spawns
  const spawnKey = `${cell.i},${cell.j}`;
  if (luck(spawnKey) < TOKEN_SPAWN_PROBABILITY) {
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
        html: `<div style="background-color: gold; border: 2px solid black; border-radius: 50%; width: 20px; height: 20px; display: flex; align-items: center; justify-content: center; font-weight: bold; font-size: 10px;">${cell.tokenValue}</div>`,
        iconSize: [20, 20],
        iconAnchor: [10, 10],
      });
      cell.marker = leaflet.marker(center, { icon });
      cell.marker.addTo(map);
    } else {
      // Update existing marker
      const icon = leaflet.divIcon({
        className: "token-marker",
        html: `<div style="background-color: gold; border: 2px solid black; border-radius: 50%; width: 20px; height: 20px; display: flex; align-items: center; justify-content: center; font-weight: bold; font-size: 10px;">${cell.tokenValue}</div>`,
        iconSize: [20, 20],
        iconAnchor: [10, 10],
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

// Handle cell click
function handleCellClick(cell: Cell): void {
  if (!isInteractable(cell.i, cell.j)) {
    statusPanelDiv.innerHTML = "Too far away! You can only interact with nearby cells.";
    return;
  }

  if (cell.tokenValue !== null) {
    statusPanelDiv.innerHTML = `Cell (${cell.i}, ${cell.j}) contains token with value ${cell.tokenValue}.`;
  } else {
    statusPanelDiv.innerHTML = `Cell (${cell.i}, ${cell.j}) is empty.`;
  }
}

// Create grid of cells covering visible area
for (let i = -VISIBLE_GRID_SIZE; i < VISIBLE_GRID_SIZE; i++) {
  for (let j = -VISIBLE_GRID_SIZE; j < VISIBLE_GRID_SIZE; j++) {
    const cellKey = `${i},${j}`;
    const cell = createCell(i, j);
    cells.set(cellKey, cell);
  }
}

// Initialize status panel
statusPanelDiv.innerHTML = "Ready to play!";
