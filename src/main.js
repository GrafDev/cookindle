import { Application, Assets, Sprite, Graphics, Texture, BlurFilter } from 'pixi.js';
import { CONFIG } from './config.js';

// Определяем режим разработки
const isDev = import.meta.env.DEV;

// Определяем мобильное устройство
const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent) || 
                 ('ontouchstart' in window) || 
                 (navigator.maxTouchPoints > 0) ||
                 (window.matchMedia && window.matchMedia("(pointer: coarse)").matches);

// Глобальные переменные для иглы
let needleBaseY = 0; // Базовая позиция Y для анимации нажатия
let needlePressed = false; // Состояние нажатия

// Активируем dev режим в HTML
if (isDev) {
    document.body.classList.add('dev-mode');
}

// Отладочная информация для мобильных
if (isDev) {
    console.log('🔍 User Agent:', navigator.userAgent);
    console.log('🔍 ontouchstart in window:', 'ontouchstart' in window);
    console.log('🔍 maxTouchPoints:', navigator.maxTouchPoints);
    console.log('🔍 pointer: coarse:', window.matchMedia && window.matchMedia("(pointer: coarse)").matches);
    console.log('📱 isMobile:', isMobile);
}

// Создание визуальной отладочной информации
function createDebugInfo() {
    const debugDiv = document.createElement('div');
    debugDiv.id = 'debug-info';
    debugDiv.style.cssText = `
        position: fixed;
        top: 10px;
        left: 10px;
        background: rgba(0,0,0,0.8);
        color: white;
        padding: 10px;
        font-family: monospace;
        font-size: 12px;
        z-index: 9999;
        max-width: 300px;
        white-space: pre-wrap;
    `;
    
    const debugInfo = [
        `isMobile: ${isMobile}`,
        `ontouchstart: ${'ontouchstart' in window}`,
        `maxTouchPoints: ${navigator.maxTouchPoints}`,
        `pointer: coarse: ${window.matchMedia && window.matchMedia("(pointer: coarse)").matches}`,
        `User Agent: ${navigator.userAgent.substring(0, 50)}...`
    ].join('\n');
    
    debugDiv.textContent = debugInfo;
    document.body.appendChild(debugDiv);
    
    // Автоматически скрыть через 10 секунд
    setTimeout(() => {
        if (debugDiv.parentNode) {
            debugDiv.parentNode.removeChild(debugDiv);
        }
    }, 10000);
}

// Показ отладочной информации о касаниях
function showTouchDebug(message) {
    // Показываем отладку только в dev режиме
    if (!isDev) return;
    
    let touchDebugDiv = document.getElementById('touch-debug');
    
    if (!touchDebugDiv) {
        touchDebugDiv = document.createElement('div');
        touchDebugDiv.id = 'touch-debug';
        touchDebugDiv.style.cssText = `
            position: fixed;
            top: 10px;
            right: 10px;
            background: rgba(255,0,0,0.8);
            color: white;
            padding: 10px;
            font-family: monospace;
            font-size: 14px;
            z-index: 9999;
            max-width: 200px;
            white-space: pre-wrap;
        `;
        document.body.appendChild(touchDebugDiv);
    }
    
    touchDebugDiv.textContent = message;
    
    // Скрыть через 3 секунды
    setTimeout(() => {
        if (touchDebugDiv.parentNode) {
            touchDebugDiv.style.opacity = '0.5';
        }
    }, 3000);
}

// Инициализация PixiJS приложения
async function initApp() {
    const canvas = document.getElementById('game-canvas');
    const gameArea = document.querySelector('.game-area');
    
    // Создаем PixiJS приложение
    const app = new Application();
    
    // Инициализируем приложение
    await app.init({
        canvas: canvas,
        width: gameArea.clientWidth,
        height: gameArea.clientHeight,
        backgroundColor: CONFIG.pixi.backgroundColor,
        resizeTo: gameArea
    });
    
    // Dev информация
    if (isDev) {
        console.log('🎮 Cookindle App инициализирован');
        console.log('📐 Размер игровой области:', gameArea.clientWidth, 'x', gameArea.clientHeight);
        console.log('🖥️ PixiJS версия:', app.renderer.type);
    }
    
    // Обработка изменения размера окна
    window.addEventListener('resize', () => {
        if (isDev) {
            console.log('🔄 Изменение размера:', gameArea.clientWidth, 'x', gameArea.clientHeight);
        }
        
        // Обновляем размер печенья при изменении окна
        updateCookieSize();
    });
    
    // Глобальный доступ к приложению для отладки
    if (isDev) {
        window.app = app;
    }
    
    // Запуск игры
    await initGame(app);
    
    return app;
}

// Инициализация игры
async function initGame(app) {
    try {
        // Загрузка ресурсов
        await loadAssets();
        
        // Создаем печенье
        createCookie(app);
        
        // Загружаем и создаем иглу
        await loadNeedleTexture();
        createNeedle(app);
        
        // Настраиваем интерактивность
        setupInteractivity(app);
        
        // Запускаем анимацию пульсации
        startPulseAnimation(app);
        
        if (isDev) {
            console.log('🍪 Печенье создано');
            console.log('🪡 Игла настроена');
        }
        
    } catch (error) {
        console.error('Ошибка инициализации игры:', error);
    }
}

// Загрузка ресурсов
async function loadAssets() {
    try {
        // Способ 1: Прямая загрузка изображения (обходим баг PixiJS Assets)
        const cookieImageUrl = (await import('./assets/textures/bg_cooke.png')).default;
        
        if (isDev) {
            console.log('🔍 Загружаем изображение напрямую');
            console.log('📁 URL текстуры:', cookieImageUrl);
        }
        
        if (cookieImageUrl) {
            // Создаем Image элемент
            const img = new Image();
            
            // Промис для загрузки изображения
            const imageLoaded = new Promise((resolve, reject) => {
                img.onload = () => resolve(img);
                img.onerror = reject;
            });
            
            img.src = cookieImageUrl;
            await imageLoaded;
            
            // Создаем текстуру из изображения
            const texture = Texture.from(img);
            
            // Добавляем в кеш
            Assets.cache.set('cookie', texture);
            
            if (isDev) {
                console.log('✅ Текстура загружена напрямую из файла');
                console.log('🖼️ Размер текстуры:', texture.width, 'x', texture.height);
            }
            return;
        }
        
        throw new Error('Import вернул undefined');
        
    } catch (error) {
        console.error('❌ Прямая загрузка не сработала:', error);
        
        // Способ 2: Через public папку
        try {
            const publicUrl = '/assets/textures/bg_cooke.png';
            
            if (isDev) {
                console.log('🔍 Пробуем загрузить из public папки напрямую');
                console.log('📁 URL из public:', publicUrl);
            }
            
            // Создаем Image элемент
            const img = new Image();
            
            // Промис для загрузки изображения
            const imageLoaded = new Promise((resolve, reject) => {
                img.onload = () => resolve(img);
                img.onerror = reject;
            });
            
            img.src = publicUrl;
            await imageLoaded;
            
            // Создаем текстуру из изображения
            const texture = Texture.from(img);
            
            // Добавляем в кеш
            Assets.cache.set('cookie', texture);
            
            if (isDev) {
                console.log('✅ Текстура загружена из public папки');
                console.log('🖼️ Размер текстуры:', texture.width, 'x', texture.height);
            }
            return;
            
        } catch (publicError) {
            console.error('❌ Не удалось загрузить из public:', publicError);
            
            // Способ 3: Fallback - программная текстура
            if (isDev) {
                console.log('🔄 Переходим на программную текстуру');
            }
            createPixiTexture();
        }
    }
}


// Рисование узоров на печенье
function drawCookiePatterns(graphics, paintingType) {
    const patternConfig = CONFIG.cookie;
    
    for (let i = 0; i < patternConfig.patternCount; i++) {
        const angle = (i / patternConfig.patternCount) * Math.PI * 2;
        const radius = 60 + Math.random() * 80;
        const x = 200 + Math.cos(angle) * radius + (Math.random() - 0.5) * 40;
        const y = 200 + Math.sin(angle) * radius + (Math.random() - 0.5) * 40;
        const size = patternConfig.patternSize.min + Math.random() * (patternConfig.patternSize.max - patternConfig.patternSize.min);
        
        // Рисуем узор в зависимости от типа
        switch (paintingType) {
            case "circle":
                drawCirclePattern(graphics, x, y, size, patternConfig.patternColor);
                break;
            case "star":
                drawStarPattern(graphics, x, y, size, patternConfig.patternColor);
                break;
            case "cross":
                drawCrossPattern(graphics, x, y, size, patternConfig.patternColor);
                break;
            default:
                drawCirclePattern(graphics, x, y, size, patternConfig.patternColor);
        }
    }
}

// Рисование круглого узора
function drawCirclePattern(graphics, x, y, size, color) {
    graphics.circle(x, y, size);
    graphics.fill(color);
}

// Рисование звездчатого узора
function drawStarPattern(graphics, x, y, size, color) {
    const points = 5;
    const outerRadius = size;
    const innerRadius = size * 0.4;
    
    // Начинаем рисовать звезду
    graphics.moveTo(x, y - outerRadius);
    
    for (let i = 0; i < points * 2; i++) {
        const angle = (i * Math.PI) / points;
        const radius = i % 2 === 0 ? outerRadius : innerRadius;
        const px = x + Math.cos(angle - Math.PI / 2) * radius;
        const py = y + Math.sin(angle - Math.PI / 2) * radius;
        graphics.lineTo(px, py);
    }
    
    graphics.closePath();
    graphics.fill(color);
}

// Рисование крестообразного узора
function drawCrossPattern(graphics, x, y, size, color) {
    const thickness = size * 0.3;
    
    // Вертикальная линия креста
    graphics.rect(x - thickness / 2, y - size, thickness, size * 2);
    graphics.fill(color);
    
    // Горизонтальная линия креста
    graphics.rect(x - size, y - thickness / 2, size * 2, thickness);
    graphics.fill(color);
}

// Рисование центральной формы
function drawCenterShape(graphics, x, y, shapeConfig) {
    const { form, size, color, lineWidth, alpha, dashed, dashLength, gapLength, borderRadius } = shapeConfig;
    
    if (isDev) {
        console.log('🔷 Рисуем центральную форму:', { form, size, color, lineWidth, alpha, dashed, dashLength, gapLength, borderRadius });
    }
    
    const halfSize = size / 2;
    
    // Если пунктирная линия, используем специальные функции
    if (dashed && dashLength && gapLength) {
        switch (form) {
            case 1: // Круг
                drawDashedCircle(graphics, x, y, halfSize, dashLength, gapLength, color, lineWidth, alpha);
                break;
                
            case 2: // Квадрат
                drawDashedRoundedRect(graphics, x, y, size, borderRadius || 0, dashLength, gapLength, color, lineWidth, alpha);
                break;
                
            case 3: // Треугольник
                drawDashedRoundedTriangle(graphics, x, y, size, borderRadius || 0, dashLength, gapLength, color, lineWidth, alpha);
                break;
                
            default:
                drawDashedCircle(graphics, x, y, halfSize, dashLength, gapLength, color, lineWidth, alpha);
        }
    } else {
        // Обычная сплошная линия
        switch (form) {
            case 1: // Круг
                graphics.circle(x, y, halfSize);
                graphics.stroke({ color: color, width: lineWidth, alpha: alpha });
                break;
                
            case 2: // Квадрат со скругленными углами
                graphics.roundRect(x - halfSize, y - halfSize, size, size, borderRadius || 0);
                graphics.stroke({ color: color, width: lineWidth, alpha: alpha });
                break;
                
            case 3: // Треугольник со скругленными углами
                drawRoundedTriangleShape(graphics, x, y, size, borderRadius || 0);
                graphics.stroke({ color: color, width: lineWidth, alpha: alpha });
                break;
                
            default:
                // По умолчанию круг
                graphics.circle(x, y, halfSize);
                graphics.stroke({ color: color, width: lineWidth, alpha: alpha });
        }
    }
}

// Рисование треугольника
function drawTriangleShape(graphics, x, y, size) {
    const height = size * Math.sqrt(3) / 2;
    const halfBase = size / 2;
    
    // Центрируем треугольник по его центроиду
    const centroidOffsetY = height / 3; // Центроид равностороннего треугольника
    
    // Рисуем равносторонний треугольник с центром в точке (x, y)
    graphics.moveTo(x, y - (height - centroidOffsetY));           // Верхняя точка
    graphics.lineTo(x + halfBase, y + centroidOffsetY);           // Правая нижняя точка
    graphics.lineTo(x - halfBase, y + centroidOffsetY);           // Левая нижняя точка
    graphics.closePath();
}

// Рисование скругленного треугольника
function drawRoundedTriangleShape(graphics, x, y, size, borderRadius) {
    if (borderRadius <= 0) {
        drawTriangleShape(graphics, x, y, size);
        return;
    }
    
    const height = size * Math.sqrt(3) / 2;
    const halfBase = size / 2;
    const centroidOffsetY = height / 3;
    
    // Точки треугольника
    const points = [
        { x: x, y: y - (height - centroidOffsetY) },           // Верхняя точка
        { x: x + halfBase, y: y + centroidOffsetY },           // Правая нижняя точка
        { x: x - halfBase, y: y + centroidOffsetY }            // Левая нижняя точка
    ];
    
    // Рисуем треугольник со скругленными углами
    for (let i = 0; i < 3; i++) {
        const current = points[i];
        const next = points[(i + 1) % 3];
        const prev = points[(i + 2) % 3];
        
        // Вычисляем векторы от текущей точки к соседним
        const toPrev = { x: prev.x - current.x, y: prev.y - current.y };
        const toNext = { x: next.x - current.x, y: next.y - current.y };
        
        // Нормализуем векторы
        const lenPrev = Math.sqrt(toPrev.x * toPrev.x + toPrev.y * toPrev.y);
        const lenNext = Math.sqrt(toNext.x * toNext.x + toNext.y * toNext.y);
        
        toPrev.x /= lenPrev;
        toPrev.y /= lenPrev;
        toNext.x /= lenNext;
        toNext.y /= lenNext;
        
        // Точки начала и конца скругления
        const startPoint = {
            x: current.x + toPrev.x * borderRadius,
            y: current.y + toPrev.y * borderRadius
        };
        const endPoint = {
            x: current.x + toNext.x * borderRadius,
            y: current.y + toNext.y * borderRadius
        };
        
        if (i === 0) {
            graphics.moveTo(startPoint.x, startPoint.y);
        } else {
            graphics.lineTo(startPoint.x, startPoint.y);
        }
        
        // Рисуем скругленный угол
        graphics.arcTo(current.x, current.y, endPoint.x, endPoint.y, borderRadius);
    }
    
    graphics.closePath();
}

// Функции для пунктирных скругленных форм
function drawDashedRoundedRect(graphics, x, y, size, borderRadius, dashLength, gapLength, color, lineWidth, alpha) {
    const halfSize = size / 2;
    
    if (borderRadius > 0) {
        // Для скругленных форм рисуем имитацию пунктира через короткие сегменты
        drawDashedRoundedRectSegments(graphics, x, y, size, borderRadius, dashLength, gapLength, color, lineWidth, alpha);
    } else {
        // Обычный пунктирный прямоугольник
        drawDashedRect(graphics, x, y, size, dashLength, gapLength, color, lineWidth, alpha);
    }
}

function drawDashedRoundedTriangle(graphics, x, y, size, borderRadius, dashLength, gapLength, color, lineWidth, alpha) {
    if (borderRadius > 0) {
        // Для скругленных форм рисуем имитацию пунктира через короткие сегменты
        drawDashedRoundedTriangleSegments(graphics, x, y, size, borderRadius, dashLength, gapLength, color, lineWidth, alpha);
    } else {
        // Обычный пунктирный треугольник
        drawDashedTriangle(graphics, x, y, size, dashLength, gapLength, color, lineWidth, alpha);
    }
}

// Имитация пунктирного скругленного прямоугольника через сегменты
function drawDashedRoundedRectSegments(graphics, x, y, size, borderRadius, dashLength, gapLength, color, lineWidth, alpha) {
    const halfSize = size / 2;
    
    // Рисуем пунктир по четырем сторонам скругленного прямоугольника
    const sides = [
        // Верхняя сторона
        { start: { x: x - halfSize + borderRadius, y: y - halfSize }, end: { x: x + halfSize - borderRadius, y: y - halfSize } },
        // Правая сторона  
        { start: { x: x + halfSize, y: y - halfSize + borderRadius }, end: { x: x + halfSize, y: y + halfSize - borderRadius } },
        // Нижняя сторона
        { start: { x: x + halfSize - borderRadius, y: y + halfSize }, end: { x: x - halfSize + borderRadius, y: y + halfSize } },
        // Левая сторона
        { start: { x: x - halfSize, y: y + halfSize - borderRadius }, end: { x: x - halfSize, y: y - halfSize + borderRadius } }
    ];
    
    // Рисуем пунктир для каждой стороны
    sides.forEach(side => {
        drawDashedLine(graphics, side.start, side.end, dashLength, gapLength, color, lineWidth, alpha);
    });
    
    // Рисуем скругленные углы как пунктирные дуги
    const corners = [
        { center: { x: x - halfSize + borderRadius, y: y - halfSize + borderRadius }, startAngle: Math.PI, endAngle: Math.PI * 1.5 },
        { center: { x: x + halfSize - borderRadius, y: y - halfSize + borderRadius }, startAngle: Math.PI * 1.5, endAngle: Math.PI * 2 },
        { center: { x: x + halfSize - borderRadius, y: y + halfSize - borderRadius }, startAngle: 0, endAngle: Math.PI * 0.5 },
        { center: { x: x - halfSize + borderRadius, y: y + halfSize - borderRadius }, startAngle: Math.PI * 0.5, endAngle: Math.PI }
    ];
    
    corners.forEach(corner => {
        drawDashedArc(graphics, corner.center.x, corner.center.y, borderRadius, corner.startAngle, corner.endAngle, dashLength, gapLength, color, lineWidth, alpha);
    });
}

// Имитация пунктирного скругленного треугольника через сегменты
function drawDashedRoundedTriangleSegments(graphics, x, y, size, borderRadius, dashLength, gapLength, color, lineWidth, alpha) {
    // Для треугольника пока используем сплошную линию (сложно делать пунктир на кривых)
    drawRoundedTriangleShape(graphics, x, y, size, borderRadius);
    graphics.stroke({ color: color, width: lineWidth, alpha: alpha });
}

// Вспомогательная функция для рисования пунктирной линии
function drawDashedLine(graphics, start, end, dashLength, gapLength, color, lineWidth, alpha) {
    const dx = end.x - start.x;
    const dy = end.y - start.y;
    const length = Math.sqrt(dx * dx + dy * dy);
    const totalDashLength = dashLength + gapLength;
    const numDashes = Math.floor(length / totalDashLength);
    
    const unitX = dx / length;
    const unitY = dy / length;
    
    for (let i = 0; i < numDashes; i++) {
        const dashStart = i * totalDashLength;
        const dashEnd = dashStart + dashLength;
        
        const startX = start.x + unitX * dashStart;
        const startY = start.y + unitY * dashStart;
        const endX = start.x + unitX * dashEnd;
        const endY = start.y + unitY * dashEnd;
        
        graphics.moveTo(startX, startY);
        graphics.lineTo(endX, endY);
    }
    
    graphics.stroke({ color: color, width: lineWidth, alpha: alpha });
}

// Вспомогательная функция для рисования пунктирной дуги
function drawDashedArc(graphics, centerX, centerY, radius, startAngle, endAngle, dashLength, gapLength, color, lineWidth, alpha) {
    const arcLength = Math.abs(endAngle - startAngle) * radius;
    const totalDashLength = dashLength + gapLength;
    const numDashes = Math.floor(arcLength / totalDashLength);
    
    const angleStep = (endAngle - startAngle) / (arcLength / totalDashLength);
    const dashAngleLength = (dashLength / radius);
    
    for (let i = 0; i < numDashes; i++) {
        const dashStartAngle = startAngle + (i * angleStep * totalDashLength / radius);
        const dashEndAngle = dashStartAngle + dashAngleLength;
        
        // Рисуем короткую дугу для каждого штриха
        graphics.arc(centerX, centerY, radius, dashStartAngle, dashEndAngle);
        graphics.stroke({ color: color, width: lineWidth, alpha: alpha });
    }
}

// Рисование пунктирной окружности
function drawDashedCircle(graphics, x, y, radius, dashLength, gapLength, color, lineWidth, alpha) {
    if (isDev) {
        console.log('🔸 Рисуем пунктирный круг:', { radius, dashLength, gapLength, color, lineWidth, alpha });
    }
    
    const circumference = 2 * Math.PI * radius;
    const totalDashLength = dashLength + gapLength;
    const numDashes = Math.floor(circumference / totalDashLength);
    
    for (let i = 0; i < numDashes; i++) {
        const startAngle = (i * totalDashLength / radius);
        const endAngle = startAngle + (dashLength / radius);
        
        const startX = x + Math.cos(startAngle) * radius;
        const startY = y + Math.sin(startAngle) * radius;
        const endX = x + Math.cos(endAngle) * radius;
        const endY = y + Math.sin(endAngle) * radius;
        
        graphics.moveTo(startX, startY);
        graphics.lineTo(endX, endY);
    }
    
    graphics.stroke({ color: color, width: lineWidth, alpha: alpha });
}

// Рисование пунктирного квадрата
function drawDashedRect(graphics, x, y, size, dashLength, gapLength, color, lineWidth, alpha) {
    const halfSize = size / 2;
    const sides = [
        [{x: x - halfSize, y: y - halfSize}, {x: x + halfSize, y: y - halfSize}], // Верх
        [{x: x + halfSize, y: y - halfSize}, {x: x + halfSize, y: y + halfSize}], // Право
        [{x: x + halfSize, y: y + halfSize}, {x: x - halfSize, y: y + halfSize}], // Низ
        [{x: x - halfSize, y: y + halfSize}, {x: x - halfSize, y: y - halfSize}]  // Лево
    ];
    
    sides.forEach(side => {
        const start = side[0];
        const end = side[1];
        const length = Math.sqrt(Math.pow(end.x - start.x, 2) + Math.pow(end.y - start.y, 2));
        const totalDashLength = dashLength + gapLength;
        const numDashes = Math.floor(length / totalDashLength);
        
        for (let i = 0; i < numDashes; i++) {
            const t1 = (i * totalDashLength) / length;
            const t2 = ((i * totalDashLength) + dashLength) / length;
            
            const startX = start.x + (end.x - start.x) * t1;
            const startY = start.y + (end.y - start.y) * t1;
            const endX = start.x + (end.x - start.x) * t2;
            const endY = start.y + (end.y - start.y) * t2;
            
            graphics.moveTo(startX, startY);
            graphics.lineTo(endX, endY);
        }
    });
    
    graphics.stroke({ color: color, width: lineWidth, alpha: alpha });
}

// Рисование пунктирного треугольника
function drawDashedTriangle(graphics, x, y, size, dashLength, gapLength, color, lineWidth, alpha) {
    const height = size * Math.sqrt(3) / 2;
    const halfBase = size / 2;
    const centroidOffsetY = height / 3;
    
    const points = [
        {x: x, y: y - (height - centroidOffsetY)},           // Верхняя точка
        {x: x + halfBase, y: y + centroidOffsetY},           // Правая нижняя точка
        {x: x - halfBase, y: y + centroidOffsetY},           // Левая нижняя точка
    ];
    
    for (let i = 0; i < 3; i++) {
        const start = points[i];
        const end = points[(i + 1) % 3];
        const length = Math.sqrt(Math.pow(end.x - start.x, 2) + Math.pow(end.y - start.y, 2));
        const totalDashLength = dashLength + gapLength;
        const numDashes = Math.floor(length / totalDashLength);
        
        for (let j = 0; j < numDashes; j++) {
            const t1 = (j * totalDashLength) / length;
            const t2 = ((j * totalDashLength) + dashLength) / length;
            
            const startX = start.x + (end.x - start.x) * t1;
            const startY = start.y + (end.y - start.y) * t1;
            const endX = start.x + (end.x - start.x) * t2;
            const endY = start.y + (end.y - start.y) * t2;
            
            graphics.moveTo(startX, startY);
            graphics.lineTo(endX, endY);
        }
    }
    
    graphics.stroke({ color: color, width: lineWidth, alpha: alpha });
}

// Рисование градиентного углубления для круга
function drawGradientCircleDepression(graphics, x, y, radius, gradientConfig) {
    const { width, innerColor, outerColor, innerAlpha, outerAlpha } = gradientConfig;
    
    if (isDev) {
        console.log('🌅 Рисуем градиентное углубление для круга:', { radius, width, innerColor, outerColor });
    }
    
    // Создаем несколько концентрических кругов для имитации градиента (внутрь от контура)
    const steps = 20; // Количество шагов градиента
    const stepWidth = width / steps;
    
    for (let i = 0; i < steps; i++) {
        const progress = i / (steps - 1); // От 0 до 1
        const currentRadius = radius - (i * stepWidth); // Идем от контура внутрь
        
        // Интерполируем цвет
        const currentColor = interpolateColor(innerColor, outerColor, progress);
        
        // Интерполируем прозрачность
        const currentAlpha = innerAlpha + (outerAlpha - innerAlpha) * progress;
        
        // Рисуем кольцо
        graphics.circle(x, y, currentRadius);
        graphics.stroke({ color: currentColor, width: stepWidth, alpha: currentAlpha });
    }
}

// Рисование градиентного углубления для квадрата
function drawGradientRectDepression(graphics, x, y, size, gradientConfig, borderRadius = 0) {
    const { width, innerColor, outerColor, innerAlpha, outerAlpha } = gradientConfig;
    
    if (isDev) {
        console.log('🌅 Рисуем градиентное углубление для квадрата:', { size, width, innerColor, outerColor, borderRadius });
    }
    
    const steps = 20;
    const stepWidth = width / steps;
    const halfSize = size / 2;
    
    for (let i = 0; i < steps; i++) {
        const progress = i / (steps - 1);
        const currentSize = size - (i * stepWidth * 2); // Исправлено: идем внутрь
        const currentHalfSize = currentSize / 2;
        const currentBorderRadius = borderRadius * (currentSize / size); // Пропорциональное уменьшение радиуса
        
        // Интерполируем цвет и прозрачность
        const currentColor = interpolateColor(innerColor, outerColor, progress);
        const currentAlpha = innerAlpha + (outerAlpha - innerAlpha) * progress;
        
        // Рисуем квадрат со скругленными углами
        graphics.roundRect(x - currentHalfSize, y - currentHalfSize, currentSize, currentSize, currentBorderRadius);
        graphics.stroke({ color: currentColor, width: stepWidth, alpha: currentAlpha });
    }
}

// Рисование градиентного углубления для треугольника
function drawGradientTriangleDepression(graphics, x, y, size, gradientConfig, borderRadius = 0) {
    const { width, innerColor, outerColor, innerAlpha, outerAlpha } = gradientConfig;
    
    if (isDev) {
        console.log('🌅 Рисуем градиентное углубление для треугольника:', { size, width, innerColor, outerColor, borderRadius });
    }
    
    const steps = 20;
    const stepWidth = width / steps;
    
    // Корректируем размер треугольника с учетом скругления
    const adjustedSize = borderRadius > 0 ? size - borderRadius * 0.5 : size;
    
    for (let i = 0; i < steps; i++) {
        const progress = i / (steps - 1);
        const currentSize = adjustedSize - (i * stepWidth * 2); // Начинаем с скорректированного размера
        const currentBorderRadius = borderRadius * (currentSize / adjustedSize); // Пропорциональное уменьшение радиуса
        
        // Интерполируем цвет и прозрачность
        const currentColor = interpolateColor(innerColor, outerColor, progress);
        const currentAlpha = innerAlpha + (outerAlpha - innerAlpha) * progress;
        
        // Рисуем треугольник со скругленными углами
        if (borderRadius > 0) {
            drawRoundedTriangleShape(graphics, x, y, currentSize, currentBorderRadius);
        } else {
            drawTriangleShape(graphics, x, y, currentSize);
        }
        graphics.stroke({ color: currentColor, width: stepWidth, alpha: currentAlpha });
    }
}

// Рисование внешнего градиента для круга (выпуклость)
function drawOuterGradientCircle(graphics, x, y, radius, gradientConfig) {
    const { width, innerColor, outerColor, innerAlpha, outerAlpha } = gradientConfig;
    
    if (isDev) {
        console.log('🌅 Рисуем внешний градиент для круга:', { radius, width, innerColor, outerColor });
    }
    
    // Создаем несколько концентрических кругов для имитации градиента (внутрь от контура, как и внутренний)
    const steps = 20; // Количество шагов градиента
    const stepWidth = width / steps;
    
    for (let i = 0; i < steps; i++) {
        const progress = i / (steps - 1); // От 0 до 1
        const currentRadius = radius + (i * stepWidth); // Идем от контура наружу
        
        // Инвертируем прогресс для внешнего градиента (темный у контура, прозрачный снаружи)
        const invertedProgress = 1 - progress;
        
        // Интерполируем цвет
        const currentColor = interpolateColor(outerColor, innerColor, invertedProgress);
        
        // Интерполируем прозрачность
        const currentAlpha = outerAlpha + (innerAlpha - outerAlpha) * invertedProgress;
        
        // Рисуем кольцо
        graphics.circle(x, y, currentRadius);
        graphics.stroke({ color: currentColor, width: stepWidth, alpha: currentAlpha });
    }
}

// Рисование внешнего градиента для квадрата (выпуклость)
function drawOuterGradientRect(graphics, x, y, size, gradientConfig, borderRadius = 0) {
    const { width, innerColor, outerColor, innerAlpha, outerAlpha } = gradientConfig;
    
    if (isDev) {
        console.log('🌅 Рисуем внешний градиент для квадрата:', { size, width, innerColor, outerColor, borderRadius });
    }
    
    const steps = 20;
    const stepWidth = width / steps;
    
    for (let i = 0; i < steps; i++) {
        const progress = i / (steps - 1);
        const currentSize = size + (i * stepWidth * 2); // Идем от контура наружу
        const currentHalfSize = currentSize / 2;
        const currentBorderRadius = borderRadius * (currentSize / size); // Пропорциональное увеличение радиуса
        
        // Инвертируем прогресс для внешнего градиента (темный у контура, прозрачный снаружи)
        const invertedProgress = 1 - progress;
        
        // Интерполируем цвет и прозрачность
        const currentColor = interpolateColor(outerColor, innerColor, invertedProgress);
        const currentAlpha = outerAlpha + (innerAlpha - outerAlpha) * invertedProgress;
        
        // Рисуем квадрат со скругленными углами
        graphics.roundRect(x - currentHalfSize, y - currentHalfSize, currentSize, currentSize, currentBorderRadius);
        graphics.stroke({ color: currentColor, width: stepWidth, alpha: currentAlpha });
    }
}

// Рисование внешнего градиента для треугольника (выпуклость)
function drawOuterGradientTriangle(graphics, x, y, size, gradientConfig, borderRadius = 0) {
    const { width, innerColor, outerColor, innerAlpha, outerAlpha } = gradientConfig;
    
    if (isDev) {
        console.log('🌅 Рисуем внешний градиент для треугольника:', { size, width, innerColor, outerColor, borderRadius });
    }
    
    const steps = 20;
    const stepWidth = width / steps;
    
    for (let i = 0; i < steps; i++) {
        const progress = i / (steps - 1);
        const currentSize = size + (i * stepWidth * 2); // Идем от контура наружу
        const currentBorderRadius = borderRadius * (currentSize / size); // Пропорциональное увеличение радиуса
        
        // Инвертируем прогресс для внешнего градиента (темный у контура, прозрачный снаружи)
        const invertedProgress = 1 - progress;
        
        // Интерполируем цвет и прозрачность
        const currentColor = interpolateColor(outerColor, innerColor, invertedProgress);
        const currentAlpha = outerAlpha + (innerAlpha - outerAlpha) * invertedProgress;
        
        // Рисуем треугольник со скругленными углами
        if (borderRadius > 0) {
            drawRoundedTriangleShape(graphics, x, y, currentSize, currentBorderRadius);
        } else {
            drawTriangleShape(graphics, x, y, currentSize);
        }
        graphics.stroke({ color: currentColor, width: stepWidth, alpha: currentAlpha });
    }
}


// Создание центральной формы с пульсирующей обводкой
function createCenterShapeWithPulse(x, y, cookieSize) {
    const container = new Graphics();
    const shapeSize = cookieSize * CONFIG.centerShape.sizePercent;
    const shapeConfig = { ...CONFIG.centerShape, size: shapeSize };
    
    // Создаем градиентное углубление если включено
    if (CONFIG.centerShape.gradient.enabled) {
        const gradientShape = new Graphics();
        const halfSize = shapeSize / 2;
        
        // Выбираем функцию рисования в зависимости от формы
        switch (CONFIG.centerShape.form) {
            case 1: // Круг
                drawGradientCircleDepression(gradientShape, 0, 0, halfSize, CONFIG.centerShape.gradient);
                break;
            case 2: // Квадрат
                drawGradientRectDepression(gradientShape, 0, 0, shapeSize, CONFIG.centerShape.gradient, CONFIG.centerShape.borderRadius);
                break;
            case 3: // Треугольник
                drawGradientTriangleDepression(gradientShape, 0, 0, shapeSize, CONFIG.centerShape.gradient, CONFIG.centerShape.borderRadius);
                break;
            default:
                drawGradientCircleDepression(gradientShape, 0, 0, halfSize, CONFIG.centerShape.gradient);
        }
        
        container.addChild(gradientShape);
        
        if (isDev) {
            console.log('🌅 Градиентное углубление добавлено для формы:', CONFIG.centerShape.form);
        }
    }
    
    // Создаем внешний градиент (выпуклость) если включен
    if (CONFIG.centerShape.outerGradient.enabled) {
        const outerGradientShape = new Graphics();
        const halfSize = shapeSize / 2;
        
        // Выбираем функцию рисования в зависимости от формы
        switch (CONFIG.centerShape.form) {
            case 1: // Круг
                drawOuterGradientCircle(outerGradientShape, 0, 0, halfSize, CONFIG.centerShape.outerGradient);
                break;
            case 2: // Квадрат
                drawOuterGradientRect(outerGradientShape, 0, 0, shapeSize, CONFIG.centerShape.outerGradient, CONFIG.centerShape.borderRadius);
                break;
            case 3: // Треугольник
                drawOuterGradientTriangle(outerGradientShape, 0, 0, shapeSize, CONFIG.centerShape.outerGradient, CONFIG.centerShape.borderRadius);
                break;
            default:
                drawOuterGradientCircle(outerGradientShape, 0, 0, halfSize, CONFIG.centerShape.outerGradient);
        }
        
        container.addChild(outerGradientShape);
        
        if (isDev) {
            console.log('🌅 Внешний градиент добавлен для формы:', CONFIG.centerShape.form);
        }
    }
    
    // Создаем основную форму только если градиент отключен
    if (!CONFIG.centerShape.gradient.enabled) {
        const mainShape = new Graphics();
        drawCenterShape(mainShape, 0, 0, shapeConfig);
        container.addChild(mainShape);
    }
    
    // Создаем пульсирующую обводку если включена
    if (CONFIG.centerShape.pulse.enabled) {
        const pulseShape = new Graphics();
        
        // Создаем точно такую же форму, но с другими параметрами
        const pulseConfig = {
            ...shapeConfig,
            color: CONFIG.centerShape.pulse.colorFrom,
            lineWidth: CONFIG.centerShape.pulse.lineWidth,
            alpha: CONFIG.centerShape.pulse.alpha,
            dashed: CONFIG.centerShape.pulse.dashed,
            dashLength: CONFIG.centerShape.pulse.dashLength,
            gapLength: CONFIG.centerShape.pulse.gapLength
        };
        
        drawCenterShape(pulseShape, 0, 0, pulseConfig);
        container.addChild(pulseShape);
        
        // Сохраняем ссылку на пульсирующую форму для анимации
        container.pulseShape = pulseShape;
        container.pulseStartTime = Date.now();
        container.cookieSize = cookieSize;
    }
    
    // Устанавливаем позицию контейнера
    container.x = x;
    container.y = y;
    
    return container;
}

// Создание текстуры через PixiJS Graphics
function createPixiTexture() {
    if (isDev) {
        console.log('🔶 Создаем PixiJS текстуру печенья');
        console.log('🎨 Узор на печенье:', CONFIG.cookie.painting);
    }
    
    // Создаем графический объект
    const graphics = new Graphics();
    
    // Рисуем основу печенья (новый синтаксис PixiJS v8)
    graphics.circle(200, 200, 180);
    graphics.fill(0xD2691E); // Коричневый цвет
    
    // Добавляем узоры на печенье
    drawCookiePatterns(graphics, CONFIG.cookie.painting);
    
    // Добавляем центральную форму
    drawCenterShape(graphics, 200, 200, CONFIG.centerShape);
    
    // Создаем текстуру из графики с правильными параметрами
    const app = window.app; // Получаем приложение
    const texture = app.renderer.generateTexture(graphics);
    
    // Добавляем в кеш Assets
    Assets.cache.set('cookie', texture);
    
    if (isDev) {
        console.log('✅ PixiJS текстура печенья создана');
        console.log('🖼️ Размер текстуры: 400x400px');
    }
}

// Создаем печенье
function createCookie(app) {
    // Получаем размеры игровой области
    const gameArea = document.querySelector('.game-area');
    const gameWidth = gameArea.clientWidth;
    const gameHeight = gameArea.clientHeight;
    
    // Вычисляем размер печенья (70% от минимальной стороны)
    const minSize = Math.min(gameWidth, gameHeight);
    const cookieSize = minSize * 0.7;
    
    // Создаем спрайт с текстурой
    const cookieTexture = Assets.get('cookie');
    const cookieSprite = new Sprite(cookieTexture);
    
    // Настраиваем размер и позицию
    cookieSprite.width = cookieSize;
    cookieSprite.height = cookieSize;
    cookieSprite.anchor.set(0.5); // Центр спрайта
    cookieSprite.x = gameWidth / 2;
    cookieSprite.y = gameHeight / 2;
    
    // Добавляем на сцену
    app.stage.addChild(cookieSprite);
    
    // Создаем и добавляем центральную форму поверх печенья
    const centerShapeContainer = createCenterShapeWithPulse(cookieSprite.x, cookieSprite.y, cookieSize);
    app.stage.addChild(centerShapeContainer);
    
    // Сохраняем ссылки для адаптивности
    window.cookie = cookieSprite;
    window.centerShape = centerShapeContainer;
    
    if (isDev) {
        console.log('🍪 Размер печенья:', cookieSize);
        console.log('📍 Позиция:', cookieSprite.x, cookieSprite.y);
    }
    
    return cookieSprite;
}

// Обновление размера печенья при изменении окна
function updateCookieSize() {
    // Получаем печенье из кеша
    const cookieSprite = window.cookie;
    const centerShapeGraphics = window.centerShape;
    if (!cookieSprite) return;
    
    // Получаем новые размеры игровой области
    const gameArea = document.querySelector('.game-area');
    const gameWidth = gameArea.clientWidth;
    const gameHeight = gameArea.clientHeight;
    
    // Вычисляем новый размер печенья (70% от минимальной стороны)
    const minSize = Math.min(gameWidth, gameHeight);
    const cookieSize = minSize * 0.7;
    
    // Обновляем размер спрайта
    cookieSprite.width = cookieSize;
    cookieSprite.height = cookieSize;
    
    // Обновляем позицию (центрируем)
    cookieSprite.x = gameWidth / 2;
    cookieSprite.y = gameHeight / 2;
    
    // Обновляем центральную форму
    const centerShapeContainer = window.centerShape;
    if (centerShapeContainer) {
        // Удаляем старый контейнер
        centerShapeContainer.parent?.removeChild(centerShapeContainer);
        
        // Создаем новый с обновленным размером
        const newCenterShape = createCenterShapeWithPulse(cookieSprite.x, cookieSprite.y, cookieSize);
        window.app.stage.addChild(newCenterShape);
        
        // Обновляем ссылку
        window.centerShape = newCenterShape;
    }
    
    // Обновляем размер иглы
    updateNeedleSize();
    
    console.log('🍪 Размер печенья обновлен:', cookieSize);
    console.log('📍 Новая позиция:', cookieSprite.x, cookieSprite.y);
}

// Обновление размера иглы при изменении окна
function updateNeedleSize() {
    const needleSprite = window.needle;
    if (!needleSprite) return;
    
    const gameArea = document.querySelector('.game-area');
    const gameWidth = gameArea.clientWidth;
    const gameHeight = gameArea.clientHeight;
    
    // Вычисляем новый размер иглы относительно печенья
    const minSize = Math.min(gameWidth, gameHeight);
    const cookieSize = minSize * 0.7;
    const needleSize = cookieSize * (CONFIG.needle.sizePercent / 100);
    
    // Обновляем масштаб иглы
    const needleTexture = needleSprite.texture;
    const scale = needleSize / Math.max(needleTexture.width, needleTexture.height);
    needleSprite.scale.set(scale);
    
    // Обновляем позицию для мобильных устройств
    if (isMobile) {
        needleSprite.x = gameWidth * CONFIG.needle.mobile.staticPosition.x;
        needleSprite.y = gameHeight * CONFIG.needle.mobile.staticPosition.y;
        needleBaseY = needleSprite.y;
    }
    
    console.log('🪡 Размер иглы обновлен:', needleSize, 'scale:', scale);
}

// Загрузка текстуры иглы
async function loadNeedleTexture() {
    try {
        // Способ 1: Динамический import
        const needleImageUrl = (await import('./assets/textures/needle.png')).default;
        
        if (isDev) {
            console.log('🔍 Загружаем текстуру иглы');
            console.log('📁 URL текстуры иглы:', needleImageUrl);
        }
        
        if (needleImageUrl) {
            // Создаем Image элемент
            const img = new Image();
            
            // Промис для загрузки изображения
            const imageLoaded = new Promise((resolve, reject) => {
                img.onload = () => resolve(img);
                img.onerror = reject;
            });
            
            img.src = needleImageUrl;
            await imageLoaded;
            
            // Создаем текстуру из изображения
            const texture = Texture.from(img);
            
            // Добавляем в кеш
            Assets.cache.set('needle', texture);
            
            if (isDev) {
                console.log('✅ Текстура иглы загружена');
                console.log('🖼️ Размер текстуры иглы:', texture.width, 'x', texture.height);
            }
            return;
        }
        
        throw new Error('Import иглы вернул undefined');
        
    } catch (error) {
        console.error('❌ Не удалось загрузить текстуру иглы:', error);
        
        // Создаем простую иглу программно
        createProgrammaticNeedle();
    }
}

// Создание программной иглы как fallback
function createProgrammaticNeedle() {
    if (isDev) {
        console.log('🔶 Создаем программную иглу');
    }
    
    const graphics = new Graphics();
    
    // Рисуем простую иглу
    // Острие
    graphics.moveTo(0, 0);
    graphics.lineTo(3, 10);
    graphics.lineTo(-3, 10);
    graphics.closePath();
    graphics.fill(0x888888);
    
    // Стержень
    graphics.rect(-1, 10, 2, 20);
    graphics.fill(0x888888);
    
    // Ушко
    graphics.circle(0, 32, 3);
    graphics.stroke({ color: 0x888888, width: 1 });
    
    // Создаем текстуру
    const app = window.app;
    const texture = app.renderer.generateTexture(graphics);
    
    // Добавляем в кеш
    Assets.cache.set('needle', texture);
    
    if (isDev) {
        console.log('✅ Программная игла создана');
    }
}

// Создание спрайта иглы
function createNeedle(app) {
    const needleTexture = Assets.get('needle');
    const needleSprite = new Sprite(needleTexture);
    
    // Вычисляем размер иглы относительно печенья
    const gameArea = document.querySelector('.game-area');
    const gameWidth = gameArea.clientWidth;
    const gameHeight = gameArea.clientHeight;
    const minSize = Math.min(gameWidth, gameHeight);
    const cookieSize = minSize * 0.7;
    const needleSize = cookieSize * (CONFIG.needle.sizePercent / 100);
    
    // Настройка иглы
    const scale = needleSize / Math.max(needleTexture.width, needleTexture.height);
    needleSprite.scale.set(scale);
    needleSprite.zIndex = 1000; // Игла всегда сверху
    
    // Устанавливаем начальную позицию для мобильных устройств
    if (isMobile) {
        needleSprite.visible = true;
        needleSprite.anchor.set(CONFIG.needle.mouseOffset.x, CONFIG.needle.mouseOffset.y); // Левый нижний угол
        needleSprite.x = gameWidth * CONFIG.needle.mobile.staticPosition.x;
        needleSprite.y = gameHeight * CONFIG.needle.mobile.staticPosition.y;
        needleBaseY = needleSprite.y;
    } else {
        needleSprite.visible = CONFIG.needle.visible;
    }
    
    // Добавляем на сцену
    app.stage.addChild(needleSprite);
    
    // Сохраняем ссылку для доступа
    window.needle = needleSprite;
    console.log('🪡 Размер иглы:', needleSize, 'scale:', scale);
    console.log('📱 Мобильное устройство:', isMobile);
    
    return needleSprite;
}

// Настройка интерактивности
function setupInteractivity(app) {
    const gameArea = document.querySelector('.game-area');
    const needleSprite = window.needle;
    
    if (!needleSprite) {
        console.error('❌ Спрайт иглы не найден');
        return;
    }
    
    // Принудительная отладка
    showTouchDebug(`SETUP: ${isMobile ? 'MOBILE' : 'DESKTOP'}`);
    
    if (isMobile) {
        // Мобильные устройства - отдельная логика
        setupMobileInteractivity(gameArea);
    } else {
        // Десктопные устройства - логика с мышью
        setupDesktopInteractivity(gameArea);
    }
    
    // ПРИНУДИТЕЛЬНО добавляем базовые обработчики для всех устройств
    gameArea.addEventListener('click', (event) => {
        showTouchDebug('UNIVERSAL CLICK');
        
        const rect = gameArea.getBoundingClientRect();
        const x = event.clientX - rect.left;
        const y = event.clientY - rect.top;
        
        showTouchDebug(`CLICK: ${x.toFixed(0)}, ${y.toFixed(0)}`);
        
        if (isMobile) {
            animateNeedleToTouch(x, y);
            animateNeedlePress(true);
            
            setTimeout(() => {
                animateNeedlePress(false);
                setTimeout(() => {
                    const gameWidth = gameArea.clientWidth;
                    const gameHeight = gameArea.clientHeight;
                    const staticX = gameWidth * CONFIG.needle.mobile.staticPosition.x;
                    const staticY = gameHeight * CONFIG.needle.mobile.staticPosition.y;
                    animateNeedleToTouch(staticX, staticY);
                }, 200);
            }, 300);
        }
    });
    
    console.log('🖱️ Интерактивность настроена для', isMobile ? 'мобильного' : 'десктопного', 'устройства');
}

// Настройка интерактивности для десктопа
function setupDesktopInteractivity(gameArea) {
    // Обработка движения мыши
    gameArea.addEventListener('mousemove', (event) => {
        const rect = gameArea.getBoundingClientRect();
        const x = event.clientX - rect.left;
        const y = event.clientY - rect.top;
        
        updateNeedlePosition(x, y, 'mouse');
    });
    
    // Обработка входа мыши в область
    gameArea.addEventListener('mouseenter', () => {
        showNeedle();
    });
    
    // Обработка выхода мыши из области
    gameArea.addEventListener('mouseleave', () => {
        hideNeedle();
        animateNeedlePress(false); // Отпускаем иглу при выходе
    });
    
    // Обработка нажатия мыши
    gameArea.addEventListener('mousedown', (event) => {
        event.preventDefault();
        animateNeedlePress(true);
    });
    
    gameArea.addEventListener('mouseup', () => {
        animateNeedlePress(false);
    });
}

// Настройка интерактивности для мобильных устройств
function setupMobileInteractivity(gameArea) {
    console.log('🔧 Настраиваем мобильную интерактивность');
    showTouchDebug('SETUP MOBILE');
    
    // Добавляем обработчики на разные элементы для надежности
    const canvas = document.getElementById('game-canvas');
    const elements = [gameArea, canvas, document.body, window];
    
    elements.forEach((element, index) => {
        // Обработка касаний
        element.addEventListener('touchstart', (event) => {
            showTouchDebug(`TOUCH START ${index}`);
            
            // Только для gameArea выполняем анимацию
            if (element === gameArea) {
                event.preventDefault();
                const touch = event.touches[0];
                const rect = gameArea.getBoundingClientRect();
                const x = touch.clientX - rect.left;
                const y = touch.clientY - rect.top;
                
                showTouchDebug(`TOUCH: ${x.toFixed(0)}, ${y.toFixed(0)}`);
                
                // Анимируем перемещение иглы к точке касания (левый нижний угол к касанию)
                animateNeedleToTouch(x, y);
                
                // Запускаем анимацию нажатия
                animateNeedlePress(true);
            }
        }, { passive: false });
        
        element.addEventListener('touchend', (event) => {
            showTouchDebug(`TOUCH END ${index}`);
            
            // Только для gameArea выполняем анимацию
            if (element === gameArea) {
                // Отпускаем иглу
                animateNeedlePress(false);
                
                // Возвращаем иглу в исходную позицию
                setTimeout(() => {
                    const gameWidth = gameArea.clientWidth;
                    const gameHeight = gameArea.clientHeight;
                    const staticX = gameWidth * CONFIG.needle.mobile.staticPosition.x;
                    const staticY = gameHeight * CONFIG.needle.mobile.staticPosition.y;
                    animateNeedleToTouch(staticX, staticY);
                }, 200);
            }
        }, { passive: false });
    });
    
    // Добавляем pointer events как fallback
    gameArea.addEventListener('pointerdown', (event) => {
        showTouchDebug('POINTER DOWN');
        
        if (event.pointerType === 'touch') {
            const rect = gameArea.getBoundingClientRect();
            const x = event.clientX - rect.left;
            const y = event.clientY - rect.top;
            
            animateNeedleToTouch(x, y);
            animateNeedlePress(true);
        }
    });
    
    gameArea.addEventListener('pointerup', (event) => {
        showTouchDebug('POINTER UP');
        
        if (event.pointerType === 'touch') {
            animateNeedlePress(false);
            
            setTimeout(() => {
                const gameWidth = gameArea.clientWidth;
                const gameHeight = gameArea.clientHeight;
                const staticX = gameWidth * CONFIG.needle.mobile.staticPosition.x;
                const staticY = gameHeight * CONFIG.needle.mobile.staticPosition.y;
                animateNeedleToTouch(staticX, staticY);
            }, 200);
        }
    });
    
    // Добавляем обработчики click как еще один fallback
    gameArea.addEventListener('click', (event) => {
        showTouchDebug('CLICK EVENT');
        
        const rect = gameArea.getBoundingClientRect();
        const x = event.clientX - rect.left;
        const y = event.clientY - rect.top;
        
        animateNeedleToTouch(x, y);
        animateNeedlePress(true);
        
        // Автоматически отпускаем через короткое время
        setTimeout(() => {
            animateNeedlePress(false);
            
            setTimeout(() => {
                const gameWidth = gameArea.clientWidth;
                const gameHeight = gameArea.clientHeight;
                const staticX = gameWidth * CONFIG.needle.mobile.staticPosition.x;
                const staticY = gameHeight * CONFIG.needle.mobile.staticPosition.y;
                animateNeedleToTouch(staticX, staticY);
            }, 200);
        }, 300);
    });
    
    // Добавляем обработчики mousedown/mouseup для мобильных как fallback
    gameArea.addEventListener('mousedown', (event) => {
        showTouchDebug('MOUSEDOWN EVENT');
        
        const rect = gameArea.getBoundingClientRect();
        const x = event.clientX - rect.left;
        const y = event.clientY - rect.top;
        
        animateNeedleToTouch(x, y);
        animateNeedlePress(true);
    });
    
    gameArea.addEventListener('mouseup', (event) => {
        showTouchDebug('MOUSEUP EVENT');
        
        animateNeedlePress(false);
        
        setTimeout(() => {
            const gameWidth = gameArea.clientWidth;
            const gameHeight = gameArea.clientHeight;
            const staticX = gameWidth * CONFIG.needle.mobile.staticPosition.x;
            const staticY = gameHeight * CONFIG.needle.mobile.staticPosition.y;
            animateNeedleToTouch(staticX, staticY);
        }, 200);
    });
}

// Показать иглу
function showNeedle() {
    const needleSprite = window.needle;
    if (needleSprite) {
        needleSprite.visible = true;
        
        if (isDev) {
            console.log('👁️ Игла показана');
        }
    }
}

// Скрыть иглу
function hideNeedle() {
    const needleSprite = window.needle;
    if (needleSprite) {
        needleSprite.visible = false;
        
        if (isDev) {
            console.log('🙈 Игла скрыта');
        }
    }
}

// Обновить позицию иглы
function updateNeedlePosition(x, y, inputType) {
    const needleSprite = window.needle;
    if (!needleSprite) return;
    
    const needleConfig = CONFIG.needle;
    
    if (inputType === 'mouse') {
        // Для мыши - левый нижний угол
        needleSprite.anchor.set(needleConfig.mouseOffset.x, needleConfig.mouseOffset.y);
        needleSprite.x = x;
        needleSprite.y = y;
        needleBaseY = y;
    } else if (inputType === 'touch') {
        // Для касания - центр
        needleSprite.anchor.set(needleConfig.touchOffset.x, needleConfig.touchOffset.y);
        needleSprite.x = x;
        needleSprite.y = y;
        needleBaseY = y;
    }
}

// Анимация нажатия иглы
function animateNeedlePress(pressed) {
    const needleSprite = window.needle;
    if (!needleSprite) return;
    
    const pressConfig = CONFIG.needle.pressAnimation;
    needlePressed = pressed;
    
    // Останавливаем предыдущую анимацию
    if (needleSprite.pressAnimation) {
        cancelAnimationFrame(needleSprite.pressAnimation);
    }
    
    // Создаем новую анимацию
    const targetY = pressed ? needleBaseY + pressConfig.offsetY : needleBaseY;
    const duration = pressConfig.duration * 1000; // Переводим в миллисекунды
    
    // Простая анимация через requestAnimationFrame
    const startY = needleSprite.y;
    const deltaY = targetY - startY;
    const startTime = performance.now();
    
    function animate() {
        const now = performance.now();
        const elapsed = now - startTime;
        const progress = Math.min(elapsed / duration, 1);
        
        // Используем ease-out для плавности
        const easeProgress = 1 - Math.pow(1 - progress, 3);
        
        needleSprite.y = startY + deltaY * easeProgress;
        
        if (progress < 1) {
            needleSprite.pressAnimation = requestAnimationFrame(animate);
        } else {
            needleSprite.pressAnimation = null;
        }
    }
    
    needleSprite.pressAnimation = requestAnimationFrame(animate);
}

// Анимация перемещения иглы к касанию (для мобильных)
function animateNeedleToTouch(targetX, targetY) {
    const needleSprite = window.needle;
    if (!needleSprite) return;
    
    const duration = CONFIG.needle.mobile.animationDuration * 1000;
    
    // Останавливаем предыдущую анимацию
    if (needleSprite.moveAnimation) {
        cancelAnimationFrame(needleSprite.moveAnimation);
    }
    
    const startX = needleSprite.x;
    const startY = needleSprite.y;
    const deltaX = targetX - startX;
    const deltaY = targetY - startY;
    const startTime = performance.now();
    
    function animate() {
        const now = performance.now();
        const elapsed = now - startTime;
        const progress = Math.min(elapsed / duration, 1);
        
        // Используем ease-out для плавности
        const easeProgress = 1 - Math.pow(1 - progress, 3);
        
        needleSprite.x = startX + deltaX * easeProgress;
        needleSprite.y = startY + deltaY * easeProgress;
        
        // Обновляем базовую позицию Y для анимации нажатия
        needleBaseY = needleSprite.y;
        
        if (progress < 1) {
            needleSprite.moveAnimation = requestAnimationFrame(animate);
        } else {
            needleSprite.moveAnimation = null;
        }
    }
    
    needleSprite.moveAnimation = requestAnimationFrame(animate);
}

// Функция интерполяции цветов
function interpolateColor(colorFrom, colorTo, factor) {
    // Извлекаем RGB компоненты из hex цветов
    const rFrom = (colorFrom >> 16) & 0xFF;
    const gFrom = (colorFrom >> 8) & 0xFF;
    const bFrom = colorFrom & 0xFF;
    
    const rTo = (colorTo >> 16) & 0xFF;
    const gTo = (colorTo >> 8) & 0xFF;
    const bTo = colorTo & 0xFF;
    
    // Интерполируем каждый компонент
    const r = Math.round(rFrom + (rTo - rFrom) * factor);
    const g = Math.round(gFrom + (gTo - gFrom) * factor);
    const b = Math.round(bFrom + (bTo - bFrom) * factor);
    
    // Объединяем обратно в hex
    return (r << 16) | (g << 8) | b;
}

// Функция анимации пульсации
function startPulseAnimation(app) {
    function animate() {
        const centerShapeContainer = window.centerShape;
        
        if (centerShapeContainer && centerShapeContainer.pulseShape && CONFIG.centerShape.pulse.enabled) {
            const currentTime = Date.now();
            const elapsed = (currentTime - centerShapeContainer.pulseStartTime) / 1000; // в секундах
            const pulseConfig = CONFIG.centerShape.pulse;
            
            // Вычисляем текущий фактор интерполяции на основе синусоиды
            const phase = elapsed * pulseConfig.speed * 2 * Math.PI;
            const normalizedSin = (Math.sin(phase) + 1) / 2; // нормализуем от 0 до 1
            
            // Интерполируем цвет
            const currentColor = interpolateColor(pulseConfig.colorFrom, pulseConfig.colorTo, normalizedSin);
            
            // Пересоздаем пульсирующую форму с новым цветом
            const pulseShape = centerShapeContainer.pulseShape;
            if (pulseShape) {
                pulseShape.clear();
                
                // Получаем параметры формы
                const shapeSize = centerShapeContainer.cookieSize * CONFIG.centerShape.sizePercent;
                const pulseConfigUpdated = {
                    form: CONFIG.centerShape.form,
                    size: shapeSize,
                    color: currentColor,
                    lineWidth: pulseConfig.lineWidth,
                    alpha: pulseConfig.alpha,
                    dashed: pulseConfig.dashed,
                    dashLength: pulseConfig.dashLength,
                    gapLength: pulseConfig.gapLength,
                    borderRadius: CONFIG.centerShape.borderRadius
                };
                
                drawCenterShape(pulseShape, 0, 0, pulseConfigUpdated);
            }
        }
        
        requestAnimationFrame(animate);
    }
    
    animate();
}

// Запуск приложения
initApp().catch(console.error);