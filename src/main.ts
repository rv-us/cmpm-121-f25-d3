// @deno-types="npm:@types/leaflet"
import leaflet from "leaflet";

// Style sheets
import "leaflet/dist/leaflet.css";
import "./style.css";

// Fix missing marker images
import "./_leafletWorkaround.ts";

// Import our luck function

// Classroom location (fixed player position)
const CLASSROOM_LATLNG = leaflet.latLng(
  36.997936938057016,
  -122.05703507501151,
);

// Game parameters
const GAMEPLAY_ZOOM_LEVEL = 19;
const CELL_SIZE = 0.0001; // degrees per cell (about the size of a house)
const INTERACTION_DISTANCE = 3; // cells away player can interact

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
}

// Store all cells
const cells = new Map<string, Cell>();

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

// Create a cell at grid position (i, j)
function createCell(i: number, j: number): Cell {
  const bounds = cellToBounds(i, j);
  const rectangle = leaflet.rectangle(bounds, {
    color: "#3388ff",
    weight: 1,
    fillOpacity: 0.1,
  });
  rectangle.addTo(map);

  return {
    i,
    j,
    rectangle,
    tokenValue: null, // Will be set in Step 2
  };
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
