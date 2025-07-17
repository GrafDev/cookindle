import { Application, Assets, Sprite, Graphics, Texture, BlurFilter, Container, FillGradient } from 'pixi.js';
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
let currentClickPoint = { x: 0, y: 0 }; // Текущая точка клика/касания
let isDragging = false; // Состояние перетаскивания

// Глобальные переменные для игры
let gameOverShown = false; // Флаг показа модалки Game Over
let victoryShown = false; // Флаг показа модалки поздравления

// Глобальные переменные для системы отколов
let chipsContainer = null; // Контейнер для падающих осколков
let activeChips = []; // Массив падающих осколков


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
    // Восстанавливаем сохраненное состояние конфига при загрузке
    restoreConfigState();
    
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
        backgroundAlpha: CONFIG.pixi.backgroundAlpha,
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

// Установка прозрачных фонов для CSS элементов
function makeBackgroundsTransparent() {
    // Убираем отступы и фон у html и body
    document.documentElement.style.cssText = `
        margin: 0;
        padding: 0;
        background: transparent;
    `;
    
    document.body.style.cssText = `
        margin: 0;
        padding: 0;
        background: transparent;
    `;
    
    // Убираем фон у layout
    const layout = document.querySelector('.layout');
    if (layout) {
        layout.style.backgroundColor = 'transparent';
    }
    
    // Убираем фон у game-area и скрываем курсор
    const gameArea = document.querySelector('.game-area');
    const canvas = document.getElementById('game-canvas');
    
    if (gameArea) {
        gameArea.style.backgroundColor = 'transparent';
        gameArea.style.cursor = 'none'; // Скрываем курсор, так как используем иглу
    }
    
    if (canvas) {
        canvas.style.cursor = 'none'; // Скрываем курсор на канвасе
    }
    
    // Скрываем курсор на всем body для надежности
    document.body.style.cursor = 'none';
    
    // Добавляем обработчики для возврата курсора вне игровой области
    if (gameArea) {
        // Когда мышь покидает игровую область - показываем курсор
        gameArea.addEventListener('mouseleave', () => {
            document.body.style.cursor = 'default';
        });
        
        // Когда мышь входит в игровую область - скрываем курсор
        gameArea.addEventListener('mouseenter', () => {
            document.body.style.cursor = 'none';
        });
    }
    
    if (isDev) {
        console.log('🔍 CSS фоны сделаны прозрачными, отступы убраны');
    }
}

// Инициализация игры
async function initGame(app) {
    try {
        // Загрузка ресурсов
        await loadAssets();
        
        // Делаем CSS фоны прозрачными
        makeBackgroundsTransparent();
        
        // Создаем фон
        createBackground(app);
        
        // Создаем печенье
        createCookie(app);
        
        
        // Загружаем и создаем иглу
        await loadNeedleTexture();
        createNeedle(app);
        
        // Настраиваем интерактивность
        setupInteractivity(app);
        
        // Создаем кнопки смены формы (если включены в конфиге)
        if (CONFIG.dev.showShapeButtons) {
            createShapeButtons();
        }
        
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
        // Загружаем фон приложения
        const bgImageUrl = (await import('./assets/textures/bg.png')).default;
        
        // Загружаем печенье
        const cookieImageUrl = (await import('./assets/textures/bg_cooke.png')).default;
        
        if (isDev) {
            console.log('🔍 Загружаем изображения напрямую');
            console.log('📁 URL фона:', bgImageUrl);
            console.log('📁 URL печенья:', cookieImageUrl);
        }
        
        // Загружаем фон
        if (bgImageUrl) {
            const bgImg = new Image();
            const bgLoaded = new Promise((resolve, reject) => {
                bgImg.onload = () => resolve(bgImg);
                bgImg.onerror = reject;
            });
            bgImg.src = bgImageUrl;
            await bgLoaded;
            
            const bgTexture = Texture.from(bgImg);
            Assets.cache.set('background', bgTexture);
            
            if (isDev) {
                console.log('✅ Текстура фона загружена:', bgTexture.width, 'x', bgTexture.height);
            }
        }
        
        // Загружаем печенье
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
    const { form, size, color, lineWidth, alpha, dashed, dashLength, gapLength, secondBorder, borderRadius } = shapeConfig;
    
    
    const halfSize = size / 2;
    
    // Если пунктирная линия, используем специальные функции
    if (dashed && dashLength && gapLength) {
        switch (form) {
            case 1: // Круг
                drawDashedCircle(graphics, x, y, halfSize, dashLength, gapLength, color, lineWidth, alpha);
                break;
                
            case 2: // Квадрат
                drawDashedRect(graphics, x, y, size, dashLength, gapLength, color, lineWidth, alpha);
                break;
                
            case 3: // Треугольник
                drawDashedTriangle(graphics, x, y, size, dashLength, gapLength, color, lineWidth, alpha);
                break;
                
            default:
                drawDashedCircle(graphics, x, y, halfSize, dashLength, gapLength, color, lineWidth, alpha);
        }
    } else {
        // Сначала рисуем вторую границу (под основной) если включена
        if (secondBorder && secondBorder.enabled) {
            const secondLineWidth = lineWidth + secondBorder.widthOffset;
            const secondHalfSize = halfSize + (secondBorder.widthOffset / 2);
            
            switch (form) {
                case 1: // Круг
                    graphics.circle(x, y, secondHalfSize);
                    graphics.stroke({ color: secondBorder.color, width: secondLineWidth, alpha: secondBorder.alpha });
                    break;
                    
                case 2: // Квадрат
                    const secondOffset = secondHalfSize;
                    const secondSquareRadius = borderRadius ? borderRadius.square : 0;
                    graphics.roundRect(x - secondOffset, y - secondOffset, size + secondBorder.widthOffset, size + secondBorder.widthOffset, secondSquareRadius);
                    graphics.stroke({ color: secondBorder.color, width: secondLineWidth, alpha: secondBorder.alpha });
                    break;
                    
                case 3: // Треугольник
                    const secondTriangleRadius = borderRadius ? borderRadius.triangle : 0;
                    drawRoundedTriangleShape(graphics, x, y, size + secondBorder.widthOffset, secondTriangleRadius);
                    graphics.stroke({ color: secondBorder.color, width: secondLineWidth, alpha: secondBorder.alpha });
                    break;
                    
                default:
                    graphics.circle(x, y, secondHalfSize);
                    graphics.stroke({ color: secondBorder.color, width: secondLineWidth, alpha: secondBorder.alpha });
            }
        }
        
        // Рисуем только границу (заливка теперь делается через маску спрайта)
        switch (form) {
            case 1: // Круг
                graphics.circle(x, y, halfSize);
                graphics.stroke({ color: color, width: lineWidth, alpha: alpha });
                break;
                
            case 2: // Квадрат
                const squareRadius = borderRadius ? borderRadius.square : 0;
                graphics.roundRect(x - halfSize, y - halfSize, size, size, squareRadius);
                graphics.stroke({ color: color, width: lineWidth, alpha: alpha });
                break;
                
            case 3: // Треугольник
                const triangleRadius = borderRadius ? borderRadius.triangle : 0;
                drawRoundedTriangleShape(graphics, x, y, size, triangleRadius);
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

// Рисование закругленного треугольника
function drawRoundedTriangleShape(graphics, x, y, size, radius) {
    if (radius <= 0) {
        // Если радиус 0 или меньше, рисуем обычный треугольник
        drawTriangleShape(graphics, x, y, size);
        return;
    }
    
    const height = size * Math.sqrt(3) / 2;
    const halfBase = size / 2;
    const centroidOffsetY = height / 3;
    
    // Точки треугольника
    const p1 = { x: x, y: y - (height - centroidOffsetY) };           // Верхняя точка
    const p2 = { x: x + halfBase, y: y + centroidOffsetY };           // Правая нижняя точка
    const p3 = { x: x - halfBase, y: y + centroidOffsetY };           // Левая нижняя точка
    
    // Рисуем закругленный треугольник используя arc
    const points = [p1, p2, p3];
    
    // Начинаем с первой точки
    graphics.moveTo(
        points[0].x + radius * Math.cos(Math.atan2(points[2].y - points[0].y, points[2].x - points[0].x)),
        points[0].y + radius * Math.sin(Math.atan2(points[2].y - points[0].y, points[2].x - points[0].x))
    );
    
    // Рисуем стороны с закруглениями
    for (let i = 0; i < 3; i++) {
        const current = points[i];
        const next = points[(i + 1) % 3];
        const prev = points[(i + 2) % 3];
        
        // Вычисляем направления от текущей точки к соседним
        const toPrev = { x: prev.x - current.x, y: prev.y - current.y };
        const toNext = { x: next.x - current.x, y: next.y - current.y };
        
        // Нормализуем векторы
        const prevLen = Math.sqrt(toPrev.x * toPrev.x + toPrev.y * toPrev.y);
        const nextLen = Math.sqrt(toNext.x * toNext.x + toNext.y * toNext.y);
        
        toPrev.x /= prevLen;
        toPrev.y /= prevLen;
        toNext.x /= nextLen;
        toNext.y /= nextLen;
        
        // Точки начала и конца дуги
        const arcStart = { x: current.x + radius * toPrev.x, y: current.y + radius * toPrev.y };
        const arcEnd = { x: current.x + radius * toNext.x, y: current.y + radius * toNext.y };
        
        // Рисуем линию до начала дуги
        graphics.lineTo(arcStart.x, arcStart.y);
        
        // Рисуем дугу (упрощенная версия - используем quadraticCurveTo)
        graphics.quadraticCurveTo(current.x, current.y, arcEnd.x, arcEnd.y);
    }
    
    graphics.closePath();
}

// Рисование пунктирной окружности
function drawDashedCircle(graphics, x, y, radius, dashLength, gapLength, color, lineWidth, alpha) {
    
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


// Создание центральной формы с пульсирующей обводкой
function createCenterShapeWithPulse(x, y, cookieSize, cookieSprite) {
    const container = new Graphics();
    const shapeSize = cookieSize * CONFIG.centerShape.sizePercent;
    const shapeConfig = { ...CONFIG.centerShape, size: shapeSize };
    
    // Создаем спрайт с текстурой печенья (как у кусочков)
    const cookieTexture = Assets.get('cookie');
    if (cookieTexture) {
        const textureSprite = new Sprite(cookieTexture);
        
        // Позиционируем спрайт так, чтобы он точно совпадал с оригинальной печенькой
        textureSprite.anchor.set(0.5);
        textureSprite.width = cookieSize; // Используем cookieSize вместо cookieSprite.width
        textureSprite.height = cookieSize;
        textureSprite.x = 0; // Позиция относительно контейнера
        textureSprite.y = 0;
        
        // Создаем маску в форме центральной формы
        const shapeMask = new Graphics();
        const halfSize = shapeSize / 2;
        
        switch (CONFIG.centerShape.form) {
            case 1: // Круг
                shapeMask.circle(0, 0, halfSize);
                break;
                
            case 2: // Квадрат
                const squareRadius = CONFIG.centerShape.borderRadius ? CONFIG.centerShape.borderRadius.square : 0;
                shapeMask.roundRect(-halfSize, -halfSize, shapeSize, shapeSize, squareRadius);
                break;
                
            case 3: // Треугольник
                const triangleRadius = CONFIG.centerShape.borderRadius ? CONFIG.centerShape.borderRadius.triangle : 0;
                drawRoundedTriangleShape(shapeMask, 0, 0, shapeSize, triangleRadius);
                break;
                
            default:
                shapeMask.circle(0, 0, halfSize);
        }
        shapeMask.fill({ color: 0xFFFFFF });
        
        // Применяем маску к спрайту
        textureSprite.mask = shapeMask;
        
        // Добавляем спрайт и маску в контейнер
        container.addChild(textureSprite);
        container.addChild(shapeMask);
    }
    
    // Создаем основную форму (только обводка)
    const mainShape = new Graphics();
    drawCenterShape(mainShape, 0, 0, shapeConfig);
    container.addChild(mainShape);
    
    // Добавляем пунктирные выгрызы прямо здесь
    if (CONFIG.centerShape.pulse.enabled) {
        console.log('🔥 Добавляем выгрызы к центральной форме!');
        const holes = generateHolePositions(0, 0, shapeConfig);
        console.log('🕳️ Найдено отверстий:', holes.length);
        
        holes.forEach(hole => {
            // Создаем спрайт с текстурой bg.png
            const bgTexture = Assets.get('background');
            if (bgTexture) {
                const bgSprite = new Sprite(bgTexture);
                
                // Центрируем спрайт
                bgSprite.anchor.set(0.5);
                bgSprite.x = hole.x;
                bgSprite.y = hole.y;
                
                // Создаем круглую маску
                const holeMask = new Graphics();
                holeMask.circle(hole.x, hole.y, 2); // Еще меньший размер кружка
                holeMask.fill(0xFFFFFF);
                
                // Применяем маску к спрайту
                bgSprite.mask = holeMask;
                
                // Добавляем спрайт и маску в контейнер
                container.addChild(bgSprite);
                container.addChild(holeMask);
                
                console.log('🖼️ Создан круглый кусочек фона в:', hole.x, hole.y);
            } else {
                console.log('❌ Не найдена текстура background');
            }
        });
        
        console.log('✅ Выгрызы добавлены к центральной форме');
    }
    
    // Устанавливаем позицию контейнера
    container.x = x;
    container.y = y;
    
    return container;
}


// Генерация позиций отверстий по контуру формы
function generateHolePositions(x, y, shapeConfig) {
    const { form, size } = shapeConfig;
    const halfSize = size / 2;
    const holes = [];
    
    // Параметры перфорации
    const holeSpacing = 15; // Расстояние между отверстиями
    
    switch (form) {
        case 1: // Круг
            const circumference = 2 * Math.PI * halfSize;
            const holeCount = Math.floor(circumference / holeSpacing);
            
            for (let i = 0; i < holeCount; i++) {
                const angle = (i / holeCount) * 2 * Math.PI;
                const holeX = x + Math.cos(angle) * halfSize;
                const holeY = y + Math.sin(angle) * halfSize;
                holes.push({ x: holeX, y: holeY });
            }
            break;
            
        case 2: // Квадрат
            const perimeter = 4 * size;
            const squareHoleCount = Math.floor(perimeter / holeSpacing);
            
            for (let i = 0; i < squareHoleCount; i++) {
                const progress = i / squareHoleCount;
                let holeX, holeY;
                
                if (progress < 0.25) {
                    // Верхняя сторона
                    holeX = x + (progress * 4 - 0.5) * size;
                    holeY = y - halfSize;
                } else if (progress < 0.5) {
                    // Правая сторона
                    holeX = x + halfSize;
                    holeY = y + ((progress - 0.25) * 4 - 0.5) * size;
                } else if (progress < 0.75) {
                    // Нижняя сторона
                    holeX = x + (0.5 - (progress - 0.5) * 4) * size;
                    holeY = y + halfSize;
                } else {
                    // Левая сторона
                    holeX = x - halfSize;
                    holeY = y + (0.5 - (progress - 0.75) * 4) * size;
                }
                
                holes.push({ x: holeX, y: holeY });
            }
            break;
            
        case 3: // Треугольник (исправленная геометрия)
            const triangleHeight = size * Math.sqrt(3) / 2;
            const triangleHalfBase = size / 2;
            const triangleCentroidOffsetY = triangleHeight / 3;
            const trianglePerimeter = 3 * size;
            const triangleHoleCount = Math.floor(trianglePerimeter / holeSpacing);
            
            // Вершины треугольника (точно как в drawTriangleShape)
            const trianglePoints = [
                {x: x, y: y - (triangleHeight - triangleCentroidOffsetY)},           // Верхняя точка
                {x: x + triangleHalfBase, y: y + triangleCentroidOffsetY},           // Правая нижняя точка
                {x: x - triangleHalfBase, y: y + triangleCentroidOffsetY},           // Левая нижняя точка
            ];
            
            for (let i = 0; i < triangleHoleCount; i++) {
                const progress = i / triangleHoleCount;
                let holeX, holeY;
                
                if (progress < 1/3) {
                    // Правая сторона (от верхней к правой нижней)
                    const t = progress * 3;
                    const start = trianglePoints[0];
                    const end = trianglePoints[1];
                    holeX = start.x + (end.x - start.x) * t;
                    holeY = start.y + (end.y - start.y) * t;
                } else if (progress < 2/3) {
                    // Нижняя сторона (от правой нижней к левой нижней)
                    const t = (progress - 1/3) * 3;
                    const start = trianglePoints[1];
                    const end = trianglePoints[2];
                    holeX = start.x + (end.x - start.x) * t;
                    holeY = start.y + (end.y - start.y) * t;
                } else {
                    // Левая сторона (от левой нижней к верхней)
                    const t = (progress - 2/3) * 3;
                    const start = trianglePoints[2];
                    const end = trianglePoints[0];
                    holeX = start.x + (end.x - start.x) * t;
                    holeY = start.y + (end.y - start.y) * t;
                }
                
                holes.push({ x: holeX, y: holeY });
            }
            break;
    }
    
    return holes;
}

// Добавление пунктирных "отверстий" которые берут цвет фона
function addPerforatedHoles(container, x, y, shapeConfig) {
    console.log('🔥 addPerforatedHoles вызвана!', x, y, shapeConfig);
    
    const holes = generateHolePositions(x, y, shapeConfig);
    console.log('🕳️ Найдено отверстий:', holes.length);
    
    if (holes.length === 0) {
        console.log('❌ Нет отверстий для создания!');
        return;
    }
    
    // Рисуем кружочки цвета фона (прозрачные или цвет страницы)
    holes.forEach(hole => {
        console.log('⚪ Создаем "отверстие" в:', hole.x, hole.y);
        const holeGraphics = new Graphics();
        holeGraphics.circle(hole.x, hole.y, 4);
        // Используем цвет фона страницы для имитации отверстий
        holeGraphics.fill(0xF5F5F5); // Светло-серый цвет фона страницы
        container.addChild(holeGraphics);
    });
    
    console.log('✅ Прозрачные "отверстия" добавлены в контейнер');
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

// Создаем фон всего приложения
function createBackground(app) {
    const backgroundTexture = Assets.get('background');
    if (!backgroundTexture) return;
    
    // Создаем фон как CSS элемент на всю страницу
    const bgElement = document.createElement('div');
    bgElement.style.cssText = `
        position: fixed;
        top: 0;
        left: 0;
        width: 100vw;
        height: 100vh;
        background-image: url('${backgroundTexture.source.resource.src}');
        background-size: cover;
        background-position: center;
        background-repeat: no-repeat;
        z-index: -1000;
        pointer-events: none;
    `;
    
    // Добавляем в body (не в gameArea!)
    document.body.appendChild(bgElement);
    
    // Сохраняем ссылку
    window.background = bgElement;
    
    if (isDev) {
        console.log('🖼️ Фон создан на весь экран:', window.innerWidth, 'x', window.innerHeight);
    }
}

// Создаем печенье
function createCookie(app) {
    // Получаем размеры игровой области
    const gameArea = document.querySelector('.game-area');
    const gameWidth = gameArea.clientWidth;
    const gameHeight = gameArea.clientHeight;
    
    // Вычисляем размер печенья из конфига
    const minSize = Math.min(gameWidth, gameHeight);
    const cookieSize = minSize * CONFIG.cookie.sizePercent;
    
    // Создаем спрайт с текстурой
    const cookieTexture = Assets.get('cookie');
    const cookieSprite = new Sprite(cookieTexture);
    
    // Настраиваем размер и позицию
    cookieSprite.width = cookieSize;
    cookieSprite.height = cookieSize;
    cookieSprite.anchor.set(0.5); // Центр спрайта
    cookieSprite.x = gameWidth / 2;
    cookieSprite.y = gameHeight / 2;
    
    // Скрываем печеньку - она нужна только для захвата текстуры
    cookieSprite.visible = false;
    // Добавляем на сцену (но невидимую)
    app.stage.addChild(cookieSprite);
    
    // Сохраняем ссылки для адаптивности
    window.cookie = cookieSprite;
    
    // Скрываем большой шестиугольник
    // const hexGraphics = drawBigHexagon(app, cookieSprite);
    
    // Размещаем маленькие шестиугольники
    const smallHexagons = generateSmallHexagons(app, cookieSprite);
    
    // Создаем и добавляем центральную форму ПОВЕРХ кусочков
    const centerShapeContainer = createCenterShapeWithPulse(cookieSprite.x, cookieSprite.y, cookieSize, cookieSprite);
    app.stage.addChild(centerShapeContainer);
    
    // Сохраняем ссылки для обновления размера
    window.centerShape = centerShapeContainer;
    // window.bigHexagon = hexGraphics; // Большой шестиугольник скрыт
    window.smallHexagons = smallHexagons;
    
    if (isDev) {
        console.log('🍪 Размер печенья:', cookieSize);
        console.log('📍 Позиция:', cookieSprite.x, cookieSprite.y);
    }
    
    return cookieSprite;
}

// ========================
// СИСТЕМА ШЕСТИУГОЛЬНИКОВ
// ========================

// Рисование большого шестиугольника вокруг печенья
function drawBigHexagon(app, cookieSprite) {
    const cookieRadius = cookieSprite.width / 2;
    const centerX = cookieSprite.x;
    const centerY = cookieSprite.y;
    
    // Радиус описанного шестиугольника = радиус вписанной окружности / cos(30°)
    const bigHexRadius = cookieRadius / Math.cos(Math.PI / 6);
    
    // Создаем графику для шестиугольника
    const hexGraphics = new Graphics();
    
    // Рисуем шестиугольник
    const vertices = [];
    for (let i = 0; i < 6; i++) {
        const angle = (i * Math.PI) / 3; // 60 градусов между вершинами
        const x = centerX + Math.cos(angle) * bigHexRadius;
        const y = centerY + Math.sin(angle) * bigHexRadius;
        vertices.push(x, y);
    }
    
    hexGraphics.poly(vertices);
    hexGraphics.stroke({ color: 0xFF0000, width: 3, alpha: 0.8 });
    
    // Добавляем на сцену
    app.stage.addChild(hexGraphics);
    
    if (isDev) {
        console.log(`🔷 Нарисован большой шестиугольник радиуса ${bigHexRadius.toFixed(1)}`);
        console.log(`🍪 Печенька радиуса ${cookieRadius.toFixed(1)} вписана в шестиугольник`);
    }
    
    return hexGraphics;
}


// Фильтрация синих кусочков - удаляем те, что не граничат с обычными
function filterEdgePiecesWithRegularNeighbors(hexagons, app) {
    const edgePieces = hexagons.filter(hex => hex.isEdgePiece);
    const regularPieces = hexagons.filter(hex => !hex.isEdgePiece && !hex.isInCenterShape);
    const toRemove = [];
    
    for (const edgeHex of edgePieces) {
        // Проверяем, есть ли у крайнего кусочка соседи среди обычных кусочков
        const neighbors = findHexagonNeighbors(edgeHex, regularPieces);
        
        if (neighbors.length === 0) {
            // Нет соседей среди обычных кусочков - удаляем
            toRemove.push(edgeHex);
            
            // Удаляем визуальный элемент со сцены
            if (edgeHex.container && edgeHex.container.parent) {
                edgeHex.container.parent.removeChild(edgeHex.container);
                edgeHex.container.destroy();
            }
        }
    }
    
    // Возвращаем отфильтрованный массив
    const filtered = hexagons.filter(hex => !toRemove.includes(hex));
    
    
    return filtered;
}

// Определение краевых кусочков центральной формы
function markEdgeOfCenterShapePieces(hexagons) {
    const centerPieces = hexagons.filter(hex => hex.isInCenterShape);
    
    for (const centerPiece of centerPieces) {
        // Найдем всех соседей этого кусочка
        const neighbors = findHexagonNeighbors(centerPiece, hexagons);
        
        // Проверим, есть ли среди соседей кусочки НЕ из центральной формы
        const hasNonCenterNeighbor = neighbors.some(neighbor => !neighbor.isInCenterShape);
        
        if (hasNonCenterNeighbor) {
            // Этот кусочек находится на краю центральной формы
            centerPiece.isEdgeOfCenterShape = true;
            
            // Добавляем зеленый оверлей (только если включен показ цветных оверлеев)
            if (centerPiece.container && CONFIG.dev.showColorOverlays) {
                const sides = CONFIG.cookie.pieces.polygonSides;
                const enlargedRadius = centerPiece.radius * CONFIG.cookie.pieces.sizeMultiplier;
                
                const greenOverlay = new Graphics();
                // Создаем вершины зеленого оверлея
                const overlayVertices = [];
                for (let j = 0; j < sides; j++) {
                    const angle = (j * 2 * Math.PI) / sides;
                    const vx = Math.cos(angle) * enlargedRadius;
                    const vy = Math.sin(angle) * enlargedRadius;
                    overlayVertices.push(vx, vy);
                }
                greenOverlay.poly(overlayVertices);
                greenOverlay.fill({ color: 0x00FF00, alpha: 0.3 }); // Прозрачный зеленый
                greenOverlay.x = 0;
                greenOverlay.y = 0;
                
                centerPiece.container.addChild(greenOverlay);
            }
            
            if (isDev) {
            }
        } else {
            centerPiece.isEdgeOfCenterShape = false;
        }
    }
}

// Генерация гексагональной сетки внутри окружности печенья
function generateSmallHexagons(app, cookieSprite) {
    const config = CONFIG.cookie.pieces;
    const hexGrid = config.hexGrid; // Количество шестиугольников в диаметре
    const cookieRadius = cookieSprite.width / 2;
    
    // Вычисляем размер одного шестиугольника на основе описанного шестиугольника
    // Радиус описанного шестиугольника = радиус вписанной окружности / cos(30°)
    const bigHexRadius = cookieRadius / Math.cos(Math.PI / 6);
    // Диагональ описанного шестиугольника (между противоположными вершинами) = 2 * bigHexRadius
    const bigHexDiameter = 2 * bigHexRadius;
    // hexGrid - количество маленьких шестиугольников между противоположными углами описанного шестиугольника
    // Расстояние между центрами шестиугольников в гексагональной сетке = radius * √3
    // Формула: bigHexDiameter = hexGrid * (smallHexRadius * √3)
    const smallHexRadius = bigHexDiameter / (hexGrid * Math.sqrt(3));
    
    const centerX = cookieSprite.x;
    const centerY = cookieSprite.y;
    
    const hexagons = [];
    let hexId = 0;
    
    if (isDev) {
        console.log(`🔍 Создаем гексагональную сетку: ${hexGrid} шестиугольников между углами описанного шестиугольника`);
        console.log(`🔍 Радиус печенья: ${cookieRadius.toFixed(1)}px`);
        console.log(`🔍 Радиус описанного шестиугольника: ${bigHexRadius.toFixed(1)}px`);
        console.log(`🔍 Диагональ описанного шестиугольника: ${bigHexDiameter.toFixed(1)}px`);
        console.log(`🔍 Размер одного маленького шестиугольника: ${smallHexRadius.toFixed(1)}px`);
    }
    
    
    // Создаем шестиугольник с возможностью поворота
    function createHexagon(x, y, hexId, color = 0x0000FF, rotationOffset = 0, isInCenterShape = false, isEdgePiece = false) {
        const hexGraphics = new Graphics();
        
        // Рисуем многоугольник с поворотом (из конфига)
        const vertices = [];
        const sides = CONFIG.cookie.pieces.polygonSides;
        const enlargedRadius = smallHexRadius * CONFIG.cookie.pieces.sizeMultiplier;
        for (let j = 0; j < sides; j++) {
            const angle = (j * 2 * Math.PI) / sides + rotationOffset;
            const vx = x + Math.cos(angle) * enlargedRadius;
            const vy = y + Math.sin(angle) * enlargedRadius;
            vertices.push(vx, vy);
        }
        
        // Создаем спрайт с полной текстурой печеньки
        const cookieTexture = Assets.get('cookie');
        const textureSprite = new Sprite(cookieTexture);
        
        // Позиционируем спрайт так, чтобы он точно совпадал с оригинальной печенькой
        textureSprite.anchor.set(0.5);
        textureSprite.width = cookieSprite.width;
        textureSprite.height = cookieSprite.height;
        textureSprite.x = cookieSprite.x;
        textureSprite.y = cookieSprite.y;
        
        // Создаем маску многоугольника в локальных координатах
        const mask = new Graphics();
        // Создаем вершины относительно позиции многоугольника
        const localVertices = [];
        for (let j = 0; j < sides; j++) {
            const angle = (j * 2 * Math.PI) / sides + rotationOffset;
            const vx = Math.cos(angle) * enlargedRadius;
            const vy = Math.sin(angle) * enlargedRadius;
            localVertices.push(vx, vy);
        }
        mask.poly(localVertices);
        mask.fill({ color: 0xFFFFFF });
        mask.x = x;
        mask.y = y;
        
        // Применяем маску к спрайту
        textureSprite.mask = mask;
        
        // Создаем контейнер для шестиугольника
        const hexContainer = new Container();
        
        // Контейнер позиционируется в позиции шестиугольника
        hexContainer.x = x;
        hexContainer.y = y;
        
        // Смещаем элементы относительно позиции контейнера
        textureSprite.x = cookieSprite.x - x;
        textureSprite.y = cookieSprite.y - y;
        mask.x = 0;
        mask.y = 0;
        
        hexContainer.addChild(textureSprite);
        hexContainer.addChild(mask);
        
        // Добавляем розовый оверлей для кусочков внутри центральной формы (только если включен показ оверлеев)
        if (isInCenterShape && CONFIG.dev.showColorOverlays) {
            const pinkOverlay = new Graphics();
            // Создаем вершины розового оверлея (как маска)
            const overlayVertices = [];
            for (let j = 0; j < sides; j++) {
                const angle = (j * 2 * Math.PI) / sides + rotationOffset;
                const vx = Math.cos(angle) * enlargedRadius;
                const vy = Math.sin(angle) * enlargedRadius;
                overlayVertices.push(vx, vy);
            }
            pinkOverlay.poly(overlayVertices);
            pinkOverlay.fill({ color: 0xFF69B4, alpha: 0.5 }); // Розовый с 50% прозрачности
            pinkOverlay.x = 0;
            pinkOverlay.y = 0;
            
            hexContainer.addChild(pinkOverlay);
        }
        
        // Добавляем синий оверлей для крайних кусочков (только если включен показ оверлеев)
        if (isEdgePiece && CONFIG.dev.showColorOverlays) {
            const blueOverlay = new Graphics();
            // Создаем вершины синего оверлея (как маска)
            const overlayVertices = [];
            for (let j = 0; j < sides; j++) {
                const angle = (j * 2 * Math.PI) / sides + rotationOffset;
                const vx = Math.cos(angle) * enlargedRadius;
                const vy = Math.sin(angle) * enlargedRadius;
                overlayVertices.push(vx, vy);
            }
            blueOverlay.poly(overlayVertices);
            blueOverlay.fill({ color: 0x0080FF, alpha: 0.3 }); // Прозрачный синий с 30% прозрачности
            blueOverlay.x = 0;
            blueOverlay.y = 0;
            
            hexContainer.addChild(blueOverlay);
        }
        
        // Добавляем цветной оверлей для разделенных кусочков и отладочных цветов
        if (CONFIG.dev.showSplitPieces && color !== 0x0000FF) {
            const colorOverlay = new Graphics();
            // Создаем вершины цветного оверлея
            const overlayVertices = [];
            for (let j = 0; j < sides; j++) {
                const angle = (j * 2 * Math.PI) / sides + rotationOffset;
                const vx = Math.cos(angle) * enlargedRadius;
                const vy = Math.sin(angle) * enlargedRadius;
                overlayVertices.push(vx, vy);
            }
            colorOverlay.poly(overlayVertices);
            colorOverlay.fill({ color: color, alpha: 0.6 }); // Цвет с 60% прозрачности
            colorOverlay.x = 0;
            colorOverlay.y = 0;
            
            hexContainer.addChild(colorOverlay);
        }
        
        // Убираем обводку - оставляем только текстуру
        
        // Убираем интерактивность контейнера, так как обработка происходит через иглу
        hexContainer.eventMode = 'none';
        
        // Добавляем на сцену
        app.stage.addChild(hexContainer);
        
        return {
            id: `small_hex_${hexId}`,
            graphics: null, // Убираем graphics так как нет обводки
            container: hexContainer,
            textureSprite: textureSprite,
            mask: mask,
            x: x,
            y: y,
            radius: smallHexRadius,
            index: hexId,
            originalColor: color,
            currentColor: color,
            isPainted: false,
            isInCenterShape: isInCenterShape, // Добавляем информацию о центральной форме
            isEdgePiece: isEdgePiece, // Добавляем информацию о крайних кусочках
            isEdgeOfCenterShape: false // Будет установлено позже в markEdgeOfCenterShapePieces
        };
    }
    
    // Параметры гексагональной сетки
    const rotationOffset = Math.PI / 6; // 30 градусов для всех
    const hexWidth = smallHexRadius * Math.sqrt(3); // Ширина шестиугольника (расстояние между центрами по горизонтали)
    const hexHeight = smallHexRadius * 1.5; // Высота между рядами (расстояние между центрами по вертикали)
    
    // Рассчитываем радиус сетки на основе желаемого количества шестиугольников в диаметре
    const hexGridRadius = Math.ceil(hexGrid / 2) + 1; // Половина от диаметра + запас
    
    if (isDev) {
        console.log(`🔍 Размер маленького шестиугольника: ${smallHexRadius.toFixed(1)}px`);
        console.log(`🔍 Радиус печенья: ${cookieRadius.toFixed(1)}px`);
        console.log(`🔍 Радиус сетки: ${hexGridRadius} (для ${hexGrid} шестиугольников в диаметре)`);
        console.log(`🔍 Размеры: hexWidth=${hexWidth.toFixed(1)}, hexHeight=${hexHeight.toFixed(1)}`);
    }
    
    // Генерируем гексагональную сетку с кубическими координатами
    for (let q = -hexGridRadius; q <= hexGridRadius; q++) {
        for (let r = Math.max(-hexGridRadius, -q - hexGridRadius); r <= Math.min(hexGridRadius, -q + hexGridRadius); r++) {
            const s = -q - r;
            
            // Проверяем, что мы в границах шестиугольника
            if (Math.abs(q) > hexGridRadius || Math.abs(r) > hexGridRadius || Math.abs(s) > hexGridRadius) {
                continue;
            }
            
            // Преобразуем кубические координаты (q, r, s) в декартовы (x, y)
            const x = centerX + hexWidth * (q + r * 0.5);
            const y = centerY + hexHeight * r;
            
            // Проверяем, пересекается ли шестиугольник с окружностью печенья
            const distanceFromCenter = Math.sqrt((x - centerX) ** 2 + (y - centerY) ** 2);
            
            // Шестиугольник должен иметь общую площадь с печеньем
            // Условие: расстояние от центра шестиугольника до центра печенья <= радиус печенья + радиус шестиугольника
            if (distanceFromCenter > cookieRadius + smallHexRadius) {
                continue; // Шестиугольник полностью вне печенья
            }
            
            // Дополнительная проверка: шестиугольник не должен быть слишком далеко от печенья
            // Если центр шестиугольника дальше чем радиус печенья - радиус шестиугольника, 
            // то он может частично выходить за границы
            const isInsideCookie = distanceFromCenter <= cookieRadius - smallHexRadius;
            const hasIntersection = distanceFromCenter <= cookieRadius + smallHexRadius;
            
            if (!hasIntersection) {
                continue; // Нет пересечения с печеньем
            }
            
            // Проверяем, находится ли кусочек внутри центральной формы
            const isInCenterShape = isPointInCoreArea(x, y);
            
            // Определяем, является ли кусочек крайним (пересекается, но не полностью внутри)
            const isEdgePiece = !isInsideCookie && hasIntersection;
            
            // Поворот для каждого многоугольника (случайный или фиксированный)
            const rotation = CONFIG.cookie.pieces.randomRotation ? 
                Math.random() * 2 * Math.PI : 
                rotationOffset;
            
            // Создаем временный кусочек для проверки пересечений
            const tempHex = {
                x: x,
                y: y,
                radius: smallHexRadius,
                id: hexId
            };
            
            // Проверяем, пересекается ли кусочек с границей центральной формы
            const intersectsBoundary = isHexagonIntersectingCenterBoundary(tempHex);
            
            if (intersectsBoundary) {
                // Вычисляем точки пересечения границы с кусочком
                const intersections = calculateShapeBoundaryIntersections(tempHex);
                
                if (intersections.length >= 2) {
                    // Создаем разделенные части с отдельными масками
                    const splitResult = createSplitHexagons(x, y, hexId, rotation, tempHex, intersections, isEdgePiece);
                    
                    if (splitResult) {
                        // Внутренняя часть
                        splitResult.innerHex.q = q;
                        splitResult.innerHex.r = r;
                        splitResult.innerHex.s = s;
                        splitResult.innerHex.isSplitPart = true;
                        splitResult.innerHex.partType = 'inner';
                        splitResult.innerHex.originalId = tempHex.id;
                        hexagons.push(splitResult.innerHex);
                        
                        // Внешняя часть
                        splitResult.outerHex.q = q;
                        splitResult.outerHex.r = r;
                        splitResult.outerHex.s = s;
                        splitResult.outerHex.isSplitPart = true;
                        splitResult.outerHex.partType = 'outer';
                        splitResult.outerHex.originalId = tempHex.id;
                        hexagons.push(splitResult.outerHex);
                        
                        hexId += 2; // Увеличиваем ID на 2 (для двух частей)
                    }
                } else {
                    // Если недостаточно точек пересечения, создаем обычный кусочек
                    let color = CONFIG.dev.splitPieceColors.regular;
                    // Основание (центральные кусочки) помечаем красным
                    // if (isInCenterShape) {
                    //     color = 0xFF0000; // Красный цвет для основания
                    // }
                    const hex = createHexagon(x, y, hexId++, color, rotation, isInCenterShape, isEdgePiece);
                    hex.q = q;
                    hex.r = r;
                    hex.s = s;
                    hexagons.push(hex);
                }
            } else {
                // Обычный кусочек без разделения
                // Цвет в зависимости от типа кусочка
                let color;
                // Стандартные цвета без маркировки
                if (isEdgePiece) {
                    color = CONFIG.dev.showSplitPieces ? CONFIG.dev.splitPieceColors.edgePiece : 0x0080FF;
                } else {
                    color = isInsideCookie ? 0x00FF00 : 0xFFFF00; // Зеленый - внутри, желтый - пересекается
                }
                
                // Основание (центральные кусочки) помечаем красным
                // if (isInCenterShape) {
                //     color = 0xFF0000; // Красный цвет для основания
                // }
                
                const hex = createHexagon(x, y, hexId++, color, rotation, isInCenterShape, isEdgePiece);
                
                // Добавляем кубические координаты для поиска соседей
                hex.q = q;
                hex.r = r;
                hex.s = s;
                
                hexagons.push(hex);
            }
            
        }
    }
    
    // Удаляем синие кусочки, которые не граничат с обычными
    const filteredHexagons = filterEdgePiecesWithRegularNeighbors(hexagons, app);
    
    // Определяем краевые кусочки центральной формы
    markEdgeOfCenterShapePieces(filteredHexagons);
    
    if (isDev) {
        console.log(`✅ Создано ${filteredHexagons.length} маленьких шестиугольников между противоположными углами`);
    }
    
    return filteredHexagons;
}


// Обновление размера печенья при изменении окна
function updateCookieSize() {
    // Получаем элементы из кеша
    const cookieSprite = window.cookie;
    const centerShapeGraphics = window.centerShape;
    const backgroundSprite = window.background;
    if (!cookieSprite) return;
    
    // Получаем новые размеры игровой области
    const gameArea = document.querySelector('.game-area');
    const gameWidth = gameArea.clientWidth;
    const gameHeight = gameArea.clientHeight;
    
    // Обновляем размер фона (CSS элемент автоматически масштабируется)
    if (window.background && isDev) {
        console.log('🖼️ Фон обновлен под новый размер экрана');
    }
    
    // Вычисляем новый размер печенья из конфига
    const minSize = Math.min(gameWidth, gameHeight);
    const cookieSize = minSize * CONFIG.cookie.sizePercent;
    
    // Обновляем размер спрайта
    cookieSprite.width = cookieSize;
    cookieSprite.height = cookieSize;
    
    // Обновляем позицию (центрируем)
    cookieSprite.x = gameWidth / 2;
    cookieSprite.y = gameHeight / 2;
    
    // Большой шестиугольник скрыт, не обновляем
    /*
    const bigHexagon = window.bigHexagon;
    if (bigHexagon) {
        // Удаляем старый шестиугольник
        bigHexagon.parent?.removeChild(bigHexagon);
        
        // Создаем новый с обновленным размером
        const newHexagon = drawBigHexagon(window.app, cookieSprite);
        
        // Обновляем ссылку
        window.bigHexagon = newHexagon;
    }
    */
    
    // Обновляем маленькие шестиугольники
    const smallHexagons = window.smallHexagons;
    if (smallHexagons && smallHexagons.length > 0) {
        // Удаляем старые шестиугольники
        smallHexagons.forEach(hex => {
            if (hex.container && hex.container.parent) {
                hex.container.parent.removeChild(hex.container);
                hex.container.destroy();
            } else if (hex.graphics && hex.graphics.parent) {
                hex.graphics.parent.removeChild(hex.graphics);
                hex.graphics.destroy();
            }
        });
        
        // Создаем новые с обновленным размером
        const newSmallHexagons = generateSmallHexagons(window.app, cookieSprite);
        
        // Обновляем ссылку
        window.smallHexagons = newSmallHexagons;
    }
    
    // Обновляем центральную форму ПОВЕРХ кусочков
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

// ===================================
// СИСТЕМА ОКРАШИВАНИЯ ШЕСТИУГОЛЬНИКОВ
// ===================================

// Проверка попадания точки в шестиугольник
function isPointInHexagon(pointX, pointY, hexagon) {
    const hexX = hexagon.x;
    const hexY = hexagon.y;
    const radius = hexagon.radius;
    
    // Используем алгоритм проверки попадания в правильный шестиугольник
    // Переводим точку в локальные координаты шестиугольника
    const dx = pointX - hexX;
    const dy = pointY - hexY;
    
    // Поворачиваем точку на -30 градусов (обратно повороту шестиугольника)
    const rotationOffset = -Math.PI / 6;
    const cos = Math.cos(rotationOffset);
    const sin = Math.sin(rotationOffset);
    const rotatedX = dx * cos - dy * sin;
    const rotatedY = dx * sin + dy * cos;
    
    // Проверяем попадание в правильный шестиугольник методом осей
    const absX = Math.abs(rotatedX);
    const absY = Math.abs(rotatedY);
    
    // Простая проверка попадания в окружность для многоугольника (с учетом размера из конфига)
    const enlargedRadius = radius * CONFIG.cookie.pieces.sizeMultiplier;
    const distance = Math.sqrt(absX * absX + absY * absY);
    return distance <= enlargedRadius;
}

// Поиск шестиугольника под точкой
function findHexagonAtPoint(x, y) {
    const smallHexagons = window.smallHexagons;
    if (!smallHexagons) return null;
    
    // Проходим по всем шестиугольникам и ищем попадание
    for (const hexagon of smallHexagons) {
        if (isPointInHexagon(x, y, hexagon)) {
            // Для разделенных кусочков проверяем попадание в правильную часть
            if (hexagon.isSplitPart) {
                const isInCenterArea = isPointInCoreArea(x, y);
                
                // Внутренние части - только если точка внутри центральной формы
                if (hexagon.partType === 'inner' && isInCenterArea) {
                    return hexagon;
                }
                
                // Внешние части - только если точка снаружи центральной формы
                if (hexagon.partType === 'outer' && !isInCenterArea) {
                    return hexagon;
                }
                
                // Если точка не в правильной области - пропускаем этот кусочек
                continue;
            }
            
            // Для обычных кусочков возвращаем как есть
            return hexagon;
        }
    }
    
    return null;
}

// Поиск соседей шестиугольника (находящихся на расстоянии меньше удвоенного радиуса)
function findHexagonNeighbors(targetHexagon, allHexagons) {
    const neighbors = [];
    const maxDistance = targetHexagon.radius * 2.2; // Немного больше чем 2 радиуса для учета погрешности
    
    for (const hexagon of allHexagons) {
        if (hexagon.id === targetHexagon.id) continue; // Пропускаем себя
        
        const distance = Math.sqrt(
            Math.pow(hexagon.x - targetHexagon.x, 2) + 
            Math.pow(hexagon.y - targetHexagon.y, 2)
        );
        
        if (distance <= maxDistance) {
            // Для разделенных кусочков с одинаковыми координатами исключаем пары inner/outer
            if (targetHexagon.isSplitPart && hexagon.isSplitPart && 
                targetHexagon.originalId === hexagon.originalId && 
                distance < 0.1) {
                // Пропускаем свою пару (inner/outer с одинаковыми координатами)
                continue;
            }
            
            neighbors.push(hexagon);
        }
    }
    
    return neighbors;
}


// Алгоритм поиска связанных компонентов (BFS)
function findConnectedComponents(clickedHexagon, allHexagons) {
    const visited = new Set();
    // Основой считаются: обычные центральные кусочки + внутренние части разделенных кусочков
    const centerHexagons = allHexagons.filter(hex => 
        !hex.isPainted && (
            (hex.isInCenterShape && !hex.isSplitPart) || // Обычные центральные кусочки
            (hex.isSplitPart && hex.partType === 'inner') // Внутренние части разделенных кусочков
        )
    );
    // Исключаем крайние кусочки из расчета связности
    // Также исключаем внутренние части разделенных кусочков (они теперь часть основы)
    const nonCenterHexagons = allHexagons.filter(hex => 
        !hex.isPainted && 
        !hex.isEdgePiece && 
        !(hex.isInCenterShape && !hex.isSplitPart) && // Исключаем обычные центральные
        !(hex.isSplitPart && hex.partType === 'inner') // Исключаем внутренние части разделенных
    );
    const edgeHexagons = allHexagons.filter(hex => hex.isEdgePiece && !hex.isPainted);
    
    // Функция BFS для поиска связанных кусочков
    function bfsComponent(startHexagon, hexagonsPool) {
        const component = [];
        const queue = [startHexagon];
        visited.add(startHexagon.id);
        
        while (queue.length > 0) {
            const current = queue.shift();
            component.push(current);
            
            const neighbors = findHexagonNeighbors(current, hexagonsPool);
            for (const neighbor of neighbors) {
                if (!visited.has(neighbor.id) && !neighbor.isPainted) {
                    visited.add(neighbor.id);
                    queue.push(neighbor);
                }
            }
        }
        
        return component;
    }
    
    // Проверяем, есть ли путь от компонента до центральных кусочков
    function hasPathToCenter(component) {
        // Создаем множество всех доступных кусочков для поиска пути
        // Включаем: основу + внешние части разделенных кусочков + обычные внешние кусочки
        const allAvailableHexagons = [
            ...centerHexagons,
            ...allHexagons.filter(hex => 
                !hex.isPainted && 
                (hex.isSplitPart && hex.partType === 'outer') // Внешние части разделенных кусочков
            ),
            ...nonCenterHexagons
        ];
        
        // BFS поиск пути от любого кусочка компонента к основе
        const visited = new Set();
        const queue = [...component];
        
        // Отмечаем все кусочки компонента как посещенные
        component.forEach(hex => visited.add(hex.id));
        
        while (queue.length > 0) {
            const current = queue.shift();
            
            // Проверяем, достигли ли мы основы
            if (centerHexagons.some(centerHex => centerHex.id === current.id)) {
                return true;
            }
            
            // Ищем соседей среди доступных кусочков
            const neighbors = findHexagonNeighbors(current, allAvailableHexagons);
            for (const neighbor of neighbors) {
                if (!visited.has(neighbor.id) && !neighbor.isPainted) {
                    visited.add(neighbor.id);
                    queue.push(neighbor);
                }
            }
        }
        
        return false;
    }
    
    // Функция поиска крайних кусочков, которые должны упасть
    function findFallingEdgePieces(disconnectedComponents) {
        const fallingEdgePieces = [];
        
        for (const edgeHex of edgeHexagons) {
            let shouldFall = false;
            
            // 1. Проверяем, есть ли среди соседей падающие ОБЫЧНЫЕ кусочки из отколовшихся компонентов
            const neighbors = findHexagonNeighbors(edgeHex, allHexagons);
            const hasFallingRegularNeighbor = neighbors.some(neighbor => 
                !neighbor.isEdgePiece && // Сосед должен быть обычным, не крайним
                !neighbor.isInCenterShape && // И не из центральной формы
                disconnectedComponents.some(component => component.includes(neighbor))
            );
            
            if (hasFallingRegularNeighbor) {
                shouldFall = true;
                if (isDev) {
                }
            }
            
            // 2. Проверяем, является ли нажатый кусочек соседом и обычным (не крайним)
            if (!shouldFall && !clickedHexagon.isEdgePiece && !clickedHexagon.isInCenterShape) {
                const isNeighborOfClicked = neighbors.some(neighbor => neighbor.id === clickedHexagon.id);
                if (isNeighborOfClicked) {
                    shouldFall = true;
                    if (isDev) {
                    }
                }
            }
            
            if (shouldFall) {
                fallingEdgePieces.push(edgeHex);
                if (isDev) {
                    console.log(`🔵 Краевой кусочек (${edgeHex.x.toFixed(1)}, ${edgeHex.y.toFixed(1)}) будет падать`);
                }
            }
        }
        
        return fallingEdgePieces;
    }
    
    // Сначала отмечаем нажатый кусочек как посещенный
    visited.add(clickedHexagon.id);
    const disconnectedHexagons = [];
    const disconnectedComponents = [];
    
    // Ищем все компоненты среди не-центральных и не-крайних кусочков
    for (const hexagon of nonCenterHexagons) {
        if (!visited.has(hexagon.id) && !hexagon.isPainted) {
            const component = bfsComponent(hexagon, nonCenterHexagons);
            
            // Проверяем, есть ли у этого компонента путь к центру
            if (!hasPathToCenter(component)) {
                disconnectedHexagons.push(...component);
                disconnectedComponents.push(component);
            }
        }
    }
    
    // Находим крайние кусочки, которые должны упасть
    const fallingEdgePieces = findFallingEdgePieces(disconnectedComponents);
    disconnectedHexagons.push(...fallingEdgePieces);
    
    return disconnectedHexagons;
}

// Окрашивание шестиугольника в красный цвет
function paintHexagon(hexagon, color = 0xFF0000) {
    if (!hexagon || hexagon.isPainted) return false;
    
    // Перерисовываем шестиугольник с новым цветом
    const graphics = hexagon.graphics;
    graphics.clear();
    
    // Рисуем шестиугольник с новым цветом заливки
    const vertices = [];
    const rotationOffset = Math.PI / 6; // 30 градусов поворот
    for (let j = 0; j < 6; j++) {
        const angle = (j * Math.PI) / 3 + rotationOffset;
        const vx = hexagon.x + Math.cos(angle) * hexagon.radius;
        const vy = hexagon.y + Math.sin(angle) * hexagon.radius;
        vertices.push(vx, vy);
    }
    
    graphics.poly(vertices);
    graphics.fill(color); // Заливка красным цветом
    graphics.stroke({ color: hexagon.originalColor, width: 1, alpha: 0.5 }); // Оставляем оригинальную обводку
    
    // Обновляем состояние шестиугольника
    hexagon.currentColor = color;
    hexagon.isPainted = true;
    
    if (isDev) {
        console.log(`🔴 Шестиугольник ${hexagon.id} окрашен в красный`);
    }
    
    return true;
}


// Получение кусочков по кольцам вокруг центрального кусочка
function getHexagonsByRings(centerHex, allHexagons, maxCount) {
    if (!centerHex || !allHexagons || maxCount <= 0) return [];
    
    const result = [centerHex];
    const added = new Set([centerHex.id]);
    
    // Направления для поиска соседей в кубических координатах
    const directions = [
        [1, -1, 0], [1, 0, -1], [0, 1, -1],
        [-1, 1, 0], [-1, 0, 1], [0, -1, 1]
    ];
    
    let currentRing = [centerHex];
    
    // Расширяем поиск по кольцам пока не достигнем нужного количества
    while (result.length < maxCount && currentRing.length > 0) {
        const nextRing = [];
        
        for (const hex of currentRing) {
            // Проверяем всех соседей текущего кусочка
            for (const [dq, dr, ds] of directions) {
                const neighborQ = hex.q + dq;
                const neighborR = hex.r + dr;
                const neighborS = hex.s + ds;
                
                // Ищем соседей в массиве всех кусочков
                const neighbors = allHexagons.filter(h => 
                    h.q === neighborQ && h.r === neighborR && h.s === neighborS
                );
                
                // Для разделенных кусочков на одних координатах - выбираем только подходящие
                for (const neighbor of neighbors) {
                    if (neighbor && !added.has(neighbor.id) && !neighbor.isPainted) {
                        // Проверяем, может ли кусочек выпасть (не является краевым центральной формы)
                        const canFall = !neighbor.isEdgeOfCenterShape && 
                                       !(neighbor.isInCenterShape && !neighbor.isEdgeOfCenterShape);
                        
                        if (canFall) {
                            result.push(neighbor);
                            added.add(neighbor.id);
                            nextRing.push(neighbor);
                            
                            // Проверяем, достигли ли мы нужного количества
                            if (result.length >= maxCount) {
                                return result;
                            }
                        }
                    }
                }
            }
        }
        
        currentRing = nextRing;
    }
    
    return result;
}

// Обработка нажатия иглы на шестиугольники
function handleNeedlePaintingAtPoint() {
    if (!needlePressed) return false;
    
    // Используем текущую точку клика (где показывается красная точка)
    // вместо расчета позиции спрайта иглы
    const needleTipX = currentClickPoint.x;
    const needleTipY = currentClickPoint.y;
    
    
    const hexagon = findHexagonAtPoint(needleTipX, needleTipY);
    if (hexagon && !hexagon.isPainted) {
        // Проверяем разделенные кусочки (внутренние части вызывают Game Over)
        if (hexagon.isSplitPart && hexagon.partType === 'inner') {
            if (isDev) {
                console.log('🟡 Клик по внутренней части (желтая) - Game Over!');
            }
            // СРАЗУ устанавливаем флаг Game Over, чтобы заблокировать проверку победы
            gameOverShown = true;
            // Сначала рассыпаем всю печеньку, потом показываем Game Over
            animateFullCookieCrumble(() => {
                showGameOverModal();
            });
            return true;
        }
        
        // Проверяем разделенные кусочки (внешние части безопасны)
        if (hexagon.isSplitPart && hexagon.partType === 'outer') {
            if (isDev) {
                console.log('🟢 Клик по внешней части (зеленая) - безопасно!');
            }
            // Продолжаем обычную логику игры
        }
        
        // Проверяем, является ли кусочек центральным (внутри формы), но НЕ краевым
        if (hexagon.isInCenterShape && !hexagon.isEdgeOfCenterShape) {
            // СРАЗУ устанавливаем флаг Game Over, чтобы заблокировать проверку победы
            gameOverShown = true;
            // Сначала рассыпаем всю печеньку, потом показываем Game Over
            animateFullCookieCrumble(() => {
                showGameOverModal();
            });
            return true;
        }
        
        // Проверяем, является ли кусочек краевым центральной формы
        if (hexagon.isEdgeOfCenterShape) {
            // Краевые кусочки центральной формы не падают при нажатии
            if (isDev) {
            }
            return false; // Ничего не делаем, кусочек остается на месте
        }
        
        // Получаем все шестиугольники для анализа связности
        const allHexagons = window.smallHexagons;
        if (!allHexagons) return false;
        
        // Получаем группу кусочков для выпадения (включая нажатый)
        const maxFallingPieces = CONFIG.cookie.pieces.maxFallingPieces;
        const minFallingPieces = Math.max(1, Math.ceil(maxFallingPieces / 3)); // Минимум = треть от максимума, но не менее 1
        const randomFallingCount = Math.floor(Math.random() * (maxFallingPieces - minFallingPieces + 1)) + minFallingPieces; // От minFallingPieces до maxFallingPieces
        const fallingHexagons = getHexagonsByRings(hexagon, allHexagons, randomFallingCount);
        
        // Помечаем все выпадающие кусочки как обработанные
        fallingHexagons.forEach(hex => {
            hex.isPainted = true;
        });
        
        // Находим все кусочки, которые потеряли связь с центром после выпадения группы
        let disconnectedHexagons = [];
        fallingHexagons.forEach(fallingHex => {
            const disconnected = findConnectedComponents(fallingHex, allHexagons);
            disconnectedHexagons = disconnectedHexagons.concat(disconnected);
        });
        
        // Удаляем дубликаты из списка отключенных кусочков
        const uniqueDisconnected = disconnectedHexagons.filter((hex, index, self) => 
            index === self.findIndex(h => h.id === hex.id)
        );
        
        // Ждем завершения анимации нажатия иглы перед падением кусочков
        const needleAnimationDuration = CONFIG.needle.shadow.animationDuration * 1000; // Переводим в миллисекунды
        
        setTimeout(() => {
            // Сначала запускаем анимацию падения для кликнутого кусочка
            if (hexagon.container) {
                animateHexagonFall(hexagon.container, hexagon.radius, hexagon.x, hexagon.y);
            }
            
            // Через 0.1 секунды запускаем анимацию падения для остальных кусочков из группы
            setTimeout(() => {
                fallingHexagons.forEach((fallingHex) => {
                    // Пропускаем кликнутый кусочек, он уже падает
                    if (fallingHex.id !== hexagon.id && fallingHex.container) {
                        animateHexagonFall(fallingHex.container, fallingHex.radius, fallingHex.x, fallingHex.y);
                    }
                });
                
                // Запускаем анимацию падения для всех отколовшихся кусочков тоже с задержкой
                uniqueDisconnected.forEach((disconnectedHex) => {
                    if (disconnectedHex.container && !disconnectedHex.isPainted) {
                        disconnectedHex.isPainted = true;
                        animateHexagonFall(disconnectedHex.container, disconnectedHex.radius, disconnectedHex.x, disconnectedHex.y);
                    }
                });
            }, 100); // Задержка 0.1 секунды (100 мс)
            
            // Проверяем победу через время, достаточное для анимации падения
            // НО только если не было Game Over
            setTimeout(() => {
                if (!gameOverShown && checkVictoryCondition()) {
                    showCongratulationsModal();
                }
            }, CONFIG.cookie.pieces.chipAnimation.duration * 1000 + 600); // Даем время на анимацию + буфер + задержка
            
        }, needleAnimationDuration);
        
        return true;
    }
    
    return false;
}


// Обновление размера иглы при изменении окна
function updateNeedleSize() {
    const needleSprite = window.needle;
    const needleShadowSprite = window.needleShadow;
    if (!needleSprite) return;
    
    const gameArea = document.querySelector('.game-area');
    const gameWidth = gameArea.clientWidth;
    const gameHeight = gameArea.clientHeight;
    
    // Вычисляем новый размер иглы относительно печенья
    const minSize = Math.min(gameWidth, gameHeight);
    const cookieSize = minSize * CONFIG.cookie.sizePercent;
    const needleSize = cookieSize * (CONFIG.needle.sizePercent / 100);
    
    // Обновляем масштаб иглы
    const needleTexture = needleSprite.texture;
    const scale = needleSize / Math.max(needleTexture.width, needleTexture.height);
    if (isMobile) {
        // На мобильных сохраняем отзеркаливание по Y
        needleSprite.scale.set(scale, -scale);
    } else {
        needleSprite.scale.set(scale);
    }
    
    // Обновляем масштаб тени
    if (needleShadowSprite) {
        const shadowTexture = needleShadowSprite.texture;
        const shadowScale = needleSize / Math.max(shadowTexture.width, shadowTexture.height);
        needleShadowSprite.scale.set(shadowScale);
    }
    
    // Обновляем позицию для мобильных устройств
    if (isMobile) {
        needleSprite.x = gameWidth * CONFIG.needle.mobile.staticPosition.x;
        needleSprite.y = gameHeight * CONFIG.needle.mobile.staticPosition.y;
        needleBaseY = needleSprite.y;
        
        // Обновляем позицию тени
        if (needleShadowSprite) {
            const x = gameWidth * CONFIG.needle.mobile.staticPosition.x;
            const y = gameHeight * CONFIG.needle.mobile.staticPosition.y;
            updateNeedleAndShadowPositions(needleSprite, needleShadowSprite, x, y, false);
        }
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
            
            // Загружаем тень иглы
            await loadNeedleShadowTexture();
            return;
        }
        
        throw new Error('Import иглы вернул undefined');
        
    } catch (error) {
        console.error('❌ Не удалось загрузить текстуру иглы:', error);
        
        // Создаем простую иглу программно
        createProgrammaticNeedle();
    }
}

// Загрузка текстуры тени иглы
async function loadNeedleShadowTexture() {
    try {
        // Способ 1: Динамический import
        const needleShadowImageUrl = (await import('./assets/textures/needle_shadow.png')).default;
        
        if (isDev) {
            console.log('🔍 Загружаем текстуру тени иглы');
            console.log('📁 URL текстуры тени иглы:', needleShadowImageUrl);
        }
        
        if (needleShadowImageUrl) {
            // Создаем Image элемент
            const img = new Image();
            
            // Промис для загрузки изображения
            const imageLoaded = new Promise((resolve, reject) => {
                img.onload = () => resolve(img);
                img.onerror = reject;
            });
            
            img.src = needleShadowImageUrl;
            await imageLoaded;
            
            // Создаем текстуру из изображения
            const texture = Texture.from(img);
            
            // Добавляем в кеш
            Assets.cache.set('needleShadow', texture);
            
            if (isDev) {
                console.log('✅ Текстура тени иглы загружена');
                console.log('🖼️ Размер текстуры тени иглы:', texture.width, 'x', texture.height);
            }
            return;
        }
        
        throw new Error('Import тени иглы вернул undefined');
        
    } catch (error) {
        console.error('❌ Не удалось загрузить текстуру тени иглы:', error);
        
        // Создаем программную тень как fallback
        createProgrammaticNeedleShadow();
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

// Создание программной тени иглы как fallback
function createProgrammaticNeedleShadow() {
    if (isDev) {
        console.log('🔶 Создаем программную тень иглы');
    }
    
    const graphics = new Graphics();
    
    // Рисуем тень иглы (более темная и размытая версия)
    // Острие
    graphics.moveTo(2, 2); // Смещение для эффекта тени
    graphics.lineTo(5, 12);
    graphics.lineTo(-1, 12);
    graphics.closePath();
    graphics.fill(0x333333); // Темнее основной иглы
    
    // Стержень
    graphics.rect(1, 12, 2, 20);
    graphics.fill(0x333333);
    
    // Ушко
    graphics.circle(2, 34, 3);
    graphics.stroke({ color: 0x333333, width: 1 });
    
    // Создаем текстуру
    const app = window.app;
    const texture = app.renderer.generateTexture(graphics);
    
    // Добавляем в кеш
    Assets.cache.set('needleShadow', texture);
    
    if (isDev) {
        console.log('✅ Программная тень иглы создана');
    }
}

// Функция вычисления точки касания кусочков из координат пальца/мыши
function calculateContactPoint(inputX, inputY) {
    if (isMobile) {
        // На мобильных красная точка в верхнем левом углу иглы (как было раньше)
        const needleSprite = window.needle;
        if (needleSprite) {
            // Зеркалю только по Y оси!
            const touchOffset = CONFIG.needle.touchOffset;
            return {
                x: inputX - needleSprite.width * touchOffset.x,
                y: inputY - needleSprite.height * (1 - touchOffset.y)
            };
        }
    }
    
    // На десктопе мышь = точка касания
    return { x: inputX, y: inputY };
}

// Функция расчета позиции иглы относительно ввода
function calculateNeedlePosition(inputX, inputY, pressed = false) {
    const distance = CONFIG.needle.shadow.distance;
    
    if (isMobile) {
        // На мобильных игла центром на точке касания пальца
        // Игла всегда центрирована на точке касания пальца
        return { x: inputX, y: inputY };
    } else {
        // На десктопе игла относительно точки касания кусочков
        if (pressed) {
            return { x: inputX, y: inputY }; // Игла в точке касания (острие)
        } else {
            return { x: inputX, y: inputY - distance }; // Игла выше точки касания
        }
    }
}

// Функция расчета позиции тени относительно ввода
function calculateShadowPosition(inputX, inputY, pressed = false) {
    const distance = CONFIG.needle.shadow.distance;
    
    if (isMobile) {
        // На мобильных тень центром на точке касания пальца
        // Тень всегда смещена относительно центра иглы
        return { x: inputX + distance, y: inputY + distance };
    } else {
        // На десктопе тень относительно точки касания кусочков
        if (pressed) {
            return { x: inputX, y: inputY }; // Тень в точке касания
        } else {
            return { x: inputX + distance, y: inputY - distance }; // Тень смещена
        }
    }
}


// Функция обновления позиций иглы и тени относительно точки ввода
function updateNeedleAndShadowPositions(needleSprite, needleShadowSprite, inputX, inputY, pressed = false) {
    if (!needleSprite) return;
    
    // Вычисляем точку касания кусочков из координат ввода
    const contactPoint = calculateContactPoint(inputX, inputY);
    
    // Сохраняем точку касания как текущую точку клика
    currentClickPoint.x = contactPoint.x;
    currentClickPoint.y = contactPoint.y;
    
    // Обновляем позицию иглы относительно координат ввода
    const needlePos = calculateNeedlePosition(inputX, inputY, pressed);
    needleSprite.x = needlePos.x;
    needleSprite.y = needlePos.y;
    
    // Обновляем позицию тени относительно координат ввода
    if (needleShadowSprite) {
        const shadowPos = calculateShadowPosition(inputX, inputY, pressed);
        needleShadowSprite.x = shadowPos.x;
        needleShadowSprite.y = shadowPos.y;
    }
    
    // Обновляем базовую позицию Y
    needleBaseY = needlePos.y;
}

// Функция создания красной точки для отладки
function createDebugPoint() {
    const graphics = new Graphics();
    graphics.circle(0, 0, 1); // Радиус 1px
    graphics.fill(0xFF0000); // Красный цвет
    graphics.zIndex = 2000; // Поверх всего
    graphics.visible = false; // Скрыта по умолчанию
    
    return graphics;
}

// Функция показа точки касания кусочков (красная точка)
function showDebugPoint(inputX, inputY) {
    if (!isDev) return; // Только в режиме разработки
    
    let debugPoint = window.debugPoint;
    if (!debugPoint) {
        debugPoint = createDebugPoint();
        window.app.stage.addChild(debugPoint);
        window.debugPoint = debugPoint;
    }
    
    // Вычисляем точку касания кусочков
    const contactPoint = calculateContactPoint(inputX, inputY);
    
    debugPoint.x = contactPoint.x;
    debugPoint.y = contactPoint.y;
    debugPoint.visible = true;
    
    // Автоматически скрыть через 2 секунды
    setTimeout(() => {
        if (debugPoint) {
            debugPoint.visible = false;
        }
    }, 2000);
}

// Создание спрайта иглы
function createNeedle(app) {
    const needleTexture = Assets.get('needle');
    const needleShadowTexture = Assets.get('needleShadow');
    const needleSprite = new Sprite(needleTexture);
    const needleShadowSprite = new Sprite(needleShadowTexture);
    
    // Вычисляем размер иглы относительно печенья
    const gameArea = document.querySelector('.game-area');
    const gameWidth = gameArea.clientWidth;
    const gameHeight = gameArea.clientHeight;
    const minSize = Math.min(gameWidth, gameHeight);
    const cookieSize = minSize * CONFIG.cookie.sizePercent;
    const needleSize = cookieSize * (CONFIG.needle.sizePercent / 100);
    
    // Настройка основной иглы
    const scale = needleSize / Math.max(needleTexture.width, needleTexture.height);
    needleSprite.scale.set(scale);
    needleSprite.zIndex = 1000; // Игла всегда сверху
    
    // Настройка тени иглы
    const shadowScale = needleSize / Math.max(needleShadowTexture.width, needleShadowTexture.height);
    needleShadowSprite.scale.set(shadowScale);
    needleShadowSprite.zIndex = 999; // Тень под иглой
    needleShadowSprite.alpha = CONFIG.needle.shadow.alpha; // Прозрачность тени из конфига
    
    // Устанавливаем начальную позицию для мобильных устройств
    if (isMobile) {
        needleSprite.visible = true;
        needleShadowSprite.visible = false; // На мобильных тень скрыта сразу
        needleSprite.anchor.set(CONFIG.needle.mouseOffset.x, CONFIG.needle.mouseOffset.y); // Левый нижний угол
        needleShadowSprite.anchor.set(CONFIG.needle.mouseOffset.x, CONFIG.needle.mouseOffset.y);
        
        // Отзеркаливаем иглу для мобильных устройств (меняем знак у scale.y)
        needleSprite.scale.y = -needleSprite.scale.y;
        
        const startX = gameWidth * CONFIG.needle.mobile.staticPosition.x;
        const startY = gameHeight * CONFIG.needle.mobile.staticPosition.y;
        
        needleSprite.x = startX;
        needleSprite.y = startY;
        
        // Устанавливаем позицию тени через универсальную функцию
        updateNeedleAndShadowPositions(needleSprite, needleShadowSprite, startX, startY, false);
        
        needleBaseY = needleSprite.y;
    } else {
        // Для десктопа не инициализируем позицию - игла появится где мышь
        needleSprite.visible = false; // Скрыта до первого mouseenter
        needleShadowSprite.visible = false;
    }
    
    // Добавляем на сцену (сначала тень, потом иглу)
    app.stage.addChild(needleShadowSprite);
    app.stage.addChild(needleSprite);
    
    // Сохраняем ссылки для доступа
    window.needle = needleSprite;
    window.needleShadow = needleShadowSprite;
    console.log('🪡 Размер иглы:', needleSize, 'scale:', scale);
    console.log('🌑 Тень иглы создана');
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
        
        // Обновляем позицию иглы с учетом текущего состояния нажатия
        updateNeedlePosition(x, y, 'mouse', needlePressed);
        
        // Если мышь зажата и перемещается - воздействуем острием иглы
        if (isDragging && needlePressed) {
            handleNeedlePaintingAtPoint();
        }
    });
    
    // Обработка входа мыши в область
    gameArea.addEventListener('mouseenter', (event) => {
        const rect = gameArea.getBoundingClientRect();
        const mouseX = event.clientX - rect.left;
        const mouseY = event.clientY - rect.top;
        
        // Сразу устанавливаем иглу в позицию мыши
        updateNeedlePosition(mouseX, mouseY, 'mouse');
        showNeedle();
    });
    
    // Обработка выхода мыши из области
    gameArea.addEventListener('mouseleave', () => {
        hideNeedle();
        animateNeedlePress(false); // Отпускаем иглу при выходе
        isDragging = false; // Останавливаем перетаскивание
    });
    
    // Обработка нажатия мыши
    gameArea.addEventListener('mousedown', (event) => {
        event.preventDefault();
        isDragging = true;
        animateNeedlePress(true);
        
        const rect = gameArea.getBoundingClientRect();
        const x = event.clientX - rect.left;
        const y = event.clientY - rect.top;
        
        // Сразу воздействуем острием иглы
        handleNeedlePaintingAtPoint();
    });
    
    gameArea.addEventListener('mouseup', () => {
        animateNeedlePress(false);
        isDragging = false;
    });
}

// Настройка интерактивности для мобильных устройств
function setupMobileInteractivity(gameArea) {
    console.log('🔧 Настраиваем мобильную интерактивность');
    showTouchDebug('SETUP MOBILE');
    
    let isTouching = false;
    
    // Обработка начала касания
    gameArea.addEventListener('touchstart', (event) => {
        event.preventDefault();
        isTouching = true;
        isDragging = true;
        
        const touch = event.touches[0];
        const rect = gameArea.getBoundingClientRect();
        const x = touch.clientX - rect.left;
        const y = touch.clientY - rect.top;
        
        showTouchDebug(`TOUCH START: ${x.toFixed(0)}, ${y.toFixed(0)}`);
        
        // Обновляем позицию иглы и показываем (нажатое состояние)
        updateNeedlePosition(x, y, 'touch', true);
        showNeedle();
        needlePressed = true; // Устанавливаем состояние нажатия
        
        // Воздействуем острием иглы
        handleNeedlePaintingAtPoint();
    }, { passive: false });
    
    // Обработка движения пальца
    gameArea.addEventListener('touchmove', (event) => {
        if (!isTouching) return;
        
        event.preventDefault();
        const touch = event.touches[0];
        const rect = gameArea.getBoundingClientRect();
        const x = touch.clientX - rect.left;
        const y = touch.clientY - rect.top;
        
        // Перемещаем иглу следом за пальцем (сохраняем нажатое состояние)
        updateNeedlePosition(x, y, 'touch', needlePressed);
        
        // Воздействуем острием иглы при перемещении
        if (needlePressed) {
            handleNeedlePaintingAtPoint();
        }
    }, { passive: false });
    
    // Обработка окончания касания
    gameArea.addEventListener('touchend', (event) => {
        isTouching = false;
        isDragging = false;
        
        showTouchDebug('TOUCH END');
        
        // Отпускаем иглу и скрываем
        needlePressed = false; // Сбрасываем состояние нажатия
        hideNeedle();
    }, { passive: false });
}

// Показать иглу
function showNeedle() {
    const needleSprite = window.needle;
    const needleShadowSprite = window.needleShadow;
    
    if (needleSprite) {
        needleSprite.visible = true;
        
        if (needleShadowSprite) {
            needleShadowSprite.visible = true;
        }
        
        if (isDev) {
            console.log('👁️ Игла показана');
        }
    }
}

// Скрыть иглу
function hideNeedle() {
    const needleSprite = window.needle;
    const needleShadowSprite = window.needleShadow;
    
    if (needleSprite) {
        needleSprite.visible = false;
        
        if (needleShadowSprite) {
            needleShadowSprite.visible = false;
        }
        
        if (isDev) {
            console.log('🙈 Игла скрыта');
        }
    }
}

// Обновить позицию иглы
function updateNeedlePosition(x, y, inputType, pressed = false) {
    const needleSprite = window.needle;
    const needleShadowSprite = window.needleShadow;
    if (!needleSprite) return;
    
    // Показываем красную точку позиционирования
    showDebugPoint(x, y);
    
    const needleConfig = CONFIG.needle;
    
    // Устанавливаем якоря в зависимости от типа ввода
    if (inputType === 'mouse') {
        needleSprite.anchor.set(needleConfig.mouseOffset.x, needleConfig.mouseOffset.y);
        // На десктопе возвращаем нормальный масштаб и показываем тень
        if (isMobile) {
            // Если переключились с touch на mouse (гибридное устройство), возвращаем масштаб
            needleSprite.scale.y = Math.abs(needleSprite.scale.y);
        }
        if (needleShadowSprite) {
            needleShadowSprite.anchor.set(needleConfig.mouseOffset.x, needleConfig.mouseOffset.y);
            needleShadowSprite.visible = true;
        }
    } else if (inputType === 'touch') {
        needleSprite.anchor.set(needleConfig.touchOffset.x, needleConfig.touchOffset.y);
        // На мобильных тень уже скрыта при создании
        if (needleShadowSprite) {
            needleShadowSprite.visible = false;
        }
    }
    
    // Обновляем позиции иглы и тени с учетом состояния нажатия
    updateNeedleAndShadowPositions(needleSprite, needleShadowSprite, x, y, pressed);
}

// Проверка, находится ли точка внутри печеньки
function isPointInsideCookie(x, y) {
    const cookieSprite = window.cookie;
    if (!cookieSprite) return false;
    
    const cookieRadius = cookieSprite.width / 2;
    const cookieCenterX = cookieSprite.x;
    const cookieCenterY = cookieSprite.y;
    
    const distance = Math.sqrt(
        Math.pow(x - cookieCenterX, 2) + 
        Math.pow(y - cookieCenterY, 2)
    );
    
    return distance <= cookieRadius;
}

// Анимация нажатия иглы
function animateNeedlePress(pressed) {
    const needleSprite = window.needle;
    const needleShadowSprite = window.needleShadow;
    if (!needleSprite) return;
    
    const shadowConfig = CONFIG.needle.shadow;
    needlePressed = pressed;
    
    // Обработка нажатия иглы внутри печеньки
    if (pressed) {
        const insideCookie = isPointInsideCookie(currentClickPoint.x, currentClickPoint.y);
        if (isDev) {
        }
        
        if (insideCookie) {
            // Пока просто логируем клик внутри печеньки
            if (isDev) {
            }
        }
    }
    
    // На мобильных устройствах просто обновляем позицию без анимации
    if (isMobile) {
        const needlePos = calculateNeedlePosition(currentClickPoint.x, currentClickPoint.y, pressed);
        const shadowPos = calculateShadowPosition(currentClickPoint.x, currentClickPoint.y, pressed);
        
        needleSprite.x = needlePos.x;
        needleSprite.y = needlePos.y;
        needleBaseY = needlePos.y;
        
        if (needleShadowSprite) {
            needleShadowSprite.x = shadowPos.x;
            needleShadowSprite.y = shadowPos.y;
        }
        return;
    }
    
    // Останавливаем предыдущую анимацию (только для десктопа)
    if (needleSprite.pressAnimation) {
        cancelAnimationFrame(needleSprite.pressAnimation);
    }
    
    // Рассчитываем целевые позиции для иглы и тени (только для десктопа)
    const needleStartPos = { x: needleSprite.x, y: needleSprite.y };
    const shadowStartPos = needleShadowSprite ? { x: needleShadowSprite.x, y: needleShadowSprite.y } : { x: 0, y: 0 };
    
    const needleTargetPos = calculateNeedlePosition(currentClickPoint.x, currentClickPoint.y, pressed);
    const shadowTargetPos = calculateShadowPosition(currentClickPoint.x, currentClickPoint.y, pressed);
    
    const duration = shadowConfig.animationDuration * 1000; // Переводим в миллисекунды
    const startTime = performance.now();
    
    function animate() {
        const now = performance.now();
        const elapsed = now - startTime;
        const progress = Math.min(elapsed / duration, 1);
        
        // Используем ease-out для плавности
        const easeProgress = 1 - Math.pow(1 - progress, 3);
        
        // Анимируем иглу
        needleSprite.x = needleStartPos.x + (needleTargetPos.x - needleStartPos.x) * easeProgress;
        needleSprite.y = needleStartPos.y + (needleTargetPos.y - needleStartPos.y) * easeProgress;
        
        // Анимируем тень
        if (needleShadowSprite) {
            needleShadowSprite.x = shadowStartPos.x + (shadowTargetPos.x - shadowStartPos.x) * easeProgress;
            needleShadowSprite.y = shadowStartPos.y + (shadowTargetPos.y - shadowStartPos.y) * easeProgress;
        }
        
        // Обновляем базовую позицию Y
        needleBaseY = needleSprite.y;
        
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
    const needleShadowSprite = window.needleShadow;
    if (!needleSprite) return;
    
    // Показываем красную точку позиционирования
    showDebugPoint(targetX, targetY);
    
    const duration = CONFIG.needle.mobile.animationDuration * 1000;
    
    // Останавливаем предыдущую анимацию
    if (needleSprite.moveAnimation) {
        cancelAnimationFrame(needleSprite.moveAnimation);
    }
    
    // Рассчитываем целевые позиции относительно новой точки клика
    const needleStartPos = { x: needleSprite.x, y: needleSprite.y };
    const shadowStartPos = needleShadowSprite ? { x: needleShadowSprite.x, y: needleShadowSprite.y } : { x: 0, y: 0 };
    
    const needleTargetPos = calculateNeedlePosition(targetX, targetY, false);
    const shadowTargetPos = calculateShadowPosition(targetX, targetY, false);
    
    const startTime = performance.now();
    
    function animate() {
        const now = performance.now();
        const elapsed = now - startTime;
        const progress = Math.min(elapsed / duration, 1);
        
        // Используем ease-out для плавности
        const easeProgress = 1 - Math.pow(1 - progress, 3);
        
        // Анимируем иглу
        needleSprite.x = needleStartPos.x + (needleTargetPos.x - needleStartPos.x) * easeProgress;
        needleSprite.y = needleStartPos.y + (needleTargetPos.y - needleStartPos.y) * easeProgress;
        
        // Анимируем тень
        if (needleShadowSprite) {
            needleShadowSprite.x = shadowStartPos.x + (shadowTargetPos.x - shadowStartPos.x) * easeProgress;
            needleShadowSprite.y = shadowStartPos.y + (shadowTargetPos.y - shadowStartPos.y) * easeProgress;
        }
        
        // Обновляем текущую точку клика и базовую позицию Y с учетом мобильного смещения
        if (isMobile) {
            // На мобильных смещаем в левый нижний угол иглы (острие)
            currentClickPoint.x = targetX - needleSprite.width / 2;
            currentClickPoint.y = targetY + needleSprite.height / 2;
        } else {
            // На десктопе оставляем как есть
            currentClickPoint.x = targetX;
            currentClickPoint.y = targetY;
        }
        needleBaseY = needleSprite.y;
        
        if (progress < 1) {
            needleSprite.moveAnimation = requestAnimationFrame(animate);
        } else {
            needleSprite.moveAnimation = null;
        }
    }
    
    needleSprite.moveAnimation = requestAnimationFrame(animate);
}

// Функция анимации убрана - игла появляется сразу где мышь

// Анимация падения шестиугольника
function animateHexagonFall(hexContainer, hexRadius, realX, realY) {
    // Проверяем что контейнер существует
    if (!hexContainer) {
        console.warn('❌ Контейнер шестиугольника не найден');
        return;
    }
    
    // Перемещаем падающий кусочек на задний план (ниже остальных)
    if (hexContainer.parent) {
        hexContainer.parent.setChildIndex(hexContainer, 0);
    }
    
    const config = CONFIG.cookie.pieces.chipAnimation;
    
    // Начальные параметры - используем реальные координаты
    const startX = realX || hexContainer.x;
    const startY = realY || hexContainer.y;
    const startScale = hexContainer.scale.x;
    const startAlpha = hexContainer.alpha;
    
    // Параметры движения - используем значения из конфига
    const velocityX = Math.random() * (config.initialVelocity.x.max - config.initialVelocity.x.min) + config.initialVelocity.x.min;
    const velocityY = Math.random() * (config.initialVelocity.y.max - config.initialVelocity.y.min) + config.initialVelocity.y.min;
    
    // Параметры анимации с небольшой случайной вариативностью скорости
    const speedVariation = 0.8 + Math.random() * 0.4; // От 0.8 до 1.2 - небольшая вариативность
    const duration = config.duration * 1000 * speedVariation; // в миллисекундах
    const startTime = performance.now();
    let lastLogTime = startTime;
    
    // Получаем размеры экрана для определения когда удалить объект
    const gameArea = document.querySelector('.game-area');
    const screenHeight = gameArea.clientHeight;
    
    // Убираем логирование для производительности
    
    function animate() {
        // Проверяем что контейнер еще существует
        if (!hexContainer || !hexContainer.parent) {
            return;
        }
        
        const now = performance.now();
        const elapsed = now - startTime;
        const progress = Math.min(elapsed / duration, 1);
        
        // Параболическое движение с гравитацией из конфига
        const fallDistance = screenHeight + hexRadius * 2; // Расстояние падения
        const gravity = config.gravity; // Используем гравитацию из конфига
        
        // Расчет позиций с учетом физики
        const timeInSeconds = elapsed / 1000; // Время в секундах
        const currentX = startX + velocityX * timeInSeconds;
        const currentY = startY + velocityY * timeInSeconds + gravity * timeInSeconds * timeInSeconds;
        
        // Применяем изменения - параболическое движение
        hexContainer.x = currentX;
        hexContainer.y = currentY;
        
        // Убираем логирование для производительности
        
        // Эффекты масштабирования (убираем исчезновение)
        // Фейдинг отключен - кусочки остаются видимыми при падении
        
        if (hexContainer) {
            const scaleProgress = Math.min(progress * 2, 1); // Ускоренное уменьшение
            const currentScale = startScale * (config.scale.from + (config.scale.to - config.scale.from) * scaleProgress);
            hexContainer.scale.set(currentScale);
        }
        
        // Продолжаем анимацию пока кусочек не выйдет за пределы экрана
        if (currentY < screenHeight + hexRadius * 2) {
            requestAnimationFrame(animate);
        } else {
            // Удаляем объект когда он выходит за пределы экрана
            if (hexContainer.parent) {
                hexContainer.parent.removeChild(hexContainer);
                hexContainer.destroy();
            }
        }
    }
    
    animate();
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
                    gapLength: pulseConfig.gapLength
                };
                
                drawCenterShape(pulseShape, 0, 0, pulseConfigUpdated);
            }
        }
        
        requestAnimationFrame(animate);
    }
    
    animate();
}






// Проверка, находится ли точка внутри всех границ (печенька и центральная фигура)
function isPointWithinBoundaries(x, y) {
    const cookieSprite = window.cookie;
    if (!cookieSprite) return false;
    
    const cookieRadius = cookieSprite.width / 2;
    const cookieCenterX = cookieSprite.x;
    const cookieCenterY = cookieSprite.y;
    
    // Проверяем границу печеньки
    const distanceFromCookieCenter = Math.sqrt(
        Math.pow(x - cookieCenterX, 2) + 
        Math.pow(y - cookieCenterY, 2)
    );
    
    if (distanceFromCookieCenter >= cookieRadius - 2) {
        return false; // Вне печеньки
    }
    
    // Проверяем центральную фигуру (не должны заходить внутрь)
    const centerShapeContainer = window.centerShape;
    if (centerShapeContainer) {
        const centerRadius = (cookieSprite.width * CONFIG.centerShape.sizePercent) / 2;
        const distanceFromCenter = Math.sqrt(
            Math.pow(x - cookieCenterX, 2) + 
            Math.pow(y - cookieCenterY, 2)
        );
        
        if (distanceFromCenter <= centerRadius) {
            return false; // Внутри центральной фигуры
        }
    }
    
    return true;
}

// Поиск точного пересечения с границами (печенька или центральная фигура)
function findExactBoundaryIntersection(x1, y1, x2, y2) {
    const cookieSprite = window.cookie;
    if (!cookieSprite) return null;
    
    const cookieRadius = cookieSprite.width / 2;
    const cookieCenterX = cookieSprite.x;
    const cookieCenterY = cookieSprite.y;
    
    // 1. Проверяем пересечение с границей печеньки
    const cookieBoundary = findCircleIntersection(
        x1, y1, x2, y2,
        cookieCenterX, cookieCenterY, cookieRadius - 2
    );
    
    // 2. Проверяем пересечение с центральной фигурой
    const centerShapeContainer = window.centerShape;
    let centerBoundary = null;
    if (centerShapeContainer) {
        const centerRadius = (cookieSprite.width * CONFIG.centerShape.sizePercent) / 2;
        centerBoundary = findCircleIntersection(
            x1, y1, x2, y2,
            cookieCenterX, cookieCenterY, centerRadius
        );
    }
    
    // Возвращаем ближайшее пересечение
    if (cookieBoundary && centerBoundary) {
        const distToCookie = Math.sqrt(Math.pow(cookieBoundary.x - x1, 2) + Math.pow(cookieBoundary.y - y1, 2));
        const distToCenter = Math.sqrt(Math.pow(centerBoundary.x - x1, 2) + Math.pow(centerBoundary.y - y1, 2));
        return distToCookie < distToCenter ? cookieBoundary : centerBoundary;
    }
    
    return cookieBoundary || centerBoundary;
}



// Поиск пересечения луча с окружностью
function findCircleIntersection(x1, y1, x2, y2, cx, cy, radius) {
    const dx = x2 - x1;
    const dy = y2 - y1;
    const fx = x1 - cx;
    const fy = y1 - cy;
    
    const a = dx * dx + dy * dy;
    const b = 2 * (fx * dx + fy * dy);
    const c = (fx * fx + fy * fy) - radius * radius;
    
    const discriminant = b * b - 4 * a * c;
    
    if (discriminant < 0) {
        return null; // Нет пересечения
    }
    
    const discriminantSqrt = Math.sqrt(discriminant);
    const t1 = (-b - discriminantSqrt) / (2 * a);
    const t2 = (-b + discriminantSqrt) / (2 * a);
    
    // Ищем ближайшее пересечение в направлении движения (t > 0 и t <= 1)
    let t = null;
    if (t1 >= 0 && t1 <= 1) {
        t = t1;
    } else if (t2 >= 0 && t2 <= 1) {
        t = t2;
    }
    
    if (t !== null) {
        return {
            x: x1 + t * dx,
            y: y1 + t * dy
        };
    }
    
    return null;
}


// Поиск пересечения двух отрезков
function findLineIntersection(x1, y1, x2, y2, x3, y3, x4, y4) {
    const denom = (x1 - x2) * (y3 - y4) - (y1 - y2) * (x3 - x4);
    
    if (Math.abs(denom) < 1e-10) {
        return null; // Линии параллельны
    }
    
    const t = ((x1 - x3) * (y3 - y4) - (y1 - y3) * (x3 - x4)) / denom;
    const u = -((x1 - x2) * (y1 - y3) - (y1 - y2) * (x1 - x3)) / denom;
    
    // Проверяем, что пересечение происходит внутри обоих отрезков
    if (t >= 0 && t <= 1 && u >= 0 && u <= 1) {
        const intersection = {
            x: x1 + t * (x2 - x1),
            y: y1 + t * (y2 - y1)
        };
        
        return intersection;
    }
    
    return null;
}



// Проверка попадания точки в треугольник
function isPointInTriangle(pointX, pointY, centerX, centerY, size) {
    // Вычисляем вершины равностороннего треугольника (как в drawTriangleShape)
    const height = size * Math.sqrt(3) / 2;
    const halfBase = size / 2;
    const centroidOffsetY = height / 3;
    
    // Вершины треугольника (точно как в drawTriangleShape)
    const x1 = centerX;                    // Верхняя точка
    const y1 = centerY - (height - centroidOffsetY);
    
    const x2 = centerX + halfBase;         // Правая нижняя точка
    const y2 = centerY + centroidOffsetY;
    
    const x3 = centerX - halfBase;         // Левая нижняя точка  
    const y3 = centerY + centroidOffsetY;
    
    // Отладочная информация
    if (isDev && Math.random() < 0.001) { // Показываем редко чтобы не засорять консоль
        console.log(`🔺 Треугольник: размер=${size}, вершины: (${x1.toFixed(1)}, ${y1.toFixed(1)}), (${x2.toFixed(1)}, ${y2.toFixed(1)}), (${x3.toFixed(1)}, ${y3.toFixed(1)})`);
    }
    
    // Используем барицентрические координаты для проверки
    const denominator = (y2 - y3) * (x1 - x3) + (x3 - x2) * (y1 - y3);
    
    if (Math.abs(denominator) < 1e-10) {
        return false; // Вырожденный треугольник
    }
    
    const a = ((y2 - y3) * (pointX - x3) + (x3 - x2) * (pointY - y3)) / denominator;
    const b = ((y3 - y1) * (pointX - x3) + (x1 - x3) * (pointY - y3)) / denominator;
    const c = 1 - a - b;
    
    // Точка внутри треугольника, если все барицентрические координаты >= 0
    return a >= 0 && b >= 0 && c >= 0;
}

// Определение центральной области (основной части печенья)
function isPointInCoreArea(x, y) {
    const cookieSprite = window.cookie;
    if (!cookieSprite) return false;
    
    const centerX = cookieSprite.x;
    const centerY = cookieSprite.y;
    const centerShapeConfig = CONFIG.centerShape;
    const coreSize = (cookieSprite.width * centerShapeConfig.sizePercent) / 2;
    
    switch (centerShapeConfig.form) {
        case 1: // Круг
            const distance = Math.sqrt((x - centerX) ** 2 + (y - centerY) ** 2);
            return distance <= coreSize;
            
        case 2: // Квадрат
            return Math.abs(x - centerX) <= coreSize && Math.abs(y - centerY) <= coreSize;
            
        case 3: // Треугольник (точная проверка)
            return isPointInTriangle(x, y, centerX, centerY, coreSize * 2); // coreSize это половина, а нужен полный размер
            
        default:
            return false;
    }
}

// Проверка, пересекается ли кусочек с границей центральной формы
function isHexagonIntersectingCenterBoundary(hexagon) {
    const cookieSprite = window.cookie;
    if (!cookieSprite) return false;
    
    const centerX = cookieSprite.x;
    const centerY = cookieSprite.y;
    const centerShapeConfig = CONFIG.centerShape;
    const coreSize = (cookieSprite.width * centerShapeConfig.sizePercent) / 2;
    
    // Получаем вершины шестиугольника
    const vertices = [];
    const sides = CONFIG.cookie.pieces.polygonSides;
    const enlargedRadius = hexagon.radius * CONFIG.cookie.pieces.sizeMultiplier;
    
    for (let j = 0; j < sides; j++) {
        const angle = (j * 2 * Math.PI) / sides;
        const vx = hexagon.x + Math.cos(angle) * enlargedRadius;
        const vy = hexagon.y + Math.sin(angle) * enlargedRadius;
        vertices.push({ x: vx, y: vy });
    }
    
    // Проверяем каждую вершину
    let insideCount = 0;
    let outsideCount = 0;
    
    for (const vertex of vertices) {
        if (isPointInCoreArea(vertex.x, vertex.y)) {
            insideCount++;
        } else {
            outsideCount++;
        }
    }
    
    // Кусочек пересекается с границей, если часть вершин внутри, часть снаружи
    return insideCount > 0 && outsideCount > 0;
}

// Создание двух частей кусочка, разделенных границей центральной формы
function createSplitHexagonParts(hexagon) {
    const cookieSprite = window.cookie;
    if (!cookieSprite) return null;
    
    const centerX = cookieSprite.x;
    const centerY = cookieSprite.y;
    const centerShapeConfig = CONFIG.centerShape;
    const coreSize = (cookieSprite.width * centerShapeConfig.sizePercent) / 2;
    
    // Получаем вершины шестиугольника
    const vertices = [];
    const sides = CONFIG.cookie.pieces.polygonSides;
    const enlargedRadius = hexagon.radius * CONFIG.cookie.pieces.sizeMultiplier;
    
    for (let j = 0; j < sides; j++) {
        const angle = (j * 2 * Math.PI) / sides;
        const vx = hexagon.x + Math.cos(angle) * enlargedRadius;
        const vy = hexagon.y + Math.sin(angle) * enlargedRadius;
        vertices.push({ x: vx, y: vy });
    }
    
    // Разделяем вершины на внутренние и внешние
    const insideVertices = [];
    const outsideVertices = [];
    
    for (const vertex of vertices) {
        if (isPointInCoreArea(vertex.x, vertex.y)) {
            insideVertices.push(vertex);
        } else {
            outsideVertices.push(vertex);
        }
    }
    
    // Создаем клонов кусочка для внутренней и внешней частей
    const innerPart = { 
        ...hexagon, 
        id: hexagon.id + '_inner',
        isSplitPart: true,
        originalId: hexagon.id,
        partType: 'inner'
    };
    
    const outerPart = { 
        ...hexagon, 
        id: hexagon.id + '_outer',
        isSplitPart: true,
        originalId: hexagon.id,
        partType: 'outer'
    };
    
    return { innerPart, outerPart, insideVertices, outsideVertices };
}

// Вычисление точек пересечения границы центральной формы с кусочком
function calculateShapeBoundaryIntersections(hexagon) {
    const cookieSprite = window.cookie;
    if (!cookieSprite) return [];
    
    const centerX = cookieSprite.x;
    const centerY = cookieSprite.y;
    const centerShapeConfig = CONFIG.centerShape;
    const coreSize = (cookieSprite.width * centerShapeConfig.sizePercent) / 2;
    
    // Получаем ребра шестиугольника
    const vertices = [];
    const sides = CONFIG.cookie.pieces.polygonSides;
    const enlargedRadius = hexagon.radius * CONFIG.cookie.pieces.sizeMultiplier;
    
    for (let j = 0; j < sides; j++) {
        const angle = (j * 2 * Math.PI) / sides;
        const vx = hexagon.x + Math.cos(angle) * enlargedRadius;
        const vy = hexagon.y + Math.sin(angle) * enlargedRadius;
        vertices.push({ x: vx, y: vy });
    }
    
    const intersections = [];
    
    // Проверяем каждое ребро шестиугольника на пересечение с границей формы
    for (let i = 0; i < vertices.length; i++) {
        const v1 = vertices[i];
        const v2 = vertices[(i + 1) % vertices.length];
        
        let intersection = null;
        
        switch (centerShapeConfig.form) {
            case 1: // Круг
                intersection = findLineCircleIntersection(
                    v1.x, v1.y, v2.x, v2.y,
                    centerX, centerY, coreSize
                );
                break;
                
            case 2: // Квадрат
                intersection = findLineSquareIntersection(
                    v1.x, v1.y, v2.x, v2.y,
                    centerX, centerY, coreSize
                );
                break;
                
            case 3: // Треугольник
                intersection = findLineTriangleIntersection(
                    v1.x, v1.y, v2.x, v2.y,
                    centerX, centerY, coreSize * 2
                );
                break;
        }
        
        if (intersection) {
            intersections.push(...intersection);
        }
    }
    
    // Убираем дубликаты близких точек пересечения
    const uniqueIntersections = [];
    const tolerance = 0.1; // Толерантность для определения дубликатов
    
    for (const point of intersections) {
        let isDuplicate = false;
        for (const existing of uniqueIntersections) {
            const distance = Math.sqrt(Math.pow(point.x - existing.x, 2) + Math.pow(point.y - existing.y, 2));
            if (distance < tolerance) {
                isDuplicate = true;
                break;
            }
        }
        if (!isDuplicate) {
            uniqueIntersections.push(point);
        }
    }
    
    return uniqueIntersections;
}

// Поиск пересечения линии с окружностью
function findLineCircleIntersection(x1, y1, x2, y2, cx, cy, radius) {
    const dx = x2 - x1;
    const dy = y2 - y1;
    const fx = x1 - cx;
    const fy = y1 - cy;
    
    const a = dx * dx + dy * dy;
    const b = 2 * (fx * dx + fy * dy);
    const c = fx * fx + fy * fy - radius * radius;
    
    const discriminant = b * b - 4 * a * c;
    
    if (discriminant < 0) return null;
    
    const intersections = [];
    const sqrt_discriminant = Math.sqrt(discriminant);
    
    const t1 = (-b - sqrt_discriminant) / (2 * a);
    const t2 = (-b + sqrt_discriminant) / (2 * a);
    
    if (t1 >= 0 && t1 <= 1) {
        intersections.push({
            x: x1 + t1 * dx,
            y: y1 + t1 * dy
        });
    }
    
    if (t2 >= 0 && t2 <= 1 && t2 !== t1) {
        intersections.push({
            x: x1 + t2 * dx,
            y: y1 + t2 * dy
        });
    }
    
    return intersections.length > 0 ? intersections : null;
}

// Поиск пересечения линии с квадратом
function findLineSquareIntersection(x1, y1, x2, y2, cx, cy, halfSize) {
    const intersections = [];
    
    // Границы квадрата
    const left = cx - halfSize;
    const right = cx + halfSize;
    const top = cy - halfSize;
    const bottom = cy + halfSize;
    
    // Проверяем пересечение с каждой стороной квадрата
    const sides = [
        { x1: left, y1: top, x2: right, y2: top },     // верх
        { x1: right, y1: top, x2: right, y2: bottom }, // право
        { x1: right, y1: bottom, x2: left, y2: bottom }, // низ
        { x1: left, y1: bottom, x2: left, y2: top }    // лево
    ];
    
    for (const side of sides) {
        const intersection = findLineLineIntersection(
            x1, y1, x2, y2,
            side.x1, side.y1, side.x2, side.y2
        );
        if (intersection) {
            intersections.push(intersection);
        }
    }
    
    return intersections.length > 0 ? intersections : null;
}

// Поиск пересечения линии с треугольником
function findLineTriangleIntersection(x1, y1, x2, y2, cx, cy, size) {
    const intersections = [];
    
    // Вершины треугольника (точно как в drawTriangleShape)
    const height = size * Math.sqrt(3) / 2;
    const halfBase = size / 2;
    const centroidOffsetY = height / 3;
    
    const vertices = [
        { x: cx, y: cy - (height - centroidOffsetY) },           // Верхняя точка
        { x: cx + halfBase, y: cy + centroidOffsetY },           // Правая нижняя точка
        { x: cx - halfBase, y: cy + centroidOffsetY }            // Левая нижняя точка
    ];
    
    // Проверяем пересечение с каждой стороной треугольника
    for (let i = 0; i < 3; i++) {
        const v1 = vertices[i];
        const v2 = vertices[(i + 1) % 3];
        
        const intersection = findLineLineIntersection(
            x1, y1, x2, y2,
            v1.x, v1.y, v2.x, v2.y
        );
        
        if (intersection) {
            intersections.push(intersection);
        }
    }
    
    return intersections.length > 0 ? intersections : null;
}

// Поиск пересечения двух линий
function findLineLineIntersection(x1, y1, x2, y2, x3, y3, x4, y4) {
    const denom = (x1 - x2) * (y3 - y4) - (y1 - y2) * (x3 - x4);
    
    if (Math.abs(denom) < 1e-10) return null; // Параллельные линии
    
    const t = ((x1 - x3) * (y3 - y4) - (y1 - y3) * (x3 - x4)) / denom;
    const u = -((x1 - x2) * (y1 - y3) - (y1 - y2) * (x1 - x3)) / denom;
    
    if (t >= 0 && t <= 1 && u >= 0 && u <= 1) {
        return {
            x: x1 + t * (x2 - x1),
            y: y1 + t * (y2 - y1)
        };
    }
    
    return null;
}

// Создание отдельных масок для внутренней и внешней частей кусочка
function createSplitMasks(hexagon, intersections) {
    const cookieSprite = window.cookie;
    if (!cookieSprite) return null;
    
    const centerX = cookieSprite.x;
    const centerY = cookieSprite.y;
    const centerShapeConfig = CONFIG.centerShape;
    
    // Получаем вершины шестиугольника
    const vertices = [];
    const sides = CONFIG.cookie.pieces.polygonSides;
    const enlargedRadius = hexagon.radius * CONFIG.cookie.pieces.sizeMultiplier;
    
    for (let j = 0; j < sides; j++) {
        const angle = (j * 2 * Math.PI) / sides;
        const vx = hexagon.x + Math.cos(angle) * enlargedRadius;
        const vy = hexagon.y + Math.sin(angle) * enlargedRadius;
        vertices.push({ x: vx, y: vy });
    }
    
    // Разделяем вершины на внутренние и внешние
    const insideVertices = [];
    const outsideVertices = [];
    
    for (const vertex of vertices) {
        if (isPointInCoreArea(vertex.x, vertex.y)) {
            insideVertices.push(vertex);
        } else {
            outsideVertices.push(vertex);
        }
    }
    
    if (CONFIG.dev.consoleLogging) {
        console.log(`🔄 Разделение кусочка: внутренних вершин=${insideVertices.length}, внешних=${outsideVertices.length}`);
    }
    
    // Добавляем точки пересечения к соответствующим массивам
    // Сортируем пересечения по углу для корректного порядка
    const sortedIntersections = intersections.sort((a, b) => {
        const angleA = Math.atan2(a.y - hexagon.y, a.x - hexagon.x);
        const angleB = Math.atan2(b.y - hexagon.y, b.x - hexagon.x);
        return angleA - angleB;
    });
    
    for (const point of sortedIntersections) {
        insideVertices.push(point);
        outsideVertices.push(point);
    }
    
    // Сортируем точки по углу относительно центра кусочка
    const sortByAngle = (points) => {
        return points.sort((a, b) => {
            const angleA = Math.atan2(a.y - hexagon.y, a.x - hexagon.x);
            const angleB = Math.atan2(b.y - hexagon.y, b.x - hexagon.x);
            return angleA - angleB;
        });
    };
    
    const sortedInsideVertices = sortByAngle([...insideVertices]);
    const sortedOutsideVertices = sortByAngle([...outsideVertices]);
    
    // Создаем маски
    const innerMask = new Graphics();
    const outerMask = new Graphics();
    
    // Создаем внутреннюю маску
    if (sortedInsideVertices.length >= 3) {
        const innerVertices = [];
        for (const vertex of sortedInsideVertices) {
            innerVertices.push(vertex.x - hexagon.x, vertex.y - hexagon.y);
        }
        innerMask.poly(innerVertices);
        innerMask.fill(0xFFFFFF);
    } else {
        // Если внутренних вершин мало, создаем небольшую маску в центре
        innerMask.circle(0, 0, 2);
        innerMask.fill(0xFFFFFF);
    }
    
    // Создаем внешнюю маску
    if (sortedOutsideVertices.length >= 3) {
        const outerVertices = [];
        for (const vertex of sortedOutsideVertices) {
            outerVertices.push(vertex.x - hexagon.x, vertex.y - hexagon.y);
        }
        outerMask.poly(outerVertices);
        outerMask.fill(0xFFFFFF);
    } else {
        // Если внешних вершин мало, создаем полную маску шестиугольника
        const enlargedRadius = hexagon.radius * CONFIG.cookie.pieces.sizeMultiplier;
        const sides = CONFIG.cookie.pieces.polygonSides;
        const fullHexVertices = [];
        for (let j = 0; j < sides; j++) {
            const angle = (j * 2 * Math.PI) / sides;
            const vx = Math.cos(angle) * enlargedRadius;
            const vy = Math.sin(angle) * enlargedRadius;
            fullHexVertices.push(vx, vy);
        }
        outerMask.poly(fullHexVertices);
        outerMask.fill(0xFFFFFF);
    }
    
    return {
        innerMask,
        outerMask,
        insideVertices: sortedInsideVertices,
        outsideVertices: sortedOutsideVertices
    };
}

// Создание разделенных кусочков с отдельными масками
function createSplitHexagons(x, y, hexId, rotation, tempHex, intersections, isEdgePiece) {
    const masks = createSplitMasks(tempHex, intersections);
    if (!masks) return null;
    
    const cookieTexture = Assets.get('cookie');
    const innerColor = 0xFF00FF; // Сиреневый цвет для внутренних частей (основание)
    const outerColor = CONFIG.dev.splitPieceColors.outer;
    
    // Создаем контейнер для внутренней части
    const innerContainer = new Container();
    innerContainer.x = x;
    innerContainer.y = y;
    
    // Создаем контейнер для внешней части
    const outerContainer = new Container();
    outerContainer.x = x;
    outerContainer.y = y;
    
    // Создаем спрайты с текстурой для обеих частей
    const innerTextureSprite = new Sprite(cookieTexture);
    const outerTextureSprite = new Sprite(cookieTexture);
    
    // Настраиваем спрайты - позиционируем их так, чтобы показать нужную часть печенья
    [innerTextureSprite, outerTextureSprite].forEach(sprite => {
        sprite.anchor.set(0.5);
        sprite.width = window.cookie.width;
        sprite.height = window.cookie.height;
        // Смещаем спрайт так, чтобы точка (x,y) кусочка совпадала с соответствующей точкой на текстуре
        sprite.x = window.cookie.x - x;
        sprite.y = window.cookie.y - y;
    });
    
    // Применяем маски ПРАВИЛЬНО: внутренняя часть должна использовать внутреннюю маску
    innerTextureSprite.mask = masks.innerMask;  // Внутренняя часть использует внутреннюю маску
    outerTextureSprite.mask = masks.outerMask;  // Внешняя часть использует внешнюю маску
    
    // Добавляем спрайты и маски к контейнерам
    // Сначала добавляем маски (они невидимы и используются для обрезки)
    innerContainer.addChild(masks.innerMask);
    outerContainer.addChild(masks.outerMask);
    
    // Затем добавляем спрайты с текстурой (они будут обрезаны масками)
    innerContainer.addChild(innerTextureSprite);
    outerContainer.addChild(outerTextureSprite);
    
    // Выгрызы уже есть в текстуре печенья, не нужно добавлять отдельно
    
    // Добавляем цветные оверлеи ПОВЕРХ текстуры для видимости
    const innerOverlay = new Graphics();
    const outerOverlay = new Graphics();
    
    // Добавляем цветные оверлеи только если включена отладка
    if (CONFIG.dev.showSplitPieces) {
        // Создаем цветные оверлеи ПРАВИЛЬНО: внутренние вершины для внутренней части
        if (masks.insideVertices && masks.insideVertices.length >= 3) {
            const innerVertices = [];
            for (const vertex of masks.insideVertices) {
                innerVertices.push(vertex.x - x, vertex.y - y);
            }
            innerOverlay.poly(innerVertices);
            innerOverlay.fill({ color: innerColor, alpha: 0.2 }); // Желтый для внутренней части
            innerContainer.addChild(innerOverlay);
            
            if (CONFIG.dev.consoleLogging) {
                console.log(`🟡 Создан желтый оверлей для внутренней части из ${masks.insideVertices.length} вершин`);
            }
        }
        
        if (masks.outsideVertices && masks.outsideVertices.length >= 3) {
            const outerVertices = [];
            for (const vertex of masks.outsideVertices) {
                outerVertices.push(vertex.x - x, vertex.y - y);
            }
            outerOverlay.poly(outerVertices);
            outerOverlay.fill({ color: outerColor, alpha: 0.2 }); // Зеленый для внешней части
            outerContainer.addChild(outerOverlay);
            
            if (CONFIG.dev.consoleLogging) {
                console.log(`🟢 Создан зеленый оверлей для внешней части из ${masks.outsideVertices.length} вершин`);
            }
        }
    }
    
    // Границу между частями убираем для естественного вида
    // const borderLine = new Graphics();
    // if (intersections.length >= 2) {
    //     borderLine.moveTo(intersections[0].x - x, intersections[0].y - y);
    //     for (let i = 1; i < intersections.length; i++) {
    //         borderLine.lineTo(intersections[i].x - x, intersections[i].y - y);
    //     }
    //     borderLine.stroke({ color: 0x000000, width: 2, alpha: 0.8 });
    //     
    //     // Добавляем границу к обеим частям
    //     innerContainer.addChild(borderLine.clone());
    //     outerContainer.addChild(borderLine);
    // }
    
    // Добавляем контейнеры на сцену
    window.app.stage.addChild(innerContainer);
    window.app.stage.addChild(outerContainer);
    
    // Создаем объекты кусочков
    const innerHex = {
        id: `small_hex_${hexId}_inner`,
        graphics: null,
        container: innerContainer,
        textureSprite: innerTextureSprite,
        x: x,
        y: y,
        radius: tempHex.radius,
        index: hexId,
        originalColor: innerColor,
        currentColor: innerColor,
        isPainted: false,
        isInCenterShape: true, // Внутренняя часть логически в центре
        isEdgePiece: isEdgePiece,
        isEdgeOfCenterShape: false,
        isSplitPart: true,
        partType: 'inner'
    };
    
    const outerHex = {
        id: `small_hex_${hexId}_outer`,
        graphics: null,
        container: outerContainer,
        textureSprite: outerTextureSprite,
        x: x,
        y: y,
        radius: tempHex.radius,
        index: hexId + 1,
        originalColor: outerColor,
        currentColor: outerColor,
        isPainted: false,
        isInCenterShape: false, // Внешняя часть логически снаружи
        isEdgePiece: isEdgePiece,
        isEdgeOfCenterShape: false,
        isSplitPart: true,
        partType: 'outer'
    };
    
    return {
        innerHex,
        outerHex
    };
}

// Поиск областей, отделенных от центральной формы
function findDetachedAreas() {
    const cookieSprite = window.cookie;
    if (!cookieSprite) return [];
    
    const detachedAreas = [];
    const cookieRadius = cookieSprite.width / 2;
    const centerX = cookieSprite.x;
    const centerY = cookieSprite.y;
    
    // Простой алгоритм: проверяем точки на окружности печенья
    // Проверка отделенных областей
    const testPoints = [];
    const numTestPoints = 32; // Количество тестовых точек по окружности
    
    for (let i = 0; i < numTestPoints; i++) {
        const angle = (i / numTestPoints) * Math.PI * 2;
        const testRadius = cookieRadius * 0.9; // Немного внутри края
        const testX = centerX + Math.cos(angle) * testRadius;
        const testY = centerY + Math.sin(angle) * testRadius;
        
        testPoints.push({ x: testX, y: testY, angle: angle });
    }
    
    // Проверяем каждую тестовую точку
    for (const point of testPoints) {
        if (!isPointConnectedToCore(point.x, point.y)) {
            // Точка отделена от центра - создаем область
            const area = createAreaAroundPoint(point);
            if (area && area.size > CONFIG.chips.minSize) {
                detachedAreas.push(area);
            }
        }
    }
    
    return detachedAreas;
}


// Создание области вокруг отделенной точки
function createAreaAroundPoint(point) {
    const areaSize = 40; // Размер области
    return {
        centerX: point.x,
        centerY: point.y,
        size: areaSize,
        angle: point.angle
    };
}





// Создание отколовшегося куска
function createChip(area) {
    if (isDev) {
        console.log(`🍪 Создаем отколовшийся кусок в (${area.centerX.toFixed(1)}, ${area.centerY.toFixed(1)})`);
    }
    
    // Создаем графический объект для куска
    const chip = new Graphics();
    chip.circle(0, 0, area.size / 2).fill(CONFIG.chips.visual.color);
    
    // Позиционируем кусок
    chip.x = area.centerX;
    chip.y = area.centerY;
    
    // Добавляем в stage (поверх печенья)
    app.stage.addChild(chip);
    
    // Анимация откалывания
    animateChipFall(chip, area);
}

// Анимация падения куска
function animateChipFall(chip, area) {
    const physics = CONFIG.chips.physics;
    
    // Начальная скорость
    let velocityX = physics.initialVelocity.x.min + 
                   Math.random() * (physics.initialVelocity.x.max - physics.initialVelocity.x.min);
    let velocityY = physics.initialVelocity.y.min + 
                   Math.random() * (physics.initialVelocity.y.max - physics.initialVelocity.y.min);
    
    // Вращение
    let rotationSpeed = physics.rotation.min + 
                       Math.random() * (physics.rotation.max - physics.rotation.min);
    
    // Анимационный цикл
    const animate = () => {
        // Применяем физику
        velocityY += physics.gravity;
        chip.x += velocityX;
        chip.y += velocityY;
        chip.rotation += rotationSpeed;
        
        // Уменьшение размера и прозрачности
        chip.scale.x *= CONFIG.chips.visual.scaleReduction;
        chip.scale.y *= CONFIG.chips.visual.scaleReduction;
        chip.alpha -= physics.fadeSpeed;
        
        // Проверяем, нужно ли продолжать анимацию
        if (chip.alpha > 0 && chip.y < app.screen.height + 100) {
            requestAnimationFrame(animate);
        } else {
            // Удаляем кусок
            app.stage.removeChild(chip);
            chip.destroy();
        }
    };
    
    animate();
}

// Функция анимации полного рассыпания печеньки
function animateFullCookieCrumble(callback) {
    const smallHexagons = window.smallHexagons;
    if (!smallHexagons || smallHexagons.length === 0) {
        // Если нет кусочков, сразу вызываем callback
        if (callback) callback();
        return;
    }
    
    // Получаем все кусочки, которые еще видимы
    const visibleHexagons = smallHexagons.filter(hex => 
        hex.container && 
        hex.container.parent && 
        !hex.isPainted
    );
    
    if (visibleHexagons.length === 0) {
        // Если нет видимых кусочков, сразу вызываем callback
        if (callback) callback();
        return;
    }
    
    // Разделяем кусочки на две группы
    const centerHexagons = visibleHexagons.filter(hex => hex.isInCenterShape);
    const outerHexagons = visibleHexagons.filter(hex => !hex.isInCenterShape);
    
    // ПЕРВАЯ ВОЛНА: кусочки внутри центральной фигуры
    centerHexagons.forEach((hex, index) => {
        // Небольшая случайная задержка для разнообразия (0-100мс)
        const randomDelay = Math.random() * 100;
        
        setTimeout(() => {
            if (hex.container && hex.container.parent && !hex.isPainted) {
                animateHexagonFall(hex.container, hex.radius, hex.x, hex.y);
                hex.isPainted = true;
            }
        }, randomDelay);
    });
    
    // ВТОРАЯ ВОЛНА: остальные кусочки через 200мс
    setTimeout(() => {
        outerHexagons.forEach((hex, index) => {
            // Небольшая случайная задержка для разнообразия (0-100мс)
            const randomDelay = Math.random() * 100;
            
            setTimeout(() => {
                if (hex.container && hex.container.parent && !hex.isPainted) {
                    animateHexagonFall(hex.container, hex.radius, hex.x, hex.y);
                    hex.isPainted = true;
                }
            }, randomDelay);
        });
    }, 200); // Задержка между волнами
    
    // Вызываем callback через время, достаточное для анимации обеих волн
    setTimeout(() => {
        if (callback) callback();
    }, 1600); // 200мс задержка + 1400мс на анимацию
}

// Функция проверки победы (остались только кусочки центральной формы)
function checkVictoryCondition() {
    const allHexagons = window.smallHexagons;
    if (!allHexagons) return false;
    
    // Находим все кусочки, которые НЕ относятся к центральной форме и НЕ обработаны (не упали)
    const remainingNonCenterPieces = allHexagons.filter(hex => {
        // Исключаем внутренние части разделенных кусочков и центральные кусочки
        if (hex.isSplitPart && hex.partType === 'inner') return false;
        if (hex.isInCenterShape && !hex.isSplitPart) return false;
        
        // Учитываем только внешние кусочки и внешние части разделенных кусочков
        return (!hex.isInCenterShape || (hex.isSplitPart && hex.partType === 'outer')) && 
               !hex.isPainted && 
               !hex.isEdgePiece;
    });
    
    if (isDev) {
        console.log(`🎯 Проверка победы: осталось внешних кусочков ${remainingNonCenterPieces.length}`);
    }
    
    // Если не осталось обычных кусочков - победа!
    return remainingNonCenterPieces.length === 0;
}

// Функция показа модального окна поздравления
function showCongratulationsModal() {
    // Проверяем, не показывалась ли уже модалка
    if (victoryShown) return;
    victoryShown = true;
    // Получаем текстуру печеньки для фона
    const cookieTexture = Assets.get('cookie');
    const cookieDataUrl = cookieTexture ? cookieTexture.source.resource.src : '';
    
    // Создаем модальное окно
    const modal = document.createElement('div');
    modal.id = 'congratulations-modal';
    modal.style.cssText = `
        position: fixed;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        background: rgba(0, 0, 0, 0.8);
        backdrop-filter: blur(10px);
        display: flex;
        justify-content: center;
        align-items: center;
        z-index: 10000;
        animation: modalFadeIn 0.5s ease-out;
    `;
    
    // Контейнер для модального окна
    const modalContent = document.createElement('div');
    modalContent.style.cssText = `
        background: linear-gradient(135deg, #4CAF50, #81C784);
        border-radius: 20px;
        padding: 40px;
        text-align: center;
        box-shadow: 0 20px 60px rgba(0, 0, 0, 0.3), 0 0 0 8px rgba(76, 175, 80, 0.3);
        max-width: 450px;
        width: 90%;
        animation: modalAppear 0.6s cubic-bezier(0.68, -0.55, 0.265, 1.55);
        border: 4px solid #4CAF50;
    `;
    
    // Заголовок Congratulations
    const title = document.createElement('h1');
    title.textContent = 'CONGRATULATIONS!';
    title.style.cssText = `
        color: #2E7D32;
        font-size: 32px;
        margin: 0 0 20px 0;
        text-shadow: 3px 3px 6px rgba(0, 0, 0, 0.3);
        font-weight: 900;
        letter-spacing: 1px;
        word-wrap: break-word;
        overflow-wrap: break-word;
    `;
    
    // Подзаголовок
    const subtitle = document.createElement('p');
    subtitle.textContent = 'You successfully cleared the cookie!';
    subtitle.style.cssText = `
        color: #1B5E20;
        font-size: 18px;
        margin: 0 0 30px 0;
        font-weight: 600;
    `;
    
    // Кнопка Play Again
    const playAgainButton = document.createElement('button');
    playAgainButton.textContent = 'Play Again';
    playAgainButton.style.cssText = `
        background: linear-gradient(45deg, #2E7D32, #4CAF50);
        color: white;
        border: none;
        padding: 15px 30px;
        font-size: 18px;
        border-radius: 10px;
        cursor: pointer;
        font-weight: bold;
        transition: all 0.3s ease;
        box-shadow: 0 4px 15px rgba(76, 175, 80, 0.4);
    `;
    
    // Эффекты для кнопки
    playAgainButton.addEventListener('mouseenter', () => {
        playAgainButton.style.transform = 'translateY(-2px)';
        playAgainButton.style.boxShadow = '0 6px 20px rgba(76, 175, 80, 0.6)';
    });
    
    playAgainButton.addEventListener('mouseleave', () => {
        playAgainButton.style.transform = 'translateY(0)';
        playAgainButton.style.boxShadow = '0 4px 15px rgba(76, 175, 80, 0.4)';
    });
    
    playAgainButton.addEventListener('click', () => {
        // Закрываем модальное окно
        modal.remove();
        victoryShown = false;
        
        // Перезапускаем игру без перезагрузки страницы
        restartGame();
    });
    
    // Добавляем элементы
    modalContent.appendChild(title);
    modalContent.appendChild(subtitle);
    modalContent.appendChild(playAgainButton);
    modal.appendChild(modalContent);
    
    // Добавляем CSS анимации
    const style = document.createElement('style');
    style.textContent = `
        @keyframes modalFadeIn {
            from { opacity: 0; }
            to { opacity: 1; }
        }
        @keyframes modalAppear {
            from {
                opacity: 0;
                transform: scale(0.5) translateY(-50px);
            }
            to {
                opacity: 1;
                transform: scale(1) translateY(0);
            }
        }
    `;
    document.head.appendChild(style);
    
    // Показываем модальное окно
    document.body.appendChild(modal);
    
    if (isDev) {
        console.log('🏆 Показана модалка поздравления с победой!');
    }
}

// Функция показа модального окна Game Over
function showGameOverModal() {
    // Проверяем, не показывалась ли уже модалка (но не перезаписываем флаг, если он уже true)
    if (gameOverShown && document.getElementById('game-over-modal')) return;
    gameOverShown = true;
    // Получаем текстуру печеньки для фона
    const cookieTexture = Assets.get('cookie');
    const cookieDataUrl = cookieTexture ? cookieTexture.source.resource.src : '';
    
    // Создаем модальное окно только с блюром
    const modal = document.createElement('div');
    modal.id = 'game-over-modal';
    modal.style.cssText = `
        position: fixed;
        top: 0;
        left: 0;
        width: 100vw;
        height: 100vh;
        display: flex;
        justify-content: center;
        align-items: center;
        z-index: 10000;
        font-family: 'Comic Sans MS', cursive, Arial, sans-serif;
        backdrop-filter: blur(8px);
    `;
    
    // Добавляем CSS анимации (без мигания оверлея)
    const style = document.createElement('style');
    style.textContent = `
        @keyframes modalAppear {
            0% { 
                transform: scale(0.5) rotate(-5deg);
                opacity: 0;
            }
            100% { 
                transform: scale(1) rotate(0deg);
                opacity: 1;
            }
        }
        @keyframes buttonBounce {
            0%, 100% { transform: scale(1); }
            50% { transform: scale(1.05); }
        }
    `;
    document.head.appendChild(style);
    
    // Создаем содержимое модального окна с bg_modal.png
    const modalContent = document.createElement('div');
    modalContent.style.cssText = `
        background: url('./src/assets/textures/bg_modal.png');
        background-size: cover;
        background-position: center;
        position: relative;
        padding: 50px;
        border-radius: 30px;
        text-align: center;
        box-shadow: 0 20px 60px rgba(0, 0, 0, 0.3), 0 0 0 8px rgba(235, 141, 39, 0.3);
        max-width: 450px;
        width: 90%;
        animation: modalAppear 0.6s cubic-bezier(0.68, -0.55, 0.265, 1.55);
        border: 4px solid #EB8D27;
    `;
    
    // Контейнер для контента (без белого оверлея)
    const contentContainer = document.createElement('div');
    
    // Заголовок Game Over
    const title = document.createElement('h1');
    title.textContent = 'GAME OVER';
    title.style.cssText = `
        color: #d32f2f;
        font-size: 52px;
        margin: 0 0 20px 0;
        text-shadow: 3px 3px 6px rgba(0, 0, 0, 0.3);
        font-weight: 900;
        letter-spacing: 2px;
        transform: rotate(-2deg);
    `;
    
    // Подзаголовок
    const subtitle = document.createElement('p');
    subtitle.textContent = '🍪 You broke the figure! 🍪';
    subtitle.style.cssText = `
        color: #8B4513;
        font-size: 20px;
        margin: 0 0 35px 0;
        font-weight: bold;
        text-shadow: 1px 1px 2px rgba(0, 0, 0, 0.1);
        line-height: 1.4;
    `;
    
    // Кнопка Again
    const againButton = document.createElement('button');
    againButton.textContent = '🔄 TRY AGAIN';
    againButton.style.cssText = `
        background: linear-gradient(45deg, #4caf50, #66bb6a);
        color: white;
        border: none;
        padding: 18px 35px;
        font-size: 18px;
        font-weight: bold;
        border-radius: 25px;
        cursor: pointer;
        transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
        text-transform: uppercase;
        letter-spacing: 1px;
        box-shadow: 0 8px 20px rgba(76, 175, 80, 0.3);
        animation: buttonBounce 2s ease-in-out infinite;
        border: 3px solid rgba(255, 255, 255, 0.2);
    `;
    
    // Эффекты для кнопки
    againButton.addEventListener('mouseenter', () => {
        againButton.style.background = 'linear-gradient(45deg, #45a049, #5cb85c)';
        againButton.style.transform = 'translateY(-3px) scale(1.05)';
        againButton.style.boxShadow = '0 12px 25px rgba(76, 175, 80, 0.4)';
    });
    againButton.addEventListener('mouseleave', () => {
        againButton.style.background = 'linear-gradient(45deg, #4caf50, #66bb6a)';
        againButton.style.transform = 'translateY(0) scale(1)';
        againButton.style.boxShadow = '0 8px 20px rgba(76, 175, 80, 0.3)';
    });
    
    // Обработчик клика на кнопку
    againButton.addEventListener('click', () => {
        // Анимация закрытия
        modal.style.animation = 'none';
        modal.style.opacity = '0';
        modal.style.transform = 'scale(0.9)';
        modal.style.transition = 'all 0.3s ease-out';
        
        setTimeout(() => {
            document.body.removeChild(modal);
            document.head.removeChild(style);
            restartGame();
        }, 300);
    });
    
    // Собираем модальное окно
    contentContainer.appendChild(title);
    contentContainer.appendChild(subtitle);
    contentContainer.appendChild(againButton);
    modalContent.appendChild(contentContainer);
    modal.appendChild(modalContent);
    
    // Добавляем на страницу
    document.body.appendChild(modal);
}

// Функция перезапуска игры
function restartGame() {
    try {
        // Восстанавливаем сохраненное состояние конфига
        restoreConfigState();
        
        // Очищаем сцену от всех объектов
        if (window.app && window.app.stage) {
            window.app.stage.removeChildren();
        }
        
        // Сброс глобальных переменных
        needlePressed = false;
        isDragging = false;
        activeChips = [];
        gameOverShown = false; // Сбрасываем флаг модалки
        
        // Очищаем ссылки на игровые объекты
        window.cookie = null;
        window.needle = null;
        window.needleShadow = null;
        window.centerShape = null;
        window.smallHexagons = [];
        
        // Создаем новую печеньку и игровые объекты
        const app = window.app;
        createCookie(app);
        createNeedle(app);
        
        // Настраиваем интерактивность заново
        setupInteractivity(app);
        
        // Запускаем анимацию пульсации
        startPulseAnimation(app);
        
        // Обновляем кнопки смены формы, если они есть
        updateShapeButtons();
        
        // Обновляем значение hexGrid в UI, если кнопки есть
        const hexValue = document.getElementById('hex-value');
        if (hexValue) {
            hexValue.textContent = CONFIG.cookie.pieces.hexGrid;
        }
        
        if (isDev) {
            console.log('🔄 Игра перезапущена успешно');
        }
    } catch (error) {
        // Если что-то пошло не так, перезагружаем страницу как fallback
        console.error('Ошибка при перезапуске игры:', error);
        window.location.reload();
    }
}

// Создание кнопок смены формы (технические кнопки для тестирования)
function createShapeButtons() {
    // Удаляем существующие кнопки, если есть
    const existingContainer = document.getElementById('shape-buttons-container');
    if (existingContainer) {
        existingContainer.remove();
    }
    
    // Создаем контейнер для кнопок
    const container = document.createElement('div');
    container.id = 'shape-buttons-container';
    container.style.cssText = `
        position: fixed;
        top: 20px;
        left: 20px;
        display: flex;
        flex-direction: column;
        gap: 10px;
        z-index: 1000;
        background: rgba(0, 0, 0, 0.8);
        padding: 15px;
        border-radius: 10px;
        backdrop-filter: blur(5px);
        min-width: 200px;
    `;
    
    // Создаем заголовок для форм
    const shapeLabel = document.createElement('div');
    shapeLabel.textContent = 'Shape';
    shapeLabel.style.cssText = `
        color: #fff;
        font-size: 12px;
        font-weight: bold;
        text-align: center;
        margin-bottom: 5px;
    `;
    container.appendChild(shapeLabel);
    
    // Контейнер для кнопок форм
    const shapesContainer = document.createElement('div');
    shapesContainer.style.cssText = `
        display: flex;
        gap: 10px;
        justify-content: center;
    `;
    
    // Данные для кнопок форм
    const shapes = [
        { id: 1, name: 'Circle', symbol: '●', color: '#4CAF50' },
        { id: 2, name: 'Square', symbol: '■', color: '#2196F3' },
        { id: 3, name: 'Triangle', symbol: '▲', color: '#FF9800' }
    ];
    
    shapes.forEach(shape => {
        const button = document.createElement('button');
        button.textContent = shape.symbol;
        button.title = shape.name;
        
        const isActive = CONFIG.centerShape.form === shape.id;
        
        button.style.cssText = `
            width: 50px;
            height: 50px;
            border: 2px solid ${isActive ? shape.color : '#666'};
            background: ${isActive ? shape.color : 'rgba(255, 255, 255, 0.1)'};
            color: ${isActive ? 'white' : '#ccc'};
            border-radius: 8px;
            font-size: 24px;
            cursor: pointer;
            transition: all 0.3s ease;
            display: flex;
            align-items: center;
            justify-content: center;
        `;
        
        // Эффекты hover
        button.addEventListener('mouseenter', () => {
            button.style.transform = 'scale(1.1)';
            button.style.boxShadow = `0 0 15px ${shape.color}`;
        });
        
        button.addEventListener('mouseleave', () => {
            button.style.transform = 'scale(1)';
            button.style.boxShadow = 'none';
        });
        
        // Обработчик смены формы
        button.addEventListener('click', (event) => {
            event.preventDefault();
            event.stopPropagation();
            changeShape(shape.id);
            updateShapeButtons(); // Обновляем активную кнопку
        });
        
        // Дополнительная защита для мобильных
        button.addEventListener('touchend', (event) => {
            event.preventDefault();
            event.stopPropagation();
            changeShape(shape.id);
            updateShapeButtons();
        });
        
        shapesContainer.appendChild(button);
    });
    
    container.appendChild(shapesContainer);
    
    // Создаем заголовок для hexGrid
    const hexLabel = document.createElement('div');
    hexLabel.textContent = 'Pieces Count';
    hexLabel.style.cssText = `
        color: #fff;
        font-size: 12px;
        font-weight: bold;
        text-align: center;
        margin-top: 10px;
        margin-bottom: 5px;
    `;
    container.appendChild(hexLabel);
    
    // Контейнер для контроля hexGrid
    const hexContainer = document.createElement('div');
    hexContainer.style.cssText = `
        display: flex;
        align-items: center;
        gap: 10px;
        justify-content: center;
    `;
    
    // Кнопка уменьшения
    const decreaseBtn = document.createElement('button');
    decreaseBtn.textContent = '−';
    decreaseBtn.title = 'Decrease pieces';
    decreaseBtn.style.cssText = `
        width: 35px;
        height: 35px;
        border: 2px solid #666;
        background: rgba(255, 255, 255, 0.1);
        color: #ccc;
        border-radius: 6px;
        font-size: 20px;
        cursor: pointer;
        transition: all 0.3s ease;
        display: flex;
        align-items: center;
        justify-content: center;
    `;
    
    // Отображение текущего значения
    const hexValue = document.createElement('span');
    hexValue.textContent = CONFIG.cookie.pieces.hexGrid;
    hexValue.style.cssText = `
        color: #fff;
        font-size: 14px;
        font-weight: bold;
        min-width: 30px;
        text-align: center;
    `;
    
    // Кнопка увеличения
    const increaseBtn = document.createElement('button');
    increaseBtn.textContent = '+';
    increaseBtn.title = 'Increase pieces';
    increaseBtn.style.cssText = `
        width: 35px;
        height: 35px;
        border: 2px solid #666;
        background: rgba(255, 255, 255, 0.1);
        color: #ccc;
        border-radius: 6px;
        font-size: 20px;
        cursor: pointer;
        transition: all 0.3s ease;
        display: flex;
        align-items: center;
        justify-content: center;
    `;
    
    // Обработчики для hexGrid кнопок
    decreaseBtn.addEventListener('click', (event) => {
        event.preventDefault();
        event.stopPropagation();
        changeHexGrid(CONFIG.cookie.pieces.hexGrid - 5);
        hexValue.textContent = CONFIG.cookie.pieces.hexGrid;
    });
    
    increaseBtn.addEventListener('click', (event) => {
        event.preventDefault();
        event.stopPropagation();
        changeHexGrid(CONFIG.cookie.pieces.hexGrid + 5);
        hexValue.textContent = CONFIG.cookie.pieces.hexGrid;
    });
    
    // Дополнительная защита для мобильных
    decreaseBtn.addEventListener('touchend', (event) => {
        event.preventDefault();
        event.stopPropagation();
        changeHexGrid(CONFIG.cookie.pieces.hexGrid - 5);
        hexValue.textContent = CONFIG.cookie.pieces.hexGrid;
    });
    
    increaseBtn.addEventListener('touchend', (event) => {
        event.preventDefault();
        event.stopPropagation();
        changeHexGrid(CONFIG.cookie.pieces.hexGrid + 5);
        hexValue.textContent = CONFIG.cookie.pieces.hexGrid;
    });
    
    // Hover эффекты для hexGrid кнопок
    [decreaseBtn, increaseBtn].forEach(btn => {
        btn.addEventListener('mouseenter', () => {
            btn.style.transform = 'scale(1.1)';
            btn.style.background = 'rgba(255, 255, 255, 0.2)';
        });
        
        btn.addEventListener('mouseleave', () => {
            btn.style.transform = 'scale(1)';
            btn.style.background = 'rgba(255, 255, 255, 0.1)';
        });
    });
    
    hexContainer.appendChild(decreaseBtn);
    hexContainer.appendChild(hexValue);
    hexContainer.appendChild(increaseBtn);
    container.appendChild(hexContainer);
    
    document.body.appendChild(container);
    
    if (isDev) {
        console.log('🔘 Кнопки смены формы созданы');
    }
}

// Функция плавного перехода для перезапуска игры
function smoothRestart(restartCallback) {
    const gameArea = document.querySelector('.game-area');
    const canvas = document.getElementById('game-canvas');
    
    if (!gameArea || !canvas) {
        // Если элементы не найдены, выполняем обычный перезапуск
        restartCallback();
        return;
    }
    
    // Создаем оверлей для fade эффекта
    const overlay = document.createElement('div');
    overlay.style.cssText = `
        position: absolute;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        background: linear-gradient(135deg, #1a1a1a 0%, #2d2d2d 100%);
        opacity: 0;
        pointer-events: none;
        transition: opacity ${CONFIG.transition.fadeOut.duration}ms ${CONFIG.transition.fadeOut.easing};
        z-index: 1000;
        border-radius: inherit;
    `;
    
    gameArea.style.position = 'relative';
    gameArea.appendChild(overlay);
    
    // Запускаем fade out
    requestAnimationFrame(() => {
        overlay.style.opacity = '1';
    });
    
    // После завершения fade out выполняем перезапуск
    setTimeout(() => {
        restartCallback();
        
        // Запускаем fade in после небольшой задержки
        setTimeout(() => {
            overlay.style.transition = `opacity ${CONFIG.transition.fadeIn.duration}ms ${CONFIG.transition.fadeIn.easing}`;
            overlay.style.opacity = '0';
            
            // Удаляем оверлей после завершения анимации
            setTimeout(() => {
                if (overlay.parentNode) {
                    overlay.parentNode.removeChild(overlay);
                }
            }, CONFIG.transition.fadeIn.duration);
            
        }, CONFIG.transition.fadeIn.delay);
        
    }, CONFIG.transition.fadeOut.duration);
}

// Функции для сохранения и восстановления состояния конфига
function saveConfigState() {
    try {
        const configState = {
            centerShapeForm: CONFIG.centerShape.form,
            hexGrid: CONFIG.cookie.pieces.hexGrid
        };
        localStorage.setItem('cookindle_config', JSON.stringify(configState));
        
        if (isDev) {
            console.log('💾 Состояние конфига сохранено:', configState);
        }
    } catch (error) {
        if (isDev) {
            console.warn('⚠️ Ошибка сохранения конфига:', error);
        }
    }
}

function restoreConfigState() {
    try {
        const savedState = localStorage.getItem('cookindle_config');
        if (savedState) {
            const configState = JSON.parse(savedState);
            
            // Восстанавливаем только если значения валидные
            if (configState.centerShapeForm && [1, 2, 3].includes(configState.centerShapeForm)) {
                CONFIG.centerShape.form = configState.centerShapeForm;
            }
            
            if (configState.hexGrid && configState.hexGrid >= 15 && configState.hexGrid <= 65) {
                CONFIG.cookie.pieces.hexGrid = configState.hexGrid;
            }
            
            if (isDev) {
                console.log('🔄 Состояние конфига восстановлено:', configState);
            }
            
            return true;
        }
    } catch (error) {
        if (isDev) {
            console.warn('⚠️ Ошибка восстановления конфига:', error);
        }
    }
    return false;
}

// Функция смены формы центральной области
function changeShape(newShapeId) {
    if (CONFIG.centerShape.form === newShapeId) return; // Уже активна
    
    CONFIG.centerShape.form = newShapeId;
    
    // Сохраняем состояние конфига
    saveConfigState();
    
    if (isDev) {
        const shapeNames = { 1: 'Circle', 2: 'Square', 3: 'Triangle' };
        console.log(`🔄 Форма изменена на: ${shapeNames[newShapeId]}`);
    }
    
    // Полное пересоздание печеньки с новой формой
    if (isMobile) {
        smoothRestart(restartGame);
    } else {
        restartGame();
    }
}

// Функция смены количества кусочков (hexGrid)
function changeHexGrid(newHexGrid) {
    // Ограничиваем значения
    const minHex = 15;
    const maxHex = 65;
    const clampedValue = Math.max(minHex, Math.min(maxHex, newHexGrid));
    
    if (CONFIG.cookie.pieces.hexGrid === clampedValue) return; // Уже установлено
    
    CONFIG.cookie.pieces.hexGrid = clampedValue;
    
    // Сохраняем состояние конфига
    saveConfigState();
    
    if (isDev) {
        console.log(`🔄 Количество кусочков изменено на: ${clampedValue}`);
    }
    
    // НУЖНО пересоздать всю печеньку с новым количеством кусочков
    if (isMobile) {
        smoothRestart(restartGame);
    } else {
        restartGame();
    }
}

// Обновление активной кнопки
function updateShapeButtons() {
    const container = document.getElementById('shape-buttons-container');
    if (!container) return;
    
    const buttons = container.querySelectorAll('button');
    const shapes = [
        { id: 1, color: '#4CAF50' },
        { id: 2, color: '#2196F3' },
        { id: 3, color: '#FF9800' }
    ];
    
    buttons.forEach((button, index) => {
        const shape = shapes[index];
        if (!shape) return;
        const isActive = CONFIG.centerShape.form === shape.id;
        
        button.style.border = `2px solid ${isActive ? shape.color : '#666'}`;
        button.style.background = isActive ? shape.color : 'rgba(255, 255, 255, 0.1)';
        button.style.color = isActive ? 'white' : '#ccc';
    });
}

// Запуск приложения
initApp().catch(console.error);