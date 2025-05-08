// --- CONSTANTS & CONFIG ---
const NUM_LEVELS = 8;
const NUM_RANKS = 8;
const NUM_FILES = 8;
const E = null; // Represents an empty square

const PIECE_TYPES = { KING: '♔♚', QUEEN: '♕♛', ROOK: '♖♜', BISHOP: '♗♝', KNIGHT: '♘♞', PAWN: '♙♟' };
const PROMOTION_PIECE = { white: '♕', black: '♛' };
const PAWN_START_LEVEL = { white: 1, black: 6 };

const CELL_COLORS_RGB = {
    light: [224, 224, 224], // #e0e0e0
    dark: [176, 176, 176],   // #b0b0b0
    border: [187, 187, 187] // #bbb
};
const PIECE_TEXT_RGB = [0,0,0]; // Assuming black piece text

const BASE_BOARD_WIDTH = 320; // From CSS #board-display-isometric
const BASE_BOARD_HEIGHT = 320; // From CSS #board-display-isometric

// --- DOM Elements ---
let gameArea, boardWrapper, boardDisplay, layerSlider, focusedLayerValueEl, currentLayerNameEl,
    layerSeparationSlider, layerSeparationValueEl,
    opacitySlider, offLayerOpacityValueEl, offPieceOpacitySlider, offPieceOpacityValueEl, linkOpacitiesBtn,
    highlightOpaqueCheckbox, currentPlayerEl, selectionInfoEl, zoomInBtn, zoomOutBtn, gameStatusMessageEl, resetGameBtn,
    adjustLayersZoomCheckbox; 

// --- Game State ---
let boardState = [];
let currentPlayer = 'white';
let selectedPieceInfo = null;
let currentPhase = 'select-piece'; 
let activeFocusLayerIndex = 0;
let currentZoom = 0.7;
const boardRotation = { x: 50, y: 0, z: -45 }; 
let currentLayerSeparation = 30; 
let offLayerCellBgOpacity = 0.1;
let offPieceOpacity = 0.1;
let areOpacitiesLinked = true;
let highlightedMoves = []; 
let cellElements = []; 
let kingsData = { white: [], black: [] }; 
let gameOver = false;
let boardPan = { x: 0, y: 0 };
let isPanning = false;
let panStart = { x: 0, y: 0, initialBoardX: 0, initialBoardY: 0 };
let adjustLayersToFitZoom = true; 

document.addEventListener('DOMContentLoaded', () => {
    initializeDOMElements();
    startGame();
    addEventListeners();
});

function startGame() {
    gameOver = false; currentPlayer = 'white'; currentPhase = 'select-piece';
    boardPan = { x: 0, y: 0 }; selectedPieceInfo = null; highlightedMoves = [];
    initializeBoardStateAndKings();
    if (cellElements.length === 0) createBoardGUI();
    else refreshFullBoardGUI();
    applyLayerSeparation();
    updateInitialUI();
    updateBoardTransform(); 
}

function initializeDOMElements() {
    gameArea = document.getElementById('game-area'); boardWrapper = document.getElementById('board-wrapper');
    boardDisplay = document.getElementById('board-display-isometric'); layerSlider = document.getElementById('layer-slider');
    focusedLayerValueEl = document.getElementById('focused-layer-value'); currentLayerNameEl = document.getElementById('current-layer-name');
    layerSeparationSlider = document.getElementById('layer-separation-slider'); layerSeparationValueEl = document.getElementById('layer-separation-value');
    opacitySlider = document.getElementById('opacity-slider'); offLayerOpacityValueEl = document.getElementById('off-layer-opacity-value');
    offPieceOpacitySlider = document.getElementById('off-piece-opacity-slider'); offPieceOpacityValueEl = document.getElementById('off-piece-opacity-value');
    linkOpacitiesBtn = document.getElementById('link-opacities-btn'); highlightOpaqueCheckbox = document.getElementById('highlight-opaque-checkbox');
    currentPlayerEl = document.getElementById('current-player'); selectionInfoEl = document.getElementById('selection-info');
    zoomInBtn = document.getElementById('zoom-in-btn'); zoomOutBtn = document.getElementById('zoom-out-btn');
    gameStatusMessageEl = document.getElementById('game-status-message'); resetGameBtn = document.getElementById('reset-game-btn');
    adjustLayersZoomCheckbox = document.getElementById('adjust-layers-zoom-checkbox'); 
}

function initializeBoardStateAndKings() {
    boardState = Array(NUM_LEVELS).fill(null).map(() => Array(NUM_RANKS).fill(null).map(() => Array(NUM_FILES).fill(E)));
    kingsData = { white: [], black: [] };
    const pieceChars = { '♔':'K', '♕':'Q', '♖':'R', '♗':'B', '♘':'N', '♙':'P', '♚':'K', '♛':'Q', '♜':'R', '♝':'B', '♞':'N', '♟':'P' };
    const whitePiecesL0_visual = ["♖♖♘♗♗♘♖♖", "♖♖♗♘♘♗♖♖", "♘♗♕♕♕♕♗♘", "♗♘♕♔♔♕♘♗", "♗♘♕♔♔♕♘♗", "♘♗♕♕♕♕♗♘", "♖♖♗♘♘♗♖♖", "♖♖♘♗♗♘♖♖"].map(r => r.split(''));
    populateLayer(0, whitePiecesL0_visual, 'white', pieceChars);
    const whitePawnsL1_visual = Array(NUM_RANKS).fill('♙'.repeat(NUM_FILES)).map(r => r.split(''));
    populateLayer(1, whitePawnsL1_visual, 'white', pieceChars);
    const blackPawnsL6_visual = Array(NUM_RANKS).fill('♟'.repeat(NUM_FILES)).map(r => r.split(''));
    populateLayer(6, blackPawnsL6_visual, 'black', pieceChars);
    const blackPiecesL7_visual = ["♜♜♞♝♝♞♜♜", "♜♜♝♞♞♝♜♜", "♞♝♛♛♛♛♝♞", "♝♞♛♚♚♛♞♝", "♝♞♛♚♚♛♞♝", "♞♝♛♛♛♛♝♞", "♜♜♝♞♞♝♜♜", "♜♜♞♝♝♞♜♜"].map(r => r.split(''));
    populateLayer(7, blackPiecesL7_visual, 'black', pieceChars);
}
function createPiece(type, color, idPrefix, rank, file, level) {
    const piece = { type, color, id: `${idPrefix}_L${level}R${rank}F${file}`, hasMoved: false };
    if (PIECE_TYPES.KING.includes(type)) { kingsData[color].push({ l: level, r: rank, f: file, id: piece.id, pieceRef: piece }); }
    return piece;
}
function populateLayer(level, visualMap, color, pieceTypeMap) {
    for (let r_visual = 0; r_visual < NUM_RANKS; r_visual++) {
        let rank_actual = NUM_RANKS - 1 - r_visual; 
        for (let f = 0; f < NUM_FILES; f++) {
            const char = visualMap[r_visual][f];
            if (char && char !== ' ' && char !== E) {
                const piecePrefix = pieceTypeMap[char];
                boardState[level][rank_actual][f] = createPiece(char, color, `${piecePrefix}`, rank_actual, f, level);
            }
        }
    }
}

function createBoardGUI() {
    boardDisplay.innerHTML = '';
    cellElements = Array(NUM_LEVELS).fill(null).map(() => Array(NUM_RANKS).fill(null).map(() => Array(NUM_FILES).fill(null)));
    for (let l = 0; l < NUM_LEVELS; l++) {
        const layerDiv = document.createElement('div');
        layerDiv.classList.add('layer'); layerDiv.id = `layer-${l}`;
        for (let r_grid = 0; r_grid < NUM_RANKS; r_grid++) { 
            let r_board = NUM_RANKS - 1 - r_grid; 
            for (let f_board = 0; f_board < NUM_FILES; f_board++) { 
                const cellDiv = document.createElement('div');
                cellDiv.classList.add('cell');
                const piece = boardState[l][r_board][f_board];
                cellDiv.textContent = piece ? piece.type : '';
                cellDiv.addEventListener('click', (event) => onCellClickManager(l, r_board, f_board, cellDiv, event));
                layerDiv.appendChild(cellDiv);
                cellElements[l][r_board][f_board] = cellDiv;
            }
        }
        boardDisplay.appendChild(layerDiv);
    }
}

function applyLayerSeparation() {
    for (let l = 0; l < NUM_LEVELS; l++) {
        const layerDiv = document.getElementById(`layer-${l}`);
        if (layerDiv) { layerDiv.style.transform = `translateZ(${l * currentLayerSeparation}px)`; }
    }
}
function refreshFullBoardGUI() {
    for (let l = 0; l < NUM_LEVELS; l++) for (let r = 0; r < NUM_RANKS; r++) for (let f = 0; f < NUM_FILES; f++) {
        updateCellGUI(l, r, f);
    }
}
function updateCellGUI(l, r, f) {
    const cellDiv = cellElements[l][r][f];
    if (cellDiv) {
        const piece = boardState[l][r][f];
        cellDiv.textContent = piece ? piece.type : '';
        const existingIndicator = cellDiv.querySelector('.check-indicator');
        if (existingIndicator) existingIndicator.remove();
        cellDiv.classList.remove('king-in-check');
    }
}

function addEventListeners() {
    layerSlider.addEventListener('input', () => { focusedLayerValueEl.textContent = layerSlider.value; handleLayerAndHighlightUpdate(); });
    layerSeparationSlider.addEventListener('input', (e) => { currentLayerSeparation = parseInt(e.target.value); if (layerSeparationValueEl) layerSeparationValueEl.textContent = currentLayerSeparation; applyLayerSeparation(); updateBoardTransform(); });
    opacitySlider.addEventListener('input', (e) => {
        offLayerCellBgOpacity = parseInt(e.target.value) / 100;
        offLayerOpacityValueEl.textContent = e.target.value;
        if (areOpacitiesLinked) {
            offPieceOpacity = offLayerCellBgOpacity;
            offPieceOpacitySlider.value = e.target.value;
            offPieceOpacityValueEl.textContent = e.target.value;
        }
        handleLayerAndHighlightUpdate();
    });
    offPieceOpacitySlider.addEventListener('input', (e) => {
        offPieceOpacity = parseInt(e.target.value) / 100;
        offPieceOpacityValueEl.textContent = e.target.value;
        if (areOpacitiesLinked) {
            offLayerCellBgOpacity = offPieceOpacity;
            opacitySlider.value = e.target.value;
            offLayerOpacityValueEl.textContent = e.target.value;
        }
        handleLayerAndHighlightUpdate();
    });
    linkOpacitiesBtn.addEventListener('click', () => {
        areOpacitiesLinked = !areOpacitiesLinked;
        linkOpacitiesBtn.classList.toggle('linked', areOpacitiesLinked);
        linkOpacitiesBtn.textContent = areOpacitiesLinked ? '🔗 Link Opacities' : '🚫 Unlink Opacities';
        if (areOpacitiesLinked) {
            offPieceOpacity = offLayerCellBgOpacity;
            offPieceOpacitySlider.value = opacitySlider.value;
            offPieceOpacityValueEl.textContent = opacitySlider.value;
            handleLayerAndHighlightUpdate();
        }
    });
    highlightOpaqueCheckbox.addEventListener('change', handleLayerAndHighlightUpdate);
    zoomInBtn.addEventListener('click', () => zoom(0.1)); zoomOutBtn.addEventListener('click', () => zoom(-0.1));
    if (adjustLayersZoomCheckbox) { 
        adjustLayersZoomCheckbox.addEventListener('change', () => {
            adjustLayersToFitZoom = adjustLayersZoomCheckbox.checked;
            updateBoardTransform(); 
        });
    }
    resetGameBtn.addEventListener('click', startGame);
    gameArea.addEventListener('mousedown', onPanStart); document.addEventListener('mousemove', onPanMove); document.addEventListener('mouseup', onPanEnd);
    document.addEventListener('keydown', handleArrowKeys);
}

function updateInitialUI() {
    layerSlider.value = 0; activeFocusLayerIndex = 0; focusedLayerValueEl.textContent = layerSlider.value;
    layerSeparationSlider.value = currentLayerSeparation; if(layerSeparationValueEl) layerSeparationValueEl.textContent = currentLayerSeparation;
    opacitySlider.value = offLayerCellBgOpacity * 100; offLayerOpacityValueEl.textContent = (offLayerCellBgOpacity * 100).toFixed(0);
    offPieceOpacitySlider.value = offPieceOpacity * 100; offPieceOpacityValueEl.textContent = (offPieceOpacity * 100).toFixed(0);
    linkOpacitiesBtn.classList.toggle('linked', areOpacitiesLinked); linkOpacitiesBtn.textContent = areOpacitiesLinked ? '🔗 Link Opacities' : '🚫 Unlink Opacities';
    if (adjustLayersZoomCheckbox) adjustLayersZoomCheckbox.checked = adjustLayersToFitZoom; 
    currentPlayerEl.textContent = currentPlayer.charAt(0).toUpperCase() + currentPlayer.slice(1);
    gameStatusMessageEl.textContent = "Game in progress..."; gameStatusMessageEl.className = "status-box";
    clearSelectionAndHighlights(); updateAllKingCheckStatus();
}

function handleArrowKeys(event) {
    if (gameOver) return; let currentLevelVal = parseInt(layerSlider.value); let newLevel = currentLevelVal;
    if (event.key === 'ArrowUp') { newLevel = (currentLevelVal === 7) ? 0 : currentLevelVal + 1; event.preventDefault(); }
    else if (event.key === 'ArrowDown') { newLevel = (currentLevelVal === 0) ? 7 : currentLevelVal - 1; event.preventDefault(); }
    else { return; }
    if (newLevel !== currentLevelVal) { layerSlider.value = newLevel; focusedLayerValueEl.textContent = newLevel; handleLayerAndHighlightUpdate(); }
}
function onPanStart(event) { if (event.target.closest('#board-wrapper') || event.target.closest('#instructions-details')) return; isPanning = true; panStart.x = event.clientX; panStart.y = event.clientY; panStart.initialBoardX = boardPan.x; panStart.initialBoardY = boardPan.y; gameArea.classList.add('grabbing'); event.preventDefault(); }
function onPanMove(event) { if (!isPanning) return; boardPan.x = panStart.initialBoardX + (event.clientX - panStart.x); boardPan.y = panStart.initialBoardY + (event.clientY - panStart.y); updateBoardTransform(); }
function onPanEnd() { if (isPanning) { isPanning = false; gameArea.classList.remove('grabbing');} }

function onCellClickManager(l_cell, r_cell, f_cell, cellDiv_clicked, event) {
    if (gameOver || isPanning) return;

    // Check if the click is on an off-focus layer but should be treated as active due to opaque highlighting
    const isForceOpaqueClickable = highlightOpaqueCheckbox.checked && 
                                  cellDiv_clicked.style.pointerEvents === 'auto' &&
                                  // cellDiv_clicked.style.opacity === '1' && // This check is now more reliable due to fixes in handleLayerAndHighlightUpdate
                                  (cellDiv_clicked.classList.contains('valid-move-highlight') || cellDiv_clicked.classList.contains('capture-move-highlight')) &&
                                  l_cell !== activeFocusLayerIndex;

    const effectiveL = isForceOpaqueClickable ? l_cell : activeFocusLayerIndex;

    // If the physical click (l_cell) is not on the determined effective layer,
    // and it's not a force-opaque click, then ignore.
    // This prevents processing clicks on underlying layers if the top layer is translucent but not specifically highlighted for interaction.
    if (l_cell !== effectiveL && !isForceOpaqueClickable) {
         // Example: focus is L0, opaque checkbox is OFF. User clicks a translucent piece on L1.
         // l_cell = 1, effectiveL = 0. isForceOpaqueClickable = false. (1 !== 0 && true) -> return. Correct.
         // Example: focus is L0, opaque checkbox is ON. User clicks a highlighted cell on L1.
         // l_cell = 1, effectiveL = 1 (due to isForceOpaqueClickable). (1 !== 1 && false) -> no return. Correct.
        return;
    }
    
    const pieceOnCell = boardState[effectiveL][r_cell][f_cell];

    if (currentPhase === 'select-piece') {
        if (pieceOnCell && pieceOnCell.color === currentPlayer) {
            selectPiece(effectiveL, r_cell, f_cell, pieceOnCell, cellDiv_clicked);
        }
    } else if (currentPhase === 'select-destination') {
        const { piece: movingPiece, fromL, fromR, fromF } = selectedPieceInfo;
        // If clicking the selected piece again, deselect it
        if (effectiveL === fromL && r_cell === fromR && f_cell === fromF) { 
            clearSelectionAndHighlights(); 
            return; 
        }
        const isValidTargetMove = highlightedMoves.find(m => m.l === effectiveL && m.r === r_cell && m.f === f_cell);
        if (isValidTargetMove) {
            const capturedPiece = boardState[effectiveL][r_cell][f_cell];
            if (capturedPiece && PIECE_TYPES.KING.includes(capturedPiece.type)) { kingsData[capturedPiece.color] = kingsData[capturedPiece.color].filter(k => k.id !== capturedPiece.id); }
            boardState[effectiveL][r_cell][f_cell] = movingPiece; boardState[fromL][fromR][fromF] = E; movingPiece.hasMoved = true;
            const promotionLevel = movingPiece.color === 'white' ? 7 : 0;
            if (PIECE_TYPES.PAWN.includes(movingPiece.type) && effectiveL === promotionLevel) { movingPiece.type = PROMOTION_PIECE[movingPiece.color]; }
            if (PIECE_TYPES.KING.includes(movingPiece.type)) { const kingIdx = kingsData[movingPiece.color].findIndex(k => k.id === movingPiece.id); if (kingIdx !== -1) { kingsData[movingPiece.color][kingIdx].l = effectiveL; kingsData[movingPiece.color][kingIdx].r = r_cell; kingsData[movingPiece.color][kingIdx].f = f_cell; } }
            updateCellGUI(effectiveL, r_cell, f_cell); updateCellGUI(fromL, fromR, fromF);
            currentPlayer = (currentPlayer === 'white') ? 'black' : 'white'; currentPlayerEl.textContent = currentPlayer.charAt(0).toUpperCase() + currentPlayer.slice(1);
            clearSelectionAndHighlights(); updateAllKingCheckStatus(); checkWinCondition();
        } else { selectionInfoEl.textContent = "Invalid move target. Click a highlighted square or re-select piece."; }
    }
}

function selectPiece(l, r, f, piece, cellDiv) {
    clearSelectionAndHighlights(); 
    selectedPieceInfo = { piece, fromL: l, fromR: r, fromF: f, cellDiv };
    currentPhase = 'select-destination';
    highlightedMoves = getValidMovesForPiece(piece, l, r, f, boardState);
    handleLayerAndHighlightUpdate();
}
function clearSelectionAndHighlights() {
    selectedPieceInfo = null; currentPhase = 'select-piece'; highlightedMoves = []; 
    handleLayerAndHighlightUpdate(); 
}

function handleLayerAndHighlightUpdate() {
    activeFocusLayerIndex = parseInt(layerSlider.value);
    currentLayerNameEl.textContent = `Level ${activeFocusLayerIndex}: ${getLevelName(activeFocusLayerIndex)}`;
    const forceOpaqueClickableHighlights = highlightOpaqueCheckbox.checked;

    for (let l_idx = 0; l_idx < NUM_LEVELS; l_idx++) {
        const layerDiv = document.getElementById(`layer-${l_idx}`);
        if (!layerDiv) continue;
        
        layerDiv.style.opacity = '1'; 
        layerDiv.style.pointerEvents = (l_idx === activeFocusLayerIndex) ? 'auto' : 'none';
        layerDiv.style.zIndex = (l_idx === activeFocusLayerIndex) ? NUM_LEVELS + 1 : l_idx;
        
        const layerBgEffectiveOpacity = (l_idx === activeFocusLayerIndex) ? 0.05 : (offLayerCellBgOpacity * 0.1);
        layerDiv.style.backgroundColor = `rgba(220, 220, 220, ${layerBgEffectiveOpacity})`;

        for (let r_idx = 0; r_idx < NUM_RANKS; r_idx++) {
            for (let f_idx = 0; f_idx < NUM_FILES; f_idx++) {
                const cell = cellElements[l_idx][r_idx][f_idx];
                if (!cell) continue;
                
                // Reset opacity and pointer events before applying specific logic for highlights
                cell.style.opacity = '1'; // Default to opaque, highlights might change this
                cell.style.pointerEvents = (l_idx === activeFocusLayerIndex) ? 'auto' : 'none'; // Default based on layer focus

                cell.classList.remove('valid-move-highlight', 'capture-move-highlight', 'selected-piece-cell');
                
                const pieceOnCell = boardState[l_idx][r_idx][f_idx];
                let cellBgAlpha = 1.0;
                let pieceTextAlpha = 1.0;
                // let cellPointerEvents = 'auto'; // Replaced by default above

                const isBaseDarkSquare = (f_idx + r_idx + l_idx) % 2 !== 0;
                const baseCellRgb = isBaseDarkSquare ? CELL_COLORS_RGB.dark : CELL_COLORS_RGB.light;
                const baseBorderRgb = CELL_COLORS_RGB.border;

                if (l_idx !== activeFocusLayerIndex) {
                    cellBgAlpha = offLayerCellBgOpacity;
                    pieceTextAlpha = offPieceOpacity;
                    // cell.style.pointerEvents = 'none'; // Already handled by default
                    // cell.style.opacity = '1'; // Default is 1, if it needs to be something else for non-highlighted off-layer cells, it should be set here.
                                                // However, the visual effect for non-highlighted off-layer cells is primarily through cellBgAlpha and pieceTextAlpha.
                                                // The cell itself (the div) should remain opacity 1 unless it's a non-opaque highlight.
                }
                
                cell.style.backgroundColor = `rgba(${baseCellRgb[0]}, ${baseCellRgb[1]}, ${baseCellRgb[2]}, ${cellBgAlpha})`;
                cell.style.borderColor = `rgba(${baseBorderRgb[0]}, ${baseBorderRgb[1]}, ${baseBorderRgb[2]}, ${cellBgAlpha})`;
                cell.style.borderWidth = '1px'; cell.style.borderStyle = 'solid';

                if (pieceOnCell) {
                    cell.style.color = `rgba(${PIECE_TEXT_RGB[0]}, ${PIECE_TEXT_RGB[1]}, ${PIECE_TEXT_RGB[2]}, ${pieceTextAlpha})`;
                } else {
                    cell.style.color = 'transparent';
                }
                // cell.style.pointerEvents = cellPointerEvents; // Replaced by default and highlight logic
            }
        }
    }
    
    if (selectedPieceInfo && selectedPieceInfo.cellDiv) {
        selectedPieceInfo.cellDiv.classList.add('selected-piece-cell');
        selectedPieceInfo.cellDiv.style.color = `rgba(${PIECE_TEXT_RGB[0]}, ${PIECE_TEXT_RGB[1]}, ${PIECE_TEXT_RGB[2]}, 1)`;
        selectedPieceInfo.cellDiv.style.pointerEvents = 'auto';
        selectedPieceInfo.cellDiv.style.opacity = '1'; // Ensure selected piece cell is fully opaque
    }

    if (currentPhase === 'select-destination') {
        highlightedMoves.forEach(move => {
            const targetCellDiv = cellElements[move.l][move.r][move.f];
            if (targetCellDiv) {
                targetCellDiv.classList.add(move.isCapture ? 'capture-move-highlight' : 'valid-move-highlight');
                const pieceOnTarget = boardState[move.l][move.r][move.f];
                let highlightedPieceTextAlpha = 1.0;

                if (move.l === activeFocusLayerIndex) {
                    targetCellDiv.style.pointerEvents = 'auto';
                    targetCellDiv.style.opacity = '1'; // Highlights on focus layer are opaque
                } else { // Highlight is on an off-focus layer
                    if (forceOpaqueClickableHighlights) {
                        targetCellDiv.style.pointerEvents = 'auto';
                        targetCellDiv.style.opacity = '1'; // BUG FIX: Explicitly set to opaque
                    } else {
                        // Highlight class provides background. For translucency, cell's own opacity is set.
                        targetCellDiv.style.opacity = offLayerCellBgOpacity.toString(); 
                        targetCellDiv.style.pointerEvents = 'none';
                        highlightedPieceTextAlpha = offPieceOpacity; 
                    }
                }
                targetCellDiv.style.color = pieceOnTarget ? `rgba(${PIECE_TEXT_RGB[0]}, ${PIECE_TEXT_RGB[1]}, ${PIECE_TEXT_RGB[2]}, ${highlightedPieceTextAlpha})` : 'transparent';
            }
        });
    }

    if (currentPhase === 'select-destination' && selectedPieceInfo) {
        selectionInfoEl.textContent = `Selected: ${selectedPieceInfo.piece.type}. Target on Focus L${activeFocusLayerIndex}. Moves: ${highlightedMoves.length}`;
    } else if (currentPhase === 'select-piece') {
        selectionInfoEl.textContent = `Phase: Select a piece on Focus Level ${activeFocusLayerIndex}.`;
    }
}


function getValidMovesForPiece(piece, fromL, fromR, fromF, currentBoard) {
    const moves = [];
    const pieceColor = piece.color;
    const isValid = (l, r, f) => l >= 0 && l < NUM_LEVELS && r >= 0 && r < NUM_RANKS && f >= 0 && f < NUM_FILES;

    const addMove = (toL, toR, toF, isCaptureIntent = false, canSlide = false) => {
        if (!isValid(toL, toR, toF)) return { added: false, canContinueSlide: false };
        const targetPiece = currentBoard[toL][toR][toF];
        if (targetPiece === E) {
            if (!isCaptureIntent) moves.push({ l: toL, r: toR, f: toF, isCapture: false });
            return { added: !isCaptureIntent, canContinueSlide: canSlide };
        } else if (targetPiece.color !== pieceColor) {
            moves.push({ l: toL, r: toR, f: toF, isCapture: true });
            return { added: true, canContinueSlide: false };
        }
        return { added: false, canContinueSlide: false };
    };
    
    const generateSlidingMoves = (directions) => {
        for (const dir of directions) {
            for (let i = 1; i < Math.max(NUM_LEVELS, NUM_RANKS, NUM_FILES); i++) {
                const result = addMove(fromL + dir.dl * i, fromR + dir.dr * i, fromF + dir.df * i, false, true);
                if (!result.canContinueSlide) break;
            }
        }
    };
    const pawnMoveDir = piece.color === 'white' ? 1 : -1;
    const startLevel = PAWN_START_LEVEL[piece.color];

    switch (piece.type) {
        case '♙': case '♟':
            const normalMoveL1 = fromL + pawnMoveDir;
            if (isValid(normalMoveL1, fromR, fromF) && currentBoard[normalMoveL1][fromR][fromF] === E) {
                addMove(normalMoveL1, fromR, fromF, false);
                if (fromL === startLevel && !piece.hasMoved) { 
                    const normalMoveL2 = fromL + 2 * pawnMoveDir;
                    if (isValid(normalMoveL2, fromR, fromF) && currentBoard[normalMoveL2][fromR][fromF] === E) {
                        addMove(normalMoveL2, fromR, fromF, false);
                    }
                }
            }
            const S_l_capture = fromL + pawnMoveDir; 
            if (isValid(S_l_capture, fromR, fromF)) { 
                const captureCandidates = [ 
                    { dr: 1, df: 0 }, { dr: -1, df: 0 },
                    { dr: 0, df: 1 }, { dr: 0, df: -1 } 
                ];
                for (const cand of captureCandidates) {
                    const captureTargetR = fromR + cand.dr;
                    const captureTargetF = fromF + cand.df;
                    if (isValid(S_l_capture, captureTargetR, captureTargetF)) {
                        const potentialVictim = currentBoard[S_l_capture][captureTargetR][captureTargetF];
                        if (potentialVictim && potentialVictim.color !== pieceColor) {
                            addMove(S_l_capture, captureTargetR, captureTargetF, true); 
                        }
                    }
                }
            }
            break;
        case '♖': case '♜':
            generateSlidingMoves([
                {dl:1,dr:0,df:0},{dl:-1,dr:0,df:0}, {dl:0,dr:1,df:0},{dl:0,dr:-1,df:0}, {dl:0,dr:0,df:1},{dl:0,dr:0,df:-1}
            ]);
            break;
        case '♘': case '♞':
            const knightMovesList = [ 
                [0,1,2],[0,1,-2],[0,-1,2],[0,-1,-2], [0,2,1],[0,2,-1],[0,-2,1],[0,-2,-1],
                [1,0,2],[1,0,-2],[-1,0,2],[-1,0,-2], [2,0,1],[2,0,-1],[-2,0,1],[-2,0,-1],
                [1,2,0],[1,-2,0],[-1,2,0],[-1,-2,0], [2,1,0],[2,-1,0],[-2,1,0],[-2,-1,0]
            ];
            knightMovesList.forEach(m => addMove(fromL + m[0], fromR + m[1], fromF + m[2], false));
            break;
        case '♗': case '♝':
            const bishopDirections = [
                {dl:0,dr:1,df:1},{dl:0,dr:1,df:-1},{dl:0,dr:-1,df:1},{dl:0,dr:-1,df:-1}, 
                {dl:1,dr:0,df:1},{dl:1,dr:0,df:-1},{dl:-1,dr:0,df:1},{dl:-1,dr:0,df:-1}, 
                {dl:1,dr:1,df:0},{dl:1,dr:-1,df:0},{dl:-1,dr:1,df:0},{dl:-1,dr:-1,df:0}, 
                {dl:1,dr:1,df:1},{dl:1,dr:1,df:-1},{dl:1,dr:-1,df:1},{dl:1,dr:-1,df:-1}, 
                {dl:-1,dr:1,df:1},{dl:-1,dr:1,df:-1},{dl:-1,dr:-1,df:1},{dl:-1,dr:-1,df:-1}
            ];
            generateSlidingMoves(bishopDirections.filter((v,i,a)=>a.findIndex(t=>(t.dl===v.dl && t.dr===v.dr && t.df===v.df))===i));
            break;
        case '♕': case '♛':
            const queenDirections = [
                {dl:1,dr:0,df:0},{dl:-1,dr:0,df:0},{dl:0,dr:1,df:0},{dl:0,dr:-1,df:0},{dl:0,dr:0,df:1},{dl:0,dr:0,df:-1}, 
                {dl:0,dr:1,df:1},{dl:0,dr:1,df:-1},{dl:0,dr:-1,df:1},{dl:0,dr:-1,df:-1}, 
                {dl:1,dr:0,df:1},{dl:1,dr:0,df:-1},{dl:-1,dr:0,df:1},{dl:-1,dr:0,df:-1}, 
                {dl:1,dr:1,df:0},{dl:1,dr:-1,df:0},{dl:-1,dr:1,df:0},{dl:-1,dr:-1,df:0}, 
                {dl:1,dr:1,df:1},{dl:1,dr:1,df:-1},{dl:1,dr:-1,df:1},{dl:1,dr:-1,df:-1}, 
                {dl:-1,dr:1,df:1},{dl:-1,dr:1,df:-1},{dl:-1,dr:-1,df:1},{dl:-1,dr:-1,df:-1}
            ];
            generateSlidingMoves(queenDirections.filter((v,i,a)=>a.findIndex(t=>(t.dl===v.dl && t.dr===v.dr && t.df===v.df))===i));
            break;
        case '♔': case '♚':
            for (let dl = -1; dl <= 1; dl++) {
                for (let dr = -1; dr <= 1; dr++) {
                    for (let df = -1; df <= 1; df++) {
                        if (dl === 0 && dr === 0 && df === 0) continue;
                        addMove(fromL + dl, fromR + dr, fromF + df, false);
                    }
                }
            }
            break;
    }
    return moves;
}

function isSquareAttacked(targetL, targetR, targetF, attackerColor, currentBoard) {
    for (let l_atk = 0; l_atk < NUM_LEVELS; l_atk++) for (let r_atk = 0; r_atk < NUM_RANKS; r_atk++) for (let f_atk = 0; f_atk < NUM_FILES; f_atk++) {
        const piece = currentBoard[l_atk][r_atk][f_atk];
        if (piece && piece.color === attackerColor) {
            if (PIECE_TYPES.PAWN.includes(piece.type)) {
                const pawnMoveDirAttacker = piece.color === 'white' ? 1 : -1;
                const S_l_attacker = l_atk + pawnMoveDirAttacker; 
                if (S_l_attacker === targetL) { 
                    const captureCandidates = [
                        { dr: 1, df: 0 }, { dr: -1, df: 0 },
                        { dr: 0, df: 1 }, { dr: 0, df: -1 }
                    ];
                    for (const cand of captureCandidates) {
                        if (r_atk + cand.dr === targetR && f_atk + cand.df === targetF) {
                            return true; 
                        }
                    }
                }
            } else { 
                const attackingMoves = getValidMovesForPiece(piece, l_atk, r_atk, f_atk, currentBoard);
                // Check if any generated move is a capture to the target square.
                // For sliding pieces, isCapture might be false if the path is clear but it could capture if an opponent was there.
                // For king safety, we need to know if the square *could* be captured.
                // getValidMovesForPiece sets isCapture correctly if an opponent is on the target square.
                if (attackingMoves.some(move => move.l === targetL && move.r === targetR && move.f === targetF)) {
                    // If piece is a knight or king, any move is a potential attack.
                    // If piece is sliding, and an opponent is on targetL,R,F, getValidMoves... will mark it as isCapture:true
                    // If piece is sliding, and targetL,R,F is empty but on its path, isCapture:false. But it still "attacks" the square.
                    return true; 
                }
            }
        }
    }
    return false;
}
function updateAllKingCheckStatus() { 
    for (let l = 0; l < NUM_LEVELS; l++) for (let r = 0; r < NUM_RANKS; r++) for (let f = 0; f < NUM_FILES; f++) {
        const cellDiv = cellElements[l][r][f];
        if (cellDiv) { const indicator = cellDiv.querySelector('.check-indicator'); if (indicator) indicator.remove(); cellDiv.classList.remove('king-in-check'); }
    }
    kingsData.white.concat(kingsData.black).forEach(kingInfo => {
        const kingOnBoard = boardState[kingInfo.l][kingInfo.r][kingInfo.f];
        if (!kingOnBoard || kingOnBoard.id !== kingInfo.id) return; 
        const opponentColor = (kingInfo.pieceRef.color === 'white') ? 'black' : 'white';
        if (isSquareAttacked(kingInfo.l, kingInfo.r, kingInfo.f, opponentColor, boardState)) {
            const kingCell = cellElements[kingInfo.l][kingInfo.r][kingInfo.f];
            if (kingCell) { const ind = document.createElement('span'); ind.classList.add('check-indicator'); ind.textContent = '!'; kingCell.appendChild(ind); kingCell.classList.add('king-in-check');}
        }
    });
}
function checkWinCondition() { 
    if (gameOver) return;
    if (kingsData.white.length === 0) { gameStatusMessageEl.textContent = "Black Wins! All White Kings captured."; gameStatusMessageEl.className = "status-box win-black"; gameOver = true; }
    else if (kingsData.black.length === 0) { gameStatusMessageEl.textContent = "White Wins! All Black Kings captured."; gameStatusMessageEl.className = "status-box win-white"; gameOver = true; }
    if (gameOver) { selectionInfoEl.textContent = "Game Over."; clearSelectionAndHighlights(); }
}
function getLevelName(idx) { 
    if (idx === 0) return "White Pieces L0"; if (idx === 1) return "White Pawns L1";
    if (idx >= 2 && idx <= 5) return `Empty L${idx}`;
    if (idx === 6) return "Black Pawns L6"; if (idx === 7) return "Black Pieces L7";
    return "Unknown";
}
function zoom(delta) { 
    if (gameOver && delta !== 0) return;
    const MIN_ZOOM = 0.3, MAX_ZOOM = 1.5;
    currentZoom = Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, currentZoom + delta));
    updateBoardTransform();
}

function updateBoardTransform() {
    if (!gameArea || !boardDisplay || !boardWrapper) return; 

    const gameAreaRect = gameArea.getBoundingClientRect();
    let visualBoardWidth, visualBoardHeight;

    if (adjustLayersToFitZoom) {
        boardDisplay.style.width = `${BASE_BOARD_WIDTH}px`; 
        boardDisplay.style.height = `${BASE_BOARD_HEIGHT}px`; 
        boardDisplay.style.transform = `rotateX(${boardRotation.x}deg) rotateY(${boardRotation.y}deg) rotateZ(${boardRotation.z}deg) scale(${currentZoom})`;
        
        visualBoardWidth = BASE_BOARD_WIDTH * currentZoom;
        visualBoardHeight = BASE_BOARD_HEIGHT * currentZoom;
    } else {
        boardDisplay.style.width = `${BASE_BOARD_WIDTH * currentZoom}px`;
        boardDisplay.style.height = `${BASE_BOARD_HEIGHT * currentZoom}px`;
        boardDisplay.style.transform = `rotateX(${boardRotation.x}deg) rotateY(${boardRotation.y}deg) rotateZ(${boardRotation.z}deg)`;

        visualBoardWidth = boardDisplay.offsetWidth; 
        visualBoardHeight = boardDisplay.offsetHeight; 
    }

    boardWrapper.style.left = `${(gameAreaRect.width / 2) - (visualBoardWidth / 2) + boardPan.x}px`;
    boardWrapper.style.top = `${(gameAreaRect.height / 2) - (visualBoardHeight / 2) + boardPan.y}px`;
}
