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
let currentClickPoint = { x: 0, y: 0 }; // Текущая точка клика/касания

// Глобальные переменные для системы трещин и отколов
let cracksContainer = null; // Контейнер для всех трещин
let chipsContainer = null; // Контейнер для падающих осколков
let activeCracks = []; // Массив активных трещин
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
        
        // Инициализируем систему трещин и отколов
        initCrackSystem(app);
        
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
    const { form, size, color, lineWidth, alpha, dashed, dashLength, gapLength } = shapeConfig;
    
    
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
        // Обычная сплошная линия
        switch (form) {
            case 1: // Круг
                graphics.circle(x, y, halfSize);
                graphics.stroke({ color: color, width: lineWidth, alpha: alpha });
                break;
                
            case 2: // Квадрат
                graphics.rect(x - halfSize, y - halfSize, size, size);
                graphics.stroke({ color: color, width: lineWidth, alpha: alpha });
                break;
                
            case 3: // Треугольник
                drawTriangleShape(graphics, x, y, size);
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
function createCenterShapeWithPulse(x, y, cookieSize) {
    const container = new Graphics();
    const shapeSize = cookieSize * CONFIG.centerShape.sizePercent;
    const shapeConfig = { ...CONFIG.centerShape, size: shapeSize };
    
    // Создаем основную форму
    const mainShape = new Graphics();
    drawCenterShape(mainShape, 0, 0, shapeConfig);
    container.addChild(mainShape);
    
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
    const needleShadowSprite = window.needleShadow;
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

// Функция расчета позиции иглы относительно точки клика
function calculateNeedlePosition(clickX, clickY, pressed = false) {
    const distance = CONFIG.needle.shadow.distance;
    
    if (pressed) {
        // При нажатии игла приближается к точке клика
        return {
            x: clickX,
            y: clickY // Игла точно в точке клика
        };
    } else {
        // Обычное положение - игла смещена только по Y
        return {
            x: clickX,
            y: clickY - distance // Игла выше точки клика
        };
    }
}

// Функция расчета позиции тени относительно точки клика
function calculateShadowPosition(clickX, clickY, pressed = false) {
    const distance = CONFIG.needle.shadow.distance;
    
    if (pressed) {
        // При нажатии тень приближается к точке клика
        return {
            x: clickX,
            y: clickY // Тень точно в точке клика
        };
    } else {
        // Обычное положение - тень смещена по X и Y
        return {
            x: clickX + distance, // Тень правее точки клика
            y: clickY - distance  // Тень выше точки клика
        };
    }
}

// Функция обновления позиций иглы и тени относительно точки клика
function updateNeedleAndShadowPositions(needleSprite, needleShadowSprite, clickX, clickY, pressed = false) {
    if (!needleSprite) return;
    
    // Сохраняем текущую точку клика
    currentClickPoint.x = clickX;
    currentClickPoint.y = clickY;
    
    // Обновляем позицию иглы
    const needlePos = calculateNeedlePosition(clickX, clickY, pressed);
    needleSprite.x = needlePos.x;
    needleSprite.y = needlePos.y;
    
    // Обновляем позицию тени
    if (needleShadowSprite) {
        const shadowPos = calculateShadowPosition(clickX, clickY, pressed);
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

// Функция показа точки позиционирования
function showDebugPoint(x, y) {
    if (!isDev) return; // Только в режиме разработки
    
    let debugPoint = window.debugPoint;
    if (!debugPoint) {
        debugPoint = createDebugPoint();
        window.app.stage.addChild(debugPoint);
        window.debugPoint = debugPoint;
    }
    
    debugPoint.x = x;
    debugPoint.y = y;
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
    const cookieSize = minSize * 0.7;
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
        needleShadowSprite.visible = true;
        needleSprite.anchor.set(CONFIG.needle.mouseOffset.x, CONFIG.needle.mouseOffset.y); // Левый нижний угол
        needleShadowSprite.anchor.set(CONFIG.needle.mouseOffset.x, CONFIG.needle.mouseOffset.y);
        
        const startX = gameWidth * CONFIG.needle.mobile.staticPosition.x;
        const startY = gameHeight * CONFIG.needle.mobile.staticPosition.y;
        
        needleSprite.x = startX;
        needleSprite.y = startY;
        
        // Устанавливаем позицию тени через универсальную функцию
        updateNeedleAndShadowPositions(needleSprite, needleShadowSprite, startX, startY, false);
        
        needleBaseY = needleSprite.y;
    } else {
        needleSprite.visible = CONFIG.needle.visible;
        needleShadowSprite.visible = CONFIG.needle.visible;
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
                
                // Сначала анимируем перемещение иглы к точке касания
                animateNeedleToTouch(x, y);
                
                // Затем запускаем анимацию нажатия через время перемещения
                setTimeout(() => {
                    animateNeedlePress(true);
                }, CONFIG.needle.mobile.animationDuration * 1000);
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
            
            // Сначала перемещаем иглу к точке касания
            animateNeedleToTouch(x, y);
            
            // Затем имитируем нажатие через время перемещения
            setTimeout(() => {
                animateNeedlePress(true);
            }, CONFIG.needle.mobile.animationDuration * 1000);
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
        
        // Сначала перемещаем иглу к точке касания
        animateNeedleToTouch(x, y);
        
        // Затем имитируем нажатие через время перемещения
        setTimeout(() => {
            animateNeedlePress(true);
            
            // Автоматически отпускаем через короткое время
            setTimeout(() => {
                animateNeedlePress(false);
                
                // Возвращаем иглу в исходную позицию
                setTimeout(() => {
                    const gameWidth = gameArea.clientWidth;
                    const gameHeight = gameArea.clientHeight;
                    const staticX = gameWidth * CONFIG.needle.mobile.staticPosition.x;
                    const staticY = gameHeight * CONFIG.needle.mobile.staticPosition.y;
                    animateNeedleToTouch(staticX, staticY);
                }, 200);
            }, 300);
        }, CONFIG.needle.mobile.animationDuration * 1000); // Ждем окончания перемещения
    });
    
    // Добавляем обработчики mousedown/mouseup для мобильных как fallback
    gameArea.addEventListener('mousedown', (event) => {
        showTouchDebug('MOUSEDOWN EVENT');
        
        const rect = gameArea.getBoundingClientRect();
        const x = event.clientX - rect.left;
        const y = event.clientY - rect.top;
        
        // Сначала перемещаем иглу к точке касания
        animateNeedleToTouch(x, y);
        
        // Затем имитируем нажатие через время перемещения
        setTimeout(() => {
            animateNeedlePress(true);
        }, CONFIG.needle.mobile.animationDuration * 1000);
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
function updateNeedlePosition(x, y, inputType) {
    const needleSprite = window.needle;
    const needleShadowSprite = window.needleShadow;
    if (!needleSprite) return;
    
    // Показываем красную точку позиционирования
    showDebugPoint(x, y);
    
    const needleConfig = CONFIG.needle;
    
    // Устанавливаем якоря в зависимости от типа ввода
    if (inputType === 'mouse') {
        needleSprite.anchor.set(needleConfig.mouseOffset.x, needleConfig.mouseOffset.y);
        if (needleShadowSprite) {
            needleShadowSprite.anchor.set(needleConfig.mouseOffset.x, needleConfig.mouseOffset.y);
        }
    } else if (inputType === 'touch') {
        needleSprite.anchor.set(needleConfig.touchOffset.x, needleConfig.touchOffset.y);
        if (needleShadowSprite) {
            needleShadowSprite.anchor.set(needleConfig.touchOffset.x, needleConfig.touchOffset.y);
        }
    }
    
    // Обновляем позиции иглы и тени относительно точки клика
    updateNeedleAndShadowPositions(needleSprite, needleShadowSprite, x, y, false);
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
    
    // Создаем трещины при нажатии иглы, только если клик внутри печеньки
    if (pressed) {
        const insideCookie = isPointInsideCookie(currentClickPoint.x, currentClickPoint.y);
        if (isDev) {
            console.log(`🎯 Клик в точке (${currentClickPoint.x.toFixed(1)}, ${currentClickPoint.y.toFixed(1)}), внутри печеньки: ${insideCookie}`);
        }
        
        if (insideCookie) {
            createCracks(currentClickPoint.x, currentClickPoint.y);
        }
    }
    
    // Останавливаем предыдущую анимацию
    if (needleSprite.pressAnimation) {
        cancelAnimationFrame(needleSprite.pressAnimation);
    }
    
    // Рассчитываем целевые позиции для иглы и тени
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
        
        // Обновляем текущую точку клика и базовую позицию Y
        currentClickPoint.x = targetX;
        currentClickPoint.y = targetY;
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
                    gapLength: pulseConfig.gapLength
                };
                
                drawCenterShape(pulseShape, 0, 0, pulseConfigUpdated);
            }
        }
        
        requestAnimationFrame(animate);
    }
    
    animate();
}

// ========================
// СИСТЕМА ТРЕЩИН И ОТКОЛОВ
// ========================

// Создание контейнеров для трещин и осколков
function initCrackSystem(app) {
    // Создаем контейнер для трещин (под печеньем, но над фоном)
    cracksContainer = new Graphics();
    cracksContainer.zIndex = 10; // Под печеньем (которое имеет zIndex 100)
    app.stage.addChild(cracksContainer);
    
    // Создаем контейнер для падающих осколков
    chipsContainer = new Graphics();
    chipsContainer.zIndex = 500; // Над печеньем
    app.stage.addChild(chipsContainer);
    
    if (isDev) {
        console.log('🔧 Система трещин и отколов инициализирована');
    }
}

// Генерация трещин от точки нажатия
function createCracks(x, y) {
    const crackConfig = CONFIG.cracks;
    const cracksCount = Math.floor(Math.random() * (crackConfig.count.max - crackConfig.count.min + 1)) + crackConfig.count.min;
    
    if (isDev) {
        console.log(`💥 Создаем ${cracksCount} трещин от точки (${x}, ${y})`);
    }
    
    // Генерируем углы с минимальным расстоянием 70 градусов
    const minAngleDiff = 70 * (Math.PI / 180); // 70 градусов в радианах
    const angles = generateCrackAngles(cracksCount, minAngleDiff);
    
    for (let i = 0; i < cracksCount; i++) {
        if (isDev) {
            console.log(`🔸 Создаем трещину ${i+1}/${cracksCount} под углом ${(angles[i] * 180 / Math.PI).toFixed(1)}°`);
        }
        createRealisticCrack(x, y, i, angles[i]);
    }
    
    if (isDev) {
        console.log(`✅ Завершено создание трещин. Всего активных трещин: ${activeCracks.length}`);
    }
}

// Генерация углов трещин с минимальным расстоянием
function generateCrackAngles(cracksCount, minAngleDiff) {
    const angles = [];
    
    if (cracksCount === 2) {
        // Две трещины - минимум 70 градусов между ними
        const firstAngle = Math.random() * Math.PI * 2;
        angles.push(firstAngle);
        
        // Вторая трещина на расстоянии минимум 70 градусов
        const possibleRange = Math.PI * 2 - minAngleDiff;
        const secondAngleOffset = minAngleDiff + Math.random() * possibleRange;
        const secondAngle = (firstAngle + secondAngleOffset) % (Math.PI * 2);
        angles.push(secondAngle);
    } else {
        // Три или четыре трещины - равномерное распределение
        const baseAngleStep = (Math.PI * 2) / cracksCount;
        const startAngle = Math.random() * Math.PI * 2; // Случайная начальная позиция
        
        for (let i = 0; i < cracksCount; i++) {
            const baseAngle = startAngle + i * baseAngleStep;
            // Небольшое случайное отклонение (но не больше 20 градусов)
            const maxDeviation = Math.min(20 * (Math.PI / 180), baseAngleStep / 3);
            const deviation = (Math.random() - 0.5) * 2 * maxDeviation;
            const finalAngle = (baseAngle + deviation) % (Math.PI * 2);
            angles.push(finalAngle);
        }
    }
    
    return angles;
}

// Создание простой трещины
function createRealisticCrack(startX, startY, index, direction) {
    const crackConfig = CONFIG.cracks;
    
    // Начинаем генерацию зигзага в заданном направлении
    // Находим примерную конечную точку (для общего направления)
    const maxDistance = 300;
    const approximateEndX = startX + Math.cos(direction) * maxDistance;
    const approximateEndY = startY + Math.sin(direction) * maxDistance;
    
    // Генерируем зигзагообразный путь (он сам остановится при препятствии)
    const zigzagPath = generateZigzagPath(startX, startY, approximateEndX, approximateEndY);
    
    // Проверяем минимальную длину трещины
    if (zigzagPath.length < 2) {
        if (isDev) {
            console.log(`⚠️ Трещина ${index} не создана - слишком короткий путь (${zigzagPath.length} точек)`);
        }
        return; // Слишком короткая трещина
    }
    
    // Создаем объект трещины
    const crack = {
        id: `crack_${Date.now()}_${index}`,
        path: zigzagPath,
        graphics: new Graphics()
    };
    
    // Настраиваем графику трещины
    crack.graphics.zIndex = 15;
    cracksContainer.addChild(crack.graphics);
    
    // Добавляем в массив активных трещин
    activeCracks.push(crack);
    
    // Мгновенно рисуем трещину
    drawZigzagCrack(crack);
    
    // Проверяем образование осколков
    checkForChipFormation();
    
    if (isDev) {
        const lastPoint = zigzagPath[zigzagPath.length - 1];
        console.log(`🔸 Создана трещина ${crack.id}: от (${startX.toFixed(1)}, ${startY.toFixed(1)}) до (${lastPoint.x.toFixed(1)}, ${lastPoint.y.toFixed(1)}), ${zigzagPath.length} точек`);
    }
}

// Поиск конечной точки трещины (прямой луч до препятствия)
function findCrackEndPoint(startX, startY, direction) {
    // Получаем размеры печеньки
    const cookieSprite = window.cookie;
    if (!cookieSprite) return null;
    
    const cookieRadius = cookieSprite.width / 2;
    const cookieCenterX = cookieSprite.x;
    const cookieCenterY = cookieSprite.y;
    
    // Получаем размер центральной формы
    const centerShapeContainer = window.centerShape;
    const centerRadius = centerShapeContainer ? (cookieSprite.width * CONFIG.centerShape.sizePercent) / 2 : 0;
    
    // Максимальная длина трещины
    const maxLength = 300;
    
    // Конечная точка луча (если не встретим препятствие)
    const endX = startX + Math.cos(direction) * maxLength;
    const endY = startY + Math.sin(direction) * maxLength;
    
    let closestIntersection = { x: endX, y: endY, distance: maxLength };
    
    // 1. Проверяем пересечение с границей печеньки (трещина останавливается НА границе)
    const cookieBoundary = findCircleIntersection(
        startX, startY, endX, endY,
        cookieCenterX, cookieCenterY, cookieRadius - 2 // Небольшой отступ для визуального эффекта
    );
    
    if (cookieBoundary) {
        const distance = Math.sqrt(Math.pow(cookieBoundary.x - startX, 2) + Math.pow(cookieBoundary.y - startY, 2));
        if (distance < closestIntersection.distance) {
            closestIntersection = { ...cookieBoundary, distance };
        }
    }
    
    // 2. Проверяем НЕ пересечение с центральной формой (пунктирная линия)
    // Трещины не должны заходить ВНУТРЬ центральной фигуры
    if (centerRadius > 0) {
        // Проверяем, начинается ли трещина ВНЕ центральной фигуры
        const startDistanceFromCenter = Math.sqrt(Math.pow(startX - cookieCenterX, 2) + Math.pow(startY - cookieCenterY, 2));
        
        if (startDistanceFromCenter > centerRadius) {
            // Трещина начинается вне фигуры, найдем где она достигает границы фигуры (чтобы остановиться)
            const centerBoundary = findCircleIntersection(
                startX, startY, endX, endY,
                cookieCenterX, cookieCenterY, centerRadius
            );
            
            if (centerBoundary) {
                const distance = Math.sqrt(Math.pow(centerBoundary.x - startX, 2) + Math.pow(centerBoundary.y - startY, 2));
                if (distance < closestIntersection.distance) {
                    closestIntersection = { ...centerBoundary, distance };
                }
            }
        }
    }
    
    // 3. Проверяем пересечение с существующими трещинами
    const crackIntersection = checkSimpleCrackIntersection(startX, startY, endX, endY);
    if (crackIntersection) {
        const distance = Math.sqrt(Math.pow(crackIntersection.x - startX, 2) + Math.pow(crackIntersection.y - startY, 2));
        if (distance < closestIntersection.distance && distance > 10) { // Минимальное расстояние
            closestIntersection = { ...crackIntersection, distance };
        }
    }
    
    return { x: closestIntersection.x, y: closestIntersection.y };
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

// Генерация зигзагообразного пути как молния (обязательно до препятствия)
function generateZigzagPath(startX, startY, endX, endY) {
    const path = [{x: startX, y: startY}];
    
    // Вычисляем общее направление
    const mainDirection = Math.atan2(endY - startY, endX - startX);
    
    if (isDev) {
        console.log(`🔧 Генерируем зигзаг от (${startX.toFixed(1)}, ${startY.toFixed(1)}) в направлении ${(mainDirection * 180 / Math.PI).toFixed(1)}°`);
    }
    
    // Параметры зигзага
    const segmentLength = 8 + Math.random() * 6; // 8-14 пикселей на сегмент (меньше для более плавных трещин)
    const zigzagAmplitude = 6 + Math.random() * 6; // Амплитуда отклонений 6-12 пикселей
    
    let currentX = startX;
    let currentY = startY;
    
    // Продолжаем до тех пор, пока не достигнем препятствия
    for (let step = 0; step < 100; step++) { // Максимум 100 шагов для безопасности
        // Вычисляем следующую точку на основном направлении
        const stepX = Math.cos(mainDirection) * segmentLength;
        const stepY = Math.sin(mainDirection) * segmentLength;
        
        let nextX = currentX + stepX;
        let nextY = currentY + stepY;
        
        // Добавляем зигзагообразное отклонение
        const perpDirection = mainDirection + Math.PI / 2;
        const offset = (Math.random() - 0.5) * 2 * zigzagAmplitude;
        
        const zigzagX = nextX + Math.cos(perpDirection) * offset;
        const zigzagY = nextY + Math.sin(perpDirection) * offset;
        
        // Проверяем пересечение с существующими трещинами
        const crackIntersection = checkSimpleCrackIntersection(currentX, currentY, zigzagX, zigzagY);
        if (crackIntersection) {
            // Пересекается с существующей трещиной - останавливаемся на точке пересечения
            if (isDev) {
                console.log(`⚡ Зигзаг остановлен на шаге ${step}: пересечение с другой трещиной в (${crackIntersection.x.toFixed(1)}, ${crackIntersection.y.toFixed(1)})`);
            }
            path.push(crackIntersection);
            return path; // Успешно достигли препятствия
        }
        
        // Проверяем, находится ли точка с зигзагом в границах
        if (isPointWithinBoundaries(zigzagX, zigzagY)) {
            // Зигзаг в границах - используем его
            path.push({x: zigzagX, y: zigzagY});
            currentX = zigzagX;
            currentY = zigzagY;
        } else {
            // Зигзаг выходит за границы - пробуем прямую точку
            
            // Проверяем пересечение прямой линии с другими трещинами
            const crackIntersectionStraight = checkSimpleCrackIntersection(currentX, currentY, nextX, nextY);
            if (crackIntersectionStraight) {
                path.push(crackIntersectionStraight);
                return path; // Успешно достигли препятствия
            }
            
            // Проверяем, находится ли прямая точка в границах
            if (isPointWithinBoundaries(nextX, nextY)) {
                // Прямая точка в границах - используем её
                path.push({x: nextX, y: nextY});
                currentX = nextX;
                currentY = nextY;
            } else {
                // Даже прямая точка выходит за границы
                // Находим точное место пересечения с границей
                const boundaryIntersection = findExactBoundaryIntersection(currentX, currentY, nextX, nextY);
                if (boundaryIntersection) {
                    // Проверяем, что пересечение достаточно далеко от текущей позиции
                    const distanceToIntersection = Math.sqrt(
                        Math.pow(boundaryIntersection.x - currentX, 2) + 
                        Math.pow(boundaryIntersection.y - currentY, 2)
                    );
                    
                    if (distanceToIntersection > 5) { // Минимум 5 пикселей
                        if (isDev) {
                            console.log(`⚡ Зигзаг остановлен на шаге ${step}: достигнута граница в (${boundaryIntersection.x.toFixed(1)}, ${boundaryIntersection.y.toFixed(1)})`);
                        }
                        path.push(boundaryIntersection);
                        return path; // Успешно достигли границы
                    }
                }
                
                // Если пересечение слишком близко или не найдено, останавливаемся
                if (isDev) {
                    console.log(`⚡ Зигзаг остановлен на шаге ${step}: слишком близко к границе или нет пересечения`);
                }
                return path;
            }
        }
    }
    
    return path;
}

// Отрисовка зигзагообразной трещины
function drawZigzagCrack(crack) {
    const crackConfig = CONFIG.cracks;
    const graphics = crack.graphics;
    
    graphics.clear();
    
    if (!crack.path || crack.path.length < 2) return;
    
    // Рисуем зигзагообразную линию по точкам пути
    graphics.moveTo(crack.path[0].x, crack.path[0].y);
    
    for (let i = 1; i < crack.path.length; i++) {
        graphics.lineTo(crack.path[i].x, crack.path[i].y);
    }
    
    graphics.stroke({ 
        color: crackConfig.color, 
        width: crackConfig.lineWidth, 
        alpha: crackConfig.alpha 
    });
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

// Проверка пересечения с существующими зигзагообразными трещинами
function checkSimpleCrackIntersection(x1, y1, x2, y2) {
    const minDistance = 5; // Минимальное расстояние для проверки пересечений
    
    for (const existingCrack of activeCracks) {
        if (!existingCrack.path || existingCrack.path.length < 2) continue;
        
        // Проверяем пересечение с каждым сегментом существующей трещины
        for (let i = 0; i < existingCrack.path.length - 1; i++) {
            const segmentStart = existingCrack.path[i];
            const segmentEnd = existingCrack.path[i + 1];
            
            // Пропускаем сегменты, которые начинаются очень близко к началу новой трещины
            const distanceToStart = Math.sqrt((segmentStart.x - x1) ** 2 + (segmentStart.y - y1) ** 2);
            const distanceToEnd = Math.sqrt((segmentEnd.x - x1) ** 2 + (segmentEnd.y - y1) ** 2);
            
            if (distanceToStart < minDistance && distanceToEnd < minDistance) {
                continue; // Пропускаем сегменты, которые слишком близко к начальной точке
            }
            
            const intersection = findLineIntersection(
                x1, y1, x2, y2,
                segmentStart.x, segmentStart.y, segmentEnd.x, segmentEnd.y
            );
            
            if (intersection) {
                // Дополнительная проверка - пересечение должно быть на достаточном расстоянии от начала
                const intersectionDistance = Math.sqrt((intersection.x - x1) ** 2 + (intersection.y - y1) ** 2);
                if (intersectionDistance > minDistance) {
                    return intersection;
                }
            }
        }
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
        return {
            x: x1 + t * (x2 - x1),
            y: y1 + t * (y2 - y1)
        };
    }
    
    return null;
}


// Проверка образования осколков (пока заглушка)
function checkForChipFormation() {
    // TODO: Реализовать алгоритм определения замкнутых областей
    // Пока что проверяем, есть ли достаточно трещин для образования осколков
    if (activeCracks.length > 5) {
        if (isDev) {
            console.log('🔍 Достаточно трещин для возможного образования осколков...');
        }
    }
}

// Запуск приложения
initApp().catch(console.error);