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

const controlPanelDiv = document.createElement("div");
controlPanelDiv.id = "controlPanel";
document.body.append(controlPanelDiv);

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
// Allow dragging so player can scroll map without moving character
const map = leaflet.map(mapDiv, {
  center: CLASSROOM_LATLNG,
  zoom: GAMEPLAY_ZOOM_LEVEL,
  minZoom: GAMEPLAY_ZOOM_LEVEL,
  maxZoom: GAMEPLAY_ZOOM_LEVEL,
  zoomControl: false,
  scrollWheelZoom: false,
  dragging: true, // Allow map dragging
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

// Cells are created dynamically based on visible map area

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

// Flyweight pattern: Separate cell coordinates from cell state
// Memento pattern: Store only modified cell states for persistence
const cellState = new Map<string, number | null>();

// ============================================================================
// localStorage Persistence (Step 2: D3.d)
// ============================================================================
const STORAGE_KEY = "tokenGameState";

// Game state interface for serialization
interface GameState {
  playerCellId: CellId;
  playerInventory: number | null;
  cellState: Record<string, number | null>;
}

// Memento pattern: Serialize cell state to a plain object
function serializeCellState(): Record<string, number | null> {
  const serialized: Record<string, number | null> = {};
  for (const [key, value] of cellState.entries()) {
    serialized[key] = value;
  }
  return serialized;
}

// Memento pattern: Deserialize cell state from a plain object
function deserializeCellState(
  serialized: Record<string, number | null>,
): void {
  cellState.clear();
  for (const [key, value] of Object.entries(serialized)) {
    cellState.set(key, value);
  }
}

// Save game state to localStorage
function saveGameState(): void {
  try {
    const gameState: GameState = {
      playerCellId: { ...playerCellId },
      playerInventory: playerInventory,
      cellState: serializeCellState(),
    };
    globalThis.localStorage.setItem(STORAGE_KEY, JSON.stringify(gameState));
  } catch (error) {
    console.error("Failed to save game state:", error);
  }
}

// Load game state from localStorage
function loadGameState(): GameState | null {
  try {
    const saved = globalThis.localStorage.getItem(STORAGE_KEY);
    if (saved === null) {
      return null;
    }
    const gameState: GameState = JSON.parse(saved);
    return gameState;
  } catch (error) {
    console.error("Failed to load game state:", error);
    return null;
  }
}

// Restore game state from localStorage
function restoreGameState(): void {
  const gameState = loadGameState();
  if (gameState === null) {
    return; // No saved state, use defaults
  }

  // Restore player position
  playerCellId = { ...gameState.playerCellId };
  const playerPosition = cellIdToCenter(playerCellId);
  playerMarker.setLatLng(playerPosition);
  map.setView(playerPosition, GAMEPLAY_ZOOM_LEVEL);

  // Restore inventory
  playerInventory = gameState.playerInventory;
  updateInventoryDisplay();

  // Restore cell state
  deserializeCellState(gameState.cellState);

  statusPanelDiv.innerHTML =
    `Game state restored! Player at cell (${playerCellId.i}, ${playerCellId.j}).`;
}

// Clear saved game state (New Game)
function clearGameState(): void {
  try {
    globalThis.localStorage.removeItem(STORAGE_KEY);
    // Reset to initial state
    playerCellId = { ...initialPlayerCellId };
    const playerPosition = cellIdToCenter(playerCellId);
    playerMarker.setLatLng(playerPosition);
    map.setView(playerPosition, GAMEPLAY_ZOOM_LEVEL);
    playerInventory = null;
    cellState.clear();
    updateInventoryDisplay();
    updateVisibleCells();
    statusPanelDiv.innerHTML = "New game started!";
  } catch (error) {
    console.error("Failed to clear game state:", error);
  }
}

// Memento pattern: Save cell state (called when cell scrolls off-screen)
// State is automatically preserved in cellState Map, this is for explicit tracking
function saveCellState(_cellId: CellId): void {
  // State is already stored in cellState Map when modified via setCellTokenValue()
  // This function exists for explicit Memento pattern implementation
  // The state persists automatically in cellState Map
}

// Memento pattern: Restore cell state (called when cell returns to view)
function restoreCellState(cellId: CellId): number | null {
  const cellKey = cellIdToKey(cellId);
  // Restore from cellState Map if it exists
  if (cellState.has(cellKey)) {
    return cellState.get(cellKey)!;
  }
  // Otherwise return null (will be generated from luck function)
  return null;
}

// Cell visual representation (only for visible cells)
interface Cell {
  cellId: CellId;
  rectangle: leaflet.Rectangle;
  tokenValue: number | null;
  marker: leaflet.Marker | null; // Visual marker for token
}

// Store only visible cells (visual representation)
const visibleCells = new Map<string, Cell>();

// Inventory system - player can hold at most one token
let playerInventory: number | null = null;

// Win condition values (increased since players can craft higher values)
const WIN_TOKEN_VALUES = [32, 64];

// Calculate distance between two cells (Manhattan distance)
function cellDistance(cellId1: CellId, cellId2: CellId): number {
  return Math.abs(cellId1.i - cellId2.i) + Math.abs(cellId1.j - cellId2.j);
}

// Check if a cell is within interaction distance
function isInteractable(cellId: CellId): boolean {
  return cellDistance(cellId, playerCellId) <= INTERACTION_DISTANCE;
}

// Get cell token value (Flyweight + Memento: check stored state first, then generate)
function getCellTokenValue(cellId: CellId): number | null {
  const cellKey = cellIdToKey(cellId);

  // Memento pattern: Restore state if cell was previously modified
  const restoredState = restoreCellState(cellId);
  if (restoredState !== null || cellState.has(cellKey)) {
    // Cell has been modified, return stored state
    return cellState.get(cellKey) ?? null;
  }

  // Otherwise, generate from deterministic luck (unmodified cells don't need storage)
  const spawnKey = cellKey;
  const luckValue = luck(spawnKey);
  if (luckValue < TOKEN_SPAWN_PROBABILITY) {
    // Determine token value using deterministic luck
    const valueKey = `${spawnKey},initialValue`;
    const tokenValue = Math.floor(luck(valueKey) * 8) + 1; // Values 1-8
    return tokenValue;
  }

  return null;
}

// Store cell state (only for modified cells - Flyweight pattern)
function setCellTokenValue(cellId: CellId, tokenValue: number | null): void {
  const cellKey = cellIdToKey(cellId);

  // If setting to null, check if it was originally null (unmodified)
  if (tokenValue === null) {
    // Check if cell was already stored (modified)
    if (cellState.has(cellKey)) {
      // Was modified, now setting to null - keep the null state
      cellState.set(cellKey, null);
    } else {
      // Was unmodified, check original generated value
      const spawnKey = cellKey;
      const luckValue = luck(spawnKey);
      if (luckValue < TOKEN_SPAWN_PROBABILITY) {
        // Originally had a token, now empty - store null
        cellState.set(cellKey, null);
      }
      // Otherwise originally empty and still empty - no need to store
    }
  } else {
    // Setting to a value - always store (cell is modified)
    cellState.set(cellKey, tokenValue);
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

// Create a cell visual representation at grid position (Flyweight pattern)
// Step 3: Rebuilds cell display from scratch using stored Map data
function createCell(cellId: CellId): Cell {
  const bounds = cellIdToBounds(cellId);
  const rectangle = leaflet.rectangle(bounds, {
    color: "#3388ff",
    weight: 1,
    fillOpacity: 0.1,
  });
  rectangle.addTo(map);

  // Step 3: Rebuild from stored state - restore token value from cellState Map
  // Get token value from stored state or generate (Flyweight + Memento)
  const tokenValue = getCellTokenValue(cellId);

  const cell: Cell = {
    cellId,
    rectangle,
    tokenValue,
    marker: null,
  };

  // Add click handler
  rectangle.on("click", () => {
    handleCellClick(cell);
  });

  // Step 3: Update visual appearance to maintain consistency with persisted state
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
      statusPanelDiv.innerHTML =
        `Congratulations! You've won the game with a token of value ${playerInventory}!`;
    } else {
      // Show progress toward win condition
      const maxWinValue = Math.max(...WIN_TOKEN_VALUES);
      if (playerInventory >= maxWinValue / 2) {
        inventoryPanelDiv.innerHTML += ` (Goal: ${
          WIN_TOKEN_VALUES.join(" or ")
        } - Keep crafting!)`;
      }
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
      // Store modified state (Flyweight pattern)
      setCellTokenValue(cell.cellId, newValue);
      cell.tokenValue = newValue;
      playerInventory = null; // Remove token from inventory
      updateCellVisual(cell);
      updateInventoryDisplay();
      saveGameState(); // Persist state after crafting
      statusPanelDiv.innerHTML =
        `Crafted! Created token with value ${newValue} in cell (${cell.cellId.i}, ${cell.cellId.j}).`;
    } else {
      statusPanelDiv.innerHTML =
        `Cannot craft! Cell has token value ${cell.tokenValue}, but you have ${playerInventory}. Tokens must match to craft.`;
    }
    return;
  }

  // If player has a token and cell is empty, place/drop token
  if (playerInventory !== null && cell.tokenValue === null) {
    const droppedValue = playerInventory;
    // Store modified state (cell now has token - Flyweight pattern)
    setCellTokenValue(cell.cellId, droppedValue);
    cell.tokenValue = droppedValue;
    playerInventory = null; // Remove token from inventory
    updateCellVisual(cell);
    updateInventoryDisplay();
    saveGameState(); // Persist state after dropping token
    statusPanelDiv.innerHTML =
      `Placed token with value ${droppedValue} in cell (${cell.cellId.i}, ${cell.cellId.j}).`;
    return;
  }

  // If player has no token and cell has a token, pick it up
  if (playerInventory === null && cell.tokenValue !== null) {
    playerInventory = cell.tokenValue;
    // Store modified state (cell now empty - Flyweight pattern)
    setCellTokenValue(cell.cellId, null);
    cell.tokenValue = null; // Remove token from cell
    updateCellVisual(cell);
    updateInventoryDisplay();
    saveGameState(); // Persist state after picking up token
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

// Remove a cell visual representation from the map (despawn)
// Memento pattern: State is preserved in cellState Map when cell scrolls off-screen
function removeCell(cell: Cell): void {
  // Memento pattern: Save state before removing visual representation
  saveCellState(cell.cellId);

  cell.rectangle.removeFrom(map);
  if (cell.marker !== null) {
    cell.marker.removeFrom(map);
  }
  visibleCells.delete(cellIdToKey(cell.cellId));
  // State remains in cellState Map for persistence
}

// Get visible cell bounds based on map view
function getVisibleCellBounds(): {
  minI: number;
  maxI: number;
  minJ: number;
  maxJ: number;
} {
  const bounds = map.getBounds();
  const sw = bounds.getSouthWest();
  const ne = bounds.getNorthEast();

  // Add padding to ensure cells are visible at edges
  const padding = CELL_SIZE * 2;
  const minI = Math.floor((sw.lat - padding) / CELL_SIZE);
  const maxI = Math.ceil((ne.lat + padding) / CELL_SIZE);
  const minJ = Math.floor((sw.lng - padding) / CELL_SIZE);
  const maxJ = Math.ceil((ne.lng + padding) / CELL_SIZE);

  return { minI, maxI, minJ, maxJ };
}

// Update cells based on visible map area (spawn/despawn as needed)
// Flyweight pattern: only visible cells have visual representation
function updateVisibleCells(): void {
  const visibleBounds = getVisibleCellBounds();
  const visibleCellKeys = new Set<string>();

  // Spawn cells that should be visible
  for (let i = visibleBounds.minI; i <= visibleBounds.maxI; i++) {
    for (let j = visibleBounds.minJ; j <= visibleBounds.maxJ; j++) {
      const cellId: CellId = { i, j };
      const cellKey = cellIdToKey(cellId);
      visibleCellKeys.add(cellKey);

      if (!visibleCells.has(cellKey)) {
        // Step 3: Rebuild cell display from scratch using stored Map data
        // Memento pattern: Restore state when cell returns to view
        // Create visual representation (state restored from cellState if modified)
        const cell = createCell(cellId);
        visibleCells.set(cellKey, cell);
      } else {
        // Step 3: Rebuild from stored state - ensure visual consistency
        // Update existing visible cell (restore state from cellState Map)
        const cell = visibleCells.get(cellKey)!;
        // Memento pattern: Restore state from cellState Map
        const restoredValue = getCellTokenValue(cellId);
        // Only update if state changed (maintain visual consistency)
        if (cell.tokenValue !== restoredValue) {
          cell.tokenValue = restoredValue;
          updateCellVisual(cell);
        }
      }
    }
  }

  // Despawn cells that are no longer visible (state preserved in cellState)
  for (const [cellKey, cell] of visibleCells.entries()) {
    if (!visibleCellKeys.has(cellKey)) {
      removeCell(cell);
    }
  }

  // Update visuals for all visible cells
  for (const cell of visibleCells.values()) {
    updateCellVisual(cell);
  }
}

// Restore game state from localStorage (if available)
restoreGameState();

// Initialize cells for starting view
updateVisibleCells();

// Move player to a new cell position
function movePlayer(newCellId: CellId, followWithMap = true): void {
  isPlayerMoving = true;
  playerCellId = newCellId;

  // Update player marker position
  const newPosition = cellIdToCenter(playerCellId);
  playerMarker.setLatLng(newPosition);

  // Optionally update map center to follow player with smooth panning
  // (only when player moves via buttons/keyboard, not when map is dragged)
  if (followWithMap) {
    map.panTo(newPosition, { animate: true, duration: 0.3 });
  }

  // Update visible cells (will spawn/despawn as needed)
  updateVisibleCells();

  // Update interactable cells based on player position (not map view)
  for (const cell of visibleCells.values()) {
    updateCellVisual(cell);
  }

  // Save game state after movement
  saveGameState();

  statusPanelDiv.innerHTML =
    `Player at cell (${playerCellId.i}, ${playerCellId.j}). Use Arrow Keys, WASD, or buttons to move. Drag map to explore.`;
}

// Create movement buttons (used by button movement mode)
function createMovementButtons(): void {
  const buttonContainer = document.createElement("div");
  buttonContainer.style.display = "flex";
  buttonContainer.style.gap = "10px";
  buttonContainer.style.padding = "10px";
  buttonContainer.style.flexWrap = "wrap";

  const northButton = document.createElement("button");
  northButton.textContent = "North (↑)";
  northButton.addEventListener("click", () => {
    const newCellId: CellId = { ...playerCellId, i: playerCellId.i + 1 };
    movePlayer(newCellId, true); // Follow with map
  });

  const southButton = document.createElement("button");
  southButton.textContent = "South (↓)";
  southButton.addEventListener("click", () => {
    const newCellId: CellId = { ...playerCellId, i: playerCellId.i - 1 };
    movePlayer(newCellId, true); // Follow with map
  });

  const eastButton = document.createElement("button");
  eastButton.textContent = "East (→)";
  eastButton.addEventListener("click", () => {
    const newCellId: CellId = { ...playerCellId, j: playerCellId.j + 1 };
    movePlayer(newCellId, true); // Follow with map
  });

  const westButton = document.createElement("button");
  westButton.textContent = "West (←)";
  westButton.addEventListener("click", () => {
    const newCellId: CellId = { ...playerCellId, j: playerCellId.j - 1 };
    movePlayer(newCellId, true); // Follow with map
  });

  // Add button to center map on player
  const centerButton = document.createElement("button");
  centerButton.textContent = "Center on Player";
  centerButton.addEventListener("click", () => {
    const playerPosition = cellIdToCenter(playerCellId);
    map.panTo(playerPosition, { animate: true, duration: 0.3 });
  });

  // Add button to switch movement modes
  const modeSwitchButton = document.createElement("button");
  modeSwitchButton.textContent = "Switch Movement Mode";
  modeSwitchButton.addEventListener("click", () => {
    const newMode: MovementMode = currentMovementMode === "buttons"
      ? "geolocation"
      : "buttons";
    switchMovementMode(newMode);
  });

  // Add "New Game" button to clear saved state
  const newGameButton = document.createElement("button");
  newGameButton.textContent = "New Game";
  newGameButton.style.backgroundColor = "#ff4444";
  newGameButton.style.color = "white";
  newGameButton.addEventListener("click", () => {
    if (
      confirm(
        "Are you sure you want to start a new game? This will clear all saved progress.",
      )
    ) {
      clearGameState();
    }
  });

  buttonContainer.appendChild(northButton);
  buttonContainer.appendChild(southButton);
  buttonContainer.appendChild(eastButton);
  buttonContainer.appendChild(westButton);
  buttonContainer.appendChild(centerButton);
  buttonContainer.appendChild(modeSwitchButton);
  buttonContainer.appendChild(newGameButton);
  controlPanelDiv.appendChild(buttonContainer);
}

// Track if player is moving to prevent map drag from interfering
let isPlayerMoving = false;

// ============================================================================
// Facade Pattern: Player Movement Control
// ============================================================================
// Movement mode type
type MovementMode = "buttons" | "geolocation";

// Movement control interface (Facade pattern)
interface MovementController {
  start(): void;
  stop(): void;
  getMode(): MovementMode;
}

// Get movement mode from query string or default to buttons
function getMovementModeFromQuery(): MovementMode {
  const params = new URLSearchParams(globalThis.location.search);
  const mode = params.get("movement");
  if (mode === "geolocation") {
    return "geolocation";
  }
  return "buttons";
}

// Current movement mode
let currentMovementMode: MovementMode = getMovementModeFromQuery();

// Button-based movement controller (Facade implementation)
class ButtonMovementController implements MovementController {
  private keyboardHandler: ((event: KeyboardEvent) => void) | null = null;

  getMode(): MovementMode {
    return "buttons";
  }

  start(): void {
    // Keyboard input handler
    this.keyboardHandler = (event: KeyboardEvent) => {
      const newCellId: CellId = { ...playerCellId };
      let moved = false;

      // Arrow keys or WASD
      if (
        event.key === "ArrowUp" || event.key === "w" || event.key === "W"
      ) {
        newCellId.i += 1;
        moved = true;
      } else if (
        event.key === "ArrowDown" || event.key === "s" || event.key === "S"
      ) {
        newCellId.i -= 1;
        moved = true;
      } else if (
        event.key === "ArrowLeft" || event.key === "a" || event.key === "A"
      ) {
        newCellId.j -= 1;
        moved = true;
      } else if (
        event.key === "ArrowRight" || event.key === "d" || event.key === "D"
      ) {
        newCellId.j += 1;
        moved = true;
      }

      if (moved) {
        event.preventDefault();
        movePlayer(newCellId, true);
      }
    };

    document.addEventListener("keydown", this.keyboardHandler);
  }

  stop(): void {
    if (this.keyboardHandler) {
      document.removeEventListener("keydown", this.keyboardHandler);
      this.keyboardHandler = null;
    }
  }
}

// Geolocation-based movement controller (Facade implementation)
// Step 3: Fully implemented with error handling and state persistence
class GeolocationMovementController implements MovementController {
  private watchId: number | null = null;
  private lastCellId: CellId | null = null; // Track last position to avoid unnecessary updates
  private keyboardBlocker: ((event: KeyboardEvent) => void) | null = null;

  getMode(): MovementMode {
    return "geolocation";
  }

  start(): void {
    // Block arrow keys in geolocation mode (only real-world movement allowed)
    this.keyboardBlocker = (event: KeyboardEvent) => {
      // Prevent arrow keys from moving player in geolocation mode
      if (
        event.key === "ArrowUp" ||
        event.key === "ArrowDown" ||
        event.key === "ArrowLeft" ||
        event.key === "ArrowRight"
      ) {
        event.preventDefault();
        // Optionally show a message that arrow keys are disabled in this mode
        // (but don't spam the status panel on every keypress)
      }
    };
    document.addEventListener("keydown", this.keyboardBlocker);
    if (!navigator.geolocation) {
      statusPanelDiv.innerHTML =
        "Geolocation is not supported by your browser. Falling back to button movement.";
      switchMovementMode("buttons");
      return;
    }

    // Show initial status
    statusPanelDiv.innerHTML =
      "Requesting location permission... Move in the real world to move your character!";

    // Request permission and start watching position
    this.watchId = navigator.geolocation.watchPosition(
      (position) => {
        const lat = position.coords.latitude;
        const lng = position.coords.longitude;
        const newCellId = latLngToCellId(lat, lng);

        // Only update if player moved to a different cell (avoid unnecessary updates)
        if (
          this.lastCellId === null ||
          this.lastCellId.i !== newCellId.i ||
          this.lastCellId.j !== newCellId.j
        ) {
          this.lastCellId = newCellId;
          movePlayer(newCellId, true);
          statusPanelDiv.innerHTML =
            `Geolocation active! Real-world position: (${lat.toFixed(6)}, ${
              lng.toFixed(6)
            }). Cell: (${newCellId.i}, ${newCellId.j}).`;
        }
      },
      (error) => {
        // Handle different geolocation error types gracefully
        let errorMessage = "Unknown geolocation error.";
        switch (error.code) {
          case error.PERMISSION_DENIED:
            errorMessage =
              "Location permission denied. Please enable location access in your browser settings.";
            break;
          case error.POSITION_UNAVAILABLE:
            errorMessage =
              "Location information unavailable. Check your device's location services.";
            break;
          case error.TIMEOUT:
            errorMessage = "Location request timed out. Please try again.";
            break;
          default:
            errorMessage = `Geolocation error: ${error.message}`;
            break;
        }

        statusPanelDiv.innerHTML =
          `${errorMessage} Falling back to button movement.`;
        // Don't auto-switch on timeout, let user retry
        if (error.code !== error.TIMEOUT) {
          switchMovementMode("buttons");
        }
      },
      {
        enableHighAccuracy: true,
        maximumAge: 2000, // Accept cached position up to 2 seconds old
        timeout: 10000, // 10 second timeout for better reliability
      },
    );
  }

  stop(): void {
    if (this.watchId !== null) {
      navigator.geolocation.clearWatch(this.watchId);
      this.watchId = null;
      this.lastCellId = null; // Reset last position
    }
    // Remove keyboard blocker
    if (this.keyboardBlocker) {
      document.removeEventListener("keydown", this.keyboardBlocker);
      this.keyboardBlocker = null;
    }
  }
}

// Current movement controller instance
let currentMovementController: MovementController | null = null;
let isSwitchingMode = false; // Guard to prevent recursive mode switches

// Switch movement mode (Facade pattern)
function switchMovementMode(mode: MovementMode): void {
  // Prevent switching to the same mode (avoids unnecessary re-initialization)
  if (currentMovementMode === mode && currentMovementController !== null) {
    return;
  }

  // Prevent recursive calls (e.g., when geolocation fails and tries to switch)
  if (isSwitchingMode) {
    // Defer the switch to avoid recursion
    setTimeout(() => switchMovementMode(mode), 0);
    return;
  }

  isSwitchingMode = true;

  // Stop current controller
  if (currentMovementController) {
    currentMovementController.stop();
    currentMovementController = null;
  }

  // Start new controller
  currentMovementMode = mode;
  if (mode === "buttons") {
    currentMovementController = new ButtonMovementController();
  } else {
    currentMovementController = new GeolocationMovementController();
  }
  currentMovementController.start();

  isSwitchingMode = false;

  statusPanelDiv.innerHTML =
    `Movement mode: ${mode}. Use ?movement=buttons or ?movement=geolocation in URL to switch.`;
}

// Create movement buttons (always visible, but only active in button mode)
createMovementButtons();

// Initialize movement controller based on query string or default
switchMovementMode(currentMovementMode);

// Handle map movement to update visible cells
// When map is dragged, update cells but don't move player
map.on("moveend", () => {
  // Only update visible cells, don't move player
  // Player position is independent of map view
  if (!isPlayerMoving) {
    updateVisibleCells();
    // Update interactable cells based on player position (not map view)
    for (const cell of visibleCells.values()) {
      updateCellVisual(cell);
    }
  }
  isPlayerMoving = false;
});

// Initialize status panel and inventory
statusPanelDiv.innerHTML =
  `Ready to play! Use Arrow Keys, WASD, or buttons to move. Drag map to explore. Goal: Craft a token of value ${
    WIN_TOKEN_VALUES.join(" or ")
  }.`;
updateInventoryDisplay();
