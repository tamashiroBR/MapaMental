// ===== GLOBAL VARIABLES =====
let canvas, ctx, minimapCanvas, minimapCtx;
let mindMapData = null;
let selectedNodeId = null;
let selectedNodeIds = new Set();
let isDraggingNode = false;
let dragStart = { x: 0, y: 0 };
let viewport = { scale: 1, offsetX: 0, offsetY: 0 };
let history = [];
let historyIndex = -1;
let collapsedNodes = new Set();
let clipboard = null;
let isPanning = false;
let isSelectionBox = false;
let selectionStart = {};
let selectionEnd = {};
let addNodeType = 'child';
let connectionStyle = 'curve';
let searchResults = [];
let searchIndex = -1;

const COLORS = [
    '#3498db', '#e74c3c', '#27ae60', '#f39c12', '#9b59b6',
    '#1abc9c', '#e67e22', '#2980b9', '#c0392b', '#16a085'
];

const ICONS = ['💡', '⭐', '❤️', '🎯', '🚀', '📌', '🔥', '✅', '❌', '⚡', 
                '📝', '📊', '🎨', '🔧', '💰', '🏆', '🎉', '⏰', '📅', '🔔',
                '👤', '👥', '💼', '📁', '🔒', '🔑', '💎', '🌟', '🎵', '📷'];

// ===== INITIALIZATION =====
function init() {
    canvas = document.getElementById('canvas');
    ctx = canvas.getContext('2d');
    
    resizeCanvas();
    loadSampleData();
    setupEventListeners();
    populateIconGrid();
    updateStatusBar();
    loadThemePreference();
}

function resizeCanvas() {
    const container = canvas.parentElement;
    canvas.width = container.offsetWidth;
    canvas.height = container.offsetHeight;
    render();
}

function setupEventListeners() {
    canvas.addEventListener('mousedown', handleMouseDown);
    canvas.addEventListener('mousemove', handleMouseMove);
    canvas.addEventListener('mouseup', handleMouseUp);
    canvas.addEventListener('wheel', handleWheel, { passive: false });
    canvas.addEventListener('dblclick', handleDoubleClick);
    canvas.addEventListener('contextmenu', handleContextMenu);
    
    document.addEventListener('keydown', handleKeyDown);
    document.addEventListener('click', handleDocumentClick);
    window.addEventListener('resize', resizeCanvas);
    
    // Modal enter key
    document.getElementById('newNodeLabel').addEventListener('keydown', (e) => {
        if (e.key === 'Enter') addNode();
    });
}

function populateIconGrid() {
    const grid = document.getElementById('iconGrid');
    grid.innerHTML = ICONS.map(icon => 
        `<div class="icon-item" onclick="selectIcon('${icon}')">${icon}</div>`
    ).join('');
}

// ===== DATA MANAGEMENT =====
function loadSampleData() {
    mindMapData = {
        root: {
            id: 'root',
            label: 'Projeto Principal',
            icon: '🎯',
            x: 400, y: 300,
            width: 180, height: 80,
            color: '#3498db',
            textColor: '#ffffff',
            textSize: 16,
            notes: 'Este é o nó principal do mapa mental.',
            shape: 'rounded-rect',
            priority: '',
            children: [
                {
                    id: 'n1',
                    label: 'Planejamento',
                    icon: '📋',
                    x: 150, y: 180,
                    width: 140, height: 60,
                    color: '#27ae60',
                    textColor: '#ffffff',
                    textSize: 14,
                    notes: '',
                    shape: 'rounded-rect',
                    priority: 'high',
                    parentId: 'root',
                    children: [
                        {
                            id: 'n1-1',
                            label: 'Definir Escopo',
                            icon: '',
                            x: 50, y: 80,
                            width: 120, height: 50,
                            color: '#2ecc71',
                            textColor: '#ffffff',
                            textSize: 12,
                            notes: '',
                            shape: 'rounded-rect',
                            priority: '',
                            parentId: 'n1',
                            children: []
                        },
                        {
                            id: 'n1-2',
                            label: 'Cronograma',
                            icon: '📅',
                            x: 250, y: 50,
                            width: 120, height: 50,
                            color: '#2ecc71',
                            textColor: '#ffffff',
                            textSize: 12,
                            notes: '',
                            shape: 'rounded-rect',
                            priority: 'medium',
                            parentId: 'n1',
                            children: []
                        }
                    ]
                },
                {
                    id: 'n2',
                    label: 'Execução',
                    icon: '🚀',
                    x: 650, y: 180,
                    width: 140, height: 60,
                    color: '#e74c3c',
                    textColor: '#ffffff',
                    textSize: 14,
                    notes: '',
                    shape: 'rounded-rect',
                    priority: '',
                    parentId: 'root',
                    children: []
                },
                {
                    id: 'n3',
                    label: 'Monitoramento',
                    icon: '📊',
                    x: 150, y: 420,
                    width: 140, height: 60,
                    color: '#f39c12',
                    textColor: '#ffffff',
                    textSize: 14,
                    notes: '',
                    shape: 'rounded-rect',
                    priority: '',
                    parentId: 'root',
                    children: []
                },
                {
                    id: 'n4',
                    label: 'Encerramento',
                    icon: '✅',
                    x: 650, y: 420,
                    width: 140, height: 60,
                    color: '#9b59b6',
                    textColor: '#ffffff',
                    textSize: 14,
                    notes: '',
                    shape: 'rounded-rect',
                    priority: 'low',
                    parentId: 'root',
                    children: []
                }
            ]
        },
        connections: []
    };
    
    // Build connections from parent-child relationships
    rebuildConnections();
    saveToHistory();
    render();
}

function rebuildConnections() {
    mindMapData.connections = [];
    
    function traverse(node) {
        node.children.forEach(child => {
            mindMapData.connections.push({
                from: node.id,
                to: child.id,
                color: child.color
            });
            traverse(child);
        });
    }
    
    traverse(mindMapData.root);
}

function findNodeById(node, id) {
    if (node.id === id) return node;
    for (let child of node.children) {
        const found = findNodeById(child, id);
        if (found) return found;
    }
    return null;
}

function findParentNode(node, targetId, parent = null) {
    if (node.id === targetId) return parent;
    for (let child of node.children) {
        const found = findParentNode(child, targetId, node);
        if (found) return found;
    }
    return null;
}

function getAllNodes(node = mindMapData.root) {
    let nodes = [node];
    node.children.forEach(child => {
        nodes = nodes.concat(getAllNodes(child));
    });
    return nodes;
}

function countNodes(node = mindMapData.root) {
    let count = 1;
    node.children.forEach(child => {
        count += countNodes(child);
    });
    return count;
}

function getMaxDepth(node = mindMapData.root, depth = 0) {
    let maxDepth = depth;
    node.children.forEach(child => {
        maxDepth = Math.max(maxDepth, getMaxDepth(child, depth + 1));
    });
    return maxDepth;
}

// ===== RENDERING =====

// Função auxiliar para verificar se um nó ou algum ancestral está colapsado
function isNodeOrAncestorCollapsed(nodeId) {
    if (!nodeId) return false;
    
    // Verificar se este nó está colapsado
    if (collapsedNodes.has(nodeId)) return true;
    
    // Se é o nó raiz e não está colapsado, retornar false
    if (nodeId === 'root') return false;
    
    // Encontrar o nó e verificar seu pai recursivamente
    const node = findNodeById(mindMapData.root, nodeId);
    if (node && node.parentId) {
        return isNodeOrAncestorCollapsed(node.parentId);
    }
    return false;
}

// Função para verificar se a conexão deve ser visível
function isConnectionVisible(conn) {
    const fromNode = findNodeById(mindMapData.root, conn.from);
    const toNode = findNodeById(mindMapData.root, conn.to);
    
    if (!fromNode || !toNode) return false;
    
    // Se o nó de origem está colapsado, não mostrar conexão para seus filhos
    if (collapsedNodes.has(conn.from)) return false;
    
    // Verificar se algum ancestral do nó de origem está colapsado
    if (fromNode.parentId && isNodeOrAncestorCollapsed(fromNode.parentId)) return false;
    
    return true;
}

function render() {
    if (!mindMapData) return;

    const defaultFields = document.getElementById('dimensionFieldsDefault');
    const circleFields = document.getElementById('dimensionFieldsCircle');
    
    defaultFields.style.display = 'flex';
    circleFields.style.display = 'none';
    
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.save();
    ctx.translate(viewport.offsetX, viewport.offsetY);
    ctx.scale(viewport.scale, viewport.scale);
    
    // Draw connections - verificar se a conexão deve ser visível
    mindMapData.connections.forEach(conn => {
        if (isConnectionVisible(conn)) {
            const fromNode = findNodeById(mindMapData.root, conn.from);
            const toNode = findNodeById(mindMapData.root, conn.to);
            drawConnection(fromNode, toNode, conn.color);
        }
    });
    
    // Draw nodes
    drawNodeRecursive(mindMapData.root);
    
    // Draw selection box
    if (isSelectionBox && selectionEnd.x !== undefined) {
        ctx.strokeStyle = '#3498db';
        ctx.lineWidth = 2;
        ctx.setLineDash([5, 5]);
        const x = Math.min(selectionStart.x, selectionEnd.x);
        const y = Math.min(selectionStart.y, selectionEnd.y);
        const w = Math.abs(selectionEnd.x - selectionStart.x);
        const h = Math.abs(selectionEnd.y - selectionStart.y);
        ctx.strokeRect(x, y, w, h);
        ctx.setLineDash([]);
    }
    
    ctx.restore();
    
    //renderMinimap();
    updateStatusBar();
}

function drawNodeRecursive(node) {
    // Verificar se algum ancestral está colapsado
    if (node.parentId && isNodeOrAncestorCollapsed(node.parentId)) return;
    
    drawNode(node);
    
    // Só desenhar filhos se este nó não estiver colapsado
    if (!collapsedNodes.has(node.id)) {
        node.children.forEach(child => drawNodeRecursive(child));
    }
}

function drawNode(node) {
    ctx.save();
    
    // Selection highlight
    const isSelected = node.id === selectedNodeId || selectedNodeIds.has(node.id);
    if (isSelected) {
        ctx.shadowColor = '#3498db';
        ctx.shadowBlur = 15;
        ctx.strokeStyle = '#3498db';
        ctx.lineWidth = 3;
        drawShape(ctx, node.x - 3, node.y - 3, node.width + 6, node.height + 6, node.shape);
        ctx.stroke();
        ctx.shadowBlur = 0;
    }
    
    // Search highlight
    if (searchResults.includes(node.id)) {
        ctx.strokeStyle = '#f39c12';
        ctx.lineWidth = 4;
        ctx.setLineDash([8, 4]);
        drawShape(ctx, node.x - 4, node.y - 4, node.width + 8, node.height + 8, node.shape);
        ctx.stroke();
        ctx.setLineDash([]);
    }
    
    // Node background
    ctx.fillStyle = node.color;
    ctx.strokeStyle = 'rgba(0,0,0,0.1)';
    ctx.lineWidth = 2;
    drawShape(ctx, node.x, node.y, node.width, node.height, node.shape);
    ctx.fill();
    ctx.stroke();
    
    // Priority indicator
    if (node.priority) {
        const priorityColors = { high: '#e74c3c', medium: '#f39c12', low: '#27ae60' };
        ctx.fillStyle = priorityColors[node.priority];
        ctx.beginPath();
        ctx.arc(node.x + 12, node.y + 12, 6, 0, Math.PI * 2);
        ctx.fill();
    }
    
    // Icon and text
    ctx.fillStyle = node.textColor;
    ctx.font = `${node.textSize || 14}px -apple-system, BlinkMacSystemFont, sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    
    const centerX = node.x + node.width / 2;
    const centerY = node.y + node.height / 2;
    
    let displayText = node.label;
    if (node.icon) {
        displayText = node.icon + ' ' + node.label;
    }
    
    // Word wrap
    const lines = wrapText(displayText, node.width - 20);
    const lineHeight = (node.textSize || 14) * 1.3;
    const totalHeight = lines.length * lineHeight;
    const startY = centerY - totalHeight / 2 + lineHeight / 2;
    
    lines.forEach((line, i) => {
        ctx.fillText(line, centerX, startY + i * lineHeight);
    });
    
    // Notes indicator
    if (node.notes && node.notes.trim()) {
        ctx.fillStyle = '#f39c12';
        ctx.beginPath();
        ctx.arc(node.x + node.width - 12, node.y + 12, 8, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#fff';
        ctx.font = 'bold 10px sans-serif';
        ctx.fillText('📝', node.x + node.width - 12, node.y + 12);
    }
    
    // Collapse/Expand button
    if (node.children.length > 0) {
        const btnX = node.x + node.width - 5;
        const btnY = node.y + node.height - 5;
        
        ctx.fillStyle = collapsedNodes.has(node.id) ? '#e74c3c' : '#000000';
        ctx.beginPath();
        ctx.arc(btnX, btnY, 10, 0, Math.PI * 2);
        ctx.fill();
        
        ctx.fillStyle = '#fff';
        ctx.font = 'bold 14px sans-serif';
        ctx.fillText(collapsedNodes.has(node.id) ? '+' : '−', btnX, btnY);
    }
    
    ctx.restore();
}

function drawShape(ctx, x, y, width, height, shape) {
    ctx.beginPath();
    
    switch (shape) {
        case 'circle':
            const radius = width / 2;
            ctx.arc(x + width / 2, y + height / 2, radius, 0, Math.PI * 2);
            break;
        case 'rectangle':
            ctx.rect(x, y, width, height);
            break;
        case 'diamond':
            ctx.moveTo(x + width / 2, y);
            ctx.lineTo(x + width, y + height / 2);
            ctx.lineTo(x + width / 2, y + height);
            ctx.lineTo(x, y + height / 2);
            ctx.closePath();
            break;
        case 'ellipse':
            ctx.ellipse(x + width / 2, y + height / 2, width / 2, height / 2, 0, 0, Math.PI * 2);
            break;
        case 'hexagon':
            const hx = x + width / 2;
            const hy = y + height / 2;
            const hw = width / 2;
            const hh = height / 2;
            ctx.moveTo(hx - hw * 0.5, y);
            ctx.lineTo(hx + hw * 0.5, y);
            ctx.lineTo(x + width, hy);
            ctx.lineTo(hx + hw * 0.5, y + height);
            ctx.lineTo(hx - hw * 0.5, y + height);
            ctx.lineTo(x, hy);
            ctx.closePath();
            break;
        case 'cloud':
            drawCloud(ctx, x, y, width, height);
            break;
        default: // rounded-rect
            const r = Math.min(16, width / 4, height / 4);
            ctx.moveTo(x + r, y);
            ctx.lineTo(x + width - r, y);
            ctx.quadraticCurveTo(x + width, y, x + width, y + r);
            ctx.lineTo(x + width, y + height - r);
            ctx.quadraticCurveTo(x + width, y + height, x + width - r, y + height);
            ctx.lineTo(x + r, y + height);
            ctx.quadraticCurveTo(x, y + height, x, y + height - r);
            ctx.lineTo(x, y + r);
            ctx.quadraticCurveTo(x, y, x + r, y);
            ctx.closePath();
    }
}

function drawCloud(ctx, x, y, width, height) {
    const cx = x + width / 2;
    const cy = y + height / 2;
    const rx = width / 2;
    const ry = height / 2;
    
    ctx.moveTo(cx - rx * 0.8, cy);
    ctx.bezierCurveTo(cx - rx, cy - ry * 0.8, cx - rx * 0.3, cy - ry, cx, cy - ry * 0.7);
    ctx.bezierCurveTo(cx + rx * 0.3, cy - ry, cx + rx, cy - ry * 0.8, cx + rx * 0.8, cy);
    ctx.bezierCurveTo(cx + rx, cy + ry * 0.5, cx + rx * 0.5, cy + ry, cx, cy + ry * 0.8);
    ctx.bezierCurveTo(cx - rx * 0.5, cy + ry, cx - rx, cy + ry * 0.5, cx - rx * 0.8, cy);
}

function drawConnection(fromNode, toNode, color) {
    const fromX = fromNode.x + fromNode.width / 2;
    const fromY = fromNode.y + fromNode.height / 2;
    const toX = toNode.x + toNode.width / 2;
    const toY = toNode.y + toNode.height / 2;
    
    ctx.strokeStyle = color || '#000000';
    ctx.lineWidth = 3;
    ctx.lineCap = 'round';
    
    ctx.beginPath();
    ctx.moveTo(fromX, fromY);
    
    switch (connectionStyle) {
        case 'straight':
            ctx.lineTo(toX, toY);
            break;
        case 'orthogonal':
            const midX = (fromX + toX) / 2;
            ctx.lineTo(midX, fromY);
            ctx.lineTo(midX, toY);
            ctx.lineTo(toX, toY);
            break;
        default: // curve
            const dx = toX - fromX;
            const dy = toY - fromY;
            const controlX = fromX + dx * 0.5;
            const controlY = fromY;
            ctx.quadraticCurveTo(controlX, controlY, toX, toY);
    }
    
    ctx.stroke();
}

function wrapText(text, maxWidth) {
    const words = text.split(' ');
    const lines = [];
    let currentLine = '';
    
    words.forEach(word => {
        const testLine = currentLine + (currentLine ? ' ' : '') + word;
        const metrics = ctx.measureText(testLine);
        
        if (metrics.width > maxWidth && currentLine) {
            lines.push(currentLine);
            currentLine = word;
        } else {
            currentLine = testLine;
        }
    });
    
    if (currentLine) lines.push(currentLine);
    return lines.length > 0 ? lines : [''];
}

// ===== EVENT HANDLERS =====
function handleMouseDown(e) {
    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    
    closeContextMenu();
    
    if (e.button === 1 || (e.button === 0 && e.altKey)) {
        isPanning = true;
        dragStart = { x, y };
        canvas.style.cursor = 'grabbing';
        return;
    }
    
    if (e.button === 0) {
        const node = findNodeAtPoint(x, y);
        
        if (node) {
            // Check if clicking collapse button
            const btnX = node.x + node.width - 5;
            const btnY = node.y + node.height - 5;
            const worldX = (x - viewport.offsetX) / viewport.scale;
            const worldY = (y - viewport.offsetY) / viewport.scale;
            
            if (node.children.length > 0 && 
                Math.hypot(worldX - btnX, worldY - btnY) < 12) {
                toggleCollapse(node.id);
                return;
            }
            
            if (e.ctrlKey || e.metaKey) {
                if (selectedNodeIds.has(node.id)) {
                    selectedNodeIds.delete(node.id);
                } else {
                    selectedNodeIds.add(node.id);
                }
            } else {
                selectedNodeId = node.id;
                selectedNodeIds.clear();
                selectedNodeIds.add(node.id);
            }
            
            isDraggingNode = true;
            dragStart = { x, y };
        } else {
            selectedNodeId = null;
            selectedNodeIds.clear();
            closeEditor();
            
            isSelectionBox = true;
            const worldX = (x - viewport.offsetX) / viewport.scale;
            const worldY = (y - viewport.offsetY) / viewport.scale;
            selectionStart = { x: worldX, y: worldY };
            selectionEnd = { x: worldX, y: worldY };
        }
        
        render();
    }
}

function handleMouseMove(e) {
    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    
    if (isPanning) {
        viewport.offsetX += x - dragStart.x;
        viewport.offsetY += y - dragStart.y;
        dragStart = { x, y };
        render();
        return;
    }
    
    if (isDraggingNode && selectedNodeIds.size > 0) {
        const dx = (x - dragStart.x) / viewport.scale;
        const dy = (y - dragStart.y) / viewport.scale;
        
        selectedNodeIds.forEach(nodeId => {
            const node = findNodeById(mindMapData.root, nodeId);
            if (node) {
                node.x += dx;
                node.y += dy;
            }
        });
        
        dragStart = { x, y };
        render();
        return;
    }
    
    if (isSelectionBox) {
        const worldX = (x - viewport.offsetX) / viewport.scale;
        const worldY = (y - viewport.offsetY) / viewport.scale;
        selectionEnd = { x: worldX, y: worldY };
        
        // Select nodes in box
        selectedNodeIds.clear();
        const sx = Math.min(selectionStart.x, selectionEnd.x);
        const sy = Math.min(selectionStart.y, selectionEnd.y);
        const sw = Math.abs(selectionEnd.x - selectionStart.x);
        const sh = Math.abs(selectionEnd.y - selectionStart.y);
        
        function selectInBox(node) {
            if (node.x < sx + sw && node.x + node.width > sx &&
                node.y < sy + sh && node.y + node.height > sy) {
                selectedNodeIds.add(node.id);
            }
            if (!collapsedNodes.has(node.id)) {
                node.children.forEach(selectInBox);
            }
        }
        
        selectInBox(mindMapData.root);
        render();
        return;
    }
    
    // Tooltip
    const node = findNodeAtPoint(x, y);
    const tooltip = document.getElementById('tooltip');
    
    if (node && node.notes && node.notes.trim()) {
        tooltip.textContent = node.notes;
        tooltip.style.display = 'block';
        tooltip.style.left = (e.clientX + 15) + 'px';
        tooltip.style.top = (e.clientY + 15) + 'px';
    } else {
        tooltip.style.display = 'none';
    }
}

function handleMouseUp(e) {
    if (isDraggingNode) {
        saveToHistory();
    }
    
    isDraggingNode = false;
    isPanning = false;
    isSelectionBox = false;
    selectionEnd = {};
    canvas.style.cursor = 'grab';
    render();
}

function handleWheel(e) {
    e.preventDefault();
    
    const rect = canvas.getBoundingClientRect();
    const mouseX = e.clientX - rect.left;
    const mouseY = e.clientY - rect.top;
    
    const delta = e.deltaY > 0 ? 0.9 : 1.1;
    const newScale = Math.max(0.1, Math.min(5, viewport.scale * delta));
    
    // Zoom towards mouse position
    const worldX = (mouseX - viewport.offsetX) / viewport.scale;
    const worldY = (mouseY - viewport.offsetY) / viewport.scale;
    
    viewport.scale = newScale;
    viewport.offsetX = mouseX - worldX * newScale;
    viewport.offsetY = mouseY - worldY * newScale;
    
    document.getElementById('zoomDisplay').textContent = Math.round(viewport.scale * 100) + '%';
    render();
}

function handleDoubleClick(e) {
    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    
    const node = findNodeAtPoint(x, y);
    if (node) {
        selectedNodeId = node.id;
        selectedNodeIds.clear();
        selectedNodeIds.add(node.id);
        openEditor();
    }
}

function handleContextMenu(e) {
    e.preventDefault();
    
    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    
    const node = findNodeAtPoint(x, y);
    if (node) {
        selectedNodeId = node.id;
        selectedNodeIds.clear();
        selectedNodeIds.add(node.id);
        render();
        showContextMenu(e.clientX, e.clientY);
    }
}

function handleKeyDown(e) {
    // Don't handle if typing in input
    if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') {
        return;
    }
    
    const ctrl = e.ctrlKey || e.metaKey;
    
    switch (e.key) {
        case 'Delete':
        case 'Backspace':
            e.preventDefault();
            deleteSelectedNodes();
            break;
        case 'Tab':
            if (selectedNodeId) {
                e.preventDefault();
                showAddNodeModal('sibling');
            }
            break;
        case 'F2':
            if (selectedNodeId) {
                e.preventDefault();
                openEditor();
            }
            break;
        case 'Escape':
            closeAllModals();
            selectedNodeId = null;
            selectedNodeIds.clear();
            render();
            break;
        case 'z':
            if (ctrl) {
                e.preventDefault();
                undo();
            }
            break;
        case 'y':
            if (ctrl) {
                e.preventDefault();
                redo();
            }
            break;
        case 'c':
            if (ctrl) {
                e.preventDefault();
                copyNode();
            }
            break;
        case 'v':
            if (ctrl) {
                e.preventDefault();
                pasteNode();
            }
            break;
        case 'd':
            if (ctrl) {
                e.preventDefault();
                duplicateNode();
            }
            break;
        case 'a':
            if (ctrl) {
                e.preventDefault();
                selectAll();
            }
            break;
        case 's':
            if (ctrl) {
                e.preventDefault();
                saveMindMap();
            }
            break;
        case 'o':
            if (ctrl) {
                e.preventDefault();
                loadMindMap();
            }
            break;
        case '+':
            if (ctrl) {
                e.preventDefault();
                zoomIn();
            }
            break;
        case '-':
            if (ctrl) {
                e.preventDefault();
                zoomOut();
            }
            break;
        case '0':
            if (ctrl) {
                e.preventDefault();
                resetZoom();
            }
            break;
    }
}

function handleDocumentClick(e) {
    if (!e.target.closest('.context-menu') && !e.target.closest('#canvas')) {
        closeContextMenu();
    }
}

function findNodeAtPoint(screenX, screenY) {
    const worldX = (screenX - viewport.offsetX) / viewport.scale;
    const worldY = (screenY - viewport.offsetY) / viewport.scale;
    
    function search(node) {
        if (collapsedNodes.has(node.parentId)) return null;
        
        // Check children first (they're on top)
        if (!collapsedNodes.has(node.id)) {
            for (let i = node.children.length - 1; i >= 0; i--) {
                const found = search(node.children[i]);
                if (found) return found;
            }
        }
        
        if (worldX >= node.x && worldX <= node.x + node.width &&
            worldY >= node.y && worldY <= node.y + node.height) {
            return node;
        }
        
        return null;
    }
    
    return search(mindMapData.root);
}

// ===== NODE OPERATIONS =====
function showAddNodeModal(type) {
    addNodeType = type;
    const title = type === 'child' ? 'Adicionar Nó Filho' : 'Adicionar Nó Irmão';
    document.getElementById('addNodeTitle').textContent = title;
    document.getElementById('newNodeLabel').value = '';
    document.getElementById('newNodeColor').value = COLORS[Math.floor(Math.random() * COLORS.length)];
    document.getElementById('addNodeModal').classList.add('active');
    setTimeout(() => document.getElementById('newNodeLabel').focus(), 100);
}

function closeAddNodeModal() {
    document.getElementById('addNodeModal').classList.remove('active');
}

function addNode() {
    const label = document.getElementById('newNodeLabel').value.trim();
    if (!label) {
        showToast('Digite um texto para o nó', 'warning');
        return;
    }
    
    const shape = document.getElementById('newNodeShape').value;
    const color = document.getElementById('newNodeColor').value;
    
    const newNode = {
        id: 'node-' + Date.now(),
        label: label,
        icon: '',
        x: 0, y: 0,
        width: 140, height: 60,
        color: color,
        textColor: '#ffffff',
        textSize: 14,
        notes: '',
        shape: shape,
        priority: '',
        children: []
    };
    
    if (addNodeType === 'child' && selectedNodeId) {
        const parent = findNodeById(mindMapData.root, selectedNodeId);
        if (parent) {
            newNode.parentId = selectedNodeId;
            newNode.x = parent.x + parent.width + 100;
            newNode.y = parent.y + parent.children.length * 80;
            parent.children.push(newNode);
        }
    } else if (addNodeType === 'sibling' && selectedNodeId) {
        const parent = findParentNode(mindMapData.root, selectedNodeId);
        if (parent) {
            const sibling = findNodeById(mindMapData.root, selectedNodeId);
            newNode.parentId = parent.id;
            newNode.x = sibling.x;
            newNode.y = sibling.y + sibling.height + 30;
            parent.children.push(newNode);
        }
    } else {
        // Add as child of root
        newNode.parentId = 'root';
        newNode.x = mindMapData.root.x + 200;
        newNode.y = mindMapData.root.y + mindMapData.root.children.length * 80;
        mindMapData.root.children.push(newNode);
    }
    
    rebuildConnections();
    closeAddNodeModal();
    saveToHistory();
    render();
    showToast('Nó adicionado!', 'success');
}

function deleteSelectedNodes() {
    if (selectedNodeIds.size === 0) return;
    
    if (selectedNodeIds.has('root')) {
        showToast('Não é possível excluir o nó raiz', 'error');
        return;
    }
    
    selectedNodeIds.forEach(nodeId => {
        function removeFromParent(node) {
            node.children = node.children.filter(child => {
                if (child.id === nodeId) return false;
                removeFromParent(child);
                return true;
            });
        }
        removeFromParent(mindMapData.root);
    });
    
    rebuildConnections();
    selectedNodeIds.clear();
    selectedNodeId = null;
    closeEditor();
    saveToHistory();
    render();
    showToast('Nó(s) excluído(s)', 'success');
}

function copyNode() {
    if (!selectedNodeId) return;
    
    const node = findNodeById(mindMapData.root, selectedNodeId);
    if (node) {
        clipboard = JSON.parse(JSON.stringify(node));
        showToast('Nó copiado!', 'success');
    }
}

function pasteNode() {
    if (!clipboard) {
        showToast('Nada para colar', 'warning');
        return;
    }
    
    function cloneWithNewIds(node) {
        const clone = { ...node };
        clone.id = 'node-' + Date.now() + '-' + Math.random().toString(36).substr(2, 9);
        clone.x += 50;
        clone.y += 50;
        clone.children = node.children.map(child => {
            const childClone = cloneWithNewIds(child);
            childClone.parentId = clone.id;
            return childClone;
        });
        return clone;
    }
    
    const newNode = cloneWithNewIds(clipboard);
    
    if (selectedNodeId) {
        const parent = findNodeById(mindMapData.root, selectedNodeId);
        if (parent) {
            newNode.parentId = selectedNodeId;
            parent.children.push(newNode);
        }
    } else {
        newNode.parentId = 'root';
        mindMapData.root.children.push(newNode);
    }
    
    rebuildConnections();
    saveToHistory();
    render();
    showToast('Nó colado!', 'success');
}

function duplicateNode() {
    if (!selectedNodeId || selectedNodeId === 'root') return;
    
    const node = findNodeById(mindMapData.root, selectedNodeId);
    const parent = findParentNode(mindMapData.root, selectedNodeId);
    
    if (node && parent) {
        function cloneWithNewIds(n) {
            const clone = { ...n };
            clone.id = 'node-' + Date.now() + '-' + Math.random().toString(36).substr(2, 9);
            clone.x += 30;
            clone.y += 30;
            clone.children = n.children.map(child => {
                const childClone = cloneWithNewIds(child);
                childClone.parentId = clone.id;
                return childClone;
            });
            return clone;
        }
        
        const duplicate = cloneWithNewIds(node);
        duplicate.parentId = parent.id;
        parent.children.push(duplicate);
        
        rebuildConnections();
        saveToHistory();
        render();
        showToast('Nó duplicado!', 'success');
    }
}

function selectAll() {
    selectedNodeIds.clear();
    
    function addAll(node) {
        selectedNodeIds.add(node.id);
        node.children.forEach(addAll);
    }
    
    addAll(mindMapData.root);
    render();
    showToast(`${selectedNodeIds.size} nós selecionados`);
}

function toggleCollapse(nodeId = null) {
    const id = nodeId || selectedNodeId;
    if (!id) return;
    
    if (collapsedNodes.has(id)) {
        collapsedNodes.delete(id);
    } else {
        collapsedNodes.add(id);
    }
    
    render();
}

function expandAll() {
    collapsedNodes.clear();
    render();
    showToast('Todos os nós expandidos');
}

function collapseAll() {
    function collapse(node) {
        if (node.children.length > 0) {
            collapsedNodes.add(node.id);
        }
        node.children.forEach(collapse);
    }
    
    collapse(mindMapData.root);
    render();
    showToast('Todos os nós recolhidos');
}

// ===== EDITOR PANEL =====
function openEditor() {
    if (!selectedNodeId) return;
    
    const node = findNodeById(mindMapData.root, selectedNodeId);
    if (!node) return;
    
    const defaultFields = document.getElementById('dimensionFieldsDefault');
    const circleFields = document.getElementById('dimensionFieldsCircle');

    if (node.shape === 'circle') {
        defaultFields.style.display = 'none';
        circleFields.style.display = 'flex';
    }

    document.getElementById('nodeLabel').value = node.label;
    document.getElementById('nodeShape').value = node.shape;
    document.getElementById('nodeColor').value = node.color;
    document.getElementById('nodeColorText').value = node.color;
    document.getElementById('nodeTextColor').value = node.textColor;
    document.getElementById('nodeTextColorText').value = node.textColor;
    document.getElementById('nodeTextSize').value = node.textSize || 14;
    document.getElementById('nodeWidth').value = node.width;
    document.getElementById('nodeHeight').value = node.height;
    document.getElementById('nodeNotes').value = node.notes || '';
    document.getElementById('nodePriority').value = node.priority || '';
    
    document.getElementById('editorPanel').classList.remove('hidden');
    closeContextMenu();
}

function closeEditor() {
    document.getElementById('editorPanel').classList.add('hidden');
}

function updateDimensionFields() {
    const defaultFields = document.getElementById('dimensionFieldsDefault');
    const circleFields = document.getElementById('dimensionFieldsCircle');
    const shapeValue = document.getElementById('nodeShape').value;
    
    if (shapeValue === 'circle') {
        defaultFields.style.display = 'none';
        circleFields.style.display = 'flex';
    } else {
        defaultFields.style.display = 'flex';
        circleFields.style.display = 'none';
    }
}

function updateNodePreview() {
    if (!selectedNodeId) return;
    
    const node = findNodeById(mindMapData.root, selectedNodeId);
    if (!node) return;
    
    node.label = document.getElementById('nodeLabel').value;
    node.shape = document.getElementById('nodeShape').value;
    node.color = document.getElementById('nodeColor').value;
    node.textColor = document.getElementById('nodeTextColor').value;
    node.textSize = parseInt(document.getElementById('nodeTextSize').value) || 14;
    node.width = parseInt(document.getElementById('nodeWidth').value) || 140;
    node.height = parseInt(document.getElementById('nodeHeight').value) || 60;
    node.priority = document.getElementById('nodePriority').value;
    
    document.getElementById('nodeColorText').value = node.color;
    document.getElementById('nodeTextColorText').value = node.textColor;
    
    render();
}

function syncColorFromText(inputId) {
    const textInput = document.getElementById(inputId + 'Text');
    const colorInput = document.getElementById(inputId);
    
    if (/^#[0-9A-Fa-f]{6}$/.test(textInput.value)) {
        colorInput.value = textInput.value;
        updateNodePreview();
    }
}

function selectIcon(icon) {
    if (!selectedNodeId) return;
    
    const node = findNodeById(mindMapData.root, selectedNodeId);
    if (node) {
        node.icon = node.icon === icon ? '' : icon;
        render();
    }
}

function saveNodeChanges() {
    updateNodePreview();
    
    const node = findNodeById(mindMapData.root, selectedNodeId);
    if (node) {
        node.notes = document.getElementById('nodeNotes').value;
    }
    
    closeEditor();
    saveToHistory();
    showToast('Alterações salvas!', 'success');
}

// ===== CONTEXT MENU =====
function showContextMenu(x, y) {
    const menu = document.getElementById('contextMenu');
    menu.style.left = x + 'px';
    menu.style.top = y + 'px';
    menu.classList.add('active');
}

function closeContextMenu() {
    document.getElementById('contextMenu').classList.remove('active');
}

// ===== HISTORY =====
function saveToHistory() {
    if (historyIndex < history.length - 1) {
        history = history.slice(0, historyIndex + 1);
    }
    
    history.push(JSON.stringify(mindMapData));
    historyIndex++;
    
    if (history.length > 50) {
        history.shift();
        historyIndex--;
    }
}

function undo() {
    if (historyIndex > 0) {
        historyIndex--;
        mindMapData = JSON.parse(history[historyIndex]);
        rebuildConnections();
        render();
        showToast('Desfeito');
    }
}

function redo() {
    if (historyIndex < history.length - 1) {
        historyIndex++;
        mindMapData = JSON.parse(history[historyIndex]);
        rebuildConnections();
        render();
        showToast('Refeito');
    }
}

// ===== ZOOM & VIEW =====
function zoomIn() {
    viewport.scale = Math.min(5, viewport.scale * 1.2);
    document.getElementById('zoomDisplay').textContent = Math.round(viewport.scale * 100) + '%';
    render();
}

function zoomOut() {
    viewport.scale = Math.max(0.1, viewport.scale * 0.8);
    document.getElementById('zoomDisplay').textContent = Math.round(viewport.scale * 100) + '%';
    render();
}

function resetZoom() {
    viewport.scale = 1;
    viewport.offsetX = 0;
    viewport.offsetY = 0;
    document.getElementById('zoomDisplay').textContent = '100%';
    render();
}

function fitToScreen() {
    if (!mindMapData) return;
    
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    
    function getBounds(node) {
        minX = Math.min(minX, node.x);
        minY = Math.min(minY, node.y);
        maxX = Math.max(maxX, node.x + node.width);
        maxY = Math.max(maxY, node.y + node.height);
        if (!collapsedNodes.has(node.id)) {
            node.children.forEach(getBounds);
        }
    }
    
    getBounds(mindMapData.root);
    
    const padding = 50;
    const mapWidth = maxX - minX + padding * 2;
    const mapHeight = maxY - minY + padding * 2;
    
    const scaleX = canvas.width / mapWidth;
    const scaleY = canvas.height / mapHeight;
    viewport.scale = Math.min(scaleX, scaleY, 1);
    
    viewport.offsetX = (canvas.width - mapWidth * viewport.scale) / 2 - minX * viewport.scale + padding * viewport.scale;
    viewport.offsetY = (canvas.height - mapHeight * viewport.scale) / 2 - minY * viewport.scale + padding * viewport.scale;
    
    document.getElementById('zoomDisplay').textContent = Math.round(viewport.scale * 100) + '%';
    render();
}

function centerOnRoot() {
    if (!mindMapData) return;
    
    const root = mindMapData.root;
    viewport.offsetX = canvas.width / 2 - (root.x + root.width / 2) * viewport.scale;
    viewport.offsetY = canvas.height / 2 - (root.y + root.height / 2) * viewport.scale;
    render();
}

function centerOnNode() {
    if (!selectedNodeId) return;
    
    const node = findNodeById(mindMapData.root, selectedNodeId);
    if (node) {
        viewport.offsetX = canvas.width / 2 - (node.x + node.width / 2) * viewport.scale;
        viewport.offsetY = canvas.height / 2 - (node.y + node.height / 2) * viewport.scale;
        render();
    }
    closeContextMenu();
}

function toggleFullscreen() {
    if (document.fullscreenElement) {
        document.exitFullscreen();
    } else {
        document.documentElement.requestFullscreen();
    }
}

function toggleSidebar() {
    document.getElementById('sidebar').classList.toggle('collapsed');
}

function updateConnectionStyle() {
    connectionStyle = document.getElementById('connectionStyle').value;
    render();
}

// ===== AUTO LAYOUT =====
function autoLayout() {
    if (!mindMapData) return;
    
    const horizontalGap = 180;
    const verticalGap = 100;
    
    function layoutNode(node, x, y, level) {
        node.x = x;
        node.y = y;
        
        if (node.children.length === 0 || collapsedNodes.has(node.id)) {
            return node.height;
        }
        
        let totalHeight = 0;
        let childY = y;
        
        node.children.forEach((child, index) => {
            const childHeight = layoutNode(child, x + node.width + horizontalGap, childY, level + 1);
            childY += childHeight + verticalGap;
            totalHeight += childHeight + (index < node.children.length - 1 ? verticalGap : 0);
        });
        
        // Center parent vertically relative to children
        if (node.children.length > 0) {
            const firstChild = node.children[0];
            const lastChild = node.children[node.children.length - 1];
            node.y = (firstChild.y + lastChild.y + lastChild.height - node.height) / 2;
        }
        
        return Math.max(node.height, totalHeight);
    }
    
    layoutNode(mindMapData.root, 100, 200, 0);
    
    saveToHistory();
    fitToScreen();
    showToast('Layout automático aplicado!', 'success');
}

// ===== FILE OPERATIONS =====
function newMindMap() {
    if (confirm('Criar novo mapa? As alterações não salvas serão perdidas.')) {
        mindMapData = {
            root: {
                id: 'root',
                label: 'Novo Mapa',
                icon: '🎯',
                x: 400, y: 300,
                width: 160, height: 70,
                color: '#3498db',
                textColor: '#ffffff',
                textSize: 16,
                notes: '',
                shape: 'rounded-rect',
                priority: '',
                children: []
            },
            connections: []
        };
        
        history = [];
        historyIndex = -1;
        selectedNodeId = null;
        selectedNodeIds.clear();
        collapsedNodes.clear();
        viewport = { scale: 1, offsetX: 0, offsetY: 0 };
        
        saveToHistory();
        centerOnRoot();
        showToast('Novo mapa criado!', 'success');
    }
}

function importTXT() {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.txt';
    
    input.onchange = function(e) {
        const file = e.target.files[0];
        if (!file) return;
        
        const reader = new FileReader();
        reader.onload = function(evt) {
            try {
                const lines = evt.target.result.split('\n').filter(function(l) { return l.trim(); });
                if (lines.length === 0) {
                    showToast('Arquivo vazio', 'warning');
                    return;
                }
                
                const root = {
                    id: 'root',
                    label: lines[0].trim(),
                    icon: '🎯',
                    x: 100, y: 200,
                    width: 160, height: 70,
                    color: '#3498db',
                    textColor: '#ffffff',
                    textSize: 16,
                    notes: '',
                    shape: 'rounded-rect',
                    priority: '',
                    children: []
                };
                
                const nodeMap = { root: root };
                let counter = 0;
                
                function getIndent(line) { return line.search(/\S/); }
                
                function addNode(parentId, text, level) {
                    const id = 'node-' + (++counter);
                    const color = COLORS[counter % COLORS.length];
                    
                    const node = {
                        id: id,
                        label: text.trim(),
                        icon: '',
                        x: 100 + level * 200,
                        y: 200 + counter * 80,
                        width: 140,
                        height: 60,
                        color: color,
                        textColor: '#ffffff',
                        textSize: 14,
                        notes: '',
                        shape: 'rounded-rect',
                        priority: '',
                        parentId: parentId,
                        children: []
                    };
                    
                    nodeMap[id] = node;
                    const parent = nodeMap[parentId];
                    if (parent) parent.children.push(node);
                    
                    return id;
                }
                
                let lastByLevel = { 0: 'root' };
                
                for (let i = 1; i < lines.length; i++) {
                    const line = lines[i];
                    const indent = getIndent(line);
                    const level = Math.floor(indent / 4) + 1;
                    const text = line.trim();
                    
                    if (text) {
                        const parentId = lastByLevel[level - 1] || 'root';
                        const id = addNode(parentId, text, level);
                        lastByLevel[level] = id;
                    }
                }
                
                mindMapData = { root: root, connections: [] };
                rebuildConnections();
                
                selectedNodeId = null;
                selectedNodeIds.clear();
                collapsedNodes.clear();
                history = [];
                historyIndex = -1;
                
                saveToHistory();
                autoLayout();
                showToast('Mapa importado!', 'success');
            } catch (err) {
                showToast('Erro ao importar', 'error');
            }
        };
        reader.readAsText(file);
    };
    
    input.click();
}

function exportTXT() {
    if (!mindMapData) return;
    
    let content = mindMapData.root.label + '\n';
    
    function addLines(node, level) {
        node.children.forEach(function(child) {
            content += '    '.repeat(level) + child.label + '\n';
            addLines(child, level + 1);
        });
    }
    
    addLines(mindMapData.root, 1);
    
    downloadFile('mapa-mental.txt', content, 'text/plain');
    showToast('Exportado como TXT!', 'success');
}

function exportImage(format) {
    format = format || 'png';
    if (!mindMapData) return;
    
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    
    function getBounds(node) {
        minX = Math.min(minX, node.x);
        minY = Math.min(minY, node.y);
        maxX = Math.max(maxX, node.x + node.width);
        maxY = Math.max(maxY, node.y + node.height);
        if (!collapsedNodes.has(node.id)) node.children.forEach(getBounds);
    }
    
    getBounds(mindMapData.root);
    
    const padding = 50;
    const exportWidth = (maxX - minX) + padding * 2;
    const exportHeight = (maxY - minY) + padding * 2;
    
    const tempCanvas = document.createElement('canvas');
    tempCanvas.width = exportWidth * 2;
    tempCanvas.height = exportHeight * 2;
    const tempCtx = tempCanvas.getContext('2d');
    
    tempCtx.scale(2, 2);
    tempCtx.fillStyle = '#ffffff';
    tempCtx.fillRect(0, 0, exportWidth, exportHeight);
    
    tempCtx.save();
    tempCtx.translate(padding - minX, padding - minY);
    
    mindMapData.connections.forEach(function(conn) {
        const fromNode = findNodeById(mindMapData.root, conn.from);
        const toNode = findNodeById(mindMapData.root, conn.to);
        if (fromNode && toNode && !collapsedNodes.has(conn.from)) {
            tempCtx.strokeStyle = conn.color || '#95a5a6';
            tempCtx.lineWidth = 3;
            tempCtx.beginPath();
            tempCtx.moveTo(fromNode.x + fromNode.width/2, fromNode.y + fromNode.height/2);
            const dx = toNode.x - fromNode.x;
            tempCtx.quadraticCurveTo(fromNode.x + fromNode.width/2 + dx*0.5, fromNode.y + fromNode.height/2, toNode.x + toNode.width/2, toNode.y + toNode.height/2);
            tempCtx.stroke();
        }
    });
    
    function drawNodeExport(node) {
        if (collapsedNodes.has(node.parentId)) return;
        
        tempCtx.fillStyle = node.color;
        tempCtx.strokeStyle = 'rgba(0,0,0,0.1)';
        tempCtx.lineWidth = 2;
        drawShape(tempCtx, node.x, node.y, node.width, node.height, node.shape);
        tempCtx.fill();
        tempCtx.stroke();
        
        tempCtx.fillStyle = node.textColor;
        tempCtx.font = (node.textSize || 14) + 'px -apple-system, sans-serif';
        tempCtx.textAlign = 'center';
        tempCtx.textBaseline = 'middle';
        let text = node.icon ? node.icon + ' ' + node.label : node.label;
        tempCtx.fillText(text, node.x + node.width/2, node.y + node.height/2);
        
        if (!collapsedNodes.has(node.id)) node.children.forEach(drawNodeExport);
    }
    
    drawNodeExport(mindMapData.root);
    tempCtx.restore();
    
    tempCanvas.toBlob(function(blob) {
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = 'mapa-mental.' + format;
        link.click();
        URL.revokeObjectURL(url);
    }, 'image/' + format);
    
    showToast('Exportado como ' + format.toUpperCase() + '!', 'success');
}

function exportHTML() {
    if (!mindMapData) return;
    
    // Criar HTML completo com todas as funcionalidades
    const exportData = {
        mindMapData: mindMapData,
        collapsedNodes: Array.from(collapsedNodes)
    };
    
    const htmlContent = `<!DOCTYPE html>
<html lang="pt-BR">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>${mindMapData.root.label} - Mapa Mental</title>
<style>
* { margin: 0; padding: 0; box-sizing: border-box; }
body {
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
    background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
    min-height: 100vh;
    padding: 20px;
}
.container {
    max-width: 100%;
    margin: 0 auto;
}
h1 {
    color: white;
    text-align: center;
    margin-bottom: 20px;
    text-shadow: 2px 2px 4px rgba(0,0,0,0.3);
}
.canvas-wrapper {
    background: white;
    border-radius: 16px;
    box-shadow: 0 20px 60px rgba(0,0,0,0.3);
    overflow: hidden;
    position: relative;
}
canvas {
    display: block;
    cursor: grab;
}
canvas:active { cursor: grabbing; }
.toolbar {
    background: #2c3e50;
    padding: 10px 20px;
    display: flex;
    gap: 10px;
    align-items: center;
    flex-wrap: wrap;
}
.toolbar button {
    background: rgba(255,255,255,0.1);
    color: white;
    border: none;
    padding: 8px 16px;
    border-radius: 6px;
    cursor: pointer;
    font-size: 14px;
    transition: all 0.2s;
}
.toolbar button:hover {
    background: rgba(255,255,255,0.2);
}
.toolbar span {
    color: rgba(255,255,255,0.7);
    font-size: 14px;
}
.tooltip {
    position: absolute;
    background: #2c3e50;
    color: white;
    padding: 12px 16px;
    border-radius: 8px;
    font-size: 13px;
    max-width: 300px;
    box-shadow: 0 4px 20px rgba(0,0,0,0.3);
    pointer-events: none;
    z-index: 1000;
    display: none;
}
.tooltip h4 { margin-bottom: 8px; color: #3498db; }
.tooltip p { margin: 4px 0; opacity: 0.9; }
.info {
    color: white;
    text-align: center;
    margin-top: 20px;
    opacity: 0.8;
    font-size: 14px;
}
</style>
</head>
<body>
<div class="container">
<h1>\ud83e\udde0 ${mindMapData.root.label}</h1>
<div class="canvas-wrapper">
    <div class="toolbar">
        <button onclick="zoomIn()">\ud83d\udd0d+ Zoom In</button>
        <button onclick="zoomOut()">\ud83d\udd0d- Zoom Out</button>
        <button onclick="resetView()">\ud83c\udfaf Centralizar</button>
        <span id="zoomLevel">Zoom: 100%</span>
    </div>
    <canvas id="canvas"></canvas>
    <div class="tooltip" id="tooltip"></div>
</div>
<p class="info">Clique nos bot\u00f5es \u2795/\u2796 nos n\u00f3s para expandir/recolher. Passe o mouse sobre os n\u00f3s para ver detalhes.</p>
</div>

<script>
// Dados do mapa mental
const mindMapData = ${JSON.stringify(mindMapData)};
let collapsedNodes = new Set(${JSON.stringify(Array.from(collapsedNodes))});

// Canvas e contexto
const canvas = document.getElementById('canvas');
const ctx = canvas.getContext('2d');
const tooltip = document.getElementById('tooltip');

// Viewport
let viewport = { scale: 1, offsetX: 0, offsetY: 0 };
let isDragging = false;
let lastMouse = { x: 0, y: 0 };

// Inicializa\u00e7\u00e3o
function init() {
    resizeCanvas();
    window.addEventListener('resize', resizeCanvas);
    canvas.addEventListener('wheel', handleWheel);
    canvas.addEventListener('mousedown', handleMouseDown);
    canvas.addEventListener('mousemove', handleMouseMove);
    canvas.addEventListener('mouseup', handleMouseUp);
    canvas.addEventListener('mouseleave', handleMouseUp);
    canvas.addEventListener('click', handleClick);
    centerOnRoot();
}

function resizeCanvas() {
    const wrapper = canvas.parentElement;
    canvas.width = wrapper.clientWidth;
    canvas.height = Math.max(500, window.innerHeight - 250);
    render();
}

function centerOnRoot() {
    const root = mindMapData.root;
    viewport.offsetX = canvas.width / 2 - (root.x + root.width / 2) * viewport.scale;
    viewport.offsetY = canvas.height / 2 - (root.y + root.height / 2) * viewport.scale;
    render();
}

// Fun\u00e7\u00f5es de zoom
function zoomIn() {
    viewport.scale = Math.min(3, viewport.scale * 1.2);
    updateZoomDisplay();
    render();
}

function zoomOut() {
    viewport.scale = Math.max(0.2, viewport.scale / 1.2);
    updateZoomDisplay();
    render();
}

function resetView() {
    viewport.scale = 1;
    updateZoomDisplay();
    centerOnRoot();
}

function updateZoomDisplay() {
    document.getElementById('zoomLevel').textContent = 'Zoom: ' + Math.round(viewport.scale * 100) + '%';
}

// Expandir/Recolher
function expandAll() {
    collapsedNodes.clear();
    render();
}

function collapseAll() {
    function collapseNode(node) {
        if (node.children.length > 0) {
            collapsedNodes.add(node.id);
            node.children.forEach(collapseNode);
        }
    }
    collapsedNodes.clear();
    mindMapData.root.children.forEach(collapseNode);
    render();
}

// Eventos do mouse
function handleWheel(e) {
    e.preventDefault();
    const delta = e.deltaY > 0 ? 0.9 : 1.1;
    viewport.scale = Math.max(0.2, Math.min(3, viewport.scale * delta));
    updateZoomDisplay();
    render();
}

function handleMouseDown(e) {
    isDragging = true;
    lastMouse = { x: e.clientX, y: e.clientY };
    canvas.style.cursor = 'grabbing';
}

function handleMouseMove(e) {
    const rect = canvas.getBoundingClientRect();
    const mouseX = (e.clientX - rect.left - viewport.offsetX) / viewport.scale;
    const mouseY = (e.clientY - rect.top - viewport.offsetY) / viewport.scale;
    
    if (isDragging) {
        viewport.offsetX += e.clientX - lastMouse.x;
        viewport.offsetY += e.clientY - lastMouse.y;
        lastMouse = { x: e.clientX, y: e.clientY };
        render();
    } else {
        // Verificar tooltip
        const node = findNodeAtPosition(mouseX, mouseY);
        if (node && node.notes && node.notes.trim()) {
            showTooltip(e.clientX, e.clientY, node);
        } else {
            hideTooltip();
        }
    }
}

function handleMouseUp() {
    isDragging = false;
    canvas.style.cursor = 'grab';
}

function handleClick(e) {
    const rect = canvas.getBoundingClientRect();
    const mouseX = (e.clientX - rect.left - viewport.offsetX) / viewport.scale;
    const mouseY = (e.clientY - rect.top - viewport.offsetY) / viewport.scale;
    
    // Verificar clique no bot\u00e3o de colapso
    const node = findNodeAtPosition(mouseX, mouseY);
    if (node && node.children.length > 0) {
        const btnX = node.x + node.width - 4;
        const btnY = node.y + node.height - 4;
        const dist = Math.sqrt(Math.pow(mouseX - btnX, 2) + Math.pow(mouseY - btnY, 2));
        if (dist <= 12) {
            if (collapsedNodes.has(node.id)) {
                collapsedNodes.delete(node.id);
            } else {
                collapsedNodes.add(node.id);
            }
            render();
        }
    }
}

// Tooltip
function showTooltip(x, y, node) {
    let html = '<h4>' + (node.icon || '') + ' ' + node.label + '</h4>';
    if (node.notes) html += '<p>' + node.notes.replace(/\\n/g, '<br>') + '</p>';
    if (node.priority) {
        const priorities = { high: '\ud83d\udd34 Alta', medium: '\ud83d\udfe1 M\u00e9dia', low: '\ud83d\udfe2 Baixa' };
        html += '<p><strong>Prioridade:</strong> ' + (priorities[node.priority] || node.priority) + '</p>';
    }
    tooltip.innerHTML = html;
    tooltip.style.display = 'block';
    tooltip.style.left = (x + 15) + 'px';
    tooltip.style.top = (y + 15) + 'px';
}

function hideTooltip() {
    tooltip.style.display = 'none';
}

// Encontrar n\u00f3
function findNodeAtPosition(x, y, node = mindMapData.root) {
    if (isNodeOrAncestorCollapsed(node.parentId)) return null;
    
    if (x >= node.x && x <= node.x + node.width &&
        y >= node.y && y <= node.y + node.height) {
        return node;
    }
    
    if (!collapsedNodes.has(node.id)) {
        for (const child of node.children) {
            const found = findNodeAtPosition(x, y, child);
            if (found) return found;
        }
    }
    return null;
}

function findNodeById(node, id) {
    if (node.id === id) return node;
    for (const child of node.children) {
        const found = findNodeById(child, id);
        if (found) return found;
    }
    return null;
}

function isNodeOrAncestorCollapsed(nodeId) {
    if (!nodeId) return false;
    if (collapsedNodes.has(nodeId)) return true;
    if (nodeId === 'root') return false;
    const node = findNodeById(mindMapData.root, nodeId);
    if (node && node.parentId) return isNodeOrAncestorCollapsed(node.parentId);
    return false;
}

// Renderiza\u00e7\u00e3o
function render() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.save();
    ctx.translate(viewport.offsetX, viewport.offsetY);
    ctx.scale(viewport.scale, viewport.scale);
    
        // Desenhar conexões
    mindMapData.connections.forEach(conn => {
        const fromNode = findNodeById(mindMapData.root, conn.from);
        const toNode = findNodeById(mindMapData.root, conn.to);
        if (fromNode && toNode && !collapsedNodes.has(conn.from)  &&
            !(fromNode.parentId && isNodeOrAncestorCollapsed(fromNode.parentId)) &&
            !(toNode.parentId && isNodeOrAncestorCollapsed(toNode.parentId))) {
            drawConnection(fromNode, toNode, conn.color);
        }
    });
    
    // Desenhar n\u00f3s
    drawNodeRecursive(mindMapData.root);
    ctx.restore();
}

function drawNodeRecursive(node) {
    if (node.parentId && isNodeOrAncestorCollapsed(node.parentId)) return;
    drawNode(node);
    if (!collapsedNodes.has(node.id)) {
        node.children.forEach(child => drawNodeRecursive(child));
    }
}

function drawNode(node) {
    ctx.save();
    
    // Fundo do n\u00f3
    ctx.fillStyle = node.color;
    ctx.strokeStyle = 'rgba(0,0,0,0.1)';
    ctx.lineWidth = 2;
    drawShape(ctx, node.x, node.y, node.width, node.height, node.shape);
    ctx.fill();
    ctx.stroke();
    
    // Indicador de prioridade
    if (node.priority) {
        const colors = { high: '#e74c3c', medium: '#f39c12', low: '#27ae60' };
        ctx.fillStyle = colors[node.priority] || '#999';
        ctx.beginPath();
        ctx.arc(node.x + 12, node.y + 12, 6, 0, Math.PI * 2);
        ctx.fill();
    }
    
    // Indicador de notas
    if (node.notes && node.notes.trim()) {
        ctx.fillStyle = '#f39c12';
        ctx.beginPath();
        ctx.arc(node.x + node.width - 12, node.y + 12, 8, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#fff';
        ctx.font = 'bold 10px sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText('\ud83d\udcdd', node.x + node.width - 12, node.y + 12);
    }
    
    // Texto
    ctx.fillStyle = node.textColor;
    ctx.font = (node.textSize || 14) + 'px -apple-system, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    const text = (node.icon ? node.icon + ' ' : '') + node.label;
    ctx.fillText(text, node.x + node.width / 2, node.y + node.height / 2);
    
    // Bot\u00e3o de colapso
    if (node.children.length > 0) {
        const btnX = node.x + node.width - 4;
        const btnY = node.y + node.height - 4;
        ctx.fillStyle = collapsedNodes.has(node.id) ? '#e74c3c' : '#000000';
        ctx.beginPath();
        ctx.arc(btnX, btnY, 10, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#fff';
        ctx.font = 'bold 14px sans-serif';
        ctx.fillText(collapsedNodes.has(node.id) ? '+' : '\u2212', btnX, btnY);
    }
    
    ctx.restore();
}

function drawShape(ctx, x, y, w, h, shape) {
    ctx.beginPath();
    switch (shape) {
        case 'circle':
            ctx.arc(x + w/2, y + h/2, Math.min(w, h)/2, 0, Math.PI * 2);
            break;
        case 'rectangle':
            ctx.rect(x, y, w, h);
            break;
        case 'diamond':
            ctx.moveTo(x + w/2, y);
            ctx.lineTo(x + w, y + h/2);
            ctx.lineTo(x + w/2, y + h);
            ctx.lineTo(x, y + h/2);
            ctx.closePath();
            break;
        case 'ellipse':
            ctx.ellipse(x + w/2, y + h/2, w/2, h/2, 0, 0, Math.PI * 2);
            break;
        default: // rounded-rect
            const r = Math.min(12, w/4, h/4);
            ctx.moveTo(x + r, y);
            ctx.lineTo(x + w - r, y);
            ctx.quadraticCurveTo(x + w, y, x + w, y + r);
            ctx.lineTo(x + w, y + h - r);
            ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
            ctx.lineTo(x + r, y + h);
            ctx.quadraticCurveTo(x, y + h, x, y + h - r);
            ctx.lineTo(x, y + r);
            ctx.quadraticCurveTo(x, y, x + r, y);
            ctx.closePath();
    }
}

function drawConnection(from, to, color) {
    ctx.strokeStyle = color || '#95a5a6';
    ctx.lineWidth = 3;
    ctx.lineCap = 'round';
    ctx.beginPath();
    const fx = from.x + from.width/2, fy = from.y + from.height/2;
    const tx = to.x + to.width/2, ty = to.y + to.height/2;
    ctx.moveTo(fx, fy);
    const cp1x = fx + (tx - fx) * 0.5;
    ctx.quadraticCurveTo(cp1x, fy, tx, ty);
    ctx.stroke();
}

// Iniciar
init();
<\/script>
</body>
</html>`;
    
    downloadFile('mapa-mental.html', htmlContent, 'text/html');
    showToast('Exportado como HTML interativo!', 'success');
}

function downloadFile(filename, content, type) {
    const blob = new Blob([content], { type: type || 'text/plain' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    link.click();
    URL.revokeObjectURL(url);
}

// ===== THEMES =====
function applyThemePreset(preset) {
    const themes = {
        professional: { colors: ['#2c3e50', '#34495e', '#7f8c8d', '#95a5a6'], rootColor: '#2c3e50' },
        colorful: { colors: ['#e74c3c', '#3498db', '#27ae60', '#f39c12', '#9b59b6'], rootColor: '#e74c3c' },
        minimal: { colors: ['#333', '#555', '#777', '#999'], rootColor: '#333' }
    };
    
    const theme = themes[preset];
    if (!theme) return;
    
    let colorIndex = 0;
    function applyToNode(node, isRoot) {
        node.color = isRoot ? theme.rootColor : theme.colors[colorIndex++ % theme.colors.length];
        node.children.forEach(function(child) { applyToNode(child, false); });
    }
    
    applyToNode(mindMapData.root, true);
    rebuildConnections();
    saveToHistory();
    render();
    showToast('Tema aplicado!', 'success');
}

function toggleTheme() {
    document.body.classList.toggle('dark-theme');
    localStorage.setItem('theme', document.body.classList.contains('dark-theme') ? 'dark' : 'light');
    render();
}

function loadThemePreference() {
    if (localStorage.getItem('theme') === 'dark') {
        document.body.classList.add('dark-theme');
        const toggle = document.getElementById('themeToggle');
        if (toggle) toggle.checked = true;
    }
}

// ===== UI HELPERS =====
function showToast(message, type) {
    const toast = document.getElementById('toast');
    toast.textContent = message;
    toast.className = 'toast show ' + (type || '');
    setTimeout(function() { toast.classList.remove('show'); }, 3000);
}

function updateStatusBar() {
    document.getElementById('statusNodes').textContent = '📦 Nós: ' + countNodes();
    document.getElementById('statusSelected').textContent = '✓ Selecionados: ' + selectedNodeIds.size;
    document.getElementById('statusZoom').textContent = '🔍 Zoom: ' + Math.round(viewport.scale * 100) + '%';
}

function closeAllModals() {
    const modals = document.querySelectorAll('.modal');
    modals.forEach(function(m) { m.classList.remove('active'); });
    closeContextMenu();
    closeEditor();
}

function showShortcuts() { document.getElementById('shortcutsModal').classList.add('active'); }
function closeShortcutsModal() { document.getElementById('shortcutsModal').classList.remove('active'); }

function showStats() {
    const nodeCount = countNodes();
    const maxDepth = getMaxDepth();
    const leafCount = getAllNodes().filter(function(n) { return n.children.length === 0; }).length;
    
    document.getElementById('statsGrid').innerHTML = 
        '<div class="stat-card"><div class="stat-value">' + nodeCount + '</div><div class="stat-label">Total de Nós</div></div>' +
        '<div class="stat-card"><div class="stat-value">' + maxDepth + '</div><div class="stat-label">Profundidade</div></div>' +
        '<div class="stat-card"><div class="stat-value">' + leafCount + '</div><div class="stat-label">Nós Folha</div></div>' +
        '<div class="stat-card"><div class="stat-value">' + mindMapData.connections.length + '</div><div class="stat-label">Conexões</div></div>';
    
    document.getElementById('statsModal').classList.add('active');
}

function closeStatsModal() { document.getElementById('statsModal').classList.remove('active'); }

function showAbout() {
    alert('🧠 Mapa Mental Pro\n\nUma ferramenta profissional para criar mapas mentais.\n\nRecursos:\n• Múltiplas formas e ícones\n• Auto-layout inteligente\n• Minimap para navegação\n• Exportação PNG/HTML\n• Atalhos de teclado\n• Temas claro/escuro');
}

// ===== INITIALIZE =====
window.addEventListener('load', init);