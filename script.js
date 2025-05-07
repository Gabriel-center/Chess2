// --- CONSTANTS & CONFIG ---
const NUM_LEVELS = 8;
const NUM_RANKS = 8;
const NUM_FILES = 8;
const LEVEL_DEPTH_OFFSET = 30;
const E = null;

const PIECE_TYPES = { KING: '♔♚', QUEEN: '♕♛', ROOK: '♖♜', BISHOP: '♗♝', KNIGHT: '♘♞', PAWN: '♙♟' };
const PROMOTION_PIECE = { white: '♕', black: '♛' };
const PAWN_START_LEVEL = { white: 1, black: 6 }; // Level index (0-7)

// --- DOM Elements ---
let gameArea, boardWrapper, boardDisplay, layerSlider, focusedLayerValueEl, currentLayerNameEl,
    opacitySlider, offLayerOpacityValueEl, highlightOpaqueCheckbox, currentPlayerEl,
    selectionInfoEl, zoomInBtn, zoomOutBtn, gameStatusMessageEl, resetGameBtn;

// --- Game State ---
let boardState = [];
let currentPlayer = 'white';
let selectedPieceInfo = null;
let currentPhase = 'select-piece';
let activeFocusLayerIndex = 0;
let currentZoom = 0.7;
const boardRotation = { x: 50, y: 0, z: -45 };
let offLayerOpacity = 0.1;
let highlightedMoves = []; // Stores {l, r, f, isCapture}
let cellElements = []; // Stores cell div references: cellElements[l][r][f]
let kingsData = { white: [], black: [] };
let gameOver = false;
let boardPan = { x: 0, y: 0 };
let isPanning = false;
let panStart = { x: 0, y: 0, initialBoardX: 0, initialBoardY: 0 };

document.addEventListener('DOMContentLoaded', () => {
    initializeDOMElements();
    startGame();
    addEventListeners();
});

function startGame() {
    gameOver = false;
    currentPlayer = 'white';
    currentPhase = 'select-piece';
    boardPan = { x: 0, y: 0 };
    selectedPieceInfo = null;
    highlightedMoves = [];
    
    initializeBoardStateAndKings();
    if (cellElements.length === 0) {
        createBoardGUI();
    } else {
        refreshFullBoardGUI();
    }
    updateInitialUI();
    updateBoardTransform();
}

function initializeDOMElements() {
    gameArea = document.getElementById('game-area');
    boardWrapper = document.getElementById('board-wrapper');
    boardDisplay = document.getElementById('board-display-isometric');
    layerSlider = document.getElementById('layer-slider');
    focusedLayerValueEl = document.getElementById('focused-layer-value');
    currentLayerNameEl = document.getElementById('current-layer-name');
    opacitySlider = document.getElementById('opacity-slider');
    offLayerOpacityValueEl = document.getElementById('off-layer-opacity-value');
    highlightOpaqueCheckbox = document.getElementById('highlight-opaque-checkbox');
    currentPlayerEl = document.getElementById('current-player');
    selectionInfoEl = document.getElementById('selection-info');
    zoomInBtn = document.getElementById('zoom-in-btn');
    zoomOutBtn = document.getElementById('zoom-out-btn');
    gameStatusMessageEl = document.getElementById('game-status-message');
    resetGameBtn = document.getElementById('reset-game-btn');
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
    if (PIECE_TYPES.KING.includes(type)) {
        kingsData[color].push({ l: level, r: rank, f: file, id: piece.id, pieceRef: piece });
    }
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
        layerDiv.style.transform = `translateZ(${l * LEVEL_DEPTH_OFFSET}px)`;
        for (let r_grid = 0; r_grid < NUM_RANKS; r_grid++) {
            let r_board = NUM_RANKS - 1 - r_grid;
            for (let f_board = 0; f_board < NUM_FILES; f_board++) {
                const cellDiv = document.createElement('div');
                cellDiv.classList.add('cell');
                if ((f_board + r_board + l) % 2 === 0) cellDiv.classList.add('cell-light');
                else cellDiv.classList.add('cell-dark');
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
    layerSlider.addEventListener('input', () => {
        focusedLayerValueEl.textContent = layerSlider.value;
        handleLayerAndHighlightUpdate();
    });
    opacitySlider.addEventListener('input', () => {
        offLayerOpacity = parseInt(opacitySlider.value) / 100;
        offLayerOpacityValueEl.textContent = opacitySlider.value;
        handleLayerAndHighlightUpdate();
    });
    highlightOpaqueCheckbox.addEventListener('change', handleLayerAndHighlightUpdate);
    zoomInBtn.addEventListener('click', () => zoom(0.1));
    zoomOutBtn.addEventListener('click', () => zoom(-0.1));
    resetGameBtn.addEventListener('click', startGame);
    gameArea.addEventListener('mousedown', onPanStart);
    document.addEventListener('mousemove', onPanMove);
    document.addEventListener('mouseup', onPanEnd);
    document.addEventListener('keydown', handleArrowKeys);
}

function updateInitialUI() {
    layerSlider.value = 0; activeFocusLayerIndex = 0;
    focusedLayerValueEl.textContent = layerSlider.value;
    opacitySlider.value = offLayerOpacity * 100;
    offLayerOpacityValueEl.textContent = opacitySlider.value;
    currentPlayerEl.textContent = currentPlayer.charAt(0).toUpperCase() + currentPlayer.slice(1);
    gameStatusMessageEl.textContent = "Game in progress...";
    gameStatusMessageEl.className = "status-box";
    clearSelectionAndHighlights(); //This will call handleLayerAndHighlightUpdate
    // handleLayerAndHighlightUpdate(); // Called by clearSelectionAndHighlights
    updateAllKingCheckStatus();
}

function handleArrowKeys(event) {
    if (gameOver) return;
    let newLevel = parseInt(layerSlider.value);
    if (event.key === 'ArrowUp') {
        newLevel = Math.min(7, newLevel + 1); event.preventDefault();
    } else if (event.key === 'ArrowDown') {
        newLevel = Math.max(0, newLevel - 1); event.preventDefault();
    } else { return; }
    if (newLevel !== parseInt(layerSlider.value)) {
        layerSlider.value = newLevel;
        focusedLayerValueEl.textContent = newLevel;
        handleLayerAndHighlightUpdate();
    }
}

function onPanStart(event) {
    if (event.target.closest('#board-wrapper') || event.target.closest('#instructions-details')) return;
    isPanning = true;
    panStart.x = event.clientX; panStart.y = event.clientY;
    panStart.initialBoardX = boardPan.x; panStart.initialBoardY = boardPan.y;
    gameArea.classList.add('grabbing'); event.preventDefault();
}
function onPanMove(event) {
    if (!isPanning) return;
    boardPan.x = panStart.initialBoardX + (event.clientX - panStart.x);
    boardPan.y = panStart.initialBoardY + (event.clientY - panStart.y);
    updateBoardTransform();
}
function onPanEnd() { if (isPanning) { isPanning = false; gameArea.classList.remove('grabbing');} }

function onCellClickManager(l_cell, r_cell, f_cell, cellDiv_clicked, event) {
    if (gameOver || isPanning) return;
    
    // Determine effectiveL: If the clicked cell is a "force-opaque-clickable-highlight", its own layer (l_cell) is the effective layer.
    // Otherwise, interaction is on the activeFocusLayerIndex.
    const isForceOpaqueClickable = cellDiv_clicked.style.pointerEvents === 'auto' && l_cell !== activeFocusLayerIndex;
    const effectiveL = isForceOpaqueClickable ? l_cell : activeFocusLayerIndex;

    // If the click was on a cell whose actual layer (l_cell) doesn't match the derived effectiveL,
    // and it wasn't a force-opaque clickable highlight, then it's a click on a non-interactive part.
    if (l_cell !== effectiveL && !isForceOpaqueClickable) {
        return;
    }

    const pieceOnCell = boardState[effectiveL][r_cell][f_cell];

    if (currentPhase === 'select-piece') {
        if (pieceOnCell && pieceOnCell.color === currentPlayer) {
            selectPiece(effectiveL, r_cell, f_cell, pieceOnCell, cellDiv_clicked);
        }
    } else if (currentPhase === 'select-destination') {
        const { piece: movingPiece, fromL, fromR, fromF } = selectedPieceInfo;
        if (effectiveL === fromL && r_cell === fromR && f_cell === fromF) {
            clearSelectionAndHighlights(); return;
        }
        const isValidTargetMove = highlightedMoves.find(m => m.l === effectiveL && m.r === r_cell && m.f === f_cell);
        if (isValidTargetMove) {
            const capturedPiece = boardState[effectiveL][r_cell][f_cell];
            if (capturedPiece && PIECE_TYPES.KING.includes(capturedPiece.type)) {
                kingsData[capturedPiece.color] = kingsData[capturedPiece.color].filter(k => k.id !== capturedPiece.id);
            }
            boardState[effectiveL][r_cell][f_cell] = movingPiece;
            boardState[fromL][fromR][fromF] = E;
            movingPiece.hasMoved = true;

            const promotionLevel = movingPiece.color === 'white' ? 7 : 0;
            if (PIECE_TYPES.PAWN.includes(movingPiece.type) && effectiveL === promotionLevel) {
                movingPiece.type = PROMOTION_PIECE[movingPiece.color];
            }

            if (PIECE_TYPES.KING.includes(movingPiece.type)) {
                const kingIdx = kingsData[movingPiece.color].findIndex(k => k.id === movingPiece.id);
                if (kingIdx !== -1) { kingsData[movingPiece.color][kingIdx].l = effectiveL; kingsData[movingPiece.color][kingIdx].r = r_cell; kingsData[movingPiece.color][kingIdx].f = f_cell; }
            }
            updateCellGUI(effectiveL, r_cell, f_cell); updateCellGUI(fromL, fromR, fromF);
            currentPlayer = (currentPlayer === 'white') ? 'black' : 'white';
            currentPlayerEl.textContent = currentPlayer.charAt(0).toUpperCase() + currentPlayer.slice(1);
            clearSelectionAndHighlights();
            updateAllKingCheckStatus();
            checkWinCondition();
        } else {
            selectionInfoEl.textContent = "Invalid move target. Click a highlighted square or re-select piece.";
        }
    }
}

function selectPiece(l, r, f, piece, cellDiv) {
    clearSelectionAndHighlights(); 
    selectedPieceInfo = { piece, fromL: l, fromR: r, fromF: f, cellDiv };
    // Don't add 'selected-piece-cell' class here. handleLayerAndHighlightUpdate will do it if needed.
    currentPhase = 'select-destination';
    highlightedMoves = getValidMovesForPiece(piece, l, r, f, boardState);
    handleLayerAndHighlightUpdate(); // This will apply highlights and update selection text.
}

function clearSelectionAndHighlights() {
    if (selectedPieceInfo && selectedPieceInfo.cellDiv) {
        selectedPieceInfo.cellDiv.classList.remove('selected-piece-cell');
    }
    selectedPieceInfo = null;
    currentPhase = 'select-piece';
    // highlightedMoves list itself is cleared before handleLayerAndHighlightUpdate re-evaluates
    // The visual clearing of highlights now happens at the start of handleLayerAndHighlightUpdate
    highlightedMoves = []; 
    handleLayerAndHighlightUpdate(); // This will clear visuals and set default text
}

function handleLayerAndHighlightUpdate() {
    activeFocusLayerIndex = parseInt(layerSlider.value);
    currentLayerNameEl.textContent = `Level ${activeFocusLayerIndex}: ${getLevelName(activeFocusLayerIndex)}`;
    const forceOpaqueClickableHighlights = highlightOpaqueCheckbox.checked;

    // 1. Reset all cells and layers
    for (let l_idx = 0; l_idx < NUM_LEVELS; l_idx++) {
        const layerDiv = document.getElementById(`layer-${l_idx}`);
        if (!layerDiv) continue;
        // Layer div itself is always opaque for children to control their own opacity
        layerDiv.style.opacity = '1'; 
        layerDiv.style.pointerEvents = (l_idx === activeFocusLayerIndex) ? 'auto' : 'none';
        layerDiv.style.zIndex = (l_idx === activeFocusLayerIndex) ? NUM_LEVELS + 1 : l_idx;

        for (let r_idx = 0; r_idx < NUM_RANKS; r_idx++) {
            for (let f_idx = 0; f_idx < NUM_FILES; f_idx++) {
                const cell = cellElements[l_idx][r_idx][f_idx];
                if (!cell) continue;
                cell.classList.remove('valid-move-highlight', 'capture-move-highlight', 'selected-piece-cell', 'force-opaque-clickable-highlight');
                cell.style.opacity = ''; // Reset inline opacity
                cell.style.pointerEvents = ''; // Reset inline pointer-events
                
                // Default for off-focus cells: use offLayerOpacity
                if (l_idx !== activeFocusLayerIndex) {
                    cell.style.opacity = offLayerOpacity.toString();
                    cell.style.pointerEvents = 'none';
                } else { // On active focus layer, default is opaque and interactive
                    cell.style.opacity = '1';
                    cell.style.pointerEvents = 'auto';
                }
            }
        }
    }
    
    // 2. Apply selected piece style (if any)
    if (selectedPieceInfo && selectedPieceInfo.cellDiv) {
        selectedPieceInfo.cellDiv.classList.add('selected-piece-cell');
        // Ensure selected piece cell itself is fully opaque and interactive if it was on an off-layer
        // (though selection typically happens on active layer)
        selectedPieceInfo.cellDiv.style.opacity = '1';
        selectedPieceInfo.cellDiv.style.pointerEvents = 'auto';
    }

    // 3. Apply highlights for possible moves (if any)
    if (currentPhase === 'select-destination') {
        highlightedMoves.forEach(move => {
            const targetCellDiv = cellElements[move.l][move.r][move.f];
            if (targetCellDiv) {
                targetCellDiv.classList.add(move.isCapture ? 'capture-move-highlight' : 'valid-move-highlight');

                if (move.l === activeFocusLayerIndex) {
                    targetCellDiv.style.opacity = '1'; // Already on active layer
                    targetCellDiv.style.pointerEvents = 'auto';
                } else { // Highlight is on an off-focus layer
                    if (forceOpaqueClickableHighlights) {
                        targetCellDiv.style.opacity = '1.0'; // Full opacity
                        targetCellDiv.style.pointerEvents = 'auto';
                        // targetCellDiv.classList.add('force-opaque-clickable-highlight'); // CSS can also do this
                    } else {
                        // Highlighted, but on off-layer, checkbox is OFF.
                        // Takes `offLayerOpacity` (already set for non-active cells), background shows through.
                        targetCellDiv.style.pointerEvents = 'none'; // Not clickable
                    }
                }
            }
        });
    }

    // 4. Update selection info text
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
            // Always add if it's an enemy, regardless of isCaptureIntent (for sliding/jumping pieces)
            // isCaptureIntent helps pawn differentiate its move types.
            moves.push({ l: toL, r: toR, f: toF, isCapture: true });
            return { added: true, canContinueSlide: false };
        }
        return { added: false, canContinueSlide: false }; // Blocked by own piece
    };
    
    const generateSlidingMoves = (dirs) => {
        for (const dir of dirs) {
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
                addMove(normalMoveL1, fromR, fromF, false); // Not a capture intent
                if (fromL === startLevel && !piece.hasMoved) { // Check if on actual start level and hasn't moved
                    const normalMoveL2 = fromL + 2 * pawnMoveDir;
                    if (isValid(normalMoveL2, fromR, fromF) && currentBoard[normalMoveL2][fromR][fromF] === E) {
                        addMove(normalMoveL2, fromR, fromF, false);
                    }
                }
            }
            const S_l_capture = fromL + pawnMoveDir;
            if (isValid(S_l_capture, fromR, fromF)) {
                for (let dr_cap = -1; dr_cap <= 1; dr_cap++) {
                    for (let df_cap = -1; df_cap <= 1; df_cap++) {
                        if (dr_cap === 0 && df_cap === 0) continue;
                        const captureTargetR = fromR + dr_cap;
                        const captureTargetF = fromF + df_cap;
                        if (isValid(S_l_capture, captureTargetR, captureTargetF)) {
                            const potentialVictim = currentBoard[S_l_capture][captureTargetR][captureTargetF];
                            if (potentialVictim && potentialVictim.color !== pieceColor) {
                                addMove(S_l_capture, captureTargetR, captureTargetF, true); // True: this is a capture-only move
                            }
                        }
                    }
                }
            }
            break;
        case '♖': case '♜':
            generateSlidingMoves([ {dl:1,dr:0,df:0},{dl:-1,dr:0,df:0}, {dl:0,dr:1,df:0},{dl:0,dr:-1,df:0}, {dl:0,dr:0,df:1},{dl:0,dr:0,df:-1} ]);
            break;
        case '♘': case '♞':
            [ [0,1,2],[0,1,-2],[0,-1,2],[0,-1,-2], [0,2,1],[0,2,-1],[0,-2,1],[0,-2,-1], [1,0,2],[1,0,-2],[-1,0,2],[-1,0,-2], [2,0,1],[2,0,-1],[-2,0,1],[-2,0,-1], [1,2,0],[1,-2,0],[-1,2,0],[-1,-2,0], [2,1,0],[2,-1,0],[-2,1,0],[-2,-1,0] ].forEach(m => addMove(fromL + m[0], fromR + m[1], fromF + m[2], false));
            break;
        case '♗': case '♝':
            generateSlidingMoves([ {dl:0,dr:1,df:1},{dl:0,dr:1,df:-1},{dl:0,dr:-1,df:1},{dl:0,dr:-1,df:-1}, {dl:1,dr:0,df:1},{dl:1,dr:0,df:-1},{dl:-1,dr:0,df:1},{dl:-1,dr:0,df:-1}, {dl:1,dr:1,df:0},{dl:1,dr:-1,df:0},{dl:-1,dr:1,df:0},{dl:-1,dr:-1,df:0}, {dl:1,dr:1,df:1},{dl:1,dr:1,df:-1},{dl:1,dr:-1,df:1},{dl:1,dr:-1,df:-1}, {dl:-1,dr:1,df:1},{dl:-1,dr:1,df:-1},{dl:-1,dr:-1,df:1},{dl:-1,dr:-1,df:-1} ].filter((v,i,a)=>a.findIndex(t=>(t.dl===v.dl && t.dr===v.dr && t.df===v.df))===i));
            break;
        case '♕': case '♛':
            generateSlidingMoves([ {dl:1,dr:0,df:0},{dl:-1,dr:0,df:0},{dl:0,dr:1,df:0},{dl:0,dr:-1,df:0},{dl:0,dr:0,df:1},{dl:0,dr:0,df:-1}, {dl:0,dr:1,df:1},{dl:0,dr:1,df:-1},{dl:0,dr:-1,df:1},{dl:0,dr:-1,df:-1}, {dl:1,dr:0,df:1},{dl:1,dr:0,df:-1},{dl:-1,dr:0,df:1},{dl:-1,dr:0,df:-1}, {dl:1,dr:1,df:0},{dl:1,dr:-1,df:0},{dl:-1,dr:1,df:0},{dl:-1,dr:-1,df:0}, {dl:1,dr:1,df:1},{dl:1,dr:1,df:-1},{dl:1,dr:-1,df:1},{dl:1,dr:-1,df:-1}, {dl:-1,dr:1,df:1},{dl:-1,dr:1,df:-1},{dl:-1,dr:-1,df:1},{dl:-1,dr:-1,df:-1} ].filter((v,i,a)=>a.findIndex(t=>(t.dl===v.dl && t.dr===v.dr && t.df===v.df))===i));
            break;
        case '♔': case '♚':
            for (let dl = -1; dl <= 1; dl++) for (let dr = -1; dr <= 1; dr++) for (let df = -1; df <= 1; df++) {
                if (dl === 0 && dr === 0 && df === 0) continue;
                addMove(fromL + dl, fromR + dr, fromF + df, false);
            }
            break;
    }
    return moves;
}

function isSquareAttacked(targetL, targetR, targetF, attackerColor, currentBoard) {
    // ... (same as previous full script, ensure pawn attack logic is consistent with getValidMoves) ...
    for (let l_atk = 0; l_atk < NUM_LEVELS; l_atk++) for (let r_atk = 0; r_atk < NUM_RANKS; r_atk++) for (let f_atk = 0; f_atk < NUM_FILES; f_atk++) {
        const piece = currentBoard[l_atk][r_atk][f_atk];
        if (piece && piece.color === attackerColor) {
            if (PIECE_TYPES.PAWN.includes(piece.type)) {
                const pawnMoveDirAttacker = piece.color === 'white' ? 1 : -1;
                const S_l_attacker = l_atk + pawnMoveDirAttacker;
                if (S_l_attacker === targetL) { 
                    if (Math.abs(targetR - r_atk) <= 1 && Math.abs(targetF - f_atk) <= 1 && (targetR !==r_atk || targetF !==f_atk)) {
                        return true; 
                    }
                }
            } else {
                const attackingMoves = getValidMovesForPiece(piece, l_atk, r_atk, f_atk, currentBoard);
                if (attackingMoves.some(move => move.l === targetL && move.r === targetR && move.f === targetF)) {
                    return true;
                }
            }
        }
    }
    return false;
}

function updateAllKingCheckStatus() { /* ... same as previous full script ... */
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
function checkWinCondition() { /* ... same as previous full script ... */
    if (gameOver) return;
    if (kingsData.white.length === 0) { gameStatusMessageEl.textContent = "Black Wins! All White Kings captured."; gameStatusMessageEl.className = "status-box win-black"; gameOver = true; }
    else if (kingsData.black.length === 0) { gameStatusMessageEl.textContent = "White Wins! All Black Kings captured."; gameStatusMessageEl.className = "status-box win-white"; gameOver = true; }
    if (gameOver) { selectionInfoEl.textContent = "Game Over."; clearSelectionAndHighlights(); }
}
function getLevelName(idx) { /* ... same as previous full script ... */
    if (idx === 0) return "White Pieces L0"; if (idx === 1) return "White Pawns L1";
    if (idx >= 2 && idx <= 5) return `Empty L${idx}`;
    if (idx === 6) return "Black Pawns L6"; if (idx === 7) return "Black Pieces L7";
    return "Unknown";
}
function zoom(delta) { /* ... same as previous full script ... */
    if (gameOver && delta !== 0) return;
    const MIN_ZOOM = 0.3, MAX_ZOOM = 1.5;
    currentZoom = Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, currentZoom + delta));
    updateBoardTransform();
}
function updateBoardTransform() { /* ... same as previous full script ... */
    const gameAreaRect = gameArea.getBoundingClientRect();
    const visualBoardWidth = boardDisplay.offsetWidth * currentZoom;
    const visualBoardHeight = boardDisplay.offsetHeight * currentZoom;
    boardWrapper.style.left = `${(gameAreaRect.width / 2) - (visualBoardWidth / 2) + boardPan.x}px`;
    boardWrapper.style.top = `${(gameAreaRect.height / 2) - (visualBoardHeight / 2) + boardPan.y}px`;
    boardDisplay.style.transform = `rotateX(${boardRotation.x}deg) rotateY(${boardRotation.y}deg) rotateZ(${boardRotation.z}deg) scale(${currentZoom})`;
}